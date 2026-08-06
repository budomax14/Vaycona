// Phase 10 — the one centralized snapping engine. Supersedes the Phase-2/3
// version (page edges/center + object edges/centers + guides, one flat
// threshold) with a priority-tiered candidate model covering guides, page
// geometry, margins/layout-grid, other objects, equal spacing, and the
// regular grid — per the session rule against running several competing
// snap calculations for different features. Every drag/resize call site in
// App.jsx goes through this one module.

import { getItemBounds } from "./bounds";
import { columnEdges, rowEdges, marginRect, gridPositions } from "./precisionOverlayGeometry";

// Lower number = higher priority (spec §41). Within a priority tier, the
// closest candidate wins; a tier is only consulted at all if no candidate
// in a strictly higher tier already matched within the threshold, so
// guides always win over grid lines even when a grid line happens to be
// microscopically closer.
export const SNAP_PRIORITY = Object.freeze({
  GUIDE: 1,
  PAGE: 2,
  MARGIN_LAYOUT: 3,
  OBJECT: 4,
  EQUAL_SPACING: 5,
  GRID: 6,
});

function pushCandidate(list, pos, priority, type, sourceId) {
  if (Number.isFinite(pos)) list.push({ pos, priority, type, sourceId: sourceId ?? null });
}

// Builds the full vertical/horizontal candidate lists for a drag/resize
// operation. `page` must already carry normalized precision fields
// (grid/margins/layoutGrid — see precisionDefaults.js). `guides` should
// already be filtered to the ones relevant to this page (global + this
// page's own) AND to hidden state by the caller (hidden guides never
// snap — spec §20/§63). Locked guides DO still snap (spec §19/§63).
export function collectSnapCandidates({ page, items, excludeIds, guides, toggles }) {
  const vertical = [];
  const horizontal = [];
  const t = { snapToObjects: true, snapToGuides: true, snapToGrid: false, snapToPage: true, snapToMargins: true, snapToLayoutGrid: true, snapToEqualSpacing: true, ...toggles };

  if (t.snapToPage) {
    pushCandidate(vertical, 0, SNAP_PRIORITY.PAGE, "page-edge");
    pushCandidate(vertical, page.width / 2, SNAP_PRIORITY.PAGE, "page-center");
    pushCandidate(vertical, page.width, SNAP_PRIORITY.PAGE, "page-edge");
    pushCandidate(horizontal, 0, SNAP_PRIORITY.PAGE, "page-edge");
    pushCandidate(horizontal, page.height / 2, SNAP_PRIORITY.PAGE, "page-center");
    pushCandidate(horizontal, page.height, SNAP_PRIORITY.PAGE, "page-edge");
  }

  if (t.snapToGuides) {
    guides.forEach((guide) => {
      if (guide.hidden) return;
      if (guide.orientation === "vertical") pushCandidate(vertical, guide.pos, SNAP_PRIORITY.GUIDE, "guide", guide.id);
      else pushCandidate(horizontal, guide.pos, SNAP_PRIORITY.GUIDE, "guide", guide.id);
    });
  }

  if (t.snapToMargins && page.margins?.visible) {
    const rect = marginRect(page.margins, page.width, page.height);
    pushCandidate(vertical, rect.x, SNAP_PRIORITY.MARGIN_LAYOUT, "margin");
    pushCandidate(vertical, rect.x + rect.width, SNAP_PRIORITY.MARGIN_LAYOUT, "margin");
    pushCandidate(horizontal, rect.y, SNAP_PRIORITY.MARGIN_LAYOUT, "margin");
    pushCandidate(horizontal, rect.y + rect.height, SNAP_PRIORITY.MARGIN_LAYOUT, "margin");
  }

  if (t.snapToLayoutGrid && page.layoutGrid?.visible) {
    columnEdges(page.layoutGrid, page.width).forEach((x) => pushCandidate(vertical, x, SNAP_PRIORITY.MARGIN_LAYOUT, "column"));
    rowEdges(page.layoutGrid, page.height).forEach((y) => pushCandidate(horizontal, y, SNAP_PRIORITY.MARGIN_LAYOUT, "row"));
  }

  if (t.snapToObjects) {
    items.forEach((item) => {
      if (excludeIds.has(item.id)) return;
      const b = getItemBounds(item);
      pushCandidate(vertical, b.left, SNAP_PRIORITY.OBJECT, "object-edge", item.id);
      pushCandidate(vertical, b.centerX, SNAP_PRIORITY.OBJECT, "object-center", item.id);
      pushCandidate(vertical, b.right, SNAP_PRIORITY.OBJECT, "object-edge", item.id);
      pushCandidate(horizontal, b.top, SNAP_PRIORITY.OBJECT, "object-edge", item.id);
      pushCandidate(horizontal, b.centerY, SNAP_PRIORITY.OBJECT, "object-center", item.id);
      pushCandidate(horizontal, b.bottom, SNAP_PRIORITY.OBJECT, "object-edge", item.id);
    });
  }

  if (t.snapToGrid && page.grid?.visible && page.grid?.snap) {
    gridPositions(page.grid.spacingX, page.grid.offsetX, 0, page.width)
      .filter((x) => x >= 0 && x <= page.width)
      .forEach((x) => pushCandidate(vertical, x, SNAP_PRIORITY.GRID, "grid"));
    gridPositions(page.grid.spacingY, page.grid.offsetY, 0, page.height)
      .filter((y) => y >= 0 && y <= page.height)
      .forEach((y) => pushCandidate(horizontal, y, SNAP_PRIORITY.GRID, "grid"));
  }

  return { vertical, horizontal };
}

