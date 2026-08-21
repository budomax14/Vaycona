import { useCallback, useRef } from "react";
import { usePointerCapability } from "./usePointerCapability";

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_THRESHOLD = 10;

// Long-press-to-open-context-menu on touch/pen, since a native `contextmenu`
// event doesn't reliably fire from a long-press on a Konva <canvas> — real
// mouse right-click is untouched (gated on hasCoarsePointer, a device
// capability, not viewport width). Returns pointer handlers to spread onto
// any element, DOM or react-konva (Konva nests the native event under
// `.evt`, hence the `getPoint` extractor). Fires `onLongPress(point)` with
// just the {x,y} coordinates — not the original event, which may not be
// safe to hold onto for the full 500ms delay.
export function useLongPress(onLongPress, { getPoint = (e) => ({ x: e.clientX, y: e.clientY }) } = {}) {
  const { hasCoarsePointer } = usePointerCapability();
  const timerRef = useRef(null);
  const startRef = useRef(null);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    startRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (event) => {
      if (!hasCoarsePointer) return;
      const point = getPoint(event);
      startRef.current = point;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        onLongPress(point);
      }, LONG_PRESS_MS);
    },
    [hasCoarsePointer, getPoint, onLongPress]
  );

  const onPointerMove = useCallback(
    (event) => {
      if (!startRef.current || !timerRef.current) return;
      const point = getPoint(event);
      if (Math.hypot(point.x - startRef.current.x, point.y - startRef.current.y) > MOVE_CANCEL_THRESHOLD) clear();
    },
    [getPoint, clear]
  );

  return { onPointerDown, onPointerMove, onPointerUp: clear, onPointerCancel: clear };
}
