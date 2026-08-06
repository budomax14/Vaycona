import React from "react";
import { Lock } from "lucide-react";
import { contentToScreen } from "./viewport";
import { guideColorValue } from "./precisionDefaults";

export default function GuideLine({ guide, viewport, selected, onDragStart, onDelete, onSelect }) {
  if (guide.hidden) return null;
  const isVertical = guide.orientation === "vertical";
  const screen = contentToScreen(
    isVertical ? { x: guide.pos, y: 0 } : { x: 0, y: guide.pos },
    viewport
  );

  const style = {
    "--guide-color": guideColorValue(guide.color),
    ...(isVertical ? { left: screen.x, top: 0, bottom: 0 } : { top: screen.y, left: 0, right: 0 }),
  };

  return (
    <div
      className={`guide-line guide-${guide.orientation} ${selected ? "guide-selected" : ""} ${guide.locked ? "guide-locked" : ""}`}
      style={style}
      title={guide.label || undefined}
      role="separator"
      aria-label={`${guide.orientation} guide at ${Math.round(guide.pos)}px${guide.label ? `, ${guide.label}` : ""}${guide.locked ? " (locked)" : ""}`}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect?.(guide.id);
        if (!guide.locked) onDragStart(guide.orientation, guide.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (!guide.locked) onDelete(guide.id);
      }}
    >
      {guide.locked && (
        <span className="guide-lock-badge" style={isVertical ? { left: 2, top: 4 } : { top: 2, left: 4 }}>
          <Lock size={9} />
        </span>
      )}
    </div>
  );
}
