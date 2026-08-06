import React, { useEffect, useRef } from "react";
import { CheckCircle2, Clock, Save, ShieldAlert, Trash2, X } from "lucide-react";

const REASON_LABELS = {
  "periodic-dirty": "Automatic backup",
  "save-failure": "Save failure backup",
  "before-migration": "Before update",
  "before-replacement": "Before replacement",
  "before-reset": "Before reset",
  "before-repair": "Before repair",
  "unload-preparation": "Before closing",
  "manual-safety": "Manual safety snapshot",
};

function formatTimestamp(ts) {
  if (!ts) return "Unknown time";
  const date = new Date(ts);
  return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

// Emergency recovery snapshots only — explicitly NOT the Phase 7E version
// history (spec §19). Reachable from the File menu's "Project recovery"
// item.
export default function RecoveryCenter({
  isOpen,
  onClose,
  saveStatus,
  lastSavedAt,
  snapshots,
  onRestore,
  onDelete,
  onDeleteAllUnprotected,
  onCreateManualSnapshot,
}) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
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

  const hasUnprotected = snapshots.some((s) => !s.protected);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-center-title"
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 id="recovery-center-title" className="text-base font-semibold text-gray-900">
            Project recovery
          </h2>
          <button ref={closeRef} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label="Close project recovery">
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-gray-100 px-5 py-3">
          <div className="flex items-center gap-2 text-sm">
            {saveStatus === "saved" ? (
              <CheckCircle2 size={16} className="text-emerald-500" />
            ) : (
              <ShieldAlert size={16} className="text-amber-500" />
            )}
            <span className="font-medium text-gray-700">
              {saveStatus === "saved" ? "Project is safely saved" : "Project has unsaved changes"}
            </span>
          </div>
          {lastSavedAt && <div className="mt-0.5 pl-6 text-xs text-gray-400">Last saved {formatTimestamp(lastSavedAt)}</div>}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {snapshots.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No recovery snapshots yet.</p>
          ) : (
            <ul className="space-y-2">
              {snapshots.map((snapshot) => (
                <li
                  key={snapshot.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200 px-3.5 py-2.5"
                >
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                      {REASON_LABELS[snapshot.reason] || "Recovery snapshot"}
                      {snapshot.protected && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                          Protected
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={11} /> {formatTimestamp(snapshot.createdAt)} · {snapshot.pageCount} pages ·{" "}
                      {snapshot.objectCount} objects
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-50"
                      onClick={() => onRestore(snapshot.id)}
                    >
                      Restore
                    </button>
                    <button
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      onClick={() => onDelete(snapshot.id)}
                      aria-label="Delete this recovery snapshot"
                      title="Delete this recovery snapshot"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap justify-between gap-2 border-t border-gray-200 px-5 py-4">
          <button
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            onClick={onCreateManualSnapshot}
          >
            <Save size={14} /> Create safety snapshot
          </button>
          <button
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-40"
            onClick={onDeleteAllUnprotected}
            disabled={!hasUnprotected}
          >
            Delete all unprotected
          </button>
        </div>
      </div>
    </div>
  );
}
