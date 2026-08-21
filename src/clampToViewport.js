// Shared viewport-clamping helpers for floating menus/popovers (ContextMenu,
// LayerContextMenu, ToolbarPopover, StatusBar/PopoverPortal) — consolidates
// what was four near-identical `window.innerWidth/innerHeight` clamps into
// one place, and prefers the *visual* viewport over the layout viewport
// when they differ (mobile on-screen keyboard shrinks visualViewport but
// not innerWidth/innerHeight) so a popover triggered while a text field has
// focus doesn't compute its clamp bounds against space the keyboard is
// actually covering. Desktop (no on-screen keyboard) never sees a
// difference between the two, so this is a no-op there.
export function getViewportSize() {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  if (vv) return { width: vv.width, height: vv.height, offsetLeft: vv.offsetLeft, offsetTop: vv.offsetTop };
  return { width: window.innerWidth, height: window.innerHeight, offsetLeft: 0, offsetTop: 0 };
}

// Full clamp for an arbitrarily-positioned menu (ContextMenu.jsx,
// LayerContextMenu.jsx style) — given a desired {x, y} and the menu's
// already-rendered size, returns a clamped {x, y} that keeps it fully
// on-screen.
export function clampPositionToViewport(position, size, margin = 8) {
  const { width, height, offsetLeft, offsetTop } = getViewportSize();
  const maxLeft = offsetLeft + width - size.width - margin;
  const maxTop = offsetTop + height - size.height - margin;
  return {
    x: Math.max(offsetLeft + margin, Math.min(position.x, maxLeft)),
    y: Math.max(offsetTop + margin, Math.min(position.y, maxTop)),
  };
}

// Horizontal-only nudge for a popover that's otherwise fixed-anchored to a
// trigger element (ToolbarPopover.jsx, StatusBar/PopoverPortal.jsx style) —
// given the popover's already-rendered rect, returns a translateX delta
// that keeps it from running off either horizontal edge.
export function clampHorizontalShift(rect, margin = 8) {
  const { width, offsetLeft } = getViewportSize();
  let adjust = 0;
  if (rect.right > offsetLeft + width - margin) adjust = offsetLeft + width - margin - rect.right;
  if (rect.left + adjust < offsetLeft + margin) adjust = offsetLeft + margin - rect.left;
  return adjust;
}
