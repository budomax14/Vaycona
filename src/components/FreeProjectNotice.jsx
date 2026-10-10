import React from "react";
import { Crown } from "lucide-react";
import { useLanguage } from "../languageContext";
import { DIALOG_STRINGS } from "../i18n/dialogs";

// Free-plan allowance line shown in the export/print dialogs. `status` comes
// from App.jsx's freeProjectStatus: null for paid plans, otherwise
// { kind: "available" | "claimed" | "usedUp", used, limit }. `onUpgrade` is
// absent in the phone apps (no purchase prompts there), which also switches
// to copy that doesn't mention upgrading.
export default function FreeProjectNotice({ status, onUpgrade, className = "" }) {
  const { language } = useLanguage();
  const t = DIALOG_STRINGS[language].freeProjects;
  if (!status) return null;

  if (status.kind === "usedUp") {
    return (
      <div className={`flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ${className}`}>
        <span>{onUpgrade ? t.usedUp(status.limit) : t.usedUpApp(status.limit)}</span>
        {onUpgrade && (
          <button
            type="button"
            className="flex shrink-0 items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 font-semibold text-white hover:bg-amber-700"
            onClick={onUpgrade}
          >
            <Crown size={12} /> {t.upgrade}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 ${className}`}>
      {status.kind === "claimed" ? t.claimed(status.limit) : t.available(status.used + 1, status.limit)}
    </div>
  );
}
