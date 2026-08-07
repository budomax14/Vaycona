// Phase 9 — the one normalized export-request shape every exporter
// (raster/pdf/svg) and the dialog agree on. Mirrors how projectPackage.js
// centralizes the .canvasproject archive shape: build once here, never let
// UI components assemble their own ad hoc export options object.

import { getUnit } from "../pageSizes";
import {
  EXPORT_FORMATS,
  JPEG_QUALITY_PRESETS,
  DEFAULT_JPEG_QUALITY,
  MAX_EXPORT_DIMENSION_PX,
  MAX_EXPORT_PIXELS_PER_PAGE,
  MAX_EXPORT_TOTAL_PIXELS,
  MAX_EXPORT_PAGE_COUNT,
} from "./exportConstants";

export function sanitizeExportFilenameBase(name) {
  const base = (name || "").trim().replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
  return (base || "Untitled Design").slice(0, 80);
}

// Builds the actual per-file name for one output — spec §42. `extension`
// excludes the dot. `pageLabel` (e.g. "Page 2") is appended only when the
// export produces more than one file, so a single-page PNG stays exactly
// `<name>.png` rather than always carrying a redundant suffix.
export function buildExportFilename(base, { pageLabel, extension }) {
  const safeBase = sanitizeExportFilenameBase(base);
  const suffix = pageLabel ? ` ${pageLabel}` : "";
  return `${(safeBase + suffix).slice(0, 120)}.${extension}`;
}

export function buildZipFilename(base, extension) {
  return `${sanitizeExportFilenameBase(base)} ${extension === "pdf" ? "Pages" : "Images"}.zip`;
}

// Ensures no two files collide inside one ZIP (spec §41/§42) by appending
// a numeric disambiguator — should be a no-op in practice since page
// filenames already include a 1-based page label, but this stays a hard
// guarantee rather than an assumption.
export function dedupeFilenames(names) {
  const seen = new Map();
  return names.map((name) => {
    const count = seen.get(name) || 0;
    seen.set(name, count + 1);
    if (count === 0) return name;
    const dot = name.lastIndexOf(".");
    const stem = dot === -1 ? name : name.slice(0, dot);
    const ext = dot === -1 ? "" : name.slice(dot);
    return `${stem} (${count})${ext}`;
  });
}

// --- page range parsing (spec §6): "1", "1-3", "1,3,5", "1-3,6" ---

export function parsePageRange(rangeText, pageCount) {
  const errors = [];
  const indices = new Set();
  const text = (rangeText || "").trim();
  if (!text) return { indices: [], errors: ["Enter at least one page."] };

  for (const rawPart of text.split(",")) {
    const part = rawPart.trim();
    if (!part) continue;
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (start > end) {
        errors.push(`"${part}" is a reversed range.`);
        continue;
      }
      for (let n = start; n <= end; n++) {
        if (n < 1 || n > pageCount) {
          errors.push(`Page ${n} is outside this project (1-${pageCount}).`);
          continue;
        }
        indices.add(n - 1);
      }
      continue;
    }
    const single = Number(part);
    if (!Number.isInteger(single)) {
      errors.push(`"${part}" isn't a valid page number.`);
      continue;
    }
    if (single < 1 || single > pageCount) {
      errors.push(`Page ${single} is outside this project (1-${pageCount}).`);
      continue;
    }
    indices.add(single - 1);
  }

  if (indices.size === 0 && errors.length === 0) errors.push("Enter at least one page.");
  return { indices: [...indices].sort((a, b) => a - b), errors };
}

// --- request normalization ---

