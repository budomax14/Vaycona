// Crops a single detected region out of the ORIGINAL, full-resolution
// source asset (never the downscaled processing copy detection used),
// applies soft background-alpha removal outside the region's own mask
// (preserving holes and inner antialiasing), trims to a tight bounding box,
// and resolves a PNG Blob — the shape App.jsx's extractGrabItRegion feeds
// into the normal asset-upload / new-image-item pipeline.
import { decodeSourceImage, getCropLayoutInfo } from "./grabItCoordinates";
import { hasMeaningfulAlpha, estimateBackgroundColor, colorDistance, softBackgroundAlpha, sensitivityToThresholds } from "./grabItBackground";

export async function extractGrabItRegionBlob(sourceBlob, item, region, detectionMeta = {}, options = {}) {
  const { paddingFraction = 0.06 } = options;
  const { source, width: naturalWidth, height: naturalHeight } = await decodeSourceImage(sourceBlob, {
    flipX: item.flipX,
    flipY: item.flipY,
  });
  const { visibleRect } = getCropLayoutInfo(item.crop, naturalWidth, naturalHeight, item.width || 100, item.height || 100);

  // Region coordinates are fractions of the visible (post-crop) rect —
  // map back to full natural-resolution px.
  const naturalX = visibleRect.x + region.x * visibleRect.width;
  const naturalY = visibleRect.y + region.y * visibleRect.height;
  const naturalW = Math.max(1, region.width * visibleRect.width);
  const naturalH = Math.max(1, region.height * visibleRect.height);

  const padPx = Math.max(2, Math.round(Math.max(naturalW, naturalH) * paddingFraction));
  const cropOriginX = Math.max(0, Math.floor(naturalX - padPx));
  const cropOriginY = Math.max(0, Math.floor(naturalY - padPx));
  const cropEndX = Math.min(naturalWidth, Math.ceil(naturalX + naturalW + padPx));
  const cropEndY = Math.min(naturalHeight, Math.ceil(naturalY + naturalH + padPx));
  const cropW = Math.max(1, cropEndX - cropOriginX);
  const cropH = Math.max(1, cropEndY - cropOriginY);

  const canvas = document.createElement("canvas");
  canvas.width = cropW;
  canvas.height = cropH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, cropOriginX, cropOriginY, cropW, cropH, 0, 0, cropW, cropH);

  const imageData = ctx.getImageData(0, 0, cropW, cropH);
  const backgroundMode = detectionMeta.backgroundMode || (hasMeaningfulAlpha(imageData) ? "alpha" : "color");

  if (backgroundMode === "color") {
    const data = imageData.data;
    const backgroundColor = detectionMeta.backgroundColor || estimateBackgroundColor(imageData);
    const { colorTolerance } = sensitivityToThresholds(detectionMeta.sensitivity ?? 0.5);
    const maskLookup = buildRegionMaskLookup({
      region,
      visibleRect,
      processingWidth: detectionMeta.processingWidth,
      processingHeight: detectionMeta.processingHeight,
      cropOriginNaturalX: cropOriginX,
      cropOriginNaturalY: cropOriginY,
    });
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        // A pixel solidly inside the detected object's own mask is never
        // faded, even if its color happens to sit close to the background —
        // preserves fine detail/antialiasing well inside the silhouette.
        if (maskLookup && maskLookup(x, y)) continue;
        const idx = (y * cropW + x) * 4;
        const dist = colorDistance(data[idx], data[idx + 1], data[idx + 2], backgroundColor);
        const alphaMul = softBackgroundAlpha(dist, colorTolerance);
        data[idx + 3] = Math.round(data[idx + 3] * alphaMul);
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }
  // Alpha-sourced images already carry real per-pixel alpha — nothing to do.

  const trimmedCanvas = trimTransparentBorder(ctx.canvas, cropW, cropH);
  return canvasToPngBlob(trimmedCanvas);
}

function buildRegionMaskLookup({ region, visibleRect, processingWidth, processingHeight, cropOriginNaturalX, cropOriginNaturalY }) {
  if (!region?.mask || !processingWidth || !processingHeight) return null;
  const { mask, maskOffsetXPx = 0, maskOffsetYPx = 0 } = region;
  const scaleX = visibleRect.width / processingWidth;
  const scaleY = visibleRect.height / processingHeight;
  return (cropLocalX, cropLocalY) => {
    const naturalX = cropOriginNaturalX + cropLocalX;
    const naturalY = cropOriginNaturalY + cropLocalY;
    const procX = Math.floor((naturalX - visibleRect.x) / Math.max(1e-6, scaleX));
    const procY = Math.floor((naturalY - visibleRect.y) / Math.max(1e-6, scaleY));
    const localX = procX - maskOffsetXPx;
    const localY = procY - maskOffsetYPx;
    if (localX < 0 || localY < 0 || localX >= mask.width || localY >= mask.height) return false;
    return mask.data[localY * mask.width + localX] === 1;
  };
}

function trimTransparentBorder(sourceCanvas, width, height) {
  const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const { data } = ctx.getImageData(0, 0, width, height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 4) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return sourceCanvas; // fully transparent — nothing to trim
  const trimmedW = maxX - minX + 1;
  const trimmedH = maxY - minY + 1;
  if (minX === 0 && minY === 0 && trimmedW === width && trimmedH === height) return sourceCanvas;
  const out = document.createElement("canvas");
  out.width = trimmedW;
  out.height = trimmedH;
  out.getContext("2d").drawImage(sourceCanvas, minX, minY, trimmedW, trimmedH, 0, 0, trimmedW, trimmedH);
  return out;
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not export the extracted image."));
    }, "image/png");
  });
}
