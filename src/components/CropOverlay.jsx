import React, { useEffect, useRef } from "react";
import { contentToScreen } from "../viewport";
import { useAsset } from "../useAsset";
import { useImageElement } from "../useImageElement";
import { computeCropLayout, dragToFocalPoint, normalizeCrop } from "../imageCrop";
import { FRAME_KINDS } from "../frameKinds";

// Interactive crop-mode DOM overlay — used for both standalone images and
// frame content. Positioned via the same contentToScreen/viewport math
// TextEditOverlay.jsx already uses (mounted as a sibling inside the same
// pan/zoom-transformed wrapper, see App.jsx), so a later-rendered,
// occluding DOM layer naturally intercepts pointer events before the
// Konva Stage beneath it — the same trick that already proves out for
// text editing, reused here rather than inventing a new interaction model.
// Live drag/zoom calls onLiveChange (non-committing, mirrors
// updateEditingTextLive); the caller commits exactly once on Apply.
export default function CropOverlay({ item, viewport, scale, onLiveChange, onRequestExit }) {
  const isFrame = item.type === "frame";
  const assetId = isFrame ? item.contentAssetId : item.assetId;
  const { objectUrl } = useAsset(assetId);
  // No flip option here — useImageElement's flip is a canvas-based trick
  // meant for Konva rendering (see its own file comment); for this plain
  // DOM overlay, flip is applied directly as a CSS transform on the <img>
  // tags below instead, so this call always resolves naturalWidth/Height
  // via the original decoded image with no extra canvas indirection.
  const { naturalWidth, naturalHeight } = useImageElement(objectUrl);
  const flipTransform = `scaleX(${item.flipX ? -1 : 1}) scaleY(${item.flipY ? -1 : 1})`;
  const dragRef = useRef(null);

  // Clicking outside the overlay (and outside anything marked
  // toolbar-safe, e.g. CropModePropertiesBar's Apply/Cancel/zoom controls)
  // exits crop mode — same capture-phase pattern TextEditOverlay uses for
  // its own outside-click exit.
  useEffect(() => {
    function handlePointerDown(event) {
      const target = event.target;
      if (target.closest?.("[data-crop-toolbar-safe]")) return;
      onRequestExit?.();
    }
    window.addEventListener("mousedown", handlePointerDown, true);
    return () => window.removeEventListener("mousedown", handlePointerDown, true);
  }, [onRequestExit]);

  const kindDef = isFrame ? FRAME_KINDS[item.frameKind] || FRAME_KINDS.rectangle : null;
  const inset = kindDef?.contentInset || { top: 0, right: 0, bottom: 0, left: 0 };
  const boxWidth = Math.max(1, (item.width || 100) * (1 - inset.left - inset.right));
  const boxHeight = Math.max(1, (item.height || 100) * (1 - inset.top - inset.bottom));
  const boxContentX = item.x + (item.width || 100) * inset.left;
  const boxContentY = item.y + (item.height || 100) * inset.top;

  if (!naturalWidth || !naturalHeight) return null;

  const crop = normalizeCrop(item.crop);
  const layout = computeCropLayout(crop, naturalWidth, naturalHeight, boxWidth, boxHeight);

  let dimLeft;
  let dimTop;
  let dimWidth;
  let dimHeight;
  if (layout.mode === "contain") {
    dimLeft = layout.offsetX;
    dimTop = layout.offsetY;
    dimWidth = layout.drawWidth;
    dimHeight = layout.drawHeight;
  } else if (layout.mode === "stretch") {
    // No cropRect to derive from — the whole image is always drawn at
    // exactly the box's size (see computeCropLayout's "stretch" branch).
    dimLeft = 0;
    dimTop = 0;
    dimWidth = boxWidth;
    dimHeight = boxHeight;
  } else {
    const scaleX = boxWidth / layout.cropRect.width;
    const scaleY = boxHeight / layout.cropRect.height;
    dimLeft = -layout.cropRect.x * scaleX;
    dimTop = -layout.cropRect.y * scaleY;
    dimWidth = naturalWidth * scaleX;
    dimHeight = naturalHeight * scaleY;
  }

  const topLeft = contentToScreen({ x: boxContentX, y: boxContentY }, viewport);
  const boxScreenWidth = boxWidth * viewport.scale;
  const boxScreenHeight = boxHeight * viewport.scale;

  function handlePointerDown(event) {
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startY: event.clientY, crop };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!dragRef.current) return;
    // Stretch mode has no excess to pan around in (the whole image is
    // always fully visible by construction — see computeCropLayout), and
    // dragToFocalPoint doesn't handle a layout with no cropRect.
    if (layout.mode === "stretch") return;
    const dxScreen = event.clientX - dragRef.current.startX;
    const dyScreen = event.clientY - dragRef.current.startY;
    // event.clientX/Y deltas are real browser pixels, i.e. post the
    // canvasFrameRef CSS `scale(displayScale)` transform — so they must be
    // divided by the live zoom (`scale`), not `viewport.scale`
    // (KONVA_VIEWPORT is fixed at RENDER_SCALE_CAP and only valid for the
    // pre-transform contentToScreen position math below, which the parent's
    // CSS transform then re-scales to match the live zoom).
    const dxContent = dxScreen / scale;
    const dyContent = dyScreen / scale;
    const nextCrop = dragToFocalPoint(dragRef.current.crop, layout, naturalWidth, naturalHeight, boxWidth, boxHeight, dxContent, dyContent);
    onLiveChange(nextCrop);
  }

  function handlePointerUp(event) {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function handleWheel(event) {
    event.preventDefault();
    if (layout.mode === "stretch") return;
    const delta = event.deltaY > 0 ? -0.05 : 0.05;
    const nextZoom = Math.max(1, Math.min(8, crop.zoom + delta));
    onLiveChange({ ...crop, zoom: nextZoom });
  }

  return (
    <div
      data-crop-toolbar-safe
      style={{
        position: "absolute",
        left: topLeft.x,
        top: topLeft.y,
        width: boxScreenWidth,
        height: boxScreenHeight,
        transform: `rotate(${item.rotation || 0}deg)`,
        transformOrigin: "0 0",
        zIndex: 25,
        cursor: "move",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    >
      {/* Dimmed, unclipped full source image — shows what's outside the crop */}
      <div style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
        <img
          src={objectUrl}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: dimLeft * viewport.scale,
            top: dimTop * viewport.scale,
            width: dimWidth * viewport.scale,
            height: dimHeight * viewport.scale,
            transform: flipTransform,
            opacity: 0.35,
          }}
        />
      </div>

      {/* Full-opacity, clipped-to-box active crop window */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <img
          src={objectUrl}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: dimLeft * viewport.scale,
            top: dimTop * viewport.scale,
            width: dimWidth * viewport.scale,
            height: dimHeight * viewport.scale,
            transform: flipTransform,
          }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          border: "2px solid #ffffff",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
