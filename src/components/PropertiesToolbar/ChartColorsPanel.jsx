import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ColorField } from "./toolbarUi";
import { CHART_KINDS, getSliceColor } from "../../chartKinds";

// Quick, dedicated color access for a selected chart — same flyout shell
// as ChartSettingsPanel/TextColorPanel, but scoped to just colors so it's
// one click from the toolbar swatch button (mirrors how Shape has its own
// "Shape fill" swatch + panel separate from the rest of its properties).
export default function ChartColorsPanel({ isOpen, onClose, item, onChange }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }
    function handleOutside(event) {
      if (panelRef.current && panelRef.current.contains(event.target)) return;
      // ColorField's own picker (ToolbarPopover) portals to document.body
      // as a DOM sibling of this panel, not a descendant of panelRef — so
      // without this check, clicking a color swatch inside it reads as
      // "outside" and closes this panel out from under the picker before
      // the click even registers (same fix ToolbarPopover.jsx itself uses
      // for nested popovers).
      if (event.target.closest?.("[data-toolbar-popover]")) return;
      onClose();
    }
    window.addEventListener("keydown", handleKey);
    window.addEventListener("mousedown", handleOutside);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("mousedown", handleOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const kindDef = CHART_KINDS[item.chartKind] || CHART_KINDS.bar;
  const isPie = kindDef.family === "pie";

  function changeSeriesColor(index, color) {
    onChange({ series: item.series.map((s, i) => (i === index ? { ...s, color } : s)) });
  }

  function changeSliceColor(index, color) {
    const next = [...(item.sliceColors || [])];
    next[index] = color;
    onChange({ sliceColors: next });
  }

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Chart colors"
      className="fixed right-0 top-32 bottom-9 z-40 flex w-full max-w-[85vw] flex-col overflow-y-auto border-l border-gray-200 bg-white shadow-2xl sm:w-72 sm:max-w-none"
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">{isPie ? "Slice colors" : "Series colors"}</h2>
        <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 space-y-2 p-4">
        {!isPie &&
          (item.series || []).map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <ColorField label={s.name || s.key} value={s.color || "#8b5cf6"} onChange={(value) => changeSeriesColor(i, value)} />
            </div>
          ))}
        {isPie &&
          (item.data || []).map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <ColorField label={String(row.category ?? `Slice ${i + 1}`)} value={getSliceColor(item, i)} onChange={(value) => changeSliceColor(i, value)} />
            </div>
          ))}
        {((!isPie && !(item.series || []).length) || (isPie && !(item.data || []).length)) && (
          <p className="text-xs text-gray-400">Add data first (Edit Data) to set colors.</p>
        )}
      </div>
    </div>,
    document.body
  );
}
