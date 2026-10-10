// Free-plan allowance: an account without a subscription can save/print
// FREE_PROJECT_LIMIT different projects without the watermark; every
// project after that still exports, but watermarked. The claimed project
// keys live on users/{uid}.freeProjectKeys, written only here (firestore.rules
// denies client writes to users/{uid}), so the allowance follows the
// account across the website, desktop and phone apps and can't be reset by
// clearing a browser.
//
// A "project key" is the editor's stable per-design id (App.jsx's
// projectKeyRef) — re-exporting or reprinting a project that's already
// claimed never uses up another slot.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

if (!getApps().length) initializeApp();

const FREE_PROJECT_LIMIT = 2;
// Mirrors src/constants.js's ADMIN_EMAIL (and firestore.rules) — the admin
// account is treated as top tier everywhere.
const ADMIN_EMAIL = "budomax1995@gmail.com";
const PROJECT_KEY_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

// Pure decision, separate from Firestore so it can be unit-tested.
// Returns { watermark, claim } — `claim` means record projectKey as used.
function decideFreeProject(userData, projectKey) {
  const tier = (userData && userData.tier) || "free";
  const used = Array.isArray(userData && userData.freeProjectKeys) ? userData.freeProjectKeys : [];
  if (tier !== "free") return { watermark: false, claim: false, used: used.length };
  if (used.includes(projectKey)) return { watermark: false, claim: false, used: used.length };
  if (used.length >= FREE_PROJECT_LIMIT) return { watermark: true, claim: false, used: used.length };
  return { watermark: false, claim: true, used: used.length + 1 };
}

exports.decideFreeProject = decideFreeProject;
exports.FREE_PROJECT_LIMIT = FREE_PROJECT_LIMIT;

exports.claimFreeProject = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  if (request.auth.token.firebase && request.auth.token.firebase.sign_in_provider === "anonymous") {
    throw new HttpsError("permission-denied", "Create an account to save or print your designs.");
  }
  const projectKey = request.data && request.data.projectKey;
  if (typeof projectKey !== "string" || !PROJECT_KEY_PATTERN.test(projectKey)) {
    throw new HttpsError("invalid-argument", "Invalid project.");
  }
  if ((request.auth.token.email || "").toLowerCase() === ADMIN_EMAIL) {
    return { watermark: false, used: 0, limit: FREE_PROJECT_LIMIT };
  }

  const db = getFirestore();
  const ref = db.collection("users").doc(request.auth.uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const decision = decideFreeProject(snap.exists ? snap.data() : null, projectKey);
    if (decision.claim) {
      tx.set(ref, { freeProjectKeys: FieldValue.arrayUnion(projectKey) }, { merge: true });
    }
    return { watermark: decision.watermark, used: decision.used, limit: FREE_PROJECT_LIMIT };
  });
});
