// Admin-only: give an account a plan without a Stripe subscription — demo
// accounts for App Review, testers, friends. Writes the same users/{uid}
// `tier` field the Stripe webhook (stripe.js) writes, with status "comped"
// so it's clear later that nobody is paying for it. Accounts with a live
// Stripe subscription are refused: their tier belongs to the webhook, and
// a comp would be overwritten (or would clobber billing state) on the next
// Stripe event.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

if (!getApps().length) initializeApp();

// Mirrors src/constants.js's ADMIN_EMAIL.
const ADMIN_EMAIL = "budomax1995@gmail.com";
const TIERS = new Set(["free", "pro", "business"]);

exports.setUserPlan = onCall({ region: "us-central1" }, async (request) => {
  const token = request.auth && request.auth.token;
  if (!token || (token.email || "").toLowerCase() !== ADMIN_EMAIL) {
    throw new HttpsError("permission-denied", "Only the admin can change plans.");
  }

  const email = String((request.data && request.data.email) || "").trim().toLowerCase();
  const tier = request.data && request.data.tier;
  if (!email) throw new HttpsError("invalid-argument", "Enter an email address.");
  if (!TIERS.has(tier)) throw new HttpsError("invalid-argument", "Unknown plan.");

  let user;
  try {
    user = await getAuth().getUserByEmail(email);
  } catch (err) {
    if (err && err.code === "auth/user-not-found") {
      throw new HttpsError("not-found", "No account uses that email. Create the account first.");
    }
    throw err;
  }

  const userRef = getFirestore().collection("users").doc(user.uid);
  const snap = await userRef.get();
  const data = snap.exists ? snap.data() : {};
  if (data.stripeSubscriptionId && data.status && data.status !== "canceled" && data.status !== "comped") {
    throw new HttpsError("failed-precondition", "This account has a paid subscription. Manage it in Stripe instead.");
  }

  await userRef.set(
    tier === "free"
      ? { tier: "free", status: FieldValue.delete(), updatedAt: Date.now() }
      : { tier, status: "comped", updatedAt: Date.now() },
    { merge: true }
  );
  logger.info("setUserPlan", { uid: user.uid, tier });
  return { email: user.email, tier };
});
