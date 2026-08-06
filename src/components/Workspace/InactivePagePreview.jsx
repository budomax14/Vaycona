import React from "react";
import { Layer, Rect, Stage } from "react-konva";
import DesignNode from "../../DesignNode";
import { isEffectivelyHidden } from "../../hierarchy";
import { borderDashProps } from "../../borderStyles";

const noop = () => {};

// Static, non-interactive render of a page that isn't the active one — used
// so switching pages in Workspace doesn't collapse every other page slot to
// a blank rectangle (only the active page mounts a full editable Stage via
// renderActivePage). Mirrors LeftSidebar/panels/ThumbnailStage's approach of
// reusing DesignNode directly, minus the toDataURL capture step.
export default function InactivePagePreview({ page, items, width, height }) {
  const itemsById = new Map(items.map((it) => [it.id, it]));
  const scale = width / page.width;

  return (
    <Stage width={width} height={height} scaleX={scale} scaleY={scale} listening={false}>
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
