import React, { useMemo, useRef } from "react";
import { Layer, Rect, Stage, Text } from "react-konva";
import DesignNode from "../../DesignNode";
import { isEffectivelyHidden } from "../../hierarchy";
import { borderDashProps } from "../../borderStyles";
import { useResizeObserver } from "../../useResizeObserver";

const noop = () => {};

// Read-only live preview of one page of a (personalized) design, drawn by
// the same DesignNode/registry renderer the editor and the export pipeline
// (export/offscreenRenderer.jsx) use — so what the customer sees is what
// they download. Scales to fit its container's width (and `maxHeight`).
// `highlightItemId` outlines the element the customer is editing;
// `watermark` lays a "Preview" mark over designs that aren't approved yet.
export default function DesignPreview({ design, pageId, highlightItemId, watermark, maxHeight = 640 }) {
  const containerRef = useRef(null);
  const { width: containerWidth } = useResizeObserver(containerRef);
  const page = design?.pages.find((p) => p.id === pageId) || design?.pages[0];

  const visibleItems = useMemo(() => {
    if (!design || !page) return [];
    const itemsById = new Map(design.items.map((it) => [it.id, it]));
    return design.items.filter((item) => item.pageId === page.id && item.type !== "group" && !isEffectivelyHidden(item, itemsById));
  }, [design, page]);

  const highlight = highlightItemId ? visibleItems.find((it) => it.id === highlightItemId) : null;
  const scale = page && containerWidth ? Math.min(containerWidth / page.width, maxHeight / page.height) : 0;

  return (
    <div ref={containerRef} className="flex w-full justify-center">
      {page && scale > 0 && (
        <div className="overflow-hidden rounded-lg shadow-md ring-1 ring-black/5" style={{ width: page.width * scale, height: page.height * scale }}>
          <Stage width={page.width * scale} height={page.height * scale} scaleX={scale} scaleY={scale} listening={false}>
            <Layer>
              <Rect x={0} y={0} width={page.width} height={page.height} fill={page.background || "#ffffff"} />
              {visibleItems.map((item) => (
                <DesignNode
                  key={item.id}
                  item={item}
                  isSpaceDown={false}
                  isEditingText={false}
                  isLocked
                  onSelect={noop}
                  onContextMenu={noop}
                  onDragStart={noop}
                  onDragMove={noop}
                  onDragEnd={noop}
                  onItemDblClick={noop}
                  dragBoundFunc={undefined}
                  registerNode={noop}
                />
              ))}
              {page.border?.enabled && (
                <Rect
                  x={0}
                  y={0}
                  width={page.width}
                  height={page.height}
                  stroke={page.border.color || "#111827"}
                  strokeWidth={page.border.width ?? 4}
                  {...borderDashProps(page.border.style, page.border.width)}
                />
              )}
              {highlight && (
                <Rect
                  x={highlight.x - 4 / scale}
                  y={highlight.y - 4 / scale}
                  width={(highlight.width || 0) + 8 / scale}
                  height={(highlight.height || 0) + 8 / scale}
                  rotation={highlight.rotation || 0}
                  stroke="#d97706"
                  strokeWidth={2 / scale}
                  dash={[6 / scale, 4 / scale]}
                  cornerRadius={4 / scale}
                />
              )}
              {watermark && <PreviewWatermark page={page} label={watermark} />}
            </Layer>
          </Stage>
        </div>
      )}
    </div>
  );
}

function PreviewWatermark({ page, label }) {
  const fontSize = Math.max(14, page.width / 14);
  const rows = [];
  for (let y = -page.height; y < page.height * 2; y += fontSize * 4) {
    for (let x = -page.width; x < page.width * 2; x += fontSize * 7) rows.push({ x, y });
  }
  return (
    <>
      {rows.map(({ x, y }) => (
        <Text key={`${x}:${y}`} x={x} y={y} text={label} fontSize={fontSize} fontStyle="600" fill="rgba(0,0,0,0.12)" rotation={-22} />
      ))}
    </>
  );
}
