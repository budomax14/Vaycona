// Pure data-layer functions for the "table" element type. No React/Konva
// here — App.jsx/TableNode.jsx/svgExport.js all consume these so the
// on-canvas render, the exported render, and every mutation (undo/redo-safe,
// since every function returns a brand-new plain-JSON object rather than
// mutating) stay in lockstep.

export const MIN_COL_WIDTH = 40;
export const MIN_ROW_HEIGHT = 28;
export const MAX_TABLE_DIM = 50;
export const DEFAULT_COL_WIDTH = 140;
export const DEFAULT_ROW_HEIGHT = 40;

function clampTableDimension(n) {
  return Math.max(1, Math.min(MAX_TABLE_DIM, Math.round(n) || 1));
}

function makeCell(text = "") {
  return { text, style: {} };
}

const SAMPLE_HEADERS = ["Product", "Quantity", "Price"];
const SAMPLE_ROWS = [
  ["Product A", "2", "$20"],
  ["Product B", "5", "$15"],
  ["Product C", "1", "$30"],
];

function defaultStyles() {
  return {
    cellDefault: {
      fill: "#ffffff",
      color: "#111827",
      fontFamily: "Arial",
      fontSize: 14,
      bold: false,
      italic: false,
      underline: false,
      align: "left",
      valign: "middle",
    },
    header: { fill: "#f3f4f6", color: "#111827", bold: true },
    border: {
      color: "#d1d5db",
      width: 1,
      style: "solid",
      show: { top: true, bottom: true, left: true, right: true, insideH: true, insideV: true },
    },
    padding: 8,
    cornerRadius: 0,
  };
}

// data, if provided, is a string[][] (row-major) used verbatim; otherwise a
// small set of placeholder product/quantity/price sample values is used —
// "Default content may be simple placeholders" (spec §2).
export function createTableData({ rows = 3, columns = 3, data } = {}) {
  const r = clampTableDimension(rows);
  const c = clampTableDimension(columns);
  const cells = [];
  for (let ri = 0; ri < r; ri += 1) {
    const row = [];
    for (let ci = 0; ci < c; ci += 1) {
      let text = "";
      if (data) {
        const value = data[ri]?.[ci];
        text = value == null ? "" : String(value);
      } else if (ri === 0) {
        text = SAMPLE_HEADERS[ci] || `Column ${ci + 1}`;
      } else if (c <= SAMPLE_HEADERS.length) {
        const sample = SAMPLE_ROWS[(ri - 1) % SAMPLE_ROWS.length];
        text = sample[ci] || "";
      }
      row.push(makeCell(text));
    }
    cells.push(row);
  }
  return {
    rows: r,
    columns: c,
    cells,
    columnWidths: new Array(c).fill(DEFAULT_COL_WIDTH),
    rowHeights: new Array(r).fill(DEFAULT_ROW_HEIGHT),
    mergedCells: [],
    headerRowCount: r > 1 ? 1 : 0,
    alternatingRows: { enabled: false, color1: "#ffffff", color2: "#f3f4f6" },
    styles: defaultStyles(),
  };
}

// Reusable creation entry point matching spec §46's future-AI shape:
// createTable({ rows, columns, data, styles }).
export function createTable({ rows, columns, data, styles } = {}) {
  const table = createTableData({ rows, columns, data });
  if (styles) table.styles = { ...table.styles, ...styles };
  return table;
}

// Deep-clone of every JSON-safe nested field a table carries — used by
// App.jsx's cloneWithNewIds so a duplicated table never shares mutable
// nested objects/arrays with its source (mirrors the existing chart branch).
export function cloneTableData(table) {
  return JSON.parse(
    JSON.stringify({
      rows: table.rows,
      columns: table.columns,
      cells: table.cells,
      columnWidths: table.columnWidths,
      rowHeights: table.rowHeights,
      mergedCells: table.mergedCells,
      headerRowCount: table.headerRowCount,
      alternatingRows: table.alternatingRows,
      styles: table.styles,
    })
  );
}

export function resolveCellStyle(table, r, c) {
  const styles = table.styles || {};
  let style = { ...(styles.cellDefault || {}) };
  const headerRowCount = table.headerRowCount || 0;
  if (r < headerRowCount) {
    style = { ...style, ...(styles.header || {}) };
  } else if (table.alternatingRows?.enabled) {
    const bodyIndex = r - headerRowCount;
    style = {
      ...style,
      fill: bodyIndex % 2 === 0 ? table.alternatingRows.color1 : table.alternatingRows.color2,
    };
  }
  const cell = table.cells?.[r]?.[c];
  if (cell?.style) style = { ...style, ...cell.style };
  return style;
}

