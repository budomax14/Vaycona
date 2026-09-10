import React, { useEffect, useRef, useState } from "react";
import { contentToScreen } from "../viewport";
import { useAsset } from "../useAsset";
import { useImageElement } from "../useImageElement";
import { boxToCrop, computeCropLayout, cropToBox, dragToFocalPoint, normalizeFocalCrop } from "../imageCrop";
import { FRAME_KINDS } from "../frameKinds";

// How long the rule-of-thirds grid lingers after a drag/resize/zoom
// gesture ends before fading out — mirrors the iOS/macOS Photos crop tool,
// where the grid appears only while actively adjusting the crop.
const GRID_FADE_DELAY_MS = 500;
// Corner/edge handle bracket geometry (Apple Photos-style L-brackets
// instead of plain square dots).
const HANDLE_ARM = 18;
const HANDLE_THICKNESS = 3;
const HANDLE_HIT_SIZE = 28;
const MIN_BOX_SIZE = 20;

// The 8 crop-rectangle handles (corners + edge midpoints). Each declares
// which edge(s) it moves when dragged — corners move two edges, edge-
// midpoints move one — resolved against the box's LOCAL (unrotated) frame,
// then rotated back into world x/y so this behaves correctly on a rotated
// image too.
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

// Renders one handle's visible mark: an L-shaped bracket for corners, a
// short straight bar for edge midpoints — the recognizable Apple Photos
// crop-handle silhouette, as opposed to a plain dot/square.
function HandleMark({ handleDef }) {
  const { key } = handleDef;
  if (key.length !== 2) {
    // Edge midpoint — single bar, oriented along the edge it sits on.
    const horizontal = key === "t" || key === "b";
    return (
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: horizontal ? HANDLE_ARM : HANDLE_THICKNESS,
          height: horizontal ? HANDLE_THICKNESS : HANDLE_ARM,
          transform: "translate(-50%, -50%)",
          background: "#ffffff",
          borderRadius: 1.5,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
        }}
      />
    );
  }
  // Corner — two bars forming an L, both pointing inward into the box.
  const extendsRight = key.includes("l");
  const extendsDown = key[0] === "t";
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: HANDLE_ARM,
          height: HANDLE_THICKNESS,
          transform: `translate(${extendsRight ? "0%" : "-100%"}, -50%)`,
          background: "#ffffff",
          borderRadius: 2,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: HANDLE_THICKNESS,
          height: HANDLE_ARM,
          transform: `translate(-50%, ${extendsDown ? "0%" : "-100%"})`,
          background: "#ffffff",
          borderRadius: 1.5,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
        }}
      />
    </>
  );
}

// Outside-click (anywhere but the overlay itself or anything marked
// toolbar-safe, e.g. CropModePropertiesBar's Apply/Cancel controls) exits
// crop mode — same capture-phase pattern TextEditOverlay uses.
function useOutsideClickExit(onRequestExit) {
  useEffect(() => {
    function handlePointerDown(event) {
      const target = event.target;
      if (target.closest?.("[data-crop-toolbar-safe]")) return;
      onRequestExit?.();
    }
    window.addEventListener("mousedown", handlePointerDown, true);
    return () => window.removeEventListener("mousedown", handlePointerDown, true);
  }, [onRequestExit]);
}

// Grid fade state, shared by both overlay variants: visible only while a
// gesture is in progress, fading out shortly after it ends (Apple Photos'
// crop-tool behavior).
function useGridFade() {
  const [gridVisible, setGridVisible] = useState(false);
  const gridHideTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(gridHideTimerRef.current), []);
  function beginGridInteraction() {
    clearTimeout(gridHideTimerRef.current);
    gridHideTimerRef.current = null;
    setGridVisible(true);
  }
  function endGridInteraction() {
    clearTimeout(gridHideTimerRef.current);
    gridHideTimerRef.current = setTimeout(() => setGridVisible(false), GRID_FADE_DELAY_MS);
  }
  return { gridVisible, beginGridInteraction, endGridInteraction };
}

function GridLines({ visible }) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: visible ? 1 : 0, transition: "opacity 0.25s ease" }}>
      {[1 / 3, 2 / 3].map((f) => (
        <div key={`v-${f}`} style={{ position: "absolute", left: `${f * 100}%`, top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.85)" }} />
      ))}
      {[1 / 3, 2 / 3].map((f) => (
        <div key={`h-${f}`} style={{ position: "absolute", top: `${f * 100}%`, left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.85)" }} />
      ))}
    </div>
  );
}

