// Two independent crop models live in this file:
//
// 1. The RECT model (DEFAULT_CROP/normalizeCrop/computeCropRect/...) —
//    item.crop's shape for standalone `image` items. An axis-aligned
//    rectangle in normalized (0..1) source-image space: the region of the
//    source image that's kept. Apple Photos-style — any edge/corner is
//    independently draggable, no zoom/focal-point/fit-mode concepts. The
//    object's own box is resized to match whenever the crop tool commits,
//    so what you see while dragging is exactly what you get.
//
// 2. The LEGACY FOCAL model (normalizeFocalCrop/computeCropLayout/
//    dragToFocalPoint/DEFAULT_FOCAL_CROP) — kept for two other features
//    that still need it and were never part of this request:
//      - `frame.crop` (frame content): a decorative frame's content window
//        has a fixed shape (e.g. a circle) with no independent "edges" to
//        drag, so it keeps the original pan-to-reposition/zoom interaction.
//      - Image Fill for shapes/text (imageFill.js's `item.fillImage`,
//        an entirely separate field) — deliberately reuses this exact
//        cover/contain math.
//    Focal point + zoom (not a pixel offset) is what stays stable across a
//    Transformer resize: the same normalized fractions reproduce the same
//    visual crop regardless of the object's current width/height.

const IMPLEMENTED_FITS = new Set(["fill", "fit", "stretch"]);

export const DEFAULT_FOCAL_CROP = {
  // "stretch" (draw the whole image, scaled independently to the box —
  // never crops, may distort) is the default rather than "fill"/cover:
  // once a plain corner-drag resize is unconstrained-by-default (see
  // App.jsx's Transformer keepRatio), "fill" would silently crop content
  // out of view the moment the box's aspect ratio no longer matches the
  // image's — which read as "part of the image disappeared" for a totally
  // ordinary resize. "fill"/"fit" (cover/contain, both crop-or-letterbox
  // by design) stay available as deliberate choices.
  fit: "stretch",
  focalX: 0.5, // normalized 0..1 — source point kept centered in the box
  focalY: 0.5,
  zoom: 1, // >=1, multiplies the baseline cover/contain scale
};

export function normalizeFocalCrop(crop) {
  if (!crop || typeof crop !== "object") return { ...DEFAULT_FOCAL_CROP };
  const fit = IMPLEMENTED_FITS.has(crop.fit) ? crop.fit : "fill";
  const clamp01 = (v) => Math.max(0, Math.min(1, typeof v === "number" && Number.isFinite(v) ? v : 0.5));
  return {
    fit,
    focalX: clamp01(crop.focalX),
    focalY: clamp01(crop.focalY),
    zoom: Math.max(1, typeof crop.zoom === "number" && Number.isFinite(crop.zoom) ? crop.zoom : 1),
  };
}

