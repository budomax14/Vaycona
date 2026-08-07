import React, { useRef, useState } from "react";
import {
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignStartHorizontal,
  ClipboardCopy,
  ClipboardPaste,
  Eraser,
  FlipHorizontal,
  FlipVertical,
  MoreHorizontal,
  RotateCcw,
  RotateCw,
  Sparkles,
  Strikethrough,
} from "lucide-react";
import {
  ColorField,
  IconButton,
  IconToggleButton,
  LabeledField,
  NumberField,
  ToolbarDivider,
} from "./toolbarUi";
import ToolbarPopover from "./ToolbarPopover";
import ObjectTransformFields from "./ObjectTransformFields";
import AnimateMenuItem from "./AnimateMenuItem";
import { DEFAULT_PROJECT_TEXT_STYLES } from "../../textStyles";
import { useBrandKits } from "../../brandKitContext";
import { BORDER_STYLE_OPTIONS } from "../../borderStyles";

function Section({ title, children }) {
  return (
    <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{title}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

// Secondary text controls, collapsed into a popover to keep the main
// toolbar row from overflowing at smaller widths (spec section 33/41) —
// the essential controls (font, size, bold/italic/underline, color,
// align) stay directly on the bar; everything here is used less often.
export default function TextMoreMenu({
  item,
  unit,
  onChange,
  onApplyFormat,
  onCopyTextStyle,
  onPasteTextStyle,
  hasCopiedTextStyle,
  onClearTextFormatting,
  onApplyProjectTextStyle,
  onDuplicate,
  onDelete,
  onForward,
  onBackward,
  onToggleLock,
  onToggleHidden,
  onAlignToPage,
  brand,
  animationPanelOpen,
  onToggleAnimationPanel,
  hasAnimations,
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const { activeBrandKit } = useBrandKits();

  const background = item.background || {};
  const border = item.border || {};

  return (
    <div className="relative shrink-0" data-text-toolbar-safe>
      <div ref={anchorRef} className="inline-flex">
        <IconButton icon={MoreHorizontal} label="More" onClick={() => setOpen((v) => !v)} active={open} />
      </div>
      <ToolbarPopover isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)} align="right">
        <div className="flex max-h-[70vh] w-80 flex-col gap-3 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 shadow-lg" data-text-toolbar-safe>
          {onToggleAnimationPanel && (
            <AnimateMenuItem
              animationPanelOpen={animationPanelOpen}
              onToggleAnimationPanel={() => {
                setOpen(false);
                onToggleAnimationPanel();
              }}
              hasAnimations={hasAnimations}
            />
          )}

          <Section title="Arrange">
            <ObjectTransformFields
              item={item}
              unit={unit}
              onChange={onChange}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onForward={onForward}
              onBackward={onBackward}
              onToggleLock={onToggleLock}
              onToggleHidden={onToggleHidden}
              onAlignToPage={onAlignToPage}
            />
          </Section>

          <Section title="Transform">
            <IconToggleButton icon={FlipHorizontal} active={!!item.flipX} onClick={() => onChange({ flipX: !item.flipX })} title="Flip horizontal" />
            <IconToggleButton icon={FlipVertical} active={!!item.flipY} onClick={() => onChange({ flipY: !item.flipY })} title="Flip vertical" />
            <IconButton
              icon={RotateCcw}
              onClick={() => onChange({ rotation: (((item.rotation || 0) - 90) % 360 + 360) % 360 })}
              title="Rotate left 90°"
              aria-label="Rotate left 90 degrees"
            />
            <IconButton
              icon={RotateCw}
              onClick={() => onChange({ rotation: (((item.rotation || 0) + 90) % 360 + 360) % 360 })}
              title="Rotate right 90°"
              aria-label="Rotate right 90 degrees"
            />
          </Section>

          <Section title="Style">
            <IconToggleButton icon={Strikethrough} active={!!item.strikethrough} onClick={() => onApplyFormat("strikethrough")} title="Strikethrough" />
          </Section>

          <Section title="Vertical align">
            <IconToggleButton icon={AlignStartHorizontal} active={item.verticalAlign === "top"} onClick={() => onChange({ verticalAlign: "top" })} title="Top" />
            <IconToggleButton icon={AlignCenterHorizontal} active={(item.verticalAlign || "middle") === "middle"} onClick={() => onChange({ verticalAlign: "middle" })} title="Middle" />
            <IconToggleButton icon={AlignEndHorizontal} active={item.verticalAlign === "bottom"} onClick={() => onChange({ verticalAlign: "bottom" })} title="Bottom" />
          </Section>

          <Section title="Spacing (× font size / px)">
            <NumberField label="Line height" value={item.lineHeight ?? 1} step={0.1} min={0.5} max={3} onChange={(v) => onChange({ lineHeight: v })} />
            <NumberField label="Letter sp." value={item.letterSpacing ?? 0} step={0.5} min={-5} max={40} onChange={(v) => onChange({ letterSpacing: v })} />
            <NumberField label="Paragraph sp." value={item.paragraphSpacing ?? 0} step={1} min={0} max={80} onChange={(v) => onChange({ paragraphSpacing: v })} />
          </Section>

          <Section title="Case">
            {["none", "uppercase", "lowercase", "capitalize"].map((mode) => (
              <IconToggleButton
                key={mode}
                icon={() => <span className="text-[10px] font-bold">{mode === "none" ? "Aa" : mode === "uppercase" ? "AA" : mode === "lowercase" ? "aa" : "Aa."}</span>}
                active={(item.textTransform || "none") === mode}
                onClick={() => onChange({ textTransform: mode })}
                title={mode}
              />
            ))}
          </Section>

          <Section title="Text box sizing">
            {[
              { key: "auto-width", label: "Auto width" },
              { key: "auto-height", label: "Auto height" },
              { key: "fixed", label: "Fixed" },
            ].map((mode) => (
              <button
                key={mode.key}
                className={`rounded-lg border px-2 py-1 text-xs font-medium ${
                  (item.autoSize || "auto-height") === mode.key ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600"
                }`}
                onClick={() => onChange({ autoSize: mode.key })}
              >
                {mode.label}
              </button>
            ))}
          </Section>

          {item.autoSize === "fixed" && (
            <Section title="Overflow">
              <button
                className={`rounded-lg border px-2 py-1 text-xs font-medium ${(item.overflow || "clip") === "clip" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600"}`}
                onClick={() => onChange({ overflow: "clip" })}
              >
                Clip
              </button>
              <button
                className={`rounded-lg border px-2 py-1 text-xs font-medium ${item.overflow === "show" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600"}`}
                onClick={() => onChange({ overflow: "show" })}
              >
                Show overflow
              </button>
              <span className="text-[10px] text-gray-400">A small warning dot appears on overflow.</span>
            </Section>
          )}

          <Section title="Background">
            <IconToggleButton icon={Sparkles} active={!!background.enabled} onClick={() => onChange({ background: { ...background, enabled: !background.enabled } })} title="Toggle background" />
            {background.enabled && (
              <>
                <ColorField label="Color" value={background.color || "#ffffff"} onChange={(color) => onChange({ background: { ...background, color } })} />
                <NumberField label="Corner radius" value={background.cornerRadius || 0} min={0} max={100} onChange={(v) => onChange({ background: { ...background, cornerRadius: v } })} />
              </>
            )}
          </Section>

          <Section title="Border">
            <IconToggleButton icon={Sparkles} active={!!border.enabled} onClick={() => onChange({ border: { ...border, enabled: !border.enabled } })} title="Toggle border" />
            {border.enabled && (
              <>
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
              </>
            )}
          </Section>

          {activeBrandKit && brand?.typography && (
            <Section title="Brand typography">
              {activeBrandKit.typography.length === 0 && <p className="text-xs text-gray-400">No brand text styles yet.</p>}
              <div className="flex w-full flex-col gap-1">
                {activeBrandKit.typography.map((style) => {
                  const isLinked = brand.typography.ref?.brandKitId === activeBrandKit.id && brand.typography.ref?.styleId === style.id;
                  return (
                    <button
                      key={style.id}
                      className={`flex items-center justify-between rounded-lg border px-2 py-1.5 text-left text-xs ${isLinked ? "border-amber-300 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                      onClick={() => brand.typography.onApply(style.id)}
                    >
                      <span className="truncate font-medium">{style.name}</span>
                      {isLinked && <span className="text-[10px] font-semibold">Applied</span>}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button className="rounded-lg border border-dashed border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-500 hover:bg-gray-50" onClick={() => brand.typography.onCreateFromSelection()}>
                  + New from this text
                </button>
                {brand.typography.ref && (
                  <>
                    <button className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50" onClick={() => brand.typography.onUpdateFromSelection()}>
                      Update style from this text
                    </button>
                    <button className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50" onClick={() => brand.typography.onDetach()}>
                      Detach
                    </button>
                  </>
                )}
              </div>
            </Section>
          )}

          <Section title="Styles">
            <select
              className="h-8 rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm text-gray-700 outline-none focus:border-amber-400"
              defaultValue=""
              onChange={(event) => {
                const style = DEFAULT_PROJECT_TEXT_STYLES.find((s) => s.key === event.target.value);
                if (style) onApplyProjectTextStyle(style);
                event.target.value = "";
              }}
            >
              <option value="" disabled>
                Apply project style…
              </option>
              {DEFAULT_PROJECT_TEXT_STYLES.map((style) => (
                <option key={style.key} value={style.key}>
                  {style.label}
                </option>
              ))}
            </select>
          </Section>

          <Section title="Format painter">
            <IconButton icon={ClipboardCopy} label="Copy style" onClick={onCopyTextStyle} />
            <IconButton icon={ClipboardPaste} label="Paste style" onClick={onPasteTextStyle} disabled={!hasCopiedTextStyle} />
            <IconButton icon={Eraser} label="Clear formatting" onClick={onClearTextFormatting} />
          </Section>
        </div>
      </ToolbarPopover>
    </div>
  );
}