// Map of "r,c" -> merge descriptor for every cell covered by a merge
// (anchor included, isAnchor=true for the top-left cell).
export function getMergeMap(table) {
  const map = new Map();
  (table.mergedCells || []).forEach(({ row, col, rowSpan, colSpan }) => {
    for (let r = row; r < row + rowSpan; r += 1) {
      for (let c = col; c < col + colSpan; c += 1) {
        map.set(`${r},${c}`, { anchorRow: row, anchorCol: col, isAnchor: r === row && c === col, rowSpan, colSpan });
      }
    }
  });
  return map;
}

// Pixel geometry for the whole grid — the single source of truth shared by
// TableNode.jsx (live canvas), TableEditChrome.jsx (hit-testing/handles),
// TableCellEditOverlay.jsx (DOM overlay positioning) and svgExport.js
// (exported output), so none of them can ever visually drift from another.
export function computeTableLayout(table) {
  const colWidths = table.columnWidths || [];
  const rowHeights = table.rowHeights || [];
  const colOffsets = [0];
  colWidths.forEach((w) => colOffsets.push(colOffsets[colOffsets.length - 1] + Math.max(MIN_COL_WIDTH, w || 0)));
  const rowOffsets = [0];
  rowHeights.forEach((h) => rowOffsets.push(rowOffsets[rowOffsets.length - 1] + Math.max(MIN_ROW_HEIGHT, h || 0)));
  const totalWidth = colOffsets[colOffsets.length - 1] || 0;
  const totalHeight = rowOffsets[rowOffsets.length - 1] || 0;
  const mergeMap = getMergeMap(table);

  function cellRect(r, c) {
    const merge = mergeMap.get(`${r},${c}`);
    const anchorRow = merge ? merge.anchorRow : r;
    const anchorCol = merge ? merge.anchorCol : c;
    const rowSpan = merge ? merge.rowSpan : 1;
    const colSpan = merge ? merge.colSpan : 1;
    const x = colOffsets[anchorCol];
    const y = rowOffsets[anchorRow];
    return {
      x,
      y,
      width: colOffsets[anchorCol + colSpan] - x,
      height: rowOffsets[anchorRow + rowSpan] - y,
      isAnchor: !merge || merge.isAnchor,
      anchorRow,
      anchorCol,
    };
  }

  return { colOffsets, rowOffsets, totalWidth, totalHeight, mergeMap, cellRect };
}

function shiftMergesForRowInsert(mergedCells, insertIndex) {
  return (mergedCells || []).map((m) => {
    if (m.row >= insertIndex) return { ...m, row: m.row + 1 };
    if (m.row + m.rowSpan > insertIndex) return { ...m, rowSpan: m.rowSpan + 1 };
    return m;
  });
}

function shrinkMergesForRowDelete(mergedCells, deleteIndex) {
  const result = [];
  (mergedCells || []).forEach((m) => {
    if (deleteIndex < m.row) {
      result.push({ ...m, row: m.row - 1 });
    } else if (deleteIndex >= m.row + m.rowSpan) {
      result.push(m);
    } else {
      const rowSpan = m.rowSpan - 1;
      if (rowSpan >= 1) result.push({ ...m, rowSpan });
    }
  });
  return result;
}

function shiftMergesForColInsert(mergedCells, insertIndex) {
  return (mergedCells || []).map((m) => {
    if (m.col >= insertIndex) return { ...m, col: m.col + 1 };
    if (m.col + m.colSpan > insertIndex) return { ...m, colSpan: m.colSpan + 1 };
    return m;
  });
}

function shrinkMergesForColDelete(mergedCells, deleteIndex) {
  const result = [];
  (mergedCells || []).forEach((m) => {
    if (deleteIndex < m.col) {
      result.push({ ...m, col: m.col - 1 });
    } else if (deleteIndex >= m.col + m.colSpan) {
      result.push(m);
    } else {
      const colSpan = m.colSpan - 1;
      if (colSpan >= 1) result.push({ ...m, colSpan });
    }
  });
  return result;
}

