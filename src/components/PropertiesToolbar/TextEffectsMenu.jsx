import React, { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { ColorField, IconButton, IconToggleButton, LabeledField, NumberField } from "./toolbarUi";
import ToolbarPopover from "./ToolbarPopover";

// Promoted out of TextMoreMenu.jsx to a top-level toolbar control (shadow/
// glow/outline are common enough to earn their own button). Same
// onChange({ effects }) contract as before — nothing about how effects are
// stored or rendered changed, only where the controls live. Opens via
// ToolbarPopover (portalled) — PropertiesToolbar's row clips ordinary
// anchored dropdowns, see that component's comment.
export default function TextEffectsMenu({ item, onChange }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const effects = item.effects || {};

  const hasAnyEffect = !!(effects.shadow?.enabled || effects.glow?.enabled || effects.outline?.enabled);

  return (
    <div className="relative shrink-0" data-text-toolbar-safe>
      <div ref={anchorRef} className="inline-flex">
        <IconButton icon={Sparkles} label="Effects" onClick={() => setOpen((v) => !v)} active={open || hasAnyEffect} />
      </div>
      <ToolbarPopover isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <div className="flex w-72 flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-lg" data-text-toolbar-safe>
          <div className="flex flex-col gap-2">
            <LabeledField label="Shadow">
              <IconToggleButton
                icon={Sparkles}
                active={!!effects.shadow?.enabled}
                onClick={() =>
                  onChange({
                    effects: {
                      ...effects,
                      shadow: { ...effects.shadow, enabled: !effects.shadow?.enabled },
                      glow: { ...effects.glow, enabled: false },
                    },
                  })
                }
                title="Toggle shadow"
              />
            </LabeledField>
            {effects.shadow?.enabled && (
              <div className="flex flex-wrap items-center gap-2">
                <ColorField label="Color" value={effects.shadow.color || "#000000"} onChange={(color) => onChange({ effects: { ...effects, shadow: { ...effects.shadow, color } } })} />
                <NumberField label="Blur" value={effects.shadow.blur ?? 8} min={0} max={60} onChange={(v) => onChange({ effects: { ...effects, shadow: { ...effects.shadow, blur: v } } })} />
                <NumberField label="Offset X" value={effects.shadow.offsetX ?? 2} min={-40} max={40} onChange={(v) => onChange({ effects: { ...effects, shadow: { ...effects.shadow, offsetX: v } } })} />
                <NumberField label="Offset Y" value={effects.shadow.offsetY ?? 2} min={-40} max={40} onChange={(v) => onChange({ effects: { ...effects, shadow: { ...effects.shadow, offsetY: v } } })} />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
            <LabeledField label="Glow">
              <IconToggleButton
                icon={Sparkles}
                active={!!effects.glow?.enabled}
                onClick={() =>
                  onChange({
                    effects: {
                      ...effects,
                      glow: { ...effects.glow, enabled: !effects.glow?.enabled },
                      shadow: { ...effects.shadow, enabled: false },
                    },
                  })
                }
                title="Toggle glow"
              />
            </LabeledField>
            {effects.glow?.enabled && (
              <div className="flex flex-wrap items-center gap-2">
                <ColorField label="Color" value={effects.glow.color || "#8b5cf6"} onChange={(color) => onChange({ effects: { ...effects, glow: { ...effects.glow, color } } })} />
                <NumberField label="Blur" value={effects.glow.blur ?? 16} min={0} max={80} onChange={(v) => onChange({ effects: { ...effects, glow: { ...effects.glow, blur: v } } })} />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
            <LabeledField label="Outline">
              <IconToggleButton
                icon={Sparkles}
                active={!!effects.outline?.enabled}
                onClick={() => onChange({ effects: { ...effects, outline: { ...effects.outline, enabled: !effects.outline?.enabled } } })}
                title="Toggle outline"
              />
            </LabeledField>
            {effects.outline?.enabled && (
              <div className="flex flex-wrap items-center gap-2">
                <ColorField label="Color" value={effects.outline.color || "#000000"} onChange={(color) => onChange({ effects: { ...effects, outline: { ...effects.outline, color } } })} />
                <NumberField label="Thickness" value={effects.outline.width ?? 1} min={0} max={10} onChange={(v) => onChange({ effects: { ...effects, outline: { ...effects.outline, width: v } } })} />
              </div>
            )}
          </div>
        </div>
      </ToolbarPopover>
    </div>
  );
}
