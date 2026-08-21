import React from "react";
import { Check, Crop, Maximize2, Minimize2, RotateCcw, StretchHorizontal, X } from "lucide-react";
import { GroupedSliderField, IconButton, IconToggleButton, ToolbarDivider } from "./toolbarUi";
import OverflowToolbar from "../OverflowToolbar/OverflowToolbar";
import { normalizeCrop } from "../../imageCrop";

// The specific ratio buttons requested for the crop toolbar — a curated
// subset of imageCrop.js's full ASPECT_PRESETS list (which stays as-is;
// nothing else reads this local one), labeled to match exactly.
const CROP_TOOLBAR_ASPECTS = [
  { key: "free", label: "Free Crop", ratio: null },
  { key: "square", label: "Square (1:1)", ratio: 1 },
  { key: "portrait", label: "Portrait (4:5)", ratio: 4 / 5 },
  { key: "landscape", label: "Landscape (16:9)", ratio: 16 / 9 },
  { key: "original", label: "Original Ratio", ratio: "original" },
];

// Shown in place of the normal per-type properties bar while cropping
// (App.jsx short-circuits PropertiesToolbar to this component when
// croppingItemId is set) — Done/Cancel/Reset/fit-mode/aspect-presets/zoom,
// mirroring how the toolbar already special-cases inline text editing.
export default function CropModePropertiesBar({
  item,
  naturalWidth,
  naturalHeight,
  onCropCommit,
  onZoomLiveChange,
  onZoomCommit,
  onSetAspect,
  onApply,
  onCancel,
  onReset,
}) {
  const crop = normalizeCrop(item.crop);

  return (
    <OverflowToolbar className="w-full" innerClassName="justify-start gap-3">
      <OverflowToolbar.Item keepOnMobile>
        <span data-crop-toolbar-safe className="shrink-0 rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">
          <Crop size={14} className="mr-1.5 inline" /> Cropping
        </span>
      </OverflowToolbar.Item>

      <OverflowToolbar.Item>
        <>
          <ToolbarDivider />
          <div data-crop-toolbar-safe className="flex shrink-0 items-center gap-1">
            <IconToggleButton icon={StretchHorizontal} active={crop.fit === "stretch"} onClick={() => onCropCommit({ ...crop, fit: "stretch" })} title="Stretch — show the whole image, may distort" />
            <IconToggleButton icon={Maximize2} active={crop.fit === "fill"} onClick={() => onCropCommit({ ...crop, fit: "fill" })} title="Fill — cover the whole box, crop excess" />
            <IconToggleButton icon={Minimize2} active={crop.fit === "fit"} onClick={() => onCropCommit({ ...crop, fit: "fit" })} title="Fit — show the whole image, may letterbox" />
          </div>
        </>
      </OverflowToolbar.Item>

      <OverflowToolbar.Item>
        <>
          <ToolbarDivider />
          <div data-crop-toolbar-safe className="flex shrink-0 items-center gap-1 overflow-x-auto">
            {CROP_TOOLBAR_ASPECTS.map((preset) => (
              <button
                key={preset.key}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-amber-50 hover:text-amber-700"
                onClick={() => onSetAspect(preset.ratio === "original" ? naturalWidth / Math.max(1, naturalHeight) : preset.ratio)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </>
      </OverflowToolbar.Item>

      <OverflowToolbar.Item>
        <>
          <ToolbarDivider />
          <div data-crop-toolbar-safe>
            <GroupedSliderField
              label="Zoom"
              value={crop.zoom}
              min={1}
              max={8}
              step={0.05}
              onLiveChange={onZoomLiveChange}
              onCommit={onZoomCommit}
            />
          </div>

          <IconButton icon={RotateCcw} label="Reset" title="Reset crop to the original, uncropped image" onClick={onReset} />
        </>
      </OverflowToolbar.Item>

      <OverflowToolbar.Item keepOnMobile>
        <>
          <ToolbarDivider />
          <IconButton icon={X} label="Cancel" onClick={onCancel} />
          <IconButton icon={Check} label="Done" onClick={onApply} title="Apply crop (Enter)" active />
        </>
      </OverflowToolbar.Item>
    </OverflowToolbar>
  );
}
