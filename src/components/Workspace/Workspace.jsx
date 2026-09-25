import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import PageSlot from "./PageSlot";
import Ruler from "../../Ruler";
import { useResizeObserver } from "../../useResizeObserver";
import { useBreakpoint } from "../../useBreakpoint";
import { clamp } from "../../viewport";
import { isMobileDevice } from "../../canvasPixelBudget";
import { usePageThumbnails } from "../LeftSidebar/panels/usePageThumbnails";
import ThumbnailStage from "../LeftSidebar/panels/ThumbnailStage";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "../../languageContext";
import { STATUS_BAR_STRINGS } from "../../i18n/statusBarAndMenus";
import {
  BUTTON_ZOOM_STEP,
  MAX_SCALE,
  MIN_SCALE,
  RULER_THICKNESS,
  WORKSPACE_FIT_PADDING,
  WORKSPACE_PAGE_GAP,
  ZOOM_STEP,
} from "../../constants";

// Mobile browsers promote every <canvas> to its own GPU-backed hardware
// layer (independent of the canvas's own pixel budget — see
// canvasPixelBudget.js), and the whole tab/app is killed once graphics
// memory crosses a platform ceiling (~300MB on iOS; lower still on low-RAM
// Android phones). Every page in the project was mounting its own live,
// full Konva Stage (2 canvases: scene + hit) via InactivePagePreview, all
// the time, even pages far from the one being edited — so a project with
// several pages sat permanently close to that ceiling on a phone, and an
// ordinary edit's redraw/compositing on the ACTIVE page's own canvas was
// enough to tip it over ("A problem repeatedly occurred" on iOS; a silent
// tab reload/OOM kill on Android). Phones only: cache each inactive page as
// one static PNG (via the same usePageThumbnails/ThumbnailStage machinery
// PagesPanel's sidebar already uses) and show a plain <img> for it instead
// of a live Stage — leaving only the active page's Stage (plus, briefly,
// one single offscreen Stage while a queued page's preview regenerates)
// actually canvas-backed. Desktop is unaffected: isMobileDevice() gates all
// of this off, and PageSlot/InactivePagePreview fall back to exactly their
// prior behavior whenever no cached preview is available yet.
const IOS_PAGE_PREVIEW_MAX_SIDE = 1200;

