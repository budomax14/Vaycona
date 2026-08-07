import React, { useEffect, useRef } from "react";
import { contentToScreen } from "../viewport";
import { computeTableLayout, resolveCellStyle } from "../tableUtils";

// DOM contentEditable overlay for the single table cell currently being
// typed into — same technique TextEditOverlay.jsx uses (a real
// contentEditable positioned over the Konva canvas, since Konva itself has
// no native text-editing surface), deliberately scoped down to plain text
// (no per-character rich-text spans) per spec §4/§14: cell formatting is
// applied per-cell via the properties toolbar, not per character run.
export default function TableCellEditOverlay({ item, row, col, viewport, onCommit, onRequestExit, onTabNext, onEnterNext }) {
  const rootRef = useRef(null);
  const layout = computeTableLayout(item);
  const rect = layout.cellRect(row, col);
  const style = resolveCellStyle(item, layout.mergeMap.get(`${row},${col}`)?.anchorRow ?? row, layout.mergeMap.get(`${row},${col}`)?.anchorCol ?? col);
  const padding = item.styles?.padding ?? 8;

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    node.textContent = item.cells?.[row]?.[col]?.text || "";
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row, col]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (rootRef.current?.contains(event.target)) return;
      if (event.target.closest?.("[data-text-toolbar-safe]")) return;
      onCommit(rootRef.current?.textContent || "");
      onRequestExit();
    }
    window.addEventListener("mousedown", handlePointerDown, true);
    return () => window.removeEventListener("mousedown", handlePointerDown, true);
  }, [onCommit, onRequestExit]);

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCommit(rootRef.current?.textContent || "");
      onRequestExit();
    } else if (event.key === "Tab") {
      event.preventDefault();
      onCommit(rootRef.current?.textContent || "");
      onTabNext(event.shiftKey ? -1 : 1);
    } else if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onCommit(rootRef.current?.textContent || "");
      onEnterNext();
    }
  }

  const screen = contentToScreen({ x: item.x + rect.x, y: item.y + rect.y }, viewport);
  const width = rect.width * viewport.scale;
  const height = rect.height * viewport.scale;

  return (
    <div
      ref={rootRef}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-text-toolbar-safe
      onKeyDown={handleKeyDown}
      onBlur={() => onCommit(rootRef.current?.textContent || "")}
      className="cursor-text whitespace-pre-wrap wrap-break-word outline-none"
      style={{
        position: "absolute",
        left: screen.x,
        top: screen.y,
        width,
        height,
        padding: padding * viewport.scale,
        boxSizing: "border-box",
        background: style.fill && style.fill !== "transparent" ? style.fill : "#ffffff",
        color: style.color || "#111827",
        fontFamily: style.fontFamily || "Arial",
        fontSize: (style.fontSize || 14) * viewport.scale,
        fontWeight: style.bold ? "bold" : "normal",
        fontStyle: style.italic ? "italic" : "normal",
        textDecoration: style.underline ? "underline" : "none",
        textAlign: style.align || "left",
        zIndex: 26,
        outline: "2px solid #d97706",
        outlineOffset: "-1px",
      }}
    />
  );
}
