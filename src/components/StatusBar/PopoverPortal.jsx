import React, { forwardRef } from "react";
import { createPortal } from "react-dom";

// The status bar footer needs horizontal scroll (overflow-x-auto) at
// narrow widths, but per the CSS spec that forces the computed overflow-y
// to "auto" too — silently clipping any ordinary absolutely-positioned
// upward-opening popover inside it. Rendering via a portal to <body> with
// position:fixed, anchored to the trigger's own on-screen rect, sidesteps
// that clipping ancestor entirely.
const PopoverPortal = forwardRef(function PopoverPortal({ anchorRect, align = "left", children }, ref) {
  if (!anchorRect) return null;

  const style = {
    position: "fixed",
    bottom: window.innerHeight - anchorRect.top + 8,
    zIndex: 60,
  };
  if (align === "right") {
    style.right = window.innerWidth - anchorRect.right;
  } else {
    style.left = anchorRect.left;
  }

  return createPortal(
    <div ref={ref} style={style}>
      {children}
    </div>,
    document.body
  );
});

export default PopoverPortal;
