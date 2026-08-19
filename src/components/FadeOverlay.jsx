import React, { useEffect, useRef } from "react";
import { contentToScreen } from "../viewport";
import { normalizeOpacityMask } from "../opacityMask";

const HANDLE_SIZE = 14;

// Interactive Fade-mode DOM overlay — modeled directly on CropOverlay.jsx's
// DOM-overlay-over-Konva trick (mounted as a sibling inside the same pan/
// zoom-transformed wrapper, so it naturally intercepts pointer events ahead
// of the Stage beneath it). Only ever mounted while App.jsx's fadeEditItemId
// is set (see its own "Fade mode" section, parallel in shape to crop mode),
// so these handles never exist in the export render tree (offscreenRenderer.jsx
// never mounts this component) and can never leak into a PNG/PDF export.
//
// Linear shows 2 handles (start/end, normalized 0..1 over the item's own
// box); Radial shows a center handle + one radius handle on the circle's
// edge. Drag calls onLiveChange (non-committing, same pattern crop/image-
// fill overlays use); pointer-up leaves the final value in place for the
// caller's own commit-on-exit.
export default function FadeOverlay({ item, viewport, scale, onLiveChange, onRequestExit }) {
  const dragRef = useRef(null);
  const mask = normalizeOpacityMask(item.opacityMask);
  const width = Math.max(1, item.width || 100);
  const height = Math.max(1, item.height || 100);
  const shorter = Math.max(1, Math.min(width, height));

  // Clicking outside the overlay applies the current fade (same capture-
  // phase pattern CropOverlay.jsx/ImageFillOverlay.jsx use for their own
  // outside-click exit) — FadePopover marks its own trigger/panel
  // data-fade-toolbar-safe so opening it doesn't exit fade mode.
  useEffect(() => {
    function handlePointerDownOutside(event) {
      if (event.target.closest?.("[data-fade-toolbar-safe]")) return;
      onRequestExit?.();
    }
    window.addEventListener("mousedown", handlePointerDownOutside, true);
    return () => window.removeEventListener("mousedown", handlePointerDownOutside, true);
  }, [onRequestExit]);

  const topLeft = contentToScreen({ x: item.x, y: item.y }, viewport);
  const boxScreenWidth = width * viewport.scale;
  const boxScreenHeight = height * viewport.scale;

  function pointToScreen(point) {
    return { left: point.x * boxScreenWidth, top: point.y * boxScreenHeight };
  }

  // Drag start captures the handle's CURRENT local-px position (not just
  // its normalized point) so movement is relative-delta, not an absolute
  // cursor-to-item mapping — same "startBox + rotated delta" convention
  // CropOverlay.jsx's resize handles use (handleResizePointerDown/Move).
  function beginDrag(key, startLocalPx, event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { key, pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, startLocalPx };
  }

  // World (content-space) delta -> the item's own LOCAL (unrotated) px
  // delta — identical rotation math to CropOverlay.jsx's
  // handleResizePointerMove, so a rotated item's handles drag correctly.
  function rotatedDelta(event, drag) {
    const dxWorld = (event.clientX - drag.startClientX) / scale;
    const dyWorld = (event.clientY - drag.startClientY) / scale;
    const rad = ((item.rotation || 0) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return { dxLocal: dxWorld * cos + dyWorld * sin, dyLocal: -dxWorld * sin + dyWorld * cos };
  }

  function handlePointerMove(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const { dxLocal, dyLocal } = rotatedDelta(event, drag);
    const nextLocalX = drag.startLocalPx.x + dxLocal;
    const nextLocalY = drag.startLocalPx.y + dyLocal;

    if (drag.key === "start") {
      onLiveChange({ ...mask, start: { x: clamp01(nextLocalX / width), y: clamp01(nextLocalY / height) } });
    } else if (drag.key === "end") {
      onLiveChange({ ...mask, end: { x: clamp01(nextLocalX / width), y: clamp01(nextLocalY / height) } });
    } else if (drag.key === "center") {
      onLiveChange({ ...mask, center: { x: clamp01(nextLocalX / width), y: clamp01(nextLocalY / height) } });
    } else if (drag.key === "radius") {
      const dxFromCenter = nextLocalX - mask.center.x * width;
      const dyFromCenter = nextLocalY - mask.center.y * height;
      const radius = Math.max(0.02, Math.hypot(dxFromCenter, dyFromCenter) / shorter);
      onLiveChange({ ...mask, radius });
    }
  }

  function handlePointerUp(event) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function Handle({ handleKey, left, top, startLocalPx, title }) {
    return (
      <div
        data-fade-toolbar-safe
        onPointerDown={(event) => beginDrag(handleKey, startLocalPx, event)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        title={title}
        style={{
          position: "absolute",
          left,
          top,
          width: HANDLE_SIZE,
          height: HANDLE_SIZE,
          transform: "translate(-50%, -50%)",
          borderRadius: "999px",
          background: "#ffffff",
          border: "2px solid #d97706",
          boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
          cursor: "grab",
          touchAction: "none",
          pointerEvents: "auto",
        }}
      />
    );
  }

  const startScreen = pointToScreen(mask.start);
  const endScreen = pointToScreen(mask.end);
  const centerScreen = pointToScreen(mask.center);
  const shorterScreen = Math.max(1, Math.min(boxScreenWidth, boxScreenHeight));
  const radiusScreenPx = mask.radius * shorterScreen;
  const radiusHandleLocalPx = { x: mask.center.x * width + mask.radius * shorter, y: mask.center.y * height };

  return (
    <div
      data-fade-toolbar-safe
      style={{
        position: "absolute",
        left: topLeft.x,
        top: topLeft.y,
        width: boxScreenWidth,
        height: boxScreenHeight,
        transform: `rotate(${item.rotation || 0}deg)`,
        transformOrigin: "0 0",
        zIndex: 25,
        pointerEvents: "none",
      }}
    >
      {mask.type === "linear" ? (
        <>
          {/* Connecting line, purely visual */}
          <svg style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
            <line x1={startScreen.left} y1={startScreen.top} x2={endScreen.left} y2={endScreen.top} stroke="#d97706" strokeWidth={2} strokeDasharray="4 4" />
          </svg>
          <Handle handleKey="start" left={startScreen.left} top={startScreen.top} startLocalPx={{ x: mask.start.x * width, y: mask.start.y * height }} title="Fade start" />
          <Handle handleKey="end" left={endScreen.left} top={endScreen.top} startLocalPx={{ x: mask.end.x * width, y: mask.end.y * height }} title="Fade end" />
        </>
      ) : (
        <>
          <div
            style={{
              position: "absolute",
              left: centerScreen.left,
              top: centerScreen.top,
              width: radiusScreenPx * 2,
              height: radiusScreenPx * 2,
              transform: "translate(-50%, -50%)",
              borderRadius: "999px",
              border: "2px dashed #d97706",
              pointerEvents: "none",
            }}
          />
          <Handle handleKey="center" left={centerScreen.left} top={centerScreen.top} startLocalPx={{ x: mask.center.x * width, y: mask.center.y * height }} title="Fade center" />
          <Handle handleKey="radius" left={centerScreen.left + radiusScreenPx} top={centerScreen.top} startLocalPx={radiusHandleLocalPx} title="Fade size" />
        </>
      )}
    </div>
  );
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
