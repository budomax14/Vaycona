import React, { useRef, useState } from "react";
import { ArrowDown, ArrowDownLeft, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUp, ArrowUpLeft, ArrowUpRight, Box } from "lucide-react";
import { ColorField, IconButton, IconToggleButton, LabeledField, NumberField, SliderField } from "./toolbarUi";
import ResponsiveSheet from "../ResponsiveSheet/ResponsiveSheet";
import { resolveText3D, TEXT3D_DIRECTIONS, TEXT3D_SHADING_OPTIONS, TEXT3D_LIGHT_DIRECTIONS } from "../../text3D";
import { TEXT3D_PRESETS, applyText3DPreset } from "../../text3DPresets";
import { useLanguage } from "../../languageContext";
import { TEXT_PROPERTIES_STRINGS } from "../../i18n/textProperties";

const DIRECTION_ICONS = {
  left: ArrowLeft,
  right: ArrowRight,
  up: ArrowUp,
  down: ArrowDown,
  "top-left": ArrowUpLeft,
  "top-right": ArrowUpRight,
  "bottom-left": ArrowDownLeft,
  "bottom-right": ArrowDownRight,
};

// Text Effects → 3D. Same ResponsiveSheet + onChange({ text3D }) contract as
// TextEffectsMenu.jsx's shadow/glow/outline controls — text3D is just
// another item-level effect object (see text3D.js), so it rides the exact
// same commit/undo/save path with zero new plumbing.
export default function Text3DMenu({ item, onChange }) {
  const { language } = useLanguage();
  const t = TEXT_PROPERTIES_STRINGS[language].text3D;
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const text3D = resolveText3D(item);

  function update(patch) {
    onChange({ text3D: { ...text3D, ...patch } });
  }

  function handleToggleOpen() {
    setOpen((wasOpen) => {
      const willOpen = !wasOpen;
      // Opening with 3D still off would otherwise land on a bare "enable"
      // toggle with none of the actual controls visible — turn it on in
      // the same click so the full menu shows right away.
      if (willOpen && !text3D.enabled) update({ enabled: true });
      return willOpen;
    });
  }

  return (
    <div className="relative shrink-0" data-text-toolbar-safe>
      <div ref={anchorRef} className="inline-flex">
        <IconButton icon={Box} label={t.label3D} onClick={handleToggleOpen} active={open || text3D.enabled} />
      </div>
      <ResponsiveSheet isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <div className="flex w-72 flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-lg" data-text-toolbar-safe>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">{t.title3DText}</span>
            <IconToggleButton icon={Box} active={text3D.enabled} onClick={() => update({ enabled: !text3D.enabled })} title={t.toggle3DText} />
          </div>

          {text3D.enabled && (
            <>
              <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-3">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t.preset}</span>
                <div className="flex flex-wrap gap-1.5">
                  {TEXT3D_PRESETS.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
                      onClick={() => onChange({ text3D: applyText3DPreset(text3D, preset) })}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                <SliderField label={t.depth} value={text3D.depth} min={0} max={100} step={1} onChange={(v) => update({ depth: v })} />
                <ColorField label={t.color3D} value={text3D.extrusionColor} onChange={(color) => update({ extrusionColor: color })} />
              </div>

              <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-3">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t.direction}</span>
                <div className="grid grid-cols-4 gap-1">
                  {TEXT3D_DIRECTIONS.map((dir) => (
                    <IconToggleButton
                      key={dir.key}
                      icon={DIRECTION_ICONS[dir.key]}
                      active={text3D.direction === dir.key}
                      onClick={() => update({ direction: dir.key, angle: dir.angle })}
                      title={dir.label}
                    />
                  ))}
                </div>
                <NumberField label={t.angle} value={text3D.angle} min={0} max={359} step={1} onChange={(v) => update({ angle: v })} />
              </div>

              <div className="flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
                <LabeledField label={t.shading} width={150}>
                  <select
                    className="h-8 w-full rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm text-gray-700 outline-none focus:border-amber-400 focus:bg-white"
                    value={text3D.shading}
                    onChange={(event) => update({ shading: event.target.value })}
                  >
                    {TEXT3D_SHADING_OPTIONS.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </LabeledField>
                <SliderField label={t.bevel} value={text3D.bevel} min={0} max={20} step={1} onChange={(v) => update({ bevel: v })} />
              </div>

              <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t.advanced}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <SliderField label={t.perspective} value={text3D.perspective} min={0} max={100} step={1} onChange={(v) => update({ perspective: v })} />
                  <SliderField label={t.highlight} value={text3D.highlight} min={0} max={100} step={1} onChange={(v) => update({ highlight: v })} />
                </div>
                <LabeledField label={t.lightDirection} width={190}>
                  <select
                    className="h-8 w-full rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm text-gray-700 outline-none focus:border-amber-400 focus:bg-white"
                    value={text3D.lightDirection}
                    onChange={(event) => update({ lightDirection: event.target.value })}
                  >
                    {TEXT3D_LIGHT_DIRECTIONS.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </LabeledField>
              </div>
            </>
          )}
        </div>
      </ResponsiveSheet>
    </div>
  );
}
