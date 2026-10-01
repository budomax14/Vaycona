import React from "react";
import { Plus } from "lucide-react";
import { labelShapeSvgPath } from "../../print/labelSheet";

// The whole sheet drawn to scale from a print plan (labelSheet.js
// buildLabelPrintPlan): every label image at its exact position on the
// paper. Shared by the editor's sheet map (interactive, outlines always
// on) and the print preview (outlines optional — they're preview chrome
// and never part of the PDF).
//
// `images`: Map pageId → image URL (useLabelImages), already clipped to
// the label shape over white, so each <img> just fills its slot.
export default function LabelSheetView({
  plan,
  images,
  showOutlines = true,
  activeIndex = null,
  onSelectSlot,
  onAddSlot,
  labelAria,
  addAria,
  backing = "#ffffff",
  className = "",
}) {
  const { paperWidthIn: W, paperHeightIn: H, label } = plan;
  const pct = (v, total) => `${(v / total) * 100}%`;

  return (
    <div className={`relative w-full overflow-hidden rounded-sm shadow-md ring-1 ring-gray-200 ${className}`} style={{ aspectRatio: `${W} / ${H}`, background: backing }}>
      {plan.slots.map((slot) => {
        const url = slot.page ? images?.get(slot.page.id) : null;
        const active = slot.index === activeIndex;
        const style = { left: pct(slot.xIn, W), top: pct(slot.yIn, H), width: pct(slot.widthIn, W), height: pct(slot.heightIn, H) };
        const content = url ? (
          <img src={url} alt="" draggable={false} className="block h-full w-full" />
        ) : slot.page ? (
          <div className="h-full w-full bg-white" />
        ) : null;

        if (!onSelectSlot) {
          return (
            <div key={slot.index} className="absolute" style={style}>
              {content}
            </div>
          );
        }
        if (!slot.page) {
          return (
            <button
              key={slot.index}
              type="button"
              className="absolute flex items-center justify-center text-gray-300 hover:text-amber-600"
              style={style}
              onClick={() => onAddSlot?.(slot.index)}
              title={addAria?.(slot.index + 1)}
              aria-label={addAria?.(slot.index + 1)}
            >
              <Plus size={12} />
            </button>
          );
        }
        return (
          <button
            key={slot.index}
            type="button"
            className={`absolute focus:outline-none ${active ? "z-10 ring-2 ring-amber-500" : "hover:ring-2 hover:ring-amber-300"}`}
            style={{ ...style, borderRadius: label.shape === "circle" || label.shape === "oval" ? "50%" : undefined }}
            onClick={() => onSelectSlot(slot.index)}
            title={labelAria?.(slot.index + 1)}
            aria-label={labelAria?.(slot.index + 1)}
            aria-pressed={active}
          >
            {content}
          </button>
        );
      })}
      {showOutlines && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          {plan.slots.map((slot) => (
            <path
              key={slot.index}
              d={labelShapeSvgPath(label, slot.widthIn, slot.heightIn, 1, slot.xIn, slot.yIn)}
              fill="none"
              stroke="#9ca3af"
              strokeWidth="1"
              strokeDasharray="3 2"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      )}
    </div>
  );
}
