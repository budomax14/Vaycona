import React, { useEffect, useState } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  ArrowDown,
  ArrowUp,
  Copy,
  Crosshair,
  Eye,
  EyeOff,
  Lock,
  Trash2,
  Unlock,
} from "lucide-react";
import { IconButton, IconToggleButton, LabeledField, ToolbarDivider } from "./toolbarUi";
import { formatBareValue, parseMeasurementInput, unitLabel } from "../../measurement";

// Anchor grid — which corner/edge/center of the object numeric width/height
// edits hold fixed (spec §54). Purely a local tool-mode setting (not
// persisted), defaulting to top-left so existing behavior (width/height
// grow from x/y unchanged) is exactly preserved unless the user picks a
// different anchor.
const ANCHORS = [
  ["top-left", "top-center", "top-right"],
  ["center-left", "center", "center-right"],
  ["bottom-left", "bottom-center", "bottom-right"],
];

function anchorFactor(anchor) {
  const [v, h] = anchor.includes("-") ? anchor.split("-") : ["center", "center"];
  const fx = h === "left" ? 0 : h === "right" ? 1 : h === "center" && anchor === "center" ? 0.5 : 0.5;
  const fy = v === "top" ? 0 : v === "bottom" ? 1 : 0.5;
  // "center-left"/"center-right" put v=center, h=left/right; "top-center"/
  // "bottom-center" put v=top/bottom, h=center — both handled by the
  // generic center fallback above since only exact "center" needs fx=0.5
  // from the h slot too.
  if (anchor === "center-left") return { fx: 0, fy: 0.5 };
  if (anchor === "center-right") return { fx: 1, fy: 0.5 };
  if (anchor === "top-center") return { fx: 0.5, fy: 0 };
  if (anchor === "bottom-center") return { fx: 0.5, fy: 1 };
  return { fx, fy };
}

// Recomputes x/y so the chosen anchor point stays fixed on screen while
// width/height change — e.g. anchor "center" keeps the object centered as
// it grows/shrinks instead of always growing from the top-left corner.
export function applyAnchoredResize(item, changes, anchor) {
  if (!anchor || anchor === "top-left" || (changes.width === undefined && changes.height === undefined)) {
    return changes;
  }
  const { fx, fy } = anchorFactor(anchor);
  const next = { ...changes };
  if (changes.width !== undefined) {
    next.x = item.x - (changes.width - item.width) * fx;
  }
  if (changes.height !== undefined) {
    next.y = item.y - (changes.height - item.height) * fy;
  }
  return next;
}

// Local draft + commit-on-blur/Enter field (spec §51/§52/§115: typing must
// not push a history entry per keystroke — only the final committed value
// does). Accepts optional unit-aware parsing ("2in" etc.) for x/y/width/
// height; rotation always stays in degrees regardless of the display unit.
export function PrecisionField({ label, valuePx, unit, min, onCommitPx, allowUnitSuffix = true, suffix, width = 64 }) {
  const [draft, setDraft] = useState(() => (allowUnitSuffix ? formatBareValue(valuePx, unit) : String(Math.round(valuePx * 100) / 100)));

  useEffect(() => {
    setDraft(allowUnitSuffix ? formatBareValue(valuePx, unit) : String(Math.round(valuePx * 100) / 100));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuePx, unit]);

  function commit() {
    let px;
    if (allowUnitSuffix) {
      const parsed = parseMeasurementInput(draft, unit);
      if (!parsed.ok) {
        setDraft(formatBareValue(valuePx, unit));
        return;
      }
      px = parsed.px;
    } else {
      const n = Number(draft);
      if (!Number.isFinite(n)) {
        setDraft(String(valuePx));
        return;
      }
      px = n;
    }
    if (min !== undefined) px = Math.max(min, px);
    onCommitPx(px);
  }

  return (
    <LabeledField label={label} width={width}>
      <input
        type="text"
        inputMode="decimal"
        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-700 outline-none focus:border-amber-400 focus:bg-white"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setDraft(allowUnitSuffix ? formatBareValue(valuePx, unit) : String(valuePx));
        }}
        aria-label={suffix ? `${label} (${suffix})` : label}
      />
    </LabeledField>
  );
}