export function insertRow(table, index) {
  if (table.rows >= MAX_TABLE_DIM) return table;
  const idx = Math.max(0, Math.min(index, table.rows));
  const newRow = new Array(table.columns).fill(null).map(() => makeCell(""));
  const cells = table.cells.map((row) => row.slice());
  cells.splice(idx, 0, newRow);
  const rowHeights = table.rowHeights.slice();
  rowHeights.splice(idx, 0, DEFAULT_ROW_HEIGHT);
  const mergedCells = shiftMergesForRowInsert(table.mergedCells, idx);
  const headerRowCount = idx < (table.headerRowCount || 0) ? (table.headerRowCount || 0) + 1 : table.headerRowCount;
  return { ...table, rows: table.rows + 1, cells, rowHeights, mergedCells, headerRowCount };
}

// Preserves at least 1 row (spec §7).
export function deleteRow(table, index) {
  if (table.rows <= 1) return table;
  const idx = Math.max(0, Math.min(index, table.rows - 1));
  const cells = table.cells.filter((_, r) => r !== idx);
  const rowHeights = table.rowHeights.filter((_, r) => r !== idx);
  const mergedCells = shrinkMergesForRowDelete(table.mergedCells, idx);
  let headerRowCount = table.headerRowCount || 0;
  if (idx < headerRowCount) headerRowCount = Math.max(0, headerRowCount - 1);
  return { ...table, rows: table.rows - 1, cells, rowHeights, mergedCells, headerRowCount };
}

export function insertColumn(table, index) {
  if (table.columns >= MAX_TABLE_DIM) return table;
  const idx = Math.max(0, Math.min(index, table.columns));
  const cells = table.cells.map((row) => {
    const next = row.slice();
    next.splice(idx, 0, makeCell(""));
    return next;
  });
  const columnWidths = table.columnWidths.slice();
  columnWidths.splice(idx, 0, DEFAULT_COL_WIDTH);
  const mergedCells = shiftMergesForColInsert(table.mergedCells, idx);
  return { ...table, columns: table.columns + 1, cells, columnWidths, mergedCells };
}

// Preserves at least 1 column (spec §7).
export function deleteColumn(table, index) {
  if (table.columns <= 1) return table;
  const idx = Math.max(0, Math.min(index, table.columns - 1));
  const cells = table.cells.map((row) => row.filter((_, c) => c !== idx));
  const columnWidths = table.columnWidths.filter((_, c) => c !== idx);
  const mergedCells = shrinkMergesForColDelete(table.mergedCells, idx);
  return { ...table, columns: table.columns - 1, cells, columnWidths, mergedCells };
}

export function normalizeRange(range) {
  const { startRow, startCol, endRow, endCol } = range;
  return {
    startRow: Math.min(startRow, endRow),
    endRow: Math.max(startRow, endRow),
    startCol: Math.min(startCol, endCol),
    endCol: Math.max(startCol, endCol),
  };
}

// Only allows merging a rectangular range that doesn't already overlap an
// existing merge (spec §11: "Do not merge non-contiguous selections" — the
// caller only ever passes a rectangular row/col range, and this additionally
// refuses ranges that would swallow part of another merge, which the user
// must unmerge first).
export function canMergeRange(table, range) {
  const { startRow, startCol, endRow, endCol } = normalizeRange(range);
  if (startRow === endRow && startCol === endCol) return false;
  const mergeMap = getMergeMap(table);
  for (let r = startRow; r <= endRow; r += 1) {
    for (let c = startCol; c <= endCol; c += 1) {
      if (mergeMap.has(`${r},${c}`)) return false;
    }
  }
  return true;
}

function firstNonEmptyCellText(table, startRow, startCol, endRow, endCol) {
  for (let r = startRow; r <= endRow; r += 1) {
    for (let c = startCol; c <= endCol; c += 1) {
      const t = table.cells[r]?.[c]?.text;
      if (t) return t;
    }
  }
  return "";
}

export function mergeCellRange(table, range) {
  if (!canMergeRange(table, range)) return table;
  const { startRow, startCol, endRow, endCol } = normalizeRange(range);
  const anchorText = firstNonEmptyCellText(table, startRow, startCol, endRow, endCol);
  const cells = table.cells.map((row, r) =>
    row.map((cell, c) => {
      if (r < startRow || r > endRow || c < startCol || c > endCol) return cell;
      if (r === startRow && c === startCol) return { ...cell, text: anchorText };
      return { ...cell, text: "" };
    })
  );
  const mergedCells = [
    ...(table.mergedCells || []),
    { row: startRow, col: startCol, rowSpan: endRow - startRow + 1, colSpan: endCol - startCol + 1 },
  ];
  return { ...table, cells, mergedCells };
}

