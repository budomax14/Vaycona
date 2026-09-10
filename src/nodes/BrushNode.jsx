import React from "react";
import { Line } from "react-konva";

// Points are stored relative to the item's own x/y (its stroke's bounding
// box top-left), same "local unrotated geometry" convention LineNode uses —
// keeps x/y/width/height a plain generic box for bounds/snapping/layers
// with no brush-specific logic needed anywhere else.
export default function BrushNode({ item, commonProps }) {
  return (
    <Line
      {...commonProps}
      points={item.points || []}
      stroke={item.stroke || "#111827"}
      strokeWidth={item.strokeWidth || 8}
      lineCap="round"
      lineJoin="round"
      tension={0.3}
      hitStrokeWidth={Math.max(20, item.strokeWidth || 8)}
    />
  );
}
