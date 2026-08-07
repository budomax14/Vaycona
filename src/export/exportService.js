// Phase 9 — the one export orchestrator UI components call into. Mirrors
// projectPackage.js's role for the .canvasproject archive: a stable,
// framework-agnostic module that validates, preflights, renders, and
// packages, so ExportDialog.jsx only ever describes WHAT to export, never
// HOW (spec rule: "UI components must not directly implement rendering or
// file packaging").

import { buildExportRequest, buildExportFilename } from "./exportRequest";
import { runExportPreflight, preloadExportFonts, validateSelectedPagesForExport } from "./exportPreflight";
import { exportRasterImages } from "./rasterExport";
import { exportPdf } from "./pdfExport";
import { buildSvgDocument } from "./svgExport";
import { ExportCancelledError } from "./offscreenRenderer";

export { ExportCancelledError };

// Structural validation + normalization only — does not touch assets/fonts
// (that's runExportPreflight, run separately so the dialog can show a
// preflight summary before committing to a full render).
export function prepareExportRequest(raw, context) {
  return buildExportRequest(raw, context);
}

export async function runPreflight(request, context) {
  return runExportPreflight({ pages: context.pages, items: context.items }, { pageIds: request.pageIds, pixelScale: request.scale });
}

// `context`: { pages, items, projectName }. `signal`: an AbortController
// signal — cooperative cancellation, checked between every page/asset step
// (spec §44). `onProgress(stageInfo)`: real, stage-based progress only,
// never a fabricated percentage for work that can't be measured (spec §43).
export async function runExport(request, context, { onProgress, signal, preflight: precomputedPreflight } = {}) {
  const { pages: allPages, items, projectName } = context;
  const pages = request.pageIds.map((id) => allPages.find((p) => p.id === id)).filter(Boolean);
  if (pages.length === 0) throw new Error("No valid pages were selected for export.");

  // Re-validate structure right before rendering (spec §52) — cheap, and
  // guards against the project changing between the dialog opening and
  // Export being clicked.
  const structural = validateSelectedPagesForExport({ pages: allPages, items }, request.pageIds);
  if (structural.status === "fatal") {
    throw new Error(structural.fatalErrors[0]?.message || "This project can't be exported in its current state.");
  }

  onProgress?.({ stage: "preparing" });
  // Reuses the preflight the dialog already ran (and showed the user) when
  // available, rather than re-scanning assets/fonts a second time right
  // before rendering.
  const preflight = precomputedPreflight || (await runExportPreflight({ pages: allPages, items }, { pageIds: request.pageIds, pixelScale: request.scale }));
  const availableAssetIds = preflight.availableAssetIds;

  onProgress?.({ stage: "loading-fonts" });
  await preloadExportFonts(preflight.fontFamilies);

  // Each exporter below scopes rendering to its own `item.pageId === page.id`
  // check per page, so the full project item list (not just the selected
  // pages') is what every renderer already expects — no extra filtering
  // needed here.
  if (request.format === "png" || request.format === "jpeg") {
    return exportRasterImages({ pages, items, request, availableAssetIds, onProgress, signal });
  }
  if (request.format === "pdf") {
    return exportPdf({ pages, items, request, availableAssetIds, projectName, onProgress, signal });
  }
  if (request.format === "svg") {
    onProgress?.({ stage: "rendering", pageIndex: 0, pageCount: 1, pageName: pages[0].name || "Page 1" });
    const backgroundFill = request.backgroundOverride || pages[0].background || "#ffffff";
    const svgText = await buildSvgDocument({
      page: pages[0],
      items,
      availableAssetIds,
      backgroundFill,
      scale: request.scale,
      signal,
      watermark: request.watermark,
    });
    onProgress?.({ stage: "finalizing" });
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    return { blob, filename: buildExportFilename(request.filenameBase, { extension: "svg" }) };
  }
  throw new Error(`Unsupported export format: ${request.format}`);
}

export function downloadExportResult(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
