// Phase 12 — the one orchestrator UI calls for animated export, mirroring
// export/exportService.js's role for static export: the dialog only
// describes WHAT to export, this module handles preflight, rendering,
// encoding, progress, and cleanup.

import { buildSinglePageFrameSchedule, buildMultiPageFrameSchedule } from "./frameTimeline";
import { runAnimatedExportPreflight } from "./animatedExportPreflight";
import { exportGif } from "./gifExportService";
import { exportVideo, isVideoExportSupported } from "./videoExportService";
import { preloadExportFonts } from "../../export/exportPreflight";
import { buildExportFilename, sanitizeExportFilenameBase } from "../../export/exportRequest";
import { DEFAULT_ANIMATED_EXPORT_FPS } from "../../export/exportConstants";

export { isVideoExportSupported };

// request: { format: "gif"|"webm", scope: "single"|"presentation", pageIds,
//   fps, scale, loopCount, filenameBase, reducedMotion }
// context: { pages, items }
export async function prepareAnimatedExport(request, context) {
  const { pages: allPages, items } = context;
  const scopedPages = request.scope === "single"
    ? allPages.filter((p) => p.id === request.pageIds[0])
    : allPages.filter((p) => request.pageIds.includes(p.id));
  if (scopedPages.length === 0) throw new Error("No pages selected for animated export.");

  const firstPage = scopedPages[0];
  const scale = request.scale || 1;
  const outputSize = { width: Math.round(firstPage.width * scale), height: Math.round(firstPage.height * scale) };
  const fps = request.fps || DEFAULT_ANIMATED_EXPORT_FPS;

  const preflight = await runAnimatedExportPreflight({
    pages: allPages,
    items,
    format: request.format,
    fps,
    scope: request.scope,
    pixelScale: scale,
    outputSize,
  });

  const schedule = request.scope === "single" ? buildSinglePageFrameSchedule(firstPage, fps) : buildMultiPageFrameSchedule(scopedPages, fps);

  return { preflight, schedule, outputSize, scopedPages, fps, scale };
}

export async function runAnimatedExport(request, context, { onProgress, signal } = {}) {
  const { items } = context;
  onProgress?.({ stage: "preparing" });
  const prepared = await prepareAnimatedExport(request, context);
  if (prepared.preflight.status === "fatal") {
    throw new Error(prepared.preflight.fatal[0]?.message || "This animation can't be exported safely at this size.");
  }

  onProgress?.({ stage: "loading-fonts" });
  await preloadExportFonts(prepared.preflight.fontFamilies);

  const renderContext = {
    pages: prepared.scopedPages,
    items,
    pixelScale: prepared.scale,
    backgroundFill: request.backgroundOverride || null,
    availableAssetIds: prepared.preflight.availableAssetIds,
    reducedMotion: !!request.reducedMotion,
    outputSize: prepared.outputSize,
  };

  const filenameBase = sanitizeExportFilenameBase(request.filenameBase);

  if (request.format === "gif") {
    const blob = await exportGif({
      schedule: prepared.schedule,
      renderContext,
      frameDelayMs: Math.round(1000 / prepared.fps),
      loopCount: request.loopCount ?? 0,
      signal,
      onProgress: (p) => onProgress?.({ stage: "rendering", frameIndex: p.frameIndex, frameCount: p.frameCount }),
    });
    onProgress?.({ stage: "finalizing" });
    return { blob, filename: buildExportFilename(filenameBase, { extension: "gif" }) };
  }

  if (request.format === "webm") {
    const blob = await exportVideo({
      schedule: prepared.schedule,
      renderContext,
      fps: prepared.fps,
      bitsPerSecond: request.bitsPerSecond,
      signal,
      onProgress: (p) => onProgress?.({ stage: "encoding", frameIndex: p.frameIndex, frameCount: p.frameCount }),
    });
    onProgress?.({ stage: "finalizing" });
    return { blob, filename: buildExportFilename(filenameBase, { extension: "webm" }) };
  }

  throw new Error(`Unsupported animated export format: ${request.format}`);
}
