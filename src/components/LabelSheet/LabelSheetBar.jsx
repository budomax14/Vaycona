import React from "react";
import { Copy, Eraser, LayoutGrid, Printer, Tag } from "lucide-react";
import { useLanguage } from "../../languageContext";
import { LABEL_STRINGS } from "../../i18n/labels";
import { formatLabelSize } from "../../print/labelSheet";

// Shown above the canvas for label-sheet projects (like CardPanelBar for
// cards): the sheet's format, the same/individual mode switch, Fill All,
// Clear All, and the way into the print preview.
export default function LabelSheetBar({ sheet, activeLabelIndex, onSetMode, onFillAll, onClearAll, onOpenPrint, mapOpen, onToggleMap, compact = false }) {
  const { language } = useLanguage();
  const t = LABEL_STRINGS[language].bar;
  const same = sheet.mode === "same";
  const button =
    "flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:border-amber-300 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-700";

  return (
    <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-gray-200 bg-white px-2 py-1.5 sm:px-3">
      {!compact && (
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-gray-600" title={sheet.template.name}>
          <Tag size={14} className="text-amber-600" />
          {t.summary(sheet.count, formatLabelSize(sheet.template))}
        </span>
      )}

      <div role="radiogroup" aria-label={t.modeLabel} className="flex shrink-0 gap-0.5 rounded-lg bg-gray-100 p-0.5">
        {[
          { value: "same", label: t.modeSame, hint: t.modeSameHint },
          { value: "individual", label: t.modeIndividual, hint: t.modeIndividualHint },
        ].map((opt) => (
          <button
            key={opt.value}
            role="radio"
            aria-checked={sheet.mode === opt.value}
            title={opt.hint}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              sheet.mode === opt.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
            }`}
            onClick={() => sheet.mode !== opt.value && onSetMode(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {!compact && (
        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
          {same ? t.editingAll(sheet.count) : activeLabelIndex != null ? t.editing(activeLabelIndex + 1) : null}
        </span>
      )}

      <div className="flex flex-1 items-center justify-end gap-1.5">
        <button className={button} onClick={onFillAll} disabled={same} title={same ? t.fillAllSameHint : t.fillAllHint} aria-label={t.fillAll}>
          <Copy size={14} />
          {!compact && t.fillAll}
        </button>
        <button className={button} onClick={onClearAll} title={t.clearAllHint} aria-label={t.clearAll}>
          <Eraser size={14} />
          {!compact && t.clearAll}
        </button>
        {onToggleMap && (
          <button
            className={`${button} hidden md:flex ${mapOpen ? "border-amber-300 bg-amber-50 text-amber-800" : ""}`}
            onClick={onToggleMap}
            aria-pressed={mapOpen}
            aria-label={t.sheetAria}
            title={t.sheetAria}
          >
            <LayoutGrid size={14} />
            {!compact && t.sheet}
          </button>
        )}
        <button
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          onClick={onOpenPrint}
          aria-label={t.print}
          title={t.print}
        >
          <Printer size={14} />
          {!compact && t.print}
        </button>
      </div>
    </div>
  );
}
