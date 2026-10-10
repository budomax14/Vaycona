// Fallback for PDFs with no embedded project (anything exported before
// editable PDFs, or from another app): each PDF page is rendered to an
// image and becomes one editor page of the same size holding that image,
// locked as the page's base layer. Packaged as an ordinary `.canvasproject`
// archive so it goes through the same inspect/validate/asset-import
// pipeline as any other project file — no separate import path.

import JSZip from "jszip";
import { PACKAGE_FORMAT_VERSION, PROJECT_SCHEMA_VERSION, IMPORT_MAX_PAGE_COUNT } from "../constants";

// jsPDF's "px" unit (with px_scaling, as pdfExport.js uses) is 0.75pt, the
// CSS 96dpi convention — so this turns a PDF page back into the editor's
// original page size.
const PX_PER_PT = 96 / 72;
// Render at 2x the page size for crisp results, capped per side.
const RENDER_PIXEL_RATIO = 2;
const MAX_RENDER_SIDE = 4000;

let pdfjsPromise = null;
function loadPdfjs() {
  // Loaded on demand — only flat-PDF imports need it.
  pdfjsPromise ||= Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });
  return pdfjsPromise;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode page image."))), type, quality);
  });
}

// Returns a `.canvasproject` Blob, or null when the file can't be read as
// a PDF at all.
export async function buildProjectPackageFromFlatPdf(file) {
  const pdfjs = await loadPdfjs();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  let doc;
  try {
    doc = await loadingTask.promise;
  } catch {
    loadingTask.destroy();
    return null;
  }

  const projectName = (file.name || "").replace(/\.pdf$/i, "").trim() || "Imported PDF";
  const totalPages = doc.numPages;
  const pageCount = Math.min(totalPages, IMPORT_MAX_PAGE_COUNT);
  const zip = new JSZip();
  const pages = [];
  const items = [];
  const assets = [];
  const now = Date.now();

  try {
    for (let n = 1; n <= pageCount; n++) {
      // eslint-disable-next-line no-await-in-loop
      const pdfPage = await doc.getPage(n);
      const base = pdfPage.getViewport({ scale: 1 });
      const width = Math.round(base.width * PX_PER_PT);
      const height = Math.round(base.height * PX_PER_PT);
      const renderScale = Math.min(PX_PER_PT * RENDER_PIXEL_RATIO, MAX_RENDER_SIDE / Math.max(base.width, base.height));
      const viewport = pdfPage.getViewport({ scale: renderScale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // eslint-disable-next-line no-await-in-loop
      await pdfPage.render({ canvas, canvasContext: ctx, viewport }).promise;
      // eslint-disable-next-line no-await-in-loop
      const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
      const naturalWidth = canvas.width;
      const naturalHeight = canvas.height;
      canvas.width = 0;
      canvas.height = 0;
      pdfPage.cleanup();

      const pageId = crypto.randomUUID();
      const assetId = crypto.randomUUID();
      const archiveFilename = `assets/${assetId}.jpg`;
      zip.file(archiveFilename, blob);
      assets.push({
        assetId,
        archiveFilename,
        originalFilename: `${projectName} - page ${n}.jpg`,
        mimeType: "image/jpeg",
        size: blob.size,
        width: naturalWidth,
        height: naturalHeight,
        checksum: null,
      });
      pages.push({ id: pageId, name: `Page ${n}`, width, height, background: "#ffffff" });
      items.push({
        id: crypto.randomUUID(),
        type: "image",
        pageId,
        parentId: null,
        assetId,
        naturalWidth,
        naturalHeight,
        x: 0,
        y: 0,
        width,
        height,
        rotation: 0,
        opacity: 1,
        locked: true,
        hidden: false,
        name: `PDF page ${n}`,
        createdAt: now,
        updatedAt: now,
      });
    }
  } finally {
    loadingTask.destroy();
  }

  zip.file(
    "project.json",
    JSON.stringify({ schemaVersion: PROJECT_SCHEMA_VERSION, updatedAt: now, pages, activePageId: pages[0]?.id, scale: 1, items, guides: [], snapToGuides: true })
  );
  zip.file(
    "manifest.json",
    JSON.stringify({
      packageFormatVersion: PACKAGE_FORMAT_VERSION,
      projectSchemaVersion: PROJECT_SCHEMA_VERSION,
      projectName,
      exportedAt: null,
      pageCount: pages.length,
      objectCount: items.length,
      groupCount: 0,
      assetCount: assets.length,
      totalAssetBytes: assets.reduce((sum, a) => sum + a.size, 0),
      projectMetadataFile: "project.json",
      assets,
      missingAssetIds: [],
      fromFlatPdf: true,
      truncatedPageCount: totalPages > pageCount ? totalPages : null,
    })
  );
  // Images are already JPEG — storing avoids pointless recompression.
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}
