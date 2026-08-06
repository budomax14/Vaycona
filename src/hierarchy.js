import { getItemBounds, unionBounds } from "./bounds";

// Groups are normal flat items (`type:"group"`) living in the same
// `items` array as everything else; children reference their group via
// `parentId`. See the Phase 5 plan for the full rationale — in short:
// children's x/y stay page-absolute always (grouping never rewrites a
// child's coordinates), so every existing generic system (bounds,
// snapping, alignment, marquee, drag) needs zero changes. This file holds
// every pure hierarchy helper so App.jsx/DesignNode.jsx never re-derive
// this logic ad hoc.

function buildChildrenIndex(items) {
  const byParent = new Map();
  for (const it of items) {
    const key = it.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(it);
  }
  return byParent;
}

// One row per object on the active page, nested to match parentId,
// reversed at EVERY level (not just once globally) so "topmost canvas
// object at the top of the list" holds recursively inside groups too —
// a group's own children are a separate array from the top-level list.
export function buildLayerTree(items, activePageId) {
  const pageItems = items.filter((it) => it.pageId === activePageId);
  const byParent = buildChildrenIndex(pageItems);
  function build(parentId) {
    const siblings = byParent.get(parentId) || [];
    return siblings
      .slice()
      .reverse()
      .map((item) => ({ item, children: build(item.id) }));
  }
  return build(null);
}

// All descendants (groups AND leaves) of rootId, in no particular order.
export function getDescendantIds(items, rootId) {
  const byParent = buildChildrenIndex(items);
  const out = [];
  const stack = [...(byParent.get(rootId) || [])];
  while (stack.length) {
    const it = stack.pop();
    out.push(it.id);
    stack.push(...(byParent.get(it.id) || []));
  }
  return out;
}

// Resolves a logical selection (which may include group ids) down to the
// concrete LEAF ids Konva actually needs to move/transform. Never mutates
// `selectedIds` itself — used only at drag/Transformer call sites.
export function expandToLeafIds(items, ids) {
  const byId = new Map(items.map((it) => [it.id, it]));
  const result = new Set();
  for (const id of ids) {
    const item = byId.get(id);
    if (!item) continue;
    if (item.type === "group") {
      getDescendantIds(items, id).forEach((descendantId) => {
        const descendant = byId.get(descendantId);
        if (descendant && descendant.type !== "group") result.add(descendantId);
      });
    } else {
      result.add(id);
    }
  }
  return Array.from(result);
}

export function getAncestorChain(items, itemId) {
  const byId = new Map(items.map((it) => [it.id, it]));
  const chain = [];
  const seen = new Set();
  let current = byId.get(itemId);
  while (current) {
    if (seen.has(current.id)) break; // defensive cycle guard
    seen.add(current.id);
    chain.push(current.id);
    current = current.parentId ? byId.get(current.parentId) : null;
  }
  return chain; // [itemId, parent, grandparent, ..., topmost]
}

// Click-resolution model (Phase 5 decision 6):
// - Ctrl/Cmd+click always selects the clicked item directly (escape hatch).
// - Otherwise, a click resolves UP the parentId chain to the outermost
//   ancestor, UNLESS the click landed inside the currently-entered
//   group's subtree, in which case it resolves only up to the entered
//   level's immediate child (so you can pick a specific member without
//   selecting the whole nested chain each time).
export function resolveClickSelection(items, clickedId, { ctrlKey = false, enteredGroupId = null } = {}) {
  if (ctrlKey) return clickedId;
  const chain = getAncestorChain(items, clickedId);
  if (enteredGroupId) {
    const idx = chain.indexOf(enteredGroupId);
    if (idx > 0) return chain[idx - 1];
    if (idx === 0) return clickedId;
    // clicked outside the entered group's subtree -> falls through and
    // resolves to the topmost ancestor, implicitly backing out
  }
  return chain[chain.length - 1] || clickedId;
}

export function isEffectivelyHidden(item, itemsById) {
  let current = item;
  const seen = new Set();
  while (current) {
    if (current.hidden) return true;
    if (seen.has(current.id)) break;
    seen.add(current.id);
    current = current.parentId ? itemsById.get(current.parentId) : null;
  }
  return false;
}

export function isEffectivelyLocked(item, itemsById) {
  let current = item;
  const seen = new Set();
  while (current) {
    if (current.locked) return true;
    if (seen.has(current.id)) break;
    seen.add(current.id);
    current = current.parentId ? itemsById.get(current.parentId) : null;
  }
  return false;
}

// Recomputes a group's derived x/y/width/height from the axis-aligned
// union of its direct children's bounds (existing generic getItemBounds/
// unionBounds, unchanged), then cascades to its own parent group. If the
// group has no children left (last child moved/deleted/reordered out),
// deletes the now-empty group and continues the cascade up its former
// parent — prevents permanent, invisible ghost rows.
export function recomputeGroupBounds(items, groupId) {
  if (!groupId) return items;
  const group = items.find((it) => it.id === groupId);
  if (!group || group.type !== "group") return items;
  const children = items.filter((it) => it.parentId === groupId);

  if (children.length === 0) {
    const next = items.filter((it) => it.id !== groupId);
    return recomputeGroupBounds(next, group.parentId);
  }

  const box = unionBounds(children.map(getItemBounds));
  const next = items.map((it) =>
    it.id === groupId
      ? { ...it, x: box.left, y: box.top, width: box.width, height: box.height, updatedAt: Date.now() }
      : it
  );
  return recomputeGroupBounds(next, group.parentId);
}

