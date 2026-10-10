import React, { useRef, useState } from "react";
import { FileText, PanelBottom, PanelTop } from "lucide-react";
import { IconButton } from "./toolbarUi";
import ToolbarPopover from "./ToolbarPopover";
import { useLanguage } from "../../languageContext";
import { OBJECT_PROPERTIES_STRINGS } from "../../i18n/objectProperties";

const LINE_SPACINGS = [
  { value: 1.15, labelKey: "spacingSingle" },
  { value: 1.5, labelKey: "spacingOneHalf" },
  { value: 2, labelKey: "spacingDouble" },
];

// Standard Document tools (App.jsx's documentControls): header/footer on
// every page, the body's line spacing, and a running word count. Shown from
// both the page bar and the text bar of the document's own text, so it's
// one tap away whether or not the page text is selected. Toolbar-safe, so
// using it while typing doesn't end the edit.
export default function DocumentMenu({ documentControls }) {
  const { language } = useLanguage();
  const t = OBJECT_PROPERTIES_STRINGS[language].canvas;
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  const toggleRow = (Icon, label, active, title, onClick) => (
    <button
      type="button"
      className={`flex h-10 items-center gap-2 rounded-lg px-2 text-left text-sm transition-colors ${
        active ? "bg-amber-50 text-amber-700" : "text-gray-700 hover:bg-gray-50"
      }`}
      onClick={onClick}
      title={title}
      aria-pressed={active}
    >
      <Icon size={16} />
      <span className="flex-1">{label}</span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${active ? "bg-amber-500" : "bg-gray-300"}`}
        aria-hidden="true"
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${active ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );

  return (
    <div className="relative shrink-0" data-text-toolbar-safe>
      <div ref={anchorRef} className="inline-flex">
        <IconButton icon={FileText} label={t.document} onClick={() => setOpen((v) => !v)} active={open} />
      </div>
      <ToolbarPopover isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <div className="flex w-64 flex-col gap-1 rounded-xl border border-gray-200 bg-white p-3 shadow-lg" data-text-toolbar-safe>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t.document}</span>
          {toggleRow(PanelTop, t.header, documentControls.hasHeader, documentControls.hasHeader ? t.removeHeader : t.addHeader, documentControls.onToggleHeader)}
          {toggleRow(PanelBottom, t.footer, documentControls.hasFooter, documentControls.hasFooter ? t.removeFooter : t.addFooter, documentControls.onToggleFooter)}
          <span className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t.lineSpacing}</span>
          <div className="grid grid-cols-3 gap-1" role="group" aria-label={t.lineSpacing}>
            {LINE_SPACINGS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`h-9 rounded-lg border text-sm transition-colors ${
                  documentControls.lineSpacing === option.value
                    ? "border-amber-400 bg-amber-50 text-amber-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
                onClick={() => documentControls.onLineSpacingChange(option.value)}
                aria-pressed={documentControls.lineSpacing === option.value}
              >
                {t[option.labelKey]}
              </button>
            ))}
          </div>
          <span className="mt-2 text-sm text-gray-500">{t.wordCount(documentControls.wordCount)}</span>
        </div>
      </ToolbarPopover>
    </div>
  );
}
