import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import PageSlot from "./PageSlot";
import Ruler from "../../Ruler";
import { useResizeObserver } from "../../useResizeObserver";
import { clamp } from "../../viewport";
import {
  BUTTON_ZOOM_STEP,
  MAX_SCALE,
  MIN_SCALE,
  RULER_THICKNESS,
  WORKSPACE_FIT_PADDING,
  WORKSPACE_PAGE_GAP,
  ZOOM_STEP,
} from "../../constants";

// Pan lives entirely in native scroll (scrollLeft/scrollTop), not in Konva —
// see the Phase 1 plan for why. Zoom changes `scale`; the actual Konva
// canvases stay a fixed resolution regardless of `scale` (see RENDER_SCALE_CAP
// usage in App.jsx) so zoom never grows canvas memory/redraw cost.
const Workspace = forwardRef(function Workspace(
  {
    pages,
    activePageId,
    onActivatePage,
    items,
    scale,
    onScaleChange,
    autoFit,
    onManualInteraction,
    isSpaceDown,
    renderActivePage,
    onAddPageAfter,
    showRulers = false,
    unit = "px",
    cursorContentPos = null,
    onGuideDragStart,
    selectionExtent = null,
  },
  ref
) {
  const containerRef = useRef(null);
  const activePageWrapperRef = useRef(null);
  const panStateRef = useRef(null);
  const pendingZoomAnchorRef = useRef(null);
  const programmaticScrollRef = useRef(false);
  // Two-finger pinch/pan gesture tracking — see the dedicated effect below.
  // gestureActiveRef is read by App.jsx's handleStageMouseDown (via
  // isGestureActive in the imperative handle) so a second finger touching
  // empty canvas starts a pinch/pan instead of corrupting marquee-select.
  const activeTouchPointersRef = useRef(new Map());
  const gestureStateRef = useRef(null);
  const gestureActiveRef = useRef(false);
  const gestureEndTimeoutRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);
  // Screen-space position of the active page's top-left corner relative to
  // this container's own top-left — this is what lets rulers stay put in the
  // editor chrome (outside the scrolling canvas-area) while still reading
  // out correct measurements as the page pans/zooms underneath them.
  const [pageOrigin, setPageOrigin] = useState({ x: 0, y: 0 });

  const containerSize = useResizeObserver(containerRef);
  const activePage = pages.find((page) => page.id === activePageId) || pages[0];

  const measurePageOrigin = useCallback(() => {
    const container = containerRef.current;
    const wrapper = activePageWrapperRef.current;
    if (!container || !wrapper) return;
    const containerRect = container.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    setPageOrigin({ x: wrapperRect.left - containerRect.left, y: wrapperRect.top - containerRect.top });
  }, []);

  const zoomAroundPoint = useCallback(
    (newScaleRaw, viewportX, viewportY, { manual = true } = {}) => {
      const container = containerRef.current;
      if (!container) return;
      const oldScale = scale;
      const newScale = clamp(newScaleRaw, MIN_SCALE, MAX_SCALE);
      if (newScale === oldScale) return;
      const contentX = (container.scrollLeft + viewportX) / oldScale;
      const contentY = (container.scrollTop + viewportY) / oldScale;
      pendingZoomAnchorRef.current = { contentX, contentY, viewportX, viewportY };
      if (manual) onManualInteraction();
      onScaleChange(newScale);
    },
    [scale, onScaleChange, onManualInteraction]
  );

  // Runs after the DOM has already picked up the new page-wrapper size (so
  // scrollWidth/scrollHeight are current) but before paint — no visible
  // flash of a momentarily-wrong scroll position.
  useLayoutEffect(() => {
    const anchor = pendingZoomAnchorRef.current;
    const container = containerRef.current;
    if (!anchor || !container) return;
    pendingZoomAnchorRef.current = null;
    programmaticScrollRef.current = true;
    container.scrollLeft = anchor.contentX * scale - anchor.viewportX;
    container.scrollTop = anchor.contentY * scale - anchor.viewportY;
    requestAnimationFrame(() => {
      programmaticScrollRef.current = false;
    });
  }, [scale]);

  // Declared after the zoom-anchor-restore effect above so it reads the
  // already-corrected scroll position within the same commit, whenever
  // zoom, resize, or the active page itself changes.
  useLayoutEffect(() => {
    measurePageOrigin();
  }, [measurePageOrigin, scale, containerSize.width, containerSize.height, activePageId, activePage?.width, activePage?.height]);

  const scrollToActivePage = useCallback(() => {
    const container = containerRef.current;
    const wrapper = activePageWrapperRef.current;
    if (!container || !wrapper) return;
    const wrapperRect = wrapper.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    programmaticScrollRef.current = true;
    container.scrollLeft += wrapperRect.left - containerRect.left - (containerRect.width - wrapperRect.width) / 2;
    container.scrollTop += wrapperRect.top - containerRect.top - (containerRect.height - wrapperRect.height) / 2;
    requestAnimationFrame(() => {
      programmaticScrollRef.current = false;
    });
  }, []);

  const fitToScreen = useCallback(
    ({ force = false } = {}) => {
      const container = containerRef.current;
      if (!container || !activePage) return;
      const availableWidth = container.clientWidth - WORKSPACE_FIT_PADDING * 2;
      const availableHeight = container.clientHeight - WORKSPACE_FIT_PADDING * 2;
      // If the page already fits fully within the available space at the
      // current zoom, leave scale and scroll position alone. Without this,
      // any incidental container-size change (opening/closing a left
      // sidebar panel, resizing the window) would rescale and re-center
      // the page even though it was already fully visible — a visible
      // "jump" the user never asked for. An explicit fit action (the
      // toolbar button, Ctrl/Cmd+0) passes force:true to always snap to
      // an optimal centered fit regardless.
      const alreadyFits = activePage.width * scale <= availableWidth && activePage.height * scale <= availableHeight;
      if (alreadyFits && !force) return;
      const nextScale = clamp(
        Math.min(availableWidth / activePage.width, availableHeight / activePage.height),
        MIN_SCALE,
        MAX_SCALE
      );
      onScaleChange(nextScale);
      requestAnimationFrame(() => scrollToActivePage());
    },
    [activePage, scale, onScaleChange, scrollToActivePage]
  );

  useEffect(() => {
    if (!autoFit) return;
    fitToScreen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFit, containerSize.width, containerSize.height, activePageId, activePage?.width, activePage?.height]);

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => {
        const container = containerRef.current;
        if (!container) return;
        zoomAroundPoint(scale * BUTTON_ZOOM_STEP, container.clientWidth / 2, container.clientHeight / 2);
      },
      zoomOut: () => {
        const container = containerRef.current;
        if (!container) return;
        zoomAroundPoint(scale / BUTTON_ZOOM_STEP, container.clientWidth / 2, container.clientHeight / 2);
      },
      zoomTo: (value) => {
        const container = containerRef.current;
        if (!container) return;
        zoomAroundPoint(value, container.clientWidth / 2, container.clientHeight / 2);
      },
      fitToScreen,
      scrollToActivePage,
      isGestureActive: () => gestureActiveRef.current,
    }),
    [scale, zoomAroundPoint, fitToScreen, scrollToActivePage]
  );

  // Attached manually with { passive: false } — React's JSX onWheel is
  // registered as a passive listener by the browser for this event type,
  // so event.preventDefault() inside a JSX handler is silently a no-op
  // (throws a console warning and lets the native ctrl+wheel page-zoom/
  // scroll fight the app's own compensating scroll).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    function handleWheel(event) {
      if (!(event.ctrlKey || event.metaKey)) return; // plain wheel: native scroll handles it
      event.preventDefault();
      const rect = container.getBoundingClientRect();
      const viewportX = event.clientX - rect.left;
      const viewportY = event.clientY - rect.top;
      const direction = event.deltaY > 0 ? -1 : 1;
      const newScale = direction > 0 ? scale * ZOOM_STEP : scale / ZOOM_STEP;
      zoomAroundPoint(newScale, viewportX, viewportY);
    }

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [scale, zoomAroundPoint]);

  // Two-finger pinch-to-zoom + two-finger pan. Attached manually (not JSX
  // onPointer*) with a non-passive pointermove so preventDefault() actually
  // stops the browser's native touch-scroll from fighting our own scroll
  // assignment mid-gesture — same reasoning as the wheel handler above.
  // Reuses zoomAroundPoint (the same anchor-preserving math the wheel/
  // button zoom already use) for the zoom component; the pan component is
  // applied as a direct scrollLeft/scrollTop delta only on frames where the
  // pinch distance didn't meaningfully change, since zoomAroundPoint's own
  // re-anchoring (using this frame's current midpoint as the target) already
  // absorbs any simultaneous pan when a zoom IS happening — applying both
  // would double-count the same translation.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    function point(event) {
      return { x: event.clientX, y: event.clientY };
    }
    function distanceBetween(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y);
    }
    function midpointOf(a, b) {
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    function handlePointerDown(event) {
      if (event.pointerType === "mouse") return;
      activeTouchPointersRef.current.set(event.pointerId, point(event));
      if (activeTouchPointersRef.current.size === 2) {
        if (gestureEndTimeoutRef.current) {
          clearTimeout(gestureEndTimeoutRef.current);
          gestureEndTimeoutRef.current = null;
        }
        const [a, b] = Array.from(activeTouchPointersRef.current.values());
        gestureStateRef.current = { startDistance: distanceBetween(a, b), startScale: scale, lastMid: midpointOf(a, b) };
        gestureActiveRef.current = true;
        onManualInteraction();
        try {
          container.setPointerCapture(event.pointerId);
        } catch {
          // Some browsers disallow capturing a second pointer id; the
          // gesture still works without it, just without guaranteed
          // delivery if a finger drifts outside the container's bounds.
        }
      }
    }

    function handlePointerMove(event) {
      if (!activeTouchPointersRef.current.has(event.pointerId)) return;
      activeTouchPointersRef.current.set(event.pointerId, point(event));
      const state = gestureStateRef.current;
      if (activeTouchPointersRef.current.size !== 2 || !state) return;
      event.preventDefault();
      const [a, b] = Array.from(activeTouchPointersRef.current.values());
      const mid = midpointOf(a, b);
      const distanceRatio = distanceBetween(a, b) / state.startDistance;
      const newScale = clamp(state.startScale * distanceRatio, MIN_SCALE, MAX_SCALE);
      const rect = container.getBoundingClientRect();
      const scaleChanged = Math.abs(newScale - scale) > 0.001;
      if (scaleChanged) {
        zoomAroundPoint(newScale, mid.x - rect.left, mid.y - rect.top);
      } else {
        container.scrollLeft -= mid.x - state.lastMid.x;
        container.scrollTop -= mid.y - state.lastMid.y;
        measurePageOrigin();
      }
      state.lastMid = mid;
    }

    function handlePointerEnd(event) {
      activeTouchPointersRef.current.delete(event.pointerId);
      if (activeTouchPointersRef.current.size < 2 && gestureStateRef.current) {
        gestureStateRef.current = null;
        // Delayed clear (not immediate) — the trailing single finger lifting
        // last would otherwise land on Konva's onPointerUp in the same tick
        // and be read as a stray single-finger tap/marquee-start.
        gestureEndTimeoutRef.current = setTimeout(() => {
          gestureActiveRef.current = false;
        }, 200);
      }
    }

    container.addEventListener("pointerdown", handlePointerDown, { passive: true });
    container.addEventListener("pointermove", handlePointerMove, { passive: false });
    container.addEventListener("pointerup", handlePointerEnd, { passive: true });
    container.addEventListener("pointercancel", handlePointerEnd, { passive: true });
    return () => {
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", handlePointerEnd);
      container.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [scale, zoomAroundPoint, onManualInteraction, measurePageOrigin]);

  useEffect(() => () => clearTimeout(gestureEndTimeoutRef.current), []);

  function beginPan(startClientX, startClientY) {
    const container = containerRef.current;
    if (!container) return;
    onManualInteraction();
    panStateRef.current = {
      startClientX,
      startClientY,
      startScrollLeft: container.scrollLeft,
      startScrollTop: container.scrollTop,
    };
    setIsPanning(true);

    function handleMove(event) {
      const state = panStateRef.current;
      if (!state) return;
      container.scrollLeft = state.startScrollLeft - (event.clientX - state.startClientX);
      container.scrollTop = state.startScrollTop - (event.clientY - state.startClientY);
      measurePageOrigin();
    }
    function handleUp() {
      panStateRef.current = null;
      setIsPanning(false);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  function handleMouseDown(event) {
    if (isSpaceDown || event.button === 1) {
      event.preventDefault();
      beginPan(event.clientX, event.clientY);
    }
  }

  function handleScroll() {
    measurePageOrigin();
    if (programmaticScrollRef.current) return;
    onManualInteraction();
  }

  // Rulers live here (not inside the page/canvas-frame) so they're editor
  // chrome that stays put in the workspace while the page pans/zooms
  // underneath — `pageOrigin` is the page's live on-screen position, kept in
  // sync with scroll/zoom/resize above.
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {showRulers && (
        <div className="flex shrink-0" style={{ height: RULER_THICKNESS }}>
          <div className="ruler-corner shrink-0" style={{ width: RULER_THICKNESS, height: RULER_THICKNESS }} />
          <Ruler
            orientation="horizontal"
            viewport={{ scale, x: pageOrigin.x, y: 0 }}
            viewportLength={containerSize.width}
            cursorContentPos={cursorContentPos?.x}
            onGuideDragStart={() => onGuideDragStart?.("horizontal")}
            unit={unit}
            selectionExtent={selectionExtent?.horizontal}
          />
          <div className="ruler-corner ruler-corner-end shrink-0" style={{ width: RULER_THICKNESS, height: RULER_THICKNESS }} />
        </div>
      )}
      <div className="relative flex flex-1 overflow-hidden">
        {showRulers && (
          <Ruler
            orientation="vertical"
            viewport={{ scale, x: 0, y: pageOrigin.y }}
            viewportLength={containerSize.height}
            cursorContentPos={cursorContentPos?.y}
            onGuideDragStart={() => onGuideDragStart?.("vertical")}
            unit={unit}
            selectionExtent={selectionExtent?.vertical}
          />
        )}
        <div
          ref={containerRef}
          className={`canvas-area flex-1 touch-pan-x touch-pan-y ${
            isPanning || isSpaceDown ? "cursor-grabbing select-none" : ""
          }`}
          onMouseDown={handleMouseDown}
          onScroll={handleScroll}
          onContextMenu={(event) => {
            if (isPanning) event.preventDefault();
          }}
        >
          <div
            className="flex min-h-full flex-col items-center py-20"
            style={{ gap: WORKSPACE_PAGE_GAP, alignItems: "safe center", justifyContent: "safe center" }}
          >
            {pages.map((page, index) => {
              const isActive = page.id === activePageId;
              return (
                <div key={page.id} ref={isActive ? activePageWrapperRef : undefined}>
                  <PageSlot
                    page={page}
                    pageIndex={index}
                    isActive={isActive}
                    scale={scale}
                    items={items}
                    onActivate={() => onActivatePage(page.id)}
                    onAddPage={onAddPageAfter ? () => onAddPageAfter(page.id) : undefined}
                  >
                    {isActive ? renderActivePage(page, scale) : null}
                  </PageSlot>
                </div>
              );
            })}
          </div>
        </div>
        {showRulers && (
          <Ruler
            orientation="vertical"
            className="ruler-vertical-end"
            viewport={{ scale, x: 0, y: pageOrigin.y }}
            viewportLength={containerSize.height}
            cursorContentPos={cursorContentPos?.y}
            onGuideDragStart={() => onGuideDragStart?.("vertical")}
            unit={unit}
            selectionExtent={selectionExtent?.vertical}
          />
        )}
      </div>
    </div>
  );
});

export default Workspace;
