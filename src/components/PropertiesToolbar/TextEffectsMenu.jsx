import React, { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { ColorField, IconButton, IconToggleButton, LabeledField, NumberField } from "./toolbarUi";
import ResponsiveSheet from "../ResponsiveSheet/ResponsiveSheet";
import { BORDER_STYLE_OPTIONS } from "../../borderStyles";

// Promoted out of TextMoreMenu.jsx to a top-level toolbar control (shadow/
// glow/outline are common enough to earn their own button). Same
// onChange({ effects }) contract as before — nothing about how effects are
// stored or rendered changed, only where the controls live. Opens via
// ResponsiveSheet (an anchored, portalled ToolbarPopover on tablet/desktop;
// a bottom sheet on mobile) — PropertiesToolbar's row clips ordinary
// anchored dropdowns, see ToolbarPopover's own comment.
//
// Outline color/thickness route through onApplyFormat (same "color"
// command TextColorPanel.jsx already uses) instead of always calling
// onChange directly: App.jsx's applyTextFormat dispatches to a per-run
// DOM edit when there's an active text selection (per-letter outline —
// richText.js's run.outlineColor/outlineWidth), or to the whole-object
// item.effects.outline when there isn't. onChange is kept as a fallback
// for any caller that doesn't wire onApplyFormat.
export default function TextEffectsMenu({ item, onChange, onApplyFormat }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const effects = item.effects || {};
  const background = item.background || {};
  const border = item.border || {};

  const hasAnyEffect = !!(
    effects.shadow?.enabled ||
    effects.glow?.enabled ||
    effects.outline?.enabled ||
    background.enabled ||
    border.enabled
  );

  return (
    <div className="relative shrink-0" data-text-toolbar-safe>
      <div ref={anchorRef} className="inline-flex">
        <IconButton icon={Sparkles} label="Effects" onClick={() => setOpen((v) => !v)} active={open || hasAnyEffect} />
      </div>
      <ResponsiveSheet isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
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
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <ColorField
                    label="Color"
                    value={effects.outline.color || "#000000"}
                    onChange={(color) =>
                      onApplyFormat
                        ? onApplyFormat("outlineColor", color)
                        : onChange({ effects: { ...effects, outline: { ...effects.outline, color } } })
                    }
                  />
                  <NumberField
                    label="Thickness"
                    value={effects.outline.width ?? 1}
                    min={0}
                    max={10}
                    onChange={(v) =>
                      onApplyFormat
                        ? onApplyFormat("outlineWidth", v)
                        : onChange({ effects: { ...effects, outline: { ...effects.outline, width: v } } })
                    }
                  />
                </div>
                {onApplyFormat && (
                  <p className="text-[11px] leading-snug text-gray-400">
                    Tip: select specific letters while editing text, then change the color/thickness here to border just that selection.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
            <LabeledField label="Background">
              <IconToggleButton
                icon={Sparkles}
                active={!!background.enabled}
                onClick={() => onChange({ background: { ...background, enabled: !background.enabled } })}
                title="Toggle background"
              />
            </LabeledField>
            {background.enabled && (
              <div className="flex flex-wrap items-center gap-2">
                <ColorField label="Color" value={background.color || "#ffffff"} onChange={(color) => onChange({ background: { ...background, color } })} />
                <NumberField label="Corner radius" value={background.cornerRadius || 0} min={0} max={100} onChange={(v) => onChange({ background: { ...background, cornerRadius: v } })} />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
            <LabeledField label="Border">
              <IconToggleButton
                icon={Sparkles}
                active={!!border.enabled}
                onClick={() => onChange({ border: { ...border, enabled: !border.enabled } })}
                title="Toggle border"
              />
            </LabeledField>
            {border.enabled && (
              <div className="flex flex-wrap items-center gap-2">
                <ColorField label="Color" value={border.color || "#111827"} onChange={(color) => onChange({ border: { ...border, color } })} />
                <NumberField label="Width" value={border.width ?? 1} min={0} max={20} onChange={(v) => onChange({ border: { ...border, width: v } })} />
                <select
                  className="h-8 shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm text-gray-700 outline-none focus:border-amber-400 focus:bg-white"
                  aria-label="Border style"
                  value={border.style || "solid"}
                  onChange={(event) => onChange({ border: { ...border, style: event.target.value } })}
                >
                  {BORDER_STYLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </ResponsiveSheet>
    </div>
  );
}
