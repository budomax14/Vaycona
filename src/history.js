// Centralized undo/redo transaction architecture (Phase 7A).
//
// Snapshot-based, like the pre-existing history (each entry carries a full
// {items, pages} pair, not a patch/diff) — that choice predates this file
// and is kept as-is; what's new here is: (1) every entry also carries
// metadata (id/type/label/timestamp/affected ids) so the toolbar and dev
// diagnostics can describe what an undo/redo will do, (2) a no-op guard so
// committing a snapshot identical to the current one (ignoring the
// volatile `updatedAt` stamp) is silently dropped instead of polluting the
// stack, and (3) a size limit so the array can't grow unbounded across a
// long editing session.
//
// Because entries are full snapshots, trimming the oldest ones is always
// safe — every remaining entry is still a complete, self-consistent
// {items, pages} pair, so there's nothing to "break" by losing older ones.

export const HISTORY_LIMIT = 150;

function stripVolatile(items) {
  // updatedAt (and createdAt, for newly-created items) changes on every
  // touch even when the meaningful fields don't — excluded here so e.g.
  // "drag an object back to its exact start position" compares equal.
  return items.map(({ updatedAt, ...rest }) => rest);
}

function itemsEqual(a, b) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return JSON.stringify(stripVolatile(a)) === JSON.stringify(stripVolatile(b));
}

function pagesEqual(a, b) {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

function guidesEqual(a, b) {
  if (a === b) return true;
  return JSON.stringify(a || []) === JSON.stringify(b || []);
}

// Phase 10: guides are now undoable too (spec §76/§77), snapshotted
// alongside items/pages in every entry. `guides` defaults to `[]` for
// callers that predate this (there are none left in this codebase, but
// keeps the module standalone-safe).
export function createHistory(items, pages, guides = []) {
  return {
    history: [
      {
        items,
        pages,
        guides,
        meta: { id: crypto.randomUUID(), type: "initial", label: "Initial state", timestamp: Date.now(), itemIds: [], pageIds: [] },
      },
    ],
    index: 0,
  };
}

// meta: { type, label, itemIds?, pageIds?, groupId? } — describes the
// action being committed, for the toolbar tooltip and dev diagnostics.
// Returns the SAME historyState reference when nextItems/nextPages/
// nextGuides are all equivalent to the current top entry (no-op guard,
// spec §13) — callers can rely on reference equality to know whether
// anything was pushed. `nextGuides` is OPTIONAL: omitting it (as every
// pre-Phase-10 call site does) carries the guides array forward
// UNCHANGED from the current entry — exactly correct for any commit that
// only touches items/pages, with zero changes needed at those call sites.
export function pushHistoryEntry(historyState, nextItems, nextPages, meta, nextGuides) {
  const current = historyState.history[historyState.index];
  const guides = nextGuides !== undefined ? nextGuides : current.guides;
  if (itemsEqual(current.items, nextItems) && pagesEqual(current.pages, nextPages) && guidesEqual(current.guides, guides)) {
    return historyState;
  }
  const entry = {
    items: nextItems,
    pages: nextPages,
    guides,
    meta: {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      itemIds: [],
      pageIds: [],
      groupId: null,
      ...meta,
    },
  };
  let nextHistoryArr = historyState.history.slice(0, historyState.index + 1);
  nextHistoryArr.push(entry);
  let nextIndex = nextHistoryArr.length - 1;
  if (nextHistoryArr.length > HISTORY_LIMIT) {
    const overflow = nextHistoryArr.length - HISTORY_LIMIT;
    nextHistoryArr = nextHistoryArr.slice(overflow);
    nextIndex -= overflow;
  }
  return { history: nextHistoryArr, index: nextIndex };
}

export function canUndo(historyState) {
  return historyState.index > 0;
}

export function canRedo(historyState) {
  return historyState.index < historyState.history.length - 1;
}

// Label of the action Undo would revert / Redo would replay — for the
// toolbar tooltip ("Undo: Move object") and dev diagnostics.
export function undoLabel(historyState) {
  return canUndo(historyState) ? historyState.history[historyState.index].meta.label : null;
}

export function redoLabel(historyState) {
  return canRedo(historyState) ? historyState.history[historyState.index + 1].meta.label : null;
}
