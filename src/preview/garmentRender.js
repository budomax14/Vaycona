// Canvas engine behind the Preview dialog: recolors a white garment photo
// and prints a flat design onto it, keeping the photo's own folds and
// shadows visible through both the fabric and the ink. Kept separate from
// the React dialog so the pixel work stays testable and the dialog only
// deals with state.

// Fabric photos are near-white, so their real shading lives in a narrow
// band (roughly 0.75-1.0 of full brightness). The gamma widens it so folds
// still read once a color is multiplied over them.
const SHADE_GAMMA = 1.6;
const HIGHLIGHT_START = 0.9;
const HIGHLIGHT_STRENGTH = 0.18;

const garmentCache = new Map();

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the garment photo."));
    img.src = url;
  });
}

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// Loads (and caches, per URL) everything derived from one garment photo:
// per-pixel shading, a shadow overlay used to shade the printed design, and
// the photo itself (its alpha doubles as the mask the design is clipped to).
export function loadGarment(url) {
  if (!garmentCache.has(url)) {
    garmentCache.set(
      url,
      loadImage(url).then((img) => {
        const { width, height } = img;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, width, height);
        const pixelCount = width * height;

        // Brightest fabric = 100% (a 98th-percentile cut ignores specular
        // specks), so a slightly gray photo still tints to the exact color.
        const histogram = new Uint32Array(256);
        let opaque = 0;
        for (let i = 0; i < pixelCount; i++) {
          if (data[i * 4 + 3] < 200) continue;
          histogram[Math.round((data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3)] += 1;
          opaque += 1;
        }
        let high = 255;
        for (let bin = 255, seen = 0; bin >= 0; bin--) {
          seen += histogram[bin];
          if (seen >= opaque * 0.02) {
            high = Math.max(bin, 1);
            break;
          }
        }

        const norm = new Float32Array(pixelCount);
        const alpha = new Uint8ClampedArray(pixelCount);
        const shadow = ctx.createImageData(width, height);
        for (let i = 0; i < pixelCount; i++) {
          const luminance = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
          norm[i] = Math.min(1, luminance / high);
          alpha[i] = data[i * 4 + 3];
          shadow.data[i * 4 + 3] = (1 - norm[i] ** SHADE_GAMMA) * 255;
        }
        const shadowCanvas = createCanvas(width, height);
        shadowCanvas.getContext("2d").putImageData(shadow, 0, 0);

        return { width, height, img, norm, alpha, shadowCanvas, layer: createCanvas(width, height) };
      })
    );
    // A failed load must not stay cached as a permanently rejected promise.
    garmentCache.get(url).catch(() => garmentCache.delete(url));
  }
  return garmentCache.get(url);
}

function parseHex(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

// The garment photo recolored to `hex`: the color multiplied by the fabric
// shading, plus a touch of highlight so dark colors keep some sheen instead
// of collapsing to a flat silhouette.
export function tintGarment(garment, hex) {
  const { width, height, norm, alpha } = garment;
  const [cr, cg, cb] = parseHex(hex);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const out = ctx.createImageData(width, height);
  for (let i = 0; i < norm.length; i++) {
    const shade = norm[i] ** SHADE_GAMMA;
    const highlight = Math.max(0, (norm[i] - HIGHLIGHT_START) / (1 - HIGHLIGHT_START)) * HIGHLIGHT_STRENGTH;
    const r = cr * shade;
    const g = cg * shade;
    const b = cb * shade;
    out.data[i * 4] = r + (255 - r) * highlight;
    out.data[i * 4 + 1] = g + (255 - g) * highlight;
    out.data[i * 4 + 2] = b + (255 - b) * highlight;
    out.data[i * 4 + 3] = alpha[i];
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

// Fits a design of `designAspect` (height / width) inside `box` (fractions
// of the garment image, [x0, y0, x1, y1]) and returns its starting
// placement: `w` is the design's width and `cx`/`cy` its center, all as
// fractions of the garment image.
export function fitDesignToBox(garment, box, designAspect) {
  const [x0, y0, x1, y1] = box;
  const boxWidth = (x1 - x0) * garment.width;
  const boxHeight = (y1 - y0) * garment.height;
  const designWidth = Math.min(boxWidth, boxHeight / designAspect);
  return { w: designWidth / garment.width, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

// The design's height as a fraction of the garment image's height.
export function designHeightFraction(garment, design, designAspect) {
  return (design.w * garment.width * designAspect) / garment.height;
}

// Draws the tinted garment, then the design on top: clipped to the fabric
// so nothing prints past the silhouette, and darkened by the same shadow
// overlay the folds cast on the fabric so it reads as printed, not pasted.
export function composeGarment(ctx, garment, tintedCanvas, designCanvas, design) {
  ctx.clearRect(0, 0, garment.width, garment.height);
  ctx.drawImage(tintedCanvas, 0, 0);
  if (!designCanvas || !design) return;

  const designWidth = design.w * garment.width;
  const designHeight = designWidth * (designCanvas.height / designCanvas.width);
  const layerCtx = garment.layer.getContext("2d");
  layerCtx.clearRect(0, 0, garment.width, garment.height);
  layerCtx.globalCompositeOperation = "source-over";
  layerCtx.imageSmoothingQuality = "high";
  layerCtx.drawImage(designCanvas, design.cx * garment.width - designWidth / 2, design.cy * garment.height - designHeight / 2, designWidth, designHeight);
  layerCtx.globalCompositeOperation = "source-atop";
  layerCtx.drawImage(garment.shadowCanvas, 0, 0);
  layerCtx.globalCompositeOperation = "destination-in";
  layerCtx.drawImage(garment.img, 0, 0);
  layerCtx.globalCompositeOperation = "source-over";
  ctx.drawImage(garment.layer, 0, 0);
}
