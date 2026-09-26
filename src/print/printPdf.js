// Print-ready PDF for a Print Layout product (greeting cards today).
//
// Each PDF page is the real physical sheet — US Letter pages are exactly
// 11 × 8.5 in, A4 exactly 297 × 210 mm (landscape for a half-fold card),
// plus bleed/mark margin only when the user turns those on for
// professional printing. Every panel is rendered through the same shared
// offscreen pipeline as every other export (offscreenRenderer.jsx) at
// ~300 DPI and placed into its exact slot in inches; nothing is stretched
// to fit the paper. Panels render one at a time and each canvas is
// released before the next, so at most one full-resolution panel exists
// at once (important on iPhone Safari).

import jsPDF from "jspdf";
import { renderPageToCanvas, ExportCancelledError, yieldToMainThread } from "../export/offscreenRenderer";
import { runExportPreflight, preloadExportFonts } from "../export/exportPreflight";
import { buildExportFilename } from "../export/exportRequest";
import { drawWatermark } from "../export/exportWatermark";
import { isMobileDevice } from "../canvasPixelBudget";
import { PT_PER_INCH, PX_PER_INCH } from "./paperSizes";
import { buildPrintPlan, CUT_MARK_GAP_IN, CUT_MARK_LENGTH_IN, MARK_LENGTH_IN, MARK_OFFSET_IN } from "./printPlan";

export const PRINT_DPI = 300;
// Phones cap lower: a 300 DPI panel plus its offscreen Stage is ~50MB of
// canvas, which is exactly the kind of spike that gets iOS tabs killed.
// Phone image assets are already downscaled on decode, so 200 DPI loses
// little real detail there.
export const MOBILE_PRINT_DPI = 200;

export function printDpi() {
  return isMobileDevice() ? MOBILE_PRINT_DPI : PRINT_DPI;
}

const pt = (inches) => inches * PT_PER_INCH;

function rotateCanvas180(canvas) {
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d");
  ctx.translate(out.width, out.height);
  ctx.rotate(Math.PI);
  ctx.drawImage(canvas, 0, 0);
  canvas.width = 0;
  canvas.height = 0;
  return out;
}

function drawCropMarks(pdf, trim, plan) {
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  const off = pt(plan.bleedIn + MARK_OFFSET_IN);
  const len = pt(MARK_LENGTH_IN);
  const left = pt(trim.x);
  const top = pt(trim.y);
  const right = pt(trim.x + trim.width);
  const bottom = pt(trim.y + trim.height);
  [
    [left, top, -1, -1],
    [right, top, 1, -1],
    [left, bottom, -1, 1],
    [right, bottom, 1, 1],
  ].forEach(([x, y, dx, dy]) => {
    pdf.line(x + dx * off, y, x + dx * (off + len), y);
    pdf.line(x, y + dy * off, x, y + dy * (off + len));
  });
}

// Fold marks: short dashed ticks outside the trim (pro print) or a light
// dashed line through the sheet (home print with guides turned on).
function drawFolds(pdf, page, plan) {
  pdf.setLineDashPattern([3, 3], 0);
  pdf.setLineWidth(0.5);
  pdf.setDrawColor(150, 150, 150);
  const off = pt(plan.bleedIn + MARK_OFFSET_IN);
  const len = pt(MARK_LENGTH_IN);
  page.folds.forEach((fold) => {
    if (plan.hasMarks) {
      if (fold.orientation === "vertical") {
        pdf.line(pt(fold.x1), pt(fold.y1) - off, pt(fold.x1), pt(fold.y1) - off - len);
        pdf.line(pt(fold.x2), pt(fold.y2) + off, pt(fold.x2), pt(fold.y2) + off + len);
      } else {
        pdf.line(pt(fold.x1) - off, pt(fold.y1), pt(fold.x1) - off - len, pt(fold.y1));
        pdf.line(pt(fold.x2) + off, pt(fold.y2), pt(fold.x2) + off + len, pt(fold.y2));
      }
    } else if (plan.printFoldLine) {
      pdf.line(pt(fold.x1), pt(fold.y1), pt(fold.x2), pt(fold.y2));
    }
  });
  pdf.setLineDashPattern([], 0);
}

