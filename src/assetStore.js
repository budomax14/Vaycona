import {
  ACCEPTED_IMAGE_MIME_TYPES,
  ASSET_DB_NAME,
  ASSET_DB_STORE,
  ASSET_INDEX_STORAGE_KEY,
  ASSET_THUMB_SIZE,
  MAX_IMAGE_DIMENSION,
  MAX_UPLOAD_BYTES,
} from "./constants";
import { auth } from "./firebase";
import {
  findUserAssetByChecksum,
  getUserAssetMetadataDoc,
  listUserAssetsCloud,
  uploadUserAsset,
  writeUserAssetMetadata,
} from "./cloudAssetStorage";

// Local asset storage (Phase 6), extended for Firebase-Storage-backed
// uploads. Three tiers now:
//  - Firebase Storage + Firestore (see cloudAssetStorage.js) is the
//    PERMANENT home for an uploaded image's bytes + metadata, scoped to
//    the signed-in user (userUploads/{uid}/{assetId} + users/{uid}/
//    assets/{assetId}). This is what survives a cleared browser/IndexedDB
//    quota exhaustion — the original bug this was built to fix.
//  - IndexedDB (this module's DB) is now a CACHE of that: it holds the
//    Blob + a thumbnail Blob + full metadata for whatever's been uploaded
//    or downloaded in THIS browser, so the editor/canvas keep resolving
//    assets to same-origin blob: URLs exactly as before (useImageElement's
//    canvas-based flip/export only stays untainted for same-origin
//    sources — a remote https:// Storage URL fed straight into it would
//    break export). getAssetMeta/getAssetBlob transparently fall back to
//    Firestore/Storage on a local cache miss and re-populate this cache,
//    mirroring the existing template-asset lazy-sync pattern in App.jsx's
//    ensureTemplateAssetsAvailable.
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
// capacity. Uploads no longer depend on this quota for durability (Firebase
// Storage does); this module still surfaces a clear error if a local cache
// write fails (e.g. QuotaExceededError), but that only affects this
// browser's cache, not the asset itself.

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
    // Remote fallback the Uploads panel can render from before this
    // asset's blob has been downloaded into this browser's cache (see
    // syncAssetIndexFromCloud / cacheCloudDocLocally below).
    cloudUrl: meta.cloudUrl || null,
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

function cloudStoragePath(uid, assetId) {
  return `userUploads/${uid}/${assetId}`;
}

// Uploads a freshly-created local asset's bytes to this user's permanent
// Firebase Storage folder + writes its Firestore metadata doc, then
// returns meta merged with the outcome. Never throws — a network/
// permission failure just means the asset stays local-only for now
// (cloudStatus: "error"); migrateLocalAssetsToCloud() retries it on the
// next app load. Template-sync assets are skipped: those already have
// their own admin-owned cloud copy under templateAssets/…, and mirroring
// them into this user's personal folder would be both wrong (wrong
// owner) and wasteful.
async function attachCloudSync(meta, blob, onProgress) {
  if (meta.sourceType === "template-sync") return meta;
  const uid = auth.currentUser?.uid;
  if (!uid) return { ...meta, cloudStatus: "error", cloudError: "Not signed in." };
  try {
    const url = await uploadUserAsset(uid, meta.id, blob, meta.mimeType, onProgress);
    const storagePath = cloudStoragePath(uid, meta.id);
    await writeUserAssetMetadata(uid, meta.id, {
      url,
      storagePath,
      name: meta.name,
      size: meta.size,
      mimeType: meta.mimeType,
      width: meta.width,
      height: meta.height,
      checksum: meta.checksum,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
    });
    return { ...meta, cloudStatus: "synced", cloudUrl: url, storagePath, cloudError: null };
  } catch (err) {
    return { ...meta, cloudStatus: "error", cloudError: err?.message || "Cloud sync failed." };
  }
}

// Downloads an already-cloud-backed asset's bytes into this browser's
// local cache (IndexedDB + the synchronous index), for both directions a
// cache miss can happen: a duplicate re-upload after the cache was
// cleared (putAsset's checksum dedup), and resolving an assetId the
// canvas needs that this browser has never seen before (getAssetBlob).
async function cacheCloudDocLocally(cloudDoc) {
  const response = await fetch(cloudDoc.url);
  if (!response.ok) throw new Error("Could not download the cloud copy of this image.");
  const blob = await response.blob();
  const img = await decodeImage(blob);
  const { thumbBlob, thumbDataUrl } = await generateThumbnail(img);
  const meta = {
    id: cloudDoc.assetId,
    name: cloudDoc.name || "Untitled image",
    mimeType: cloudDoc.mimeType,
    size: cloudDoc.size,
    width: cloudDoc.width,
    height: cloudDoc.height,
    checksum: cloudDoc.checksum || null,
    status: "ready",
    errorMessage: null,
    sourceType: "cloud-sync",
    createdAt: cloudDoc.createdAt || Date.now(),
    updatedAt: Date.now(),
    cloudStatus: "synced",
    cloudUrl: cloudDoc.url,
    storagePath: cloudDoc.storagePath || null,
  };
  await withStore("readwrite", (store) => store.put({ ...meta, blob, thumbBlob }));
  upsertAssetIndexEntry({ ...meta, thumbDataUrl });
  assetEvents.emit(meta.id);
  return { meta, blob };
}

