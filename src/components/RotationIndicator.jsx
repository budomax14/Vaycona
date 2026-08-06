import React from "react";
import { contentToScreen } from "../viewport";

const SNAP_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315, 360];
const SNAP_TOLERANCE_DEGREES = 3;

function isNearSnapAngle(angle) {
  const normalized = ((angle % 360) + 360) % 360;
  return SNAP_ANGLES.some((snap) => Math.abs(normalized - snap) <= SNAP_TOLERANCE_DEGREES);
}

export default function RotationIndicator({ visible, angle, selectionBoundsContent, viewport }) {
  if (!visible || !selectionBoundsContent) return null;

  const topCenter = contentToScreen(
    { x: selectionBoundsContent.centerX, y: selectionBoundsContent.top },
    viewport
  );
  const snapped = isNearSnapAngle(angle);
  const normalized = Math.round(((angle % 360) + 360) % 360);

  return (
    <div
      className={`pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+16px)] rounded-full px-2.5 py-1 text-xs font-semibold shadow-lg transition-colors ${
        snapped ? "bg-amber-600 text-white" : "bg-gray-900 text-white"
      }`}
      style={{ left: topCenter.x, top: topCenter.y }}
    >
      {normalized}° {snapped && "· snapped"}
    </div>
  );
}
