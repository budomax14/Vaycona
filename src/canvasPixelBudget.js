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

// Apple's documented canvas ceiling is 16,777,216 px; stay just under it.
export const IOS_MAX_CANVAS_PIXELS = 16_000_000;

// Below this the scene turns visibly soft; a page that still doesn't fit
// keeps drawing (blurry beats blank).
const MIN_PIXEL_RATIO = 0.5;

export function isIOSWebKit() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  // iPadOS 13+ reports itself as a Mac; the touch points give it away.
  return /Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1;
}

// Returns the pixelRatio Konva canvases of the given CSS size should use, or
// null when the platform default (devicePixelRatio) is fine and nothing
// should be touched — which is always the case off iOS, so desktop and
// Android rendering are untouched.
export function getSafePixelRatio(cssWidth, cssHeight, { limited = isIOSWebKit(), maxPixels = IOS_MAX_CANVAS_PIXELS } = {}) {
  if (!limited || !(cssWidth > 0) || !(cssHeight > 0)) return null;
  const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
  const fitting = Math.sqrt(maxPixels / (cssWidth * cssHeight));
  if (fitting >= dpr) return null;
  return Math.max(MIN_PIXEL_RATIO, fitting);
}

// Applies the budget to every layer of a Konva Stage (scene canvas + hit
// canvas — the hit canvas is normally ratio 1 but is over budget by itself on
// very large pages). Idempotent; safe to call after every Stage resize.
// Returns the ratio applied to the scene canvases, or null if untouched.
export function applyCanvasPixelBudget(stage) {
  if (!stage) return null;
  const cssWidth = stage.width();
  const cssHeight = stage.height();
  const ratio = getSafePixelRatio(cssWidth, cssHeight);
  stage.getLayers().forEach((layer) => {
    let changed = false;
    const scene = layer.getCanvas();
    const hit = layer.getHitCanvas();
    if (ratio !== null) {
      if (scene.getPixelRatio() !== ratio) {
        scene.setPixelRatio(ratio);
        changed = true;
      }
      const hitRatio = Math.min(1, ratio);
      if (hit.getPixelRatio() !== hitRatio) {
        hit.setPixelRatio(hitRatio);
        changed = true;
      }
    }
    if (changed) layer.batchDraw();
  });
  return ratio;
}
