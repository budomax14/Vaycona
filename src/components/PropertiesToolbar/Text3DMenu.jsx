import React, { useRef, useState } from "react";
import { ArrowDown, ArrowDownLeft, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUp, ArrowUpLeft, ArrowUpRight, Box } from "lucide-react";
import { ColorField, IconButton, IconToggleButton, LabeledField, NumberField, SliderField } from "./toolbarUi";
import ToolbarPopover from "./ToolbarPopover";
import { resolveText3D, TEXT3D_DIRECTIONS, TEXT3D_SHADING_OPTIONS, TEXT3D_LIGHT_DIRECTIONS } from "../../text3D";
import { TEXT3D_PRESETS, applyText3DPreset } from "../../text3DPresets";

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

// Text Effects → 3D. Same ToolbarPopover + onChange({ text3D }) contract as
// TextEffectsMenu.jsx's shadow/glow/outline controls — text3D is just
// another item-level effect object (see text3D.js), so it rides the exact
// same commit/undo/save path with zero new plumbing.
export default function Text3DMenu({ item, onChange }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const text3D = resolveText3D(item);

  function update(patch) {
    onChange({ text3D: { ...text3D, ...patch } });
  }

  return (
    <div className="relative shrink-0" data-text-toolbar-safe>
      <div ref={anchorRef} className="inline-flex">
        <IconButton icon={Box} label="3D" onClick={() => setOpen((v) => !v)} active={open || text3D.enabled} />
      </div>
      <ToolbarPopover isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <div className="flex w-72 flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-lg" data-text-toolbar-safe>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">3D Text</span>
            <IconToggleButton icon={Box} active={text3D.enabled} onClick={() => update({ enabled: !text3D.enabled })} title="Toggle 3D text" />
          </div>

          {text3D.enabled && (
            <>
              <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-3">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Preset</span>
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
                <SliderField label="Depth" value={text3D.depth} min={0} max={100} step={1} onChange={(v) => update({ depth: v })} />
                <ColorField label="3D Color" value={text3D.extrusionColor} onChange={(color) => update({ extrusionColor: color })} />
              </div>

              <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-3">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Direction</span>
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
                <NumberField label="Angle" value={text3D.angle} min={0} max={359} step={1} onChange={(v) => update({ angle: v })} />
              </div>

              <div className="flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
                <LabeledField label="Shading" width={150}>
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
                <SliderField label="Bevel" value={text3D.bevel} min={0} max={20} step={1} onChange={(v) => update({ bevel: v })} />
              </div>

              <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Advanced</span>
                <div className="flex flex-wrap items-center gap-2">
                  <SliderField label="Perspective" value={text3D.perspective} min={0} max={100} step={1} onChange={(v) => update({ perspective: v })} />
                  <SliderField label="Highlight" value={text3D.highlight} min={0} max={100} step={1} onChange={(v) => update({ highlight: v })} />
                </div>
                <LabeledField label="Light direction" width={190}>
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
      </ToolbarPopover>
    </div>
  );
}
