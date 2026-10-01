// Pure label-sheet geometry, derived from a template (labelTemplates.js).
// No DOM, no jsPDF: the editor guides, the sheet map, the print preview and
// labelPdf.js all read the same numbers from here, so what's shown is what
// prints. Positions are inches from the paper's top-left corner.

import { getPaperSize, inchesToPx } from "./paperSizes";

const EPSILON_IN = 0.001;

// Margins left out of a template center the labels on that axis.
function resolvedMargins(template) {
  const paper = getPaperSize(template.paper);
  const { columns, rows, label, spacing = {} } = template;
  const gapX = spacing.horizontalIn || 0;
  const gapY = spacing.verticalIn || 0;
  const usedW = columns * label.widthIn + (columns - 1) * gapX;
  const usedH = rows * label.heightIn + (rows - 1) * gapY;
  const left = template.margins?.leftIn ?? (paper.widthIn - usedW) / 2;
  const top = template.margins?.topIn ?? (paper.heightIn - usedH) / 2;
  return { top, left, right: paper.widthIn - left - usedW, bottom: paper.heightIn - top - usedH };
}

// { paper, label, margins, count, slots: [{ index, row, col, xIn, yIn,
// widthIn, heightIn }] } — slots in reading order (left→right, top→bottom),
// which is also the order the labels are numbered in the UI.
export function labelSheetLayout(template) {
  const paper = getPaperSize(template.paper);
  const margins = resolvedMargins(template);
  const { columns, rows, label, spacing = {} } = template;
  const pitchX = label.widthIn + (spacing.horizontalIn || 0);
  const pitchY = label.heightIn + (spacing.verticalIn || 0);
  const slots = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      slots.push({
        index: row * columns + col,
        row,
        col,
        xIn: margins.left + col * pitchX,
        yIn: margins.top + row * pitchY,
        widthIn: label.widthIn,
        heightIn: label.heightIn,
      });
    }
  }
  return { paper: { widthIn: paper.widthIn, heightIn: paper.heightIn, key: paper.key }, label, margins, count: slots.length, slots };
}

export function labelCount(template) {
  return template.columns * template.rows;
}

// The editor page size (px) of one label.
export function labelSizePx(template) {
  return { width: Math.round(inchesToPx(template.label.widthIn)), height: Math.round(inchesToPx(template.label.heightIn)) };
}

// Problems that would make a template print wrongly; [] when it's sound.
export function validateLabelTemplate(template) {
  const problems = [];
  if (!template?.id) problems.push("missing id");
  if (!getPaperSize(template.paper) || getPaperSize(template.paper).key !== template.paper) problems.push(`unknown paper "${template.paper}"`);
  const { label, columns, rows, spacing = {} } = template;
  if (!(label?.widthIn > 0 && label?.heightIn > 0)) problems.push("label size must be positive");
  if (!(Number.isInteger(columns) && columns > 0 && Number.isInteger(rows) && rows > 0)) problems.push("rows/columns must be positive integers");
  if ((spacing.horizontalIn || 0) < 0 || (spacing.verticalIn || 0) < 0) problems.push("spacing can't be negative (labels would overlap)");
  if (label?.shape === "circle" && Math.abs(label.widthIn - label.heightIn) > EPSILON_IN) problems.push("circle labels need equal width and height");
  if (problems.length) return problems;
  const m = resolvedMargins(template);
  if (m.left < -EPSILON_IN || m.right < -EPSILON_IN) problems.push(`labels don't fit across the paper (left ${m.left.toFixed(3)}in, right ${m.right.toFixed(3)}in)`);
  if (m.top < -EPSILON_IN || m.bottom < -EPSILON_IN) problems.push(`labels don't fit down the paper (top ${m.top.toFixed(3)}in, bottom ${m.bottom.toFixed(3)}in)`);
  return problems;
}

// Corner radius in the given units for a w × h label (0 for rectangles).
export function labelCornerRadius(label, w, h, unitsPerInch) {
  if (label.shape === "rounded") return Math.min(w / 2, h / 2, (label.cornerRadiusIn || 0) * unitsPerInch);
  return 0;
}

