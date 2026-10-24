// Long-text handling for personalized text fields: shrink the font until
// the customer's text fits the box the business designed (never growing
// or moving the box), down to the field's minimum font size. Measures with
// richText.js's layoutRichText — the same line-wrapping RichTextNode draws
// with — so "fits" here means fits on the canvas and in the export.
import { applyTextToItem, baseFontSize, itemPlainText } from "../../functions/personalizationCore.mjs";
import { layoutRichText } from "../richText";
import { loadFont } from "../fontLibrary";

function measure(item, text, fontSize) {
  const next = applyTextToItem(item, text, fontSize);
  const padding = item.padding ?? 4;
  const maxWidth = Math.max(1, (item.width || 100) - padding * 2);
  const { lines, totalHeight } = layoutRichText(next.richText, {
    maxWidth,
    autoWidth: false,
    lineHeight: item.lineHeight || 1,
    align: item.align || "left",
    letterSpacing: item.letterSpacing || 0,
    paragraphSpacing: item.paragraphSpacing || 0,
    textTransform: item.textTransform || "none",
  });
  return {
    height: totalHeight + padding * 2,
    width: Math.max(0, ...lines.map((line) => line.width + line.indent)),
    maxWidth,
  };
}

// The area the text must fit: the box itself — or, if the designed text
// already measures a hair bigger than its box (auto-sized boxes are sized
// by the editor's own slightly different pass), that measured size, so
// the business's own default text is never reported as "too long".
function fitArea(item) {
  const original = measure(item, itemPlainText(item), baseFontSize(item));
  return {
    height: Math.max(item.height || 0, original.height) + 1,
    width: Math.max(original.maxWidth, original.width) + 1,
  };
}

function fitsAt(item, text, fontSize, area) {
  const m = measure(item, text, fontSize);
  return m.height <= area.height && m.width <= area.width;
}

// Returns { fits, fontSize } — the largest size from the designed size
// down to minFontSize (0.5px steps) at which `text` fits.
export function fitText(item, text, minFontSize) {
  const base = baseFontSize(item);
  if (!text || text === itemPlainText(item)) return { fits: true, fontSize: base };
  const area = fitArea(item);
  if (fitsAt(item, text, base, area)) return { fits: true, fontSize: base };
  const min = Math.min(base, minFontSize);
  if (!fitsAt(item, text, min, area)) return { fits: false, fontSize: min };
  let lo = min; // fits
  let hi = base; // doesn't
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2;
    if (fitsAt(item, text, mid, area)) lo = mid;
    else hi = mid;
  }
  return { fits: true, fontSize: Math.floor(lo * 2) / 2 };
}

// Canvas measures with a fallback font until the real one has loaded —
// load every font the design's text uses before fitting anything.
export async function loadDesignFonts(design) {
  const families = new Set();
  for (const item of design?.items || []) {
    if (item.type !== "text") continue;
    if (item.fontFamily) families.add(item.fontFamily);
    for (const p of item.richText || []) for (const r of p.runs || []) if (r.fontFamily) families.add(r.fontFamily);
  }
  await Promise.all([...families].map((name) => loadFont(name).catch(() => {})));
}
