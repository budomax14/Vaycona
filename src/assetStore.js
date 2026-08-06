import {
  ACCEPTED_IMAGE_MIME_TYPES,
  ASSET_DB_NAME,
  ASSET_DB_STORE,
  ASSET_INDEX_STORAGE_KEY,
  ASSET_THUMB_SIZE,
  MAX_IMAGE_DIMENSION,
  MAX_UPLOAD_BYTES,
} from "./constants";

// Local asset storage (Phase 6). Two tiers:
//  - IndexedDB (this module's DB) holds the real Blob + a thumbnail Blob +
//    full metadata — the source of truth for binaries. Async by nature.
//  - A small synchronous companion index in localStorage (see
//    readAssetIndex/writeAssetIndexEntry below) holds just enough
//    (name/mime/dimensions/tiny thumbnail data URL/status) for the Uploads
//    panel and Layers rows to render instantly at boot, before IndexedDB
//    has resolved anything. It is never the source of truth for pixels —
//    just a fast, disposable cache kept in lockstep with every write here.
//
// Browser quota: IndexedDB storage is subject to the browser's general
// site-storage quota (commonly a percentage of free disk space, evictable
// under storage pressure per browser policy) — there is no fixed guaranteed
// capacity. This module does not attempt to manage quota beyond surfacing
// a clear error if a write fails (e.g. QuotaExceededError).

let dbPromise = null;

