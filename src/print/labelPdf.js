// Print-ready PDF for a label sheet, plus the label images the print
// preview shows — both drawn through the same renderLabelCanvas(), so the
// preview is what prints.
//
// The PDF page is exactly the paper (US Letter = 612 × 792 pt). Each label
// is placed at its template position in true inches and is never scaled to
// fit anything. The PDF also asks viewers to print at actual size
// (/PrintScaling /None), though the printer dialog still has the final say,
// which is why the UI warns about "Fit to page".
//
// Each distinct label design renders once through the shared offscreen
// pipeline, then every position that uses it references that one embedded
// image. "Same design" mode is one render, however many labels the sheet
// has. Only one full-resolution label canvas exists at a time.

import jsPDF from "jspdf";
import { renderPageToCanvas, ExportCancelledError, yieldToMainThread } from "../export/offscreenRenderer";
import { runExportPreflight, preloadExportFonts } from "../export/exportPreflight";
import { buildExportFilename } from "../export/exportRequest";
import { drawWatermark } from "../export/exportWatermark";
import { isMobileDevice } from "../canvasPixelBudget";
import { PT_PER_INCH, PX_PER_INCH } from "./paperSizes";
import { buildLabelPrintPlan, labelCornerRadius, traceLabelShape } from "./labelSheet";

export const LABEL_DPI = { standard: 300, high: 600 };

// Phones stay at 300 — same memory reasoning as printPdf.js's MOBILE_PRINT_DPI.
export function labelPrintDpi(quality) {
  if (isMobileDevice()) return LABEL_DPI.standard;
  return LABEL_DPI[quality] || LABEL_DPI.standard;
}

const pt = (inches) => inches * PT_PER_INCH;

// Renders one label page and clips it to the label's shape (rounded
// corners, circle, oval) over white paper. Returns a canvas the caller
// must release (width = height = 0).
export async function renderLabelCanvas({ page, items, label, pixelScale, availableAssetIds, signal, watermark = false }) {
  const raw = await renderPageToCanvas({
    page,
    items,
    pixelScale,
    backgroundFill: page.background || "#ffffff",
    availableAssetIds,
    signal,
  });
  if (watermark) drawWatermark(raw);
  const out = document.createElement("canvas");
  out.width = raw.width;
  out.height = raw.height;
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.save();
  traceLabelShape(ctx, label, out.width, out.height, out.width / label.widthIn);
  ctx.clip();
  ctx.drawImage(raw, 0, 0);
  ctx.restore();
  raw.width = 0;
  raw.height = 0;
  return out;
}

function drawOutline(pdf, label, slot) {
  const x = pt(slot.xIn);
  const y = pt(slot.yIn);
  const w = pt(slot.widthIn);
  const h = pt(slot.heightIn);
  if (label.shape === "circle" || label.shape === "oval") {
    pdf.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, "S");
    return;
  }
  const r = labelCornerRadius(label, w, h, PT_PER_INCH);
  if (r > 0) pdf.roundedRect(x, y, w, h, r, r, "S");
  else pdf.rect(x, y, w, h, "S");
}

// `sheet`: getLabelSheetProject(pages). `items`: already static-resolved
// export items. Resolves to { blob, filename, plan, dpi }.
export async function buildLabelSheetPdf({ sheet, pages, items, projectName, watermark = false, onProgress, signal, dpi = labelPrintDpi(sheet.settings.quality) }) {
  const plan = buildLabelPrintPlan(sheet);
  const pixelScale = dpi / PX_PER_INCH;

  onProgress?.({ stage: "preparing" });
  const preflight = await runExportPreflight({ pages, items }, { pageIds: plan.uniquePages.map((p) => p.id), pixelScale });
  onProgress?.({ stage: "loading-fonts" });
  await preloadExportFonts(preflight.fontFamilies);

  const w = pt(plan.paperWidthIn);
  const h = pt(plan.paperHeightIn);
  const pdf = new jsPDF({ unit: "pt", format: [w, h], orientation: w > h ? "landscape" : "portrait", compress: true });
  pdf.viewerPreferences({ PrintScaling: "None" });

  const total = plan.uniquePages.length;
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) throw new ExportCancelledError();
    const page = plan.uniquePages[i];
    onProgress?.({ stage: "rendering", index: i, total });
    // eslint-disable-next-line no-await-in-loop
    const canvas = await renderLabelCanvas({ page, items, label: plan.label, pixelScale, availableAssetIds: preflight.availableAssetIds, signal, watermark });
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    canvas.width = 0;
    canvas.height = 0;
    const alias = `label-${page.id}`;
    plan.slots
      .filter((slot) => slot.page?.id === page.id)
      .forEach((slot) => pdf.addImage(dataUrl, "JPEG", pt(slot.xIn), pt(slot.yIn), pt(slot.widthIn), pt(slot.heightIn), alias, "NONE"));
    // eslint-disable-next-line no-await-in-loop
    await yieldToMainThread();
  }

  if (sheet.settings.printOutlines) {
    pdf.setDrawColor(160, 160, 160);
    pdf.setLineWidth(0.5);
    plan.slots.forEach((slot) => drawOutline(pdf, plan.label, slot));
  }

  onProgress?.({ stage: "finalizing" });
  const title = (projectName || "Labels").trim() || "Labels";
  pdf.setProperties({ title, subject: `Print-ready label sheet (${sheet.template.name})`, creator: "Vaycona" });
  const blob = pdf.output("blob");
  return { blob, filename: buildExportFilename(`${projectName || "labels"}-print`, { extension: "pdf" }), plan, dpi };
}

// Preview images: { [pageId]: { url } } via onImage as each one finishes,
// so the sheet fills in progressively. Caller revokes the URLs.
export async function renderLabelPreviewImages({ pages, items, label, pxPerInch = isMobileDevice() ? 110 : 160, signal, onImage }) {
  if (pages.length === 0) return;
  const preflight = await runExportPreflight({ pages, items }, { pageIds: pages.map((p) => p.id), pixelScale: 1 });
  await preloadExportFonts(preflight.fontFamilies);
  for (const page of pages) {
    if (signal?.aborted) return;
    const pixelScale = (pxPerInch * label.widthIn) / page.width;
    // eslint-disable-next-line no-await-in-loop
    const canvas = await renderLabelCanvas({ page, items, label, pixelScale, availableAssetIds: preflight.availableAssetIds, signal });
    // eslint-disable-next-line no-await-in-loop
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    canvas.width = 0;
    canvas.height = 0;
    if (blob && !signal?.aborted) onImage(page.id, URL.createObjectURL(blob));
  }
}
