// Centralized autosave service (Phase 7B). One instance backs the whole
// editor's "project metadata" persistence — components must not write the
// whole project to storage on their own; they mark the document dirty (or
// call scheduleSave/saveNow) and read status from here.
//
// Storage: localStorage, same key/shape the pre-7B autosave effect already
// used (image binaries live in IndexedDB via assetStore.js and are
// unaffected — this service only ever handles the small JSON project
// record). A single localStorage.setItem is already all-or-nothing at the
// browser level (no half-written value), so the main atomicity risk this
// guards against is a bad WRITE (thrown serialization, quota exceeded)
// rather than a torn read — see saveNow()'s backup-then-write-then-verify
// sequence.

export const SAVE_STATUS = Object.freeze({
  SAVED: "saved",
  UNSAVED: "unsaved",
  SAVING: "saving",
  ERROR: "error",
});

// Not a cryptographic digest (no collision resistance guarantee) — just a
// cheap integrity check to notice a torn/corrupted read, per spec §9/§16.
// Exported so recoveryService.js reuses the exact same integrity scheme
// (Phase 7C) rather than inventing a second one.
export function checksumOf(jsonString) {
  let hash = 0;
  for (let i = 0; i < jsonString.length; i++) {
    hash = (Math.imul(31, hash) + jsonString.charCodeAt(i)) | 0;
  }
  return hash.toString(16);
}

export function createAutosaveService({ storageKey, schemaVersion, serialize, debounceMs = 600, onStatusChange }) {
  const backupKey = `${storageKey}.backup`;
  let status = SAVE_STATUS.SAVED;
  let lastSavedAt = null;
  let lastError = null;
  let revision = 0;
  let dirty = false;
  let saving = false;
  let saveAgainAfter = false;
  let timer = null;

  function emit() {
    onStatusChange?.({ status, lastSavedAt, lastError, revision, dirty });
  }

  function setStatus(next, extra) {
    status = next;
    if (extra && "lastError" in extra) lastError = extra.lastError;
    emit();
  }

  function performSave() {
    if (saving) {
      // A change landed while a save was already in flight — don't overlap
      // writes; the in-flight save's finally-block below will re-run once
      // it completes, so the NEWEST state (not this stale call) wins.
      saveAgainAfter = true;
      return;
    }
    saving = true;
    setStatus(SAVE_STATUS.SAVING);
    try {
      const data = serialize();
      const record = {
        schemaVersion,
        revision: revision + 1,
        updatedAt: Date.now(),
        data,
      };
      const json = JSON.stringify(record);
      record.checksum = checksumOf(json);
      const finalJson = JSON.stringify(record);

      // Keep the previous good save until this one is confirmed, so an
      // interrupted write (tab killed mid-call) still leaves a loadable
      // project — see spec §8.
      const previous = localStorage.getItem(storageKey);
      if (previous) localStorage.setItem(backupKey, previous);
      localStorage.setItem(storageKey, finalJson);

      // Read-back verification — cheap, catches a silently-truncated write.
      const verify = localStorage.getItem(storageKey);
      if (verify !== finalJson) throw new Error("Save verification failed");

      revision = record.revision;
      lastSavedAt = record.updatedAt;
      dirty = false;
      setStatus(SAVE_STATUS.SAVED, { lastError: null });
    } catch (err) {
      setStatus(SAVE_STATUS.ERROR, { lastError: err?.message || "Unable to save" });
    } finally {
      saving = false;
      if (saveAgainAfter) {
        saveAgainAfter = false;
        performSave();
      }
    }
  }

  function markDirty() {
    if (dirty && status === SAVE_STATUS.UNSAVED) return;
    dirty = true;
    setStatus(SAVE_STATUS.UNSAVED);
  }

  function scheduleSave() {
    markDirty();
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      performSave();
    }, debounceMs);
  }

  function cancelPending() {
    clearTimeout(timer);
    timer = null;
  }

  // Runs any pending debounced save immediately (does not skip it) —
  // used before unload/export/opening another project (spec §4).
  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      performSave();
    }
  }

  function saveNow() {
    cancelPending();
    performSave();
  }

  function retry() {
    performSave();
  }

  function getStatus() {
    return { status, lastSavedAt, lastError, revision, dirty };
  }

  return { markDirty, scheduleSave, saveNow, cancelPending, flush, retry, getStatus };
}

// Reads a record written by createAutosaveService, verifying its checksum.
// Returns null if absent/corrupt so the caller can fall back safely
// (spec §7 serializer / §8 atomic save). `rest`'s key order matches what
// was hashed at write time (schemaVersion, revision, updatedAt, data) since
// destructuring out `checksum` preserves the remaining keys' original
// insertion order — so re-stringifying it reproduces the exact same string
// performSave() hashed before adding the checksum field.
export function readSavedRecord(storageKey) {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    const record = JSON.parse(raw);
    if (!record || typeof record !== "object") return null;
    const { checksum, ...rest } = record;
    if (checksum && checksumOf(JSON.stringify(rest)) !== checksum) return null;
    return record;
  } catch {
    return null;
  }
}

// Lightweight, on-demand storage-quota check (spec §12) — never polled;
// call at the moments the spec lists (large upload, save failure, manual
// save, project-info view). Returns null when the API is unavailable.
export async function checkStorageQuota() {
  if (!navigator.storage?.estimate) return null;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    if (!quota) return null;
    return { usage, quota, percentUsed: usage / quota };
  } catch {
    return null;
  }
}
