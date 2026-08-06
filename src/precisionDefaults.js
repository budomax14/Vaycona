// Phase 10 — centralized defaults, presets, and factories for every durable
// precision-layout concept (guides + per-page grid/margins/safe-area/bleed/
// layout-grid/baseline-grid). One place these shapes are defined so
// App.jsx's migration, projectValidator.js's checks, and every settings UI
// all agree on the same defaults — mirrors how imageCrop.js/imageEffects.js
// centralize DEFAULT_CROP/DEFAULT_ADJUSTMENTS for Phase 6.

export const GUIDE_ORIENTATIONS = ["horizontal", "vertical"];

export const GUIDE_COLORS = [
  { key: "blue", value: "#2563eb" },
  { key: "red", value: "#dc2626" },
  { key: "green", value: "#16a34a" },
  { key: "purple", value: "#7c3aed" },
  { key: "orange", value: "#ea580c" },
  { key: "gray", value: "#6b7280" },
];
export const DEFAULT_GUIDE_COLOR = "blue";
export const MAX_GUIDE_LABEL_LENGTH = 40;
export const MAX_GUIDES_PER_PAGE = 200; // spec §85 — configurable-in-spirit; a single constant kept here

export function guideColorValue(key) {
  return GUIDE_COLORS.find((c) => c.key === key)?.value || GUIDE_COLORS[0].value;
}

export function isSafeGuideColorKey(key) {
  return GUIDE_COLORS.some((c) => c.key === key);
}

function sanitizeLabel(label) {
  if (typeof label !== "string") return "";
  // Strip control/markup characters — guide labels render as plain text
  // only, never HTML (spec §24/§91).
  return label.replace(/[<>]/g, "").trim().slice(0, MAX_GUIDE_LABEL_LENGTH);
}

// pageId: a real page id (page-scoped, the default for anything created
// from now on) or null (global — renders/snaps on every page; reserved for
// guides migrated from before Phase 10, see App.jsx's migrateGuides).
export function createGuide({ pageId, orientation, pos, color = DEFAULT_GUIDE_COLOR, locked = false, hidden = false, label = "" }) {
  return {
    id: crypto.randomUUID(),
    pageId: pageId ?? null,
    orientation: orientation === "vertical" ? "vertical" : "horizontal",
    pos: Number.isFinite(pos) ? pos : 0,
    color: isSafeGuideColorKey(color) ? color : DEFAULT_GUIDE_COLOR,
    locked: !!locked,
    hidden: !!hidden,
    label: sanitizeLabel(label),
    createdAt: Date.now(),
  };
}

export function normalizeGuide(raw) {
  if (!raw || typeof raw !== "object") return null;
  const orientation = GUIDE_ORIENTATIONS.includes(raw.orientation) ? raw.orientation : "horizontal";
  const pos = Number.isFinite(raw.pos) ? raw.pos : null;
  if (pos === null) return null;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID(),
    pageId: typeof raw.pageId === "string" ? raw.pageId : null,
    orientation,
    pos,
    color: isSafeGuideColorKey(raw.color) ? raw.color : DEFAULT_GUIDE_COLOR,
    locked: !!raw.locked,
    hidden: !!raw.hidden,
    label: sanitizeLabel(raw.label),
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
  };
}

// --- grid ---

export const GRID_TYPES = ["square", "dot"];
export const GRID_SPACING_PRESETS = [4, 8, 10, 12, 16, 20, 24, 25, 32, 50];

export function defaultGrid() {
  return {
    type: "square",
    visible: false,
    snap: false,
    spacingX: 20,
    spacingY: 20,
    equalSpacing: true,
    offsetX: 0,
    offsetY: 0,
    subdivisions: 4,
    majorInterval: 5,
    color: "#94a3b8",
    opacity: 0.5,
    dotSize: 1.5,
  };
}

const MAX_GRID_SPACING = 2000;
const MIN_GRID_SPACING = 1;
const MAX_SUBDIVISIONS = 20;
const MAX_MAJOR_INTERVAL = 50;

