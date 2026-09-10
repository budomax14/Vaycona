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
  Strikethrough,
} from "lucide-react";
import {
  IconButton,
  IconToggleButton,
  NumberField,
  ToolbarDivider,
} from "./toolbarUi";
import ResponsiveSheet from "../ResponsiveSheet/ResponsiveSheet";
import ObjectTransformFields from "./ObjectTransformFields";
import AnimateMenuItem from "./AnimateMenuItem";
import { DEFAULT_PROJECT_TEXT_STYLES } from "../../textStyles";
import { useBrandKits } from "../../brandKitContext";
import { useLanguage } from "../../languageContext";
import { TEXT_PROPERTIES_STRINGS } from "../../i18n/textProperties";

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
  const { language } = useLanguage();
  const t = TEXT_PROPERTIES_STRINGS[language].textMore;
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const { activeBrandKit } = useBrandKits();

  return (
    <div className="relative shrink-0" data-text-toolbar-safe>
      <div ref={anchorRef} className="inline-flex">
        <IconButton icon={MoreHorizontal} label={t.more} onClick={() => setOpen((v) => !v)} active={open} />
      </div>
      <ResponsiveSheet isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)} align="right">
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

          <Section title={t.arrange}>
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

          <Section title={t.transform}>
            <IconToggleButton icon={FlipHorizontal} active={!!item.flipX} onClick={() => onChange({ flipX: !item.flipX })} title={t.flipHorizontal} />
            <IconToggleButton icon={FlipVertical} active={!!item.flipY} onClick={() => onChange({ flipY: !item.flipY })} title={t.flipVertical} />
            <IconButton
              icon={RotateCcw}
              onClick={() => onChange({ rotation: (((item.rotation || 0) - 90) % 360 + 360) % 360 })}
              title={t.rotateLeft}
              aria-label={t.rotateLeftAria}
            />
            <IconButton
              icon={RotateCw}
              onClick={() => onChange({ rotation: (((item.rotation || 0) + 90) % 360 + 360) % 360 })}
              title={t.rotateRight}
              aria-label={t.rotateRightAria}
            />
          </Section>

          <Section title={t.style}>
            <IconToggleButton icon={Strikethrough} active={!!item.strikethrough} onClick={() => onApplyFormat("strikethrough")} title={t.strikethrough} />
          </Section>

          {/* CurvedTextNode always centers arc text both ways and never
              reads verticalAlign — showing this control for curved text
              would let it look "active" while doing nothing. */}
          {!item.curve && (
            <Section title={t.verticalAlign}>
              <IconToggleButton icon={AlignStartHorizontal} active={item.verticalAlign === "top"} onClick={() => onChange({ verticalAlign: "top" })} title={t.top} />
              <IconToggleButton icon={AlignCenterHorizontal} active={(item.verticalAlign || "middle") === "middle"} onClick={() => onChange({ verticalAlign: "middle" })} title={t.middle} />
              <IconToggleButton icon={AlignEndHorizontal} active={item.verticalAlign === "bottom"} onClick={() => onChange({ verticalAlign: "bottom" })} title={t.bottom} />
            </Section>
          )}

          <Section title={t.spacing}>
            <NumberField label={t.lineHeight} value={item.lineHeight ?? 1} step={0.1} min={0.5} max={3} onChange={(v) => onChange({ lineHeight: v })} />
            <NumberField label={t.letterSpacing} value={item.letterSpacing ?? 0} step={0.5} min={-5} max={40} onChange={(v) => onChange({ letterSpacing: v })} />
            <NumberField label={t.paragraphSpacing} value={item.paragraphSpacing ?? 0} step={1} min={0} max={80} onChange={(v) => onChange({ paragraphSpacing: v })} />
          </Section>

          <Section title={t.caseSection}>
            {[
              { key: "none", title: t.caseNone },
              { key: "uppercase", title: t.caseUppercase },
              { key: "lowercase", title: t.caseLowercase },
              { key: "capitalize", title: t.caseCapitalize },
            ].map((mode) => (
              <IconToggleButton
                key={mode.key}
                icon={() => <span className="text-[10px] font-bold">{mode.key === "none" ? "Aa" : mode.key === "uppercase" ? "AA" : mode.key === "lowercase" ? "aa" : "Aa."}</span>}
                active={(item.textTransform || "none") === mode.key}
                onClick={() => onChange({ textTransform: mode.key })}
                title={mode.title}
              />
            ))}
          </Section>

          <Section title={t.textBoxSizing}>
            {[
              { key: "auto-width", label: t.autoWidth },
              { key: "auto-height", label: t.autoHeight },
              { key: "fixed", label: t.fixed },
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
            <Section title={t.overflow}>
              <button
                className={`rounded-lg border px-2 py-1 text-xs font-medium ${(item.overflow || "clip") === "clip" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600"}`}
                onClick={() => onChange({ overflow: "clip" })}
              >
                {t.clip}
              </button>
              <button
                className={`rounded-lg border px-2 py-1 text-xs font-medium ${item.overflow === "show" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600"}`}
                onClick={() => onChange({ overflow: "show" })}
              >
                {t.showOverflow}
              </button>
              <span className="text-[10px] text-gray-400">{t.overflowWarning}</span>
            </Section>
          )}

          {activeBrandKit && brand?.typography && (
            <Section title={t.brandTypography}>
              {activeBrandKit.typography.length === 0 && <p className="text-xs text-gray-400">{t.noBrandTextStyles}</p>}
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
                      {isLinked && <span className="text-[10px] font-semibold">{t.applied}</span>}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button className="rounded-lg border border-dashed border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-500 hover:bg-gray-50" onClick={() => brand.typography.onCreateFromSelection()}>
                  {t.newFromThisText}
                </button>
                {brand.typography.ref && (
                  <>
                    <button className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50" onClick={() => brand.typography.onUpdateFromSelection()}>
                      {t.updateStyleFromSelection}
                    </button>
                    <button className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50" onClick={() => brand.typography.onDetach()}>
                      {t.detach}
                    </button>
                  </>
                )}
              </div>
            </Section>
          )}

          <Section title={t.styles}>
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
                {t.applyProjectStyle}
              </option>
              {DEFAULT_PROJECT_TEXT_STYLES.map((style) => (
                <option key={style.key} value={style.key}>
                  {style.label}
                </option>
              ))}
            </select>
          </Section>

          <Section title={t.formatPainter}>
            <IconButton icon={ClipboardCopy} label={t.copyStyle} onClick={onCopyTextStyle} />
            <IconButton icon={ClipboardPaste} label={t.pasteStyle} onClick={onPasteTextStyle} disabled={!hasCopiedTextStyle} />
            <IconButton icon={Eraser} label={t.clearFormatting} onClick={onClearTextFormatting} />
          </Section>
        </div>
      </ResponsiveSheet>
    </div>
  );
}