// `raw` is whatever shape the dialog's local state happens to be in;
// `context` supplies the live project (pages/activePageId/projectName) the
// request is resolved against. Returns { request, errors } — errors here
// are structural/fatal (bad format, empty page selection, non-finite
// dimensions), distinct from the softer preflight warnings module.
export function buildExportRequest(raw, context) {
  const errors = [];
  const { pages, activePageId, projectName } = context;

  const format = EXPORT_FORMATS.includes(raw.format) ? raw.format : "png";

  let pageIds;
  if (format === "svg") {
    // SVG export is single-page only this phase (spec §36) — always the
    // explicitly chosen page (defaulting to active), never a multi-page set.
    const svgPageId = raw.pageIds?.[0] || activePageId;
    pageIds = pages.some((p) => p.id === svgPageId) ? [svgPageId] : [pages[0]?.id].filter(Boolean);
  } else if (raw.pageSelection === "all") {
    pageIds = pages.map((p) => p.id);
  } else if (raw.pageSelection === "custom") {
    pageIds = (raw.pageIds || []).filter((id) => pages.some((p) => p.id === id));
  } else {
    pageIds = pages.some((p) => p.id === activePageId) ? [activePageId] : [pages[0]?.id].filter(Boolean);
  }
  if (pageIds.length === 0) errors.push("Select at least one page to export.");
  if (pageIds.length > MAX_EXPORT_PAGE_COUNT) {
    errors.push(`Too many pages selected (max ${MAX_EXPORT_PAGE_COUNT} per export).`);
  }

  const selectedPages = pageIds.map((id) => pages.find((p) => p.id === id)).filter(Boolean);

  let scale = typeof raw.scale === "number" && raw.scale > 0 ? raw.scale : 1;
  let customWidth = null;
  let customHeight = null;
  if (raw.useCustomDimensions && selectedPages[0]) {
    const unit = getUnit(raw.customUnit || "px");
    const widthPx = unit.toPx(Number(raw.customWidth));
    const heightPx = unit.toPx(Number(raw.customHeight));
    if (!Number.isFinite(widthPx) || !Number.isFinite(heightPx) || widthPx <= 0 || heightPx <= 0) {
      errors.push("Custom width/height must be positive numbers.");
    } else {
      customWidth = widthPx;
      customHeight = heightPx;
      scale = widthPx / selectedPages[0].width;
    }
  }

  for (const page of selectedPages) {
    const w = Math.round(page.width * scale);
    const h = Math.round(page.height * scale);
    if (w > MAX_EXPORT_DIMENSION_PX || h > MAX_EXPORT_DIMENSION_PX) {
      errors.push(
        `"${page.name || "A page"}" at this size would be ${w}×${h}px, over the ${MAX_EXPORT_DIMENSION_PX}px safety limit per side.`
      );
    }
    if (w * h > MAX_EXPORT_PIXELS_PER_PAGE) {
      errors.push(`"${page.name || "A page"}" at this size would exceed the safe per-page pixel limit. Try a lower scale.`);
    }
  }
  const totalPixels = selectedPages.reduce((sum, page) => sum + Math.round(page.width * scale) * Math.round(page.height * scale), 0);
  if (totalPixels > MAX_EXPORT_TOTAL_PIXELS) {
    errors.push("This export's total size across all selected pages exceeds the safe limit. Export fewer pages or use a lower scale.");
  }

  const qualityKey = JPEG_QUALITY_PRESETS[raw.jpegQuality] ? raw.jpegQuality : DEFAULT_JPEG_QUALITY;

  const request = {
    format,
    pageIds,
    scale,
    customWidth,
    customHeight,
    transparentBackground: format === "png" ? !!raw.transparentBackground : false,
    backgroundOverride: raw.backgroundOverride || null,
    jpegQuality: qualityKey,
    jpegQualityValue: JPEG_QUALITY_PRESETS[qualityKey].value,
    zipMultiple: pageIds.length > 1,
    pdfMode: raw.pdfMode === "print" ? "print" : "standard",
    bleedPx: format === "pdf" && raw.pdfMode === "print" ? Math.max(0, Number(raw.bleedPx) || 0) : 0,
    cropMarks: format === "pdf" && raw.pdfMode === "print" && !!raw.cropMarks,
    includePageNumbersInFilenames: pageIds.length > 1,
    filenameBase: sanitizeExportFilenameBase(raw.filenameBase || projectName),
    createVersionBeforeExport: !!raw.createVersionBeforeExport,
    watermark: !!raw.watermark,
  };

  return { request, errors, selectedPages };
}

export function estimatedOutputDimensions(page, request) {
  if (request.customWidth && request.customHeight) return { width: Math.round(request.customWidth), height: Math.round(request.customHeight) };
  return { width: Math.round(page.width * request.scale), height: Math.round(page.height * request.scale) };
}

// Very rough, clearly-labeled estimate (spec §5's "estimated file-size
// range where practical") — a coefficient per format/quality against raw
// pixel count, not a guarantee. Returns [lowBytes, highBytes].
export function estimateFileSizeRange(page, request) {
  const { width, height } = estimatedOutputDimensions(page, request);
  const pixels = width * height;
  if (request.format === "png") return [pixels * 0.3, pixels * 1.1];
  if (request.format === "jpeg") {
    const q = request.jpegQualityValue ?? 0.9;
    return [pixels * 0.08 * q, pixels * 0.35 * q];
  }
  if (request.format === "pdf") return [pixels * 0.15, pixels * 0.6];
  return [5_000, 60_000]; // svg — dominated by embedded raster count, not page area
}
