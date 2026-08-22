// Local "My Projects" store — lets a user save the live workspace as a
// named, reopenable project and switch between several of them from the
// Projects panel (LeftSidebar). Deliberately separate from templateService.js
// ("project"-kind templates there are shareable/publishable gallery content,
// mirrored to Firestore) — a saved project here is private to this browser,
// same as recovery snapshots/versions. Mirrors versionHistoryService.js's
// IndexedDB open/withStore/checksum conventions on purpose.

import { checksumOf } from "./autosaveService";
import { PROJECT_SCHEMA_VERSION } from "./constants";

const SAVED_PROJECT_DB_NAME = "personal-canva-saved-projects-v1";
const SAVED_PROJECT_STORE = "savedProjects";
export const SAVED_PROJECT_FORMAT_VERSION = 1;
export const MAX_SAVED_PROJECT_NAME_LENGTH = 80;

let dbPromise = null;
function openSavedProjectDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(SAVED_PROJECT_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SAVED_PROJECT_STORE)) {
        const store = db.createObjectStore(SAVED_PROJECT_STORE, { keyPath: "id" });
        store.createIndex("by_updatedAt", "updatedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function withStore(mode, fn) {
  return openSavedProjectDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(SAVED_PROJECT_STORE, mode);
        const store = tx.objectStore(SAVED_PROJECT_STORE);
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

export function isSavedProjectShapeValid(record) {
  if (!record || typeof record !== "object") return false;
  if (record.savedProjectFormatVersion !== SAVED_PROJECT_FORMAT_VERSION) return false;
  if (!record.data || !Array.isArray(record.data.pages) || record.data.pages.length === 0) return false;
  if (!Array.isArray(record.data.items)) return false;
  const { checksum, ...rest } = record;
  if (!checksum || checksumOf(JSON.stringify(rest)) !== checksum) return false;
  return true;
}

function cleanName(name) {
  return (name || "").trim().slice(0, MAX_SAVED_PROJECT_NAME_LENGTH) || "Untitled project";
}

export async function createSavedProject({ name, data, assetIds, thumbnail = null, pageCount = 1, objectCount = 0 }) {
  const now = Date.now();
  const record = withChecksum({
    id: crypto.randomUUID(),
    savedProjectFormatVersion: SAVED_PROJECT_FORMAT_VERSION,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    name: cleanName(name),
    createdAt: now,
    updatedAt: now,
    data,
    assetIds: assetIds || [],
    assetCount: (assetIds || []).length,
    pageCount,
    objectCount,
    thumbnail,
  });
  await withStore("readwrite", (store) => store.put(record));
  return record;
}

// Full payload replacement (spec-equivalent of templateService's
// updateTemplatePayload) — keeps id/name/createdAt, bumps updatedAt.
export async function updateSavedProject(id, { data, assetIds, thumbnail, pageCount, objectCount }) {
  const existing = await getSavedProjectById(id);
  if (!existing) return null;
  const next = withChecksum({
    ...existing,
    checksum: undefined,
    data,
    assetIds: assetIds || [],
    assetCount: (assetIds || []).length,
    pageCount: pageCount ?? existing.pageCount,
    objectCount: objectCount ?? existing.objectCount,
    thumbnail: thumbnail ?? existing.thumbnail,
    updatedAt: Date.now(),
  });
  await withStore("readwrite", (store) => store.put(next));
  return next;
}

export async function renameSavedProject(id, name) {
  const existing = await getSavedProjectById(id);
  if (!existing) return null;
  const next = withChecksum({ ...existing, checksum: undefined, name: cleanName(name), updatedAt: Date.now() });
  await withStore("readwrite", (store) => store.put(next));
  return next;
}

// Metadata-only listing (no `data` payload), newest-first.
export async function listSavedProjectSummaries() {
  const all = await withStore("readonly", (store) => requestToPromise(store.getAll()));
  const resolved = await all;
  return resolved.map(({ data, checksum, ...meta }) => meta).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getSavedProjectById(id) {
  if (!id) return null;
  const record = await withStore("readonly", (store) => requestToPromise(store.get(id)));
  return (await record) || null;
}

export async function deleteSavedProject(id) {
  await withStore("readwrite", (store) => store.delete(id));
}
