// Phase 9 — export preflight: scoped to only the pages actually being
// exported (spec §47 — never touches assets/fonts referenced only by
// pages outside the selection), reuses the centralized validator plus the
// asset store's own metadata reads (never a second asset-existence check).

import { getAssetMeta } from "../assetStore";
import { getFontEntry, loadFont } from "../fontLibrary";
import { isValidRichText } from "../richText";
import { validateProject } from "../projectValidator";
import { LOW_RES_WARNING_THRESHOLD } from "./exportConstants";

function collectFontFamilies(items) {
  const families = new Set();
  items.forEach((item) => {
    if (item.type !== "text") return;
    if (item.fontFamily) families.add(item.fontFamily);
    if (isValidRichText(item.richText)) {
      item.richText.forEach((p) => p.runs.forEach((r) => !r.break && r.fontFamily && families.add(r.fontFamily)));
    }
  });
  return [...families];
}

function collectAssetRefs(items) {
  const refs = [];
  items.forEach((item) => {
    if (item.type === "image" && item.assetId) refs.push({ itemId: item.id, pageId: item.pageId, assetId: item.assetId, box: item });
    if (item.type === "frame" && item.contentAssetId) refs.push({ itemId: item.id, pageId: item.pageId, assetId: item.contentAssetId, box: item });
  });
  return refs;
}

// Fatal/structural blockers reuse the centralized validator (spec §52),
// scoped to the pages/items actually selected for export so an unrelated
// page's corruption never blocks an otherwise-fine export.
export function validateSelectedPagesForExport({ pages, items }, selectedPageIds) {
  const selectedPages = pages.filter((p) => selectedPageIds.includes(p.id));
  const selectedItems = items.filter((it) => selectedPageIds.includes(it.pageId));
  const report = validateProject({ pages: selectedPages, items: selectedItems });
  return report;
}

// Returns { blockers: string[], warnings: [{code,message}], availableAssetIds: Set,
//   fontFamilies: string[], missingAssetCount, lowResCount }. Never mutates
// the project. `pixelScale` is the export's resolved scale (page px ->
// output px) used only for the low-resolution heuristic.
export async function runExportPreflight({ pages, items }, { pageIds, pixelScale }) {
  const selectedItems = items.filter((it) => pageIds.includes(it.pageId));
  const validation = validateSelectedPagesForExport({ pages, items }, pageIds);

  const blockers = validation.fatalErrors.map((f) => f.message).concat(validation.errors.map((e) => e.message));
  const warnings = [];

  // --- assets (scoped to selection only) ---
  const assetRefs = collectAssetRefs(selectedItems);
  const uniqueAssetIds = [...new Set(assetRefs.map((r) => r.assetId))];
  const metaById = new Map();
  for (const assetId of uniqueAssetIds) {
    // Sequential + deduped (spec §47) — one IndexedDB read per unique
    // asset no matter how many objects/pages reference it.
    // eslint-disable-next-line no-await-in-loop
    const meta = await getAssetMeta(assetId);
    metaById.set(assetId, meta);
  }
  const availableAssetIds = new Set(uniqueAssetIds.filter((id) => metaById.get(id)));
  const missingRefs = assetRefs.filter((r) => !metaById.get(r.assetId));
  const missingPageNames = [...new Set(missingRefs.map((r) => pages.find((p) => p.id === r.pageId)?.name || "a page"))];
  if (missingRefs.length > 0) {
    warnings.push({
      code: "missing-assets",
      message: `${missingRefs.length} image${missingRefs.length === 1 ? "" : "s"} referenced on ${missingPageNames.join(", ")} could not be found and will export as a placeholder.`,
      count: missingRefs.length,
    });
  }

  // --- low-resolution images ---
  let lowResCount = 0;
  for (const ref of assetRefs) {
    const meta = metaById.get(ref.assetId);
    if (!meta || !meta.width || !meta.height) continue;
    const outputW = ref.box.width * pixelScale;
    const outputH = ref.box.height * pixelScale;
    if (meta.width < outputW * LOW_RES_WARNING_THRESHOLD || meta.height < outputH * LOW_RES_WARNING_THRESHOLD) {
      lowResCount += 1;
    }
  }
  if (lowResCount > 0) {
    warnings.push({
      code: "low-resolution",
      message: `${lowResCount} image${lowResCount === 1 ? "" : "s"} may look blurry at this export size — the source resolution is lower than the requested output.`,
      count: lowResCount,
    });
  }

  // --- fonts ---
  const fontFamilies = collectFontFamilies(selectedItems);
  const unresolvedFonts = fontFamilies.filter((name) => !getFontEntry(name));
  if (unresolvedFonts.length > 0) {
    warnings.push({
      code: "missing-fonts",
      message: `${unresolvedFonts.length} font${unresolvedFonts.length === 1 ? "" : "s"} (${unresolvedFonts.slice(0, 3).join(", ")}${unresolvedFonts.length > 3 ? ", …" : ""}) aren't in this app's font library and will use the browser's default fallback — the same fallback already shown in the editor.`,
      count: unresolvedFonts.length,
    });
  }

  // --- transparency-to-JPEG note is added by the caller once format is known ---

  return {
    blockers,
    warnings,
    availableAssetIds,
    fontFamilies,
    missingAssetCount: missingRefs.length,
    lowResCount,
    status: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warnings" : "ok",
  };
}

// Loads every font used by the selection once (deduped by fontLibrary's own
// in-flight cache — spec §63 "fonts are loaded once per export") and
// resolves once every one has either loaded or safely fallen back.
export async function preloadExportFonts(fontFamilies) {
  await Promise.all(fontFamilies.map((name) => loadFont(name)));
}
