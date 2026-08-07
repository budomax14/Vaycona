// Image Fill for text — same "resolve a small serializable descriptor into
// renderer-specific fill attrs" idiom gradientFill.js already established
// for item.fillGradient. Reuses imageCrop.js's existing cover-fit math
// (computeCropLayout/dragToFocalPoint) rather than duplicating it: an
// image fill's {offsetX, offsetY, zoom} is exactly a crop's
// {focalX, focalY, zoom} with fit:"fill" (cover), just applied to a canvas
// fill pattern instead of a drawn <Image crop=.../> rect.
//
// `item.fillImage` shape: { assetId, zoom (>=1), offsetX/offsetY (0-1
// normalized focal point, stable across resizes), rotation (degrees),
// opacity (0-1), flipX, flipY }.
//
// Konva's Shape/Text fill pipeline already natively supports
// fillPatternImage/fillPatternX/Y/fillPatternScaleX/Y/fillPatternRotation/
// fillPatternOffsetX/Y (see node_modules/konva/lib/Shape.js's
// __getFillPattern, invoked from Text._sceneFunc via
// context.fillStrokeShape(this)) — so for SimpleTextNode this needs no
// manual masking/compositing, just resolved pattern attrs, exactly like
// resolveGradientKonvaProps resolves fillLinearGradient* attrs. The two
// hand-drawn renderers (RichTextNode, CurvedTextNode) get the same effect
// via a plain ctx.createPattern(...).setTransform(...) assigned to
// ctx.fillStyle, mirroring how they already build a CanvasGradient via
// createCanvasGradient.
import { computeCropLayout, dragToFocalPoint } from "./imageCrop";

export function defaultImageFill() {
  return { assetId: null, fit: "fill", zoom: 1, offsetX: 0.5, offsetY: 0.5, rotation: 0, opacity: 1, flipX: false, flipY: false };
}

export function normalizeImageFill(fillImage) {
  if (!fillImage || typeof fillImage !== "object") return defaultImageFill();
  const clamp01 = (v) => Math.max(0, Math.min(1, typeof v === "number" && Number.isFinite(v) ? v : 0.5));
  return {
    assetId: fillImage.assetId || null,
    // "fill" (cover, crop excess — the original/default behavior), "fit"
    // (contain — show the whole image, letterboxed inside the shape with
    // no cropping), or "stretch" (draw the whole image at the box's exact
    // width/height, independently per axis — may distort aspect ratio).
    // Same vocabulary as imageCrop.js's Crop tool — computeCropLayout
    // already implements "fit"'s contain math, computePatternMatrix below
    // just needs to translate its {mode:"contain"} result into pattern attrs.
    fit: fillImage.fit === "stretch" ? "stretch" : fillImage.fit === "fit" ? "fit" : "fill",
    zoom: Math.max(1, typeof fillImage.zoom === "number" && Number.isFinite(fillImage.zoom) ? fillImage.zoom : 1),
    offsetX: clamp01(fillImage.offsetX ?? 0.5),
    offsetY: clamp01(fillImage.offsetY ?? 0.5),
    rotation: typeof fillImage.rotation === "number" && Number.isFinite(fillImage.rotation) ? fillImage.rotation : 0,
    opacity: Math.max(0, Math.min(1, typeof fillImage.opacity === "number" && Number.isFinite(fillImage.opacity) ? fillImage.opacity : 1)),
    flipX: !!fillImage.flipX,
    flipY: !!fillImage.flipY,
  };
}

// Cover-fit crop rect (same "fill" math imageCrop.js's Crop tool already
// uses) — the box-drag/zoom interaction (ImageFillOverlay.jsx) reuses this
// directly so image fill's drag physics feel identical to the existing
// image-crop tool. In "stretch" mode this returns `{mode: "stretch"}` (no
// cropRect at all, see computeCropLayout) — computePatternMatrix's own
// `layout.cropRect || {x:0, y:0, width:naturalWidth, height:naturalHeight}`
// fallback already turns that into the correct independent-per-axis stretch
// transform with no further changes needed here.
export function computeImageFillLayout(fillImage, naturalWidth, naturalHeight, boxWidth, boxHeight) {
  const f = normalizeImageFill(fillImage);
  return computeCropLayout({ fit: f.fit, focalX: f.offsetX, focalY: f.offsetY, zoom: f.zoom }, naturalWidth, naturalHeight, boxWidth, boxHeight);
}

// Content-space pointer delta -> new {offsetX, offsetY} — thin wrapper over
// imageCrop.js's dragToFocalPoint (identical math, different field names).
// "stretch" mode has no excess to pan around in (the whole image always
// exactly fills the box by construction) and dragToFocalPoint's own math
// assumes a cropRect that stretch's layout never has, so this is a no-op
// for it rather than forwarding into that crash.
export function dragImageFillPosition(fillImage, layout, naturalWidth, naturalHeight, boxWidth, boxHeight, dxContent, dyContent) {
  const f = normalizeImageFill(fillImage);
  if (f.fit === "stretch") return f;
  const next = dragToFocalPoint(
    { fit: f.fit, focalX: f.offsetX, focalY: f.offsetY, zoom: f.zoom },
    layout,
    naturalWidth,
    naturalHeight,
    boxWidth,
    boxHeight,
    dxContent,
    dyContent
  );
  return { ...f, offsetX: next.focalX, offsetY: next.focalY };
}

// Only real per-pixel work in this module: pre-multiplies opacity into a
// small offscreen canvas so pattern opacity doesn't require re-drawing
// pixels on every drag/zoom frame (those only touch the transform matrix
// below). Cached per {image, opacity} — capped so undo/redo/duplicate
// churn across many objects can't grow this unbounded.
const preparedSourceCache = new Map();
const MAX_CACHE_ENTRIES = 24;

