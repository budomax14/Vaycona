// Phase 11 — style/token usage scanning over the CURRENT project (spec
// §55/§86/§89). Deliberately computed on demand from `items`/`pages` rather
// than persisted as a standing index — this project's item counts are small
// enough that a full scan is cheap, and an on-demand scan can never go
// stale the way a persisted index could (spec §89's "do not persist
// enormous redundant indexes if they can be rebuilt efficiently").

import { COLOR_FIELD_PATHS } from "./brandLinks";
import { getDisplayName } from "./objectRegistry";

function colorUsagesForItem(item) {
  const paths = COLOR_FIELD_PATHS[item.type] || [];
  const usages = [];
  for (const path of paths) {
    const ref = item.colorLinks?.[path];
    if (ref) usages.push({ path, ref });
  }
  return usages;
}

// Finds every place a given brand resource is used in the current project.
// `kind`: "color" | "typography" | "objectStyle" | "imageStyle" |
// "backgroundStyle" | "gradient" | "brandAsset".
export function findStyleUsage({ items, pages }, brandKitId, resourceId, kind) {
  const usages = [];

  if (kind === "color") {
    for (const item of items) {
      for (const { path, ref } of colorUsagesForItem(item)) {
        if (ref.brandKitId === brandKitId && ref.tokenId === resourceId) {
          usages.push({ pageId: item.pageId, itemId: item.id, itemType: item.type, itemName: getDisplayName(item), field: path });
        }
      }
    }
  } else if (kind === "typography") {
    for (const item of items) {
      const ref = item.typographyStyleRef;
      if (ref?.brandKitId === brandKitId && ref?.styleId === resourceId) {
        usages.push({ pageId: item.pageId, itemId: item.id, itemType: item.type, itemName: getDisplayName(item), field: "typographyStyleRef" });
      }
    }
  } else if (kind === "objectStyle") {
    for (const item of items) {
      const ref = item.objectStyleRef;
      if (ref?.brandKitId === brandKitId && ref?.styleId === resourceId) {
        usages.push({ pageId: item.pageId, itemId: item.id, itemType: item.type, itemName: getDisplayName(item), field: "objectStyleRef" });
      }
    }
  } else if (kind === "imageStyle") {
    for (const item of items) {
      const ref = item.imageStyleRef;
      if (ref?.brandKitId === brandKitId && ref?.styleId === resourceId) {
        usages.push({ pageId: item.pageId, itemId: item.id, itemType: item.type, itemName: getDisplayName(item), field: "imageStyleRef" });
      }
    }
  } else if (kind === "gradient") {
    for (const item of items) {
      const ref = item.fillGradientRef;
      if (ref?.brandKitId === brandKitId && ref?.gradientId === resourceId) {
        usages.push({ pageId: item.pageId, itemId: item.id, itemType: item.type, itemName: getDisplayName(item), field: "fillGradientRef" });
      }
    }
  } else if (kind === "backgroundStyle") {
    for (const page of pages) {
      const ref = page.backgroundStyleRef;
      if (ref?.brandKitId === brandKitId && ref?.styleId === resourceId) {
        usages.push({ pageId: page.id, itemId: null, itemType: "page", itemName: page.name || "Page", field: "backgroundStyleRef" });
      }
    }
  } else if (kind === "brandAsset") {
    for (const item of items) {
      const ref = item.brandAssetRef;
      if (ref?.brandKitId === brandKitId && ref?.resourceId === resourceId) {
        usages.push({ pageId: item.pageId, itemId: item.id, itemType: item.type, itemName: getDisplayName(item), field: "brandAssetRef" });
      }
    }
  }

  return usages;
}

export function summarizeUsage(usages) {
  const pageIds = new Set(usages.map((u) => u.pageId));
  return { count: usages.length, pageCount: pageIds.size, pageIds: [...pageIds] };
}

// Distinct fonts / colors actually present in the project right now —
// backs "Document colors" in ColorField (spec §12) and Replace Fonts'
// project scan (spec §53) and the Brand Audit (spec §64).
export function collectDocumentColors(items) {
  const seen = new Map();
  const push = (hex) => {
    if (!hex || typeof hex !== "string") return;
    const key = hex.toLowerCase();
    seen.set(key, (seen.get(key) || 0) + 1);
  };
  for (const item of items) {
    push(item.fill);
    push(item.stroke && item.stroke !== "transparent" ? item.stroke : null);
    if (item.effects?.shadow?.enabled) push(item.effects.shadow.color);
    if (item.effects?.glow?.enabled) push(item.effects.glow.color);
    if (item.effects?.outline?.enabled) push(item.effects.outline.color);
    if (item.background?.enabled) push(item.background.color);
    if (item.border?.enabled) push(item.border.color);
  }
  return [...seen.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([hex, count]) => ({ hex, count }));
}

export function collectDocumentFonts(items) {
  const seen = new Map();
  for (const item of items) {
    if (item.type !== "text" || !item.fontFamily) continue;
    seen.set(item.fontFamily, (seen.get(item.fontFamily) || 0) + 1);
  }
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([fontFamily, count]) => ({ fontFamily, count }));
}

// --- unused-resource detection (spec §86) — checks the CURRENT project's
// items/pages plus, where the caller supplies them, other local stores
// (templates/sections/versions) it should also treat as "in use". This
// module only implements the current-project half; callers combine it with
// their own template/version scans before treating something as truly
// unused (never delete based on the active project alone, per spec §86).
export function findUnusedBrandResources(kit, { items, pages }) {
  const unused = { colors: [], typography: [], objectStyles: [], imageStyles: [], backgroundStyles: [], gradients: [], logos: [], graphics: [] };

  const usedColorIds = new Set();
  items.forEach((item) => colorUsagesForItem(item).forEach(({ ref }) => ref.brandKitId === kit.id && usedColorIds.add(ref.tokenId)));
  unused.colors = kit.colors.filter((c) => !usedColorIds.has(c.id));

  const usedTypographyIds = new Set(items.filter((i) => i.typographyStyleRef?.brandKitId === kit.id).map((i) => i.typographyStyleRef.styleId));
  unused.typography = kit.typography.filter((t) => !usedTypographyIds.has(t.id));

  const usedObjectStyleIds = new Set(items.filter((i) => i.objectStyleRef?.brandKitId === kit.id).map((i) => i.objectStyleRef.styleId));
  unused.objectStyles = kit.objectStyles.filter((s) => !usedObjectStyleIds.has(s.id));

  const usedImageStyleIds = new Set(items.filter((i) => i.imageStyleRef?.brandKitId === kit.id).map((i) => i.imageStyleRef.styleId));
  unused.imageStyles = kit.imageStyles.filter((s) => !usedImageStyleIds.has(s.id));

  const usedBackgroundStyleIds = new Set(pages.filter((p) => p.backgroundStyleRef?.brandKitId === kit.id).map((p) => p.backgroundStyleRef.styleId));
  unused.backgroundStyles = kit.backgroundStyles.filter((s) => !usedBackgroundStyleIds.has(s.id));

  const usedGradientIds = new Set(items.filter((i) => i.fillGradientRef?.brandKitId === kit.id).map((i) => i.fillGradientRef.gradientId));
  unused.gradients = kit.gradients.filter((g) => !usedGradientIds.has(g.id));

  const usedAssetRefIds = new Set(items.filter((i) => i.brandAssetRef?.brandKitId === kit.id).map((i) => i.brandAssetRef.resourceId));
  unused.logos = kit.logos.filter((l) => !usedAssetRefIds.has(l.id));
  unused.graphics = kit.graphics.filter((g) => !usedAssetRefIds.has(g.id));

  return unused;
}
