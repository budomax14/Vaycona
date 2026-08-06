import React, { useRef, useState } from "react";
import { FlipHorizontal, FlipVertical, RotateCcw, RotateCw } from "lucide-react";
import { IconButton, IconToggleButton } from "./toolbarUi";
import ToolbarPopover from "./ToolbarPopover";

// Shared between ImagePropertiesBar and TextPropertiesBar — collapses the
// flip-horizontal/flip-vertical/rotate-left/rotate-right group (previously
// four separate buttons sitting directly on the toolbar row) into one
// "Transform" button, same "popover holds the group" pattern FiltersPopover
// already established for the Filters/Adjust/Recolor group.
export default function TransformMenu({ item, onChange }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  return (
    <div className="relative shrink-0">
      <div ref={anchorRef} className="inline-flex">
        <IconButton icon={RotateCw} label="Transform" onClick={() => setOpen((v) => !v)} active={open} />
      </div>
      <ToolbarPopover isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          <IconToggleButton
            icon={FlipHorizontal}
            active={!!item.flipX}
            onClick={() => onChange({ flipX: !item.flipX })}
            title="Flip horizontal"
          />
          <IconToggleButton
            icon={FlipVertical}
            active={!!item.flipY}
            onClick={() => onChange({ flipY: !item.flipY })}
            title="Flip vertical"
          />
          <IconButton
            icon={RotateCcw}
            onClick={() => onChange({ rotation: (((item.rotation || 0) - 90) % 360 + 360) % 360 })}
            title="Rotate left 90°"
            aria-label="Rotate left 90 degrees"
          />
          <IconButton
            icon={RotateCw}
            onClick={() => onChange({ rotation: (((item.rotation || 0) + 90) % 360 + 360) % 360 })}
            title="Rotate right 90°"
            aria-label="Rotate right 90 degrees"
          />
        </div>
      </ToolbarPopover>
    </div>
  );
}
