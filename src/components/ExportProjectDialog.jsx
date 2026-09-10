import React, { useEffect, useRef } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { useLanguage } from "../languageContext";
import { DIALOG_STRINGS } from "../i18n/dialogs";

// Stage-based (not fake-percentage) export progress — spec §11. Reuses
// the ResizeModal/RecoveryDialog overlay convention.
export default function ExportProjectDialog({ isOpen, stage, error, onClose }) {
  const { language } = useLanguage();
  const t = DIALOG_STRINGS[language].exportProject;
  const STAGE_LABELS = {
    preparing: t.stagePreparing,
    validating: t.stageValidating,
    "collecting-assets": t.stageCollectingAssets,
    packaging: t.stagePackaging,
    finalizing: t.stageFinalizing,
    done: t.stageDone,
    error: t.stageError,
  };
  const closeRef = useRef(null);

  useEffect(() => {
    if (isOpen && (stage === "done" || stage === "error")) closeRef.current?.focus();
  }, [isOpen, stage]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(event) {
      if (event.key === "Escape" && (stage === "done" || stage === "error")) onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, stage, onClose]);

  if (!isOpen) return null;
  const finished = stage === "done" || stage === "error";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="export-dialog-title" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 id="export-dialog-title" className="text-base font-semibold text-gray-900">
            {t.title}
          </h2>
          {finished && (
            <button ref={closeRef} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label={t.closeAria}>
              <X size={16} />
            </button>
          )}
        </div>

        <div className="mt-5 flex items-center gap-3" aria-live="polite">
          {stage === "error" ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600">
              <X size={16} />
            </div>
          ) : stage === "done" ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={18} />
            </div>
          ) : (
            <Loader2 size={20} className="animate-spin text-amber-600" />
          )}
          <span className="text-sm font-medium text-gray-700">{error || STAGE_LABELS[stage] || t.workingFallback}</span>
        </div>

        {finished && (
          <button
            className="mt-5 w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            onClick={onClose}
          >
            {t.done}
          </button>
        )}
      </div>
    </div>
  );
}