// Computes how to draw a naturalWidth x naturalHeight source image inside a
// boxWidth x boxHeight box for the given focal crop state. Returns a
// discriminated result because Konva's native <Image crop={x,y,width,height}>
// prop always stretches the crop rect to fill width/height (a "cover"
// operation) and can't express "contain" directly.
export function computeCropLayout(crop, naturalWidth, naturalHeight, boxWidth, boxHeight) {
  const c = normalizeFocalCrop(crop);
  if (!naturalWidth || !naturalHeight || !boxWidth || !boxHeight) {
    return { mode: "crop", cropRect: { x: 0, y: 0, width: naturalWidth || 1, height: naturalHeight || 1 } };
  }

  if (c.fit === "stretch") {
    // No cropRect at all — the caller draws the whole source image at
    // width=boxWidth/height=boxHeight directly, so Konva's own
    // ctx.drawImage(image, 0, 0, w, h) stretches independently per axis.
    // Zoom/focal point don't apply here (there's no excess to pan around
    // in — the entire image is always fully visible by construction).
    return { mode: "stretch" };
  }

  if (c.fit === "fit") {
    const baseScale = Math.min(boxWidth / naturalWidth, boxHeight / naturalHeight);
    const scale = baseScale * c.zoom;
    const drawWidth = naturalWidth * scale;
    const drawHeight = naturalHeight * scale;
    // Center on the focal point, then clamp so the image can't be dragged
    // fully out of the box (keeps at least the box visible when zoomed).
    const idealOffsetX = boxWidth / 2 - c.focalX * drawWidth;
    const idealOffsetY = boxHeight / 2 - c.focalY * drawHeight;
    const minOffsetX = Math.min(0, boxWidth - drawWidth);
    const minOffsetY = Math.min(0, boxHeight - drawHeight);
    const offsetX = Math.max(minOffsetX, Math.min(0, idealOffsetX));
    const offsetY = Math.max(minOffsetY, Math.min(0, idealOffsetY));
    return { mode: "contain", drawWidth, drawHeight, offsetX, offsetY };
  }

  // "fill" (cover) — and the reserved tile/original fall back here.
  const boxAspect = boxWidth / boxHeight;
  const naturalAspect = naturalWidth / naturalHeight;
  let baseCropWidth;
  let baseCropHeight;
  if (naturalAspect > boxAspect) {
    baseCropHeight = naturalHeight;
    baseCropWidth = naturalHeight * boxAspect;
  } else {
    baseCropWidth = naturalWidth;
    baseCropHeight = naturalWidth / boxAspect;
  }
  const cropWidth = Math.min(naturalWidth, baseCropWidth / c.zoom);
  const cropHeight = Math.min(naturalHeight, baseCropHeight / c.zoom);
  const idealX = c.focalX * naturalWidth - cropWidth / 2;
  const idealY = c.focalY * naturalHeight - cropHeight / 2;
  const x = Math.max(0, Math.min(naturalWidth - cropWidth, idealX));
  const y = Math.max(0, Math.min(naturalHeight - cropHeight, idealY));
  return { mode: "crop", cropRect: { x, y, width: cropWidth, height: cropHeight } };
}

// Given a content-space pointer delta (dxContent, dyContent — already
// divided by viewport.scale, so these are page/content px, not screen px)
// during a focal-crop drag, returns the new focalX/focalY that keeps the
// same visual drag direction correct for whichever fit mode is active
// (the display-scale factor differs between "fill"'s crop-rect and
// "fit"'s draw size, but the resulting formula has the same shape either
// way — see computeCropLayout for how each mode derives its scale).
export function dragToFocalPoint(crop, layout, naturalWidth, naturalHeight, boxWidth, boxHeight, dxContent, dyContent) {
  const c = normalizeFocalCrop(crop);
  // "Content px per natural source px" — how far one natural-image pixel
  // moves on screen for the current layout. Fill/crop mode stretches
  // cropRect (natural px) to fill the box; contain/fit mode scales the
  // whole natural image down to drawWidth/drawHeight.
  const displayScaleX = layout.mode === "contain" ? layout.drawWidth / naturalWidth : boxWidth / layout.cropRect.width;
  const displayScaleY = layout.mode === "contain" ? layout.drawHeight / naturalHeight : boxHeight / layout.cropRect.height;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  return {
    ...c,
    focalX: clamp01(c.focalX - dxContent / (naturalWidth * displayScaleX)),
    focalY: clamp01(c.focalY - dyContent / (naturalHeight * displayScaleY)),
  };
}

// ===========================================================================
// Rect crop model — item.crop's shape for standalone `image` items.
// ===========================================================================

export const DEFAULT_CROP = { x: 0, y: 0, width: 1, height: 1 };

// Smallest crop rect edge, as a fraction of the natural image size —
// mirrors the old model's MIN_BOX_SIZE, just expressed resolution-
// independently since there's no fixed box to measure pixels against here.
export const MIN_CROP_FRACTION = 0.05;

