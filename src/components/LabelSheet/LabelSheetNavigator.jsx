import React, { useMemo } from "react";
import { X } from "lucide-react";
import { useLanguage } from "../../languageContext";
import { LABEL_STRINGS } from "../../i18n/labels";
import { buildLabelPrintPlan } from "../../print/labelSheet";
import { useLabelImages } from "./useLabelImages";
import LabelSheetView from "./LabelSheetView";

// The sheet map beside the canvas: the whole sheet at true proportions,
// with every label's boundary drawn and its current design shown. Clicking
// a label edits it (individual mode). The canvas itself always shows one
// label at a time, big enough to work on.
export default function LabelSheetNavigator({ sheet, pages, items, activePageId, onSelectLabel, onAddLabel, onUpdateSettings, onClose }) {
  const { language } = useLanguage();
  const t = LABEL_STRINGS[language].map;
  // Positions, not the printer nudge — that's a print-time correction.
  const plan = useMemo(() => buildLabelPrintPlan({ ...sheet, settings: { ...sheet.settings, offsetXIn: 0, offsetYIn: 0 } }), [sheet]);
  const labelPages = useMemo(() => pages.filter((p) => sheet.pageIds.has(p.id)), [pages, sheet]);
  const { images } = useLabelImages({ pages: labelPages, items, label: sheet.template.label, enabled: true, pxPerInch: 72 });
  const activePage = labelPages.find((p) => p.id === activePageId);
  const same = sheet.mode === "same";

  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-3 overflow-y-auto border-l border-gray-200 bg-white p-3 md:flex" aria-label={t.title}>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t.title}</h2>
        <button className="rounded p-1 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label={LABEL_STRINGS[language].bar.sheetAria}>
          <X size={14} />
        </button>
      </div>
      <p className="-mt-2 text-[11px] leading-snug text-gray-400">{same ? t.hintSame : t.hint}</p>
      <LabelSheetView
        plan={plan}
        images={images}
        backing="#f3f4f6"
        activeIndex={same ? null : activePage?.printLayout.labelIndex ?? null}
        onSelectSlot={(index) => onSelectLabel(index)}
        onAddSlot={same ? undefined : onAddLabel}
        labelAria={t.labelAria}
        addAria={t.addLabel}
      />
      <div className="flex flex-col gap-0.5 border-t border-gray-100 pt-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-amber-600"
            checked={sheet.settings.guides.outline}
            onChange={(e) => onUpdateSettings({ guides: { outline: e.target.checked } })}
          />
          {t.showOutlines}
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-amber-600"
            checked={sheet.settings.guides.safe}
            onChange={(e) => onUpdateSettings({ guides: { safe: e.target.checked } })}
          />
          {t.showSafe}
        </label>
        <p className="mt-1 text-[10px] leading-snug text-gray-400">{t.guidesNote}</p>
      </div>
    </aside>
  );
}
