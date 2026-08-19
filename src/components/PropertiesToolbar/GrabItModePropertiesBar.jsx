import React, { useState } from "react";
import { Check, ChevronDown, ChevronUp, Grab, RotateCcw } from "lucide-react";
import { IconButton, SliderField, ToolbarDivider } from "./toolbarUi";

// Shown in place of the normal per-type properties bar while Grab It is
// active (App.jsx short-circuits PropertiesToolbar to this component when
// grabItEditItemId matches the single selected item) — mirrors
// CropModePropertiesBar's "replace the whole row" shape. Keeps the default
// surface simple (status + Fine Tune disclosure + Done); advanced controls
// stay tucked behind Fine Tune per spec.
export default function GrabItModePropertiesBar({
  regionCount,
  isDetecting,
  error,
  sensitivity,
  onSensitivityChange,
  mergeAmount,
  onMergeAmountChange,
  showAllRegions,
  onToggleShowAllRegions,
  onResetDetection,
  onDone,
}) {
  const [fineTuneOpen, setFineTuneOpen] = useState(false);

  return (
    <>
      <span data-grab-it-toolbar-safe className="flex shrink-0 items-center rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">
        <Grab size={14} className="mr-1.5" /> Grab It
      </span>

      <ToolbarDivider />

      <span data-grab-it-toolbar-safe className="shrink-0 text-sm text-gray-600">
        {isDetecting ? "Analyzing image…" : error || `Detected: ${regionCount} design${regionCount === 1 ? "" : "s"}`}
      </span>

      <ToolbarDivider />

      <button
        type="button"
        data-grab-it-toolbar-safe
        className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
        onClick={() => setFineTuneOpen((v) => !v)}
      >
        Fine Tune {fineTuneOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {fineTuneOpen && (
        <div data-grab-it-toolbar-safe className="flex shrink-0 items-center gap-3">
          <SliderField label="Sensitivity" value={sensitivity} min={0} max={1} step={0.05} onChange={onSensitivityChange} />
          <SliderField label="Merge nearby" value={mergeAmount} min={0} max={1} step={0.05} onChange={onMergeAmountChange} />
          <label className="flex shrink-0 items-center gap-1.5 text-xs text-gray-600">
            <input type="checkbox" className="accent-amber-600" checked={showAllRegions} onChange={(event) => onToggleShowAllRegions(event.target.checked)} />
            Show detected regions
          </label>
          <IconButton icon={RotateCcw} label="Reset" title="Re-run detection" onClick={onResetDetection} />
        </div>
      )}

      <ToolbarDivider />

      <IconButton icon={Check} label="Done" onClick={onDone} active title="Exit Grab It (Esc)" />
    </>
  );
}
