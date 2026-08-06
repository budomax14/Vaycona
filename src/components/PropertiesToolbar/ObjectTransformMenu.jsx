import React, { useRef, useState } from "react";
import { Move } from "lucide-react";
import { IconButton } from "./toolbarUi";
import ToolbarPopover from "./ToolbarPopover";
import ObjectTransformFields from "./ObjectTransformFields";

// Collapses position/size/rotate/anchor/lock/visibility/duplicate/layer-
// order/delete/align-to-page (ObjectTransformFields) behind one button —
// these aren't text-formatting controls, so they no longer sit in front of
// the text-specific controls in TextPropertiesBar.jsx. ObjectTransformFields
// itself is untouched and still used directly (uncollapsed) by every other
// object type's properties bar. Opens via ToolbarPopover (portalled) —
// PropertiesToolbar's row clips ordinary anchored dropdowns, see that
// component's comment.
export default function ObjectTransformMenu(props) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  return (
    <div className="relative shrink-0" data-text-toolbar-safe>
      <div ref={anchorRef} className="inline-flex">
        <IconButton icon={Move} label="Arrange" onClick={() => setOpen((v) => !v)} active={open} title="Position, size, order, lock" />
      </div>
      <ToolbarPopover isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <div className="flex w-96 flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-lg" data-text-toolbar-safe>
          <ObjectTransformFields {...props} />
        </div>
      </ToolbarPopover>
    </div>
  );
}