export function normalizeGrid(raw) {
  const d = defaultGrid();
  if (!raw || typeof raw !== "object") return d;
  const clampSpacing = (v, fallback) => (Number.isFinite(v) ? Math.min(MAX_GRID_SPACING, Math.max(MIN_GRID_SPACING, v)) : fallback);
  return {
    type: GRID_TYPES.includes(raw.type) ? raw.type : d.type,
    visible: !!raw.visible,
    snap: !!raw.snap,
    spacingX: clampSpacing(raw.spacingX, d.spacingX),
    spacingY: clampSpacing(raw.spacingY, d.spacingY),
    equalSpacing: raw.equalSpacing !== false,
    offsetX: Number.isFinite(raw.offsetX) ? raw.offsetX : d.offsetX,
    offsetY: Number.isFinite(raw.offsetY) ? raw.offsetY : d.offsetY,
    subdivisions: Number.isFinite(raw.subdivisions) ? Math.min(MAX_SUBDIVISIONS, Math.max(1, Math.round(raw.subdivisions))) : d.subdivisions,
    majorInterval: Number.isFinite(raw.majorInterval) ? Math.min(MAX_MAJOR_INTERVAL, Math.max(1, Math.round(raw.majorInterval))) : d.majorInterval,
    color: typeof raw.color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(raw.color) ? raw.color : d.color,
    opacity: Number.isFinite(raw.opacity) ? Math.min(1, Math.max(0, raw.opacity)) : d.opacity,
    dotSize: Number.isFinite(raw.dotSize) ? Math.min(10, Math.max(0.5, raw.dotSize)) : d.dotSize,
  };
}

// --- margins ---

export const MARGIN_PRESETS = {
  none: { top: 0, right: 0, bottom: 0, left: 0 },
  narrow: { top: 18, right: 18, bottom: 18, left: 18 },
  normal: { top: 40, right: 40, bottom: 40, left: 40 },
  wide: { top: 72, right: 72, bottom: 72, left: 72 },
  "print-safe": { top: 36, right: 36, bottom: 36, left: 36 },
};

export function defaultMargins() {
  return { visible: false, snap: false, linked: true, preset: "normal", top: 40, right: 40, bottom: 40, left: 40 };
}

const MAX_MARGIN = 5000;

export function normalizeMargins(raw) {
  const d = defaultMargins();
  if (!raw || typeof raw !== "object") return d;
  const clamp = (v, fallback) => (Number.isFinite(v) && v >= 0 ? Math.min(MAX_MARGIN, v) : fallback);
  return {
    visible: !!raw.visible,
    snap: !!raw.snap,
    linked: raw.linked !== false,
    preset: typeof raw.preset === "string" ? raw.preset : d.preset,
    top: clamp(raw.top, d.top),
    right: clamp(raw.right, d.right),
    bottom: clamp(raw.bottom, d.bottom),
    left: clamp(raw.left, d.left),
  };
}

// --- safe area ---

export const SAFE_AREA_PRESETS = {
  "social-caption": { label: "Social caption safe zone", inset: 0.1 },
  "video-thumbnail": { label: "Video thumbnail text-safe", inset: 0.08 },
  "print-trim": { label: "Print trim safety", inset: 0.05 },
  invitation: { label: "Invitation content safety", inset: 0.07 },
  "book-cover": { label: "Book-cover text safety", inset: 0.09 },
};

export function defaultSafeArea() {
  return { visible: false, preset: "social-caption", insetPercent: 0.1 };
}

export function normalizeSafeArea(raw) {
  const d = defaultSafeArea();
  if (!raw || typeof raw !== "object") return d;
  return {
    visible: !!raw.visible,
    preset: typeof raw.preset === "string" ? raw.preset : d.preset,
    insetPercent: Number.isFinite(raw.insetPercent) ? Math.min(0.49, Math.max(0, raw.insetPercent)) : d.insetPercent,
  };
}

// --- bleed (editor preview only — the authoritative export value lives on
// the Phase 9 export request; this is what the CANVAS shows while editing,
// kept in the same units/shape so Phase 9's PDF bleed field can default
// from it) ---

export function defaultBleed() {
  return { visible: false, sizePx: 12 /* 0.125in @ 96dpi */, preset: "standard" };
}

const MAX_BLEED_PX = 400;

export function normalizeBleed(raw) {
  const d = defaultBleed();
  if (!raw || typeof raw !== "object") return d;
  return {
    visible: !!raw.visible,
    sizePx: Number.isFinite(raw.sizePx) && raw.sizePx >= 0 ? Math.min(MAX_BLEED_PX, raw.sizePx) : d.sizePx,
    preset: typeof raw.preset === "string" ? raw.preset : d.preset,
  };
}

// --- layout grid (columns/rows) ---

export function defaultLayoutGrid() {
  return {
    visible: false,
    snap: false,
    columns: 12,
    rows: 0,
    gutter: 20,
    marginLeft: 40,
    marginRight: 40,
    marginTop: 40,
    marginBottom: 40,
    equalWidth: true,
    equalHeight: true,
    color: "#8b5cf6",
  };
}

export const MAX_COLUMNS = 24;
export const MAX_ROWS = 24;
const MAX_GUTTER = 500;