export function getPreparedFillSource(image, naturalWidth, naturalHeight, opacity) {
  if (!image || opacity >= 1) return image;
  const key = `${image.src || ""}|${opacity}`;
  const cached = preparedSourceCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, naturalWidth);
  canvas.height = Math.max(1, naturalHeight);
  const ctx = canvas.getContext("2d");
  ctx.globalAlpha = opacity;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  if (preparedSourceCache.size >= MAX_CACHE_ENTRIES) {
    preparedSourceCache.delete(preparedSourceCache.keys().next().value);
  }
  preparedSourceCache.set(key, canvas);
  return canvas;
}

// Pure transform math shared by both rendering paths below. Flip is
// expressed as a negative scale factor (not a separate baked-pixel pass —
// see getPreparedFillSource's comment) anchored at the crop rect's own
// center, so flipping never shifts the image's apparent position.
// patternX/patternY default to the box's own center — the same coordinate
// convention resolveGradientKonvaProps already uses (item.width/2,
// item.height/2) with no compensation for Konva Text's internal
// padding/verticalAlign translate, since that convention is already
// shipping correctly for gradient text fills in this app.
export function computePatternMatrix(fillImage, naturalWidth, naturalHeight, boxWidth, boxHeight) {
  const f = normalizeImageFill(fillImage);
  const layout = computeImageFillLayout(f, naturalWidth, naturalHeight, boxWidth, boxHeight);
  if (layout.mode === "contain") {
    // "fit" mode: computeCropLayout already picked a uniform scale + a
    // clamped top-left (drawWidth/drawHeight/offsetX/offsetY) so the whole
    // natural image lands somewhere inside the box with no cropping.
    // Anchor the pattern's own rotation/flip pivot at that drawn image's
    // center (not the box's center like fill/stretch below) so rotating a
    // letterboxed image spins it in place rather than around empty space.
    const { drawWidth, drawHeight, offsetX: boxOffsetX, offsetY: boxOffsetY } = layout;
    return {
      offsetX: naturalWidth / 2,
      offsetY: naturalHeight / 2,
      scaleX: (drawWidth / naturalWidth) * (f.flipX ? -1 : 1),
      scaleY: (drawHeight / naturalHeight) * (f.flipY ? -1 : 1),
      rotation: f.rotation,
      patternX: boxOffsetX + drawWidth / 2,
      patternY: boxOffsetY + drawHeight / 2,
    };
  }
  const { x, y, width: cw, height: ch } = layout.cropRect || { x: 0, y: 0, width: naturalWidth, height: naturalHeight };
  return {
    offsetX: x + cw / 2,
    offsetY: y + ch / 2,
    scaleX: (boxWidth / cw) * (f.flipX ? -1 : 1),
    scaleY: (boxHeight / ch) * (f.flipY ? -1 : 1),
    rotation: f.rotation,
    patternX: boxWidth / 2,
    patternY: boxHeight / 2,
  };
}

// SimpleTextNode's path: native Konva <Text> fillPatternImage attrs.
export function resolveImageFillKonvaProps(item, image, naturalWidth, naturalHeight) {
  const fillImage = item.fillImage;
  if (!fillImage?.assetId || !image || !naturalWidth || !naturalHeight) return null;
  const f = normalizeImageFill(fillImage);
  const width = item.width || 1;
  const height = item.height || 1;
  const source = getPreparedFillSource(image, naturalWidth, naturalHeight, f.opacity);
  const m = computePatternMatrix(f, naturalWidth, naturalHeight, width, height);
  return {
    fillPatternImage: source,
    fillPatternRepeat: "no-repeat",
    fillPatternX: m.patternX,
    fillPatternY: m.patternY,
    fillPatternScaleX: m.scaleX,
    fillPatternScaleY: m.scaleY,
    fillPatternRotation: m.rotation,
    fillPatternOffsetX: m.offsetX,
    fillPatternOffsetY: m.offsetY,
  };
}

// RichTextNode/CurvedTextNode's path: a raw CanvasPattern for ctx.fillStyle,
// same call shape as createCanvasGradient. `flowXOffset` is for
// CurvedTextNode only — each glyph there is drawn via its own
// ctx.translate/ctx.rotate before fillText(ch, 0, 0), so re-anchoring the
// pattern's own transform by that glyph's un-rotated flow-position (in the
// same 0..width flat coordinate space as `width` itself) makes the image
// sample the correct flat-image slice for that glyph, giving a
// continuously-bending image-in-text look instead of restarting per glyph.
export function createImageFillPattern(ctx, item, image, naturalWidth, naturalHeight, width, height, flowXOffset = 0) {
  const fillImage = item.fillImage;
  if (!fillImage?.assetId || !image || !naturalWidth || !naturalHeight) return null;
  const f = normalizeImageFill(fillImage);
  const source = getPreparedFillSource(image, naturalWidth, naturalHeight, f.opacity);
  const pattern = ctx.createPattern(source, "no-repeat");
  if (!pattern) return null;
  if (pattern.setTransform && typeof DOMMatrix !== "undefined") {
    const m = computePatternMatrix(f, naturalWidth, naturalHeight, width, height);
    const matrix = new DOMMatrix()
      .translate(m.patternX - flowXOffset, m.patternY)
      .rotate(m.rotation)
      .scale(m.scaleX, m.scaleY)
      .translate(-m.offsetX, -m.offsetY);
    pattern.setTransform(matrix);
  }
  return pattern;
}
