import React, { useEffect } from "react";
import { X } from "lucide-react";
import { useLanguage } from "../../languageContext";
import { LABEL_STRINGS } from "../../i18n/labels";
import { LABEL_TEMPLATES } from "../../print/labelTemplates";
import { getPaperSize } from "../../print/paperSizes";
import { formatLabelSize, labelShapeSvgPath, labelSheetLayout } from "../../print/labelSheet";

// To-scale outline of a sheet: the paper and every label on it.
function SheetDiagram({ template }) {
  const layout = labelSheetLayout(template);
  const { widthIn: W, heightIn: H } = layout.paper;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-auto shrink-0 rounded-sm bg-white shadow ring-1 ring-gray-200" aria-hidden="true">
      {layout.slots.map((slot) => (
        <path
          key={slot.index}
          d={labelShapeSvgPath(layout.label, slot.widthIn, slot.heightIn, 1, slot.xIn, slot.yIn)}
          fill="#fef3c7"
          stroke="#d97706"
          strokeWidth="0.03"
        />
      ))}
    </svg>
  );
}

// Lists every sheet in the template registry (labelTemplates.js); picking
// one starts a new label project laid out for it.
export default function LabelTemplatePicker({ isOpen, onClose, onCreate }) {
  const { language } = useLanguage();
  const t = LABEL_STRINGS[language];

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="label-picker-title"
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-3.5">
          <div>
            <h2 id="label-picker-title" className="text-base font-semibold text-gray-900">
              {t.picker.title}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">{t.picker.subtitle}</p>
          </div>
          <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label={t.picker.closeAria}>
            <X size={18} />
          </button>
        </div>
        <ul className="flex flex-col gap-2 overflow-y-auto p-4">
          {LABEL_TEMPLATES.map((template) => (
            <li key={template.id}>
              <button
                className="flex w-full items-center gap-4 rounded-xl border border-gray-200 p-3 text-left transition-colors hover:border-amber-400 hover:bg-amber-50/40"
                onClick={() => onCreate(template.id)}
              >
                <SheetDiagram template={template} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-gray-900">{template.name}</span>
                  <span className="text-xs font-medium text-amber-700">{t.picker.perSheet(template.columns * template.rows)}</span>
                  <span className="text-xs text-gray-600">{t.picker.labelSize(formatLabelSize(template))}</span>
                  <span className="text-xs text-gray-500">
                    {t.picker.layout(template.columns, template.rows)} · {t.shapes[template.label.shape]} · {t.picker.paper(getPaperSize(template.paper).label)}
                  </span>
                  {template.compatibleWith?.length > 0 && (
                    <span className="mt-1 text-[11px] text-gray-400">{t.picker.compatible(template.compatibleWith.join(", "))}</span>
                  )}
                  <span className="mt-2 inline-flex w-fit rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white">{t.picker.create}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
