import React, { useMemo } from "react";
import { Layer, Rect, Stage } from "react-konva";
import DesignNode from "../../DesignNode";
import { isEffectivelyHidden } from "../../hierarchy";
import { computeAnimatedItems } from "../../animation/animationService";

const noop = () => {};

// Phase 12 — reuses the exact same DesignNode/registry renderer as the
// live editor and the export pipeline (spec rule 2). No Transformer, no
// drag/select handlers, no rulers/guides — this is a pure "play this
// page's current animated frame" view, the same posture offscreenRenderer.
// jsx's ExportPageStage takes for static export.
export default function PresentationPageStage({ page, items, timeMs, reducedMotion, viewportWidth, viewportHeight }) {
  const fitScale = Math.min(viewportWidth / page.width, viewportHeight / page.height);
  const displayItems = useMemo(
    () => computeAnimatedItems(items, page.id, timeMs, { reducedMotion }),
    [items, page.id, timeMs, reducedMotion]
  );
  const itemsById = useMemo(() => new Map(displayItems.map((it) => [it.id, it])), [displayItems]);
  const visible = displayItems.filter((it) => it.pageId === page.id && it.type !== "group" && !isEffectivelyHidden(it, itemsById));

  return (
    <div style={{ width: page.width * fitScale, height: page.height * fitScale }}>
      <Stage width={page.width * fitScale} height={page.height * fitScale} scaleX={fitScale} scaleY={fitScale} listening={false}>
        <Layer>
          <Rect x={0} y={0} width={page.width} height={page.height} fill={page.background || "#ffffff"} />
          {visible.map((item) => (
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
        </Layer>
      </Stage>
    </div>
  );
}
