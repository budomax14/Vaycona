import React, { useEffect, useRef } from "react";
import { contentToScreen } from "../viewport";
import { useAsset } from "../useAsset";
import { useImageElement } from "../useImageElement";
import { computeImageFillLayout, dragImageFillPosition, normalizeImageFill } from "../imageFill";

// Interactive "drag the image inside the fixed text" overlay — modeled
// directly on CropOverlay.jsx's DOM-overlay-over-Konva trick (mounted as a
// sibling inside the same pan/zoom-transformed wrapper, so it naturally
// intercepts pointer events ahead of the Stage beneath it), but simpler:
// there's no dim/undim preview image to draw, since the real Konva render
// already shows the true masked-to-glyphs result live as the user drags —
// this is just a transparent hit-capture rectangle over the text's own box.
export default function ImageFillOverlay({ item, viewport, scale, onLiveChange, onRequestExit }) {
  const { objectUrl } = useAsset(item.fillImage?.assetId);
  const { naturalWidth, naturalHeight } = useImageElement(objectUrl);
  const dragRef = useRef(null);

  // Clicking outside the overlay applies the current position/zoom —
  // same capture-phase pattern CropOverlay.jsx uses for its own
  // outside-click exit.
  useEffect(() => {
    function handlePointerDownOutside(event) {
      if (event.target.closest?.("[data-image-fill-toolbar-safe]")) return;
      onRequestExit?.();
    }
    window.addEventListener("mousedown", handlePointerDownOutside, true);
    return () => window.removeEventListener("mousedown", handlePointerDownOutside, true);
  }, [onRequestExit]);

  const fillImage = normalizeImageFill(item.fillImage);
  const boxWidth = Math.max(1, item.width || 100);
  const boxHeight = Math.max(1, item.height || 100);

  if (!naturalWidth || !naturalHeight) return null;

  const layout = computeImageFillLayout(fillImage, naturalWidth, naturalHeight, boxWidth, boxHeight);
  const topLeft = contentToScreen({ x: item.x, y: item.y }, viewport);

  function handlePointerDown(event) {
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startY: event.clientY, fillImage };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!dragRef.current || fillImage.fit === "stretch") return;
    const dxScreen = event.clientX - dragRef.current.startX;
    const dyScreen = event.clientY - dragRef.current.startY;
    // Same real-browser-px -> content-px conversion CropOverlay.jsx uses
    // (event deltas are post the canvasFrameRef CSS scale(displayScale)
    // transform, so divide by the live zoom, not viewport.scale).
    const dxContent = dxScreen / scale;
    const dyContent = dyScreen / scale;
    const next = dragImageFillPosition(dragRef.current.fillImage, layout, naturalWidth, naturalHeight, boxWidth, boxHeight, dxContent, dyContent);
    onLiveChange(next);
  }

  function handlePointerUp(event) {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function handleWheel(event) {
    event.preventDefault();
    if (fillImage.fit === "stretch") return; // nothing to zoom — the whole image always exactly fills the box
    const delta = event.deltaY > 0 ? -0.05 : 0.05;
    const nextZoom = Math.max(1, Math.min(8, fillImage.zoom + delta));
    onLiveChange({ ...fillImage, zoom: nextZoom });
  }

  return (
    <div
      data-image-fill-toolbar-safe
      style={{
        position: "absolute",
        left: topLeft.x,
        top: topLeft.y,
        width: boxWidth * viewport.scale,
        height: boxHeight * viewport.scale,
        transform: `rotate(${item.rotation || 0}deg)`,
        transformOrigin: "0 0",
        zIndex: 25,
        cursor: fillImage.fit === "stretch" ? "default" : "move",
        background: "transparent",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    />
  );
}
