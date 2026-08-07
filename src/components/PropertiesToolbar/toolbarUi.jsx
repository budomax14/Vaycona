import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Link2, Unlink } from "lucide-react";
import { useRecentColors } from "../../recentColorsContext";
import { useBrandKits } from "../../brandKitContext";
import { useDocumentColors } from "../../documentColorsContext";
import ToolbarPopover from "./ToolbarPopover";

export function ToolbarDivider() {
  return <div className="mx-1 h-7 w-px shrink-0 bg-gray-200" />;
}

export function IconButton({ icon: Icon, label, onClick, disabled, active, title }) {
  return (
    <button
      className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-30 ${
        active
          ? "bg-amber-100 text-amber-700"
          : "text-gray-600 hover:bg-gray-100"
      }`}
      onClick={onClick}
      disabled={disabled}
      title={title || label}
    >
      <Icon size={16} />
      {label && <span>{label}</span>}
    </button>
  );
}

export function IconToggleButton({ icon: Icon, active, onClick, title, disabled }) {
  return (
    <button
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-30 ${
        active ? "bg-amber-100 text-amber-700" : "text-gray-500 hover:bg-gray-100"
      }`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      <Icon size={15} />
    </button>
  );
}

export function LabeledField({ label, children, width }) {
  return (
    <div className="flex shrink-0 flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
      <div style={width ? { width } : undefined}>{children}</div>
    </div>
  );
}

