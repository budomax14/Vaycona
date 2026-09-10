import React, { useRef, useState } from "react";
import { Spline } from "lucide-react";
import { IconButton, SliderField } from "./toolbarUi";
import ToolbarPopover from "./ToolbarPopover";
import { useLanguage } from "../../languageContext";
import { TEXT_PROPERTIES_STRINGS } from "../../i18n/textProperties";

// Bends the text along a circular arc — rendered by CurvedTextNode.jsx
// once item.curve is non-zero (0 = straight/normal text, the fast path
// stays untouched). Same "own popover, same onChange({...}) shape" pattern
// as TextEffectsMenu, just a single slider instead of three sections.
export default function TextCurveMenu({ item, onChange }) {
  const { language } = useLanguage();
  const t = TEXT_PROPERTIES_STRINGS[language].textCurve;
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const amount = item.curve || 0;

  return (
    <div className="relative shrink-0" data-text-toolbar-safe>
      <div ref={anchorRef} className="inline-flex">
        <IconButton icon={Spline} label={t.curveButtonLabel} onClick={() => setOpen((v) => !v)} active={open || amount !== 0} />
      </div>
      <ToolbarPopover isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <div className="flex w-64 flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-lg" data-text-toolbar-safe>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t.curveHeader}</span>
            {amount !== 0 && (
              <button
                type="button"
                className="text-[11px] font-semibold text-gray-400 hover:text-gray-600"
                onClick={() => onChange({ curve: 0 })}
              >
                {t.reset}
              </button>
            )}
          </div>
          <SliderField
            label={t.amount}
            value={amount}
            min={-100}
            max={100}
            step={1}
            width="100%"
            onChange={(value) => onChange({ curve: value })}
          />
        </div>
      </ToolbarPopover>
    </div>
  );
}
