// Physical paper sizes for the Print Layout system. Everything here is in
// real-world units (inches, plus PDF points) — never editor px — so the
// print PDF can be sized to the actual sheet regardless of how the panels
// happen to be stored in the editor (see pageSizes.js: 96 editor px = 1in).

export const PX_PER_INCH = 96;
export const PT_PER_INCH = 72;
export const MM_PER_INCH = 25.4;

// Portrait dimensions; a product decides the sheet orientation itself.
export const PAPER_SIZES = {
  letter: { key: "letter", label: "US Letter", widthIn: 8.5, heightIn: 11, dimensionsLabel: "8.5 × 11 in" },
  a4: { key: "a4", label: "A4", widthIn: 210 / MM_PER_INCH, heightIn: 297 / MM_PER_INCH, dimensionsLabel: "210 × 297 mm" },
};

export const PAPER_SIZE_KEYS = Object.keys(PAPER_SIZES);

export function getPaperSize(key) {
  return PAPER_SIZES[key] || PAPER_SIZES.letter;
}

// Regions that use US Letter as their everyday paper size. Everyone else
// defaults to A4. A bare language tag with no region (e.g. "en") is treated
// as Letter, matching the app's US-first default.
const LETTER_REGIONS = new Set(["US", "CA", "MX", "PH", "CL", "CO", "VE", "GT", "CR", "PR", "DO", "SV", "NI", "PA", "BZ"]);

export function defaultPaperSizeKey() {
  try {
    const locales = navigator.languages?.length ? navigator.languages : [navigator.language];
    const tag = locales.find(Boolean) || "en-US";
    const region = tag.split(/[-_]/)[1]?.toUpperCase();
    if (!region) return "letter";
    return LETTER_REGIONS.has(region) ? "letter" : "a4";
  } catch {
    return "letter";
  }
}

export function inchesToPx(inches) {
  return inches * PX_PER_INCH;
}

export function inchesToPt(inches) {
  return inches * PT_PER_INCH;
}

export function formatInches(value) {
  return `${Math.round(value * 100) / 100}`;
}

export function formatMm(inches) {
  return `${Math.round(inches * MM_PER_INCH * 10) / 10}`;
}
