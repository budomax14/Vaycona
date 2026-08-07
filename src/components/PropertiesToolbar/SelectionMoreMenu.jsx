import React, { useRef, useState } from "react";
import { MoreHorizontal, Sparkles } from "lucide-react";
import { IconButton } from "./toolbarUi";
import ToolbarPopover from "./ToolbarPopover";

// Selection-level "More" menu — sits at the far right of PropertiesToolbar's
// row, alongside (not inside) the per-object-type More menus (ObjectMoreMenu,
// TextMoreMenu). Those are scoped to a single object type's own controls;
// this one holds actions that apply across every selection shape (single,
// group, multi-select) — Animate being the first.
export default function SelectionMoreMenu({ animationPanelOpen, onToggleAnimationPanel, hasAnimations }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  return (
    <div className="relative ml-auto shrink-0" data-text-toolbar-safe>
      <div ref={anchorRef} className="inline-flex">
        <IconButton icon={MoreHorizontal} label="More" onClick={() => setOpen((v) => !v)} active={open} />
      </div>
      <ToolbarPopover isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)} align="right">
        <div className="w-56 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg" data-text-toolbar-safe>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onToggleAnimationPanel();
            }}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium ${
              animationPanelOpen
                ? "bg-amber-50 text-amber-700"
                : hasAnimations
                  ? "text-amber-600 hover:bg-amber-50"
                  : "text-gray-700 hover:bg-amber-50 hover:text-amber-700"
            }`}
            aria-pressed={animationPanelOpen}
          >
            <Sparkles size={15} />
            Animate
          </button>
        </div>
      </ToolbarPopover>
    </div>
  );
}
