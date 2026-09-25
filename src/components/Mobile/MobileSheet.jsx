import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, X } from "lucide-react";
import { useLanguage } from "../../languageContext";
import { MOBILE_STRINGS } from "../../i18n/mobile";
import { useLatchedWhileOpen, useSheetMotion } from "./useSheetMotion";

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

  const { mounted, sheetStyle, backdropStyle, dragHandlers } = useSheetMotion(isOpen, onClose);
  const shownTitle = useLatchedWhileOpen(isOpen, title);
  const shownChildren = useLatchedWhileOpen(isOpen, children);
  const shownOnBack = useLatchedWhileOpen(isOpen, onBack);

  if (!mounted) return null;

  return createPortal(
    <>
      {modal && (
        <button
          className="fixed inset-0 z-40 bg-black/30"
          style={{ ...backdropStyle, pointerEvents: isOpen ? "auto" : "none" }}
          aria-label={t.close}
          onClick={onClose}
        />
      )}
      {/* Clips the sheet at its resting edge (the bottom bar's top for
          aboveBar panels) so it slides in from behind the bar rather than
          over it. */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 overflow-hidden" style={{ bottom: aboveBar ? MOBILE_BAR_OFFSET : 0 }}>
        <div
          role="dialog"
          aria-label={shownTitle}
          data-mobile-sheet
          className={`absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-2xl border-t border-gray-200 bg-white shadow-2xl ${
            isOpen ? "pointer-events-auto" : ""
          } ${aboveBar ? "max-h-[min(60vh,520px)] landscape:max-h-[70vh]" : "max-h-[85vh]"}`}
          style={sheetStyle}
        >
          <div className="shrink-0 cursor-grab border-b border-gray-100" {...dragHandlers}>
            <div className="flex justify-center pt-2">
              <div className="h-1 w-9 rounded-full bg-gray-300" />
            </div>
            <div className="flex items-center gap-1 px-2 pb-1">
              {shownOnBack ? (
                <button className="toolbar-hit-target rounded-lg p-2 text-gray-500 active:bg-gray-100" onClick={shownOnBack} aria-label={t.back}>
                  <ChevronLeft size={18} />
                </button>
              ) : (
                <span className="w-2" />
              )}
              <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">{shownTitle}</h2>
              <button className="toolbar-hit-target rounded-lg p-2 text-gray-400 active:bg-gray-100" onClick={onClose} aria-label={t.close}>
                <X size={18} />
              </button>
            </div>
          </div>
          <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 ${aboveBar ? "" : "pb-[max(1rem,var(--safe-bottom))]"}`}>{shownChildren}</div>
        </div>
      </div>
    </>,
    document.body
  );
}
