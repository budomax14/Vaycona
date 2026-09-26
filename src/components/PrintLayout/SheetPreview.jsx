import React from "react";
import { useLanguage } from "../../languageContext";
import { PRINT_STRINGS } from "../../i18n/print";

// Draws the print plan (print/printPlan.js) to scale: every PDF page, with
// each panel image in its exact slot, the trim edge, and the fold. The
// dashed fold line here is preview chrome only — whether one prints is up
// to the plan (printPdf.js), never this component.
export default function SheetPreview({ plan, images, loading = false }) {
  const { language } = useLanguage();
  const t = PRINT_STRINGS[language];
  const sheetLabels = { outside: t.settings.sheetOutside, inside: t.settings.sheetInside };

  return (
    <div className="flex flex-col gap-4">
      {plan.pages.map((sheet) => (
        <figure key={sheet.key} className="m-0">
          <figcaption className="mb-1.5 text-xs font-medium text-gray-500">{sheetLabels[sheet.key] || sheet.key}</figcaption>
          <div
            className="relative w-full overflow-hidden rounded-sm bg-white shadow-md ring-1 ring-gray-200"
            style={{ aspectRatio: `${sheet.pageWidthIn} / ${sheet.pageHeightIn}` }}
          >
            {sheet.slots.map((slot) => {
              const img = slot.page ? images?.[slot.page.id] : null;
              const style = {
                left: `${(slot.trim.x / sheet.pageWidthIn) * 100}%`,
                top: `${(slot.trim.y / sheet.pageHeightIn) * 100}%`,
                width: `${(slot.trim.width / sheet.pageWidthIn) * 100}%`,
                height: `${(slot.trim.height / sheet.pageHeightIn) * 100}%`,
              };
              return (
                <div key={slot.panel} className="absolute" style={style}>
                  {img ? (
                    <img
                      src={img.url}
                      alt=""
                      className={`h-full w-full ${plan.edgeMode === "trim" ? "object-cover" : "object-fill"}`}
                      style={slot.rotation % 360 === 180 ? { transform: "rotate(180deg)" } : undefined}
                      draggable={false}
                    />
                  ) : (
                    <div className={`h-full w-full ${loading ? "animate-pulse bg-gray-100" : "bg-white"}`} />
                  )}
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gray-900/70 px-2 py-0.5 text-[10px] font-medium text-white">
                    {t.panelNames[slot.panel]}
                  </span>
                </div>
              );
            })}
            {plan.bleedIn > 0 && (
              <div
                className="pointer-events-none absolute border border-dashed border-sky-400/80"
                style={{
                  left: `${(sheet.trim.x / sheet.pageWidthIn) * 100}%`,
                  top: `${(sheet.trim.y / sheet.pageHeightIn) * 100}%`,
                  width: `${(sheet.trim.width / sheet.pageWidthIn) * 100}%`,
                  height: `${(sheet.trim.height / sheet.pageHeightIn) * 100}%`,
                }}
              />
            )}
            {sheet.folds.map((fold, i) => (
              <div
                key={i}
                className="pointer-events-none absolute"
                style={
                  fold.orientation === "vertical"
                    ? { left: `${(fold.x1 / sheet.pageWidthIn) * 100}%`, top: 0, bottom: 0, borderLeft: "1px dashed rgba(217,119,6,0.9)" }
                    : { top: `${(fold.y1 / sheet.pageHeightIn) * 100}%`, left: 0, right: 0, borderTop: "1px dashed rgba(217,119,6,0.9)" }
                }
              >
                <span className="absolute -translate-x-1/2 rounded bg-amber-500 px-1 text-[9px] font-semibold uppercase leading-4 text-white" style={{ top: 2 }}>
                  {t.settings.foldHere}
                </span>
              </div>
            ))}
          </div>
        </figure>
      ))}
    </div>
  );
}
