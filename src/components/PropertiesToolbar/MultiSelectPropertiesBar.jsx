import React from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceBetween,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceBetween,
  ArrowDown,
  ArrowUp,
  FlipHorizontal,
  FlipVertical,
  Group,
  Trash2,
  Ungroup,
} from "lucide-react";
import { ColorField, IconButton, IconToggleButton, NumberField, SliderField, ToolbarDivider } from "./toolbarUi";
import { PrecisionField } from "./ObjectTransformFields";
import { computeSelectionControls } from "../../mixedSelection";
import { FILTER_PRESETS } from "../../imageEffects";
import { unionBounds, getItemBounds } from "../../bounds";

// A selected item is "image-like" if bulk flip/filter controls should
// apply to it — a standalone image, or a frame that currently has content
// (an empty frame has nothing to flip/filter). Per spec §51, crop and
// Replace stay single-selection-only actions, never exposed here.
function isImageLike(item) {
  return item.type === "image" || (item.type === "frame" && !!item.contentAssetId);
}

// Only a handful of controls make sense to expose in a mixed selection —
// arbitrary/type-specific ones (lineKind, fontFamily, textAlign) are left
// out even if shared, since a dropdown/align-button row reads oddly next
// to plain arrange controls. Fill/stroke/numeric/opacity are the safe,
// universally-meaningful set.
const FIELD_WIDGETS = {
  fill: { Widget: ColorField, props: { label: "Fill" } },
  stroke: { Widget: ColorField, props: { label: "Color" } },
  strokeWidth: { Widget: NumberField, props: { label: "Thickness", min: 0, max: 40 } },
  cornerRadius: { Widget: NumberField, props: { label: "Corner radius", min: 0, max: 100 } },
  fontSize: { Widget: NumberField, props: { label: "Size", min: 8, max: 220 } },
  opacity: { Widget: SliderField, props: { label: "Opacity", min: 0.1, max: 1 } },
};

export default function MultiSelectPropertiesBar({
  items,
  count,
  unit,
  canDistribute,
  hasGroupedSelection,
  onUpdateItems,
  onTransformBounds,
  onAlign,
  onDistribute,
  onForward,
  onBackward,
  onGroup,
  onUngroup,
  onDelete,
  onBulkFlip,
  onBulkFilterPreset,
}) {
  const rows = (items ? computeSelectionControls(items) : []).filter((row) => FIELD_WIDGETS[row.key]);
  const imageLikeIds = items ? items.filter(isImageLike).map((item) => item.id) : [];
  const allImageLike = items && items.length > 0 && imageLikeIds.length === items.length;
  const groupBounds = items && items.length > 0 ? unionBounds(items.map(getItemBounds)) : null;

  return (
    <>
      <span className="shrink-0 rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">
        {count} objects selected
      </span>

      {groupBounds && onTransformBounds && (
        <>
          <PrecisionField label="X" valuePx={groupBounds.left} unit={unit} width={56} onCommitPx={(px) => onTransformBounds({ x: px })} />
          <PrecisionField label="Y" valuePx={groupBounds.top} unit={unit} width={56} onCommitPx={(px) => onTransformBounds({ y: px })} />
          <PrecisionField label="Width" valuePx={groupBounds.width} unit={unit} min={1} width={56} onCommitPx={(px) => onTransformBounds({ width: Math.max(1, px) })} />
          <PrecisionField label="Height" valuePx={groupBounds.height} unit={unit} min={1} width={56} onCommitPx={(px) => onTransformBounds({ height: Math.max(1, px) })} />
        </>
      )}

      {rows.length > 0 && <ToolbarDivider />}

      {rows.map(({ key, field, value, mixed }) => {
        const { Widget, props } = FIELD_WIDGETS[key];
        return (
          <Widget
            key={key}
            {...props}
            value={mixed ? "" : value}
            mixed={mixed}
            onChange={(next) => onUpdateItems(items.map((item) => item.id), { [field]: next })}
          />
        );
      })}

      <ToolbarDivider />

      <IconToggleButton icon={AlignStartVertical} onClick={() => onAlign("left")} title="Align left" />
      <IconToggleButton icon={AlignCenterVertical} onClick={() => onAlign("center-h")} title="Align center" />
      <IconToggleButton icon={AlignEndVertical} onClick={() => onAlign("right")} title="Align right" />
      <IconToggleButton icon={AlignStartHorizontal} onClick={() => onAlign("top")} title="Align top" />
      <IconToggleButton icon={AlignCenterHorizontal} onClick={() => onAlign("middle-v")} title="Align middle" />
      <IconToggleButton icon={AlignEndHorizontal} onClick={() => onAlign("bottom")} title="Align bottom" />

      <ToolbarDivider />

      <IconToggleButton
        icon={AlignHorizontalSpaceBetween}
        onClick={() => onDistribute("horizontal")}
        title="Distribute horizontally"
        disabled={!canDistribute}
      />
      <IconToggleButton
        icon={AlignVerticalSpaceBetween}
        onClick={() => onDistribute("vertical")}
        title="Distribute vertically"
        disabled={!canDistribute}
      />

      <ToolbarDivider />

      <IconButton icon={ArrowUp} label="Forward" onClick={onForward} />
      <IconButton icon={ArrowDown} label="Backward" onClick={onBackward} />

      {allImageLike && (
        <>
          <ToolbarDivider />
          <IconToggleButton icon={FlipHorizontal} onClick={() => onBulkFlip(imageLikeIds, "x")} title="Flip horizontal (all selected)" />
          <IconToggleButton icon={FlipVertical} onClick={() => onBulkFlip(imageLikeIds, "y")} title="Flip vertical (all selected)" />
          <select
            className="shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-600 outline-none"
            defaultValue=""
            onChange={(event) => {
              const preset = FILTER_PRESETS.find((p) => p.key === event.target.value);
              if (preset) onBulkFilterPreset(imageLikeIds, preset.adjustments);
              event.target.value = "";
            }}
          >
            <option value="" disabled>
              Apply filter…
            </option>
            {FILTER_PRESETS.map((preset) => (
              <option key={preset.key} value={preset.key}>
                {preset.label}
              </option>
            ))}
          </select>
        </>
      )}

      <ToolbarDivider />

      <IconButton icon={Group} label="Group" onClick={onGroup} />
      {hasGroupedSelection && <IconButton icon={Ungroup} label="Ungroup" onClick={onUngroup} />}

      <ToolbarDivider />

      <IconButton icon={Trash2} label="Delete" onClick={onDelete} />
    </>
  );
}