// ===========================================================================
// Frame content — unchanged pan-to-reposition/zoom interaction. A frame's
// content window has a fixed (often non-rectangular) shape with no
// independent edges to drag, so it keeps the original focal-crop model
// rather than the Apple-style rect crop below (see imageCrop.js's file
// header for why).
// ===========================================================================
function FrameCropOverlay({ item, viewport, scale, onLiveChange, onRequestExit }) {
  useOutsideClickExit(onRequestExit);
  const { gridVisible, beginGridInteraction, endGridInteraction } = useGridFade();
  const { objectUrl } = useAsset(item.contentAssetId);
  const { naturalWidth, naturalHeight } = useImageElement(objectUrl);
  const flipTransform = `scaleX(${item.flipX ? -1 : 1}) scaleY(${item.flipY ? -1 : 1})`;
  const dragRef = useRef(null);
  const activePointersRef = useRef(new Map());
  const pinchGestureRef = useRef(null);

  const kindDef = FRAME_KINDS[item.frameKind] || FRAME_KINDS.rectangle;
  const inset = kindDef?.contentInset || { top: 0, right: 0, bottom: 0, left: 0 };
  const boxWidth = Math.max(1, (item.width || 100) * (1 - inset.left - inset.right));
  const boxHeight = Math.max(1, (item.height || 100) * (1 - inset.top - inset.bottom));
  const boxContentX = item.x + (item.width || 100) * inset.left;
  const boxContentY = item.y + (item.height || 100) * inset.top;

  if (!naturalWidth || !naturalHeight) return null;

  const crop = normalizeFocalCrop(item.crop);
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
    beginGridInteraction();

    if (activePointersRef.current.size >= 2) {
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
    if (layout.mode === "stretch") return;
    const dxScreen = event.clientX - dragRef.current.startX;
    const dyScreen = event.clientY - dragRef.current.startY;
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
    endGridInteraction();
  }

  function handleWheel(event) {
    event.preventDefault();
    if (layout.mode === "stretch") return;
    beginGridInteraction();
    endGridInteraction();
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
        touchAction: "none",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    >
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
            maxWidth: "none",
            maxHeight: "none",
            transform: flipTransform,
            opacity: 0.25,
          }}
        />
      </div>

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
            maxWidth: "none",
            maxHeight: "none",
            transform: flipTransform,
          }}
        />
      </div>

      <GridLines visible={gridVisible} />

      <div style={{ position: "absolute", inset: 0, border: "1px solid #ffffff", boxShadow: "0 0 0 1px rgba(0,0,0,0.4)", pointerEvents: "none" }} />
    </div>
  );
}

