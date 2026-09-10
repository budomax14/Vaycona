import React, { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  ImageIcon,
  Lock,
  Magnet,
  Trash2,
  Ungroup as UngroupIcon,
  Unlock,
} from "lucide-react";
import { IconButton, IconToggleButton, LabeledField, NumberField, SliderField, ToolbarDivider } from "./toolbarUi";
import OverflowToolbar from "../OverflowToolbar/OverflowToolbar";
import { computeCurrentGap, inferDistributeAxis } from "../../alignment";
import ImageAssetPickerModal from "../ImageAssetPickerModal";
import { useLanguage } from "../../languageContext";
import { OBJECT_PROPERTIES_STRINGS } from "../../i18n/objectProperties";

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
  groupChildren = [],
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
  onDistributeChildren,
  onToggleLockSpacing,
  onFillWithImage,
}) {
  // Smart Spacing (spec §5/§6) — only meaningful once the group actually
  // has 2+ direct children to space out. Axis is whatever's already
  // locked in, or inferred from how the children are laid out.
  const { language } = useLanguage();
  const t = OBJECT_PROPERTIES_STRINGS[language].group;
  const canSpace = groupChildren.length >= 2;
  const spacingAxis = item.lockSpacing?.axis || (canSpace ? inferDistributeAxis(groupChildren) : "horizontal");
  const gapValue = item.lockSpacing?.gap ?? (canSpace ? computeCurrentGap(groupChildren, spacingAxis) : null);

  // Collage fill (§9 follow-up) — one photo split across every
  // fillable (shape/text) descendant of the group. Needs at least one
  // fillable child; the picker itself is a plain asset-pick modal, same
  // one ShapePropertiesBar's own image fill uses.
  const canFillWithImage = !!onFillWithImage && groupChildren.some((c) => c.type === "shape" || c.type === "text");
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  return (
    <>
      <OverflowToolbar className="w-full" innerClassName="justify-start gap-3">
        <OverflowToolbar.Item keepOnMobile>
          <LabeledField label={t.name} width={140}>
            <input
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-700 outline-none focus:border-amber-400 focus:bg-white"
              value={item.name || t.defaultName}
              maxLength={80}
              onChange={(event) => onChange({ name: event.target.value })}
            />
          </LabeledField>
        </OverflowToolbar.Item>

        <OverflowToolbar.Item>
          <>
            <ToolbarDivider />
            <NumberField label={t.x} value={Math.round(item.x)} onChange={(value) => onMoveBy(value - item.x, 0)} />
            <NumberField label={t.y} value={Math.round(item.y)} onChange={(value) => onMoveBy(0, value - item.y)} />
            <NumberField label={t.width} value={Math.round(item.width)} width={64} onChange={() => {}} />
            <NumberField label={t.height} value={Math.round(item.height)} width={64} onChange={() => {}} />
          </>
        </OverflowToolbar.Item>

        <OverflowToolbar.Item>
          <>
            <ToolbarDivider />
            <IconToggleButton
              icon={item.locked ? Lock : Unlock}
              active={!!item.locked}
              onClick={onToggleLock}
              title={item.locked ? t.unlockGroup : t.lockGroup}
            />
            <IconToggleButton
              icon={item.hidden ? EyeOff : Eye}
              active={!!item.hidden}
              onClick={onToggleHidden}
              title={item.hidden ? t.showGroup : t.hideGroup}
            />
            <IconButton icon={Copy} onClick={onDuplicate} title={t.duplicate} aria-label={t.duplicate} />
            <IconButton icon={ArrowUp} onClick={onForward} title={t.bringForward} aria-label={t.bringForward} />
            <IconButton icon={ArrowDown} onClick={onBackward} title={t.sendBackward} aria-label={t.sendBackward} />
            <IconButton icon={Trash2} onClick={onDelete} title={t.delete} aria-label={t.delete} />
          </>
        </OverflowToolbar.Item>

        <OverflowToolbar.Item>
          <>
            <ToolbarDivider />
            <SliderField label={t.opacity} value={item.opacity ?? 1} min={0.1} max={1} onChange={onSetGroupOpacity} />
          </>
        </OverflowToolbar.Item>

        {canSpace && (
          <OverflowToolbar.Item>
            <>
              <ToolbarDivider />
              <NumberField
                label={t.gap}
                value={gapValue != null ? Math.round(gapValue) : 0}
                min={0}
                width={64}
                onChange={(value) => onDistributeChildren(spacingAxis, Math.max(0, value))}
              />
              <IconToggleButton
                icon={Magnet}
                active={!!item.lockSpacing}
                onClick={onToggleLockSpacing}
                title={item.lockSpacing ? t.unlockSpacing : t.lockSpacing}
              />
            </>
          </OverflowToolbar.Item>
        )}

        {canFillWithImage && (
          <OverflowToolbar.Item>
            <>
              <ToolbarDivider />
              <IconButton icon={ImageIcon} label={t.fillWithImage} onClick={() => setIsPickerOpen(true)} />
            </>
          </OverflowToolbar.Item>
        )}

        <OverflowToolbar.Item keepOnMobile>
          <>
            <ToolbarDivider />
            <IconButton icon={UngroupIcon} label={t.ungroup} onClick={onUngroup} />
          </>
        </OverflowToolbar.Item>
      </OverflowToolbar>

      {canFillWithImage && (
        <ImageAssetPickerModal
          isOpen={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          onPick={(assetId) => {
            setIsPickerOpen(false);
            onFillWithImage(assetId);
          }}
        />
      )}
    </>
  );
}
