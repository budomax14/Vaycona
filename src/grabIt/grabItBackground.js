// Background estimation + foreground/background pixel classification for
// Grab It. All tunable constants live here (per spec's "expose reasonable
// internal constants so this can be tuned later").
export const DEFAULT_ALPHA_THRESHOLD = 16; // 0-255 — alpha at/below this counts as background
export const DEFAULT_COLOR_TOLERANCE = 40; // euclidean RGB distance cutoff for the color-background path
export const MEANINGFUL_ALPHA_CUTOFF = 250; // a pixel below this alpha counts as "transparent" for the alpha-vs-color decision
export const MEANINGFUL_ALPHA_FRACTION = 0.01; // fraction of sampled pixels that must be transparent to prefer the alpha path

// Sensitivity (0..1) tunes how aggressively pixels are treated as
// background. Low sensitivity keeps more surrounding pixels (higher color
// tolerance, higher alpha cutoff needed to call a pixel "foreground" is
// LOWER so weakly-opaque edge pixels stay); high sensitivity removes more
// background (lower tolerance, stricter alpha cutoff).
export function sensitivityToThresholds(sensitivity = 0.5) {
  const s = Math.max(0, Math.min(1, sensitivity));
  return {
    alphaThreshold: Math.round(4 + s * 40), // 4..44
    colorTolerance: Math.round(64 - s * 44), // 64..20
  };
}

export function hasMeaningfulAlpha(imageData, sampleStep = 7) {
  const { data, width, height } = imageData;
  const total = width * height;
  if (total === 0) return false;
  let transparentCount = 0;
  let sampled = 0;
  for (let i = 0; i < total; i += sampleStep) {
    sampled++;
    if (data[i * 4 + 3] < MEANINGFUL_ALPHA_CUTOFF) transparentCount++;
  }
  return sampled > 0 && transparentCount / sampled > MEANINGFUL_ALPHA_FRACTION;
}

// Median of corner blocks + a sparsely-sampled border ring — robust to a
// stray anti-aliased or noisy outlier pixel skewing a plain average.
export function estimateBackgroundColor(imageData) {
  const { data, width, height } = imageData;
  const rSamples = [];
  const gSamples = [];
  const bSamples = [];

  function addPixel(x, y) {
    const idx = (y * width + x) * 4;
    if (data[idx + 3] < 8) return;
    rSamples.push(data[idx]);
    gSamples.push(data[idx + 1]);
    bSamples.push(data[idx + 2]);
  }

  const blockSize = Math.max(2, Math.round(Math.min(width, height) * 0.04));
  function addBlock(x0, y0) {
    for (let y = y0; y < Math.min(height, y0 + blockSize); y++) {
      for (let x = x0; x < Math.min(width, x0 + blockSize); x++) addPixel(x, y);
    }
  }
  addBlock(0, 0);
  addBlock(Math.max(0, width - blockSize), 0);
  addBlock(0, Math.max(0, height - blockSize));
  addBlock(Math.max(0, width - blockSize), Math.max(0, height - blockSize));

  const step = Math.max(1, Math.round(Math.min(width, height) / 40));
  for (let x = 0; x < width; x += step) {
    addPixel(x, 0);
    addPixel(x, height - 1);
  }
  for (let y = 0; y < height; y += step) {
    addPixel(0, y);
    addPixel(width - 1, y);
  }

  if (rSamples.length === 0) return { r: 255, g: 255, b: 255 };
  rSamples.sort((a, b) => a - b);
  gSamples.sort((a, b) => a - b);
  bSamples.sort((a, b) => a - b);
  const mid = Math.floor(rSamples.length / 2);
  return { r: rSamples[mid], g: gSamples[mid], b: bSamples[mid] };
}

export function colorDistance(r, g, b, bg) {
  const dr = r - bg.r;
  const dg = g - bg.g;
  const db = b - bg.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Binary foreground mask, same pixel count as imageData — 1 = foreground.
export function buildForegroundMask(imageData, options = {}) {
  const { data, width, height } = imageData;
  const mask = new Uint8Array(width * height);
  if (options.mode === "alpha") {
    const threshold = options.alphaThreshold ?? DEFAULT_ALPHA_THRESHOLD;
    for (let i = 0; i < width * height; i++) mask[i] = data[i * 4 + 3] > threshold ? 1 : 0;
    return mask;
  }
  const bg = options.backgroundColor || estimateBackgroundColor(imageData);
  const tolerance = options.colorTolerance ?? DEFAULT_COLOR_TOLERANCE;
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    if (data[idx + 3] < 8) {
      mask[i] = 0;
      continue;
    }
    mask[i] = colorDistance(data[idx], data[idx + 1], data[idx + 2], bg) > tolerance ? 1 : 0;
  }
  return mask;
}

// Smoothstep falloff used only at EXTRACTION time (not detection, which
// stays a hard threshold for connected-components) — gradually reduces
// alpha near the background color instead of a brutal cutoff, per spec's
// "no jagged edges" quality requirement.
export function softBackgroundAlpha(distance, tolerance) {
  const innerEdge = tolerance * 0.55;
  const outerEdge = tolerance * 1.35;
  if (distance >= outerEdge) return 1;
  if (distance <= innerEdge) return 0;
  const t = (distance - innerEdge) / Math.max(1e-6, outerEdge - innerEdge);
  return t * t * (3 - 2 * t);
}
