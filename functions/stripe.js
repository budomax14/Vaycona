// Stripe subscriptions backend — the only place that ever sees the Stripe
// secret key. Mirrors providers/openai.js's role: index.js just re-exports
// what's defined here.
//
// Data flow: a signed-in user calls createCheckoutSession (onCall, so
// request.auth.uid is verified by Firebase for free) -> redirected to
// Stripe's hosted Checkout -> Stripe calls stripeWebhook (onRequest, plain
// HTTP so we can verify its raw-body signature) on subscription lifecycle
// events -> webhook writes { tier, status, ... } onto users/{uid} via the
// Admin SDK, which is the ONLY writer of that collection (see
// firestore.rules: client writes are always denied).

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const Stripe = require("stripe");

if (!admin.apps.length) admin.initializeApp();

// Set once via: firebase functions:secrets:set STRIPE_SECRET_KEY /
// STRIPE_WEBHOOK_SECRET
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

// Mirrors src/subscriptionContext.jsx's PRICE_IDS map. Kept as a
// server-side allowlist too — a client is never trusted to send an
// arbitrary Stripe Price ID straight through to checkout.
const PRICE_TIERS = {
  price_1U2JIE90aGERiS3QGje8kZa4: "pro",
  price_1U2JRJ90aGERiS3QgOOy7hGp: "pro",
  price_1U2JWa90aGERiS3QzYjRUMYD: "business",
  price_1U2JZv90aGERiS3Q32hhmnnP: "business",
};

function tierForPriceId(priceId) {
  return PRICE_TIERS[priceId] || null;
}

async function findUidByCustomerId(db, customerId) {
  const snap = await db.collection("users").where("stripeCustomerId", "==", customerId).limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

exports.createCheckoutSession = onCall(
  { secrets: [STRIPE_SECRET_KEY], region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in to subscribe.");
    }
    const { priceId } = request.data || {};
    const tier = tierForPriceId(priceId);
    if (!tier) {
      throw new HttpsError("invalid-argument", "Unknown price.");
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY.value());
    const uid = request.auth.uid;
    const db = admin.firestore();
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    let customerId = userSnap.exists ? userSnap.data().stripeCustomerId : null;
    // Only ever granted once per account — a user who has already had a
    // Stripe subscription (even a canceled one) doesn't get a second free
    // trial just by re-subscribing.
    const eligibleForTrial = !(userSnap.exists && userSnap.data().stripeSubscriptionId);

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: request.auth.token.email || undefined,
        metadata: { uid },
      });
      customerId = customer.id;
      await userRef.set({ stripeCustomerId: customerId }, { merge: true });
    }

    const origin = (request.data && request.data.origin) || "https://vaycona-editor.web.app";
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: uid,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_types: ["card"],
      ...(eligibleForTrial ? { subscription_data: { trial_period_days: 7 } } : {}),
      success_url: `${origin}/#/?checkout=success`,
      cancel_url: `${origin}/#/?checkout=cancel`,
    });

    return { url: session.url };
  }
);

exports.createBillingPortalSession = onCall(
  { secrets: [STRIPE_SECRET_KEY], region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }
    const stripe = new Stripe(STRIPE_SECRET_KEY.value());
    const db = admin.firestore();
    const userSnap = await db.collection("users").doc(request.auth.uid).get();
    const customerId = userSnap.exists ? userSnap.data().stripeCustomerId : null;
    if (!customerId) {
      throw new HttpsError("failed-precondition", "No billing account found for this user yet.");
    }

    const origin = (request.data && request.data.origin) || "https://vaycona-editor.web.app";
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/#/`,
    });

    return { url: session.url };
  }
);

exports.stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET], region: "us-central1" },
  async (req, res) => {
    const stripe = new Stripe(STRIPE_SECRET_KEY.value());
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, req.headers["stripe-signature"], STRIPE_WEBHOOK_SECRET.value());
    } catch (err) {
      logger.error("Stripe webhook signature verification failed", err);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    const db = admin.firestore();

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const uid = session.client_reference_id;
          if (uid && session.subscription) {
            const subscription = await stripe.subscriptions.retrieve(session.subscription);
            const item = subscription.items.data[0];
            const tier = tierForPriceId(item?.price?.id) || "free";
            await db.collection("users").doc(uid).set(
              {
                tier,
                status: subscription.status,
                stripeCustomerId: session.customer,
                stripeSubscriptionId: subscription.id,
                currentPeriodEnd: item?.current_period_end ? item.current_period_end * 1000 : null,
                updatedAt: Date.now(),
              },
              { merge: true }
            );
          }
          break;
        }
        case "customer.subscription.updated": {
          const subscription = event.data.object;
          const uid = await findUidByCustomerId(db, subscription.customer);
          if (uid) {
            const item = subscription.items.data[0];
            const tier = tierForPriceId(item?.price?.id) || "free";
            await db.collection("users").doc(uid).set(
              {
                tier,
                status: subscription.status,
                stripeSubscriptionId: subscription.id,
                currentPeriodEnd: item?.current_period_end ? item.current_period_end * 1000 : null,
                updatedAt: Date.now(),
              },
              { merge: true }
            );
          }
          break;
        }
        case "customer.subscription.deleted": {
          const subscription = event.data.object;
          const uid = await findUidByCustomerId(db, subscription.customer);
          if (uid) {
            await db.collection("users").doc(uid).set(
              { tier: "free", status: "canceled", updatedAt: Date.now() },
              { merge: true }
            );
          }
          break;
        }
        case "invoice.payment_failed": {
          const invoice = event.data.object;
          const uid = await findUidByCustomerId(db, invoice.customer);
          if (uid) {
            await db.collection("users").doc(uid).set({ status: "past_due", updatedAt: Date.now() }, { merge: true });
          }
          break;
        }
        default:
          break;
      }
      res.status(200).send();
    } catch (err) {
      logger.error("Stripe webhook handling failed", err);
      res.status(500).send();
    }
  }
);
