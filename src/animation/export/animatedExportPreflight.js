// Phase 12 — animated-export preflight (spec §75). Mirrors
// export/exportPreflight.js's classification shape (fatal/warning/info) so
// the export dialog can render both kinds of preflight with one UI
// pattern, but stays a separate module since the checks themselves
// (frame count, codec support, GIF color complexity) don't apply to static
// export at all.

import {
  MAX_ANIMATED_EXPORT_DIMENSION_PX,
  MAX_ANIMATED_EXPORT_PIXELS,
  MAX_ANIMATED_EXPORT_FRAME_COUNT,
  MAX_ANIMATED_EXPORT_DURATION_MS,
} from "../../export/exportConstants";
import { runExportPreflight } from "../../export/exportPreflight";
import { estimateFrameCount } from "./frameTimeline";
import { detectAnimationConflicts } from "../animationService";
import { isVideoExportSupported } from "./videoExportService";

export async function runAnimatedExportPreflight({ pages, items, format, fps, scope, pixelScale, outputSize }) {
  const fatal = [];
  const warnings = [];
  const info = [];

  const scopedPages = scope === "single" ? [pages[0]] : pages;

  const width = Math.round(outputSize.width);
  const height = Math.round(outputSize.height);
  if (width > MAX_ANIMATED_EXPORT_DIMENSION_PX || height > MAX_ANIMATED_EXPORT_DIMENSION_PX) {
    fatal.push({ code: "dimension-too-large", message: `${width}×${height} exceeds the ${MAX_ANIMATED_EXPORT_DIMENSION_PX}px safety limit per side for animated export. Try a lower resolution.` });
  }
  if (width * height > MAX_ANIMATED_EXPORT_PIXELS) {
    fatal.push({ code: "pixels-too-large", message: "This resolution exceeds the safe per-frame pixel limit for animated export. Try a lower resolution." });
  }

  const frameCount = estimateFrameCount(scopedPages, fps, scope);
  if (frameCount > MAX_ANIMATED_EXPORT_FRAME_COUNT) {
    fatal.push({ code: "too-many-frames", message: `This export would render ${frameCount} frames, over the ${MAX_ANIMATED_EXPORT_FRAME_COUNT}-frame safety limit. Lower the frame rate, shorten pages, or export fewer pages.` });
  }

  const totalDurationMs = scopedPages.reduce((sum, p) => sum + (p.duration || 5000), 0);
  if (totalDurationMs > MAX_ANIMATED_EXPORT_DURATION_MS) {
    fatal.push({ code: "too-long", message: `Total exported duration (${(totalDurationMs / 1000).toFixed(1)}s) exceeds the ${MAX_ANIMATED_EXPORT_DURATION_MS / 1000}s safety limit.` });
  }

  if (format === "webm" && !isVideoExportSupported()) {
    fatal.push({ code: "codec-unsupported", message: "This browser doesn't support local WebM video encoding. Try GIF export instead." });
  }
  if (format === "gif") {
    warnings.push({ code: "gif-limitations", message: "GIF export uses a reduced 256-color palette, has no partial transparency, and no audio — large/long exports may take a while." });
  }

  for (const page of scopedPages) {
    for (const item of items.filter((it) => it.pageId === page.id)) {
      for (const conflict of detectAnimationConflicts(item, page.duration || 5000)) {
        warnings.push({ code: `conflict-${conflict.code}`, message: `"${item.type}" on "${page.name || page.id}": ${conflict.message}` });
      }
    }
  }

  // Reuse the static-export preflight for asset/font readiness — same
  // underlying concern (spec §75 "missing assets/fonts"), no need for a
  // second implementation.
  const staticPreflight = await runExportPreflight({ pages: scopedPages, items }, { pageIds: scopedPages.map((p) => p.id), pixelScale });
  staticPreflight.warnings?.forEach((w) => warnings.push({ code: w.code, message: w.message }));
  staticPreflight.blockers?.forEach((message) => fatal.push({ code: "structural", message }));

  return { status: fatal.length ? "fatal" : "ok", fatal, warnings, info, frameCount, availableAssetIds: staticPreflight.availableAssetIds, fontFamilies: staticPreflight.fontFamilies };
}
