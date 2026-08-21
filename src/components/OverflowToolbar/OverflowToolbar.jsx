import React, { useEffect, useLayoutEffect, useRef, useState, Children, isValidElement } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { useResizeObserver } from "../../useResizeObserver";
import { clampHorizontalShift } from "../../clampToViewport";

const MORE_BUTTON_WIDTH = 40;

// Marks a toolbar child that must never be pushed into the overflow "More"
// menu (e.g. Undo/Redo, Bold/Italic/Underline) — satisfies "important
// editing controls remain quickly accessible" even on the narrowest phone.
// This is a marker only: OverflowToolbar reads the prop off the element
// itself and renders `children` directly, so it adds no extra DOM wrapper.
export function OverflowItem({ children }) {
  return children;
}
OverflowItem.isOverflowItem = true;

// Wraps a row of toolbar controls and, based on *actually measured*
// available width (not a breakpoint), keeps as many as fit inline and
// moves the rest into a "More" popover — reorganizing by width instead of
// shrinking/clipping everything. Reused as-is by TopNavBar, every
// PropertiesToolbar bar, and StatusBar.
//
// Children may be plain elements (normal priority, first to overflow) or
// wrapped in <OverflowItem keepOnMobile> to stay pinned inline. At desktop
// widths, where these rows essentially never overflow today, this renders
// every child inline with no "More" button — visually identical to before.
export default function OverflowToolbar({ className = "", innerClassName = "justify-start gap-3", children, moreLabel = "More" }) {
  const containerRef = useRef(null);
  const measureRefs = useRef([]);
  const moreButtonRef = useRef(null);
  const menuPanelRef = useRef(null);
  const [widths, setWidths] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuRect, setMenuRect] = useState(null);
  const [menuShift, setMenuShift] = useState(0);
  const { width: containerWidth } = useResizeObserver(containerRef);

  const items = Children.toArray(children).filter(Boolean);

  // Two-pass measure: an off-screen (but laid out) clone of every item
  // gives natural widths without affecting the visible row, so the actual
  // visible/overflow split below never causes a layout flash.
  useLayoutEffect(() => {
    const next = measureRefs.current.map((el) => el?.offsetWidth || 0);
    setWidths((prev) => (prev.length === next.length && prev.every((w, i) => w === next[i]) ? prev : next));
  }, [items.length, containerWidth, children]);

  const keepOnMobile = items.map((item) => isValidElement(item) && item.type?.isOverflowItem && item.props.keepOnMobile);
  const reservedWidth = widths.reduce((sum, w, i) => sum + (keepOnMobile[i] ? w : 0), 0);
  const budget = Math.max(0, containerWidth - MORE_BUTTON_WIDTH - reservedWidth);

  let runningWidth = 0;
  const included = items.map((item, i) => {
    if (keepOnMobile[i]) return true;
    const w = widths[i] || 0;
    if (runningWidth + w <= budget) {
      runningWidth += w;
      return true;
    }
    return false;
  });
  // No measurement yet (first paint) — show everything inline rather than
  // guessing, avoids a flash of an empty/incomplete toolbar.
  const hasMeasurements = widths.length === items.length && widths.some((w) => w > 0);
  const visibleItems = hasMeasurements ? items.filter((_, i) => included[i]) : items;
  const overflowItems = hasMeasurements ? items.filter((_, i) => !included[i]) : [];

  // Portaled to document.body (not an ordinary absolutely-positioned child)
  // — the row this lives in (PropertiesToolbar.jsx etc.) is overflow-x-auto,
  // which per the CSS overflow spec forces overflow-y to compute as `auto`
  // too, silently clipping an ordinary dropdown to the row's own ~64px
  // height. Same fix ToolbarPopover.jsx already applies for the same reason.
  useLayoutEffect(() => {
    if (!menuOpen || !moreButtonRef.current) {
      setMenuRect(null);
      return;
    }
    setMenuRect(moreButtonRef.current.getBoundingClientRect());
  }, [menuOpen]);

  useLayoutEffect(() => {
    setMenuShift(0);
    if (!menuRect || !menuPanelRef.current) return;
    setMenuShift(clampHorizontalShift(menuPanelRef.current.getBoundingClientRect()));
  }, [menuRect]);

  // Closes on the row's own scroll (its only scroll axis, per the
  // ancestor's overflow-x-auto) rather than tracking position live — matches
  // ToolbarPopover.jsx's identical handling for the identical situation.
  useEffect(() => {
    if (!menuOpen) return undefined;
    function handleScroll(event) {
      if (menuPanelRef.current && menuPanelRef.current.contains(event.target)) return;
      setMenuOpen(false);
    }
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [menuOpen]);

  return (
    // flex-1 is load-bearing, not cosmetic: it gives this wrapper a stable
    // width equal to "whatever's left in the parent flex row" regardless of
    // how many children it currently chooses to render. Without it the
    // wrapper would shrink-to-fit its OWN (already-filtered) visible
    // content, creating a circular measurement bug — fewer visible items
    // shrinks the box, which shrinks the measured budget, which excludes
    // even more items on the next pass.
    <div ref={containerRef} className={`relative flex min-w-0 flex-1 ${className}`}>
      <div className={`flex min-w-0 flex-1 items-center overflow-hidden ${innerClassName}`}>
        {visibleItems}
        {overflowItems.length > 0 && (
          <div className="relative shrink-0">
            <button
              ref={moreButtonRef}
              type="button"
              className="toolbar-hit-target flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
              title={moreLabel}
              aria-label={moreLabel}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen &&
              menuRect &&
              createPortal(
                <>
                  <button
                    className="fixed inset-0 z-40 cursor-default"
                    aria-label="Close menu"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div
                    ref={menuPanelRef}
                    className="fixed z-50 flex max-h-[70vh] min-w-40 flex-col gap-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-xl"
                    style={{
                      top: menuRect.bottom + 4,
                      right: window.innerWidth - menuRect.right,
                      transform: menuShift ? `translateX(${menuShift}px)` : undefined,
                    }}
                  >
                    {overflowItems.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {item}
                      </div>
                    ))}
                  </div>
                </>,
                document.body
              )}
          </div>
        )}
      </div>

      {/* Off-screen measurement pass: laid out (not display:none, so
          offsetWidth is real) but invisible and non-interactive. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 flex items-center gap-3 opacity-0"
        style={{ visibility: "hidden", zIndex: -1 }}
      >
        {items.map((item, i) => (
          <div key={i} ref={(el) => (measureRefs.current[i] = el)} className="flex shrink-0 items-center">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

OverflowToolbar.Item = OverflowItem;