async function findCloudDuplicateAndCache(checksum) {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  try {
    const cloudMatch = await findUserAssetByChecksum(uid, checksum);
    if (!cloudMatch) return null;
    const { meta } = await cacheCloudDocLocally(cloudMatch);
    return meta;
  } catch {
    return null; // best-effort — fall through to a normal upload
  }
}

// Validates, decodes dimensions, checks for a duplicate via checksum
// (locally first, then — in case this browser's cache doesn't have it —
// against this user's cloud library), generates a thumbnail, uploads the
// original to Firebase Storage + Firestore (see attachCloudSync), writes
// the local IndexedDB cache record, and mirrors the lightweight metadata
// into the synchronous localStorage index. Resolves to the asset's
// metadata (never the Blob — callers use getAssetBlob/useAsset for that).
export async function putAsset(file, { name, sourceType = "upload", onProgress } = {}) {
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
    const cloudExisting = await findCloudDuplicateAndCache(checksum);
    if (cloudExisting) return cloudExisting;
  }

  const { thumbBlob, thumbDataUrl } = await generateThumbnail(img);

  let meta = {
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

  meta = await attachCloudSync(meta, file, onProgress);

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
  let meta = {
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

  meta = await attachCloudSync(meta, file);

  try {
    await withStore("readwrite", (store) => store.put({ ...meta, blob: file, thumbBlob }));
  } catch (err) {
    return { id: null, status: "error", errorMessage: `Import failed: ${err?.message || "storage error"}.` };
  }

  upsertAssetIndexEntry({ ...meta, thumbDataUrl });
  assetEvents.emit(id);
  return meta;
}

// Resolves an asset's metadata, falling back to this user's Firestore
// asset doc when the local cache doesn't have it (cache was cleared, or
// this is a different browser/session than the one that uploaded it).
// The cloud fallback is metadata-only here — getAssetBlob is what
// actually downloads and re-caches the bytes, so a caller that only
// needs dimensions/name (export preflight, brand-kit import dedup, etc.)
// doesn't pay for a full image download it doesn't need.
export async function getAssetMeta(id) {
  if (!id) return null;
  const record = await withStore("readonly", (store) => requestToPromise(store.get(id)));
  const resolved = await record;
  if (resolved) {
    const { blob, thumbBlob, ...meta } = resolved;
    return meta;
  }
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  try {
    const cloudDoc = await getUserAssetMetadataDoc(uid, id);
    if (!cloudDoc) return null;
    return {
      id: cloudDoc.assetId || id,
      name: cloudDoc.name || "Untitled image",
      mimeType: cloudDoc.mimeType,
      size: cloudDoc.size,
      width: cloudDoc.width,
      height: cloudDoc.height,
      checksum: cloudDoc.checksum || null,
      status: "ready",
      errorMessage: null,
      sourceType: "cloud",
      createdAt: cloudDoc.createdAt || null,
      updatedAt: cloudDoc.updatedAt || null,
      cloudStatus: "synced",
      cloudUrl: cloudDoc.url,
    };
  } catch {
    return null;
  }
}

// Resolves an asset's actual bytes, falling back to downloading + caching
// this user's cloud copy on a local cache miss (see cacheCloudDocLocally)
// — this is what lets useAsset()/useImageElement() keep working after
// IndexedDB is cleared, with no changes needed in either of those files.
export async function getAssetBlob(id) {
  if (!id) return null;
  const record = await withStore("readonly", (store) => requestToPromise(store.get(id)));
  const resolved = await record;
  if (resolved?.blob) return resolved.blob;
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  try {
    const cloudDoc = await getUserAssetMetadataDoc(uid, id);
    if (!cloudDoc?.url) return null;
    const { blob } = await cacheCloudDocLocally({ ...cloudDoc, assetId: cloudDoc.assetId || id });
    return blob;
  } catch {
    return null;
  }
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

// Local-cache removal only — this never touches the cloud copy. Callers
// that need to also delete an asset's PERMANENT Firebase Storage/Firestore
// copy do so explicitly via cloudAssetStorage.js's deleteUserAssetCloud,
// after confirming (their own reference-count logic) that no saved design
// still needs it — see App.jsx's removeAssetFromLibrary/
// handleDeleteUnusedAssets. Keeping that decision out of this module
// mirrors how it already worked pre-migration: removing an asset from the
// local library never cascades into anything else on its own.
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

// Merges cloud-sync fields onto an ALREADY-CACHED local record without
// touching its blob/thumbnail — used by migrateLocalAssetsToCloud below
// once an asset's cloud upload (or duplicate match) resolves.
async function patchAssetCloudFields(id, fields) {
  const record = await withStore("readonly", (store) => requestToPromise(store.get(id)));
  const resolved = await record;
  if (!resolved) return;
  const next = { ...resolved, ...fields, updatedAt: Date.now() };
  await withStore("readwrite", (store) => store.put(next));
  const { blob, thumbBlob, ...meta } = next;
  const existingThumbDataUrl = readAssetIndex()[id]?.thumbDataUrl || null;
  upsertAssetIndexEntry({ ...meta, thumbDataUrl: existingThumbDataUrl });
  assetEvents.emit(id);
}

async function migrateOneAssetToCloud(asset, uid) {
  try {
    if (asset.checksum) {
      const cloudMatch = await findUserAssetByChecksum(uid, asset.checksum);
      if (cloudMatch) {
        await patchAssetCloudFields(asset.id, {
          cloudStatus: "synced",
          cloudUrl: cloudMatch.url,
          storagePath: cloudMatch.storagePath || null,
          cloudError: null,
        });
        return;
      }
    }
    const blob = await getAssetBlob(asset.id); // guaranteed a local hit — asset came from listAssets()
    if (!blob) return;
    const url = await uploadUserAsset(uid, asset.id, blob, asset.mimeType);
    const storagePath = cloudStoragePath(uid, asset.id);
    await writeUserAssetMetadata(uid, asset.id, {
      url,
      storagePath,
      name: asset.name,
      size: asset.size,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      checksum: asset.checksum,
      createdAt: asset.createdAt,
      updatedAt: Date.now(),
    });
    await patchAssetCloudFields(asset.id, { cloudStatus: "synced", cloudUrl: url, storagePath, cloudError: null });
  } catch {
    await patchAssetCloudFields(asset.id, { cloudStatus: "error" });
  }
}

// One-time backfill for assets uploaded before this migration (requirement
// 4's safe migration strategy) — and, because it re-runs on every app
// load, also the automatic retry for any upload whose cloud sync failed
// earlier (network blip, transient permission error, etc). Purely
// additive: never deletes or modifies an existing local blob, so it's
// safe to interrupt (a tab close mid-run just means the remaining assets
// get picked up again next load) and safe to re-run redundantly (assets
// already cloudStatus: "synced" are skipped).
export async function migrateLocalAssetsToCloud() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const all = await listAssets();
  for (const asset of all) {
    if (asset.cloudStatus === "synced" || asset.sourceType === "template-sync") continue;
    // eslint-disable-next-line no-await-in-loop
    await migrateOneAssetToCloud(asset, uid);
  }
}

// Repopulates the synchronous localStorage index with any of this user's
// cloud assets missing from it (e.g. after the cache was cleared, or on a
// brand-new browser) — this is what makes the Uploads panel show a
// user's full library again before any individual asset has been
// re-downloaded. Each restored entry carries a `cloudUrl` the panel can
// render a thumbnail from directly; the actual blob/thumbnail only get
// cached locally once the asset is actually used (drag/click onto the
// canvas), via getAssetBlob's fallback above.
export async function syncAssetIndexFromCloud() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  let cloudAssets;
  try {
    cloudAssets = await listUserAssetsCloud(uid);
  } catch {
    return; // offline/permission issue — local cache, if any, still works
  }
  const index = readAssetIndex();
  let changed = false;
  for (const cloudDoc of cloudAssets) {
    const id = cloudDoc.assetId;
    if (!id || index[id]) continue;
    index[id] = {
      name: cloudDoc.name || "Untitled image",
      mimeType: cloudDoc.mimeType,
      width: cloudDoc.width,
      height: cloudDoc.height,
      thumbDataUrl: null,
      cloudUrl: cloudDoc.url,
      status: "ready",
      errorMessage: null,
      createdAt: cloudDoc.createdAt || Date.now(),
    };
    changed = true;
  }
  if (changed) {
    writeAssetIndex(index);
    assetEvents.emit();
  }
}
