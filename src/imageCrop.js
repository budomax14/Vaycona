// Unified crop/fit model shared by standalone image items and frame
// content (Phase 6). Replaces two previously-incompatible shapes (image's
// {top,right,bottom,left} percentage insets; frame's unused {x,y,scale}).
//
// Focal point + zoom (not a pixel offset) is what stays stable across a
// Transformer resize: the same normalized fractions reproduce the same
// visual crop regardless of the object's current width/height.
export const DEFAULT_CROP = {
  // "stretch" (draw the whole image, scaled independently to the box —
  // never crops, may distort) is the default rather than "fill"/cover:
  // once a plain corner-drag resize is unconstrained-by-default (see
  // App.jsx's Transformer keepRatio), "fill" would silently crop content
  // out of view the moment the box's aspect ratio no longer matches the
  // image's — which read as "part of the image disappeared" for a totally
  // ordinary resize. "fill"/"fit" (cover/contain, both crop-or-letterbox
  // by design) stay available as deliberate choices via the Crop tool.
  fit: "stretch",
  // "tile" | "original" are reserved fields — fall back to "fill"
  // rendering (see computeCropLayout) until a future pass implements them,
  // per the "do not implement unless straightforward" guidance.
  focalX: 0.5, // normalized 0..1 — source point kept centered in the box
  focalY: 0.5,
  zoom: 1, // >=1, multiplies the baseline cover/contain scale
};

const IMPLEMENTED_FITS = new Set(["fill", "fit", "stretch"]);

export function normalizeCrop(crop) {
  if (!crop || typeof crop !== "object") return { ...DEFAULT_CROP };
  const fit = IMPLEMENTED_FITS.has(crop.fit) ? crop.fit : "fill";
  const clamp01 = (v) => Math.max(0, Math.min(1, typeof v === "number" && Number.isFinite(v) ? v : 0.5));
  return {
    fit,
    focalX: clamp01(crop.focalX),
    focalY: clamp01(crop.focalY),
    zoom: Math.max(1, typeof crop.zoom === "number" && Number.isFinite(crop.zoom) ? crop.zoom : 1),
  };
}

// ASPECT_PRESETS: named ratio (width/height) options for the crop UI.
export const ASPECT_PRESETS = [
  { key: "free", label: "Free", ratio: null },
  { key: "original", label: "Original", ratio: "original" },
  { key: "square", label: "Square", ratio: 1 },
  { key: "4:5", label: "4:5", ratio: 4 / 5 },
  { key: "5:4", label: "5:4", ratio: 5 / 4 },
  { key: "3:2", label: "3:2", ratio: 3 / 2 },
  { key: "2:3", label: "2:3", ratio: 2 / 3 },
  { key: "16:9", label: "16:9", ratio: 16 / 9 },
  { key: "9:16", label: "9:16", ratio: 9 / 16 },
];

// Computes how to draw a naturalWidth x naturalHeight source image inside a
// boxWidth x boxHeight box for the given crop state. Returns a discriminated
// result because Konva's native <Image crop={x,y,width,height}> prop always
// stretches the crop rect to fill width/height (a "cover" operation) and
// can't express "contain" directly.
export function computeCropLayout(crop, naturalWidth, naturalHeight, boxWidth, boxHeight) {
  const c = normalizeCrop(crop);
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
// during a crop-mode drag, returns the new focalX/focalY that keeps the
// same visual drag direction correct for whichever fit mode is active
// (the display-scale factor differs between "fill"'s crop-rect and
// "fit"'s draw size, but the resulting formula has the same shape either
// way — see computeCropLayout for how each mode derives its scale).
export function dragToFocalPoint(crop, layout, naturalWidth, naturalHeight, boxWidth, boxHeight, dxContent, dyContent) {
  const c = normalizeCrop(crop);
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

// Legacy migration: converts the old image-only {top,right,bottom,left}
// percentage-inset crop into an equivalent {fit:"fill", focalX, focalY,
// zoom}. Approximate (a rectangular inset doesn't perfectly correspond to
// a centered zoom for non-square insets) but non-destructive — documented
// the same way Phase 5 documented its group-migration z-order shuffle.
export function legacyInsetsToCrop(insets) {
  if (!insets || typeof insets !== "object") return { ...DEFAULT_CROP };
  const top = Math.max(0, Math.min(49, insets.top || 0));
  const right = Math.max(0, Math.min(49, insets.right || 0));
  const bottom = Math.max(0, Math.min(49, insets.bottom || 0));
  const left = Math.max(0, Math.min(49, insets.left || 0));
  const keptWidthFrac = 1 - (left + right) / 100;
  const keptHeightFrac = 1 - (top + bottom) / 100;
  const focalX = (left + (100 - left - right) / 2) / 100;
  const focalY = (top + (100 - top - bottom) / 2) / 100;
  const zoom = Math.max(1, 1 / Math.max(0.01, Math.min(keptWidthFrac, keptHeightFrac)));
  return { fit: "fill", focalX, focalY, zoom };
}
