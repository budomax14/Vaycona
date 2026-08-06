// Shared dash-pattern math for the "Border style" control (shapes' stroke,
// text/frame boxes' border) — kept separate from lineKinds.js's own dash
// arrays because those are fixed pixel patterns tuned for a specific
// default stroke width, while borders have a user-adjustable width and need
// the pattern to scale with it (a thick dashed border with a tiny fixed gap
// reads as solid; a thin one with a huge fixed gap reads as barely there).
export const BORDER_STYLE_OPTIONS = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
];

// Spread onto a Konva node alongside stroke/strokeWidth. Returns {} for
// "solid" (or anything unrecognized) — Konva already renders a plain line
// when no `dash` is set, so solid needs no extra props.
export function borderDashProps(style, strokeWidth) {
  const width = Math.max(1, strokeWidth || 1);
  if (style === "dashed") return { dash: [width * 3, width * 2] };
  if (style === "dotted") return { dash: [width * 0.01, width * 1.8], lineCap: "round" };
  return {};
}
