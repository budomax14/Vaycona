import React, { useEffect, useRef } from "react";
import { contentToScreen } from "../viewport";
import { useAsset } from "../useAsset";
import { useImageElement } from "../useImageElement";
import { computeCropLayout, dragToFocalPoint, normalizeCrop } from "../imageCrop";
import { FRAME_KINDS } from "../frameKinds";

const MIN_BOX_SIZE = 20;

// The 8 crop-rectangle handles (corners + edge midpoints). Each declares
// which edge(s) of the object's own box it moves when dragged — corners
// move two edges, edge-midpoints move one — resolved against the box's
// LOCAL (unrotated) frame in handleResizePointerMove below, then rotated
// back into world x/y so this behaves correctly on a rotated image too.
const RESIZE_HANDLES = [
  { key: "tl", left: 0, top: 0, cursor: "nwse-resize", moveLeft: true, moveTop: true },
  { key: "t", left: 0.5, top: 0, cursor: "ns-resize", moveTop: true },
  { key: "tr", left: 1, top: 0, cursor: "nesw-resize", moveRight: true, moveTop: true },
  { key: "r", left: 1, top: 0.5, cursor: "ew-resize", moveRight: true },
  { key: "br", left: 1, top: 1, cursor: "nwse-resize", moveRight: true, moveBottom: true },
  { key: "b", left: 0.5, top: 1, cursor: "ns-resize", moveBottom: true },
  { key: "bl", left: 0, top: 1, cursor: "nesw-resize", moveLeft: true, moveBottom: true },
  { key: "l", left: 0, top: 0.5, cursor: "ew-resize", moveLeft: true },
];

function distance(pointA, pointB) {
  return Math.hypot(pointA.clientX - pointB.clientX, pointA.clientY - pointB.clientY);
}

