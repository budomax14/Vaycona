// Pure print geometry: turns a card project + its settings into exactly
// what goes on each PDF page — page size, where each panel lands, which
// part of each panel to render (including bleed), and where fold/trim
// marks go. No DOM, no jsPDF: printPdf.js draws this plan, the sheet
// preview shows it, and it can be verified on its own.
//
// All positions here are inches from the PDF page's top-left.

import { PX_PER_INCH } from "./paperSizes";
import { BLEED_IN, SAFE_MARGIN_IN, deriveDuplexFlip, layoutSheets } from "./printProducts";

// Room outside the bleed for crop/fold marks (professional printing only).
export const MARK_OFFSET_IN = 0.0625;
export const MARK_LENGTH_IN = 0.1875;
export const MARK_MARGIN_IN = MARK_OFFSET_IN + MARK_LENGTH_IN;

// "Cut to size" (settings.edgeMode === "trim"): most home printers can't
// put ink on the outer ~3–6mm of the paper, so the card is printed this far
// inside every paper edge, with its design running CUT_BLEED_IN past the cut
// lines, and the user trims along the cut marks.
export const CUT_MARGIN_IN = 0.25;
export const CUT_BLEED_IN = 0.125;
export const CUT_MARK_GAP_IN = 0.02;
export const CUT_MARK_LENGTH_IN = 0.18;

function swapForRotation(ext, rotation) {
  if (rotation % 360 !== 180) return ext;
  return { left: ext.right, right: ext.left, top: ext.bottom, bottom: ext.top };
}

