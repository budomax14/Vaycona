import React from "react";
import { Circle, Group, Line, Path, Rect } from "react-konva";
import { findIconByName, ICON_NATIVE_SIZE } from "../iconCatalog";

const ICON_STROKE_WIDTH = 2;

export function renderPrimitive([tag, attrs], index, color) {
  const isSolid = attrs.fill === "currentColor";
  const key = `${tag}-${index}`;

  if (tag === "path") {
    return (
      <Path
        key={key}
        data={attrs.d}
        fill={isSolid ? color : "none"}
        stroke={isSolid ? "none" : color}
        strokeWidth={ICON_STROKE_WIDTH}
        lineCap="round"
        lineJoin="round"
      />
    );
  }
  if (tag === "circle") {
    return (
      <Circle
        key={key}
        x={attrs.cx}
        y={attrs.cy}
        radius={attrs.r}
        fill={isSolid ? color : "none"}
        stroke={isSolid ? "none" : color}
        strokeWidth={ICON_STROKE_WIDTH}
      />
    );
  }
  if (tag === "rect") {
    return (
      <Rect
        key={key}
        x={attrs.x}
        y={attrs.y}
        width={attrs.width}
        height={attrs.height}
        cornerRadius={attrs.rx || attrs.ry || 0}
        fill={isSolid ? color : "none"}
        stroke={isSolid ? "none" : color}
        strokeWidth={ICON_STROKE_WIDTH}
      />
    );
  }
  if (tag === "line") {
    return (
      <Line
        key={key}
        points={[attrs.x1, attrs.y1, attrs.x2, attrs.y2]}
        stroke={color}
        strokeWidth={ICON_STROKE_WIDTH}
        lineCap="round"
      />
    );
  }
  if (tag === "polyline") {
    return (
      <Line
        key={key}
        points={attrs.points}
        stroke={color}
        strokeWidth={ICON_STROKE_WIDTH}
        lineCap="round"
        lineJoin="round"
        fill="none"
      />
    );
  }
  if (tag === "polygon") {
    return (
      <Line
        key={key}
        points={attrs.points}
        closed
        fill={isSolid ? color : "none"}
        stroke={isSolid ? "none" : color}
        strokeWidth={ICON_STROKE_WIDTH}
        lineJoin="round"
      />
    );
  }
  return null;
}

// Icons render as real vector Konva primitives (Path/Circle/Rect/Line)
// built from the static iconCatalog data, never as a rasterized image. The
// outer Group carries the shared selection/drag/transform envelope; the
// inner Group applies the 24x24-native-to-item-size scale so every
// primitive's coordinates stay in the icon's own natural space.
export default function IconNode({ item, commonProps }) {
  const icon = findIconByName(item.iconName);
  const width = item.width || 100;
  const height = item.height || 100;
  const color = item.fill || "#111827";
  const scaleX = width / ICON_NATIVE_SIZE;
  const scaleY = height / ICON_NATIVE_SIZE;

  return (
    <Group {...commonProps} width={width} height={height}>
      <Group scaleX={scaleX} scaleY={scaleY}>
        <Rect x={0} y={0} width={ICON_NATIVE_SIZE} height={ICON_NATIVE_SIZE} fill="transparent" />
        {icon?.node.map((tuple, index) => renderPrimitive(tuple, index, color))}
      </Group>
    </Group>
  );
}
