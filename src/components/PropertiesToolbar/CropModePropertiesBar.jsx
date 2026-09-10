import React from "react";
import { Check, Crop, Maximize2, Minimize2, RotateCcw, StretchHorizontal, X } from "lucide-react";
import { GroupedSliderField, IconButton, ToolbarDivider, IconToggleButton } from "./toolbarUi";
import OverflowToolbar from "../OverflowToolbar/OverflowToolbar";
import { normalizeFocalCrop } from "../../imageCrop";
import { useLanguage } from "../../languageContext";
import { OBJECT_PROPERTIES_STRINGS } from "../../i18n/objectProperties";

// The specific ratio buttons requested for the crop toolbar — a curated
// subset of imageCrop.js's full ASPECT_PRESETS list (which stays as-is;
// nothing else reads this local one), labeled to match exactly. Ordered to
// match the Photos app's aspect-ratio picker: Original first. "4:5" and
// "16:9" are ratio notation, not language text, so they aren't translated.
const CROP_TOOLBAR_ASPECTS = [
  { key: "original", labelKey: "aspectOriginal", ratio: "original" },
  { key: "square", labelKey: "aspectSquare", ratio: 1 },
  { key: "portrait", label: "4:5", ratio: 4 / 5 },
  { key: "landscape", label: "16:9", ratio: 16 / 9 },
];

// Small shape glyph shown above each aspect-ratio label — a rectangle
// scaled to that ratio, the same visual language the Photos app's crop
// aspect picker uses so each option reads at a glance.
function AspectIcon({ ratio, naturalWidth, naturalHeight }) {
  const r = ratio === "original" ? (naturalWidth && naturalHeight ? naturalWidth / naturalHeight : 1) : ratio;
  const maxDim = 14;
  let w = maxDim;
  let h = maxDim;
  if (r >= 1) h = maxDim / r;
  else w = maxDim * r;
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x={(18 - w) / 2} y={(18 - h) / 2} width={w} height={h} rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

// Shown in place of the normal per-type properties bar while cropping
// (App.jsx short-circuits PropertiesToolbar to this component when
// croppingItemId is set) — Done/Cancel/Reset/aspect-presets, mirroring how
// the toolbar already special-cases inline text editing.
//
// Two different tools share this bar (see imageCrop.js's file header): a
// standalone image's Apple-style rect crop is fully driven by dragging
// CropOverlay's own handles, so this bar only needs aspect presets + Reset
// + Done/Cancel; a frame's content keeps the original fit-mode toggle +
// zoom slider (its fixed-shape content window has no rect handles to
// drag).
export default function CropModePropertiesBar({ item, naturalWidth, naturalHeight, onCropCommit, onZoomLiveChange, onZoomCommit, onSetAspect, onApply, onCancel, onReset }) {
  const { language } = useLanguage();
  const t = OBJECT_PROPERTIES_STRINGS[language].cropMode;
  const isFrame = item.type === "frame";
  const focalCrop = isFrame ? normalizeFocalCrop(item.crop) : null;

  return (
    <OverflowToolbar className="w-full" innerClassName="justify-start gap-3">
      <OverflowToolbar.Item keepOnMobile>
        <span data-crop-toolbar-safe className="shrink-0 rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">
          <Crop size={14} className="mr-1.5 inline" /> {t.cropping}
        </span>
      </OverflowToolbar.Item>

      {isFrame && (
        <OverflowToolbar.Item>
          <>
            <ToolbarDivider />
            <div data-crop-toolbar-safe className="flex shrink-0 items-center gap-1">
              <IconToggleButton
                icon={StretchHorizontal}
                active={focalCrop.fit === "stretch"}
                onClick={() => onCropCommit({ ...focalCrop, fit: "stretch" })}
                title={t.stretchTitle}
              />
              <IconToggleButton icon={Maximize2} active={focalCrop.fit === "fill"} onClick={() => onCropCommit({ ...focalCrop, fit: "fill" })} title={t.fillTitle} />
              <IconToggleButton icon={Minimize2} active={focalCrop.fit === "fit"} onClick={() => onCropCommit({ ...focalCrop, fit: "fit" })} title={t.fitTitle} />
            </div>
          </>
        </OverflowToolbar.Item>
      )}

      <OverflowToolbar.Item>
        <>
          <ToolbarDivider />
          <div data-crop-toolbar-safe className="flex shrink-0 items-center gap-1 overflow-x-auto">
            {CROP_TOOLBAR_ASPECTS.map((preset) => {
              const label = preset.labelKey ? t[preset.labelKey] : preset.label;
              return (
                <button
                  key={preset.key}
                  className="flex shrink-0 flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-amber-50 hover:text-amber-700"
                  title={label}
                  onClick={() => onSetAspect(preset.ratio === "original" ? naturalWidth / Math.max(1, naturalHeight) : preset.ratio)}
                >
                  <AspectIcon ratio={preset.ratio} naturalWidth={naturalWidth} naturalHeight={naturalHeight} />
                  {label}
                </button>
              );
            })}
          </div>
        </>
      </OverflowToolbar.Item>

      {isFrame && (
        <OverflowToolbar.Item>
          <>
            <ToolbarDivider />
            <div data-crop-toolbar-safe>
              <GroupedSliderField label={t.zoom} value={focalCrop.zoom} min={1} max={8} step={0.05} onLiveChange={onZoomLiveChange} onCommit={onZoomCommit} />
            </div>
          </>
        </OverflowToolbar.Item>
      )}

      <OverflowToolbar.Item>
        <IconButton icon={RotateCcw} label={t.reset} title={t.resetTitle} onClick={onReset} />
      </OverflowToolbar.Item>

      <OverflowToolbar.Item keepOnMobile>
        <>
          <ToolbarDivider />
          <IconButton icon={X} label={t.cancel} onClick={onCancel} />
          <IconButton icon={Check} label={t.done} onClick={onApply} title={t.doneTitle} active />
        </>
      </OverflowToolbar.Item>
    </OverflowToolbar>
  );
}
