import React from "react";
import { createPortal } from "react-dom";
import ToolbarPopover from "../PropertiesToolbar/ToolbarPopover";
import { useBreakpoint } from "../../useBreakpoint";

// Drop-in replacement for ToolbarPopover with the exact same
// isOpen/anchorRef/onClose/align/children contract: at tablet/desktop it
// delegates straight to ToolbarPopover (byte-identical behavior, so this
// is a no-op above the mobile breakpoint). At mobile width it instead
// renders a bottom sheet — the "content panels become drawers/bottom
// sheets on mobile" requirement — since a small anchored dropdown can end
// up mis-anchored or cramped when its trigger button itself is sitting in
// a horizontally-scrolled/overflowed toolbar row on a phone.
export default function ResponsiveSheet({ isOpen, anchorRef, onClose, align, children }) {
  const { tier } = useBreakpoint();

  if (tier !== "mobile") {
    return (
      <ToolbarPopover isOpen={isOpen} anchorRef={anchorRef} onClose={onClose} align={align}>
        {children}
      </ToolbarPopover>
    );
  }

  if (!isOpen) return null;

  return createPortal(
    <>
      <button className="fixed inset-0 z-40 bg-black/20" aria-label="Close" onClick={onClose} />
      <div
        data-toolbar-popover
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[75vh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl"
      >
        <div className="flex shrink-0 justify-center pb-1 pt-2.5">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>
        <div className="overflow-y-auto px-4 pb-[max(1rem,var(--safe-bottom))] pt-1">{children}</div>
      </div>
    </>,
    document.body
  );
}
