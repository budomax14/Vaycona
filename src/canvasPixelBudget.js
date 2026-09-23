import Konva from "konva";

// Konva sizes every canvas' backing store as (cssWidth * pixelRatio) x
// (cssHeight * pixelRatio), and its default pixelRatio is devicePixelRatio
// (3 on iPhone). The editing Stage is already RENDER_SCALE_CAP x the page
// plus the pasteboard margin on every side, so e.g. a 900x620 page at
// DPR 3 asks for a ~8300x6600 (~55M px) canvas. iOS Safari refuses to
// draw into canvases over ~16.7M px: the context silently becomes a no-op,
// so the page background (plain CSS on .canvas-frame) and the DOM overlays
// (toolbars, handles) still show while every Konva element is invisible.
//
// This only shrinks the *backing store* resolution. Nothing about document
// coordinates, Stage scale/x/y, or the CSS zoom transform changes — the
// Stage is still laid out in the same CSS pixels, just sampled with fewer
// device pixels per CSS pixel where the platform could not draw it anyway.

// Apple's documented per-canvas ceiling is 16,777,216 px, but that is not a
// safe working size: every 16M px canvas is 64MB of RAM, and Safari also
// keeps a hit canvas, a compositor copy for the CSS zoom transform, and
// per-node filter caches. Near the ceiling an *edit* (which redraws and
// re-caches) pushes the tab over iOS's memory limit and the page reloads
// ("a problem repeatedly occurred"). Stay well under it.
/**
 * Mobile Canvas Memory Safety
 * ---------------------------------------------------------
 * Designed for Konva-based editors running on:
 * - iPhone / iPad Safari
 * - iOS Chrome/Firefox (still WebKit)
 * - Android Chrome/WebView
 *
 * Goals:
 * 1. Prevent oversized backing canvases.
 * 2. Prevent huge Konva node caches.
 * 3. Reduce large camera images before using them in editor.
 * 4. Restore canvas ratios correctly after resize.
 * 5. Avoid unnecessary redraws.
 * 6. Keep desktop rendering unchanged.
 */


/* =========================================================
   CONFIG
   ========================================================= */

// Cut hard from the original crash-safety budget: phones don't just need to
// avoid the iOS canvas ceiling, they need the whole editor to feel light —
// fewer backing-store pixels to rasterize and composite on every
// edit/drag/zoom, at the cost of some sharpness.
export const MOBILE_MAX_SCENE_PIXELS = 900_000;

export const MOBILE_MAX_CACHE_PIXELS = 600_000;

export const MOBILE_MAX_IMAGE_PIXELS = 1_200_000;

export const MOBILE_MAX_IMAGE_SIDE = 1280;

// While a drag gesture is actually in progress, cut further still: this is
// the exact moment the "A problem repeatedly occurred" crash hits, because
// every pointermove forces a full-layer redraw (batchDraw doesn't do a
// dirty-rect repaint, it repaints the whole backing store) at whatever the
// steady-state budget is, stacked on top of everything else already
// resident (every other cached node, every other canvas on the page). A
// smaller backing store during the drag means a cheaper redraw 60x/sec and
// a smaller peak, and it's only in effect for the gesture's duration —
// applyCanvasPixelBudget restores the normal budget the instant it ends.
export const MOBILE_DRAG_MAX_SCENE_PIXELS = 350_000;

// Hit detection does not need retina resolution.
const MOBILE_HIT_PIXEL_RATIO = 0.4;

// Hit-testing isn't needed for the node actually being dragged (its
// position is set imperatively, not via hit-graph lookups) or for anything
// else while a drag owns the pointer — drop it hard for the gesture too.
const MOBILE_DRAG_HIT_PIXEL_RATIO = 0.2;

// Don't let rendering become completely unusable.
const MIN_SCENE_PIXEL_RATIO = 0.25;

const MIN_CACHE_PIXEL_RATIO = 0.25;


/* =========================================================
   DEVICE DETECTION
   ========================================================= */

