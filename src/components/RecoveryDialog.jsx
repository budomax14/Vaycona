import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Clock, FileWarning, X } from "lucide-react";

function formatTimestamp(ts) {
  if (!ts) return "Unknown time";
  const diff = Date.now() - ts;
  const date = new Date(ts);
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diff < 24 * 60 * 60 * 1000 && date.getDate() === new Date().getDate()) return `Today at ${time}`;
  return `${date.toLocaleDateString()} at ${time}`;
}

const REASON_LABELS = {
  "periodic-dirty": "unsaved work was backed up automatically",
  "save-failure": "the last normal save didn't succeed",
  "before-migration": "a project update was about to run",
  "before-replacement": "a project replacement was about to happen",
  "before-reset": "the project was about to be cleared",
  "before-repair": "the project was about to be repaired",
  "unload-preparation": "the editor closed before saving",
  "manual-safety": "a manual safety snapshot was created",
  "unclean-session": "the last editing session didn't close normally",
};

// Focused, accessible recovery prompt (Phase 7C) — modeled on
// ResizeModal.jsx's overlay/panel convention. Shown at startup only when a
// recovery snapshot appears to hold meaningful work the last normal save
// doesn't have (see App.jsx's startup comparison).
export default function RecoveryDialog({
  isOpen,
  recoverySummary,
  savedSummary,
  reason,
  onRecover,
  onOpenSaved,
  onDelete,
  onClose,
}) {
  const [showDetails, setShowDetails] = useState(false);
  const primaryRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (isOpen) primaryRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(event) {
      if (event.key === "Escape") {
        // Escape's well-defined safe result: keep today's saved version
        // open (the recovery snapshot stays available in Recovery Center).
        onOpenSaved();
        return;
      }
      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll("button");
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onOpenSaved]);

  if (!isOpen) return null;

  const reasonText = REASON_LABELS[reason] || "unsaved work was found";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="recovery-dialog-title"
        aria-describedby="recovery-dialog-desc"
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-gray-200 px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <AlertTriangle size={18} />
          </div>
          <div className="flex-1">
            <h2 id="recovery-dialog-title" className="text-base font-semibold text-gray-900">
              Unsaved work was found
            </h2>
            <p id="recovery-dialog-desc" className="mt-0.5 text-sm text-gray-500">
              It looks like {reasonText}. You can recover it or keep your last saved version.
            </p>
          </div>
          <button className="rounded-lg p-1 text-gray-400 hover:bg-gray-100" onClick={onOpenSaved} aria-label="Close and keep saved version">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm">
          <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
            <div>
              <div className="font-medium text-amber-900">Recoverable work</div>
              <div className="flex items-center gap-1 text-xs text-amber-600">
                <Clock size={12} /> {formatTimestamp(recoverySummary?.createdAt)}
              </div>
            </div>
            <div className="text-right text-xs text-amber-700">
              <div>{recoverySummary?.pageCount ?? "—"} pages</div>
              <div>{recoverySummary?.objectCount ?? "—"} objects</div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-gray-200 px-3.5 py-3">
            <div>
              <div className="font-medium text-gray-700">Last saved version</div>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Clock size={12} /> {savedSummary?.updatedAt ? formatTimestamp(savedSummary.updatedAt) : "Never saved"}
              </div>
            </div>
            <div className="text-right text-xs text-gray-500">
              <div>{savedSummary?.pageCount ?? "—"} pages</div>
              <div>{savedSummary?.objectCount ?? "—"} objects</div>
            </div>
          </div>

          {recoverySummary?.missingAssetCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <FileWarning size={14} />
              {recoverySummary.missingAssetCount} image{recoverySummary.missingAssetCount === 1 ? "" : "s"} referenced in this
              recovery could not be found and will show as missing.
            </div>
          )}

          <button
            type="button"
            className="text-xs font-medium text-amber-600 underline-offset-2 hover:underline"
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
          >
            {showDetails ? "Hide details" : "View recovery details"}
          </button>
          {showDetails && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
              <dt>Referenced assets</dt>
              <dd>{recoverySummary?.assetCount ?? 0}</dd>
              <dt>Base save revision</dt>
              <dd>{recoverySummary?.baseRevision ?? "—"}</dd>
              <dt>Reason</dt>
              <dd>{recoverySummary?.reason || "—"}</dd>
            </dl>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 px-5 py-4">
          <button
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100"
            onClick={onDelete}
          >
            Delete recovery
          </button>
          <button
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            onClick={onOpenSaved}
          >
            Open saved version
          </button>
          <button
            ref={primaryRef}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            onClick={onRecover}
          >
            Recover latest work
          </button>
        </div>
      </div>
    </div>
  );
}
