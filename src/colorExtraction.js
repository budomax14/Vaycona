// Phase 11 — local palette extraction from an uploaded image/logo (spec
// §17). Runs entirely on a local <canvas> (no upload, no network) using a
// simple frequency-bucketed quantization: downscale for speed, bucket each
// pixel into a coarse RGB grid, keep the most frequent bucket centroids,
// then greedily drop near-duplicates via brandColor.js's colorDistance so
// the result reads as a real palette rather than 8 shades of the same hue.

import { toHex, colorDistance } from "./brandColor";

const SAMPLE_MAX_DIMENSION = 120; // downscale target — plenty for a palette, cheap to scan
const BUCKET_STEP = 24; // coarser bucketing = fewer, more distinct swatches
const MIN_DISTINCT_DISTANCE = 0.06; // ~15/255 per channel-ish, avoids near-duplicate swatches

function bucketOf(r, g, b) {
  const q = (v) => Math.min(255, Math.round(v / BUCKET_STEP) * BUCKET_STEP);
  return `${q(r)},${q(g)},${q(b)}`;
}

// `source`: an HTMLImageElement (already decoded) or an ImageBitmap. Never
// mutates or re-encodes the source — extraction only ever reads pixels.
export function extractPaletteFromImage(source, { maxColors = 8 } = {}) {
  const scale = Math.min(1, SAMPLE_MAX_DIMENSION / Math.max(source.naturalWidth || source.width, source.naturalHeight || source.height));
  const width = Math.max(1, Math.round((source.naturalWidth || source.width) * scale));
  const height = Math.max(1, Math.round((source.naturalHeight || source.height) * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, width, height);

  let data;
  try {
    data = ctx.getImageData(0, 0, width, height).data;
  } catch {
    // A tainted canvas (cross-origin source) can't be read — extraction
    // simply yields nothing rather than throwing.
    return [];
  }

  const buckets = new Map(); // key -> { count, r, g, b } (running sum for a true centroid, not just the bucket's quantized corner)
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 16) continue; // skip near-transparent pixels
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = bucketOf(r, g, b);
    const entry = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    entry.count += 1;
    entry.r += r;
    entry.g += g;
    entry.b += b;
    buckets.set(key, entry);
  }

  const centroids = [...buckets.values()]
    .map((e) => ({ count: e.count, r: e.r / e.count, g: e.g / e.count, b: e.b / e.count }))
    .sort((a, b) => b.count - a.count);

  const result = [];
  for (const c of centroids) {
    if (result.length >= maxColors) break;
    const isDuplicate = result.some((existing) => colorDistance(existing.color, c) < MIN_DISTINCT_DISTANCE);
    if (isDuplicate) continue;
    result.push({ color: { r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b), a: 1 }, hex: toHex(c), weight: c.count });
  }

  const totalWeight = result.reduce((sum, r) => sum + r.weight, 0) || 1;
  return result.map((r) => ({ hex: r.hex, share: r.weight / totalWeight }));
}

export function loadImageForExtraction(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve(img);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read image for color extraction."));
    };
    img.src = url;
  });
}
