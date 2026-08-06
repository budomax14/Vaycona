import React, { useRef } from "react";
import { Group, Image as KonvaImage, Rect, Shape } from "react-konva";
import { FRAME_KINDS } from "../frameKinds";
import { findIconByName, ICON_NATIVE_SIZE } from "../iconCatalog";
import { renderPrimitive } from "./IconNode";
import { useAsset } from "../useAsset";
import { useImageElement } from "../useImageElement";
import { useImageFilters } from "../useImageFilters";
import { computeCropLayout } from "../imageCrop";

const PLACEHOLDER_ICON = findIconByName("Image");
const MISSING_ICON = findIconByName("ImageOff") || findIconByName("Image");

// Frame owns its content directly (contentAssetId + crop live on the frame
// item itself, see objectRegistry.js/imageCrop.js) rather than a separate
// child image item — content is never a registered, interactive Konva
// node of its own (no registerNode call for it), so it can never be
// independently selected/dragged/resized outside the frame's own
// Transformer, exactly like the placeholder icon glyph it replaces.
export default function FrameNode({ item, commonProps }) {
  const kindDef = FRAME_KINDS[item.frameKind] || FRAME_KINDS.rectangle;
  const width = item.width || 100;
  const height = item.height || 100;
  const innerImageRef = useRef(null);
  const { status, objectUrl } = useAsset(item.contentAssetId);
  const { image, naturalWidth, naturalHeight } = useImageElement(objectUrl, {
    flipX: item.flipX,
    flipY: item.flipY,
  });
  useImageFilters(innerImageRef, image, item.adjustments);

  const clipFunc = (ctx) => kindDef.clipPath(ctx, width, height, item);

  let content;
  if (!item.contentAssetId) {
    const iconSize = Math.max(24, Math.min(width, height) * 0.25);
    const iconScale = PLACEHOLDER_ICON ? iconSize / ICON_NATIVE_SIZE : 0;
    content = (
      <>
        <Shape
          sceneFunc={(context, shapeNode) => kindDef.sceneFunc(context, shapeNode, item)}
          fill="#f3f4f6"
          stroke="#9ca3af"
          strokeWidth={2}
          dash={[8, 6]}
        />
        {PLACEHOLDER_ICON && (
          <Group x={width / 2 - iconSize / 2} y={height / 2 - iconSize / 2} scaleX={iconScale} scaleY={iconScale} listening={false}>
            {PLACEHOLDER_ICON.node.map((tuple, index) => renderPrimitive(tuple, index, "#9ca3af"))}
          </Group>
        )}
      </>
    );
  } else if (status === "missing" || (status === "ready" && !image)) {
    const iconSize = Math.max(24, Math.min(width, height) * 0.25);
    const iconScale = MISSING_ICON ? iconSize / ICON_NATIVE_SIZE : 0;
    content = (
      <>
        <Shape sceneFunc={(context, shapeNode) => kindDef.sceneFunc(context, shapeNode, item)} fill="#fef2f2" stroke="#fca5a5" strokeWidth={2} dash={[8, 6]} />
        {MISSING_ICON && (
          <Group x={width / 2 - iconSize / 2} y={height / 2 - iconSize / 2} scaleX={iconScale} scaleY={iconScale} listening={false}>
            {MISSING_ICON.node.map((tuple, index) => renderPrimitive(tuple, index, "#ef4444"))}
          </Group>
        )}
      </>
    );
  } else if (!image) {
    // Loading — keep the frame's own outline visible with a neutral fill
    // while the asset resolves, same stable Group so no node-type swap.
    content = <Shape sceneFunc={(context, shapeNode) => kindDef.sceneFunc(context, shapeNode, item)} fill="#f9fafb" />;
  } else {
    // contentInset (polaroid) shrinks the area the IMAGE itself occupies
    // while the frame's own clip stays the full outline — the margin left
    // over shows the background fill below, giving the classic
    // photo-with-a-caption-strip look with no extra geometry needed.
    const inset = kindDef.contentInset || { top: 0, right: 0, bottom: 0, left: 0 };
    const contentX = width * inset.left;
    const contentY = height * inset.top;
    const contentWidth = Math.max(1, width * (1 - inset.left - inset.right));
    const contentHeight = Math.max(1, height * (1 - inset.top - inset.bottom));
    // Phase 12: see ImageNode.jsx's identical comment — animated pan/zoom
    // never touches the durable item.crop.
    const layout = computeCropLayout(item.__animatedCrop || item.crop, naturalWidth, naturalHeight, contentWidth, contentHeight);
    content = (
      <>
        <Rect width={width} height={height} fill="#ffffff" />
        {layout.mode === "contain" ? (
          <KonvaImage
            ref={innerImageRef}
            image={image}
            x={contentX + layout.offsetX}
            y={contentY + layout.offsetY}
            width={layout.drawWidth}
            height={layout.drawHeight}
          />
        ) : layout.mode === "stretch" ? (
          <KonvaImage ref={innerImageRef} image={image} x={contentX} y={contentY} width={contentWidth} height={contentHeight} />
        ) : (
          <KonvaImage ref={innerImageRef} image={image} x={contentX} y={contentY} width={contentWidth} height={contentHeight} crop={layout.cropRect} />
        )}
      </>
    );
  }

  return (
    <Group {...commonProps} width={width} height={height} clipFunc={clipFunc}>
      {content}
    </Group>
  );
}
