// Label-sheet templates — the registry of printable adhesive label sheets.
//
// A template describes one commercially available sheet purely as data:
// the paper, the size and shape of each label, how many rows/columns, the
// sheet's top/left margins and the gaps between labels. Everything else —
// the editor's label size and outline guides, the sheet map, the print
// preview and the print PDF — is derived from it by print/labelSheet.js,
// so adding a format never means touching the editor or the PDF builder.
//
// All measurements are physical inches (use mm() for metric sheets). Copy
// them from the manufacturer's template spec:
//
//   {
//     id: "letter-30-2625x1",       // stable — saved into projects; never
//                                   // change a shipped template's geometry,
//                                   // add a new id instead
//     name: "Address labels",
//     paper: "letter",              // a key of PAPER_SIZES (paperSizes.js)
//     label: {
//       widthIn, heightIn,
//       shape: "rectangle" | "rounded" | "circle" | "oval",
//       cornerRadiusIn,             // "rounded" only
//     },
//     columns, rows,
//     margins: { topIn, leftIn },   // to the first label's top-left edge;
//                                   // omit either to center on that axis
//     spacing: { horizontalIn, verticalIn }, // gap BETWEEN labels (not pitch)
//     safeInsetIn,                  // editor-only "keep text inside" guide
//     compatibleWith: [...],        // product codes shown to the user
//   }
//
// validateLabelTemplate() (labelSheet.js) checks that the labels fit on
// the paper and don't overlap.

import { MM_PER_INCH } from "./paperSizes";

export const LABEL_SHAPES = ["rectangle", "rounded", "circle", "oval"];

export function mm(value) {
  return value / MM_PER_INCH;
}

// 30 per sheet, 3 × 10, 2⅝ × 1 in — the standard US address label sheet.
// 3/16" side margins + 3 × 2.625" + 2 × 1/8" gaps = 8.5"; ½" top/bottom
// margins + 10 × 1" (no vertical gap) = 11".
const LETTER_30 = {
  id: "letter-30-2625x1",
  name: "Address labels",
  paper: "letter",
  label: { widthIn: 2.625, heightIn: 1, shape: "rounded", cornerRadiusIn: 0.0625 },
  columns: 3,
  rows: 10,
  margins: { topIn: 0.5, leftIn: 0.1875 },
  spacing: { horizontalIn: 0.125, verticalIn: 0 },
  safeInsetIn: 0.0625,
  compatibleWith: ["Avery 5160", "Avery 8160", "Avery 5260", "Avery 8460"],
};

// Add new sheets here (in the order they should be offered).
export const LABEL_TEMPLATES = [LETTER_30];

const BY_ID = Object.fromEntries(LABEL_TEMPLATES.map((t) => [t.id, t]));

export const DEFAULT_LABEL_TEMPLATE_ID = LETTER_30.id;

export function getLabelTemplate(id) {
  return BY_ID[id] || null;
}
