import React, { useEffect } from "react";
import { Eraser, Paintbrush, Pipette } from "lucide-react";
import { ColorField, SliderField } from "../../PropertiesToolbar/toolbarUi";
import { useRecentColors } from "../../../recentColorsContext";
import { useLanguage } from "../../../languageContext";
import { PANEL_STRINGS } from "../../../i18n/panels";

// Draw/erase are a continuous canvas mode (unlike the other panels, which
// just stamp a fully-formed item onto the canvas) — App.jsx switches the
// Stage's own pointer handling into brush/eraser behavior for as long as
// this panel is open (activeSidebarSection === "brush"), so there's no
// per-item "Add" button here.
export default function BrushPanel({ color, onColorChange, size, onSizeChange, mode, onModeChange, onPickColor, isPicking }) {
  const { recordColor } = useRecentColors();
  const { language } = useLanguage();
  const t = PANEL_STRINGS[language].brush;

  // Covers both paths that can change the brush color: the ColorField
  // swatch/hex picker below (which already records on its own) and the
  // eyedropper pick, which lands here as a plain prop change from App.jsx
  // and has no other way to reach the shared recent-colors list.
  useEffect(() => {
    if (color) recordColor(color);
  }, [color, recordColor]);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-gray-800">{t.title}</h3>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
            mode !== "erase" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
          aria-pressed={mode !== "erase"}
          onClick={() => onModeChange("draw")}
        >
          <Paintbrush size={16} /> {t.draw}
        </button>
        <button
          type="button"
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
            mode === "erase" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
          aria-pressed={mode === "erase"}
          onClick={() => onModeChange("erase")}
        >
          <Eraser size={16} /> {t.erase}
        </button>
      </div>

      <div className="flex items-end gap-2">
        <ColorField label={t.color} value={color} onChange={onColorChange} />
        <button
          type="button"
          className={`flex h-8 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors ${
            isPicking ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"
          }`}
          title={t.pickColorFromCanvas}
          aria-label={t.pickColorFromCanvas}
          aria-pressed={!!isPicking}
          onClick={onPickColor}
        >
          <Pipette size={16} />
        </button>
      </div>
      {isPicking && (
        <p className="-mt-2 text-xs text-gray-500">{t.clickToPickColor}</p>
      )}

      <SliderField label={t.brushSize} value={size} min={1} max={60} onChange={onSizeChange} />

      <p className="text-xs text-gray-400">
        {mode === "erase" ? t.dragToErase : t.drawDirectly}
      </p>
    </div>
  );
}
