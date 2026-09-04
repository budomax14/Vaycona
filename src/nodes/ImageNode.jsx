import React, { useRef } from "react";
import { Group, Image as KonvaImage, Rect, Shape } from "react-konva";
import { useAsset } from "../useAsset";
import { useImageElement } from "../useImageElement";
import { useImageFilters } from "../useImageFilters";
import { computeCropRect } from "../imageCrop";
import { resolveMaskGeometry } from "../opacityMask";
import { buildRectPath } from "../shapeGeometry";
import { findIconByName, ICON_NATIVE_SIZE } from "../iconCatalog";
import { renderPrimitive } from "./IconNode";

const MISSING_ICON = findIconByName("ImageOff") || findIconByName("Image");

function boxSceneFunc(ctx, shapeNode) {
  ctx.beginPath();
  ctx.rect(0, 0, shapeNode.width(), shapeNode.height());
  ctx.closePath();
  ctx.fillStrokeShape(shapeNode);
}

// Registry renderer for type:"image" (promoted out of DesignNode.jsx's old
// special-case for architectural symmetry with every other type). Resolves
// item.assetId -> a live blob: URL via useAsset, feeds that into the
// existing, unmodified useImageElement (flip), computes the unified crop/
// fit layout (imageCrop.js), and applies the shared filter pipeline
// (useImageFilters) — the same three building blocks FrameNode's content
// rendering uses, so there is exactly one implementation of each concern.
//
// Always renders ONE stable outer <Group> (holding commonProps — the
// ref registerNode/Transformer/drag attach to) regardless of asset-load
// state, and only swaps the INNER content (loading placeholder / missing
// placeholder / cropped image). This matters because asset resolution is
// async: if the outer node's TYPE changed between loading and ready
// (e.g. a bare <Shape> becoming a <KonvaImage>), Konva would unmount and
// remount a new node after DesignNode's registerNode effect already ran
// once on initial mount, silently detaching the Transformer.
export default function ImageNode({ item, commonProps }) {
  const innerImageRef = useRef(null);
  const { status, objectUrl } = useAsset(item.assetId);
  const { image, naturalWidth, naturalHeight } = useImageElement(objectUrl, {
    flipX: item.flipX,
    flipY: item.flipY,
  });

  const width = item.width || 100;
  const height = item.height || 100;
  const clipFunc = item.cornerRadius > 0 ? (ctx) => buildRectPath(ctx, width, height, item.cornerRadius) : undefined;

  // Phase 12: a Ken Burns pan/zoom preset stashes an interpolated crop on
  // `__animatedCrop` for the current preview/playback/export frame only
  // (see animationService.js's computeCropDeltaForItem) — the durable
  // `item.crop` underneath is never touched, so playback stopping or
  // being canceled always reverts to exactly the stored crop.
  const cropRect = computeCropRect(item.__animatedCrop || item.crop, naturalWidth, naturalHeight);
  // The crop rect always maps onto the object's full box (0,0,width,height)
  // — no letterboxing mode any more — so Fade's normalized mask coordinates
  // (also defined over that same full box) need no offset/scale mapping.
  const maskGeometry = resolveMaskGeometry(width, height, { x: 0, y: 0, width, height });
  useImageFilters(innerImageRef, image, item.adjustments, item.opacityMask, maskGeometry);

  let content;
  if (status === "missing" || (status === "ready" && !image)) {
    const iconSize = Math.max(24, Math.min(width, height) * 0.25);
    const iconScale = MISSING_ICON ? iconSize / ICON_NATIVE_SIZE : 0;
    content = (
      <>
        <Shape sceneFunc={boxSceneFunc} width={width} height={height} fill="#fef2f2" stroke="#fca5a5" strokeWidth={2} dash={[8, 6]} listening={false} />
        {MISSING_ICON && (
          <Group x={width / 2 - iconSize / 2} y={height / 2 - iconSize / 2} scaleX={iconScale} scaleY={iconScale} listening={false}>
            {MISSING_ICON.node.map((tuple, index) => renderPrimitive(tuple, index, "#ef4444"))}
          </Group>
        )}
      </>
    );
  } else if (!image) {
    // Loading — inert placeholder box, same outer Group as the real content.
    content = <Shape sceneFunc={boxSceneFunc} width={width} height={height} fill="#f3f4f6" listening={false} />;
  } else {
    content = <KonvaImage ref={innerImageRef} image={image} x={0} y={0} width={width} height={height} crop={cropRect} listening={false} />;
  }

  return (
    <Group {...commonProps} clipFunc={clipFunc} clip={clipFunc ? undefined : { x: 0, y: 0, width, height }}>
      {/* Every piece of `content` above sets listening={false} (the crop/
          filter pipeline owns pointer-independent rendering) — Konva's
          Group has no hit region of its own, so without this the whole
          item is unclickable/undraggable by its rendered pixels (only
          reachable via the Layers panel). Fully transparent but still a
          real hit target, exactly like the always-listening <Text> node
          gives text items their click/drag area. */}
      <Rect width={width} height={height} fill="transparent" />
      {content}
    </Group>
  );
}