export function normalizeCrop(crop) {
  if (!crop || typeof crop !== "object" || typeof crop.width !== "number") return { ...DEFAULT_CROP };
  const clamp01 = (v) => Math.max(0, Math.min(1, typeof v === "number" && Number.isFinite(v) ? v : 0));
  const x = clamp01(crop.x);
  const y = clamp01(crop.y);
  const width = Math.max(MIN_CROP_FRACTION, Math.min(1 - x, Number.isFinite(crop.width) ? crop.width : 1));
  const height = Math.max(MIN_CROP_FRACTION, Math.min(1 - y, Number.isFinite(crop.height) ? crop.height : 1));
  return { x, y, width, height };
}

// ASPECT_PRESETS: named ratio (width/height) options for the crop UI.
export const ASPECT_PRESETS = [
  { key: "original", label: "Original", ratio: "original" },
  { key: "square", label: "Square", ratio: 1 },
  { key: "4:5", label: "4:5", ratio: 4 / 5 },
  { key: "5:4", label: "5:4", ratio: 5 / 4 },
  { key: "3:2", label: "3:2", ratio: 3 / 2 },
  { key: "2:3", label: "2:3", ratio: 2 / 3 },
  { key: "16:9", label: "16:9", ratio: 16 / 9 },
  { key: "9:16", label: "9:16", ratio: 9 / 16 },
];

// Maps a normalized crop rect onto natural source-image pixels — this is
// exactly what Konva's <Image crop={x,y,width,height}> prop wants, and
// Konva always stretches that rect to fill whatever width/height the
// <Image> itself is drawn at (so an undistorted result depends on the
// object's own box being kept in sync with the crop's aspect ratio — see
// cropToBox below, which the crop tool uses for exactly that).
export function computeCropRect(crop, naturalWidth, naturalHeight) {
  const c = normalizeCrop(crop);
  if (!naturalWidth || !naturalHeight) return { x: 0, y: 0, width: naturalWidth || 1, height: naturalHeight || 1 };
  return {
    x: c.x * naturalWidth,
    y: c.y * naturalHeight,
    width: c.width * naturalWidth,
    height: c.height * naturalHeight,
  };
}

// The largest crop rect of the given aspect ratio (width/height) centered
// within the full source image — what each aspect-preset button jumps to.
// `ratio` of `null`/non-finite is a no-op sentinel ("Free"); callers should
// check before calling.
export function largestCropRectForAspect(ratio) {
  if (!ratio || !Number.isFinite(ratio)) return { ...DEFAULT_CROP };
  let width = 1;
  let height = ratio > 0 ? width / ratio : 1;
  if (height > 1) {
    height = 1;
    width = height * ratio;
  }
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
}

// Maps a fixed "where the full, uncropped image is displayed" content-space
// rect (established once at crop-mode entry — see App.jsx's enterCropMode —
// and held constant so the image never visually moves while cropping) plus
// a normalized crop rect, to the object's own box in that same content
// space. The inverse of boxToCrop below.
export function cropToBox(crop, imageDisplayRect) {
  const c = normalizeCrop(crop);
  return {
    x: imageDisplayRect.x + c.x * imageDisplayRect.width,
    y: imageDisplayRect.y + c.y * imageDisplayRect.height,
    width: c.width * imageDisplayRect.width,
    height: c.height * imageDisplayRect.height,
  };
}

// Inverse of cropToBox — recovers the normalized crop rect that would
// reproduce the given box within the fixed imageDisplayRect, clamped to
// stay within the source image's own [0,1] bounds (dragging a handle past
// the image's own edge just stops at that edge, like Apple's crop tool).
export function boxToCrop(box, imageDisplayRect) {
  const rawX = (box.x - imageDisplayRect.x) / imageDisplayRect.width;
  const rawY = (box.y - imageDisplayRect.y) / imageDisplayRect.height;
  const rawWidth = box.width / imageDisplayRect.width;
  const rawHeight = box.height / imageDisplayRect.height;
  const x = Math.max(0, Math.min(1, rawX));
  const y = Math.max(0, Math.min(1, rawY));
  const width = Math.max(MIN_CROP_FRACTION, Math.min(1 - x, rawWidth));
  const height = Math.max(MIN_CROP_FRACTION, Math.min(1 - y, rawHeight));
  return { x, y, width, height };
}

