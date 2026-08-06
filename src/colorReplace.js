// Phase 11 — document-wide "Replace Colors" tool (spec §51/§52). Pure
// functions over items/pages so App.jsx can preview a plan, then commit it
// through the existing commit()/commitPages() history machinery as ONE
// transaction — this module never touches history/autosave itself.

import { colorsEqual, colorDistance, isValidColor } from "./brandColor";
import { COLOR_FIELD_PATHS } from "./brandLinks";

function getPath(obj, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}
function setPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const rootCopy = { ...obj };
  let cursor = obj;
  let cursorCopy = rootCopy;
  for (const key of keys) {
    const nextCopy = { ...(cursor?.[key] || {}) };
    cursorCopy[key] = nextCopy;
    cursorCopy = nextCopy;
    cursor = cursor?.[key];
  }
  cursorCopy[last] = value;
  return rootCopy;
}

// Scope: "page" (one pageId), "pages" (a Set/array of pageIds), or
// "project" (every page). `excludeItemIds`: Set of item ids to skip.
function itemInScope(item, scope, pageId, pageIds, excludeItemIds) {
  if (excludeItemIds?.has(item.id)) return false;
  if (scope === "page") return item.pageId === pageId;
  if (scope === "pages") return pageIds.has(item.pageId);
  return true; // "project"
}

// Builds a preview plan: which (item, field) pairs would change, without
// mutating anything. `tolerance` 0 = exact match only (the safe default per
// spec §52); > 0 enables "similar color" matching via colorDistance.
export function planColorReplacement({ items, pages }, { fromColor, toColor, scope, pageId, pageIds, excludeItemIds, tolerance = 0 }) {
  if (!isValidColor(fromColor) || !isValidColor(toColor)) return { changes: [], affectedItemIds: [], affectedPageIds: [] };

  const changes = [];
  const affectedItemIds = new Set();
  const affectedPageIds = new Set();

  for (const item of items) {
    if (!itemInScope(item, scope, pageId, pageIds ? new Set(pageIds) : null, excludeItemIds)) continue;
    const paths = COLOR_FIELD_PATHS[item.type] || [];
    for (const path of paths) {
      const value = getPath(item, path);
      if (!value || value === "transparent") continue;
      const isMatch = tolerance > 0 ? colorDistance(value, fromColor) <= tolerance : colorsEqual(value, fromColor);
      if (isMatch) {
        changes.push({ itemId: item.id, pageId: item.pageId, field: path, from: value, to: toColor, wasExact: colorsEqual(value, fromColor) });
        affectedItemIds.add(item.id);
        affectedPageIds.add(item.pageId);
      }
    }
  }

  return { changes, affectedItemIds: [...affectedItemIds], affectedPageIds: [...affectedPageIds] };
}

// Applies a previously-planned set of changes to `items`, returning a new
// array (does not mutate). Also clears any colorLinks entry for a
// replaced field, since the object's value no longer matches its former
// linked token (spec §14 — a value only counts as "linked" while it still
// reflects the token).
export function applyColorReplacement(items, plan) {
  const byItem = new Map();
  plan.changes.forEach((c) => {
    if (!byItem.has(c.itemId)) byItem.set(c.itemId, []);
    byItem.get(c.itemId).push(c);
  });
  if (byItem.size === 0) return items;

  return items.map((item) => {
    const itemChanges = byItem.get(item.id);
    if (!itemChanges) return item;
    let next = item;
    const links = { ...(next.colorLinks || {}) };
    for (const change of itemChanges) {
      next = setPath(next, change.field, change.to);
      delete links[change.field];
    }
    return { ...next, colorLinks: links, updatedAt: Date.now() };
  });
}
