// Centralized deep-clone + ID-remapping utility (Phase 8) — the one place
// "take some pages/items and give them all fresh IDs, consistently" is
// implemented. Used by: create-project-from-template, duplicate-template,
// insert-reusable-page, insert-reusable-section. Asset IDs (assetId/
// contentAssetId) are intentionally left AS-IS — this app has one shared,
// globally-unique IndexedDB asset store (see assetStore.js), so reusing
// the same stable asset ID is always safe and never needs remapping
// locally (a real cross-package collision is a project-*import* concern,
// already handled by projectPackage.js's importPackageAssets).

// Whole-project clone: every page AND every item gets a new ID together,
// so parent/child references always resolve within the new set (spec §17).
export function cloneWorkspaceDataWithNewIds(data) {
  const pageIdMap = new Map();
  const pages = (data.pages || []).map((page) => {
    const newId = crypto.randomUUID();
    pageIdMap.set(page.id, newId);
    return { ...page, id: newId };
  });

  const itemIdMap = new Map();
  (data.items || []).forEach((item) => itemIdMap.set(item.id, crypto.randomUUID()));
  const items = (data.items || []).map((item) => ({
    ...item,
    id: itemIdMap.get(item.id),
    pageId: pageIdMap.get(item.pageId) || pages[0]?.id,
    parentId: item.parentId && itemIdMap.has(item.parentId) ? itemIdMap.get(item.parentId) : null,
  }));

  const activePageId = pageIdMap.get(data.activePageId) || pages[0]?.id;

  // Phase 10 — guides get fresh IDs too, and page-scoped guides (pageId
  // non-null) follow their page through the remap; global guides (pageId
  // null) stay global (spec §71 "remap guide IDs, preserve page
  // references").
  const guides = (data.guides || []).map((guide) => ({
    ...guide,
    id: crypto.randomUUID(),
    pageId: guide.pageId ? pageIdMap.get(guide.pageId) || null : null,
  }));

  return {
    data: { ...data, pages, items, activePageId, guides },
    pageIdMap,
    itemIdMap,
  };
}

// Partial clone for inserting a subset of items (a reusable section, or a
// single reusable page's contents) into an existing project. Any parent
// reference pointing OUTSIDE the copied set is orphaned to the top level
// (spec §17/§36) rather than kept pointing at a foreign, likely-nonexistent
// group — cross-context insertion, unlike App.jsx's own in-project
// duplicateSelection/cloneWithNewIds, has no "same existing group" to
// reattach to.
export function cloneItemsForInsertion(items, targetPageId) {
  const idMap = new Map();
  items.forEach((item) => idMap.set(item.id, crypto.randomUUID()));
  const cloned = items.map((item) => ({
    ...item,
    id: idMap.get(item.id),
    pageId: targetPageId,
    parentId: item.parentId && idMap.has(item.parentId) ? idMap.get(item.parentId) : null,
  }));
  return { items: cloned, idMap };
}

// Reusable-page insertion (spec §72): carries the source page's own
// page-scoped guides along, each with a fresh ID and reassigned to the
// newly-inserted page. Global guides are never copied by this — page
// templates only ever remember guides that were themselves page-scoped
// (see App.jsx's savePageAsReusable), so there is nothing to filter here.
export function cloneGuidesForPage(guides, targetPageId) {
  return (guides || []).map((guide) => ({ ...guide, id: crypto.randomUUID(), pageId: targetPageId }));
}

// Shifts a set of already-cloned items so their combined bounding box is
// centered on `center` (spec §36 — "place near page center"). Only moves
// top-level-within-the-set items' x/y are shifted uniformly (relative
// spacing/rotation/z-order are preserved automatically since every item
// moves by the same delta).
export function recenterItems(items, bounds, center) {
  const dx = center.x - (bounds.left + bounds.width / 2);
  const dy = center.y - (bounds.top + bounds.height / 2);
  if (!dx && !dy) return items;
  return items.map((item) => ({ ...item, x: item.x + dx, y: item.y + dy }));
}
