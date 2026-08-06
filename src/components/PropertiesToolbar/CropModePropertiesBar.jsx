import React from "react";
import { Check, Crop, Maximize2, Minimize2, RotateCcw, StretchHorizontal, X } from "lucide-react";
import { GroupedSliderField, IconButton, IconToggleButton, ToolbarDivider } from "./toolbarUi";
import { ASPECT_PRESETS, normalizeCrop } from "../../imageCrop";

// Shown in place of the normal per-type properties bar while cropping
// (App.jsx short-circuits PropertiesToolbar to this component when
// croppingItemId is set) — Apply/Cancel/fit-mode/aspect-presets/zoom/reset,
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
}) {
  const crop = normalizeCrop(item.crop);

  return (
    <>
      <span data-crop-toolbar-safe className="shrink-0 rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">
        <Crop size={14} className="mr-1.5 inline" /> Cropping
      </span>

      <ToolbarDivider />

      <div data-crop-toolbar-safe className="flex shrink-0 items-center gap-1">
        <IconToggleButton icon={StretchHorizontal} active={crop.fit === "stretch"} onClick={() => onCropCommit({ ...crop, fit: "stretch" })} title="Stretch — show the whole image, may distort" />
        <IconToggleButton icon={Maximize2} active={crop.fit === "fill"} onClick={() => onCropCommit({ ...crop, fit: "fill" })} title="Fill — cover the whole box, crop excess" />
        <IconToggleButton icon={Minimize2} active={crop.fit === "fit"} onClick={() => onCropCommit({ ...crop, fit: "fit" })} title="Fit — show the whole image, may letterbox" />
      </div>

      <ToolbarDivider />

      <div data-crop-toolbar-safe className="flex shrink-0 items-center gap-1 overflow-x-auto">
        {ASPECT_PRESETS.map((preset) => (
          <button
            key={preset.key}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
            onClick={() => onSetAspect(preset.ratio === "original" ? naturalWidth / Math.max(1, naturalHeight) : preset.ratio)}
          >
            {preset.label}
          </button>
        ))}
      </div>

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

      <IconButton
        icon={RotateCcw}
        label="Center"
        title="Center image"
        onClick={() => onCropCommit({ ...crop, focalX: 0.5, focalY: 0.5, zoom: 1 })}
      />

      <ToolbarDivider />

      <IconButton icon={X} label="Cancel" onClick={onCancel} />
      <IconButton icon={Check} label="Apply" onClick={onApply} />
    </>
  );
}