export function isIOSWebKit() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const ua = navigator.userAgent || "";

  // Normal iPhone / iPad / iPod detection
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return true;
  }

  // iPadOS 13+ can identify itself as Macintosh
  return (
    /Macintosh/i.test(ua) &&
    (navigator.maxTouchPoints || 0) > 1
  );
}


export function isAndroid() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /Android/i.test(navigator.userAgent || "");
}


export function isMobileDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  if (isIOSWebKit()) {
    return true;
  }

  if (isAndroid()) {
    return true;
  }

  return /Mobi/i.test(navigator.userAgent || "");
}

// Every fix below (applyCanvasPixelBudget, getSafeCachePixelRatio,
// safeCacheNode) runs AFTER a canvas already exists, correcting it in a
// React effect or at an explicit call site. Konva itself defaults every
// canvas it creates — each layer's scene canvas, its hit canvas, and every
// node.cache() call anywhere in the app — to window.devicePixelRatio
// unless told otherwise (see konva/lib/Canvas.js: `conf.pixelRatio ||
// Konva.pixelRatio || getDevicePixelRatio()`). On a real phone (DPR
// 2.75-4, not the 1-2 a desktop-Chromium device emulator reports) that
// FIRST allocation, before any correction effect has run and for any
// node.cache() call site that doesn't explicitly pass a safe ratio, is by
// itself large enough to crash Safari — which is why a crash can happen
// immediately on a brand-new blank design, not just on drag. Overriding
// Konva's own global default closes both holes in one place: nothing it
// ever creates can start out oversized, on any phone, regardless of
// whether the per-call-site correction below runs, lags, or was missed.
if (isMobileDevice()) {
  Konva.pixelRatio = 1;

  // perfectDrawEnabled makes every shape with both a fill+stroke or an
  // opacity<1 draw twice (once to an offscreen buffer, to avoid the
  // overlapping seam where stroke meets fill) before compositing. That's a
  // real cost on underpowered phone GPUs and CPUs across a canvas full of
  // shapes/text/frames, for a seam that's rarely visible at phone viewing
  // sizes. Off globally on mobile only; desktop keeps the crisper default.
  Konva.perfectDrawEnabled = false;
}

/* =========================================================
   DEVICE PIXEL RATIO
   ========================================================= */

function getDevicePixelRatio() {
  if (typeof window === "undefined") {
    return 1;
  }

  return Math.max(1, window.devicePixelRatio || 1);
}


/* =========================================================
   PIXEL RATIO CALCULATION
   ========================================================= */

/**
 * Calculate the highest safe pixel ratio for a canvas.
 */
export function calculateSafePixelRatio(
  width,
  height,
  maxPixels = MOBILE_MAX_SCENE_PIXELS
) {
  if (!(width > 0) || !(height > 0)) {
    return 1;
  }

  const dpr = getDevicePixelRatio();

  const cssPixels = width * height;

  if (!Number.isFinite(cssPixels) || cssPixels <= 0) {
    return 1;
  }

  const fittingRatio = Math.sqrt(
    maxPixels / cssPixels
  );

  return Math.min(
    dpr,
    Math.max(
      MIN_SCENE_PIXEL_RATIO,
      fittingRatio
    )
  );
}


/* =========================================================
   KONVA STAGE SAFETY
   ========================================================= */

/**
 * Apply mobile-safe backing-store sizes to all layers.
 *
 * Desktop is intentionally untouched. Pass `{ dragging: true }` while a
 * drag gesture owns the pointer to drop to the much tighter
 * MOBILE_DRAG_MAX_SCENE_PIXELS budget for the gesture's duration — see
 * that constant's comment for why the drag moment specifically needs its
 * own, lower ceiling. Callers re-invoke this at drag start/end (interaction
 * mode flipping), not per frame, so this only reallocates each backing
 * store twice per gesture, never continuously.
 */
