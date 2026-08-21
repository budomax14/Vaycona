import React from "react";
import { contentToScreen } from "../viewport";

// Two small draggable handles at a line/arrow's absolute start/end points —
// shown only when exactly one line-type item is selected (App.jsx gates
// this), replacing the shared box-Transformer for this type (lines set
// usesTransformer:false in the registry). Purely presentational: actual
// drag tracking (window mousemove/mouseup, coordinate math, commit) lives
// in App.jsx, mirroring the existing guide-drag pattern.
export function getLineEndpointsContent(item) {
  const rad = ((item.rotation || 0) * Math.PI) / 180;
  const start = { x: item.x, y: item.y };
  const end = {
    x: item.x + (item.width || 0) * Math.cos(rad),
    y: item.y + (item.width || 0) * Math.sin(rad),
  };
  return { start, end };
}

function Handle({ point, viewport, onPointerDown }) {
  const screen = contentToScreen(point, viewport);
  return (
    <div
      className="pointer-events-auto absolute z-20 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-600 bg-white shadow"
      style={{ left: screen.x, top: screen.y, cursor: "move", touchAction: "none" }}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onPointerDown();
      }}
    />
  );
}

export default function LineEndpointHandles({ item, viewport, onDragStart }) {
  if (!item) return null;
  const { start, end } = getLineEndpointsContent(item);
  return (
    <>
      <Handle point={start} viewport={viewport} onPointerDown={() => onDragStart("start")} />
      <Handle point={end} viewport={viewport} onPointerDown={() => onDragStart("end")} />
    </>
  );
}
