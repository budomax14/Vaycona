// Phase 9 — shared limits/defaults for the design export pipeline. Kept
// separate from constants.js because these are export-specific (not
// referenced by the editor/autosave/import code at all), but follow the
// same "one place for tunable numbers" convention.

export const EXPORT_FORMATS = ["png", "jpeg", "pdf", "svg"];

export const SCALE_PRESETS = [0.5, 1, 2, 3, 4];

// Hard safety ceilings (spec §8) — generous for a personal browser editor,
// but bounded so a runaway scale/custom-size request can't allocate a
// canvas large enough to freeze or crash the tab. Chromium/Firefox both
// refuse canvases beyond roughly 16384px per side or ~268 megapixels in
// practice; these stay comfortably under that with headroom for the
// system's own memory pressure.
export const MAX_EXPORT_DIMENSION_PX = 10000; // per side, any single page
export const MAX_EXPORT_PIXELS_PER_PAGE = 40_000_000; // ~40MP per rendered page
export const MAX_EXPORT_TOTAL_PIXELS = 160_000_000; // across every page in one export run
export const MAX_EXPORT_PAGE_COUNT = 60; // pages in a single export run (PDF page count included)
export const MAX_ZIP_OUTPUT_BYTES = 500 * 1024 * 1024; // 500MB packaged archive

// JPEG quality presets shown to the user as understandable labels rather
// than a bare decimal (spec §26/§27).
export const JPEG_QUALITY_PRESETS = {
  small: { label: "Smaller file", value: 0.6 },
  balanced: { label: "Balanced", value: 0.8 },
  high: { label: "High quality", value: 0.92 },
  maximum: { label: "Maximum quality", value: 1 },
};
export const DEFAULT_JPEG_QUALITY = "high";

// Print PDF bleed presets, in inches — converted to px via pageSizes.js's
// existing unit table (96px/in) so bleed uses the exact same conversion
// the rest of the app already relies on.
export const BLEED_PRESETS = [
  { key: "none", label: "No bleed", inches: 0 },
  { key: "standard", label: "Standard (0.125 in)", inches: 0.125 },
  { key: "custom", label: "Custom", inches: null },
];

export const CROP_MARK_LENGTH_PX = 18;
export const CROP_MARK_OFFSET_PX = 6; // gap between trim edge and the start of the mark
export const CROP_MARK_STROKE_WIDTH = 0.75;

// Standard vs print default render scale (px-per-page-px) when the user
// hasn't picked a custom one — print defaults higher for sharper output.
export const DEFAULT_STANDARD_SCALE = 1;
export const DEFAULT_PRINT_SCALE = 2;

// Below this effective pixel density we warn that a source image may look
// blurry at the requested export size (spec §16) — i.e. the image is being
// asked to cover more on-canvas area per source pixel than this.
export const LOW_RES_WARNING_THRESHOLD = 0.75; // source px per output px

export const EXPORT_SETTINGS_STORAGE_KEY = "personal-canva-export-settings-v1";

// Phase 12 — animated (GIF/video) export safety limits. Deliberately
// smaller than the static-image ceilings above: every extra frame
// multiplies memory/render cost, so an animated export needs a tighter
// total budget even though a single frame is well within the static limits.
export const ANIMATED_EXPORT_FORMATS = ["gif", "webm"];
export const MAX_ANIMATED_EXPORT_DIMENSION_PX = 2000; // per side
export const MAX_ANIMATED_EXPORT_PIXELS = 2_000_000; // per frame
export const MAX_ANIMATED_EXPORT_FRAME_COUNT = 600; // ~20s at 30fps, or 40s at 15fps
export const MAX_ANIMATED_EXPORT_DURATION_MS = 60_000; // 60s of exported playback total
export const FRAME_RATE_PRESETS = [15, 24, 30, 60];
export const DEFAULT_ANIMATED_EXPORT_FPS = 30;
export const GIF_MAX_COLORS = 256;
export const DEFAULT_GIF_QUALITY_STEPS = 10; // gifenc quantize "quality" — lower is better/slower
