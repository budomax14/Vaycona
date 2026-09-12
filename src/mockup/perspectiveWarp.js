// Shared engine behind every "composite a flat design onto a photo of blank
// stationery" mockup (business card, wedding invitation, ...). Canvas 2D has
// no projective (perspective) transform, only affine, so each blank card/
// invitation quad is warped by splitting it into two triangles and drawing
// each with its own exact affine map (a standard texture-mapping technique)
// — this reproduces the photo's perspective closely enough that the seam
// along the shared diagonal isn't visible for a design without fine texture.

const imageCache = new Map();

// Loads (and caches, per URL) the base mockup photo as an Image.
export function loadMockupImage(url) {
  if (!imageCache.has(url)) {
    imageCache.set(
      url,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Could not load the mockup photo."));
        img.src = url;
      })
    );
  }
  return imageCache.get(url);
}

// The affine matrix (as {a,b,c,d,e,f}, matching CanvasRenderingContext2D's
// setTransform argument order) that maps the unit triangle (0,0),(1,0),(0,1)
// onto p0,p1,p2.
function affineFromUnitTriangle(p0, p1, p2) {
  return {
    a: p1.x - p0.x,
    b: p1.y - p0.y,
    c: p2.x - p0.x,
    d: p2.y - p0.y,
    e: p0.x,
    f: p0.y,
  };
}

function invertAffine({ a, b, c, d, e, f }) {
  const det = a * d - b * c;
  const invA = d / det;
  const invB = -b / det;
  const invC = -c / det;
  const invD = a / det;
  return { a: invA, b: invB, c: invC, d: invD, e: -(invA * e + invC * f), f: -(invB * e + invD * f) };
}

function composeAffine(outer, inner) {
  return {
    a: outer.a * inner.a + outer.c * inner.b,
    b: outer.b * inner.a + outer.d * inner.b,
    c: outer.a * inner.c + outer.c * inner.d,
    d: outer.b * inner.c + outer.d * inner.d,
    e: outer.a * inner.e + outer.c * inner.f + outer.e,
    f: outer.b * inner.e + outer.d * inner.f + outer.f,
  };
}

// Draws `source` (an image/canvas) warped so its triangle `srcTri` lands
// exactly on `dstTri`, clipped to that destination triangle.
function drawTriangleWarp(ctx, source, srcTri, dstTri) {
  const srcUnit = affineFromUnitTriangle(...srcTri);
  const dstUnit = affineFromUnitTriangle(...dstTri);
  const det = srcUnit.a * srcUnit.d - srcUnit.b * srcUnit.c;
  if (Math.abs(det) < 1e-6) return;
  const m = composeAffine(dstUnit, invertAffine(srcUnit));

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(dstTri[0].x, dstTri[0].y);
  ctx.lineTo(dstTri[1].x, dstTri[1].y);
  ctx.lineTo(dstTri[2].x, dstTri[2].y);
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
  ctx.drawImage(source, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.restore();
}

// Warps the full `source` canvas onto `destQuad` (a convex quadrilateral,
// [top-left, top-right, bottom-right, bottom-left]) by splitting both source
// and destination into two triangles along the TR-BL diagonal.
export function drawQuadWarp(ctx, source, destQuad) {
  const w = source.width;
  const h = source.height;
  const srcCorners = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  const [d0, d1, d2, d3] = destQuad;
  const [s0, s1, s2, s3] = srcCorners;
  drawTriangleWarp(ctx, source, [s0, s1, s3], [d0, d1, d3]);
  drawTriangleWarp(ctx, source, [s1, s2, s3], [d1, d2, d3]);
}

function quadBoundingBox(quad, maxWidth, maxHeight) {
  const xs = quad.map((p) => p.x);
  const ys = quad.map((p) => p.y);
  const x = Math.max(0, Math.floor(Math.min(...xs)));
  const y = Math.max(0, Math.floor(Math.min(...ys)));
  const width = Math.min(maxWidth, Math.ceil(Math.max(...xs))) - x;
  const height = Math.min(maxHeight, Math.ceil(Math.max(...ys))) - y;
  return { x, y, width, height };
}

// Re-applies the photo's own lighting on top of the freshly-warped design:
// takes the original (blank) surface's pixels in this quad, converts them to
// a brightness-only mask normalized so its brightest point is full white,
// and multiplies it over the design. This keeps the scene's lighting/soft
// shadow crossing the surface believable instead of pasting flat, evenly-lit
// artwork into a photo that has neither.
export function drawShadingOverlay(ctx, mockupImage, quad) {
  const bbox = quadBoundingBox(quad, mockupImage.width, mockupImage.height);
  if (bbox.width <= 0 || bbox.height <= 0) return;

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = bbox.width;
  maskCanvas.height = bbox.height;
  const maskCtx = maskCanvas.getContext("2d");
  maskCtx.drawImage(mockupImage, bbox.x, bbox.y, bbox.width, bbox.height, 0, 0, bbox.width, bbox.height);

  const imageData = maskCtx.getImageData(0, 0, bbox.width, bbox.height);
  const data = imageData.data;
  let maxLuma = 1;
  for (let i = 0; i < data.length; i += 4) {
    const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (luma > maxLuma) maxLuma = luma;
  }
  const scale = 255 / maxLuma;
  for (let i = 0; i < data.length; i += 4) {
    const luma = Math.min(255, (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) * scale);
    data[i] = luma;
    data[i + 1] = luma;
    data[i + 2] = luma;
  }
  maskCtx.putImageData(imageData, 0, 0);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(quad[0].x, quad[0].y);
  ctx.lineTo(quad[1].x, quad[1].y);
  ctx.lineTo(quad[2].x, quad[2].y);
  ctx.lineTo(quad[3].x, quad[3].y);
  ctx.closePath();
  ctx.clip();
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(maskCanvas, bbox.x, bbox.y);
  ctx.restore();
}

// Composites any number of flat design canvases onto their measured quads on
// one base photo. `slots`: [{ quad, canvas }] — a falsy `canvas` skips that
// slot (base photo shows through unchanged). Returns a detached canvas at
// the mockup photo's native resolution.
export async function compositeMockup({ imageUrl, slots }) {
  const mockupImage = await loadMockupImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = mockupImage.naturalWidth;
  canvas.height = mockupImage.naturalHeight;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(mockupImage, 0, 0);

  for (const slot of slots) {
    if (!slot?.canvas) continue;
    drawQuadWarp(ctx, slot.canvas, slot.quad);
    drawShadingOverlay(ctx, mockupImage, slot.quad);
  }

  return canvas;
}
