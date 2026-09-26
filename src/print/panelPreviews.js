// Lightweight, static panel images for the print sheet preview, the
// folded-card preview and the photo mockups — never live Konva stages.
// Panels render strictly one after another through the shared offscreen
// pipeline and each canvas is turned into a compressed blob and released
// immediately, so only one small canvas exists at a time (the same rule
// Workspace.jsx follows for phones: one live page, everything else a
// plain <img>).

import { renderPageToCanvas } from "../export/offscreenRenderer";
import { runExportPreflight, preloadExportFonts } from "../export/exportPreflight";
import { isMobileDevice } from "../canvasPixelBudget";

export function previewMaxSide() {
  return isMobileDevice() ? 720 : 1100;
}

// Resolves to { [pageId]: { url, width, height } }. Caller owns the object
// URLs (revokePanelImages).
export async function renderPanelImages({ pages, items, maxSide = previewMaxSide(), signal }) {
  const pageIds = pages.map((p) => p.id);
  const preflight = await runExportPreflight({ pages, items }, { pageIds, pixelScale: 1 });
  await preloadExportFonts(preflight.fontFamilies);
  const result = {};
  for (const page of pages) {
    if (signal?.aborted) break;
    const pixelScale = Math.min(2, maxSide / Math.max(page.width, page.height));
    // eslint-disable-next-line no-await-in-loop
    const canvas = await renderPageToCanvas({
      page,
      items,
      pixelScale,
      backgroundFill: page.background || "#ffffff",
      availableAssetIds: preflight.availableAssetIds,
      signal,
    });
    // eslint-disable-next-line no-await-in-loop
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    const { width, height } = canvas;
    canvas.width = 0;
    canvas.height = 0;
    if (blob) result[page.id] = { url: URL.createObjectURL(blob), width, height };
  }
  return result;
}

export function revokePanelImages(images) {
  Object.values(images || {}).forEach((img) => img?.url && URL.revokeObjectURL(img.url));
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load panel preview."));
    img.src = url;
  });
}
