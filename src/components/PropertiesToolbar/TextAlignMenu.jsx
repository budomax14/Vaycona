import React, { useRef, useState } from "react";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from "lucide-react";
import { IconButton, IconToggleButton } from "./toolbarUi";
import ToolbarPopover from "./ToolbarPopover";

const ALIGN_ICONS = { left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify };

// Collapses the left/center/right/justify buttons (previously four separate
// icons sitting directly on the toolbar row) into one button, same "popover
// holds the group" pattern TextListMenu/TextCurveMenu already established.
// The trigger shows whichever alignment is currently active so it's still
// readable at a glance without opening the popover.
export default function TextAlignMenu({ item, onChange }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const current = item.align || "left";
  const CurrentIcon = ALIGN_ICONS[current] || AlignLeft;

  return (
    <div className="relative shrink-0" data-text-toolbar-safe>
      <div ref={anchorRef} className="inline-flex">
        <IconButton icon={CurrentIcon} onClick={() => setOpen((v) => !v)} active={open} title="Text align" />
      </div>
      <ToolbarPopover isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <div className="flex w-max items-center gap-1 rounded-xl border border-gray-200 bg-white p-2 shadow-lg" data-text-toolbar-safe>
          <IconToggleButton icon={AlignLeft} active={current === "left"} onClick={() => onChange({ align: "left" })} title="Align left" />
          <IconToggleButton icon={AlignCenter} active={current === "center"} onClick={() => onChange({ align: "center" })} title="Align center" />
          <IconToggleButton icon={AlignRight} active={current === "right"} onClick={() => onChange({ align: "right" })} title="Align right" />
          <IconToggleButton icon={AlignJustify} active={current === "justify"} onClick={() => onChange({ align: "justify" })} title="Justify" />
        </div>
      </ToolbarPopover>
    </div>
  );
}