export function applyCanvasPixelBudget(stage, { dragging = false } = {}) {
  if (!stage) {
    return null;
  }

  if (!isMobileDevice()) {
    return null;
  }

  const width = Number(stage.width());
  const height = Number(stage.height());

  if (!(width > 0) || !(height > 0)) {
    return null;
  }

  const sceneRatio = calculateSafePixelRatio(
    width,
    height,
    dragging ? MOBILE_DRAG_MAX_SCENE_PIXELS : MOBILE_MAX_SCENE_PIXELS
  );

  const hitRatio = Math.min(
    dragging ? MOBILE_DRAG_HIT_PIXEL_RATIO : MOBILE_HIT_PIXEL_RATIO,
    sceneRatio
  );

  const layers = stage.getLayers?.() || [];

  for (const layer of layers) {
    if (!layer || layer.isDestroyed?.()) {
      continue;
    }

    const sceneCanvas = layer.getCanvas?.();
    const hitCanvas = layer.getHitCanvas?.();

    let changed = false;

    /*
     * Scene canvas
     */
    if (
      sceneCanvas &&
      typeof sceneCanvas.setPixelRatio === "function"
    ) {
      const current =
        sceneCanvas.getPixelRatio?.();

      if (
        !Number.isFinite(current) ||
        Math.abs(current - sceneRatio) > 0.01
      ) {
        sceneCanvas.setPixelRatio(sceneRatio);
        changed = true;
      }
    }

    /*
     * Hit canvas
     */
    if (
      hitCanvas &&
      typeof hitCanvas.setPixelRatio === "function"
    ) {
      const current =
        hitCanvas.getPixelRatio?.();

      if (
        !Number.isFinite(current) ||
        Math.abs(current - hitRatio) > 0.01
      ) {
        hitCanvas.setPixelRatio(hitRatio);
        changed = true;
      }
    }

    /*
     * Only redraw when something actually changed.
     */
    if (changed) {
      layer.batchDraw?.();
    }
  }

  return sceneRatio;
}


/* =========================================================
   KONVA CACHE SAFETY
   ========================================================= */

/**
 * Pixel ratio for node.cache().
 *
 * Example:
 *
 * node.cache({
 *   pixelRatio: getSafeCachePixelRatio(
 *     node.width(),
 *     node.height()
 *   )
 * });
 */
export function getSafeCachePixelRatio(
  width,
  height
) {
  if (!isMobileDevice()) {
    return undefined;
  }

  if (!(width > 0) || !(height > 0)) {
    return 1;
  }

  const dpr = getDevicePixelRatio();

  const area = width * height;

  if (!Number.isFinite(area) || area <= 0) {
    return 1;
  }

  const fittingRatio = Math.sqrt(
    MOBILE_MAX_CACHE_PIXELS / area
  );

  return Math.min(
    dpr,
    Math.max(
      MIN_CACHE_PIXEL_RATIO,
      fittingRatio
    )
  );
}


/* =========================================================
   SAFE CACHE WRAPPER
   ========================================================= */

/**
 * Safer way to cache Konva nodes.
 */
export function safeCacheNode(node, options = {}) {
  if (!node || node.isDestroyed?.()) {
    return false;
  }

  try {
    const rect = node.getClientRect?.({
      skipTransform: true,
      skipShadow: true,
      skipStroke: false
    });

    const width =
      Math.abs(rect?.width || node.width?.() || 0);

    const height =
      Math.abs(rect?.height || node.height?.() || 0);

    if (!(width > 0) || !(height > 0)) {
      return false;
    }

    const pixelRatio =
      getSafeCachePixelRatio(width, height);

    node.clearCache?.();

    node.cache({
      ...options,

      ...(pixelRatio !== undefined
        ? { pixelRatio }
        : {})
    });

    return true;
  } catch (error) {
    console.warn(
      "[CanvasSafety] Failed to cache node:",
      error
    );

    try {
      node.clearCache?.();
    } catch {
      // Ignore cleanup failure
    }

    return false;
  }
}


/* =========================================================
   IMAGE DOWNSCALING
   ========================================================= */

/**
 * Shared math: given an image's real natural dimensions, what size should
 * it be decoded/redrawn at on mobile? Returns null when it's already
 * within budget (caller should use the original, untouched). Split out of
 * downscaleForMobile so computeMobileDownscaleTarget can also be used
 * BEFORE a full decode happens (see useImageElement.js's createImageBitmap
 * path) — asset metadata already carries natural width/height (recorded
 * at upload time), so the safe target size is knowable up front, without
 * ever materializing the full-resolution bitmap just to measure it.
 */
