import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, X } from "lucide-react";
import { useLanguage } from "../../languageContext";
import { MOBILE_STRINGS } from "../../i18n/mobile";

// Height of MobileBottomBar — sheets that sit "above the bar" are offset by
// this plus the device's bottom safe area (the app root's own padding does
// not apply to fixed-position elements).
export const MOBILE_BAR_OFFSET = "calc(3.5rem + var(--safe-bottom))";

// The phone layout's one container for every panel: content lives behind a
// button and opens as a bottom sheet instead of sitting on screen next to
// the canvas.
//   aboveBar: anchors just above the bottom bar (panels) instead of the
//             screen bottom (menus).
//   modal:    dims the canvas and closes on outside tap. Panels are
//             non-modal so the canvas stays usable above them (the brush
//             tool draws on it while its panel is open).
export default function MobileSheet({ isOpen, onClose, title, onBack, aboveBar = false, modal = true, children }) {
  const { language } = useLanguage();
  const t = MOBILE_STRINGS[language].sheet;

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <>
      {modal && <button className="fixed inset-0 z-40 bg-black/30" aria-label={t.close} onClick={onClose} />}
      <div
        role="dialog"
        aria-label={title}
        data-mobile-sheet
        className={`fixed inset-x-0 z-40 flex flex-col overflow-hidden rounded-t-2xl border-t border-gray-200 bg-white shadow-2xl ${
          aboveBar ? "max-h-[min(60vh,520px)] landscape:max-h-[70vh]" : "max-h-[85vh]"
        }`}
        style={{ bottom: aboveBar ? "calc(3.5rem + var(--safe-bottom))" : 0 }}
      >
        <div className="flex shrink-0 items-center gap-1 border-b border-gray-100 px-2 py-1.5">
          {onBack ? (
            <button className="toolbar-hit-target rounded-lg p-2 text-gray-500 hover:bg-gray-100" onClick={onBack} aria-label={t.back}>
              <ChevronLeft size={18} />
            </button>
          ) : (
            <span className="w-2" />
          )}
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">{title}</h2>
          <button className="toolbar-hit-target rounded-lg p-2 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label={t.close}>
            <X size={18} />
          </button>
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto p-4 ${aboveBar ? "" : "pb-[max(1rem,var(--safe-bottom))]"}`}>{children}</div>
      </div>
    </>,
    document.body
  );
}