// Removing the mergedCells entry restores the grid; the anchor cell's text
// is left as-is (spec §12: "merged cell's text can remain in the top-left
// restored cell") since the other covered cells' text was already cleared
// at merge time.
export function unmergeCell(table, r, c) {
  const mergeMap = getMergeMap(table);
  const info = mergeMap.get(`${r},${c}`);
  if (!info) return table;
  const mergedCells = (table.mergedCells || []).filter((m) => !(m.row === info.anchorRow && m.col === info.anchorCol));
  return { ...table, mergedCells };
}

export function setHeaderRowCount(table, count) {
  return { ...table, headerRowCount: Math.max(0, Math.min(table.rows, Math.round(count))) };
}

export function setAlternatingRows(table, changes) {
  return { ...table, alternatingRows: { ...table.alternatingRows, ...changes } };
}

export function setTableStyles(table, changes) {
  return { ...table, styles: { ...table.styles, ...changes } };
}

export function setColumnWidth(table, index, width) {
  const columnWidths = table.columnWidths.slice();
  columnWidths[index] = Math.max(MIN_COL_WIDTH, width);
  return { ...table, columnWidths };
}

export function setRowHeight(table, index, height) {
  const rowHeights = table.rowHeights.slice();
  rowHeights[index] = Math.max(MIN_ROW_HEIGHT, height);
  return { ...table, rowHeights };
}

export function setCellsStyle(table, range, styleChanges) {
  const { startRow, startCol, endRow, endCol } = normalizeRange(range);
  const cells = table.cells.map((row, r) =>
    row.map((cell, c) => {
      if (r < startRow || r > endRow || c < startCol || c > endCol) return cell;
      return { ...cell, style: { ...cell.style, ...styleChanges } };
    })
  );
  return { ...table, cells };
}

export function setCellText(table, r, c, text) {
  const cells = table.cells.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? { ...cell, text } : cell)) : row));
  return { ...table, cells };
}

export function clearCellsRange(table, range) {
  const { startRow, startCol, endRow, endCol } = normalizeRange(range);
  const cells = table.cells.map((row, r) =>
    row.map((cell, c) => {
      if (r < startRow || r > endRow || c < startCol || c > endCol) return cell;
      return { ...cell, text: "" };
    })
  );
  return { ...table, cells };
}

// Whole-element resize (spec §10A): redistributes column/row sizes
// proportionally rather than baking a Konva scale into the render, so text
// stays crisp instead of being CSS/raster-stretched.
export function resizeTableToFit(table, newWidth, newHeight) {
  const { totalWidth, totalHeight } = computeTableLayout(table);
  const widthRatio = totalWidth > 0 ? newWidth / totalWidth : 1;
  const heightRatio = totalHeight > 0 ? newHeight / totalHeight : 1;
  const columnWidths = table.columnWidths.map((w) => Math.max(MIN_COL_WIDTH, w * widthRatio));
  const rowHeights = table.rowHeights.map((h) => Math.max(MIN_ROW_HEIGHT, h * heightRatio));
  return { ...table, columnWidths, rowHeights };
}

// Pastes a string[][] grid at (startRow, startCol), auto-expanding the
// table if the pasted data is larger (spec §22), clamped at MAX_TABLE_DIM
// (spec §39) — returns { table, truncated } so the caller can surface a
// friendly warning instead of silently losing data or crashing.
export function applyPastedGrid(table, startRow, startCol, grid) {
  if (!grid || !grid.length) return { table, truncated: false };
  let truncated = false;
  let rows = grid.length;
  let cols = grid.reduce((max, row) => Math.max(max, row.length), 0);
  if (startRow + rows > MAX_TABLE_DIM) {
    rows = MAX_TABLE_DIM - startRow;
    truncated = true;
  }
  if (startCol + cols > MAX_TABLE_DIM) {
    cols = MAX_TABLE_DIM - startCol;
    truncated = true;
  }
  if (rows <= 0 || cols <= 0) return { table, truncated: true };

  let next = table;
  const neededRows = startRow + rows;
  const neededCols = startCol + cols;
  while (next.rows < neededRows && next.rows < MAX_TABLE_DIM) next = insertRow(next, next.rows);
  while (next.columns < neededCols && next.columns < MAX_TABLE_DIM) next = insertColumn(next, next.columns);

  const cells = next.cells.map((row, r) =>
    row.map((cell, c) => {
      if (r < startRow || r >= startRow + rows || c < startCol || c >= startCol + cols) return cell;
      const value = grid[r - startRow]?.[c - startCol];
      return value == null ? cell : { ...cell, text: String(value) };
    })
  );
  return { table: { ...next, cells }, truncated };
}

export { clampTableDimension };
