// Print Layout system — the registry of printable, multi-panel products.
//
// A product describes a physical object (a folded card today; flyers,
// postcards, brochures, menus, programs later) purely as data: which
// design panels it has, how those panels are arranged ("imposed") onto
// the printed sheets, and where the folds are. Everything else — the
// editor's panel tabs, fold/safe/bleed guides, the print PDF, the sheet
// preview and the duplex instructions — is derived from that data by the
// generic helpers below, so adding a new product never means touching the
// PDF builder or the UI.
//
// Panels are edited as ordinary Vaycona pages (see cardProject.js); a
// product only ever says where each page lands on paper.

import { getPaperSize, inchesToPx } from "./paperSizes";

export const BLEED_IN = 0.125;
export const SAFE_MARGIN_IN = 0.25;

// Half-fold greeting card: one sheet, landscape, folded once down the
// middle. Outside = Back | Front, Inside = Inside Left | Inside Right, so
// the front cover ends up on the right-hand half of the outside face and
// the whole card opens like a book.
const HALF_FOLD_CARD = {
  id: "half-fold-card",
  type: "greeting-card",
  foldType: "half-fold",
  sheetOrientation: "landscape",
  grid: { cols: 2, rows: 1 },
  panels: ["front", "insideLeft", "insideRight", "back"],
  primaryPanel: "front",
  sheets: [
    {
      key: "outside",
      slots: [
        { panel: "back", col: 0, row: 0, rotation: 0 },
        { panel: "front", col: 1, row: 0, rotation: 0 },
      ],
    },
    {
      key: "inside",
      slots: [
        { panel: "insideLeft", col: 0, row: 0, rotation: 0 },
        { panel: "insideRight", col: 1, row: 0, rotation: 0 },
      ],
    },
  ],
  // Fractions of the sheet's own width/height.
  folds: [{ orientation: "vertical", position: 0.5 }],
  // Which panels share one piece of paper once printed on both sides.
  // Used to DERIVE the duplex flip edge (deriveDuplexFlip) instead of
  // hard-coding it.
  backToBack: [
    ["front", "insideLeft"],
    ["back", "insideRight"],
  ],
};

const PRODUCTS = {
  [HALF_FOLD_CARD.id]: HALF_FOLD_CARD,
};

export function getPrintProduct(id) {
  return PRODUCTS[id] || null;
}

export function sheetSizeIn(product, paperKey) {
  const paper = getPaperSize(paperKey);
  return product.sheetOrientation === "landscape"
    ? { widthIn: paper.heightIn, heightIn: paper.widthIn }
    : { widthIn: paper.widthIn, heightIn: paper.heightIn };
}

export function panelSizeIn(product, paperKey) {
  const sheet = sheetSizeIn(product, paperKey);
  return { widthIn: sheet.widthIn / product.grid.cols, heightIn: sheet.heightIn / product.grid.rows };
}

// The editor page size (px) a panel should have on the given paper.
export function panelSizePx(product, paperKey) {
  const { widthIn, heightIn } = panelSizeIn(product, paperKey);
  return { width: Math.round(inchesToPx(widthIn)), height: Math.round(inchesToPx(heightIn)) };
}

// Every sheet with every slot's physical rectangle (inches, from the
// sheet's top-left, trim box — bleed is added by the PDF builder).
export function layoutSheets(product, paperKey) {
  const sheet = sheetSizeIn(product, paperKey);
  const cell = panelSizeIn(product, paperKey);
  return product.sheets.map((s) => ({
    key: s.key,
    widthIn: sheet.widthIn,
    heightIn: sheet.heightIn,
    slots: s.slots.map((slot) => ({
      ...slot,
      xIn: slot.col * cell.widthIn,
      yIn: slot.row * cell.heightIn,
      widthIn: cell.widthIn,
      heightIn: cell.heightIn,
    })),
  }));
}

function findSlot(product, panel) {
  for (let i = 0; i < product.sheets.length; i++) {
    const slot = product.sheets[i].slots.find((s) => s.panel === panel);
    if (slot) return { sheetIndex: i, slot };
  }
  return null;
}