function round1(n) {
  return Math.round(n * 2) / 2;
}

// Finds a repeated gap in a sorted sibling sequence along one axis (the
// most common consecutive gap, when it occurs 2+ times) — the "existing
// rhythm" a dragged object can snap into (spec §47's "matching an existing
// repeated gap").
function findRepeatedGap(sortedBounds, minKey, maxKey) {
  const gaps = [];
  for (let i = 1; i < sortedBounds.length; i++) {
    const gap = round1(sortedBounds[i][minKey] - sortedBounds[i - 1][maxKey]);
    if (gap >= 0) gaps.push(gap);
  }
  const counts = new Map();
  gaps.forEach((g) => counts.set(g, (counts.get(g) || 0) + 1));
  let best = null;
  let bestCount = 1;
  counts.forEach((count, g) => {
    if (count > bestCount) {
      bestCount = count;
      best = g;
    }
  });
  return best;
}

// Equal-spacing candidates for one axis: bisecting between the nearest
// bracketing siblings, and/or matching an already-repeated gap anchored to
// whichever neighbor exists. Returns candidate positions for the MOVING
// bounds' min edge (left for horizontal axis, top for vertical), each
// carrying enough metadata (`gap`, `neighborIds`) to render an equal-
// spacing indicator when it wins.
export function findEqualSpacingCandidates(movingBounds, siblingBounds, axis) {
  const minKey = axis === "horizontal" ? "left" : "top";
  const maxKey = axis === "horizontal" ? "right" : "bottom";
  const sizeKey = axis === "horizontal" ? "width" : "height";
  const sorted = [...siblingBounds].sort((a, b) => a[minKey] - b[minKey]);
  const movingCenter = (movingBounds[minKey] + movingBounds[maxKey]) / 2;

  let leftN = null;
  let rightN = null;
  sorted.forEach((s) => {
    if (s[maxKey] <= movingCenter && (!leftN || s[maxKey] > leftN[maxKey])) leftN = s;
    if (s[minKey] >= movingCenter && (!rightN || s[minKey] < rightN[minKey])) rightN = s;
  });

  const results = [];
  if (leftN && rightN) {
    const space = rightN[minKey] - leftN[maxKey];
    const idealGap = (space - movingBounds[sizeKey]) / 2;
    if (idealGap >= 0) {
      results.push({ pos: leftN[maxKey] + idealGap, gap: idealGap, neighborIds: [leftN.id, rightN.id].filter(Boolean), between: true });
    }
  }
  const repeated = findRepeatedGap(sorted, minKey, maxKey);
  if (repeated != null) {
    if (leftN) results.push({ pos: leftN[maxKey] + repeated, gap: repeated, neighborIds: [leftN.id].filter(Boolean), between: false });
    if (rightN) results.push({ pos: rightN[minKey] - repeated - movingBounds[sizeKey], gap: repeated, neighborIds: [rightN.id].filter(Boolean), between: false });
  }
  return results;
}

