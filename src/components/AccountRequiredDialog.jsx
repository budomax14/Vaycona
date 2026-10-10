import React from "react";
import { ExternalLink, LogIn, UserPlus, X } from "lucide-react";
import { useLanguage } from "../languageContext";
import { DIALOG_STRINGS } from "../i18n/dialogs";

// Shown when a guest (no account) tries to save, export, print or share.
export default function AccountRequiredDialog({ isOpen, onClose, onSignUp, onLogIn }) {
  const { language } = useLanguage();
  const t = DIALOG_STRINGS[language].accountRequired;
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-required-title"
        className="w-full max-w-md rounded-t-2xl bg-white p-5 pb-[max(1.25rem,var(--safe-bottom))] shadow-2xl sm:rounded-2xl sm:pb-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <UserPlus size={18} />
            </span>
            <h2 id="account-required-title" className="text-base font-semibold text-gray-900">
              {t.title}
            </h2>
          </div>
          <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label={t.close}>
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-gray-600">{t.body}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
            onClick={onSignUp}
          >
            {t.signUp} <ExternalLink size={14} />
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={onLogIn}
          >
            <LogIn size={14} /> {t.logIn}
          </button>
          <button type="button" className="py-1.5 text-sm text-gray-500 hover:text-gray-700" onClick={onClose}>
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}
