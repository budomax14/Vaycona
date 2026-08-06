// Dedicated crash-recovery service (Phase 7C) — deliberately separate from
// autosaveService.js (normal saves), undo/redo history, and any future
// version history. Snapshots are emergency restoration points, not part of
// the normal save flow: creating one never changes the Phase 7B save-status
// label, and restoring one leaves the project Unsaved until a normal save
// (via autosaveService) succeeds.
//
// Storage: IndexedDB (a project can have many pages/objects — safer than
// localStorage's ~5-10MB budget, which autosaveService already occupies).
// Mirrors assetStore.js's open/withStore/requestToPromise pattern. Only
// project metadata + asset-ID references are stored — never image blobs
// (those stay in assetStore.js's own IndexedDB store, referenced by the
// same stable asset IDs the project already uses).
//
// A small session marker (open/heartbeat/closed) lives in localStorage —
// tiny, and needs to be readable synchronously at startup before anything
// async has resolved.

import { checksumOf } from "./autosaveService";
import { PROJECT_SCHEMA_VERSION } from "./constants";

const RECOVERY_DB_NAME = "personal-canva-recovery-v1";
const RECOVERY_STORE = "snapshots";
export const SNAPSHOT_FORMAT_VERSION = 1;
export const AUTO_SNAPSHOT_RETENTION_LIMIT = 7;

const WORKSPACE_ID_KEY = "personal-canva-workspace-id-v1";
const SESSION_MARKER_KEY = "personal-canva-session-marker-v1";
const HEARTBEAT_INTERVAL_MS = 10000;
// Supporting evidence only (spec §8) — a heartbeat older than this with no
// recorded close is treated as "the prior session likely didn't shut down
// cleanly," never as proof by itself.
const STALE_HEARTBEAT_THRESHOLD_MS = 30000;

// --- IndexedDB plumbing (same shape as assetStore.js) ---