export default function ObjectTransformFields({
  item,
  unit = "px",
  onChange,
  onDuplicate,
  onDelete,
  onForward,
  onBackward,
  onToggleLock,
  onToggleHidden,
  onAlignToPage,
}) {
  const [anchor, setAnchor] = useState("top-left");

  function commitResize(changes) {
    onChange(applyAnchoredResize(item, changes, anchor));
  }

  return (
    <>
      <PrecisionField label="X" valuePx={item.x} unit={unit} suffix={unitLabel(unit)} onCommitPx={(px) => onChange({ x: px })} />
      <PrecisionField label="Y" valuePx={item.y} unit={unit} suffix={unitLabel(unit)} onCommitPx={(px) => onChange({ y: px })} />
      <PrecisionField label="Width" valuePx={item.width} unit={unit} min={1} suffix={unitLabel(unit)} onCommitPx={(px) => commitResize({ width: Math.max(1, px) })} />
      <PrecisionField label="Height" valuePx={item.height} unit={unit} min={1} suffix={unitLabel(unit)} onCommitPx={(px) => commitResize({ height: Math.max(1, px) })} />
      <PrecisionField
        label="Rotate °"
        valuePx={((item.rotation || 0) % 360 + 360) % 360}
        unit="px"
        allowUnitSuffix={false}
        onCommitPx={(deg) => onChange({ rotation: ((deg % 360) + 360) % 360 })}
      />

      <LabeledField label="Anchor" width={54}>
        <div className="grid grid-cols-3 gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5" role="radiogroup" aria-label="Resize anchor">
          {ANCHORS.flat().map((key) => (
            <button
              key={key}
              type="button"
              className={`h-3.5 w-3.5 rounded-sm border ${anchor === key ? "border-amber-500 bg-amber-500" : "border-gray-300 bg-white hover:border-amber-300"}`}
              onClick={() => setAnchor(key)}
              role="radio"
              aria-checked={anchor === key}
              aria-label={key.replace("-", " ")}
              title={key.replace("-", " ")}
            />
          ))}
        </div>
      </LabeledField>

      <ToolbarDivider />

      <IconToggleButton
        icon={item.locked ? Lock : Unlock}
        active={!!item.locked}
        onClick={onToggleLock}
        title={item.locked ? "Unlock" : "Lock"}
      />
      <IconToggleButton
        icon={item.hidden ? EyeOff : Eye}
        active={!!item.hidden}
        onClick={onToggleHidden}
        title={item.hidden ? "Show" : "Hide"}
      />
      <IconButton icon={Copy} onClick={onDuplicate} title="Duplicate" aria-label="Duplicate" />
      <IconButton icon={ArrowUp} onClick={onForward} title="Bring forward" aria-label="Bring forward" />
      <IconButton icon={ArrowDown} onClick={onBackward} title="Send backward" aria-label="Send backward" />
      <IconButton icon={Trash2} onClick={onDelete} title="Delete" aria-label="Delete" />

      {onAlignToPage && (
        <>
          <ToolbarDivider />
          <IconButton
            icon={AlignCenterHorizontal}
            onClick={() => onAlignToPage("center-h")}
            title="Center horizontally on page"
            aria-label="Center horizontally on page"
          />
          <IconButton
            icon={AlignCenterVertical}
            onClick={() => onAlignToPage("center-v")}
            title="Center vertically on page"
            aria-label="Center vertically on page"
          />
          <IconButton
            icon={Crosshair}
            onClick={() => onAlignToPage("center-both")}
            title="Center on page"
            aria-label="Center on page"
          />
        </>
      )}
    </>
  );
}
