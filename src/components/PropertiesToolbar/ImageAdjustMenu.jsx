import React, { useRef, useState } from "react";
import { FlipHorizontal, FlipVertical, ImageIcon } from "lucide-react";
import { IconButton, IconToggleButton } from "./toolbarUi";
import ToolbarPopover from "./ToolbarPopover";
import { FILTER_PRESETS } from "../../imageEffects";

// Collapses the bulk flip/filter controls (shown only when every selected
// item is image-like) into one button, same pattern as AlignMenu/
// DistributeMenu.
export default function ImageAdjustMenu({ imageLikeIds, onBulkFlip, onBulkFilterPreset }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  return (
    <div className="relative shrink-0" data-text-toolbar-safe>
      <div ref={anchorRef} className="inline-flex">
        <IconButton icon={ImageIcon} label="Image" onClick={() => setOpen((v) => !v)} active={open} />
      </div>
      <ToolbarPopover isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <div
          className="flex w-max items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-lg"
          data-text-toolbar-safe
        >
          <IconToggleButton
            icon={FlipHorizontal}
            onClick={() => onBulkFlip(imageLikeIds, "x")}
            title="Flip horizontal (all selected)"
          />
          <IconToggleButton
            icon={FlipVertical}
            onClick={() => onBulkFlip(imageLikeIds, "y")}
            title="Flip vertical (all selected)"
          />
          <select
            className="shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-600 outline-none"
            defaultValue=""
            onChange={(event) => {
              const preset = FILTER_PRESETS.find((p) => p.key === event.target.value);
              if (preset) onBulkFilterPreset(imageLikeIds, preset.adjustments);
              event.target.value = "";
            }}
          >
            <option value="" disabled>
              Apply filter…
            </option>
            {FILTER_PRESETS.map((preset) => (
              <option key={preset.key} value={preset.key}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>
      </ToolbarPopover>
    </div>
  );
}