export function recomputeAffectedGroupBounds(items, groupIds) {
  return [...new Set(groupIds.filter(Boolean))].reduce((acc, gid) => recomputeGroupBounds(acc, gid), items);
}

// True if dropping `draggedIds` onto `targetId` would create a cycle
// (dropping a group inside itself or one of its own descendants).
export function wouldCreateCycle(items, draggedIds, targetId) {
  if (targetId == null) return false;
  if (draggedIds.includes(targetId)) return true;
  return draggedIds.some((id) => {
    const item = items.find((it) => it.id === id);
    return item?.type === "group" && getDescendantIds(items, id).includes(targetId);
  });
}

// Single pure function computing the reordered flat array for a
// Layers-panel drag-drop. `position` is "before" | "after" | "inside"
// (inside only valid when targetId names a group). Returns the SAME
// `items` reference unchanged for a rejected/invalid drop (cycle, or
// "inside" a non-group) so callers can no-op cleanly.
export function reorderLayerItems(items, draggedIds, targetId, position) {
  const roots = draggedIds.filter((id) => {
    const it = items.find((i) => i.id === id);
    return !draggedIds.some((otherId) => {
      if (otherId === id) return false;
      const other = items.find((i) => i.id === otherId);
      return other?.type === "group" && getDescendantIds(items, otherId).includes(id);
    });
  });
  if (roots.length === 0) return items;
  if (wouldCreateCycle(items, roots, targetId)) return items;

  const targetItem = targetId ? items.find((i) => i.id === targetId) : null;
  if (position === "inside" && targetItem?.type !== "group") return items;
  if (targetId && !targetItem) return items;

  const newParentId = position === "inside" ? targetId : targetItem?.parentId ?? null;

  const idToIndex = new Map(items.map((it, i) => [it.id, i]));
  const orderedRoots = [...roots].sort((a, b) => idToIndex.get(a) - idToIndex.get(b));

  const blockIds = new Set();
  const draggedBlocks = orderedRoots.map((id) => {
    const item = items.find((i) => i.id === id);
    const members = item.type === "group" ? [id, ...getDescendantIds(items, id)] : [id];
    members.forEach((m) => blockIds.add(m));
    return items.filter((i) => members.includes(i.id)).sort((a, b) => idToIndex.get(a.id) - idToIndex.get(b.id));
  });

  const remaining = items.filter((it) => !blockIds.has(it.id));

  let spliceIndex;
  if (position === "inside") {
    const childIdxs = remaining.map((it, i) => (it.parentId === targetId ? i : -1)).filter((i) => i !== -1);
    spliceIndex = childIdxs.length ? childIdxs[childIdxs.length - 1] + 1 : remaining.findIndex((i) => i.id === targetId) + 1;
  } else {
    const targetIdx = remaining.findIndex((i) => i.id === targetId);
    if (targetIdx === -1) return items;
    spliceIndex = position === "before" ? targetIdx : targetIdx + 1;
  }

  const now = Date.now();
  const rewrittenBlocks = draggedBlocks.map(([top, ...rest]) => [{ ...top, parentId: newParentId, updatedAt: now }, ...rest]);
  const flatInsertion = rewrittenBlocks.flat();

  const next = [...remaining.slice(0, spliceIndex), ...flatInsertion, ...remaining.slice(spliceIndex)];

  const touchedGroupIds = [...orderedRoots.map((id) => items.find((i) => i.id === id)?.parentId), newParentId];
  return recomputeAffectedGroupBounds(next, touchedGroupIds);
}

// Hierarchy validation — run once at load/migration, never on every
// render. parentId forms a functional graph (each node has at most one
// outgoing edge), so cycle detection is a memoized ancestor-chain walk:
// O(n) amortized, not O(n * depth).
export function validateHierarchy(items) {
  const byId = new Map(items.map((it) => [it.id, it]));
  const missingParent = [];
  const crossPage = [];
  const cyclic = new Set();
  const resolvedOk = new Set();

  for (const item of items) {
    if (item.parentId == null) continue;
    const parent = byId.get(item.parentId);
    if (!parent) missingParent.push(item.id);
    else if (parent.pageId !== item.pageId) crossPage.push(item.id);
  }

  for (const item of items) {
    if (cyclic.has(item.id) || resolvedOk.has(item.id)) continue;
    const seen = [];
    let current = item;
    while (current && current.parentId != null && byId.has(current.parentId)) {
      if (seen.includes(current.id)) {
        seen.forEach((id) => cyclic.add(id));
        break;
      }
      seen.push(current.id);
      current = byId.get(current.parentId);
    }
    if (!cyclic.has(item.id)) seen.forEach((id) => resolvedOk.add(id));
  }

  return { missingParent, crossPage, cyclic: [...cyclic] };
}

// Safe repair: orphan any offending item to top-level (parentId: null).
// Simple, no cascading data loss, and re-running recomputeAffectedGroupBounds
// on former parents afterward cleans up any group left empty by the repair.
export function repairHierarchy(items) {
  const problems = validateHierarchy(items);
  const toOrphan = new Set([...problems.missingParent, ...problems.crossPage, ...problems.cyclic]);
  if (toOrphan.size === 0) return items;
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.warn(`[hierarchy] repaired ${toOrphan.size} invalid parent reference(s) on load`, [...toOrphan]);
  }
  const formerParentIds = [...toOrphan].map((id) => items.find((it) => it.id === id)?.parentId).filter(Boolean);
  const repaired = items.map((it) => (toOrphan.has(it.id) ? { ...it, parentId: null } : it));
  return recomputeAffectedGroupBounds(repaired, formerParentIds);
}
