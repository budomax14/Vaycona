// Local version history (Phase 7E) — deliberately separate from undo/
// redo, autosave, recovery snapshots, and exported project packages.
// Recovery snapshots are emergency restoration points created constantly
// in the background; versions are meaningful named/system milestones the
// user (or a documented safety trigger) explicitly creates, meant to be
// kept around and browsed. Mirrors recoveryService.js's IndexedDB
// open/withStore/requestToPromise shape and its checksum/retention
// conventions on purpose — same architecture, different store and intent.

import { checksumOf } from "./autosaveService";
import { getWorkspaceId } from "./recoveryService";
import { PROJECT_SCHEMA_VERSION } from "./constants";

const VERSION_DB_NAME = "personal-canva-versions-v1";
const VERSION_STORE = "versions";
export const VERSION_FORMAT_VERSION = 1;
export const AUTO_VERSION_RETENTION_LIMIT = 10;
export const MAX_VERSION_NAME_LENGTH = 80;
export const MAX_VERSION_NOTE_LENGTH = 500;

let dbPromise = null;
function openVersionDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(VERSION_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(VERSION_STORE)) {
        const store = db.createObjectStore(VERSION_STORE, { keyPath: "id" });
        store.createIndex("by_workspaceId", "workspaceId", { unique: false });
        store.createIndex("by_createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function withStore(mode, fn) {
  return openVersionDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(VERSION_STORE, mode);
        const store = tx.objectStore(VERSION_STORE);
        const result = fn(store);
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withChecksum(record) {
  return { ...record, checksum: checksumOf(JSON.stringify(record)) };
}

export function isVersionShapeValid(version) {
  if (!version || typeof version !== "object") return false;
  if (version.versionFormatVersion !== VERSION_FORMAT_VERSION) return false;
  if (!version.data || !Array.isArray(version.data.pages) || version.data.pages.length === 0) return false;
  if (!Array.isArray(version.data.items)) return false;
  const { checksum, ...rest } = version;
  if (!checksum || checksumOf(JSON.stringify(rest)) !== checksum) return false;
  return true;
}

// data: same {pages, activePageId, scale, items, guides, snapToGuides}
// shape autosave/recovery already use. `type`: "manual" | "auto-milestone".
export async function createVersion({
  type,
  name,
  note,
  data,
  sourceRevision,
  assetIds,
  missingAssetCount = 0,
  protectedFlag = false,
}) {
  const workspaceId = getWorkspaceId();
  const version = withChecksum({
    id: crypto.randomUUID(),
    workspaceId,
    versionFormatVersion: VERSION_FORMAT_VERSION,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    createdAt: Date.now(),
    type,
    name: (name || "").trim().slice(0, MAX_VERSION_NAME_LENGTH) || null,
    note: (note || "").trim().slice(0, MAX_VERSION_NOTE_LENGTH) || null,
    sourceRevision: sourceRevision ?? null,
    projectUpdatedAt: Date.now(),
    data,
    assetIds: assetIds || [],
    pageCount: data.pages.length,
    objectCount: data.items.length,
    groupCount: data.items.filter((it) => it.type === "group").length,
    assetCount: (assetIds || []).length,
    missingAssetCount,
    protected: protectedFlag,
  });
  await withStore("readwrite", (store) => store.put(version));
  if (type !== "manual") await pruneAutoVersions(workspaceId);
  return version;
}

export async function listVersionSummaries() {
  const workspaceId = getWorkspaceId();
  const all = await withStore("readonly", (store) => {
    const index = store.index("by_workspaceId");
    return requestToPromise(index.getAll(workspaceId));
  });
  const resolved = await all;
  return resolved.map(({ data, checksum, ...meta }) => meta).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getVersionById(id) {
  if (!id) return null;
  const record = await withStore("readonly", (store) => requestToPromise(store.get(id)));
  return (await record) || null;
}

export async function renameVersion(id, name, note) {
  const version = await getVersionById(id);
  if (!version || version.type !== "manual") return null;
  const trimmedName = (name || "").trim().slice(0, MAX_VERSION_NAME_LENGTH);
  if (!trimmedName) return null;
  // Renaming must not change content/checksum semantics for the payload —
  // recompute the checksum over the renamed record itself (still integrity-
  // checked, just reflecting the new name/note, not a content mutation).
  const updated = withChecksum({
    ...version,
    checksum: undefined,
    name: trimmedName,
    note: (note ?? version.note ?? "").toString().trim().slice(0, MAX_VERSION_NOTE_LENGTH) || null,
  });
  await withStore("readwrite", (store) => store.put(updated));
  return updated;
}

export async function deleteVersion(id) {
  await withStore("readwrite", (store) => store.delete(id));
}

// Oldest-first pruning of unprotected AUTOMATIC versions beyond the
// retention limit — manual versions are never touched here (spec §7).
export async function pruneAutoVersions(workspaceId = getWorkspaceId()) {
  const all = await withStore("readonly", (store) => {
    const index = store.index("by_workspaceId");
    return requestToPromise(index.getAll(workspaceId));
  });
  const resolved = await all;
  const autoUnprotected = resolved
    .filter((v) => v.type !== "manual" && !v.protected)
    .sort((a, b) => b.createdAt - a.createdAt);
  if (autoUnprotected.length <= AUTO_VERSION_RETENTION_LIMIT) return;
  const toRemove = autoUnprotected.slice(AUTO_VERSION_RETENTION_LIMIT);
  for (const version of toRemove) await deleteVersion(version.id);
}

// Simple, documented comparison summary (spec §10) — not a visual diff.
export function compareVersionToCurrent(versionSummary, current) {
  return {
    pageCountDiff: (versionSummary.pageCount || 0) - (current.pageCount || 0),
    objectCountDiff: (versionSummary.objectCount || 0) - (current.objectCount || 0),
    groupCountDiff: (versionSummary.groupCount || 0) - (current.groupCount || 0),
    assetCountDiff: (versionSummary.assetCount || 0) - (current.assetCount || 0),
    currentRevision: current.revision ?? null,
    versionRevision: versionSummary.sourceRevision ?? null,
    currentUpdatedAt: current.updatedAt ?? null,
    versionCreatedAt: versionSummary.createdAt,
  };
}

// Rough, on-demand storage estimate for this store only (spec §19) — never
// polled; callers refresh it at the documented moments.
export async function estimateVersionStorageBytes() {
  const workspaceId = getWorkspaceId();
  const all = await withStore("readonly", (store) => {
    const index = store.index("by_workspaceId");
    return requestToPromise(index.getAll(workspaceId));
  });
  const resolved = await all;
  return resolved.reduce((sum, v) => sum + JSON.stringify(v.data || {}).length, 0);
}
