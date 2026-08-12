import React, { useRef, useState } from "react";
import { AlignHorizontalSpaceBetween, AlignVerticalSpaceBetween } from "lucide-react";
import { IconButton, IconToggleButton, NumberField } from "./toolbarUi";
import ToolbarPopover from "./ToolbarPopover";
import { computeCurrentGap, inferDistributeAxis } from "../../alignment";

// Collapses Distribute horizontal/vertical + the Gap field into one
// button, same pattern as AlignMenu. Tracks whichever axis was last
// distributed (defaulting to whatever axis the selection is actually
// spread out along) so the Gap field stays meaningful even before either
// distribute button has been clicked this session.
export default function DistributeMenu({ items, canDistribute, onDistribute }) {
  const [open, setOpen] = useState(false);
  const [distributeAxis, setDistributeAxis] = useState(null);
  const anchorRef = useRef(null);

  const gapAxis = distributeAxis || (items && items.length >= 2 ? inferDistributeAxis(items) : "horizontal");
  const gapValue = items && items.length >= 2 ? computeCurrentGap(items, gapAxis) : null;

  return (
    <div className="relative shrink-0" data-text-toolbar-safe>
      <div ref={anchorRef} className="inline-flex">
        <IconButton
          icon={AlignHorizontalSpaceBetween}
          label="Distribute"
          onClick={() => setOpen((v) => !v)}
          active={open}
          disabled={!canDistribute}
        />
      </div>
      <ToolbarPopover isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <div
          className="flex w-max items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-lg"
          data-text-toolbar-safe
        >
          <IconToggleButton
            icon={AlignHorizontalSpaceBetween}
            onClick={() => {
              setDistributeAxis("horizontal");
              onDistribute("horizontal");
            }}
            title="Distribute horizontally"
          />
          <IconToggleButton
            icon={AlignVerticalSpaceBetween}
            onClick={() => {
              setDistributeAxis("vertical");
              onDistribute("vertical");
            }}
            title="Distribute vertically"
          />
          <NumberField
            label="Gap"
            value={gapValue != null ? Math.round(gapValue) : 0}
            min={0}
            width={64}
            onChange={(value) => onDistribute(gapAxis, Math.max(0, value))}
          />
        </div>
      </ToolbarPopover>
    </div>
  );
}
