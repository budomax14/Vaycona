import React, { useEffect, useRef, useState } from "react";
import { Crown, X } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase";
import { useLanguage } from "../../languageContext";
import { MISC_STRINGS } from "../../i18n/misc";

// Gives any existing account a plan without Stripe (functions/planGrants.js)
// — demo accounts for App Review, testers. Choosing "Free" takes it back.
export default function GrantPlanDialog({ isOpen, onClose, onGranted }) {
  const { language } = useLanguage();
  const t = MISC_STRINGS[language].grantPlan;
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState("pro");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data } = await httpsCallable(functions, "setUserPlan")({ email, tier });
      onGranted(t.granted(data.email, t.tiers[data.tier]));
      setEmail("");
      onClose();
    } catch (err) {
      setError(err?.message || t.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" role="presentation">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="grant-plan-title"
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
        onSubmit={handleSubmit}
      >
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Crown size={19} />
          </div>
          <button type="button" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label={t.cancel}>
            <X size={16} />
          </button>
        </div>
        <h2 id="grant-plan-title" className="mt-3 text-sm font-semibold text-gray-900">
          {t.title}
        </h2>
        <p className="mt-1.5 text-sm text-gray-500">{t.description}</p>
        <label className="mt-4 block text-xs font-medium text-gray-600">
          {t.emailLabel}
          <input
            ref={inputRef}
            type="email"
            required
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-gray-600">
          {t.planLabel}
          <select
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm"
            value={tier}
            onChange={(event) => setTier(event.target.value)}
          >
            {["pro", "business", "free"].map((key) => (
              <option key={key} value={key}>
                {t.tiers[key]}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100" onClick={onClose}>
            {t.cancel}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {busy ? t.saving : t.save}
          </button>
        </div>
      </form>
    </div>
  );
}