export function computeMobileDownscaleTarget(width, height) {
  if (!(width > 0) || !(height > 0)) {
    return null;
  }

  const totalPixels = width * height;

  const sideScale =
    MOBILE_MAX_IMAGE_SIDE /
    Math.max(width, height);

  const areaScale =
    Math.sqrt(
      MOBILE_MAX_IMAGE_PIXELS /
      totalPixels
    );

  const scale = Math.min(
    1,
    sideScale,
    areaScale
  );

  // Already safe
  if (scale >= 0.999) {
    return null;
  }

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Shrinks oversized images before they become editor working
 * images.
 *
 * IMPORTANT:
 * Stored/original uploaded asset remains untouched.
 */
export function downscaleForMobile(img) {
  if (!img) {
    return img;
  }

  if (!isMobileDevice()) {
    return img;
  }

  const width =
    img.naturalWidth ||
    img.videoWidth ||
    img.width ||
    0;

  const height =
    img.naturalHeight ||
    img.videoHeight ||
    img.height ||
    0;

  const target = computeMobileDownscaleTarget(width, height);

  // Already safe
  if (!target) {
    return img;
  }

  const { width: targetWidth, height: targetHeight } = target;

  let canvas;

  try {
    canvas =
      document.createElement("canvas");

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext(
      "2d",
      {
        alpha: true,
        willReadFrequently: false
      }
    );

    if (!ctx) {
      return img;
    }

    /*
     * Scaling quality. Phones get "medium": a lighter/faster resample
     * than "high" for a one-time decode that already targets a smaller
     * MOBILE_MAX_IMAGE_SIDE/PIXELS budget, so the extra sharpness "high"
     * buys isn't worth its CPU cost on underpowered hardware.
     */
    ctx.imageSmoothingEnabled = true;

    if ("imageSmoothingQuality" in ctx) {
      ctx.imageSmoothingQuality = "medium";
    }

    ctx.drawImage(
      img,
      0,
      0,
      targetWidth,
      targetHeight
    );

    return canvas;

  } catch (error) {
    console.warn(
      "[CanvasSafety] Image downscale failed:",
      error
    );

    /*
     * Release partially-created backing store.
     */
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
    }

    return img;
  }
}


/* =========================================================
   RELEASE TEMPORARY CANVAS
   ========================================================= */

/**
 * Call this when you KNOW a temporary canvas is no longer
 * being used.
 *
 * Never call it while Konva still references the canvas.
 */
export function releaseCanvas(canvas) {
  if (!canvas) {
    return;
  }

  try {
    const ctx = canvas.getContext?.("2d");

    if (ctx) {
      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );
    }

    canvas.width = 1;
    canvas.height = 1;

  } catch {
    // Cleanup should never crash the editor.
  }
}


/* =========================================================
   MEMORY ESTIMATION
   ========================================================= */

/**
 * Debug helper.
 *
 * Gives an approximate backing-store memory cost.
 */
export function estimateCanvasMemory(
  width,
  height,
  pixelRatio = 1
) {
  const pixels =
    width *
    height *
    pixelRatio *
    pixelRatio;

  const bytes = pixels * 4;

  return {
    pixels,

    bytes,

    megabytes:
      bytes / 1024 / 1024
  };
}


/* =========================================================
   DEBUG INFORMATION
   ========================================================= */

export function getCanvasSafetyInfo(
  width,
  height
) {
  const dpr = getDevicePixelRatio();

  const safeRatio =
    calculateSafePixelRatio(
      width,
      height
    );

  return {
    mobile: isMobileDevice(),

    ios: isIOSWebKit(),

    android: isAndroid(),

    devicePixelRatio: dpr,

    width,

    height,

    safePixelRatio: safeRatio,

    nativeMemory:
      estimateCanvasMemory(
        width,
        height,
        dpr
      ),

    safeMemory:
      estimateCanvasMemory(
        width,
        height,
        safeRatio
      )
  };
}