export function buildPrintPlan(card) {
  const { product, settings, panels } = card;
  // Borderless and Cut to size both need the PDF page to be exactly the
  // paper, so the professional bleed/crop-mark options only apply to
  // Standard.
  const edgeMode = settings.edgeMode || "standard";
  const cutToSize = edgeMode === "trim";
  const proPrint = edgeMode === "standard";
  const bleedIn = cutToSize ? CUT_BLEED_IN : proPrint && settings.bleed ? BLEED_IN : 0;
  const hasMarks = proPrint && settings.printGuides && settings.bleed;
  const marginIn = cutToSize ? CUT_MARGIN_IN : bleedIn + (hasMarks ? MARK_MARGIN_IN : 0);
  const { cols, rows } = product.grid;
  // The product's own layout pairs up correctly for one flip edge. Printed
  // with the other edge (e.g. the long-edge default in Safari/macOS/iOS
  // for a half-fold card), the whole second side lands rotated 180° —
  // upside down, halves swapped. So when the chosen printer setting isn't
  // the layout's natural one, pre-rotate the second side 180°.
  const natural = deriveDuplexFlip(product, settings.paperSize);
  const rotateSecondSide = !!natural && natural.edge !== settings.duplexEdge;
  const laidOut = layoutSheets(product, settings.paperSize).map((sheet, index) =>
    index > 0 && rotateSecondSide
      ? {
          ...sheet,
          slots: sheet.slots.map((slot) => ({
            ...slot,
            col: cols - 1 - slot.col,
            row: rows - 1 - slot.row,
            xIn: sheet.widthIn - slot.xIn - slot.widthIn,
            yIn: sheet.heightIn - slot.yIn - slot.heightIn,
            rotation: (slot.rotation + 180) % 360,
          })),
        }
      : sheet
  );
  // Cut to size: the card area shrinks by CUT_MARGIN_IN on every side and
  // is laid out on the same grid inside it (marginIn above puts it back
  // in the middle of the full-size paper page).
  const sheets = cutToSize
    ? laidOut.map((sheet) => {
        const widthIn = sheet.widthIn - CUT_MARGIN_IN * 2;
        const heightIn = sheet.heightIn - CUT_MARGIN_IN * 2;
        const cellW = widthIn / cols;
        const cellH = heightIn / rows;
        return {
          ...sheet,
          widthIn,
          heightIn,
          slots: sheet.slots.map((slot) => ({ ...slot, xIn: slot.col * cellW, yIn: slot.row * cellH, widthIn: cellW, heightIn: cellH })),
        };
      })
    : laidOut;

  const pages = sheets.map((sheet) => {
    const pageWidthIn = sheet.widthIn + marginIn * 2;
    const pageHeightIn = sheet.heightIn + marginIn * 2;
    const trim = { x: marginIn, y: marginIn, width: sheet.widthIn, height: sheet.heightIn };

    const slots = sheet.slots.map((slot) => {
      const page = panels[slot.panel] || null;
      // Bleed only extends a panel past the sheet's own outer edges — never
      // across a fold into the neighbouring panel.
      const sheetExt = {
        left: slot.col === 0 ? bleedIn : 0,
        right: slot.col === cols - 1 ? bleedIn : 0,
        top: slot.row === 0 ? bleedIn : 0,
        bottom: slot.row === rows - 1 ? bleedIn : 0,
      };
      const place = {
        x: trim.x + slot.xIn - sheetExt.left,
        y: trim.y + slot.yIn - sheetExt.top,
        width: slot.widthIn + sheetExt.left + sheetExt.right,
        height: slot.heightIn + sheetExt.top + sheetExt.bottom,
      };
      // The same extension in the panel's own (upright) editor frame, in
      // editor px — what the renderer is asked to draw.
      const panelExt = swapForRotation(sheetExt, slot.rotation);
      const scaleX = page ? page.width / (slot.widthIn * PX_PER_INCH) : 1;
      const scaleY = page ? page.height / (slot.heightIn * PX_PER_INCH) : 1;
      let region = page
        ? {
            x: -panelExt.left * PX_PER_INCH * scaleX,
            y: -panelExt.top * PX_PER_INCH * scaleY,
            width: page.width + (panelExt.left + panelExt.right) * PX_PER_INCH * scaleX,
            height: page.height + (panelExt.top + panelExt.bottom) * PX_PER_INCH * scaleY,
          }
        : null;
      if (page && cutToSize) {
        // The smaller finished panel isn't exactly the design's shape, so
        // scale the design uniformly to cover it (never stretch), centered;
        // the sliver cropped off stays well inside the safe margin.
        const k = Math.min(page.width / slot.widthIn, page.height / slot.heightIn); // design px per paper inch
        const visibleW = slot.widthIn * k;
        const visibleH = slot.heightIn * k;
        region = {
          x: (page.width - visibleW) / 2 - panelExt.left * k,
          y: (page.height - visibleH) / 2 - panelExt.top * k,
          width: visibleW + (panelExt.left + panelExt.right) * k,
          height: visibleH + (panelExt.top + panelExt.bottom) * k,
        };
      }
      return { panel: slot.panel, page, rotation: slot.rotation, trim: { x: trim.x + slot.xIn, y: trim.y + slot.yIn, width: slot.widthIn, height: slot.heightIn }, place, region };
    });

    const folds = product.folds.map((fold) =>
      fold.orientation === "vertical"
        ? { orientation: "vertical", x1: trim.x + trim.width * fold.position, y1: trim.y, x2: trim.x + trim.width * fold.position, y2: trim.y + trim.height }
        : { orientation: "horizontal", x1: trim.x, y1: trim.y + trim.height * fold.position, x2: trim.x + trim.width, y2: trim.y + trim.height * fold.position }
    );

    return { key: sheet.key, pageWidthIn, pageHeightIn, trim, slots, folds };
  });

  return {
    pages,
    bleedIn,
    marginIn,
    hasMarks,
    edgeMode,
    cutMarks: cutToSize,
    // Guides print only when explicitly enabled — with room outside the
    // trim they're proper crop/fold marks; on an exact-paper-size home
    // print the only thing that can be shown is a light fold line.
    printFoldLine: !cutToSize && settings.printGuides && !hasMarks,
    // Derived from the sheets actually printed, so the instructions always
    // match the PDF.
    duplex: deriveDuplexFlip(product, settings.paperSize, sheets),
    safeMarginIn: SAFE_MARGIN_IN,
  };
}
