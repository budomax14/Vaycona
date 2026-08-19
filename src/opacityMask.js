// Partial Opacity / Fade (opacity mask). Non-destructive, per-item gradient
// transparency — separate from and composable with the existing whole-
// element `item.opacity` (see objectRegistry.js/DesignNode.jsx). Modeled on
// imageCrop.js/imageEffects.js's own "defaults + normalize + pure math"
// shape: this module owns the descriptor and the actual per-pixel filter;
// callers (useImageFilters.js) just plug the resulting filter function into
// the same Konva cache()+filters() pipeline image adjustments already use.
//
// Coordinates are normalized 0..1 over the ITEM's own box (not the
// natural image, not whichever Konva node ends up cached) — see
// resolveMaskGeometry below for why a caller-supplied geometry mapping is
// required to translate that into whatever sub-region actually gets cached
// (e.g. an ImageNode in "fit" mode caches an inner node smaller than the
// full item box).
export const DEFAULT_OPACITY_MASK = {
  enabled: false,
  type: "linear", // "linear" | "radial"
  start: { x: 0, y: 0.5 },
  end: { x: 1, y: 0.5 },
  center: { x: 0.5, y: 0.5 },
  radius: 0.5, // normalized to the shorter of item width/height
  startOpacity: 1,
  endOpacity: 0,
  reverse: false,
};

// Canned start/end pairs for the Direction dropdown — plain data, not a
// distinct code path: dragging the on-canvas handles (FadeOverlay.jsx)
// produces the exact same {start,end} shape for any custom angle, these
// are just convenient presets.
export const LINEAR_DIRECTION_PRESETS = [
  { key: "left-right", label: "Left → Right", start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } },
  { key: "right-left", label: "Right → Left", start: { x: 1, y: 0.5 }, end: { x: 0, y: 0.5 } },
  { key: "top-bottom", label: "Top → Bottom", start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
  { key: "bottom-top", label: "Bottom → Top", start: { x: 0.5, y: 1 }, end: { x: 0.5, y: 0 } },
];

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function clamp01(v) {
  return Math.max(0, Math.min(1, isFiniteNumber(v) ? v : 0));
}

function normalizePoint(point, fallback) {
  if (!point || typeof point !== "object") return { ...fallback };
  return { x: clamp01(point.x ?? fallback.x), y: clamp01(point.y ?? fallback.y) };
}

export function normalizeOpacityMask(mask) {
  if (!mask || typeof mask !== "object") return { ...DEFAULT_OPACITY_MASK };
  const type = mask.type === "radial" ? "radial" : "linear";
  return {
    enabled: !!mask.enabled,
    type,
    start: normalizePoint(mask.start, DEFAULT_OPACITY_MASK.start),
    end: normalizePoint(mask.end, DEFAULT_OPACITY_MASK.end),
    center: normalizePoint(mask.center, DEFAULT_OPACITY_MASK.center),
    radius: Math.max(0.01, isFiniteNumber(mask.radius) ? mask.radius : DEFAULT_OPACITY_MASK.radius),
    startOpacity: clamp01(mask.startOpacity ?? DEFAULT_OPACITY_MASK.startOpacity),
    endOpacity: clamp01(mask.endOpacity ?? DEFAULT_OPACITY_MASK.endOpacity),
    reverse: !!mask.reverse,
  };
}

export function hasActiveOpacityMask(mask) {
  return !!mask?.enabled && (mask.type === "linear" || mask.type === "radial" || !mask.type);
}

// Identity mapping — the cached node's own local pixel box IS the item's
// full box (true for shapes, and for ImageNode/FrameNode whenever the
// image layout is "crop" or "stretch", i.e. it already spans 0..item.width/
// height with no letterboxing offset).
export const IDENTITY_MASK_GEOMETRY = { itemWidth: 1, itemHeight: 1, offsetXFrac: 0, offsetYFrac: 0, scaleXFrac: 1, scaleYFrac: 1 };

