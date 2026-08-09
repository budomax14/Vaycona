import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
import { useAuth } from "./authContext";

const SubscriptionContext = createContext(null);

// Stripe Price IDs — not secret, safe to ship client-side. Replace the
// placeholders below with the real Price IDs once the Pro/Business
// products + prices are created in the Stripe Dashboard (see
// functions/stripe.js's PRICE_TIERS, which must list the same IDs as a
// server-side allowlist).
export const PRICE_IDS = {
  pro: { monthly: "price_1U2JIE90aGERiS3QGje8kZa4", annual: "price_1U2JRJ90aGERiS3QgOOy7hGp" },
  business: { monthly: "price_1U2JWa90aGERiS3QzYjRUMYD", annual: "price_1U2JZv90aGERiS3Q32hhmnnP" },
};

export const TIER_RANK = { free: 0, pro: 1, business: 2 };

// Wraps the app (below AuthProvider — subscription state is meaningless
// without a signed-in user) so both the editor and any gated UI (template
// gallery, export dialog, top nav) can read the current plan the same way
// authContext.jsx's useAuth() is read. Backed by users/{uid} in Firestore,
// which only the Stripe webhook Cloud Function ever writes (see
// firestore.rules) — this context is read-only from the client's
// perspective aside from the two checkout/portal redirects below.
export function SubscriptionProvider({ children }) {
  const { user, isAdmin } = useAuth();
  const [doc_, setDoc_] = useState(undefined); // undefined = loading, null = no subscription doc (free)

  useEffect(() => {
    if (!user) {
      setDoc_(null);
      return;
    }
    setDoc_(undefined);
    return onSnapshot(doc(db, "users", user.uid), (snap) => {
      setDoc_(snap.exists() ? snap.data() : null);
    });
  }, [user]);

  // The admin account has no Stripe subscription of its own — treat it as
  // the top tier everywhere so gating never blocks the person managing the
  // content behind it.
  const tier = isAdmin ? "business" : doc_?.tier || "free";
  const status = doc_?.status || null;

  const value = {
    tier,
    status,
    loading: !!user && doc_ === undefined,
    openCheckout: async (priceId) => {
      const fn = httpsCallable(functions, "createCheckoutSession");
      const { data } = await fn({ priceId, origin: window.location.origin });
      window.location.href = data.url;
    },
    openBillingPortal: async () => {
      const fn = httpsCallable(functions, "createBillingPortalSession");
      const { data } = await fn({ origin: window.location.origin });
      window.location.href = data.url;
    },
  };

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within a SubscriptionProvider");
  return ctx;
}
