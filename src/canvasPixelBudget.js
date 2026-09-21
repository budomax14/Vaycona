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
export const IOS_MAX_CANVAS_PIXELS = 4_000_000;

// The hit canvas only needs to be finger-accurate: at phone zoom one Stage
// pixel is well under a CSS pixel, so half resolution is still far finer
// than a touch. It is redrawn alongside the scene on every drag frame.
const IOS_HIT_PIXEL_RATIO = 0.5;

// Node.cache() canvases (image filters, fade, 3D text) and decoded photos
// get their own, smaller budgets — several can be alive at once.
export const IOS_MAX_CACHE_PIXELS = 4_000_000;
export const IOS_MAX_IMAGE_PIXELS = 6_000_000;
export const IOS_MAX_IMAGE_SIDE = 2560;

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
      const hitRatio = Math.min(IOS_HIT_PIXEL_RATIO, ratio);
      if (hit.getPixelRatio() !== hitRatio) {
        hit.setPixelRatio(hitRatio);
        changed = true;
      }
    }
    if (changed) layer.batchDraw();
  });
  return ratio;
}

// pixelRatio to pass to node.cache() for a cache of the given local size, or
// undefined (Konva's default) off iOS. Konva's default is devicePixelRatio
// (3 on iPhone), which makes a full-page image's filter cache ~9x its area.
export function getSafeCachePixelRatio(width, height) {
  if (!isIOSWebKit() || !(width > 0) || !(height > 0)) return undefined;
  const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
  const fitting = Math.sqrt(IOS_MAX_CACHE_PIXELS / (width * height));
  return Math.max(MIN_PIXEL_RATIO, Math.min(dpr, fitting));
}

// Photos straight off an iPhone are 12-48MP; decoded that is 48-192MB each,
// and flipping one copies it again. On iOS, redraw an oversized image into a
// smaller canvas (aspect preserved) and let the original decode be freed.
// Returns the original image when it is already small enough or off iOS.
// Only the editor's working copy shrinks; the stored asset is untouched.
export function downscaleForIOS(img) {
  if (!isIOSWebKit()) return img;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return img;
  const scale = Math.min(1, IOS_MAX_IMAGE_SIDE / Math.max(w, h), Math.sqrt(IOS_MAX_IMAGE_PIXELS / (w * h)));
  if (scale >= 1) return img;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return img;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}
