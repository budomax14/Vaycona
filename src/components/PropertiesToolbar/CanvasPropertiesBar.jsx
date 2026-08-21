import React from "react";
import { ColorField, IconToggleButton, NumberField, ToolbarDivider } from "./toolbarUi";
import OverflowToolbar from "../OverflowToolbar/OverflowToolbar";
import { Square } from "lucide-react";
import { BORDER_STYLE_OPTIONS } from "../../borderStyles";

// Shown when nothing is selected — the page/canvas's own properties.
// Border is additive, like page background before it (see App.jsx's
// updatePageBorder comment): pages saved before this feature existed just
// have no `border` key, which reads here as disabled, so nothing needs a
// migration step to keep loading correctly.
export default function CanvasPropertiesBar({ background, onBackgroundChange, border, onBorderChange }) {
  const pageBorder = border || {};

  return (
    <OverflowToolbar className="w-full" innerClassName="justify-start gap-3">
      <OverflowToolbar.Item keepOnMobile>
        <ColorField
          label="Background"
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
            title={pageBorder.enabled ? "Remove page border" : "Add page border"}
          />
          {pageBorder.enabled && (
            <>
              <ColorField
                label="Border color"
                value={pageBorder.color || "#111827"}
                onChange={(color) => onBorderChange({ color })}
              />
              <NumberField
                label="Width"
                value={pageBorder.width ?? 4}
                min={1}
                max={60}
                onChange={(width) => onBorderChange({ width })}
              />
              <select
                className="h-8 shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm text-gray-700 outline-none focus:border-amber-400 focus:bg-white"
                aria-label="Border style"
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
            Select an element to edit its properties, or shift-click / drag a selection box to select
            multiple.
          </span>
        </>
      </OverflowToolbar.Item>
    </OverflowToolbar>
  );
}
