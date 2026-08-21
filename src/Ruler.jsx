import React, { useEffect, useRef } from "react";
import { computeRulerSteps } from "./viewport";
import { pxToDisplay } from "./measurement";
import { RULER_THICKNESS as THICKNESS } from "./constants";
import { useTheme } from "./themeContext";

function drawRuler(canvas, length, orientation, viewport, cursorContentPos, unitKey, selectionExtent, isDark) {
  const dpr = window.devicePixelRatio || 1;
  const width = orientation === "horizontal" ? length : THICKNESS;
  const height = orientation === "horizontal" ? THICKNESS : length;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = isDark ? "#171d2b" : "#f9fafb";
  ctx.fillRect(0, 0, width, height);

  const offset = orientation === "horizontal" ? viewport.x : viewport.y;

  // Selection extent (spec §10 "active selection extents where useful") —
  // drawn before ticks so tick marks/labels stay legible on top.
  if (selectionExtent) {
    const startPos = selectionExtent.start * viewport.scale + offset;
    const endPos = selectionExtent.end * viewport.scale + offset;
    ctx.fillStyle = "rgba(124, 58, 237, 0.12)";
    if (orientation === "horizontal") ctx.fillRect(startPos, 0, endPos - startPos, THICKNESS);
    else ctx.fillRect(0, startPos, THICKNESS, endPos - startPos);
  }

  ctx.strokeStyle = isDark ? "#4b5563" : "#9ca3af";
  ctx.fillStyle = isDark ? "#d1d5db" : "#4b5563";
  ctx.font = "10px Inter, ui-sans-serif, sans-serif";
  ctx.lineWidth = 1;

  const { minor, major } = computeRulerSteps(viewport.scale, unitKey);

  const startContent = (0 - offset) / viewport.scale;
  const endContent = (length - offset) / viewport.scale;
  const firstTick = Math.floor(startContent / minor) * minor;

  for (let value = firstTick; value <= endContent + minor; value += minor) {
    const screenPos = value * viewport.scale + offset;
    if (screenPos < -1 || screenPos > length + 1) continue;

    const isMajor = Math.abs(Math.round(value / major) * major - value) < minor / 2;
    const tickLength = isMajor ? THICKNESS * 0.6 : THICKNESS * 0.3;

    ctx.beginPath();
    if (orientation === "horizontal") {
      ctx.moveTo(screenPos + 0.5, THICKNESS);
      ctx.lineTo(screenPos + 0.5, THICKNESS - tickLength);
    } else {
      ctx.moveTo(THICKNESS, screenPos + 0.5);
      ctx.lineTo(THICKNESS - tickLength, screenPos + 0.5);
    }
    ctx.stroke();

    if (isMajor) {
      const label = String(pxToDisplay(value, unitKey));
      ctx.save();
      if (orientation === "horizontal") {
        ctx.translate(screenPos + 3, THICKNESS - tickLength - 1);
        ctx.textBaseline = "bottom";
        ctx.fillText(label, 0, 0);
      } else {
        ctx.translate(THICKNESS - tickLength - 1, screenPos + 3);
        ctx.rotate(-Math.PI / 2);
        ctx.textBaseline = "bottom";
        ctx.fillText(label, 0, 0);
      }
      ctx.restore();
    }
  }

  if (cursorContentPos != null) {
    const screenPos = cursorContentPos * viewport.scale + offset;
    if (screenPos >= 0 && screenPos <= length) {
      ctx.strokeStyle = "#4c1d95";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (orientation === "horizontal") {
        ctx.moveTo(screenPos + 0.5, 0);
        ctx.lineTo(screenPos + 0.5, THICKNESS);
      } else {
        ctx.moveTo(0, screenPos + 0.5);
        ctx.lineTo(THICKNESS, screenPos + 0.5);
      }
      ctx.stroke();
    }
  }
}

export default function Ruler({ orientation, viewport, viewportLength, cursorContentPos, onGuideDragStart, unit = "px", selectionExtent = null, className = "" }) {
  const canvasRef = useRef(null);
  const { isDark } = useTheme();

  useEffect(() => {
    if (canvasRef.current) {
      drawRuler(canvasRef.current, viewportLength, orientation, viewport, cursorContentPos, unit, selectionExtent, isDark);
    }
  }, [orientation, viewport, viewportLength, cursorContentPos, unit, selectionExtent, isDark]);

  return (
    <canvas
      ref={canvasRef}
      className={`ruler ruler-${orientation} ${className}`.trim()}
      role="presentation"
      aria-hidden="true"
      style={{ touchAction: "none" }}
      onPointerDown={(event) => {
        event.preventDefault();
        onGuideDragStart();
      }}
    />
  );
}
