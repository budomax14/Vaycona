import React, { useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ColorField, NumberField, LabeledField } from "./toolbarUi";
import { BORDER_STYLE_OPTIONS } from "../../borderStyles";

const BORDER_PRESETS = [
  { label: "All", show: { top: true, bottom: true, left: true, right: true, insideH: true, insideV: true } },
  { label: "Outer", show: { top: true, bottom: true, left: true, right: true, insideH: false, insideV: false } },
  { label: "Inner", show: { top: false, bottom: false, left: false, right: false, insideH: true, insideV: true } },
  { label: "Horizontal", show: { top: true, bottom: true, left: false, right: false, insideH: true, insideV: false } },
  { label: "Vertical", show: { top: false, bottom: false, left: true, right: true, insideH: false, insideV: true } },
  { label: "None", show: { top: false, bottom: false, left: false, right: false, insideH: false, insideV: false } },
];

// Right-side flyout panel for whole-table styling — mirrors
// ChartSettingsPanel.jsx's shell shape (portal, fixed right rail,
// outside-click/Escape close, [data-toolbar-popover] exclusion so nested
// ColorField popovers don't get misread as "outside").
export default function TableStylePanel({ isOpen, onClose, item, onChange }) {
  const panelRef = useRef(null);

  React.useEffect(() => {
    if (!isOpen) return undefined;
    function handlePointerDown(event) {
      if (panelRef.current?.contains(event.target)) return;
      if (event.target.closest?.("[data-toolbar-popover]")) return;
      onClose();
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const styles = item.styles || {};
  const border = styles.border || {};
  const show = border.show || {};

  function patchStyles(changes) {
    onChange({ styles: { ...styles, ...changes } });
  }
  function patchBorder(changes) {
    patchStyles({ border: { ...border, ...changes } });
  }

  return createPortal(
    <div
      data-toolbar-popover
      ref={panelRef}
      className="fixed right-0 top-32 bottom-9 z-40 w-80 overflow-y-auto border-l border-gray-200 bg-white p-4 shadow-xl"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Table Style</h3>
        <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-4">
        <LabeledField label="Cell fill">
          <ColorField
            value={styles.cellDefault?.fill || "#ffffff"}
            onChange={(color) => patchStyles({ cellDefault: { ...styles.cellDefault, fill: color } })}
          />
        </LabeledField>

        <div>
          <div className="mb-1.5 text-xs font-medium text-gray-500">Borders</div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {BORDER_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                onClick={() => patchBorder({ show: preset.show })}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ColorField value={border.color || "#d1d5db"} onChange={(color) => patchBorder({ color })} />
            <NumberField label="Width" value={border.width ?? 1} min={0} max={20} onChange={(width) => patchBorder({ width })} />
          </div>
          <div className="mt-2 flex gap-1.5">
            {BORDER_STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`rounded-md border px-2 py-1 text-xs ${
                  (border.style || "solid") === opt.value ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600"
                }`}
                onClick={() => patchBorder({ style: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <NumberField label="Padding" value={styles.padding ?? 8} min={0} max={40} onChange={(padding) => patchStyles({ padding })} />
        <NumberField
          label="Corner radius"
          value={styles.cornerRadius ?? 0}
          min={0}
          max={48}
          onChange={(cornerRadius) => patchStyles({ cornerRadius })}
        />

        <div>
          <label className="flex items-center justify-between text-xs font-medium text-gray-500">
            Header row
            <input
              type="checkbox"
              checked={(item.headerRowCount || 0) > 0}
              onChange={(event) => onChange({ headerRowCount: event.target.checked ? 1 : 0 })}
            />
          </label>
        </div>

        <div>
          <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-gray-500">
            Alternating rows
            <input
              type="checkbox"
              checked={!!item.alternatingRows?.enabled}
              onChange={(event) =>
                onChange({ alternatingRows: { ...item.alternatingRows, enabled: event.target.checked } })
              }
            />
          </label>
          {item.alternatingRows?.enabled && (
            <div className="flex items-center gap-2">
              <ColorField
                value={item.alternatingRows.color1 || "#ffffff"}
                onChange={(color1) => onChange({ alternatingRows: { ...item.alternatingRows, color1 } })}
              />
              <ColorField
                value={item.alternatingRows.color2 || "#f3f4f6"}
                onChange={(color2) => onChange({ alternatingRows: { ...item.alternatingRows, color2 } })}
              />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
