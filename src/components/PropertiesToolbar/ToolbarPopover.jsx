import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// PropertiesToolbar.jsx's row is `overflow-x-auto` — per the CSS overflow
// spec, setting overflow-x to anything but `visible` forces overflow-y to
// compute as `auto` too, silently clipping any ordinary
// absolutely-positioned downward-opening popover to the row's own ~64px
// height (the exact issue PopoverPortal.jsx already works around for
// StatusBar, just opening upward there instead of downward here). Portals
// to <body> with `position: fixed`, anchored to the trigger's own
// on-screen rect, so the popover always renders below the trigger
// regardless of that clipping ancestor.
export default function ToolbarPopover({ isOpen, anchorRef, onClose, align = "left", children }) {
  const [rect, setRect] = useState(null);
  const popoverRef = useRef(null);

  useLayoutEffect(() => {
    if (!isOpen || !anchorRef.current) {
      setRect(null);
      return;
    }
    setRect(anchorRef.current.getBoundingClientRect());
  }, [isOpen, anchorRef]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleOutside(event) {
      if (!popoverRef.current) return;
      if (popoverRef.current.contains(event.target)) return;
      if (anchorRef.current?.contains(event.target)) return;
      // A click inside a NESTED ToolbarPopover (e.g. ColorField's own
      // picker, opened from within TextEffectsMenu's popover) portals to
      // document.body independently — it's a sibling in the DOM, not a
      // descendant of this popoverRef, so the checks above alone would
      // misread it as "outside" and close this (outer) popover out from
      // under the nested one before its own click handler even runs
      // (mousedown fires — and unmounts the button — before click does).
      // Every ToolbarPopover instance marks its portal with this same
      // attribute, so any of them recognize a click landing in another one
      // as still "inside toolbar UI" rather than a true outside click.
      if (event.target.closest?.("[data-toolbar-popover]")) return;
      onClose();
    }
    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }
    // The toolbar row itself scrolling (its only scroll axis, per the
    // overflow-x-auto above) would otherwise leave a stale-positioned
    // popover behind — closing on scroll matches common anchored-popover
    // behavior elsewhere on the web rather than tracking position live.
    // Scrolling INSIDE the popover's own content (e.g. a long font list)
    // must NOT close it — capture-phase means this also sees scrolls from
    // the popover's own scrollable children, which don't bubble, so that
    // case needs an explicit exclusion rather than relying on bubbling.
    function handleScroll(event) {
      if (popoverRef.current && popoverRef.current.contains(event.target)) return;
      if (event.target.closest?.("[data-toolbar-popover]")) return;
      onClose();
    }
    window.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen || !rect) return null;

  const style = {
    position: "fixed",
    top: rect.bottom + 8,
    zIndex: 60,
  };
  if (align === "right") style.right = window.innerWidth - rect.right;
  else style.left = rect.left;

  return createPortal(
    <div ref={popoverRef} data-toolbar-popover style={style}>
      {children}
    </div>,
    document.body
  );
}