// bounds: the proposed (unsnapped) bounding box in content space.
// `siblingBoundsForEqualSpacing` (optional): bounds list for computing
// equal-spacing candidates (spec §46/§47) — omitted during resize, where
// equal-spacing doesn't apply.
// Returns the correction (dx, dy), the matched candidate lines (for
// rendering), and equal-spacing marker info when that tier won.
export function computeSnap(bounds, candidates, thresholdContentPx, siblingBoundsForEqualSpacing) {
  function bestForAxis(edges, axisCandidates, minKey, maxKey, sizeKey) {
    let winner = null; // { delta, priority, pos }
    let lines = [];

    // Tiers 1..4 and 6 from the plain candidate list, tier 5 (equal
    // spacing) computed separately below — evaluated together, sorted by
    // priority, so the first tier with any hit inside the threshold wins
    // (spec §41's "closest valid candidate wins within its priority group").
    const byPriority = new Map();
    axisCandidates.forEach((c) => {
      edges.forEach((edge) => {
        const dist = Math.abs(edge - c.pos);
        if (dist > thresholdContentPx) return;
        if (!byPriority.has(c.priority)) byPriority.set(c.priority, []);
        byPriority.get(c.priority).push({ dist, delta: c.pos - edge, pos: c.pos });
      });
    });

    if (siblingBoundsForEqualSpacing && siblingBoundsForEqualSpacing.length >= 1) {
      const axis = minKey === "left" ? "horizontal" : "vertical";
      const eq = findEqualSpacingCandidates(bounds, siblingBoundsForEqualSpacing, axis);
      eq.forEach((c) => {
        const dist = Math.abs(bounds[minKey] - c.pos);
        if (dist > thresholdContentPx) return;
        if (!byPriority.has(SNAP_PRIORITY.EQUAL_SPACING)) byPriority.set(SNAP_PRIORITY.EQUAL_SPACING, []);
        byPriority.get(SNAP_PRIORITY.EQUAL_SPACING).push({ dist, delta: c.pos - bounds[minKey], pos: c.pos, equalSpacing: c });
      });
    }

    const priorities = [...byPriority.keys()].sort((a, b) => a - b);
    if (priorities.length === 0) return { delta: 0, lines: [], equalSpacing: null };
    const topTier = byPriority.get(priorities[0]);
    const minDist = Math.min(...topTier.map((c) => c.dist));
    const tied = topTier.filter((c) => c.dist === minDist);
    lines = [...new Set(tied.map((c) => c.pos))];
    return { delta: tied[0].delta, lines, equalSpacing: tied[0].equalSpacing || null };
  }

  const edgesX = [bounds.left, bounds.centerX, bounds.right];
  const edgesY = [bounds.top, bounds.centerY, bounds.bottom];
  const x = bestForAxis(edgesX, candidates.vertical, "left", "right", "width");
  const y = bestForAxis(edgesY, candidates.horizontal, "top", "bottom", "height");

  return {
    dx: x.delta,
    dy: y.delta,
    lines: { vertical: x.lines, horizontal: y.lines },
    equalSpacing: { horizontal: x.equalSpacing, vertical: y.equalSpacing },
  };
}

// Resize-time snapping for a SINGLE moving edge (used by App.jsx's
// Transformer boundBoxFunc) — restricted to page/guide/margin candidates
// (spec §59; other-object-edge and grid resize-snapping are a documented
// limitation this phase, see the Phase 10 completion report). Axis-aligned
// only: callers should skip this entirely for a rotated node.
export function snapResizeEdge(value, axisCandidates, thresholdContentPx) {
  const relevant = axisCandidates.filter((c) => c.priority <= SNAP_PRIORITY.OBJECT);
  let best = null;
  relevant.forEach((c) => {
    const dist = Math.abs(c.pos - value);
    if (dist <= thresholdContentPx && (!best || dist < best.dist)) best = { dist, pos: c.pos };
  });
  return best ? best.pos : value;
}

// Screen-distance-aware threshold (spec §42) — sensitivityPx is already a
// SCREEN pixel budget (see precisionPreferences.js), converted here to the
// current zoom's content-space equivalent so it feels the same regardless
// of zoom level, matching the pre-Phase-10 SNAP_THRESHOLD_SCREEN_PX
// behavior this replaces.
export function thresholdForScale(sensitivityPx, scale) {
  return sensitivityPx / Math.max(0.001, scale);
}
