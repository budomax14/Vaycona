// Canonical storage unit is always px. 96 px/inch matches the standard
// CSS definition of a pixel, so "inches" here means the same thing an
// inch means anywhere else in CSS.
const PX_PER_INCH = 96;

export const UNITS = [
  { key: "px", label: "Pixels (px)", toPx: (v) => v, fromPx: (px) => px },
  { key: "in", label: "Inches (in)", toPx: (v) => v * PX_PER_INCH, fromPx: (px) => px / PX_PER_INCH },
  {
    key: "cm",
    label: "Centimeters (cm)",
    toPx: (v) => (v * PX_PER_INCH) / 2.54,
    fromPx: (px) => (px * 2.54) / PX_PER_INCH,
  },
  {
    key: "mm",
    label: "Millimeters (mm)",
    toPx: (v) => (v * PX_PER_INCH) / 25.4,
    fromPx: (px) => (px * 25.4) / PX_PER_INCH,
  },
];

export function getUnit(key) {
  return UNITS.find((unit) => unit.key === key) || UNITS[0];
}

// `category`/`orientation` (Phase 8) are additive — every pre-existing
// consumer (ResizeModal.jsx) only ever destructured key/label/width/height,
// so this doesn't change that behavior. This remains the ONE place preset
// dimensions live (spec §33) — the Phase 8 template/new-design UI reuses
// this list rather than hardcoding its own.
export const PAGE_SIZE_PRESETS = [
  { key: "presentation-16-9", label: "Presentation (16:9)", width: 1920, height: 1080, category: "documents", orientation: "landscape" },
  { key: "presentation-4-3", label: "Presentation (4:3)", width: 1024, height: 768, category: "documents", orientation: "landscape" },
  { key: "instagram-post", label: "Instagram Post", width: 1080, height: 1080, category: "social", orientation: "square" },
  { key: "instagram-story", label: "Instagram Story", width: 1080, height: 1920, category: "social", orientation: "portrait" },
  { key: "facebook-post", label: "Facebook Post", width: 1200, height: 630, category: "social", orientation: "landscape" },
  { key: "youtube-thumbnail", label: "YouTube Thumbnail", width: 1280, height: 720, category: "video", orientation: "landscape" },
  { key: "flyer", label: "Flyer", width: 1275, height: 1650, category: "print", orientation: "portrait" },
  { key: "poster", label: "Poster", width: 1728, height: 2304, category: "print", orientation: "portrait" },
  { key: "business-card", label: "Business Card", width: 336, height: 192, category: "business", orientation: "landscape" },
  { key: "wedding-invitation", label: "Wedding Invitation", width: 500, height: 700, category: "invitations", orientation: "portrait" },
  { key: "birthday-invitation", label: "Birthday Invitation", width: 500, height: 700, category: "invitations", orientation: "portrait" },
  { key: "thank-you-card", label: "Thank-You Card", width: 420, height: 594, category: "invitations", orientation: "portrait" },
  { key: "book-cover", label: "Book Cover", width: 1200, height: 1800, category: "books", orientation: "portrait" },
  { key: "letter", label: "Letter", width: 816, height: 1056, category: "documents", orientation: "portrait" },
  { key: "a4", label: "A4", width: 794, height: 1123, category: "documents", orientation: "portrait" },
  { key: "website-desktop", label: "Website (Desktop)", width: 1440, height: 1024, category: "marketing", orientation: "landscape" },
];

export function findMatchingPreset(width, height) {
  return PAGE_SIZE_PRESETS.find((preset) => preset.width === width && preset.height === height) || null;
}

export function orientationOf(width, height) {
  if (width === height) return "square";
  return width > height ? "landscape" : "portrait";
}
