// Phase 9 — PNG/JPEG rendering + packaging. Every page goes through the
// one shared offscreen render pipeline (offscreenRenderer.jsx); this module
// only decides background handling, canvas->blob encoding, and single-file
// vs ZIP packaging (spec §25/§26/§40/§41).

import JSZip from "jszip";
import { renderPageToCanvas, ExportCancelledError, yieldToMainThread } from "./offscreenRenderer";
import { buildExportFilename, buildZipFilename, dedupeFilenames } from "./exportRequest";
import { MAX_ZIP_OUTPUT_BYTES } from "./exportConstants";

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("This page could not be encoded — the canvas may be too large."))),
      mimeType,
      quality
    );
  });
}

function resolveBackgroundFill(page, request) {
  if (request.format === "png" && request.transparentBackground) return null;
  return request.backgroundOverride || page.background || "#ffffff";
}

// Renders every requested page to an encoded Blob, reporting per-page
// progress. Returns [{ pageId, page, blob, canvas: {width,height} }].
async function renderPagesToBlobs({ pages, items, request, availableAssetIds, onProgress, signal }) {
  const mimeType = request.format === "jpeg" ? "image/jpeg" : "image/png";
  const quality = request.format === "jpeg" ? request.jpegQualityValue : undefined;
  const results = [];

  for (let i = 0; i < pages.length; i++) {
    if (signal?.aborted) throw new ExportCancelledError();
    const page = pages[i];
    onProgress?.({ stage: "rendering", pageIndex: i, pageCount: pages.length, pageName: page.name || `Page ${i + 1}` });

    // eslint-disable-next-line no-await-in-loop
    const canvas = await renderPageToCanvas({
      page,
      items,
      pixelScale: request.scale,
      backgroundFill: resolveBackgroundFill(page, request),
      availableAssetIds,
      signal,
    });
    if (signal?.aborted) throw new ExportCancelledError();
    // eslint-disable-next-line no-await-in-loop
    const blob = await canvasToBlob(canvas, mimeType, quality);
    results.push({ pageId: page.id, page, blob, canvas: { width: canvas.width, height: canvas.height } });
    // Release the backing bitmap eagerly rather than waiting for GC — this
    // matters on large multi-page exports (spec §63).
    canvas.width = 0;
    canvas.height = 0;
    // eslint-disable-next-line no-await-in-loop
    await yieldToMainThread();
  }
  return results;
}

// Returns { blob, filename } for a single download, ready for
// projectPackage.js's existing downloadBlob().
export async function exportRasterImages({ pages, items, request, availableAssetIds, onProgress, signal }) {
  const extension = request.format === "jpeg" ? "jpg" : "png";
  const rendered = await renderPagesToBlobs({ pages, items, request, availableAssetIds, onProgress, signal });

  if (rendered.length === 1) {
    onProgress?.({ stage: "finalizing" });
    return { blob: rendered[0].blob, filename: buildExportFilename(request.filenameBase, { extension }) };
  }

  onProgress?.({ stage: "packaging" });
  if (signal?.aborted) throw new ExportCancelledError();
  const names = dedupeFilenames(
    rendered.map((r, i) => buildExportFilename(request.filenameBase, { pageLabel: `Page ${i + 1}`, extension }))
  );
  const zip = new JSZip();
  const folder = zip.folder(request.filenameBase);
  rendered.forEach((r, i) => folder.file(names[i], r.blob));

  const estimatedBytes = rendered.reduce((sum, r) => sum + r.blob.size, 0);
  if (estimatedBytes > MAX_ZIP_OUTPUT_BYTES) {
    throw new Error(
      `This export's total size is too large to package safely (over ${Math.round(MAX_ZIP_OUTPUT_BYTES / 1024 / 1024)}MB). Try a lower scale or exporting fewer pages at once.`
    );
  }

  const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  onProgress?.({ stage: "finalizing" });
  return { blob: zipBlob, filename: buildZipFilename(request.filenameBase, extension) };
}
