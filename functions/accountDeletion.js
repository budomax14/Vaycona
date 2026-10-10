// In-app account deletion (required by the App Store and Google Play for any
// app that lets people create an account). Deletes everything tied to the
// signed-in account, in this order:
//   1. the Stripe customer — which cancels any active subscription at once,
//      so a deleted account is never billed again;
//   2. uploaded images in Storage (userUploads/{uid}/…, see
//      src/cloudAssetStorage.js);
//   3. users/{uid} and its subcollections (subscription state, free-project
//      allowance, uploaded-image records);
//   4. the Firebase Auth user itself.
// Stripe's customer.subscription.deleted webhook (stripe.js) looks the user
// up by stripeCustomerId, so once users/{uid} is gone it finds nobody and
// does nothing. Designs saved on the device itself (IndexedDB) aren't
// reachable from here; they stay on that device.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { getAuth } = require("firebase-admin/auth");
const Stripe = require("stripe");

if (!getApps().length) initializeApp();

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
// Mirrors src/constants.js's ADMIN_EMAIL — the admin account manages the
// template gallery and can't be deleted from inside the app.
const ADMIN_EMAIL = "budomax1995@gmail.com";

exports.deleteAccount = onCall(
  { secrets: [STRIPE_SECRET_KEY], region: "us-central1", timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }
    if ((request.auth.token.email || "").toLowerCase() === ADMIN_EMAIL) {
      throw new HttpsError("failed-precondition", "The admin account can't be deleted from the app.");
    }

    const uid = request.auth.uid;
    const db = getFirestore();
    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    const customerId = snap.exists ? snap.data().stripeCustomerId : null;

    if (customerId) {
      try {
        await new Stripe(STRIPE_SECRET_KEY.value()).customers.del(customerId);
      } catch (err) {
        if (err && err.code !== "resource_missing") {
          logger.error("deleteAccount: Stripe customer deletion failed", { uid, err });
          throw new HttpsError("internal", "We couldn't cancel your subscription. Please try again or contact support.");
        }
      }
    }

    await getStorage().bucket().deleteFiles({ prefix: `userUploads/${uid}/` });
    await db.recursiveDelete(userRef);
    await getAuth().deleteUser(uid);
    logger.info("deleteAccount: account deleted", { uid });
    return { deleted: true };
  }
);
