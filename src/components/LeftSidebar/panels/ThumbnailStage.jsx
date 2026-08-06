import React, { useEffect, useRef } from "react";
import { Layer, Rect, Stage } from "react-konva";
import DesignNode from "../../../DesignNode";
import { isEffectivelyHidden } from "../../../hierarchy";
import { borderDashProps } from "../../../borderStyles";

const noop = () => {};

// A small offscreen Konva Stage that renders one page's real content via
// the same DesignNode/registry renderers used on the actual canvas — so
// hidden items, layer order, and effects are exactly right for free,
// with no second parallel rendering implementation. Mounted only while
// actively generating a thumbnail (see usePageThumbnails), never kept
// alive per-page.
export default function ThumbnailStage({ page, items, width, height, onCapture }) {
  const stageRef = useRef(null);
  const itemsById = new Map(items.map((it) => [it.id, it]));
  const scale = Math.min(width / page.width, height / page.height);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    // One frame so every item has actually painted before capture.
    const raf = requestAnimationFrame(() => {
      try {
        const dataUrl = stage.toDataURL({ pixelRatio: 1, mimeType: "image/png" });
        onCapture(dataUrl);
      } catch {
        onCapture(null);
      }
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Stage ref={stageRef} width={width} height={height} scaleX={scale} scaleY={scale} listening={false}>
      <Layer>
        <Rect x={0} y={0} width={page.width} height={page.height} fill={page.background || "#ffffff"} />
        {items
          .filter((item) => item.pageId === page.id && item.type !== "group" && !isEffectivelyHidden(item, itemsById))
          .map((item) => (
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
            listening={false}
          />
        )}
      </Layer>
    </Stage>
  );
}
