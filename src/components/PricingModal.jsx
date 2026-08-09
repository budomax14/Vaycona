import React, { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { useSubscription, PRICE_IDS } from "../subscriptionContext";

const PLANS = [
  {
    key: "free",
    name: "Free",
    tagline: "Get started",
    monthly: 0,
    annual: 0,
    features: ["Full editor access", "AI illustrations", "Charts & tables", "Watermarked exports", "Starter templates"],
  },
  {
    key: "pro",
    name: "Pro",
    tagline: "For regular creators",
    monthly: 9.99,
    annual: 99.99,
    features: ["Everything in Free", "Clean, watermark-free exports", "Full template gallery"],
  },
  {
    key: "business",
    name: "Business",
    tagline: "For teams & brands",
    monthly: 19.99,
    annual: 199.99,
    features: ["Everything in Pro", "Priority support"],
  },
];

export default function PricingModal({ isOpen, onClose }) {
  const { tier: currentTier, openCheckout } = useSubscription();
  const [cycle, setCycle] = useState("monthly");
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleChoose(planKey) {
    setError(null);
    setLoadingPlan(planKey);
    try {
      await openCheckout(PRICE_IDS[planKey][cycle]);
    } catch (err) {
      setError(err.message || "Couldn't start checkout. Please try again.");
      setLoadingPlan(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Upgrade your plan</h2>
          <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label="Close pricing">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="mb-6 flex justify-center">
            <div className="flex gap-1 rounded-lg border border-gray-200 p-1">
              {[
                { key: "monthly", label: "Monthly" },
                { key: "annual", label: "Annual — 2 months free" },
              ].map((option) => (
                <button
                  key={option.key}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    cycle === option.key ? "bg-amber-100 text-amber-700" : "text-gray-500 hover:bg-gray-50"
                  }`}
                  onClick={() => setCycle(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {PLANS.map((plan) => {
              const isCurrent = currentTier === plan.key;
              const price = cycle === "monthly" ? plan.monthly : plan.annual / 12;
              return (
                <div
                  key={plan.key}
                  className={`flex flex-col rounded-xl border p-4 ${
                    plan.key === "pro" ? "border-amber-400 ring-1 ring-amber-200" : "border-gray-200"
                  }`}
                >
                  <span className="text-sm font-semibold text-gray-900">{plan.name}</span>
                  <span className="mb-3 text-xs text-gray-400">{plan.tagline}</span>
                  <div className="mb-4">
                    <span className="text-2xl font-bold text-gray-900">${price.toFixed(2)}</span>
                    <span className="text-xs text-gray-400"> / month</span>
                    {cycle === "annual" && plan.monthly > 0 && (
                      <div className="text-xs text-gray-400">billed ${plan.annual.toFixed(2)}/year</div>
                    )}
                  </div>
                  <ul className="mb-4 flex-1 space-y-1.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <Check size={13} className="mt-0.5 shrink-0 text-amber-600" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {plan.key === "free" ? (
                    <button
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-400"
                      disabled
                    >
                      {isCurrent ? "Current plan" : "Free"}
                    </button>
                  ) : (
                    <button
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:pointer-events-none disabled:opacity-60"
                      onClick={() => handleChoose(plan.key)}
                      disabled={isCurrent || loadingPlan !== null}
                    >
                      {loadingPlan === plan.key && <Loader2 size={14} className="animate-spin" />}
                      {isCurrent ? "Current plan" : `Choose ${plan.name}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
