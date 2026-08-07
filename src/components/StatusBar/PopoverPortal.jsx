import React, { forwardRef, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const VIEWPORT_MARGIN = 8;

// The status bar footer needs horizontal scroll (overflow-x-auto) at
// narrow widths, but per the CSS spec that forces the computed overflow-y
// to "auto" too — silently clipping any ordinary absolutely-positioned
// upward-opening popover inside it. Rendering via a portal to <body> with
// position:fixed, anchored to the trigger's own on-screen rect, sidesteps
// that clipping ancestor entirely.
//
// On a phone-width screen, that same footer scrolls to reach triggers
// (e.g. the Layers button) that end up sitting close to one edge of the
// viewport — a fixed-width panel anchored there can run off the opposite
// edge (a `right`-aligned panel anchored near the left edge, expanding
// further left, goes negative). The layout effect below measures the
// panel after it actually renders and nudges it back on-screen with a
// transform; it runs before paint, so there's no visible jump.
const PopoverPortal = forwardRef(function PopoverPortal({ anchorRect, align = "left", children }, forwardedRef) {
  const innerRef = useRef(null);
  const [shift, setShift] = useState(0);

  useLayoutEffect(() => {
    setShift(0);
    if (!anchorRect || !innerRef.current) return;
    const rect = innerRef.current.getBoundingClientRect();
    let adjust = 0;
    if (rect.right > window.innerWidth - VIEWPORT_MARGIN) adjust = window.innerWidth - VIEWPORT_MARGIN - rect.right;
    if (rect.left + adjust < VIEWPORT_MARGIN) adjust = VIEWPORT_MARGIN - rect.left;
    setShift(adjust);
    // Re-measures only when the anchor moves/reopens — the panel's own
    // size doesn't change after mount for these popovers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorRect, align]);

  if (!anchorRect) return null;

  const style = {
    position: "fixed",
    bottom: window.innerHeight - anchorRect.top + 8,
    zIndex: 60,
    transform: shift ? `translateX(${shift}px)` : undefined,
  };
  if (align === "right") {
    style.right = window.innerWidth - anchorRect.right;
  } else {
    style.left = anchorRect.left;
  }

  return createPortal(
    <div
      ref={(node) => {
        innerRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      style={style}
    >
      {children}
    </div>,
    document.body
  );
});

export default PopoverPortal;
