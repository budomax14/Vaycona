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

// Projective map from the unit square onto `quad` ([TL, TR, BR, BL]) —
// Heckbert's square-to-quad homography. Unlike the two-triangle affine
// split above, straight lines in the design stay straight and spacing
// foreshortens the way a real tilted surface does.
function squareToQuad(quad) {
  const [p0, p1, p2, p3] = quad;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;
  let g = 0;
  let h = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const det = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / det;
    h = (dx1 * dy3 - dx3 * dy1) / det;
  }
  const a = p1.x - p0.x + g * p1.x;
  const b = p3.x - p0.x + h * p3.x;
  const d = p1.y - p0.y + g * p1.y;
  const e = p3.y - p0.y + h * p3.y;
  return (u, v) => {
    const w = g * u + h * v + 1;
    return { x: (a * u + b * v + p0.x) / w, y: (d * u + e * v + p0.y) / w };
  };
}

// One mesh triangle: exact affine map for that small piece, clipped to the
// destination triangle grown by ~0.75px (so neighbouring pieces overlap
// instead of leaving anti-aliased hairline seams), drawing only the
// source pixels that piece actually needs.
function drawMeshTriangle(ctx, source, srcTri, dstTri) {
  const srcUnit = affineFromUnitTriangle(...srcTri);
  const dstUnit = affineFromUnitTriangle(...dstTri);
  const det = srcUnit.a * srcUnit.d - srcUnit.b * srcUnit.c;
  if (Math.abs(det) < 1e-9) return;
  const m = composeAffine(dstUnit, invertAffine(srcUnit));
  const cx = (dstTri[0].x + dstTri[1].x + dstTri[2].x) / 3;
  const cy = (dstTri[0].y + dstTri[1].y + dstTri[2].y) / 3;
  const grown = dstTri.map((p) => {
    const len = Math.hypot(p.x - cx, p.y - cy) || 1;
    return { x: p.x + ((p.x - cx) / len) * 0.75, y: p.y + ((p.y - cy) / len) * 0.75 };
  });
  const xs = srcTri.map((p) => p.x);
  const ys = srcTri.map((p) => p.y);
  const sx = Math.max(0, Math.floor(Math.min(...xs)) - 2);
  const sy = Math.max(0, Math.floor(Math.min(...ys)) - 2);
  const sw = Math.min(source.width, Math.ceil(Math.max(...xs)) + 2) - sx;
  const sh = Math.min(source.height, Math.ceil(Math.max(...ys)) + 2) - sy;
  if (sw <= 0 || sh <= 0) return;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(grown[0].x, grown[0].y);
  ctx.lineTo(grown[1].x, grown[1].y);
  ctx.lineTo(grown[2].x, grown[2].y);
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
  ctx.drawImage(source, sx, sy, sw, sh, sx, sy, sw, sh);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.restore();
}

// Perspective-correct version of drawQuadWarp: the quad is split into a
// `subdivisions` × `subdivisions` mesh whose corners follow the true
// homography, each cell small enough that drawing it affinely is exact to
// well under a pixel.
export function drawQuadWarpProjective(ctx, source, destQuad, subdivisions = 24) {
  const map = squareToQuad(destQuad);
  const n = subdivisions;
  const w = source.width;
  const h = source.height;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const u0 = i / n;
      const u1 = (i + 1) / n;
      const v0 = j / n;
      const v1 = (j + 1) / n;
      const s00 = { x: u0 * w, y: v0 * h };
      const s10 = { x: u1 * w, y: v0 * h };
      const s01 = { x: u0 * w, y: v1 * h };
      const s11 = { x: u1 * w, y: v1 * h };
      const d00 = map(u0, v0);
      const d10 = map(u1, v0);
      const d01 = map(u0, v1);
      const d11 = map(u1, v1);
      drawMeshTriangle(ctx, source, [s00, s10, s01], [d00, d10, d01]);
      drawMeshTriangle(ctx, source, [s10, s11, s01], [d10, d11, d01]);
    }
  }
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
// the mockup photo's native resolution. A slot with `projective: true`
// (opt-in, used by greetingCardMockup.js's inside panels) uses the
// perspective-correct mesh warp instead of the two-triangle warp.
export async function compositeMockup({ imageUrl, slots }) {
  const mockupImage = await loadMockupImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = mockupImage.naturalWidth;
  canvas.height = mockupImage.naturalHeight;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(mockupImage, 0, 0);

  for (const slot of slots) {
    if (!slot?.canvas) continue;
    if (slot.projective) drawQuadWarpProjective(ctx, slot.canvas, slot.quad);
    else drawQuadWarp(ctx, slot.canvas, slot.quad);
    drawShadingOverlay(ctx, mockupImage, slot.quad);
  }

  return canvas;
}
