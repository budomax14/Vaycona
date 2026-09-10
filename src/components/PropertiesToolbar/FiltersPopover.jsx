import React, { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { ColorField, GroupedSliderField, IconButton } from "./toolbarUi";
import ResponsiveSheet from "../ResponsiveSheet/ResponsiveSheet";
import { DEFAULT_ADJUSTMENTS, FILTER_PRESETS, normalizeAdjustments } from "../../imageEffects";
import { useLanguage } from "../../languageContext";
import { TOOLBAR_MENU_STRINGS } from "../../i18n/toolbarMenus";

// Cheap CSS-filter approximation used ONLY for the small preset preview
// swatches below (not the real render, which goes through the Konva
// filter pipeline in useImageFilters.js) — avoids any canvas/Konva work
// for 8 small thumbnails, per the "avoid blocking, don't regenerate full-
// resolution previews for every filter" requirement.
function adjustmentsToCssFilter(adjustments) {
  const a = normalizeAdjustments(adjustments);
  const brightness = 1 + a.brightness * 0.6;
  const contrast = 1 + a.contrast * 0.6;
  const saturate = 1 + a.saturation;
  const sepia = a.warmth > 0 ? a.warmth * 0.5 : 0;
  const hueRotate = a.warmth < 0 ? a.warmth * 30 : 0;
  const blur = a.blur * 0.5;
  return `brightness(${brightness}) contrast(${contrast}) saturate(${Math.max(0, saturate)}) sepia(${sepia}) hue-rotate(${hueRotate}deg) blur(${blur}px)`;
}

// Only the plain numeric sliders decide whether a preset's ring should
// light up — recolor (tint/duotone) is a separate, independent layer on
// top (see the "Recolor" section below), not part of any preset.
function adjustmentsRoughlyEqual(a, b) {
  const na = normalizeAdjustments(a);
  const nb = normalizeAdjustments(b);
  return SLIDER_FIELDS.every((field) => Math.abs(na[field.key] - nb[field.key]) < 0.01);
}

const SLIDER_FIELDS = [
  { key: "brightness", labelKey: "brightness", min: -1, max: 1 },
  { key: "contrast", labelKey: "contrast", min: -1, max: 1 },
  { key: "saturation", labelKey: "saturation", min: -1, max: 1 },
  { key: "warmth", labelKey: "warmth", min: -1, max: 1 },
  { key: "blur", labelKey: "blur", min: 0, max: 20, step: 0.5 },
];

// Shared between ImagePropertiesBar and FramePropertiesBar (the latter
// gated on the frame actually having content) — one popover, one set of
// slider/preset UI, so adjustment editing is never implemented twice.
export default function FiltersPopover({ adjustments, previewSrc, onChange, onLiveChange, onCommit }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const current = normalizeAdjustments(adjustments);
  const { language } = useLanguage();
  const t = TOOLBAR_MENU_STRINGS[language].filters;

  return (
    <div className="relative shrink-0">
      <div ref={anchorRef} className="inline-flex">
        <IconButton icon={Sparkles} label={t.filters} onClick={() => setOpen((v) => !v)} active={open} />
      </div>
      <ResponsiveSheet isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <div className="w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t.filters}</p>
          <div className="mb-4 grid grid-cols-4 gap-2">
            {FILTER_PRESETS.map((preset) => {
              const active = adjustmentsRoughlyEqual(current, preset.adjustments);
              return (
                <button
                  key={preset.key}
                  className={`flex flex-col items-center gap-1 rounded-lg p-1 ${active ? "ring-2 ring-amber-500" : ""}`}
                  onClick={() => onChange({ ...preset.adjustments })}
                  title={preset.label}
                >
                  {previewSrc ? (
                    <img
                      src={previewSrc}
                      alt=""
                      className="h-12 w-12 rounded-md object-cover"
                      style={{ filter: adjustmentsToCssFilter(preset.adjustments) }}
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-md bg-gray-100" />
                  )}
                  <span className="text-[10px] text-gray-500">{preset.label}</span>
                </button>
              );
            })}
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t.adjust}</p>
          <div className="flex flex-col gap-2">
            {SLIDER_FIELDS.map((field) => (
              <div key={field.key} className="flex items-center justify-between gap-2">
                <GroupedSliderField
                  label={t[field.labelKey]}
                  value={current[field.key]}
                  min={field.min}
                  max={field.max}
                  step={field.step ?? 0.05}
                  width="100%"
                  onLiveChange={(value) => onLiveChange({ ...current, [field.key]: value })}
                  onCommit={onCommit}
                />
                <button
                  className="mt-3 shrink-0 text-[10px] text-gray-400 hover:text-gray-600"
                  onClick={() => onChange({ ...current, [field.key]: DEFAULT_ADJUSTMENTS[field.key] })}
                >
                  {t.reset}
                </button>
              </div>
            ))}
          </div>

          <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">{t.recolor}</p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <ColorField
                label={t.tint}
                value={current.tintColor || "#8b5cf6"}
                onChange={(hex) => onChange({ ...current, tintColor: hex })}
              />
              {current.tintColor && (
                <button
                  className="text-[10px] text-gray-400 hover:text-gray-600"
                  onClick={() => onChange({ ...current, tintColor: null })}
                >
                  {t.clear}
                </button>
              )}
            </div>
            {current.tintColor && (
              <GroupedSliderField
                label={t.intensity}
                value={current.tintAmount}
                min={0}
                max={1}
                step={0.05}
                width="100%"
                onLiveChange={(value) => onLiveChange({ ...current, tintAmount: value })}
                onCommit={onCommit}
              />
            )}

            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ColorField
                  label={t.shadows}
                  value={current.duotoneShadow || "#1e1b4b"}
                  onChange={(hex) => onChange({ ...current, duotoneShadow: hex, duotoneHighlight: current.duotoneHighlight || "#facc15" })}
                />
                <ColorField
                  label={t.highlights}
                  value={current.duotoneHighlight || "#facc15"}
                  onChange={(hex) => onChange({ ...current, duotoneHighlight: hex, duotoneShadow: current.duotoneShadow || "#1e1b4b" })}
                />
              </div>
              {(current.duotoneShadow || current.duotoneHighlight) && (
                <button
                  className="text-[10px] text-gray-400 hover:text-gray-600"
                  onClick={() => onChange({ ...current, duotoneShadow: null, duotoneHighlight: null })}
                >
                  {t.clear}
                </button>
              )}
            </div>
          </div>

          <button
            className="col-span-2 mt-3 w-full rounded-lg border border-gray-200 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50"
            onClick={() => onChange({ ...DEFAULT_ADJUSTMENTS })}
          >
            {t.resetAll}
          </button>
        </div>
      </ResponsiveSheet>
    </div>
  );
}
