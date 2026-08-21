// Firebase Storage mirror for the actual image BYTES an admin-published
// template references. Firestore (firestoreTemplates.js) only mirrors the
// template's JSON `data` — asset ids, never pixels — because the real
// binaries live in each browser's own local assetStore.js IndexedDB and
// never leave it on their own. Without this module, a template published
// from the admin's browser would reference images no other browser's
// assetStore has ever seen, so useTemplate() in App.jsx downloads any
// asset it can't find locally from here and caches it into the local
// assetStore the first time that template is used.
//
// Security: writes are restricted to ADMIN_EMAIL by storage.rules
// (deployed via `firebase deploy --only storage`), mirroring
// firestore.rules — client code is never a trust boundary.
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

function assetPath(templateId, assetId) {
  return `templateAssets/${templateId}/${assetId}`;
}

export async function uploadTemplateAsset(templateId, assetId, blob, mimeType) {
  const storageRef = ref(storage, assetPath(templateId, assetId));
  await uploadBytes(storageRef, blob, mimeType ? { contentType: mimeType } : undefined);
  return getDownloadURL(storageRef);
}

// Best-effort cleanup when a template is unpublished/deleted — an upload
// failure here must never block the unpublish/delete it's cleaning up
// after, so callers fire-and-forget this per asset.
export async function deleteTemplateAssets(templateId, assetIds) {
  await Promise.all(
    (assetIds || []).map((assetId) =>
      deleteObject(ref(storage, assetPath(templateId, assetId))).catch(() => {})
    )
  );
}
