import React from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Trash2,
  Ungroup as UngroupIcon,
  Unlock,
} from "lucide-react";
import { IconButton, IconToggleButton, LabeledField, NumberField, SliderField, ToolbarDivider } from "./toolbarUi";

// A group has no independent visual footprint (see hierarchy.js) — its
// x/y/width/height are DERIVED from its children's union bounds, so only
// X/Y are exposed as an editable "move the whole group" control here;
// width/height are read-only display (resizing is done via the shared
// Transformer's drag handles, which already move/scale every descendant
// as one rigid unit). Opacity has no real composited Konva node to apply
// to, so it's implemented as a direct bulk-set onto every descendant leaf
// (not a reversible per-child override, unlike lock/hidden) — documented
// tradeoff, not a silent inconsistency.
export default function GroupPropertiesBar({
  item,
  onChange,
  onMoveBy,
  onSetGroupOpacity,
  onDuplicate,
  onDelete,
  onForward,
  onBackward,
  onToggleLock,
  onToggleHidden,
  onUngroup,
}) {
  return (
    <>
      <LabeledField label="Name" width={140}>
        <input
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-700 outline-none focus:border-amber-400 focus:bg-white"
          value={item.name || "Group"}
          maxLength={80}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </LabeledField>

      <ToolbarDivider />

      <NumberField label="X" value={Math.round(item.x)} onChange={(value) => onMoveBy(value - item.x, 0)} />
      <NumberField label="Y" value={Math.round(item.y)} onChange={(value) => onMoveBy(0, value - item.y)} />
      <NumberField label="Width" value={Math.round(item.width)} width={64} onChange={() => {}} />
      <NumberField label="Height" value={Math.round(item.height)} width={64} onChange={() => {}} />

      <ToolbarDivider />

      <IconToggleButton
        icon={item.locked ? Lock : Unlock}
        active={!!item.locked}
        onClick={onToggleLock}
        title={item.locked ? "Unlock group" : "Lock group"}
      />
      <IconToggleButton
        icon={item.hidden ? EyeOff : Eye}
        active={!!item.hidden}
        onClick={onToggleHidden}
        title={item.hidden ? "Show group" : "Hide group"}
      />
      <IconButton icon={Copy} onClick={onDuplicate} title="Duplicate" aria-label="Duplicate" />
      <IconButton icon={ArrowUp} onClick={onForward} title="Bring forward" aria-label="Bring forward" />
      <IconButton icon={ArrowDown} onClick={onBackward} title="Send backward" aria-label="Send backward" />
      <IconButton icon={Trash2} onClick={onDelete} title="Delete" aria-label="Delete" />

      <ToolbarDivider />

      <SliderField label="Opacity" value={item.opacity ?? 1} min={0.1} max={1} onChange={onSetGroupOpacity} />

      <ToolbarDivider />

      <IconButton icon={UngroupIcon} label="Ungroup" onClick={onUngroup} />
    </>
  );
}
