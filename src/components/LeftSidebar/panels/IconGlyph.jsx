import React from "react";
import { ICON_NATIVE_SIZE } from "../../../iconCatalog";

const STROKE_WIDTH = 2;

function renderPrimitive([tag, attrs], index) {
  const isSolid = attrs.fill === "currentColor";
  const key = `${tag}-${index}`;

  if (tag === "path") {
    return (
      <path
        key={key}
        d={attrs.d}
        fill={isSolid ? "currentColor" : "none"}
        stroke={isSolid ? "none" : "currentColor"}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  if (tag === "circle") {
    return (
      <circle
        key={key}
        cx={attrs.cx}
        cy={attrs.cy}
        r={attrs.r}
        fill={isSolid ? "currentColor" : "none"}
        stroke={isSolid ? "none" : "currentColor"}
        strokeWidth={STROKE_WIDTH}
      />
    );
  }
  if (tag === "rect") {
    return (
      <rect
        key={key}
        x={attrs.x}
        y={attrs.y}
        width={attrs.width}
        height={attrs.height}
        rx={attrs.rx || attrs.ry || 0}
        fill={isSolid ? "currentColor" : "none"}
        stroke={isSolid ? "none" : "currentColor"}
        strokeWidth={STROKE_WIDTH}
      />
    );
  }
  if (tag === "line") {
    return (
      <line
        key={key}
        x1={attrs.x1}
        y1={attrs.y1}
        x2={attrs.x2}
        y2={attrs.y2}
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
      />
    );
  }
  if (tag === "polyline") {
    return (
      <polyline
        key={key}
        points={attrs.points.join(",")}
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  if (tag === "polygon") {
    return (
      <polygon
        key={key}
        points={attrs.points.join(",")}
        fill={isSolid ? "currentColor" : "none"}
        stroke={isSolid ? "none" : "currentColor"}
        strokeWidth={STROKE_WIDTH}
        strokeLinejoin="round"
      />
    );
  }
  return null;
}

// Renders an iconCatalog entry as a plain inline SVG, mirroring IconNode.jsx's
// primitive-to-shape mapping so the sidebar preview always matches what gets
// inserted onto the canvas — no separate lucide-react icon set to keep in sync.
export default function IconGlyph({ icon, size = 20 }) {
  if (!icon) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${ICON_NATIVE_SIZE} ${ICON_NATIVE_SIZE}`}
      aria-hidden="true"
    >
      {icon.node.map((tuple, index) => renderPrimitive(tuple, index))}
    </svg>
  );
}