// Interactive crop-mode DOM overlay — used for both standalone images and
// frame content. Positioned via the same contentToScreen/viewport math
// TextEditOverlay.jsx already uses (mounted as a sibling inside the same
// pan/zoom-transformed wrapper, see App.jsx), so a later-rendered,
// occluding DOM layer naturally intercepts pointer events before the
// Konva Stage beneath it — the same trick that already proves out for
// text editing, reused here rather than inventing a new interaction model.
// Live drag/zoom calls onLiveChange (non-committing, mirrors
// updateEditingTextLive); the caller commits exactly once on Apply.
export default function CropOverlay({ item, viewport, scale, onLiveChange, onRequestExit, onBoxLiveChange }) {
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
  const resizeDragRef = useRef(null);
  // Every active pointer's last-known position (keyed by pointerId), so a
  // second simultaneous touch can be recognized as a pinch rather than a
  // second independent pan. Plain ref — read/written only inside these
  // handlers, no re-render needed, same as dragRef.
  const activePointersRef = useRef(new Map());
  const pinchGestureRef = useRef(null);
  // Only plain image items support resizing the crop box directly here —
  // frame content sits inside a shape whose own size/inset semantics are
  // owned by the Transformer outside crop mode, so resize handles are
  // scoped to `image` to avoid duplicating/fighting that logic.
  const canResizeBox = !isFrame && typeof onBoxLiveChange === "function";

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
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });

    if (activePointersRef.current.size >= 2) {
      // Entering (or continuing) a pinch — drop any single-pointer pan in
      // progress, matching how native photo apps prioritize the two-finger
      // gesture the instant a second finger lands.
      dragRef.current = null;
      const [a, b] = Array.from(activePointersRef.current.values());
      pinchGestureRef.current = { startDistance: Math.max(1, distance(a, b)), startZoom: crop.zoom };
      return;
    }
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, crop };
  }

  function handlePointerMove(event) {
    if (activePointersRef.current.has(event.pointerId)) {
      activePointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    }

    if (activePointersRef.current.size >= 2 && pinchGestureRef.current) {
      if (layout.mode === "stretch") return;
      const [a, b] = Array.from(activePointersRef.current.values());
      const ratio = Math.max(1, distance(a, b)) / pinchGestureRef.current.startDistance;
      const nextZoom = Math.max(1, Math.min(8, pinchGestureRef.current.startZoom * ratio));
      onLiveChange({ ...crop, zoom: nextZoom });
      return;
    }

    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
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
    activePointersRef.current.delete(event.pointerId);
    if (activePointersRef.current.size < 2) pinchGestureRef.current = null;
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function handleWheel(event) {
    event.preventDefault();
    if (layout.mode === "stretch") return;
    const delta = event.deltaY > 0 ? -0.05 : 0.05;
    const nextZoom = Math.max(1, Math.min(8, crop.zoom + delta));
    onLiveChange({ ...crop, zoom: nextZoom });
  }

  // Drag a corner/edge handle to resize the crop rectangle itself (the
  // object's own box — see the file header: fit/focal/zoom need no
  // adjustment since they're computed live off whatever the box's current
  // size is). Delta is rotated into the box's LOCAL (unrotated) frame
  // before being applied, then the resulting local origin shift is rotated
  // back to world x/y — same convention objectRegistry.js's own
  // rotation-aware point math uses — so this resizes correctly even when
  // the object itself is rotated.
  function handleResizePointerDown(handleDef, event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeDragRef.current = {
      pointerId: event.pointerId,
      handleDef,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startBox: { x: item.x, y: item.y, width: item.width, height: item.height },
    };
  }

  function handleResizePointerMove(event) {
    const drag = resizeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dxWorld = (event.clientX - drag.startClientX) / scale;
    const dyWorld = (event.clientY - drag.startClientY) / scale;
    const rad = ((item.rotation || 0) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dxLocal = dxWorld * cos + dyWorld * sin;
    const dyLocal = -dxWorld * sin + dyWorld * cos;

    const { moveLeft, moveRight, moveTop, moveBottom } = drag.handleDef;
    let width = drag.startBox.width;
    let height = drag.startBox.height;
    let originDeltaLocalX = 0;
    let originDeltaLocalY = 0;

    if (moveLeft) {
      const clamped = Math.min(dxLocal, drag.startBox.width - MIN_BOX_SIZE);
      width = drag.startBox.width - clamped;
      originDeltaLocalX = clamped;
    } else if (moveRight) {
      width = Math.max(MIN_BOX_SIZE, drag.startBox.width + dxLocal);
    }
    if (moveTop) {
      const clamped = Math.min(dyLocal, drag.startBox.height - MIN_BOX_SIZE);
      height = drag.startBox.height - clamped;
      originDeltaLocalY = clamped;
    } else if (moveBottom) {
      height = Math.max(MIN_BOX_SIZE, drag.startBox.height + dyLocal);
    }

    onBoxLiveChange({
      x: drag.startBox.x + originDeltaLocalX * cos - originDeltaLocalY * sin,
      y: drag.startBox.y + originDeltaLocalX * sin + originDeltaLocalY * cos,
      width,
      height,
    });
  }

  function handleResizePointerUp(event) {
    if (resizeDragRef.current?.pointerId === event.pointerId) resizeDragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
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
        touchAction: "none",
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

      {canResizeBox &&
        RESIZE_HANDLES.map((handleDef) => (
          <div
            key={handleDef.key}
            data-crop-toolbar-safe
            onPointerDown={(event) => handleResizePointerDown(handleDef, event)}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            style={{
              position: "absolute",
              left: handleDef.left * boxScreenWidth,
              top: handleDef.top * boxScreenHeight,
              transform: "translate(-50%, -50%)",
              width: 12,
              height: 12,
              borderRadius: 3,
              background: "#ffffff",
              border: "1.5px solid #d97706",
              boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
              cursor: handleDef.cursor,
              touchAction: "none",
            }}
          />
        ))}
    </div>
  );
}
