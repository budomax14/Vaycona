import { useEffect, useRef, useState } from "react";

// Shared phone bottom-sheet motion (MobileSheet, ResponsiveSheet's mobile
// branch): slides in/out with an iOS-like curve instead of popping, stays
// mounted through the exit animation, and can be swiped down to dismiss
// from its header/grab handle (content scrolling is left alone).
export const SHEET_MS = 280;
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const CLOSE_DISTANCE = 90;
const CLOSE_VELOCITY = 0.5; // px per ms

export function useSheetMotion(isOpen, onClose) {
  const [mounted, setMounted] = useState(isOpen);
  const [visible, setVisible] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setDragY(0);
      // Two frames so the off-screen start position is painted before the
      // transition to on-screen begins.
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }
    setVisible(false);
    const timeout = setTimeout(() => setMounted(false), SHEET_MS);
    return () => clearTimeout(timeout);
  }, [isOpen]);

  function onPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // Buttons in the header (back/close) keep working as plain taps.
    if (event.target.closest?.("button, input, select, textarea, a")) return;
    dragRef.current = { startY: event.clientY, lastY: event.clientY, lastT: event.timeStamp, velocity: 0, pointerId: event.pointerId };
    setDragging(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is best-effort; the drag still tracks without it.
    }
  }

  function onPointerMove(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dt = Math.max(1, event.timeStamp - drag.lastT);
    drag.velocity = (event.clientY - drag.lastY) / dt;
    drag.lastY = event.clientY;
    drag.lastT = event.timeStamp;
    const dy = event.clientY - drag.startY;
    // Rubber-band upward pulls instead of letting the sheet leave its spot.
    setDragY(dy >= 0 ? dy : -Math.sqrt(-dy) * 2);
  }

  function onPointerEnd(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    const dy = event.clientY - drag.startY;
    if (dy > CLOSE_DISTANCE || (dy > 20 && drag.velocity > CLOSE_VELOCITY)) {
      onClose();
    } else {
      setDragY(0);
    }
  }

  const transition = dragging ? "none" : `transform ${SHEET_MS}ms ${EASE}`;
  return {
    mounted,
    visible,
    sheetStyle: {
      transform: visible ? `translateY(${Math.round(dragY)}px)` : "translateY(100%)",
      transition,
      willChange: "transform",
    },
    backdropStyle: {
      opacity: visible ? Math.max(0, 1 - Math.max(0, dragY) / 400) : 0,
      transition: dragging ? "none" : `opacity ${SHEET_MS}ms ${EASE}`,
    },
    dragHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      style: { touchAction: "none" },
    },
  };
}

// Keeps a sheet's last open content on screen while it slides away, so the
// exit animation doesn't show the parent's already-cleared state.
export function useLatchedWhileOpen(isOpen, value) {
  const ref = useRef(value);
  if (isOpen) ref.current = value;
  return isOpen ? value : ref.current;
}
