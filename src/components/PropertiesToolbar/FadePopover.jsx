import React, { useRef, useState } from "react";
import { Blend, MousePointer2 } from "lucide-react";
import { GroupedSliderField, IconButton, IconToggleButton, LabeledField } from "./toolbarUi";
import ResponsiveSheet from "../ResponsiveSheet/ResponsiveSheet";
import { DEFAULT_OPACITY_MASK, LINEAR_DIRECTION_PRESETS, normalizeOpacityMask } from "../../opacityMask";
import { useLanguage } from "../../languageContext";
import { TOOLBAR_MENU_STRINGS } from "../../i18n/toolbarMenus";

// Partial Opacity / Fade — a separate control from the existing whole-
// element Opacity slider (see ImagePropertiesBar.jsx etc.), modeled on
// FiltersPopover.jsx's own trigger-button + dropdown-panel shape so it
// reads as one more entry in the same family of controls rather than a new
// floating settings card. `onChange` commits immediately (type switch,
// direction preset, reverse) exactly like every other discrete field edit
// in this app; `onLiveChange`/`onCommit` are the GroupedSliderField
// live-drag/single-commit pair image adjustments already use, so dragging
// an opacity or size slider doesn't spam one undo entry per tick.
export default function FadePopover({ opacityMask, onChange, onLiveChange, onCommit, onEnterEditMode, isEditingOnCanvas }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const current = normalizeOpacityMask(opacityMask);
  const { language } = useLanguage();
  const t = TOOLBAR_MENU_STRINGS[language].fade;

  const activeDirectionKey = LINEAR_DIRECTION_PRESETS.find(
    (preset) => preset.start.x === current.start.x && preset.start.y === current.start.y && preset.end.x === current.end.x && preset.end.y === current.end.y
  )?.key;

  return (
    <div className="relative shrink-0" data-fade-toolbar-safe>
      <div ref={anchorRef} className="inline-flex">
        <IconButton icon={Blend} label={t.fade} onClick={() => setOpen((v) => !v)} active={open || current.enabled} />
      </div>
      <ResponsiveSheet isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <div className="w-64 rounded-xl border border-gray-200 bg-white p-4 shadow-lg" data-fade-toolbar-safe>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t.fade}</p>

          <LabeledField label={t.type} width="100%">
            <select
              className="h-8 w-full rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm text-gray-700 outline-none focus:border-amber-400 focus:bg-white"
              value={current.enabled ? current.type : "none"}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "none") {
                  onChange({ ...current, enabled: false });
                } else {
                  onChange({ ...current, enabled: true, type: value });
                }
              }}
            >
              <option value="none">{t.none}</option>
              <option value="linear">{t.linear}</option>
              <option value="radial">{t.radial}</option>
            </select>
          </LabeledField>

          {current.enabled && (
            <>
              <div className="mt-3">
                <IconToggleButton
                  icon={MousePointer2}
                  active={!!isEditingOnCanvas}
                  onClick={onEnterEditMode}
                  title={t.editOnCanvas}
                />
                <span className="ml-2 align-middle text-xs text-gray-500">{t.editOnCanvas}</span>
              </div>

              {current.type === "linear" && (
                <LabeledField label={t.direction} width="100%">
                  <select
                    className="mt-1 h-8 w-full rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm text-gray-700 outline-none focus:border-amber-400 focus:bg-white"
                    value={activeDirectionKey || ""}
                    onChange={(event) => {
                      const preset = LINEAR_DIRECTION_PRESETS.find((p) => p.key === event.target.value);
                      if (preset) onChange({ ...current, start: preset.start, end: preset.end });
                    }}
                  >
                    {!activeDirectionKey && <option value="">{t.custom}</option>}
                    {LINEAR_DIRECTION_PRESETS.map((preset) => (
                      <option key={preset.key} value={preset.key}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </LabeledField>
              )}

              <div className="mt-3 flex flex-col gap-2">
                <GroupedSliderField
                  label={current.type === "radial" ? t.inner : t.start}
                  value={current.startOpacity}
                  min={0}
                  max={1}
                  step={0.05}
                  width="100%"
                  onLiveChange={(value) => onLiveChange({ ...current, startOpacity: value })}
                  onCommit={onCommit}
                />
                <GroupedSliderField
                  label={current.type === "radial" ? t.outer : t.end}
                  value={current.endOpacity}
                  min={0}
                  max={1}
                  step={0.05}
                  width="100%"
                  onLiveChange={(value) => onLiveChange({ ...current, endOpacity: value })}
                  onCommit={onCommit}
                />
                {current.type === "radial" && (
                  <GroupedSliderField
                    label={t.size}
                    value={current.radius}
                    min={0.05}
                    max={1.5}
                    step={0.02}
                    width="100%"
                    onLiveChange={(value) => onLiveChange({ ...current, radius: value })}
                    onCommit={onCommit}
                  />
                )}
              </div>

              <label className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  className="accent-amber-600"
                  checked={current.reverse}
                  onChange={(event) => onChange({ ...current, reverse: event.target.checked })}
                />
                {t.reverseFade}
              </label>

              <button
                className="mt-3 w-full rounded-lg border border-gray-200 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50"
                onClick={() => onChange({ ...DEFAULT_OPACITY_MASK })}
              >
                {t.reset}
              </button>
            </>
          )}
        </div>
      </ResponsiveSheet>
    </div>
  );
}
