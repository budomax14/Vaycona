import React, { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

// Shared delete-confirmation modal — used by both the admin dashboard and
// (via App.jsx) the existing end-user "My templates" delete action, so
// there's exactly one place this warning is worded. `isBuiltIn` is only
// ever passed from the admin dashboard (the end-user "My templates" flow
// never offers built-ins for deletion in the first place) — it swaps in a
// stronger warning since a built-in delete removes it from every user's
// gallery, not just this browser's own copy.
export default function ConfirmDeleteTemplateDialog({ isOpen, templateName, isBuiltIn, onConfirm, onCancel }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (isOpen) confirmRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(event) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle size={19} />
          </div>
          <button className="rounded-lg p-1 text-gray-400 hover:bg-gray-100" onClick={onCancel} aria-label="Cancel">
            <X size={16} />
          </button>
        </div>
        <h2 id="confirm-delete-title" className="mt-3 text-sm font-semibold text-gray-900">
          Delete {templateName ? `"${templateName}"` : "this template"}?
        </h2>
        <p className="mt-1.5 text-sm text-gray-500">
          {isBuiltIn
            ? "This is a built-in starter template — deleting it removes it from every user's Designs panel, not just this browser. This action cannot be undone."
            : "Are you sure you want to permanently delete this template? This action cannot be undone."}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100" onClick={onCancel}>
            Cancel
          </button>
          <button
            ref={confirmRef}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            onClick={onConfirm}
          >
            Delete permanently
          </button>
        </div>
      </div>
    </div>
  );
}