// Cut to size: short marks just outside the card's corners (and at the ends
// of the fold) to cut/fold along. They sit over the design's extra bleed,
// so they're trimmed away with it.
function drawCutMarks(pdf, sheet) {
  const { trim } = sheet;
  const gap = pt(CUT_MARK_GAP_IN);
  const len = pt(CUT_MARK_LENGTH_IN);
  const left = pt(trim.x);
  const top = pt(trim.y);
  const right = pt(trim.x + trim.width);
  const bottom = pt(trim.y + trim.height);
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.6);
  [
    [left, top, -1, -1],
    [right, top, 1, -1],
    [left, bottom, -1, 1],
    [right, bottom, 1, 1],
  ].forEach(([x, y, dx, dy]) => {
    pdf.line(x + dx * gap, y, x + dx * (gap + len), y);
    pdf.line(x, y + dy * gap, x, y + dy * (gap + len));
  });
  pdf.setLineDashPattern([2, 2], 0);
  sheet.folds.forEach((fold) => {
    if (fold.orientation === "vertical") {
      pdf.line(pt(fold.x1), pt(fold.y1) - gap, pt(fold.x1), pt(fold.y1) - gap - len);
      pdf.line(pt(fold.x2), pt(fold.y2) + gap, pt(fold.x2), pt(fold.y2) + gap + len);
    } else {
      pdf.line(pt(fold.x1) - gap, pt(fold.y1), pt(fold.x1) - gap - len, pt(fold.y1));
      pdf.line(pt(fold.x2) + gap, pt(fold.y2), pt(fold.x2) + gap + len, pt(fold.y2));
    }
  });
  pdf.setLineDashPattern([], 0);
}

// `card`: getCardProject(pages). `items`: already static-resolved export
// items (animationService's resolveStaticExportItems). Resolves to
// { blob, filename, plan, dpi }.
export async function buildCardPdf({ card, pages, items, projectName, watermark = false, onProgress, signal, dpi = printDpi() }) {
  const plan = buildPrintPlan(card);
  const panelPageIds = plan.pages.flatMap((p) => p.slots.map((s) => s.page?.id).filter(Boolean));
  const pixelScale = dpi / PX_PER_INCH;

  onProgress?.({ stage: "preparing" });
  const preflight = await runExportPreflight({ pages, items }, { pageIds: panelPageIds, pixelScale });
  onProgress?.({ stage: "loading-fonts" });
  await preloadExportFonts(preflight.fontFamilies);

  let pdf = null;
  const total = plan.pages.reduce((n, p) => n + p.slots.length, 0);
  let done = 0;

  for (const sheet of plan.pages) {
    const w = pt(sheet.pageWidthIn);
    const h = pt(sheet.pageHeightIn);
    const orientation = w > h ? "landscape" : "portrait";
    if (!pdf) pdf = new jsPDF({ unit: "pt", format: [w, h], orientation, compress: true });
    else pdf.addPage([w, h], orientation);

    for (const slot of sheet.slots) {
      if (signal?.aborted) throw new ExportCancelledError();
      onProgress?.({ stage: "rendering", index: done, total, panel: slot.panel });
      done += 1;
      if (!slot.page) continue;
      // eslint-disable-next-line no-await-in-loop
      let canvas = await renderPageToCanvas({
        page: slot.page,
        items,
        pixelScale,
        backgroundFill: slot.page.background || "#ffffff",
        availableAssetIds: preflight.availableAssetIds,
        region: slot.region,
        signal,
      });
      if (watermark) drawWatermark(canvas);
      if (slot.rotation % 360 === 180) canvas = rotateCanvas180(canvas);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      canvas.width = 0;
      canvas.height = 0;
      pdf.addImage(dataUrl, "JPEG", pt(slot.place.x), pt(slot.place.y), pt(slot.place.width), pt(slot.place.height), undefined, "NONE");
      // eslint-disable-next-line no-await-in-loop
      await yieldToMainThread();
    }

    if (plan.hasMarks) drawCropMarks(pdf, sheet.trim, plan);
    if (plan.cutMarks) drawCutMarks(pdf, sheet);
    if (plan.hasMarks || plan.printFoldLine) drawFolds(pdf, sheet, plan);
  }

  onProgress?.({ stage: "finalizing" });
  pdf.setProperties({
    title: (projectName || "Greeting card").trim() || "Greeting card",
    subject: "Print-ready greeting card",
    creator: "Vaycona",
  });
  const blob = pdf.output("blob");
  return { blob, filename: buildExportFilename(`${projectName || "greeting-card"}-print`, { extension: "pdf" }), plan, dpi };
}