function iosPagePreviewSize(page) {
  const longest = Math.max(page.width, page.height) || 1;
  const ratio = Math.min(1.5, IOS_PAGE_PREVIEW_MAX_SIDE / longest);
  return { width: Math.max(1, Math.round(page.width * ratio)), height: Math.max(1, Math.round(page.height * ratio)) };
}

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
    pageNumbers,
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
  // Phone-only static page previews — see this file's top comment.
  // Phone layout shows only the active page (with prev/next arrows), so
  // there are no inactive pages on screen to preview.
  const { isMobile } = useBreakpoint();
  const isMobileRef = useRef(isMobile);
  isMobileRef.current = isMobile;
  const { language } = useLanguage();
  const pagerText = STATUS_BAR_STRINGS[language].statusBar;
  const isMobileDeviceOnce = useMemo(() => isMobileDevice(), []);
  const iosStaticPreviews = isMobileDeviceOnce && !isMobile;
  const { thumbnails: iosPagePreviews, renderingPageId: iosPreviewRenderingId, handleCapture: handleIosPreviewCapture } = usePageThumbnails(pages, items, {
    enabled: iosStaticPreviews,
  });
  const iosPreviewRenderingPage = iosStaticPreviews ? pages.find((p) => p.id === iosPreviewRenderingId) : null;
  const pendingZoomAnchorRef = useRef(null);
  // Phone pinch: the page stack being visually zoomed by a CSS transform
  // mid-gesture, and where to re-anchor once the real scale commits — see
  // the pinch effect below.
  const pageStackRef = useRef(null);
  const pendingPinchAnchorRef = useRef(null);

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
  // Last page id a phone-size fit was applied for — see the effect below.
  const phoneFitPageIdRef = useRef(null);
  const activePage = pages.find((page) => page.id === activePageId) || pages[0];

  const showRulersRef = useRef(showRulers);
  showRulersRef.current = showRulers;
  const measurePageOrigin = useCallback(() => {
    const container = containerRef.current;
    const wrapper = activePageWrapperRef.current;
    if (!container || !wrapper) return;
    // pageOrigin only positions the rulers. On phone (rulers always hidden)
    // setting it on every scroll event re-rendered the workspace — and
    // with it the whole Konva page — on every frame of a scroll or pinch.
    if (isMobileRef.current && !showRulersRef.current) return;
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

  // Phone pinch settle: runs in the same commit as the new scale, before
  // paint, so the live CSS transform is swapped for the real zoom with no
  // visible jump — drops the transform, then scrolls so the page point that
  // was under the fingers at the start of the pinch sits under them now.
  useLayoutEffect(() => {
    settlePhonePinch();
  }, [scale]);

  function settlePhonePinch() {
    const pending = pendingPinchAnchorRef.current;
    const container = containerRef.current;
    const stack = pageStackRef.current;
    const wrapper = activePageWrapperRef.current;
    if (!pending) return;
    pendingPinchAnchorRef.current = null;
    if (stack) stack.style.transform = "";
    if (!container || !wrapper) return;
    const pageRect = wrapper.getBoundingClientRect();
    programmaticScrollRef.current = true;
    container.scrollLeft += pageRect.left + pending.pageX * scale - pending.targetX;
    container.scrollTop += pageRect.top + pending.pageY * scale - pending.targetY;
    requestAnimationFrame(() => {
      programmaticScrollRef.current = false;
    });
    measurePageOrigin();
  }

  // Declared after the zoom-anchor-restore effect above so it reads the
  // already-corrected scroll position within the same commit, whenever
  // zoom, resize, or the active page itself changes.
  useLayoutEffect(() => {
    measurePageOrigin();
  }, [measurePageOrigin, scale, containerSize.width, containerSize.height, activePageId, activePage?.width, activePage?.height, showRulers]);

  // Phone: when the page fits the screen width there's nothing to pan to
  // sideways, but the Stage's pasteboard margin still overhangs the page and
  // hands the scroller a few px of horizontal range — enough for a finger to
  // make the whole canvas slide/jiggle. Lock the X axis (no overflow, no
  // horizontal touch-pan) until the user zooms past the screen width.
  const phoneLockX = isMobile && !!activePage && containerSize.width > 0 && activePage.width * scale <= containerSize.width + 0.5;
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (phoneLockX && container && container.scrollLeft !== 0) container.scrollLeft = 0;
  });

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
      // The container can report 0 (or barely more than its padding) before
      // layout has settled — first paint on mobile, an orientation flip
      // mid-transition. Fitting against that yields a nonsense scale (clamped
      // to MIN_SCALE), and since that tiny page then "already fits" it would
      // never be corrected. Defer: the effects below re-run this once the
      // ResizeObserver reports real dimensions.
      const availableWidth = container.clientWidth - WORKSPACE_FIT_PADDING * 2;
      const availableHeight = container.clientHeight - WORKSPACE_FIT_PADDING * 2;
      if (container.clientWidth <= 0 || container.clientHeight <= 0 || availableWidth <= 0 || availableHeight <= 0) return;
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

  // Phones: the saved project carries the `scale` it was last viewed at (a
  // desktop session's zoom, typically ~1.0), and loading marks it as a manual
  // zoom, so autoFit never runs — a 1000px page then sits at 1:1 inside a
  // ~390px viewport. `scale` is view state, not document state, so on phones
  // re-derive it once per page from the real container size
  // (displayScale = available viewport / document). Waits for a valid
  // container; desktop/tablet keep their saved zoom exactly as before.
  useEffect(() => {
    if (!isMobile || !activePage) return;
    if (containerSize.width <= 0 || containerSize.height <= 0) return;
    if (phoneFitPageIdRef.current === activePage.id) return;
    phoneFitPageIdRef.current = activePage.id;
    fitToScreen({ force: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, containerSize.width, containerSize.height, activePage?.id]);

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
        // Phone: the pinch is shown as a GPU transform of the page stack and
        // only committed to the real `scale` when the fingers lift. Changing
        // `scale` every frame re-rendered the whole editor, restyled the
        // Transformer and re-rasterized the CSS-scaled canvas on each
        // pointermove — the same per-frame load that used to crash iOS
        // Safari mid-drag.
        const stack = pageStackRef.current;
        const wrapper = activePageWrapperRef.current;
        if (isMobileRef.current && stack && wrapper) {
          const mid = midpointOf(a, b);
          const stackRect = stack.getBoundingClientRect();
          const pageRect = wrapper.getBoundingClientRect();
          Object.assign(gestureStateRef.current, {
            phone: true,
            startMid: mid,
            stackLeft: stackRect.left,
            stackTop: stackRect.top,
            scrollLeft0: container.scrollLeft,
            scrollTop0: container.scrollTop,
            // Page-local point (content units) under the fingers at start.
            pageX: (mid.x - pageRect.left) / scale,
            pageY: (mid.y - pageRect.top) / scale,
            ratio: 1,
            frame: 0,
          });
          stack.style.transformOrigin = "0 0";
          stack.style.willChange = "transform";
        }
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
      if (state.phone) {
        state.ratio = newScale / state.startScale;
        state.lastMid = mid;
        if (!state.frame) {
          state.frame = requestAnimationFrame(() => {
            state.frame = 0;
            const stack = pageStackRef.current;
            if (!stack || gestureStateRef.current !== state) return;
            const s = state.ratio;
            const localX = state.startMid.x - state.stackLeft;
            const localY = state.startMid.y - state.stackTop;
            // Keep the start point under the (moving) finger midpoint, and
            // cancel out any scroll the browser applied mid-gesture.
            const tx = state.lastMid.x - state.stackLeft - s * localX + (container.scrollLeft - state.scrollLeft0);
            const ty = state.lastMid.y - state.stackTop - s * localY + (container.scrollTop - state.scrollTop0);
            stack.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${s})`;
          });
        }
        return;
      }
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
        const state = gestureStateRef.current;
        gestureStateRef.current = null;
        if (state.phone) {
          if (state.frame) cancelAnimationFrame(state.frame);
          const finalScale = clamp(state.startScale * state.ratio, MIN_SCALE, MAX_SCALE);
          pendingPinchAnchorRef.current = { pageX: state.pageX, pageY: state.pageY, targetX: state.lastMid.x, targetY: state.lastMid.y };
          if (Math.abs(finalScale - scale) > 0.0005) {
            onScaleChange(finalScale); // settlePhonePinch runs in that commit
          } else {
            settlePhonePinch(); // pure two-finger pan: no re-render needed
          }
          const stack = pageStackRef.current;
          if (stack) stack.style.willChange = "";
        }
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
  }, [scale, zoomAroundPoint, onManualInteraction, measurePageOrigin, onScaleChange]);

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
    // Programmatic scrolls (focus, scrollIntoView) can still move a locked
    // axis — snap it back; see phoneLockX.
    if (phoneLockX && containerRef.current && containerRef.current.scrollLeft !== 0) containerRef.current.scrollLeft = 0;
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
            centerOffset={(activePage?.width ?? 0) / 2}
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
            centerOffset={(activePage?.height ?? 0) / 2}
          />
        )}
        <div
          ref={containerRef}
          className={`canvas-area flex-1 ${phoneLockX ? "" : "touch-pan-x"} touch-pan-y ${
            isPanning || isSpaceDown ? "cursor-grabbing select-none" : ""
          }`}
          style={phoneLockX ? { overflowX: "hidden", overscrollBehavior: "contain" } : isMobile ? { overscrollBehavior: "contain" } : undefined}
          onMouseDown={handleMouseDown}
          onScroll={handleScroll}
          onContextMenu={(event) => {
            if (isPanning) event.preventDefault();
          }}
        >
          <div
            ref={pageStackRef}
            className="flex min-h-full flex-col items-center py-20"
            style={{ gap: WORKSPACE_PAGE_GAP, alignItems: "safe center", justifyContent: "safe center" }}
          >
            {pages.map((page, index) => {
              const isActive = page.id === activePageId;
              if (isMobile && !isActive) return null;
              return (
                <div key={page.id} ref={isActive ? activePageWrapperRef : undefined}>
                  <PageSlot
                    page={page}
                    pageIndex={index}
                    isActive={isActive}
                    scale={scale}
                    items={items}
                    pageNumbers={pageNumbers}
                    onActivate={() => onActivatePage(page.id)}
                    onAddPage={onAddPageAfter ? () => onAddPageAfter(page.id) : undefined}
                    previewImageUrl={!isActive && iosStaticPreviews ? iosPagePreviews.get(page.id) : undefined}
                  >
                    {isActive ? renderActivePage(page, scale) : null}
                  </PageSlot>
                </div>
              );
            })}
          </div>
        </div>
        {isMobile && pages.length > 1 && (() => {
          const activeIndex = pages.findIndex((p) => p.id === activePageId);
          const prevPage = activeIndex > 0 ? pages[activeIndex - 1] : null;
          const nextPage = activeIndex >= 0 && activeIndex < pages.length - 1 ? pages[activeIndex + 1] : null;
          const arrowClass =
            "absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/90 text-gray-700 shadow-md transition-opacity active:scale-95 disabled:pointer-events-none disabled:opacity-0";
          return (
            <>
              <button
                type="button"
                className={`${arrowClass} left-2`}
                aria-label={pagerText.previousPage}
                disabled={!prevPage}
                onClick={() => prevPage && onActivatePage(prevPage.id)}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                className={`${arrowClass} right-2`}
                aria-label={pagerText.nextPage}
                disabled={!nextPage}
                onClick={() => nextPage && onActivatePage(nextPage.id)}
              >
                <ChevronRight size={20} />
              </button>
            </>
          );
        })()}
        {/* iOS-only: mounts exactly one offscreen Stage at a time to
            (re)generate a static preview for whichever page is currently
            queued — see this file's top comment and PagesPanel's identical
            ThumbnailHost pattern for its sidebar thumbnails. */}
        {iosPreviewRenderingPage &&
          (() => {
            const size = iosPagePreviewSize(iosPreviewRenderingPage);
            return (
              <div style={{ position: "fixed", left: -9999, top: -9999 }} aria-hidden="true">
                <ThumbnailStage
                  page={iosPreviewRenderingPage}
                  items={items}
                  width={size.width}
                  height={size.height}
                  pageNumber={pages.findIndex((p) => p.id === iosPreviewRenderingPage.id) + 1}
                  numberPosition={pageNumbers?.enabled ? pageNumbers.position : null}
                  onCapture={(url) => handleIosPreviewCapture(iosPreviewRenderingPage.id, url)}
                />
              </div>
            );
          })()}
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
            centerOffset={(activePage?.height ?? 0) / 2}
          />
        )}
      </div>
    </div>
  );
});

export default Workspace;
