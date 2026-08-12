import React, { useRef, useState } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
} from "lucide-react";
import { IconButton, IconToggleButton } from "./toolbarUi";
import ToolbarPopover from "./ToolbarPopover";

// Collapses the 6 align buttons (left/center/right/top/middle/bottom) into
// one button, same "popover holds the group" pattern TextAlignMenu/
// ObjectMoreMenu already established for this toolbar. Unlike
// TextAlignMenu, a multi-selection has no single stored "current"
// alignment to reflect on the trigger, so it just shows a static icon.
export default function AlignMenu({ onAlign }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  return (
    <div className="relative shrink-0" data-text-toolbar-safe>
      <div ref={anchorRef} className="inline-flex">
        <IconButton icon={AlignStartVertical} label="Align" onClick={() => setOpen((v) => !v)} active={open} />
      </div>
      <ToolbarPopover isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <div
          className="flex w-max items-center gap-1 rounded-xl border border-gray-200 bg-white p-2 shadow-lg"
          data-text-toolbar-safe
        >
          <IconToggleButton icon={AlignStartVertical} onClick={() => onAlign("left")} title="Align left" />
          <IconToggleButton icon={AlignCenterVertical} onClick={() => onAlign("center-h")} title="Align center" />
          <IconToggleButton icon={AlignEndVertical} onClick={() => onAlign("right")} title="Align right" />
          <IconToggleButton icon={AlignStartHorizontal} onClick={() => onAlign("top")} title="Align top" />
          <IconToggleButton icon={AlignCenterHorizontal} onClick={() => onAlign("middle-v")} title="Align middle" />
          <IconToggleButton icon={AlignEndHorizontal} onClick={() => onAlign("bottom")} title="Align bottom" />
        </div>
      </ToolbarPopover>
    </div>
  );
}
