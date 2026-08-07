import React from "react";
import { Group, Image as KonvaImage, Rect } from "react-konva";
import { useChartImage } from "../useChartImage";

// Registry renderer for type:"chart". Structurally mirrors ImageNode.jsx:
// one stable outer <Group> (holding commonProps — the ref
// registerNode/Transformer/drag attach to) that never changes node type
// across render states, with only the INNER content swapping between a
// loading placeholder and the rasterized chart image. useChartImage
// already renders its own "No chart data" placeholder into the image
// itself when data/series are empty, so ChartNode has no separate empty
// state to handle beyond "image not ready yet".
export default function ChartNode({ item, commonProps }) {
  const width = item.width || 400;
  const height = item.height || 300;
  const image = useChartImage(item, width, height);

  return (
    <Group {...commonProps}>
      {/* Same reasoning as ImageNode.jsx: content below sets
          listening={false}, so this transparent Rect is what actually
          makes the item clickable/draggable by its rendered pixels. */}
      <Rect width={width} height={height} fill="transparent" />
      {image ? (
        <KonvaImage image={image} x={0} y={0} width={width} height={height} listening={false} />
      ) : (
        <Rect width={width} height={height} fill="#f3f4f6" listening={false} />
      )}
    </Group>
  );
}