export const LAYOUT_GRID_PRESETS = [
  { key: "two-column", label: "Two columns", columns: 2, rows: 0, gutter: 24 },
  { key: "three-column", label: "Three columns", columns: 3, rows: 0, gutter: 20 },
  { key: "four-column", label: "Four columns", columns: 4, rows: 0, gutter: 20 },
  { key: "six-column", label: "Six columns", columns: 6, rows: 0, gutter: 16 },
  { key: "twelve-column", label: "Twelve columns", columns: 12, rows: 0, gutter: 16 },
  { key: "social-safe", label: "Social post safe layout", columns: 3, rows: 3, gutter: 12 },
  { key: "flyer", label: "Flyer layout", columns: 2, rows: 3, gutter: 18 },
  { key: "business-card", label: "Business-card layout", columns: 3, rows: 1, gutter: 10 },
  { key: "magazine", label: "Magazine layout", columns: 4, rows: 0, gutter: 14 },
  { key: "presentation", label: "Presentation layout", columns: 12, rows: 6, gutter: 12 },
];

// Rejects impossible gutter geometry (spec §71) — e.g. more columns than
// fit given the gutter, which would produce zero/negative column widths.
export function validateLayoutGridGeometry(layoutGrid, pageWidth, pageHeight) {
  const errors = [];
  const usableWidth = pageWidth - layoutGrid.marginLeft - layoutGrid.marginRight;
  const usableHeight = pageHeight - layoutGrid.marginTop - layoutGrid.marginBottom;
  if (layoutGrid.columns > 0) {
    const totalGutter = layoutGrid.gutter * (layoutGrid.columns - 1);
    if (usableWidth - totalGutter <= 0) errors.push("Too many columns or too wide a gutter for this page width.");
  }
  if (layoutGrid.rows > 0) {
    const totalGutter = layoutGrid.gutter * (layoutGrid.rows - 1);
    if (usableHeight - totalGutter <= 0) errors.push("Too many rows or too wide a gutter for this page height.");
  }
  return errors;
}

export function normalizeLayoutGrid(raw) {
  const d = defaultLayoutGrid();
  if (!raw || typeof raw !== "object") return d;
  const clampCount = (v, max, fallback) => (Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v))) : fallback);
  const clampMargin = (v, fallback) => (Number.isFinite(v) && v >= 0 ? v : fallback);
  return {
    visible: !!raw.visible,
    snap: !!raw.snap,
    columns: clampCount(raw.columns, MAX_COLUMNS, d.columns),
    rows: clampCount(raw.rows, MAX_ROWS, d.rows),
    gutter: Number.isFinite(raw.gutter) && raw.gutter >= 0 ? Math.min(MAX_GUTTER, raw.gutter) : d.gutter,
    marginLeft: clampMargin(raw.marginLeft, d.marginLeft),
    marginRight: clampMargin(raw.marginRight, d.marginRight),
    marginTop: clampMargin(raw.marginTop, d.marginTop),
    marginBottom: clampMargin(raw.marginBottom, d.marginBottom),
    equalWidth: raw.equalWidth !== false,
    equalHeight: raw.equalHeight !== false,
    color: typeof raw.color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(raw.color) ? raw.color : d.color,
  };
}

// --- baseline grid ---

export function defaultBaselineGrid() {
  return { visible: false, snap: false, spacing: 24, offset: 0, color: "#0ea5e9", opacity: 0.4 };
}

export function normalizeBaselineGrid(raw) {
  const d = defaultBaselineGrid();
  if (!raw || typeof raw !== "object") return d;
  return {
    visible: !!raw.visible,
    snap: !!raw.snap,
    spacing: Number.isFinite(raw.spacing) && raw.spacing > 0 ? Math.min(500, raw.spacing) : d.spacing,
    offset: Number.isFinite(raw.offset) ? raw.offset : d.offset,
    color: typeof raw.color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(raw.color) ? raw.color : d.color,
    opacity: Number.isFinite(raw.opacity) ? Math.min(1, Math.max(0, raw.opacity)) : d.opacity,
  };
}

// One factory for every per-page precision field, used both by the
// starter/blank-page path and by the load-time migration for pages saved
// before Phase 10 (all additive/defaulting, no schemaVersion bump — same
// pattern every prior phase's page-level additions used, e.g. Phase 5's
// per-page background).
export function defaultPagePrecision() {
  return {
    grid: defaultGrid(),
    margins: defaultMargins(),
    safeArea: defaultSafeArea(),
    bleed: defaultBleed(),
    layoutGrid: defaultLayoutGrid(),
    baselineGrid: defaultBaselineGrid(),
  };
}

export function normalizePagePrecision(page) {
  return {
    grid: normalizeGrid(page?.grid),
    margins: normalizeMargins(page?.margins),
    safeArea: normalizeSafeArea(page?.safeArea),
    bleed: normalizeBleed(page?.bleed),
    layoutGrid: normalizeLayoutGrid(page?.layoutGrid),
    baselineGrid: normalizeBaselineGrid(page?.baselineGrid),
  };
}
