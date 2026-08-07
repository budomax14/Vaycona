import React from "react";
import { Group, Rect, Text, Line } from "react-konva";
import { computeTableLayout, resolveCellStyle } from "../tableUtils";
import { borderDashProps } from "../borderStyles";

function cellFontStyle(style) {
  const parts = [];
  if (style.italic) parts.push("italic");
  if (style.bold) parts.push("bold");
  return parts.length ? parts.join(" ") : "normal";
}

// Registry renderer for type:"table". Pure/export-safe: it only ever reads
// `item` — no selection/editing state lives here, so the exact same output
// renders on the live canvas and in the detached export Stage (which never
// mounts TableEditChrome). Rendered as live Konva primitives (Rect/Line/Text)
// rather than a rasterized image like ChartNode, since a table's grid is
// simple rectilinear vector geometry — this keeps text crisp and avoids any
// rasterize debounce lag while resizing/typing.
export default function TableNode({ item, commonProps }) {
  const layout = computeTableLayout(item);
  const { colOffsets, rowOffsets, totalWidth, totalHeight, mergeMap } = layout;
  const border = item.styles?.border || {};
  const show = border.show || {};
  const padding = item.styles?.padding ?? 8;
  const cornerRadius = item.styles?.cornerRadius || 0;
  const dash = borderDashProps(border.style, border.width);

  const cellNodes = [];
  for (let r = 0; r < item.rows; r += 1) {
    for (let c = 0; c < item.columns; c += 1) {
      const merge = mergeMap.get(`${r},${c}`);
      if (merge && !merge.isAnchor) continue;
      const rect = layout.cellRect(r, c);
      const style = resolveCellStyle(item, r, c);
      const cellText = item.cells?.[r]?.[c]?.text || "";
      cellNodes.push(
        <React.Fragment key={`cell-${r}-${c}`}>
          {style.fill && style.fill !== "transparent" && (
            <Rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={style.fill} listening={false} />
          )}
          <Text
            x={rect.x + padding}
            y={rect.y + padding}
            width={Math.max(0, rect.width - padding * 2)}
            height={Math.max(0, rect.height - padding * 2)}
            text={cellText}
            fontFamily={style.fontFamily || "Arial"}
            fontSize={style.fontSize || 14}
            fontStyle={cellFontStyle(style)}
            textDecoration={style.underline ? "underline" : ""}
            fill={style.color || "#111827"}
            align={style.align || "left"}
            verticalAlign={style.valign || "middle"}
            wrap="word"
            listening={false}
          />
        </React.Fragment>
      );
    }
  }

  const gridLines = [];
  if (show.insideV) {
    for (let i = 1; i < item.columns; i += 1) {
      for (let r = 0; r < item.rows; r += 1) {
        const left = mergeMap.get(`${r},${i - 1}`);
        const right = mergeMap.get(`${r},${i}`);
        if (left && right && left.anchorRow === right.anchorRow && left.anchorCol === right.anchorCol) continue;
        gridLines.push(
          <Line
            key={`v-${i}-${r}`}
            points={[colOffsets[i], rowOffsets[r], colOffsets[i], rowOffsets[r + 1]]}
            stroke={border.color || "#d1d5db"}
            strokeWidth={border.width ?? 1}
            {...dash}
            listening={false}
          />
        );
      }
    }
  }
  if (show.insideH) {
    for (let j = 1; j < item.rows; j += 1) {
      for (let c = 0; c < item.columns; c += 1) {
        const top = mergeMap.get(`${j - 1},${c}`);
        const bottom = mergeMap.get(`${j},${c}`);
        if (top && bottom && top.anchorRow === bottom.anchorRow && top.anchorCol === bottom.anchorCol) continue;
        gridLines.push(
          <Line
            key={`h-${j}-${c}`}
            points={[colOffsets[c], rowOffsets[j], colOffsets[c + 1], rowOffsets[j]]}
            stroke={border.color || "#d1d5db"}
            strokeWidth={border.width ?? 1}
            {...dash}
            listening={false}
          />
        );
      }
    }
  }

  // Straight per-side segments only when corners are square — a rounded
  // outer edge needs a single continuous stroked path instead (below),
  // since individual straight segments can't follow the curve at corners.
  const outerBorders = [];
  if (!cornerRadius) {
    if (show.top) outerBorders.push([0, 0, totalWidth, 0]);
    if (show.bottom) outerBorders.push([0, totalHeight, totalWidth, totalHeight]);
    if (show.left) outerBorders.push([0, 0, 0, totalHeight]);
    if (show.right) outerBorders.push([totalWidth, 0, totalWidth, totalHeight]);
  }

  return (
    <Group {...commonProps}>
      <Rect
        width={totalWidth}
        height={totalHeight}
        fill="transparent"
        cornerRadius={cornerRadius}
      />
      <Group clipFunc={cornerRadius ? (ctx) => drawRoundedRectPath(ctx, totalWidth, totalHeight, cornerRadius) : undefined}>
        {cellNodes}
        {gridLines}
      </Group>
      {outerBorders.map(([x1, y1, x2, y2], i) => (
        <Line
          key={`outer-${i}`}
          points={[x1, y1, x2, y2]}
          stroke={border.color || "#d1d5db"}
          strokeWidth={border.width ?? 1}
          {...dash}
          listening={false}
        />
      ))}
      {cornerRadius > 0 && (show.top || show.bottom || show.left || show.right) && (
        <Rect
          width={totalWidth}
          height={totalHeight}
          cornerRadius={cornerRadius}
          stroke={border.color || "#d1d5db"}
          strokeWidth={border.width ?? 1}
          {...dash}
          listening={false}
        />
      )}
    </Group>
  );
}

function drawRoundedRectPath(ctx, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(width - r, 0);
  ctx.arc(width - r, r, r, -Math.PI / 2, 0);
  ctx.lineTo(width, height - r);
  ctx.arc(width - r, height - r, r, 0, Math.PI / 2);
  ctx.lineTo(r, height);
  ctx.arc(r, height - r, r, Math.PI / 2, Math.PI);
  ctx.lineTo(0, r);
  ctx.arc(r, r, r, Math.PI, (3 * Math.PI) / 2);
  ctx.closePath();
}
