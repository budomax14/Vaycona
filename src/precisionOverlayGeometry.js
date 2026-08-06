// Phase 10 — pure geometry generators for grid/margin/safe-area/layout-grid/
// baseline overlays. Used by BOTH CanvasOverlays.jsx (what to draw) and
// snapping.js (what to snap to) — one source of truth for "where are the
// lines", per the session rule against duplicating this math across
// features. Nothing here touches React/Konva/DOM; everything is page-space
// numbers in, arrays out.

// Square/dot grid line (or dot-center) positions along one axis, for the
// visible [from, to] window — NOT the whole page if the page is huge,
// since a dense grid over a large page could otherwise generate an
// unbounded array (spec §86/§82).
export function gridPositions(spacing, offset, from, to) {
  if (!Number.isFinite(spacing) || spacing <= 0) return [];
  const first = Math.floor((from - offset) / spacing) * spacing + offset;
  const positions = [];
  const MAX_LINES = 4000; // hard safety ceiling regardless of caller-provided range
  for (let v = first, count = 0; v <= to + spacing && count < MAX_LINES; v += spacing, count++) {
    positions.push(v);
  }
  return positions;
}

export function squareGridLines(grid, pageWidth, pageHeight) {
  return {
    vertical: gridPositions(grid.spacingX, grid.offsetX, 0, pageWidth).filter((x) => x >= 0 && x <= pageWidth),
    horizontal: gridPositions(grid.spacingY, grid.offsetY, 0, pageHeight).filter((y) => y >= 0 && y <= pageHeight),
  };
}

export function dotGridPoints(grid, pageWidth, pageHeight) {
  const xs = gridPositions(grid.spacingX, grid.offsetX, 0, pageWidth).filter((x) => x >= 0 && x <= pageWidth);
  const ys = gridPositions(grid.spacingY, grid.offsetY, 0, pageHeight).filter((y) => y >= 0 && y <= pageHeight);
  // Capped independent of gridPositions' own per-axis cap — a dense grid on
  // a large page can still multiply out to something huge (spec §82/§86).
  const MAX_DOTS = 6000;
  const points = [];
  outer: for (const y of ys) {
    for (const x of xs) {
      if (points.length >= MAX_DOTS) break outer;
      points.push({ x, y });
    }
  }
  return points;
}

// Rectangle for the margin overlay (inset from each side independently).
export function marginRect(margins, pageWidth, pageHeight) {
  const width = Math.max(0, pageWidth - margins.left - margins.right);
  const height = Math.max(0, pageHeight - margins.top - margins.bottom);
  return { x: margins.left, y: margins.top, width, height };
}

export function safeAreaRect(safeArea, pageWidth, pageHeight) {
  const insetX = pageWidth * safeArea.insetPercent;
  const insetY = pageHeight * safeArea.insetPercent;
  return { x: insetX, y: insetY, width: Math.max(0, pageWidth - insetX * 2), height: Math.max(0, pageHeight - insetY * 2) };
}

export function bleedRect(bleed, pageWidth, pageHeight) {
  return { x: -bleed.sizePx, y: -bleed.sizePx, width: pageWidth + bleed.sizePx * 2, height: pageHeight + bleed.sizePx * 2 };
}

// Column edge X-positions (left edge of each column + the final right
// edge), honoring the layout grid's own margins/gutter. Equal-width only
// (spec §34's "equal-width columns" — the only mode actually built this
// phase; a future per-column custom-width mode would extend this, not
// replace it).
export function columnEdges(layoutGrid, pageWidth) {
  if (layoutGrid.columns <= 0) return [];
  const usable = pageWidth - layoutGrid.marginLeft - layoutGrid.marginRight;
  const totalGutter = layoutGrid.gutter * (layoutGrid.columns - 1);
  const columnWidth = (usable - totalGutter) / layoutGrid.columns;
  if (!Number.isFinite(columnWidth) || columnWidth <= 0) return [];
  const edges = [];
  for (let i = 0; i < layoutGrid.columns; i++) {
    const left = layoutGrid.marginLeft + i * (columnWidth + layoutGrid.gutter);
    edges.push(left, left + columnWidth);
  }
  return edges;
}

export function rowEdges(layoutGrid, pageHeight) {
  if (layoutGrid.rows <= 0) return [];
  const usable = pageHeight - layoutGrid.marginTop - layoutGrid.marginBottom;
  const totalGutter = layoutGrid.gutter * (layoutGrid.rows - 1);
  const rowHeight = (usable - totalGutter) / layoutGrid.rows;
  if (!Number.isFinite(rowHeight) || rowHeight <= 0) return [];
  const edges = [];
  for (let i = 0; i < layoutGrid.rows; i++) {
    const top = layoutGrid.marginTop + i * (rowHeight + layoutGrid.gutter);
    edges.push(top, top + rowHeight);
  }
  return edges;
}

// Column/row rectangles (for rendering fills/gutters), derived from the
// same edge math above so rendering and snapping can never disagree.
export function columnRects(layoutGrid, pageWidth, pageHeight) {
  const edges = columnEdges(layoutGrid, pageWidth);
  const rects = [];
  for (let i = 0; i < edges.length; i += 2) {
    rects.push({ x: edges[i], y: layoutGrid.marginTop, width: edges[i + 1] - edges[i], height: pageHeight - layoutGrid.marginTop - layoutGrid.marginBottom });
  }
  return rects;
}

export function rowRects(layoutGrid, pageWidth, pageHeight) {
  const edges = rowEdges(layoutGrid, pageHeight);
  const rects = [];
  for (let i = 0; i < edges.length; i += 2) {
    rects.push({ x: layoutGrid.marginLeft, y: edges[i], width: pageWidth - layoutGrid.marginLeft - layoutGrid.marginRight, height: edges[i + 1] - edges[i] });
  }
  return rects;
}

export function baselinePositions(baselineGrid, pageHeight) {
  return gridPositions(baselineGrid.spacing, baselineGrid.offset, 0, pageHeight).filter((y) => y >= 0 && y <= pageHeight);
}