// Reconstructs the fixed "full uncropped image" content-space rect from an
// item's CURRENT box + crop — i.e. the inverse problem cropToBox solves,
// used once at crop-mode entry so opening the tool never causes a visual
// jump: the sub-rect this produces, mapped back through cropToBox with the
// item's existing crop, reproduces the item's existing box exactly.
export function deriveImageDisplayRect(box, crop) {
  const c = normalizeCrop(crop);
  const width = box.width / c.width;
  const height = box.height / c.height;
  return {
    x: box.x - c.x * width,
    y: box.y - c.y * height,
    width,
    height,
  };
}

// Shrinks/grows a normalized crop rect around its own center by `factor`
// (factor<1 shrinks = a tighter, more "zoomed-in" framing; factor>1 grows),
// clamped to stay within the source image's [0,1] bounds. Used by the Ken
// Burns cropZoomIn/cropZoomOut/cropPan presets (animationService.js).
export function scaleCropRect(crop, factor) {
  const r = normalizeCrop(crop);
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const width = Math.min(1, Math.max(MIN_CROP_FRACTION, r.width * factor));
  const height = Math.min(1, Math.max(MIN_CROP_FRACTION, r.height * factor));
  return {
    x: Math.min(1 - width, Math.max(0, cx - width / 2)),
    y: Math.min(1 - height, Math.max(0, cy - height / 2)),
    width,
    height,
  };
}

// Slides a normalized crop rect to one end of its legal range along one
// axis (t=0 -> flush with the start edge of the source image, t=1 -> flush
// with the end edge), keeping its current size. Used by the Ken Burns
// cropPan preset to derive the pan's start/end rects.
export function panCropRect(crop, axis, t) {
  const r = normalizeCrop(crop);
  const size = axis === "y" ? r.height : r.width;
  const pos = Math.min(1 - size, Math.max(0, t * (1 - size)));
  return axis === "y" ? { ...r, y: pos } : { ...r, x: pos };
}

// Legacy migration: converts the old image-only {top,right,bottom,left}
// percentage-inset crop directly into the rect model — insets are already
// axis-aligned percentages, so this needs no box/aspect information at all.
export function legacyInsetsToCropRect(insets) {
  if (!insets || typeof insets !== "object") return { ...DEFAULT_CROP };
  const top = Math.max(0, Math.min(49, insets.top || 0)) / 100;
  const right = Math.max(0, Math.min(49, insets.right || 0)) / 100;
  const bottom = Math.max(0, Math.min(49, insets.bottom || 0)) / 100;
  const left = Math.max(0, Math.min(49, insets.left || 0)) / 100;
  return normalizeCrop({ x: left, y: top, width: Math.max(0.01, 1 - left - right), height: Math.max(0.01, 1 - top - bottom) });
}

// Legacy migration: converts a previously-saved focal-crop image (the
// {fit, focalX, focalY, zoom} shape this file used before the Apple-style
// rect tool) into an equivalent rect. "stretch"/"fit" never actually
// removed any source pixels (they scale/letterbox, not crop) so the exact
// equivalent is simply the full, uncropped image; only "fill" (cover)
// needs real conversion, reusing computeCropLayout's own cover-crop math
// via the box's aspect ratio so the visual result carries over exactly.
export function legacyFocalCropToRect(crop, boxWidth, boxHeight, naturalWidth, naturalHeight) {
  const c = normalizeFocalCrop(crop);
  if (c.fit !== "fill" || !boxWidth || !boxHeight || !naturalWidth || !naturalHeight) return { ...DEFAULT_CROP };
  const layout = computeCropLayout(c, naturalWidth, naturalHeight, boxWidth, boxHeight);
  if (layout.mode !== "crop") return { ...DEFAULT_CROP };
  return normalizeCrop({
    x: layout.cropRect.x / naturalWidth,
    y: layout.cropRect.y / naturalHeight,
    width: layout.cropRect.width / naturalWidth,
    height: layout.cropRect.height / naturalHeight,
  });
}