// Builds the {itemWidth, itemHeight, offsetXFrac, offsetYFrac, scaleXFrac,
// scaleYFrac} geometry a cached SUB-region needs so the filter can map its
// own local pixel (0..cacheWidth, 0..cacheHeight) back to the item's own
// normalized 0..1 mask space. `localBox` is in item-space px (the region
// actually being cached — e.g. ImageNode's "contain"/fit layout draws the
// image at {offsetX, offsetY, drawWidth, drawHeight} within the item box).
export function resolveMaskGeometry(itemWidth, itemHeight, localBox) {
  const w = Math.max(1, itemWidth || 1);
  const h = Math.max(1, itemHeight || 1);
  if (!localBox) return { itemWidth: w, itemHeight: h, offsetXFrac: 0, offsetYFrac: 0, scaleXFrac: 1, scaleYFrac: 1 };
  return {
    itemWidth: w,
    itemHeight: h,
    offsetXFrac: (localBox.x || 0) / w,
    offsetYFrac: (localBox.y || 0) / h,
    scaleXFrac: (localBox.width ?? w) / w,
    scaleYFrac: (localBox.height ?? h) / h,
  };
}

// The actual Konva filter — same `(imageData) => void` shape every filter
// in imageEffects.js uses, so it drops straight into node.filters([...]).
// Deliberately appended AFTER the color/blur filters in the pipeline (see
// useImageFilters.js) so blur/color adjustments are computed against full-
// opacity pixels first, then alpha is tapered on top — avoids a blurred
// filter smearing color into what should be fully transparent regions.
//
// Runs once per node.cache() (not per frame/drag-tick) at whatever pixel
// resolution the cache was rasterized at — geometry maps that local pixel
// grid back to the item's own normalized mask space (see resolveMaskGeometry).
export function buildOpacityMaskFilter(mask, geometry = IDENTITY_MASK_GEOMETRY) {
  const m = normalizeOpacityMask(mask);
  const { offsetXFrac, offsetYFrac, scaleXFrac, scaleYFrac, itemWidth, itemHeight } = geometry;
  const startOpacity = m.reverse ? m.endOpacity : m.startOpacity;
  const endOpacity = m.reverse ? m.startOpacity : m.endOpacity;

  if (m.type === "radial") {
    const cx = m.center.x;
    const cy = m.center.y;
    const shorter = Math.max(1, Math.min(itemWidth, itemHeight));
    const radiusPx = Math.max(1, m.radius * shorter);
    return function applyRadialFade(imageData) {
      const data = imageData.data;
      const w = imageData.width;
      const h = imageData.height;
      for (let y = 0; y < h; y++) {
        const itemY = offsetYFrac + ((y + 0.5) / h) * scaleYFrac;
        const dyPx = (itemY - cy) * itemHeight;
        for (let x = 0; x < w; x++) {
          const itemX = offsetXFrac + ((x + 0.5) / w) * scaleXFrac;
          const dxPx = (itemX - cx) * itemWidth;
          const t = Math.max(0, Math.min(1, Math.hypot(dxPx, dyPx) / radiusPx));
          const alpha = startOpacity + (endOpacity - startOpacity) * t;
          const idx = (y * w + x) * 4 + 3;
          data[idx] = data[idx] * alpha;
        }
      }
    };
  }

  // Linear — projects each pixel onto the start->end axis (in item px, so
  // a non-square item's gradient direction isn't skewed by aspect ratio).
  const startPx = { x: m.start.x * itemWidth, y: m.start.y * itemHeight };
  const endPx = { x: m.end.x * itemWidth, y: m.end.y * itemHeight };
  const dx = endPx.x - startPx.x;
  const dy = endPx.y - startPx.y;
  const lenSq = dx * dx + dy * dy || 1;
  return function applyLinearFade(imageData) {
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;
    for (let y = 0; y < h; y++) {
      const itemY = (offsetYFrac + ((y + 0.5) / h) * scaleYFrac) * itemHeight;
      for (let x = 0; x < w; x++) {
        const itemX = (offsetXFrac + ((x + 0.5) / w) * scaleXFrac) * itemWidth;
        const t = Math.max(0, Math.min(1, ((itemX - startPx.x) * dx + (itemY - startPx.y) * dy) / lenSq));
        const alpha = startOpacity + (endOpacity - startOpacity) * t;
        const idx = (y * w + x) * 4 + 3;
        data[idx] = data[idx] * alpha;
      }
    }
  };
}
