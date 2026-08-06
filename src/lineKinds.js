// Local unrotated geometry for every line kind is always the segment
// (0,0)-(width,0) — height is always pinned to 0, and `rotation` (the same
// field every other object already uses) carries the angle. This means
// bounds.js/snapping.js/alignment.js need zero changes: they already only
// read x/y/width/height.
export const LINE_KINDS = {
  straight: { label: "Line", element: "line" },
  dashed: { label: "Dashed Line", element: "line", dash: [16, 10] },
  dotted: { label: "Dotted Line", element: "line", dash: [2, 8] },
  arrow: { label: "Arrow", element: "arrow", pointerAtEnding: true },
  doubleArrow: { label: "Double Arrow", element: "arrow", pointerAtEnding: true, pointerAtBeginning: true },
};

export const LINE_KIND_ORDER = Object.keys(LINE_KINDS);