// Local draft + commit-on-blur/Enter, same pattern as ObjectTransformFields'
// PrecisionField — a plain controlled <input> that calls onChange on every
// keystroke fights the user the moment the field needs to pass through an
// out-of-range intermediate state (e.g. clearing "24" to type "8": the
// empty string briefly parses as 0, upstream clamps it straight back to
// the field's min, and the input re-renders showing that clamped digit
// before the next keystroke lands — so the field never actually empties
// and a smaller value can never be typed). Committing only on blur/Enter
// lets the draft be anything mid-edit, including empty, without upstream
// clamping fighting the keystrokes.
export function NumberField({ label, value, onChange, min, max, step = 1, width = 64, mixed }) {
  const [draft, setDraft] = useState(() => (mixed ? "" : String(value ?? "")));
  const inputRef = useRef(null);

  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setDraft(mixed ? "" : String(value ?? ""));
  }, [value, mixed]);

  function clamp(n) {
    let v = n;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    return v;
  }

  function commit() {
    const n = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(n)) {
      setDraft(mixed ? "" : String(value ?? ""));
      return;
    }
    const clamped = clamp(n);
    setDraft(String(clamped));
    if (clamped !== value) onChange(clamped);
  }

  function bump(delta) {
    const base = draft.trim() !== "" && Number.isFinite(Number(draft)) ? Number(draft) : value ?? 0;
    const next = clamp(Math.round((base + delta) * 100) / 100);
    setDraft(String(next));
    onChange(next);
  }

  return (
    <LabeledField label={label} width={width}>
      <div
        className={`flex items-stretch overflow-hidden rounded-lg border bg-gray-50 focus-within:border-amber-400 focus-within:bg-white ${
          mixed ? "border-dashed border-gray-300" : "border-gray-200"
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          className="w-full min-w-0 bg-transparent px-2 py-1.5 text-sm text-gray-700 outline-none placeholder:text-gray-400"
          value={draft}
          placeholder={mixed ? "Mixed" : undefined}
          aria-label={label}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            else if (event.key === "Escape") setDraft(mixed ? "" : String(value ?? ""));
            else if (event.key === "ArrowUp") {
              event.preventDefault();
              bump(step);
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              bump(-step);
            }
          }}
        />
        <div className="flex shrink-0 flex-col border-l border-gray-200">
          <button
            type="button"
            tabIndex={-1}
            className="flex h-1/2 w-4 items-center justify-center text-gray-400 hover:bg-gray-200 hover:text-gray-700"
            onClick={() => bump(step)}
            aria-label={`Increase ${label}`}
          >
            <ChevronUp size={10} />
          </button>
          <button
            type="button"
            tabIndex={-1}
            className="flex h-1/2 w-4 items-center justify-center border-t border-gray-200 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
            onClick={() => bump(-step)}
            aria-label={`Decrease ${label}`}
          >
            <ChevronDown size={10} />
          </button>
        </div>
      </div>
    </LabeledField>
  );
}

export function SliderField({ label, value, onChange, min = 0, max = 1, step = 0.05, width = 90, mixed }) {
  return (
    <LabeledField label={label} width={width}>
      <input
        type="range"
        className="w-full accent-amber-600"
        value={mixed ? min : value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        title={mixed ? "Mixed" : undefined}
      />
    </LabeledField>
  );
}

// Like SliderField, but separates live drag updates from the single commit
// that should land in history — used for Phase 6 crop-zoom and image-
// adjustment sliders, where the spec explicitly calls for one grouped
// history entry per gesture rather than one per native `input` tick (the
// existing SliderField's every-tick-commits behavior stays as-is
// everywhere else in the app; this is an additive sibling, not a change to
// that shared, already-working component).
export function GroupedSliderField({ label, value, onLiveChange, onCommit, min = 0, max = 1, step = 0.05, width = 90, mixed }) {
  return (
    <LabeledField label={label} width={width}>
      <input
        type="range"
        className="w-full accent-amber-600"
        value={mixed ? min : value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onLiveChange(Number(event.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
        onKeyUp={onCommit}
        title={mixed ? "Mixed" : undefined}
      />
    </LabeledField>
  );
}

// Neutrals + a 5-shade (very light -> base -> very dark) row for every
// hue, so the picker reads as one coherent palette (rows) rather than a
// grab-bag of unrelated colors. Values match Tailwind's own color scale,
// matching every other color already used throughout this app's own UI
// (buttons, badges, etc.). Exported so other color surfaces (e.g. the
// text color panel's Solid tab) share this exact palette rather than each
// maintaining their own list.
export const NEUTRAL_SWATCHES = ["#000000", "#ffffff", "#f9fafb", "#f3f4f6", "#d1d5db", "#9ca3af", "#6b7280", "#4b5563", "#374151", "#111827"];

export const HUE_SWATCHES = [
  ["#fee2e2", "#fca5a5", "#ef4444", "#b91c1c", "#7f1d1d"], // red
  ["#ffedd5", "#fdba74", "#f97316", "#c2410c", "#7c2d12"], // orange
  ["#fef3c7", "#fcd34d", "#f59e0b", "#b45309", "#78350f"], // amber
  ["#fef9c3", "#fde047", "#eab308", "#a16207", "#713f12"], // yellow
  ["#ecfccb", "#bef264", "#84cc16", "#4d7c0f", "#365314"], // lime
  ["#dcfce7", "#86efac", "#22c55e", "#15803d", "#14532d"], // green
  ["#d1fae5", "#6ee7b7", "#10b981", "#047857", "#064e3b"], // emerald
  ["#ccfbf1", "#5eead4", "#14b8a6", "#0f766e", "#134e4a"], // teal
  ["#cffafe", "#67e8f9", "#06b6d4", "#0e7490", "#164e63"], // cyan
  ["#e0f2fe", "#7dd3fc", "#0ea5e9", "#0369a1", "#0c4a6e"], // sky
  ["#dbeafe", "#93c5fd", "#3b82f6", "#1d4ed8", "#1e3a8a"], // blue
  ["#e0e7ff", "#a5b4fc", "#6366f1", "#4338ca", "#312e81"], // indigo
  ["#ede9fe", "#c4b5fd", "#8b5cf6", "#6d28d9", "#4c1d95"], // violet
  ["#f3e8ff", "#d8b4fe", "#a855f7", "#7e22ce", "#581c87"], // purple
  ["#fae8ff", "#f0abfc", "#d946ef", "#a21caf", "#701a75"], // fuchsia
  ["#fce7f3", "#f9a8d4", "#ec4899", "#be185d", "#831843"], // pink
  ["#ffe4e6", "#fda4af", "#f43f5e", "#be123c", "#881337"], // rose
];

export const STARTER_PALETTE = [
  ...NEUTRAL_SWATCHES,
  ...HUE_SWATCHES.flatMap((shades) => shades),
];

function isValidHex(value) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

// The one, unified color-picker component used everywhere a color is
// edited (text/shape fill/border, line stroke, icon color, frame color,
// page background) — {label, value, onChange, mixed} is the whole public
// contract, unchanged from the plain <input type="color"> this replaces,
// so no call site needs to change. Recent colors are read/recorded via
// RecentColorsContext (see recentColorsContext.js) so every instance of
// this component shares one persisted, always-current list without any
// prop plumbing through intermediate components.
//
// Phase 11 additions (all optional, backward compatible): a "Brand colors"
// section sourced from the active brand kit, a "Document colors" section
// derived from the live project, and linked/detached tracking. A call site
// that wants a brand swatch pick to record a live token link (spec §14)
// passes `tokenRef` (the current link, or null) + `onApplyToken`/
// `onDetach`; a call site that only wants the value-copy behavior (every
// pre-existing call site) can omit them — brand swatches then just call
// `onChange(hex)` like any other swatch.
export function ColorField({ label, value, onChange, mixed, onReset, tokenRef, onApplyToken, onDetach }) {
  const [open, setOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState(value || "");
  const anchorRef = useRef(null);
  const { recentColors, recordColor } = useRecentColors();
  const { activeBrandKit } = useBrandKits();
  const documentColors = useDocumentColors();

  useEffect(() => {
    if (open) setHexDraft(mixed ? "" : value || "");
  }, [open, value, mixed]);

  function applyColor(hex) {
    onChange(hex);
    recordColor(hex);
  }

  function applyBrandColor(token) {
    if (onApplyToken) onApplyToken(token);
    else applyColor(token.hex);
    recordColor(token.hex);
  }

  const linkedToken = tokenRef && activeBrandKit?.id === tokenRef.brandKitId
    ? activeBrandKit?.colors.find((c) => c.id === tokenRef.tokenId)
    : null;
  const brandColors = activeBrandKit?.colors || [];

  return (
    <div className="relative shrink-0">
      <div ref={anchorRef} className="inline-flex">
        <LabeledField label={label}>
          <button
            type="button"
            className={`relative h-8 w-10 cursor-pointer rounded-lg border p-0.5 ${
              mixed ? "border-dashed border-gray-300 bg-[repeating-linear-gradient(45deg,#e5e7eb,#e5e7eb_4px,#ffffff_4px,#ffffff_8px)]" : "border-gray-200"
            }`}
            style={mixed ? undefined : { backgroundColor: value }}
            title={mixed ? "Mixed" : tokenRef ? `${value} — linked to ${linkedToken?.name || "a brand color"}` : value}
            aria-label={`${label}${/color/i.test(label) ? "" : " color"}${mixed ? " (mixed)" : ""}${tokenRef ? " (linked to brand color)" : ""}`}
            onClick={() => setOpen((v) => !v)}
          >
            {tokenRef && !mixed && (
              <Link2 size={9} className="absolute -right-1 -top-1 rounded-full bg-white text-amber-600" aria-hidden="true" />
            )}
          </button>
        </LabeledField>
      </div>

      <ToolbarPopover isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <div className="w-56 max-h-[75vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-gray-200 p-0.5"
              value={isValidHex(hexDraft) ? hexDraft : value || "#000000"}
              onChange={(event) => {
                setHexDraft(event.target.value);
                applyColor(event.target.value);
              }}
            />
            <input
              type="text"
              className="h-8 w-full rounded-md border border-gray-200 bg-gray-50 px-2 text-sm text-gray-700 outline-none focus:border-amber-400 focus:bg-white"
              value={hexDraft}
              placeholder={mixed ? "Mixed" : "#000000"}
              onChange={(event) => setHexDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && isValidHex(hexDraft)) applyColor(hexDraft);
              }}
              onBlur={() => {
                if (isValidHex(hexDraft)) applyColor(hexDraft);
              }}
            />
          </div>

          {tokenRef && onDetach && (
            <div className="mt-2 flex items-center justify-between rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
              <span className="flex items-center gap-1 truncate">
                <Link2 size={11} /> Linked{linkedToken ? `: ${linkedToken.name}` : " (missing token)"}
              </span>
              <button
                type="button"
                className="flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 font-semibold hover:bg-amber-100"
                onClick={() => {
                  onDetach();
                  setOpen(false);
                }}
              >
                <Unlink size={11} /> Detach
              </button>
            </div>
          )}

          {brandColors.length > 0 && (
            <>
              <div className="mt-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Brand colors
              </div>
              <div className="grid grid-cols-8 gap-1">
                {brandColors.map((token) => (
                  <button
                    key={token.id}
                    type="button"
                    className="h-5 w-5 rounded border border-gray-200"
                    style={{ backgroundColor: token.hex }}
                    title={`${token.name} (${token.hex})`}
                    aria-label={`Use brand color ${token.name}`}
                    onClick={() => applyBrandColor(token)}
                  />
                ))}
              </div>
            </>
          )}

          {documentColors.length > 0 && (
            <>
              <div className="mt-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Document colors
              </div>
              <div className="grid grid-cols-8 gap-1">
                {documentColors.map(({ hex }) => (
                  <button
                    key={hex}
                    type="button"
                    className="h-5 w-5 rounded border border-gray-200"
                    style={{ backgroundColor: hex }}
                    title={hex}
                    aria-label={`Use document color ${hex}`}
                    onClick={() => applyColor(hex)}
                  />
                ))}
              </div>
            </>
          )}

          {recentColors.length > 0 && (
            <>
              <div className="mt-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Recent
              </div>
              <div className="grid grid-cols-8 gap-1">
                {recentColors.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className="h-5 w-5 rounded border border-gray-200"
                    style={{ backgroundColor: hex }}
                    title={hex}
                    aria-label={`Use recent color ${hex}`}
                    onClick={() => applyColor(hex)}
                  />
                ))}
              </div>
            </>
          )}

          <div className="mt-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Palette
          </div>
          <div className="grid grid-cols-8 gap-1">
            {STARTER_PALETTE.map((hex) => (
              <button
                key={hex}
                type="button"
                className="h-5 w-5 rounded border border-gray-200"
                style={{ backgroundColor: hex }}
                title={hex}
                aria-label={`Use palette color ${hex}`}
                onClick={() => applyColor(hex)}
              />
            ))}
          </div>

          {onReset && (
            <button
              type="button"
              className="mt-3 w-full rounded-lg border border-gray-200 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50"
              onClick={() => {
                onReset();
                setOpen(false);
              }}
            >
              Reset to white
            </button>
          )}
        </div>
      </ToolbarPopover>
    </div>
  );
}
