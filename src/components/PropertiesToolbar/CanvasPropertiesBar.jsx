import React from "react";
import { ColorField, IconToggleButton, NumberField, ToolbarDivider } from "./toolbarUi";
import OverflowToolbar from "../OverflowToolbar/OverflowToolbar";
import { Square } from "lucide-react";
import { BORDER_STYLE_OPTIONS } from "../../borderStyles";
import { useLanguage } from "../../languageContext";
import { OBJECT_PROPERTIES_STRINGS } from "../../i18n/objectProperties";

// Shown when nothing is selected — the page/canvas's own properties.
// Border is additive, like page background before it (see App.jsx's
// updatePageBorder comment): pages saved before this feature existed just
// have no `border` key, which reads here as disabled, so nothing needs a
// migration step to keep loading correctly.
export default function CanvasPropertiesBar({ background, onBackgroundChange, border, onBorderChange }) {
  const { language } = useLanguage();
  const t = OBJECT_PROPERTIES_STRINGS[language].canvas;
  const pageBorder = border || {};

  return (
    <OverflowToolbar className="w-full" innerClassName="justify-start gap-3">
      <OverflowToolbar.Item keepOnMobile>
        <ColorField
          label={t.background}
          value={background}
          onChange={onBackgroundChange}
          onReset={() => onBackgroundChange("#ffffff")}
        />
      </OverflowToolbar.Item>

      <OverflowToolbar.Item>
        <>
          <ToolbarDivider />
          <IconToggleButton
            icon={Square}
            active={!!pageBorder.enabled}
            onClick={() => onBorderChange({ enabled: !pageBorder.enabled })}
            title={pageBorder.enabled ? t.removePageBorder : t.addPageBorder}
          />
          {pageBorder.enabled && (
            <>
              <ColorField
                label={t.borderColor}
                value={pageBorder.color || "#111827"}
                onChange={(color) => onBorderChange({ color })}
              />
              <NumberField
                label={t.width}
                value={pageBorder.width ?? 4}
                min={1}
                max={60}
                onChange={(width) => onBorderChange({ width })}
              />
              <select
                className="h-8 shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm text-gray-700 outline-none focus:border-amber-400 focus:bg-white"
                aria-label={t.borderStyle}
                value={pageBorder.style || "solid"}
                onChange={(event) => onBorderChange({ style: event.target.value })}
              >
                {BORDER_STYLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </>
          )}
        </>
      </OverflowToolbar.Item>

      <OverflowToolbar.Item>
        <>
          <ToolbarDivider />
          <span className="shrink-0 text-sm text-gray-400">
            {t.selectHint}
          </span>
        </>
      </OverflowToolbar.Item>
    </OverflowToolbar>
  );
}
