// Phase 9 — PDF export. Pages are rasterized through the same shared
// offscreen render pipeline every other format uses (spec rule 7: one
// render pipeline, not a parallel PDF-specific renderer), then placed onto
// a jsPDF page sized to the PROJECT's own page dimensions (+ bleed/crop
// margin for print mode) — never forced to one default size (spec §28).
// Bleed expansion and crop marks are drawn as real jsPDF vector
// primitives, not part of the rasterized page image (spec §33/§34).

import jsPDF from "jspdf";
import { renderPageToCanvas, ExportCancelledError, yieldToMainThread } from "./offscreenRenderer";
import { buildExportFilename } from "./exportRequest";
import { CROP_MARK_LENGTH_PX, CROP_MARK_OFFSET_PX, CROP_MARK_STROKE_WIDTH } from "./exportConstants";
import { drawWatermark } from "./exportWatermark";

function canvasToDataUrl(canvas, mimeType, quality) {
  return canvas.toDataURL(mimeType, quality);
}

// Draws the 8 short vector line segments (2 per corner) marking where the
// page should be trimmed — positioned entirely within the margin outside
// the bleed box, never touching the design itself.
function drawCropMarks(pdf, { trimLeft, trimTop, trimRight, trimBottom, bleedLeft, bleedTop, bleedRight, bleedBottom }) {
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(CROP_MARK_STROKE_WIDTH);

  const corners = [
    { x: trimLeft, y: trimTop, bx: bleedLeft, by: bleedTop, dx: -1, dy: -1 },
    { x: trimRight, y: trimTop, bx: bleedRight, by: bleedTop, dx: 1, dy: -1 },
    { x: trimLeft, y: trimBottom, bx: bleedLeft, by: bleedBottom, dx: -1, dy: 1 },
    { x: trimRight, y: trimBottom, bx: bleedRight, by: bleedBottom, dx: 1, dy: 1 },
  ];

  corners.forEach(({ x, y, bx, by, dx, dy }) => {
    // Horizontal mark, aligned with the trim's y, running outward from the
    // bleed edge (not the trim edge) so it never crosses bleed content.
    const hx1 = bx + dx * CROP_MARK_OFFSET_PX;
    const hx2 = hx1 + dx * CROP_MARK_LENGTH_PX;
    pdf.line(hx1, y, hx2, y);
    // Vertical mark, aligned with the trim's x.
    const vy1 = by + dy * CROP_MARK_OFFSET_PX;
    const vy2 = vy1 + dy * CROP_MARK_LENGTH_PX;
    pdf.line(x, vy1, x, vy2);
  });
}

function pageGeometry(page, request) {
  const bleed = request.bleedPx || 0;
  const margin = request.cropMarks ? CROP_MARK_OFFSET_PX + CROP_MARK_LENGTH_PX : 0;
  const pdfWidth = page.width + 2 * bleed + 2 * margin;
  const pdfHeight = page.height + 2 * bleed + 2 * margin;
  const contentX = margin + bleed;
  const contentY = margin + bleed;
  return {
    pdfWidth,
    pdfHeight,
    contentX,
    contentY,
    trimLeft: contentX,
    trimTop: contentY,
    trimRight: contentX + page.width,
    trimBottom: contentY + page.height,
    bleedLeft: margin,
    bleedTop: margin,
    bleedRight: margin + 2 * bleed + page.width,
    bleedBottom: margin + 2 * bleed + page.height,
  };
}

export async function exportPdf({ pages, items, request, availableAssetIds, projectName, onProgress, signal }) {
  const mimeType = request.pdfMode === "print" ? "image/png" : "image/jpeg";
  const quality = request.pdfMode === "print" ? undefined : 0.92;

  let pdf = null;
  const bleedWarnings = [];

  for (let i = 0; i < pages.length; i++) {
    if (signal?.aborted) throw new ExportCancelledError();
    const page = pages[i];
    onProgress?.({ stage: "rendering", pageIndex: i, pageCount: pages.length, pageName: page.name || `Page ${i + 1}` });

    // eslint-disable-next-line no-await-in-loop
    const canvas = await renderPageToCanvas({
      page,
      items,
      pixelScale: request.scale,
      backgroundFill: request.backgroundOverride || page.background || "#ffffff",
      availableAssetIds,
      signal,
    });
    if (signal?.aborted) throw new ExportCancelledError();
    if (request.watermark) drawWatermark(canvas);
    const dataUrl = canvasToDataUrl(canvas, mimeType, quality);
    canvas.width = 0;
    canvas.height = 0;

    const geo = pageGeometry(page, request);
    if (i === 0) {
      pdf = new jsPDF({ unit: "px", format: [geo.pdfWidth, geo.pdfHeight], compress: true });
    } else {
      pdf.addPage([geo.pdfWidth, geo.pdfHeight]);
    }

    pdf.addImage(dataUrl, mimeType === "image/png" ? "PNG" : "JPEG", geo.contentX, geo.contentY, page.width, page.height);

    if (request.bleedPx > 0) {
      bleedWarnings.push(page.name || `Page ${i + 1}`);
    }
    if (request.cropMarks) {
      drawCropMarks(pdf, geo);
    }
    // eslint-disable-next-line no-await-in-loop
    await yieldToMainThread();
  }

  onProgress?.({ stage: "finalizing" });
  pdf.setProperties({
    title: (projectName || "Untitled Design").trim() || "Untitled Design",
    subject: request.pdfMode === "print" ? "Print-ready design export" : "Design export",
    creator: "Personal Canva Editor",
  });

  const blob = pdf.output("blob");
  return {
    blob,
    filename: buildExportFilename(request.filenameBase, { extension: "pdf" }),
    // Bleed is applied as empty margin only — content is never stretched
    // into it (spec §33), so this is always worth surfacing, not a
    // detected defect.
    bleedNote:
      request.bleedPx > 0
        ? `Bleed was added as extra page margin — your design content itself doesn't automatically extend into the bleed area on ${bleedWarnings.length === pages.length ? "any page" : bleedWarnings.join(", ")}. Extend backgrounds manually if you need full bleed coverage.`
        : null,
  };
}
