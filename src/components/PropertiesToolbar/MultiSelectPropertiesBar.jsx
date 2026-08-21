import React from "react";
import { ArrowDown, ArrowUp, Group, Trash2, Ungroup } from "lucide-react";
import { ColorField, IconButton, NumberField, SliderField, ToolbarDivider } from "./toolbarUi";
import OverflowToolbar from "../OverflowToolbar/OverflowToolbar";
import PositionMenu from "./PositionMenu";
import AlignMenu from "./AlignMenu";
import DistributeMenu from "./DistributeMenu";
import ImageAdjustMenu from "./ImageAdjustMenu";
import SelectionMoreMenu from "./SelectionMoreMenu";
import { computeSelectionControls } from "../../mixedSelection";
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
  animationPanelOpen,
  onToggleAnimationPanel,
  hasAnimations,
}) {
  const rows = (items ? computeSelectionControls(items) : []).filter((row) => FIELD_WIDGETS[row.key]);
  const imageLikeIds = items ? items.filter(isImageLike).map((item) => item.id) : [];
  const allImageLike = items && items.length > 0 && imageLikeIds.length === items.length;
  const groupBounds = items && items.length > 0 ? unionBounds(items.map(getItemBounds)) : null;

  return (
    <OverflowToolbar className="w-full" innerClassName="justify-start gap-3">
      <OverflowToolbar.Item keepOnMobile>
        <span className="shrink-0 rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">
          {count} objects selected
        </span>
      </OverflowToolbar.Item>

      {/* Position menu + the dynamic per-field widgets (fill/stroke/etc.)
          are grouped as one unit since their count/composition varies with
          whatever's actually shared across the current mixed selection. */}
      <OverflowToolbar.Item>
        <>
          {groupBounds && onTransformBounds && (
            <>
              <PositionMenu bounds={groupBounds} unit={unit} onTransformBounds={onTransformBounds} />
              {rows.length > 0 && <ToolbarDivider />}
            </>
          )}

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
        </>
      </OverflowToolbar.Item>

      <OverflowToolbar.Item>
        <>
          <ToolbarDivider />
          {/* §5/§6 Smart Spacing + arrange controls are grouped one-button-per-
              cluster (AlignMenu/DistributeMenu/ImageAdjustMenu) rather than
              loose on the row — this bar gets crowded fast once several
              multi-select items overlap. */}
          <AlignMenu onAlign={onAlign} />
          <DistributeMenu items={items} canDistribute={canDistribute} onDistribute={onDistribute} />
        </>
      </OverflowToolbar.Item>

      <OverflowToolbar.Item>
        <>
          <ToolbarDivider />
          <IconButton icon={ArrowUp} label="Forward" onClick={onForward} />
          <IconButton icon={ArrowDown} label="Backward" onClick={onBackward} />
        </>
      </OverflowToolbar.Item>

      {allImageLike && (
        <OverflowToolbar.Item>
          <>
            <ToolbarDivider />
            <ImageAdjustMenu imageLikeIds={imageLikeIds} onBulkFlip={onBulkFlip} onBulkFilterPreset={onBulkFilterPreset} />
          </>
        </OverflowToolbar.Item>
      )}

      <OverflowToolbar.Item keepOnMobile>
        <>
          <ToolbarDivider />
          <IconButton icon={Group} label="Group" onClick={onGroup} />
          {hasGroupedSelection && <IconButton icon={Ungroup} label="Ungroup" onClick={onUngroup} />}
          <SelectionMoreMenu
            animationPanelOpen={animationPanelOpen}
            onToggleAnimationPanel={onToggleAnimationPanel}
            hasAnimations={hasAnimations}
            pushRight={false}
          />
        </>
      </OverflowToolbar.Item>

      <OverflowToolbar.Item keepOnMobile>
        <>
          <ToolbarDivider />
          <IconButton icon={Trash2} label="Delete" onClick={onDelete} />
        </>
      </OverflowToolbar.Item>
    </OverflowToolbar>
  );
}
