// Free-tier export watermark — a single shared implementation so PNG/JPEG
// (rasterExport.js) and PDF (pdfExport.js) don't each draw their own; both
// rasterize through the same offscreen canvas, so baking the mark in here
// keeps every raster format pixel-identical instead of adding a second,
// slightly different overlay pass per format.

const WATERMARK_TEXT = "Vaycona";

export function drawWatermark(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  const fontSize = Math.max(14, Math.round(canvas.width / 28));
  ctx.font = `600 ${fontSize}px sans-serif`;
  ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.rotate(-Math.PI / 8);

  const spacingX = fontSize * 9;
  const spacingY = fontSize * 6;
  const diagonal = Math.sqrt(canvas.width ** 2 + canvas.height ** 2);
  for (let y = -diagonal; y < diagonal; y += spacingY) {
    for (let x = -diagonal; x < diagonal; x += spacingX) {
      ctx.fillText(WATERMARK_TEXT, x, y);
    }
  }
  ctx.restore();
}