// Rotating a slot by 180° swaps which of the panel's own edges faces which
// side of the sheet.
function sheetEdgeToPanelEdge(edge, rotation) {
  if (rotation % 360 !== 180) return edge;
  return { left: "right", right: "left", top: "bottom", bottom: "top" }[edge];
}

// For each of a panel's own edges (in the panel's upright editor frame):
// "fold" if a fold line runs along it, "outer" if it's the sheet's edge,
// "inner" if it only borders another panel (a cut line, for future
// products). Derived from the slot grid + fold list.
export function panelEdges(product, panel) {
  const found = findSlot(product, panel);
  if (!found) return null;
  const { slot } = found;
  const { cols, rows } = product.grid;
  const isFoldAt = (orientation, position) => product.folds.some((f) => f.orientation === orientation && Math.abs(f.position - position) < 1e-6);
  const sheetEdges = {
    left: slot.col === 0 ? "outer" : isFoldAt("vertical", slot.col / cols) ? "fold" : "inner",
    right: slot.col === cols - 1 ? "outer" : isFoldAt("vertical", (slot.col + 1) / cols) ? "fold" : "inner",
    top: slot.row === 0 ? "outer" : isFoldAt("horizontal", slot.row / rows) ? "fold" : "inner",
    bottom: slot.row === rows - 1 ? "outer" : isFoldAt("horizontal", (slot.row + 1) / rows) ? "fold" : "inner",
  };
  const result = {};
  Object.entries(sheetEdges).forEach(([edge, kind]) => {
    result[sheetEdgeToPanelEdge(edge, slot.rotation)] = kind;
  });
  return result;
}

// Works out how the sheet must be turned over between side 1 and side 2 so
// every back-to-back pair really ends up on the same piece of paper, the
// same way up. Tries both possible flips against the actual imposition:
//   - about the sheet's vertical axis: x -> W - x, "up" stays up
//   - about its horizontal axis:       y -> H - y, "up" becomes down
// and returns which one works plus the printer-dialog name for it (the
// axis runs parallel to either the sheet's short or long edge). Returns
// null if neither works (a misconfigured product — caught by tests).
// `sheets` defaults to the product's own layout; printPlan.js passes the
// final (possibly second-side-rotated) layout it actually prints.
export function deriveDuplexFlip(product, paperKey, sheets = layoutSheets(product, paperKey)) {
  if (sheets.length !== 2) return null;
  const [sideA, sideB] = sheets;
  const W = sideA.widthIn;
  const H = sideA.heightIn;

  const candidates = [
    { axis: "vertical", mirror: (x, y) => ({ x: W - x, y }), rotationDelta: 0 },
    { axis: "horizontal", mirror: (x, y) => ({ x, y: H - y }), rotationDelta: 180 },
  ];

  const works = (candidate) =>
    product.backToBack.every(([p, q]) => {
      const aSlot = sideA.slots.find((s) => s.panel === p) || sideA.slots.find((s) => s.panel === q);
      const partner = aSlot.panel === p ? q : p;
      const center = candidate.mirror(aSlot.xIn + aSlot.widthIn / 2, aSlot.yIn + aSlot.heightIn / 2);
      const bSlot = sideB.slots.find(
        (s) => center.x > s.xIn && center.x < s.xIn + s.widthIn && center.y > s.yIn && center.y < s.yIn + s.heightIn
      );
      if (!bSlot || bSlot.panel !== partner) return false;
      return ((bSlot.rotation - aSlot.rotation - candidate.rotationDelta) % 360 + 360) % 360 === 0;
    });

  const match = candidates.find(works);
  if (!match) return null;
  const axisParallelToWidth = match.axis === "horizontal";
  const parallelEdgeLength = axisParallelToWidth ? W : H;
  const otherEdgeLength = axisParallelToWidth ? H : W;
  return { axis: match.axis, edge: parallelEdgeLength <= otherEdgeLength ? "short" : "long" };
}
