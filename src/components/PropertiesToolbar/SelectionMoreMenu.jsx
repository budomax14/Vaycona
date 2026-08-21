import React, { useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { IconButton } from "./toolbarUi";
import ResponsiveSheet from "../ResponsiveSheet/ResponsiveSheet";
import AnimateMenuItem from "./AnimateMenuItem";

// Fallback selection-level "More" menu — only rendered for selections that
// have no per-object-type More menu of their own (group, multi-select; see
// PropertiesToolbar). Single shape/icon/frame/image/text selections get
// Animate folded into their own ObjectMoreMenu/TextMoreMenu instead, so
// there is never more than one "More" button in the row at once.
export default function SelectionMoreMenu({ animationPanelOpen, onToggleAnimationPanel, hasAnimations, pushRight = true }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  return (
    <div className={`relative shrink-0 ${pushRight ? "ml-auto" : ""}`} data-text-toolbar-safe>
      <div ref={anchorRef} className="inline-flex">
        <IconButton icon={MoreHorizontal} label="More" onClick={() => setOpen((v) => !v)} active={open} />
      </div>
      <ResponsiveSheet isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)} align="right">
        <div className="w-56 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg" data-text-toolbar-safe>
          <AnimateMenuItem
            animationPanelOpen={animationPanelOpen}
            onToggleAnimationPanel={() => {
              setOpen(false);
              onToggleAnimationPanel();
            }}
            hasAnimations={hasAnimations}
          />
        </div>
      </ResponsiveSheet>
    </div>
  );
}