let dbPromise = null;
function openRecoveryDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(RECOVERY_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECOVERY_STORE)) {
        const store = db.createObjectStore(RECOVERY_STORE, { keyPath: "id" });
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
  return openRecoveryDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(RECOVERY_STORE, mode);
        const store = tx.objectStore(RECOVERY_STORE);
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

// --- workspace ID (this app is single-project; a stable ID still lets
// snapshots declare which project they belong to, per spec §4) ---

export function getWorkspaceId() {
  let id = localStorage.getItem(WORKSPACE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(WORKSPACE_ID_KEY, id);
  }
  return id;
}

// "Open as new project" (Phase 7D import) gives the workspace a fresh
// identity rather than continuing the same one Replace would (this app
// has exactly one active workspace slot, so the distinction is the
// project's declared identity, not which storage slot it lives in — see
// the Phase 7D completion notes).
export function resetWorkspaceId() {
  const id = crypto.randomUUID();
  localStorage.setItem(WORKSPACE_ID_KEY, id);
  return id;
}

// --- snapshot integrity ---

function withChecksum(snapshot) {
  const checksum = checksumOf(JSON.stringify(snapshot));
  return { ...snapshot, checksum };
}

// Cheap structural + integrity check — NOT the same as full project
// validation (hierarchy cycles, asset references, etc.), which the caller
// (App.jsx) runs via the same validateItem/migrateFlatGroupsToGroupObjects/
// repairHierarchy pipeline loadWorkspaceState already uses, per spec §9.
export function isSnapshotShapeValid(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;
  if (snapshot.snapshotFormatVersion !== SNAPSHOT_FORMAT_VERSION) return false;
  if (!snapshot.data || !Array.isArray(snapshot.data.pages) || snapshot.data.pages.length === 0) return false;
  if (!Array.isArray(snapshot.data.items)) return false;
  const { checksum, ...rest } = snapshot;
  if (!checksum || checksumOf(JSON.stringify(rest)) !== checksum) return false;
  return true;
}

// --- CRUD ---

// data: the same {pages, activePageId, scale, items, guides, snapToGuides}
// shape autosaveService.serialize() already produces (spec §2/§6 — reusing
// the existing workspace serializer rather than inventing a second one).
export async function createSnapshot({ reason, data, baseRevision, projectUpdatedAt, assetIds, protectedFlag = false }) {
  const workspaceId = getWorkspaceId();

  // Skip an identical snapshot (spec §5) — compare against the newest
  // existing one's data checksum rather than the whole record (whose
  // id/createdAt always differ).
  const newest = await getNewestSnapshotSummary(workspaceId);
  if (newest) {
    const newestFull = await getSnapshotById(newest.id);
    if (newestFull && checksumOf(JSON.stringify(newestFull.data)) === checksumOf(JSON.stringify(data))) {
      return newestFull;
    }
  }

  const snapshot = withChecksum({
    id: crypto.randomUUID(),
    workspaceId,
    snapshotFormatVersion: SNAPSHOT_FORMAT_VERSION,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    createdAt: Date.now(),
    baseRevision: baseRevision ?? null,
    projectUpdatedAt: projectUpdatedAt ?? null,
    reason,
    data,
    assetIds: assetIds || [],
    pageCount: data.pages?.length || 0,
    objectCount: data.items?.length || 0,
    protected: protectedFlag,
    resolved: false,
  });

  await withStore("readwrite", (store) => store.put(snapshot));
  await pruneSnapshots(workspaceId);
  return snapshot;
}

// Metadata-only listing (spec §23 — full payloads loaded only when needed).
export async function listSnapshotSummaries() {
  const workspaceId = getWorkspaceId();
  const all = await withStore("readonly", (store) => {
    const index = store.index("by_workspaceId");
    return requestToPromise(index.getAll(workspaceId));
  });
  const resolved = await all;
  return resolved
    .map(({ data, checksum, ...meta }) => meta)
    .sort((a, b) => b.createdAt - a.createdAt);
}

async function getNewestSnapshotSummary(workspaceId) {
  const all = await withStore("readonly", (store) => {
    const index = store.index("by_workspaceId");
    return requestToPromise(index.getAll(workspaceId));
  });
  const resolved = await all;
  if (!resolved.length) return null;
  return resolved.sort((a, b) => b.createdAt - a.createdAt)[0];
}

export async function getSnapshotById(id) {
  if (!id) return null;
  const record = await withStore("readonly", (store) => requestToPromise(store.get(id)));
  return (await record) || null;
}

// Walks snapshots newest-first, skipping any that fail shape/checksum
// validation (spec §15) — one corrupted snapshot never blocks startup.
export async function getNewestValidSnapshot() {
  const summaries = await listSnapshotSummaries();
  for (const summary of summaries) {
    const full = await getSnapshotById(summary.id);
    if (isSnapshotShapeValid(full)) return full;
    // Leave it in place (marked implicitly invalid by failing validation
    // again next time) rather than deleting — pruneSnapshots below will
    // eventually clear it out with the rest of the oldest unprotected ones.
  }
  return null;
}

export async function deleteSnapshot(id) {
  await withStore("readwrite", (store) => store.delete(id));
}

export async function markSnapshotResolved(id) {
  const record = await getSnapshotById(id);
  if (!record) return;
  await withStore("readwrite", (store) => store.put({ ...record, resolved: true }));
}

// Oldest-first pruning of UNPROTECTED snapshots beyond the retention limit
// (spec §7). Never touches protected snapshots, uploaded assets, or the
// normal workspace/.backup keys (a different storage entirely).
export async function pruneSnapshots(workspaceId = getWorkspaceId()) {
  const all = await withStore("readonly", (store) => {
    const index = store.index("by_workspaceId");
    return requestToPromise(index.getAll(workspaceId));
  });
  const resolved = await all;
  const unprotected = resolved.filter((s) => !s.protected).sort((a, b) => b.createdAt - a.createdAt);
  if (unprotected.length <= AUTO_SNAPSHOT_RETENTION_LIMIT) return;
  const toRemove = unprotected.slice(AUTO_SNAPSHOT_RETENTION_LIMIT);
  for (const snapshot of toRemove) {
    await deleteSnapshot(snapshot.id);
  }
}

// Removes automatic (unprotected) snapshots whose data is identical to what
// just saved successfully (spec §6/§21) — leaves protected snapshots and
// anything still meaningfully different alone.
export async function removeObsoleteSnapshots(savedData) {
  const summaries = await listSnapshotSummaries();
  const savedChecksum = checksumOf(JSON.stringify(savedData));
  for (const summary of summaries) {
    if (summary.protected) continue;
    const full = await getSnapshotById(summary.id);
    if (full && checksumOf(JSON.stringify(full.data)) === savedChecksum) {
      await deleteSnapshot(summary.id);
    }
  }
}

// --- session-open / clean-shutdown marker (localStorage — small, must be
// readable synchronously at startup) ---

export function markSessionOpen() {
  const sessionId = crypto.randomUUID();
  const now = Date.now();
  try {
    localStorage.setItem(
      SESSION_MARKER_KEY,
      JSON.stringify({ sessionId, workspaceId: getWorkspaceId(), openedAt: now, heartbeatAt: now, closedAt: null })
    );
  } catch {
    // Marker is advisory only — a failure here just means the unclean-
    // session signal is unavailable next time, nothing else is affected.
  }
  return sessionId;
}

export function heartbeatSession(sessionId) {
  try {
    const raw = localStorage.getItem(SESSION_MARKER_KEY);
    if (!raw) return;
    const marker = JSON.parse(raw);
    if (marker.sessionId !== sessionId) return; // a newer tab/session took over the marker
    marker.heartbeatAt = Date.now();
    localStorage.setItem(SESSION_MARKER_KEY, JSON.stringify(marker));
  } catch {
    // best-effort
  }
}

export function markSessionClosed(sessionId) {
  try {
    const raw = localStorage.getItem(SESSION_MARKER_KEY);
    if (!raw) return;
    const marker = JSON.parse(raw);
    if (marker.sessionId !== sessionId) return;
    marker.closedAt = Date.now();
    localStorage.setItem(SESSION_MARKER_KEY, JSON.stringify(marker));
  } catch {
    // best-effort
  }
}

// Supporting evidence only (spec §8/§10) — never the sole basis for a
// recovery prompt, just one input alongside the revision/timestamp compare.
export function wasPriorSessionUnclean() {
  try {
    const raw = localStorage.getItem(SESSION_MARKER_KEY);
    if (!raw) return false;
    const marker = JSON.parse(raw);
    if (marker.closedAt) return false;
    return Date.now() - marker.heartbeatAt > STALE_HEARTBEAT_THRESHOLD_MS;
  } catch {
    return false;
  }
}

export const HEARTBEAT_INTERVAL = HEARTBEAT_INTERVAL_MS;

// --- one-shot reload signals used by the error-boundary screen (Phase 7C)
// — it renders outside the (possibly crashed) App component, so it can't
// call into App's own recovery handlers directly; instead it sets one of
// these before reloading, and App.jsx's mount effect consumes (and clears)
// the flag to decide how to boot. ---

const SKIP_RECOVERY_ONCE_KEY = "personal-canva-skip-recovery-once";
const FORCE_RECOVERY_ONCE_KEY = "personal-canva-force-recovery-once";

export function requestSkipRecoveryOnNextLoad() {
  localStorage.setItem(SKIP_RECOVERY_ONCE_KEY, "1");
}
export function requestForceRecoveryOnNextLoad() {
  localStorage.setItem(FORCE_RECOVERY_ONCE_KEY, "1");
}
export function consumeSkipRecoveryFlag() {
  const flag = localStorage.getItem(SKIP_RECOVERY_ONCE_KEY) === "1";
  if (flag) localStorage.removeItem(SKIP_RECOVERY_ONCE_KEY);
  return flag;
}
export function consumeForceRecoveryFlag() {
  const flag = localStorage.getItem(FORCE_RECOVERY_ONCE_KEY) === "1";
  if (flag) localStorage.removeItem(FORCE_RECOVERY_ONCE_KEY);
  return flag;
}
