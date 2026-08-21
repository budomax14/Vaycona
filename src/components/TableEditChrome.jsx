import React, { useRef } from "react";
import { Plus } from "lucide-react";
import { contentToScreen } from "../viewport";
import { computeTableLayout, normalizeRange, MIN_COL_WIDTH, MIN_ROW_HEIGHT } from "../tableUtils";

// DOM overlay providing every cell-level interaction while a table is in
// edit mode (spec §5–§9/§43) — same architectural slot LineEndpointHandles
// occupies for line editing: a plain, absolutely-positioned sibling of the
// Konva Stage (never mounted in the export tree, so none of this ever
// shows up in exported output "for free", no filtering needed anywhere).
// TableNode.jsx itself stays a pure, interaction-free renderer.
export default function TableEditChrome({
  item,
  viewport,
  cellSelection,
  onCellSelect,
  onCellDblClick,
  onColumnResizeLive,
  onColumnResizeCommit,
  onRowResizeLive,
  onRowResizeCommit,
  onAddRow,
  onAddColumn,
}) {
  const dragRef = useRef(null);
  const layout = computeTableLayout(item);
  const origin = contentToScreen({ x: item.x, y: item.y }, viewport);
  const scale = viewport.scale;

  function toScreenX(contentX) {
    return origin.x + contentX * scale;
  }
  function toScreenY(contentY) {
    return origin.y + contentY * scale;
  }

  function handleCellPointerDown(row, col, event) {
    event.preventDefault();
    event.stopPropagation();
    onCellSelect(row, col, { additive: false });
    dragRef.current = { kind: "select" };
    function handleMove(moveEvent) {
      const el = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      const target = el?.closest?.("[data-table-cell]");
      if (!target) return;
      onCellSelect(Number(target.dataset.row), Number(target.dataset.col), { additive: true });
    }
    function handleUp() {
      dragRef.current = null;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  }

  function handleColumnResizeStart(index, event) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = item.columnWidths[index];
    function handleMove(moveEvent) {
      const deltaContent = (moveEvent.clientX - startX) / scale;
      onColumnResizeLive(index, Math.max(MIN_COL_WIDTH, startWidth + deltaContent));
    }
    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      onColumnResizeCommit();
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  }

  function handleRowResizeStart(index, event) {
    event.preventDefault();
    event.stopPropagation();
    const startY = event.clientY;
    const startHeight = item.rowHeights[index];
    function handleMove(moveEvent) {
      const deltaContent = (moveEvent.clientY - startY) / scale;
      onRowResizeLive(index, Math.max(MIN_ROW_HEIGHT, startHeight + deltaContent));
    }
    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      onRowResizeCommit();
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  }

  const sel = cellSelection ? normalizeRange(cellSelection) : null;
  let selectionRect = null;
  if (sel) {
    const topLeft = layout.cellRect(sel.startRow, sel.startCol);
    const bottomRight = layout.cellRect(sel.endRow, sel.endCol);
    selectionRect = {
      x: Math.min(topLeft.x, bottomRight.x),
      y: Math.min(topLeft.y, bottomRight.y),
      width: Math.max(topLeft.x + topLeft.width, bottomRight.x + bottomRight.width) - Math.min(topLeft.x, bottomRight.x),
      height: Math.max(topLeft.y + topLeft.height, bottomRight.y + bottomRight.height) - Math.min(topLeft.y, bottomRight.y),
    };
  }

  const cellHitAreas = [];
  for (let r = 0; r < item.rows; r += 1) {
    for (let c = 0; c < item.columns; c += 1) {
      const merge = layout.mergeMap.get(`${r},${c}`);
      if (merge && !merge.isAnchor) continue;
      const rect = layout.cellRect(r, c);
      cellHitAreas.push(
        <div
          key={`hit-${r}-${c}`}
          data-table-cell
          data-row={r}
          data-col={c}
          onPointerDown={(event) => handleCellPointerDown(r, c, event)}
          onDoubleClick={(event) => {
            event.stopPropagation();
            onCellDblClick(r, c);
          }}
          style={{
            position: "absolute",
            left: toScreenX(rect.x),
            top: toScreenY(rect.y),
            width: rect.width * scale,
            height: rect.height * scale,
            cursor: "cell",
            touchAction: "none",
          }}
        />
      );
    }
  }

  const columnHandles = [];
  for (let i = 0; i < item.columns; i += 1) {
    const x = layout.colOffsets[i + 1];
    columnHandles.push(
      <div
        key={`colhandle-${i}`}
        onPointerDown={(event) => handleColumnResizeStart(i, event)}
        style={{
          position: "absolute",
          left: toScreenX(x) - 4,
          top: toScreenY(0) - 10,
          width: 8,
          height: layout.totalHeight * scale + 10,
          cursor: "col-resize",
          zIndex: 25,
          touchAction: "none",
        }}
      />
    );
  }

  const rowHandles = [];
  for (let i = 0; i < item.rows; i += 1) {
    const y = layout.rowOffsets[i + 1];
    rowHandles.push(
      <div
        key={`rowhandle-${i}`}
        onPointerDown={(event) => handleRowResizeStart(i, event)}
        style={{
          position: "absolute",
          left: toScreenX(0) - 10,
          top: toScreenY(y) - 4,
          width: layout.totalWidth * scale + 10,
          height: 8,
          cursor: "row-resize",
          zIndex: 25,
          touchAction: "none",
        }}
      />
    );
  }

  return (
    <>
      {cellHitAreas}
      {selectionRect && (
        <div
          className="pointer-events-none absolute border-2 border-amber-500 bg-amber-400/15"
          style={{
            left: toScreenX(selectionRect.x),
            top: toScreenY(selectionRect.y),
            width: selectionRect.width * scale,
            height: selectionRect.height * scale,
            zIndex: 24,
          }}
        />
      )}
      {columnHandles}
      {rowHandles}
      <button
        type="button"
        data-text-toolbar-safe
        title="Add row"
        onClick={() => onAddRow(item.rows)}
        className="pointer-events-auto absolute flex h-5 w-5 items-center justify-center rounded-full border border-amber-400 bg-white text-amber-600 shadow hover:bg-amber-50"
        style={{
          left: toScreenX(layout.totalWidth / 2) - 10,
          top: toScreenY(layout.totalHeight) + 6,
          zIndex: 25,
        }}
      >
        <Plus size={13} />
      </button>
      <button
        type="button"
        data-text-toolbar-safe
        title="Add column"
        onClick={() => onAddColumn(item.columns)}
        className="pointer-events-auto absolute flex h-5 w-5 items-center justify-center rounded-full border border-amber-400 bg-white text-amber-600 shadow hover:bg-amber-50"
        style={{
          left: toScreenX(layout.totalWidth) + 6,
          top: toScreenY(layout.totalHeight / 2) - 10,
          zIndex: 25,
        }}
      >
        <Plus size={13} />
      </button>
    </>
  );
}
