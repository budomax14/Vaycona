// Orchestrates Grab It's local (client-side, no API) region detection —
// pure logic, no React/Konva. See grabItCoordinates/grabItBackground/
// grabItGrouping for the individual building blocks this composes.
import { decodeSourceImage, getCropLayoutInfo } from "./grabItCoordinates";
import { hasMeaningfulAlpha, estimateBackgroundColor, buildForegroundMask, sensitivityToThresholds } from "./grabItBackground";
import { findConnectedComponents, filterNoiseComponents, mergeNearbyComponents, buildRegionMask, traceRegionOutline } from "./grabItGrouping";

// Cap on the analyzed copy's longer side — keeps connected-component
// analysis fast regardless of the source asset's real resolution (spec:
// "Large images must not freeze the editor... process a reduced-resolution
// copy for object detection").
export const PROCESSING_MAX_DIMENSION = 640;

export const NO_SEPARATE_DESIGNS_MESSAGE = "Couldn't separate this image automatically. Try Fine Tune or select the area manually.";

// detectGrabRegions(sourceBlob, cropParams, options) — cropParams describes
// the ITEM (crop/flip/box size), not the algorithm; options tunes the
// algorithm itself. `method: "ai"` is a deliberate, documented no-op — the
// extension point a future AI segmentation provider would plug into,
// per spec's "structure the system so a future AI provider can plug in".
// Not built/paid for in this pass.
export async function detectGrabRegions(sourceBlob, cropParams, options = {}) {
  const { method = "local", sensitivity = 0.5, mergeAmount = 0.5 } = options;
  if (method !== "local") {
    throw new Error(`Grab It detection method "${method}" is not implemented.`);
  }

  const { flipX, flipY, crop, itemWidth, itemHeight } = cropParams;
  const { source, width: naturalWidth, height: naturalHeight } = await decodeSourceImage(sourceBlob, { flipX, flipY });
  const { visibleRect } = getCropLayoutInfo(crop, naturalWidth, naturalHeight, itemWidth, itemHeight);

  const scaleFactor = Math.min(1, PROCESSING_MAX_DIMENSION / Math.max(1, Math.max(visibleRect.width, visibleRect.height)));
  const procWidth = Math.max(1, Math.round(visibleRect.width * scaleFactor));
  const procHeight = Math.max(1, Math.round(visibleRect.height * scaleFactor));

  const canvas = document.createElement("canvas");
  canvas.width = procWidth;
  canvas.height = procHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, visibleRect.x, visibleRect.y, visibleRect.width, visibleRect.height, 0, 0, procWidth, procHeight);

  let imageData;
  try {
    imageData = ctx.getImageData(0, 0, procWidth, procHeight);
  } catch {
    return {
      regions: [],
      visibleRect,
      naturalWidth,
      naturalHeight,
      processingWidth: procWidth,
      processingHeight: procHeight,
      backgroundMode: null,
      backgroundColor: null,
      error: "Couldn't analyze this image.",
    };
  }

  const useAlpha = hasMeaningfulAlpha(imageData);
  const { alphaThreshold, colorTolerance } = sensitivityToThresholds(sensitivity);
  const backgroundColor = useAlpha ? null : estimateBackgroundColor(imageData);
  const mask = buildForegroundMask(
    imageData,
    useAlpha ? { mode: "alpha", alphaThreshold } : { mode: "color", colorTolerance, backgroundColor }
  );

  const { labels, components } = findConnectedComponents(mask, procWidth, procHeight);
  const filtered = filterNoiseComponents(components, {}, procWidth, procHeight);
  const merged = mergeNearbyComponents(filtered, mergeAmount, procWidth, procHeight);

  const regions = merged
    .map((group, index) => {
      const localMask = buildRegionMask(labels, procWidth, group);
      const outlinePx = traceRegionOutline(localMask);
      const bboxW = group.maxX - group.minX + 1;
      const bboxH = group.maxY - group.minY + 1;
      return {
        id: `grab-region-${index}`,
        x: group.minX / procWidth,
        y: group.minY / procHeight,
        width: bboxW / procWidth,
        height: bboxH / procHeight,
        area: group.area,
        mask: localMask,
        maskOffsetXPx: group.minX,
        maskOffsetYPx: group.minY,
        outline: outlinePx ? outlinePx.map(([px, py]) => [(group.minX + px) / procWidth, (group.minY + py) / procHeight]) : null,
      };
    })
    .sort((a, b) => b.area - a.area);

  return {
    regions,
    visibleRect,
    naturalWidth,
    naturalHeight,
    processingWidth: procWidth,
    processingHeight: procHeight,
    backgroundMode: useAlpha ? "alpha" : "color",
    backgroundColor,
    error: regions.length === 0 ? NO_SEPARATE_DESIGNS_MESSAGE : null,
  };
}
