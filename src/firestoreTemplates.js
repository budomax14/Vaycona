// Firestore mirror for the ADMIN-PUBLISHED template gallery only. Personal
// reusable content (a user's own saved pages/sections/draft projects) stays
// entirely local in templateService.js's IndexedDB store, exactly as
// before — this file exists solely so that when the admin publishes,
// edits, or unpublishes a "project" template, every user's browser sees
// the change live, which a local-only store can never do across devices.
//
// Security: writes are restricted to ADMIN_EMAIL by the Firestore rules in
// firestore.rules (deployed via `firebase deploy --only firestore:rules`),
// not by anything in this file — client code is never a trust boundary.
import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const COLLECTION = "publishedTemplates";

// Firestore rejects `undefined` field values (IndexedDB doesn't care); a
// JSON round-trip is the cheapest way to strip them from a plain-data
// template record before writing.
function sanitizeForFirestore(record) {
  return JSON.parse(JSON.stringify(record));
}

export async function publishTemplateToCloud(template) {
  await setDoc(doc(db, COLLECTION, template.id), sanitizeForFirestore(template));
}

export async function removeTemplateFromCloud(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function getPublishedTemplateFromCloud(id) {
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? snap.data() : null;
}

// Live-subscribes to the whole published gallery. Returns an unsubscribe
// function; callback fires once immediately with the current snapshot and
// again on every future change (from any user's browser).
export function subscribeToPublishedTemplates(callback, onError) {
  return onSnapshot(
    collection(db, COLLECTION),
    (snapshot) => callback(snapshot.docs.map((docSnap) => docSnap.data())),
    onError
  );
}
