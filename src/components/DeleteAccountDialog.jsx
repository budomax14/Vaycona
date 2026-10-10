import React, { useEffect, useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import { useAuth } from "../authContext";
import { useLanguage } from "../languageContext";
import { DIALOG_STRINGS } from "../i18n/dialogs";

// In-app account deletion (App Store / Google Play requirement). Typing the
// confirm word guards against an accidental tap; the actual deletion runs
// server-side (functions/accountDeletion.js) and signs the user out.
export default function DeleteAccountDialog({ isOpen, onClose }) {
  const { deleteAccount } = useAuth();
  const { language } = useLanguage();
  const t = DIALOG_STRINGS[language].deleteAccount;
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setTyped("");
    setBusy(false);
    setError(null);
  }, [isOpen]);

  if (!isOpen) return null;
  const confirmed = typed.trim().toUpperCase() === t.confirmWord;

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
    } catch (err) {
      console.error("Account deletion failed:", err?.code, err);
      setError(err?.message && err.code !== "internal" ? err.message : t.failed);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" role="presentation" onClick={busy ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        className="w-full max-w-md rounded-t-2xl bg-white p-5 pb-[max(1.25rem,var(--safe-bottom))] shadow-2xl sm:rounded-2xl sm:pb-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <Trash2 size={18} />
            </span>
            <h2 id="delete-account-title" className="text-base font-semibold text-gray-900">
              {t.title}
            </h2>
          </div>
          <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} disabled={busy} aria-label={t.cancel}>
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-gray-600">{t.body}</p>
        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-medium text-gray-500">{t.confirmLabel}</span>
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            disabled={busy}
            autoCapitalize="characters"
            autoComplete="off"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 focus:border-red-500 focus:outline-none"
          />
        </label>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:pointer-events-none disabled:opacity-40"
            disabled={!confirmed || busy}
            onClick={handleDelete}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            {busy ? t.deleting : t.delete}
          </button>
          <button
            type="button"
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={busy}
            onClick={onClose}
          >
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