// ===========================================================================
// Standalone image — Apple Photos-style rect crop. The full source image is
// held visually stationary for the whole crop-mode session (its on-screen
// position/size, `imageDisplayRect`, is fixed by App.jsx's enterCropMode
// and never recomputed here); only the crop-selection rectangle — which IS
// the object's own box in this model — moves as any of its 8 handles are
// dragged, independently per edge/corner. See imageCrop.js's cropToBox/
// boxToCrop for the mapping between the two.
// ===========================================================================
function ImageCropOverlay({ item, viewport, scale, imageDisplayRect, onLiveChange, onBoxLiveChange, onRequestExit }) {
  useOutsideClickExit(onRequestExit);
  const { gridVisible, beginGridInteraction, endGridInteraction } = useGridFade();
  const { objectUrl } = useAsset(item.assetId);
  const { naturalWidth, naturalHeight } = useImageElement(objectUrl, { flipX: item.flipX, flipY: item.flipY });
  const flipTransform = `scaleX(${item.flipX ? -1 : 1}) scaleY(${item.flipY ? -1 : 1})`;
  const resizeDragRef = useRef(null);

  if (!naturalWidth || !naturalHeight || !imageDisplayRect) return null;

  const box = { x: item.x, y: item.y, width: item.width || 100, height: item.height || 100 };
  const topLeft = contentToScreen({ x: box.x, y: box.y }, viewport);
  const boxScreenWidth = box.width * viewport.scale;
  const boxScreenHeight = box.height * viewport.scale;
  // The stationary full image's position/size, expressed as a LOCAL offset
  // within this wrapper (which itself sits at the box's current top-left
  // and rotates with it) — see the file-header note above about rotation:
  // exact for the (overwhelmingly common) unrotated case, a close
  // approximation otherwise, since a perfectly rotation-invariant "the
  // image never moves" guarantee would need a fixed pivot independent of
  // the live-resizing selection box.
  const imgLocalLeft = (imageDisplayRect.x - box.x) * viewport.scale;
  const imgLocalTop = (imageDisplayRect.y - box.y) * viewport.scale;
  const imgScreenWidth = imageDisplayRect.width * viewport.scale;
  const imgScreenHeight = imageDisplayRect.height * viewport.scale;

  // Drag a corner/edge handle to resize the crop rectangle itself (the
  // object's own box). Delta is rotated into the box's LOCAL (unrotated)
  // frame before being applied, then the resulting local origin shift is
  // rotated back to world x/y — same convention objectRegistry.js's own
  // rotation-aware point math uses — so this resizes correctly even when
  // the object itself is rotated. The resulting box is then translated to
  // a normalized crop fraction and back (boxToCrop/cropToBox) so it never
  // drifts past the source image's own edges.
  function handleResizePointerDown(handleDef, event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    beginGridInteraction();
    resizeDragRef.current = {
      pointerId: event.pointerId,
      handleDef,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startBox: box,
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

    const nextBox = {
      x: drag.startBox.x + originDeltaLocalX * cos - originDeltaLocalY * sin,
      y: drag.startBox.y + originDeltaLocalX * sin + originDeltaLocalY * cos,
      width,
      height,
    };
    // Clamp against the source image's own edges (can't crop past what's
    // actually there), then rebuild the box from the clamped crop so the
    // two never disagree.
    const nextCrop = boxToCrop(nextBox, imageDisplayRect);
    const finalBox = cropToBox(nextCrop, imageDisplayRect);
    onLiveChange(nextCrop);
    onBoxLiveChange(finalBox);
  }

  function handleResizePointerUp(event) {
    if (resizeDragRef.current?.pointerId === event.pointerId) resizeDragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    endGridInteraction();
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
        touchAction: "none",
      }}
    >
      {/* Dimmed, unclipped full source image — held stationary for the
          whole session (see imgLocalLeft/Top above) — shows what's outside
          the current crop selection. */}
      <div style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
        <img
          src={objectUrl}
          alt=""
          draggable={false}
          style={{ position: "absolute", left: imgLocalLeft, top: imgLocalTop, width: imgScreenWidth, height: imgScreenHeight, maxWidth: "none", maxHeight: "none", transform: flipTransform, opacity: 0.25 }}
        />
      </div>

      {/* Full-opacity, clipped-to-box active crop selection */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <img
          src={objectUrl}
          alt=""
          draggable={false}
          style={{ position: "absolute", left: imgLocalLeft, top: imgLocalTop, width: imgScreenWidth, height: imgScreenHeight, maxWidth: "none", maxHeight: "none", transform: flipTransform }}
        />
      </div>

      <GridLines visible={gridVisible} />

      <div style={{ position: "absolute", inset: 0, border: "1px solid #ffffff", boxShadow: "0 0 0 1px rgba(0,0,0,0.4)", pointerEvents: "none" }} />

      {RESIZE_HANDLES.map((handleDef) => (
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
            width: HANDLE_HIT_SIZE,
            height: HANDLE_HIT_SIZE,
            cursor: handleDef.cursor,
            touchAction: "none",
          }}
        >
          <HandleMark handleDef={handleDef} />
        </div>
      ))}
    </div>
  );
}

// Interactive crop-mode DOM overlay — used for both standalone images and
// frame content, dispatching to the two very different tools above (see
// imageCrop.js's file header). Positioned via the same contentToScreen/
// viewport math TextEditOverlay.jsx already uses (mounted as a sibling
// inside the same pan/zoom-transformed wrapper, see App.jsx), so a later-
// rendered, occluding DOM layer naturally intercepts pointer events before
// the Konva Stage beneath it — the same trick that already proves out for
// text editing, reused here rather than inventing a new interaction model.
export default function CropOverlay(props) {
  return props.item.type === "frame" ? <FrameCropOverlay {...props} /> : <ImageCropOverlay {...props} />;
}
