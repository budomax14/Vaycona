import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

// Shared modal shell for every Phase 11 brand dialog — same backdrop/
// Escape-to-close/focus-on-open contract as SaveAsTemplateDialog.jsx etc,
// factored out once several brand dialogs needed it (manager, create,
// replace colors, replace fonts, audit, theme apply).
export default function BrandModal({ isOpen, onClose, title, subtitle, width = "max-w-lg", children, footer }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="brand-modal-title"
        className={`flex max-h-[85vh] w-full ${width} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h2 id="brand-modal-title" className="text-sm font-semibold text-gray-900">
              {title}
            </h2>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
          <button ref={closeRef} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer && <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}
