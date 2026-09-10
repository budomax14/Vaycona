import React from "react";
import { TEXT_PRESETS } from "../../../textStyles";
import { useLanguage } from "../../../languageContext";
import { PANEL_STRINGS } from "../../../i18n/panels";

// Presets are starting styles, not locked templates — every property is
// editable on the object after insertion via the properties toolbar.
export default function TextPanel({ onAddPreset }) {
  const { language } = useLanguage();
  const t = PANEL_STRINGS[language].text;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-800">{t.title}</h3>

      {TEXT_PRESETS.map((preset) => (
        <button
          key={preset.key}
          className="rounded-xl border border-gray-200 px-4 py-3 text-left transition-colors hover:border-amber-400 hover:bg-amber-50"
          onClick={() => onAddPreset(preset.key)}
        >
          <span
            className="block truncate text-gray-800"
            style={{
              fontSize: Math.min(22, preset.fontSize),
              fontWeight: preset.fontWeight === "bold" ? 700 : 400,
              fontStyle: preset.italic ? "italic" : "normal",
              textTransform: preset.textTransform === "uppercase" ? "uppercase" : "none",
            }}
          >
            {t.presets[preset.key]?.label ?? preset.label}
          </span>
          <span className="block text-xs text-gray-400">{t.presets[preset.key]?.text ?? preset.text}</span>
        </button>
      ))}
    </div>
  );
}