// Traces the label's outline as a path on a canvas-like context (a 2D
// canvas context or Konva's Context wrapper — both expose these calls).
// Doesn't stroke/fill/clip; the caller does.
export function traceLabelShape(ctx, label, w, h, unitsPerInch) {
  ctx.beginPath();
  if (label.shape === "circle" || label.shape === "oval") {
    const rx = w / 2;
    const ry = h / 2;
    // ellipse() isn't on Konva's Context wrapper; scale a unit circle.
    ctx.save();
    ctx.translate(rx, ry);
    ctx.scale(rx, ry);
    ctx.arc(0, 0, 1, 0, Math.PI * 2, false);
    ctx.restore();
    ctx.closePath();
    return;
  }
  const r = labelCornerRadius(label, w, h, unitsPerInch);
  if (r <= 0) {
    ctx.rect(0, 0, w, h);
    ctx.closePath();
    return;
  }
  ctx.moveTo(r, 0);
  ctx.lineTo(w - r, 0);
  ctx.arc(w - r, r, r, -Math.PI / 2, 0, false);
  ctx.lineTo(w, h - r);
  ctx.arc(w - r, h - r, r, 0, Math.PI / 2, false);
  ctx.lineTo(r, h);
  ctx.arc(r, h - r, r, Math.PI / 2, Math.PI, false);
  ctx.lineTo(0, r);
  ctx.arc(r, r, r, Math.PI, Math.PI * 1.5, false);
  ctx.closePath();
}

// The same outline as an SVG path `d` (editor overlay, sheet map, preview).
export function labelShapeSvgPath(label, w, h, unitsPerInch, x = 0, y = 0) {
  if (label.shape === "circle" || label.shape === "oval") {
    const rx = w / 2;
    const ry = h / 2;
    return `M${x},${y + ry}a${rx},${ry} 0 1,0 ${w},0a${rx},${ry} 0 1,0 ${-w},0Z`;
  }
  const r = labelCornerRadius(label, w, h, unitsPerInch);
  if (r <= 0) return `M${x},${y}h${w}v${h}h${-w}Z`;
  return `M${x + r},${y}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 ${-r},${r}h${-(w - 2 * r)}a${r},${r} 0 0 1 ${-r},${-r}v${-(h - 2 * r)}a${r},${r} 0 0 1 ${r},${-r}Z`;
}

// Which page prints in each position, at its exact physical place on the
// paper. `sheet`: getLabelSheetProject(). The printer-alignment offset
// (settings.offsetXIn/offsetYIn) shifts every label together — it
// compensates for a printer that feeds the paper slightly off, and is
// the only thing that ever moves a label from the template's position.
export function buildLabelPrintPlan(sheet) {
  const layout = labelSheetLayout(sheet.template);
  const { offsetXIn = 0, offsetYIn = 0 } = sheet.settings;
  const slots = layout.slots.map((slot) => ({
    ...slot,
    page: sheet.pageForSlot(slot.index),
    xIn: slot.xIn + offsetXIn,
    yIn: slot.yIn + offsetYIn,
  }));
  return {
    paperWidthIn: layout.paper.widthIn,
    paperHeightIn: layout.paper.heightIn,
    paperKey: layout.paper.key,
    label: layout.label,
    slots,
    // Each distinct page renders once, however many positions use it.
    uniquePages: [...new Map(slots.filter((s) => s.page).map((s) => [s.page.id, s.page])).values()],
  };
}

// "2.625 × 1 in" (inch papers) or "63.5 × 38.1 mm" (A4 and other metric).
export function formatLabelSize(template) {
  const { widthIn, heightIn } = template.label;
  if (template.paper !== "letter") return `${Math.round(widthIn * 254) / 10} × ${Math.round(heightIn * 254) / 10} mm`;
  const r = (v) => Math.round(v * 1000) / 1000;
  return `${r(widthIn)} × ${r(heightIn)} in`;
}
