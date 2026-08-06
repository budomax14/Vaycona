import React from "react";
import { Arrow, Line } from "react-konva";
import { LINE_KINDS } from "../lineKinds";

// Local unrotated geometry is always the segment (0,0)-(width,0); `height`
// is always 0 and `rotation` (the same field every object already has)
// carries the angle. This keeps the item's x/y/width/height/rotation a
// plain generic box, so bounds/snapping/alignment/multi-select need no
// line-specific logic anywhere else in the app.
export default function LineNode({ item, commonProps }) {
  const kindDef = LINE_KINDS[item.lineKind] || LINE_KINDS.straight;
  const width = item.width || 1;
  const points = [0, 0, width, 0];
  const strokeWidth = item.strokeWidth || 4;

  if (kindDef.element === "arrow") {
    return (
      <Arrow
        {...commonProps}
        points={points}
        stroke={item.stroke || "#111827"}
        fill={item.stroke || "#111827"}
        strokeWidth={strokeWidth}
        pointerLength={Math.max(10, strokeWidth * 2.5)}
        pointerWidth={Math.max(10, strokeWidth * 2.5)}
        pointerAtBeginning={!!kindDef.pointerAtBeginning}
        pointerAtEnding={kindDef.pointerAtEnding !== false}
        hitStrokeWidth={Math.max(20, strokeWidth)}
      />
    );
  }

  return (
    <Line
      {...commonProps}
      points={points}
      stroke={item.stroke || "#111827"}
      strokeWidth={strokeWidth}
      dash={kindDef.dash}
      hitStrokeWidth={Math.max(20, strokeWidth)}
    />
  );
}
