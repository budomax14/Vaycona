// Shared coordinate math for Grab It — kept separate from detection/
// extraction/UI so every consumer (detection's downscaled analysis,
// extraction's full-res crop, GrabItOverlay's hover/click hit-testing)
// agrees on exactly the same mapping between:
//   natural image px -> "visible source" rect (respects the item's current
//   crop, per the "only grab from the visible crop" requirement) ->
//   fraction (0..1) of that visible rect (what DetectedRegion coordinates
//   are expressed in) -> item-local px (0..item.width/height) -> screen px
//   (through the item's rotation, for hover/click accuracy on a rotated
//   image).
import { computeCropLayout } from "../imageCrop";

// Decodes a blob to an HTMLImageElement, then (only if flipped) redraws it
// onto a canvas using the exact same setTransform trick useImageElement.js
// uses for on-canvas rendering — this is the single place flip is applied,
// so detection (downscaled) and extraction (full-res) can never disagree
// about what pixel grid is actually visible.
export function decodeImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (event) => {
      URL.revokeObjectURL(url);
      reject(event instanceof Error ? event : new Error("Could not decode image."));
    };
    img.src = url;
  });
}

export async function decodeSourceImage(blob, { flipX = false, flipY = false } = {}) {
  const img = await decodeImageFromBlob(blob);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  if (!flipX && !flipY) return { source: img, width, height };

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(flipX ? -1 : 1, 0, 0, flipY ? -1 : 1, flipX ? width : 0, flipY ? height : 0);
  ctx.drawImage(img, 0, 0, width, height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return { source: canvas, width, height };
}

// The natural-px sub-rect that is currently VISIBLE on the item, given its
// crop. Full natural image for "stretch"/"contain" (both show the whole
// image, just scaled/letterboxed); the crop-mode's own cropRect for "crop"
// (cover) — never anything outside the current crop.
export function getCropLayoutInfo(crop, naturalWidth, naturalHeight, boxWidth, boxHeight) {
  const layout = computeCropLayout(crop, naturalWidth, naturalHeight, boxWidth, boxHeight);
  const visibleRect =
    layout.mode === "crop"
      ? { x: layout.cropRect.x, y: layout.cropRect.y, width: layout.cropRect.width, height: layout.cropRect.height }
      : { x: 0, y: 0, width: naturalWidth, height: naturalHeight };
  return { layout, visibleRect };
}

// item-local px -> fraction (0..1) of the visible rect. `inside` is false
// when the point falls in "contain" mode's letterbox padding (no image
// there at all).
export function itemLocalToVisibleFraction(itemX, itemY, layout, boxWidth, boxHeight) {
  if (layout.mode === "contain") {
    const fx = (itemX - layout.offsetX) / Math.max(1, layout.drawWidth);
    const fy = (itemY - layout.offsetY) / Math.max(1, layout.drawHeight);
    return { fx, fy, inside: fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1 };
  }
  // "stretch" and "crop" both map the item's full box 1:1 onto the visible rect.
  const fx = itemX / Math.max(1, boxWidth);
  const fy = itemY / Math.max(1, boxHeight);
  return { fx, fy, inside: fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1 };
}

// Inverse of the above — used to place the hover outline back in item-local px.
export function visibleFractionToItemLocal(fx, fy, layout, boxWidth, boxHeight) {
  if (layout.mode === "contain") {
    return { x: layout.offsetX + fx * layout.drawWidth, y: layout.offsetY + fy * layout.drawHeight };
  }
  return { x: fx * boxWidth, y: fy * boxHeight };
}

// Real client-px pointer position -> item-local px, correct for a rotated
// item. Anchored on the wrapper element's own live bounding-rect CENTER
// (rotation-invariant — the center of a rotated box is still the box's
// center) rather than a fixed content-space point, so it self-corrects
// every call with no drift, no matter how it got positioned on screen.
// Same "world delta / scale, then rotate by -rotation" math FadeOverlay.jsx
// uses for its own handle drags (rotatedDelta), just anchored differently
// since hover needs an absolute point, not a drag delta.
export function screenPointToItemLocal(clientPoint, item, scale, centerClient) {
  const dxWorld = (clientPoint.clientX - centerClient.x) / scale;
  const dyWorld = (clientPoint.clientY - centerClient.y) / scale;
  const rad = ((item.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dxLocal = dxWorld * cos + dyWorld * sin;
  const dyLocal = -dxWorld * sin + dyWorld * cos;
  const width = Math.max(1, item.width || 1);
  const height = Math.max(1, item.height || 1);
  return { x: width / 2 + dxLocal, y: height / 2 + dyLocal };
}
