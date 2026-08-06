import React from "react";
import { Circle, Minus, MoveRight, RectangleHorizontal, Square, Star, Triangle } from "lucide-react";
import { FRAME_KIND_ORDER, FRAME_KINDS } from "../../../frameKinds";

const QUICK_SHAPES = [
  { kind: "rectangle", label: "Rectangle", icon: RectangleHorizontal },
  { kind: "roundedRectangle", label: "Rounded", icon: Square },
  { kind: "circle", label: "Circle", icon: Circle },
  { kind: "triangle", label: "Triangle", icon: Triangle },
  { kind: "star", label: "Star", icon: Star },
];

const QUICK_LINES = [
  { kind: "straight", label: "Line", icon: Minus },
  { kind: "arrow", label: "Arrow", icon: MoveRight },
];

// A general-purpose quick-access panel mixing a curated subset of shapes,
// lines, and frames — the exhaustive lists live in the dedicated
// Shapes/Icons panels; this is the "grab a common thing fast" panel.
export default function ElementsPanel({ onAddShape, onAddLine, onAddFrame }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold text-gray-800">Elements</h3>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Shapes</span>
        <div className="grid grid-cols-3 gap-2">
          {QUICK_SHAPES.map(({ kind, label, icon: Icon }) => (
            <button
              key={kind}
              type="button"
              className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 py-4 text-gray-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
              onClick={() => onAddShape(kind)}
              title={label}
              aria-label={`Add ${label}`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Lines</span>
        <div className="grid grid-cols-3 gap-2">
          {QUICK_LINES.map(({ kind, label, icon: Icon }) => (
            <button
              key={kind}
              type="button"
              className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 py-4 text-gray-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
              onClick={() => onAddLine(kind)}
              title={label}
              aria-label={`Add ${label}`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Frames</span>
        <div className="grid grid-cols-3 gap-2">
          {FRAME_KIND_ORDER.map((kind) => (
            <button
              key={kind}
              type="button"
              className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-4 text-gray-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
              onClick={() => onAddFrame(kind)}
              title={FRAME_KINDS[kind].label}
              aria-label={`Add ${FRAME_KINDS[kind].label}`}
            >
              <span className="text-[10px] font-medium">{FRAME_KINDS[kind].label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
