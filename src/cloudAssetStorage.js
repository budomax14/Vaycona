// Firebase Storage + Firestore mirror for a signed-in user's OWN uploaded
// images. Parallel to templateAssetStorage.js (which does the same thing
// for admin-published template assets), but scoped per-user instead of
// per-admin: every path/doc below is keyed by the uploader's uid, so one
// user's images are never visible to another (see firestore.rules/
// storage.rules).
//
// This module is pure Firebase I/O — it never touches IndexedDB or the
// localStorage asset index. assetStore.js is the orchestration layer that
// calls into this and persists the results locally.
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, setDoc, where } from "firebase/firestore";
import { db, storage } from "./firebase";

const ASSETS_SUBCOLLECTION = "assets";

function assetStoragePath(uid, assetId) {
  return `userUploads/${uid}/${assetId}`;
}

function assetDocRef(uid, assetId) {
  return doc(db, "users", uid, ASSETS_SUBCOLLECTION, assetId);
}

// Firestore rejects `undefined` field values; a JSON round-trip is the
// cheapest way to strip them (same convention as firestoreTemplates.js).
function sanitizeForFirestore(record) {
  return JSON.parse(JSON.stringify(record));
}

// Uploads the image bytes, optionally reporting fractional progress
// (0..1) as the transfer proceeds. Resolves to the public download URL.
export function uploadUserAsset(uid, assetId, blob, mimeType, onProgress) {
  const storageRef = ref(storage, assetStoragePath(uid, assetId));
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, blob, mimeType ? { contentType: mimeType } : undefined);
    task.on(
      "state_changed",
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) onProgress(snapshot.bytesTransferred / snapshot.totalBytes);
      },
      reject,
      async () => {
        try {
          resolve(await getDownloadURL(task.snapshot.ref));
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

export async function writeUserAssetMetadata(uid, assetId, metadata) {
  await setDoc(assetDocRef(uid, assetId), sanitizeForFirestore({ ...metadata, assetId, userId: uid }));
}

export async function getUserAssetMetadataDoc(uid, assetId) {
  if (!uid || !assetId) return null;
  const snap = await getDoc(assetDocRef(uid, assetId));
  return snap.exists() ? snap.data() : null;
}

// Cross-session/cross-device duplicate detection: a single-field equality
// query, so no composite Firestore index needs to be created for it.
export async function findUserAssetByChecksum(uid, checksum) {
  if (!uid || !checksum) return null;
  const snap = await getDocs(
    query(collection(db, "users", uid, ASSETS_SUBCOLLECTION), where("checksum", "==", checksum), limit(1))
  );
  return snap.empty ? null : snap.docs[0].data();
}

export async function listUserAssetsCloud(uid) {
  if (!uid) return [];
  const snap = await getDocs(collection(db, "users", uid, ASSETS_SUBCOLLECTION));
  return snap.docs.map((docSnap) => docSnap.data());
}

// Best-effort cleanup, mirroring deleteTemplateAssets: a failure here must
// never block whatever local removal it's cleaning up after.
export async function deleteUserAssetCloud(uid, assetId) {
  if (!uid || !assetId) return;
  await Promise.all([
    deleteObject(ref(storage, assetStoragePath(uid, assetId))).catch(() => {}),
    deleteDoc(assetDocRef(uid, assetId)).catch(() => {}),
  ]);
}