export function openAssetDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(ASSET_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ASSET_DB_STORE)) {
        const store = db.createObjectStore(ASSET_DB_STORE, { keyPath: "id" });
        store.createIndex("by_checksum", "checksum", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function withStore(mode, fn) {
  return openAssetDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(ASSET_DB_STORE, mode);
        const store = tx.objectStore(ASSET_DB_STORE);
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

// --- localStorage companion index (synchronous, small) ---

function readAssetIndex() {
  try {
    const raw = localStorage.getItem(ASSET_INDEX_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAssetIndex(index) {
  try {
    localStorage.setItem(ASSET_INDEX_STORAGE_KEY, JSON.stringify(index));
  } catch {
    // Quota exceeded or unavailable — the IndexedDB record remains the
    // source of truth; the panel just falls back to per-asset async loads.
  }
}

function upsertAssetIndexEntry(meta) {
  const index = readAssetIndex();
  index[meta.id] = {
    name: meta.name,
    mimeType: meta.mimeType,
    width: meta.width,
    height: meta.height,
    thumbDataUrl: meta.thumbDataUrl || null,
    status: meta.status,
    errorMessage: meta.errorMessage || null,
    createdAt: meta.createdAt,
  };
  writeAssetIndex(index);
}

function removeAssetIndexEntry(id) {
  const index = readAssetIndex();
  delete index[id];
  writeAssetIndex(index);
}

export function listAssetIndex() {
  return readAssetIndex();
}

// --- tiny pub-sub so useAsset() can react to a replace/repair elsewhere ---

const listeners = new Map();
const wildcardListeners = new Set();
export const assetEvents = {
  subscribe(id, cb) {
    if (!listeners.has(id)) listeners.set(id, new Set());
    listeners.get(id).add(cb);
    return () => listeners.get(id)?.delete(cb);
  },
  // Fires on ANY asset add/update/delete — backs the Uploads panel's list
  // view, which needs to know about new/removed assets in general rather
  // than tracking one specific id like useAsset does.
  subscribeAll(cb) {
    wildcardListeners.add(cb);
    return () => wildcardListeners.delete(cb);
  },
  emit(id) {
    listeners.get(id)?.forEach((cb) => cb());
    wildcardListeners.forEach((cb) => cb());
  },
};

// --- validation ---

export function validateImageFile(file) {
  if (!file || file.size === 0) return { ok: false, error: "The file is empty." };
  if (!ACCEPTED_IMAGE_MIME_TYPES.includes(file.type)) {
    return { ok: false, error: "Unsupported format. Please choose a JPEG, PNG, WebP, or GIF image." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `File too large. Maximum size is ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.` };
  }
  return { ok: true, error: null };
}

function decodeImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read image."));
    };
    img.src = url;
  });
}

// Exported so projectPackage.js (Phase 7D import/export) reuses the exact
// same integrity scheme instead of a second one.
export async function computeChecksum(blob) {
  try {
    const buffer = await blob.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null; // duplicate detection just becomes a no-op; not fatal
  }
}

function generateThumbnail(img, maxSize = ASSET_THUMB_SIZE) {
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);
  const thumbDataUrl = canvas.toDataURL("image/png");
  return new Promise((resolve) => {
    canvas.toBlob((thumbBlob) => resolve({ thumbBlob, thumbDataUrl }), "image/png");
  });
}

// Validates, decodes dimensions, checks for a duplicate via checksum,
// generates a thumbnail, writes the record to IndexedDB, and mirrors the
// lightweight metadata into the synchronous localStorage index. Resolves
// to the asset's metadata (never the Blob — callers use getAssetBlob/
// useAsset for that).
export async function putAsset(file, { name, sourceType = "upload" } = {}) {
  const validation = validateImageFile(file);
  if (!validation.ok) {
    return { id: null, status: "error", errorMessage: validation.error };
  }

  const now = Date.now();
  let img;
  try {
    img = await decodeImage(file);
  } catch {
    return { id: null, status: "error", errorMessage: "Unable to read image. The file may be corrupted." };
  }

  if (img.naturalWidth > MAX_IMAGE_DIMENSION || img.naturalHeight > MAX_IMAGE_DIMENSION) {
    return { id: null, status: "error", errorMessage: `Image dimensions are too large (max ${MAX_IMAGE_DIMENSION}px per side).` };
  }

  const checksum = await computeChecksum(file);
  if (checksum) {
    const existing = await findAssetByChecksum(checksum);
    if (existing) return existing;
  }

  const { thumbBlob, thumbDataUrl } = await generateThumbnail(img);

  const meta = {
    id: crypto.randomUUID(),
    name: name || file.name || "Untitled image",
    mimeType: file.type,
    size: file.size,
    width: img.naturalWidth,
    height: img.naturalHeight,
    checksum,
    status: "ready",
    errorMessage: null,
    sourceType,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await withStore("readwrite", (store) => store.put({ ...meta, blob: file, thumbBlob }));
  } catch (err) {
    return { id: null, status: "error", errorMessage: `Upload failed: ${err?.message || "storage error"}.` };
  }

  upsertAssetIndexEntry({ ...meta, thumbDataUrl });
  assetEvents.emit(meta.id);
  return meta;
}

// Project import only (Phase 7D) — stores a blob under a CALLER-SPECIFIED
// id rather than always minting a fresh one. Import needs to preserve the
// imported project's own asset-ID references exactly (so item.assetId
// values keep working with no remapping) unless that id is already taken
// by an unrelated existing asset — the caller (projectPackage.js) decides
// that via getAssetMeta(id) + computeChecksum before calling this, and
// passes a fresh id itself when a real collision is detected. Skips the
// global checksum-dedup lookup putAsset() does, on purpose: import must
// not silently fold a project's asset onto some unrelated existing upload
// that happens to hash the same.
export async function putAssetWithId(id, file, { name, sourceType = "import" } = {}) {
  const validation = validateImageFile(file);
  if (!validation.ok) {
    return { id: null, status: "error", errorMessage: validation.error };
  }
  let img;
  try {
    img = await decodeImage(file);
  } catch {
    return { id: null, status: "error", errorMessage: "Unable to read image. The file may be corrupted." };
  }
  if (img.naturalWidth > MAX_IMAGE_DIMENSION || img.naturalHeight > MAX_IMAGE_DIMENSION) {
    return { id: null, status: "error", errorMessage: `Image dimensions are too large (max ${MAX_IMAGE_DIMENSION}px per side).` };
  }

  const now = Date.now();
  const checksum = await computeChecksum(file);
  const { thumbBlob, thumbDataUrl } = await generateThumbnail(img);
  const meta = {
    id,
    name: name || file.name || "Untitled image",
    mimeType: file.type,
    size: file.size,
    width: img.naturalWidth,
    height: img.naturalHeight,
    checksum,
    status: "ready",
    errorMessage: null,
    sourceType,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await withStore("readwrite", (store) => store.put({ ...meta, blob: file, thumbBlob }));
  } catch (err) {
    return { id: null, status: "error", errorMessage: `Import failed: ${err?.message || "storage error"}.` };
  }

  upsertAssetIndexEntry({ ...meta, thumbDataUrl });
  assetEvents.emit(id);
  return meta;
}

export async function getAssetMeta(id) {
  if (!id) return null;
  const record = await withStore("readonly", (store) => requestToPromise(store.get(id)));
  const resolved = await record;
  if (!resolved) return null;
  const { blob, thumbBlob, ...meta } = resolved;
  return meta;
}

export async function getAssetBlob(id) {
  if (!id) return null;
  const record = await withStore("readonly", (store) => requestToPromise(store.get(id)));
  const resolved = await record;
  return resolved?.blob || null;
}

export async function getAssetThumbBlob(id) {
  if (!id) return null;
  const record = await withStore("readonly", (store) => requestToPromise(store.get(id)));
  const resolved = await record;
  return resolved?.thumbBlob || null;
}

export async function listAssets() {
  const records = await withStore("readonly", (store) => requestToPromise(store.getAll()));
  const resolved = await records;
  return resolved.map(({ blob, thumbBlob, ...meta }) => meta).sort((a, b) => b.createdAt - a.createdAt);
}

// Project Safety's "Rebuild thumbnails" (Phase 7E) — regenerates one
// asset's thumbnail from its already-stored original blob. Never touches
// the original binary or any project metadata; skips safely (returns
// false) if the asset or its source image can't be read.
export async function regenerateAssetThumbnail(id) {
  const record = await withStore("readonly", (store) => requestToPromise(store.get(id)));
  const resolved = await record;
  if (!resolved?.blob) return false;
  let img;
  try {
    img = await decodeImage(resolved.blob);
  } catch {
    return false;
  }
  const { thumbBlob, thumbDataUrl } = await generateThumbnail(img);
  const { blob, ...meta } = resolved;
  try {
    await withStore("readwrite", (store) => store.put({ ...meta, blob, thumbBlob }));
  } catch {
    return false;
  }
  upsertAssetIndexEntry({ ...meta, thumbDataUrl });
  assetEvents.emit(id);
  return true;
}

export async function findAssetByChecksum(checksum) {
  if (!checksum) return null;
  const records = await withStore("readonly", (store) => {
    const index = store.index("by_checksum");
    return requestToPromise(index.getAll(checksum));
  });
  const resolved = await records;
  if (!resolved.length) return null;
  const { blob, thumbBlob, ...meta } = resolved[0];
  return meta;
}

export async function deleteAsset(id) {
  await withStore("readwrite", (store) => store.delete(id));
  removeAssetIndexEntry(id);
  assetEvents.emit(id);
}

// Replaces an asset's binary in place (used when "retrying" a failed
// upload with the same slot, not part of the normal replace-image flow
// which creates a brand-new asset).
export async function retryAsset(id, file) {
  const validation = validateImageFile(file);
  if (!validation.ok) {
    upsertAssetIndexEntry({ id, status: "error", errorMessage: validation.error, name: file.name });
    assetEvents.emit(id);
    return { id, status: "error", errorMessage: validation.error };
  }
  const fresh = await putAsset(file, { name: file.name });
  if (fresh.id && fresh.id !== id) await deleteAsset(id);
  assetEvents.emit(id);
  return fresh;
}
