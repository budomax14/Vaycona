import React, { useRef } from "react";
import { Crop, FlipHorizontal, FlipVertical, ImageOff, Replace, RotateCcw } from "lucide-react";
import { IconButton, IconToggleButton, LabeledField, NumberField, SliderField, ToolbarDivider } from "./toolbarUi";
import OverflowToolbar from "../OverflowToolbar/OverflowToolbar";
import ObjectMoreMenu from "./ObjectMoreMenu";
import FiltersPopover from "./FiltersPopover";
import FadePopover from "./FadePopover";
import { useAsset } from "../../useAsset";
import { FRAME_KIND_ORDER, FRAME_KINDS } from "../../frameKinds";

export default function FramePropertiesBar({
  item,
  unit,
  onChange,
  onDuplicate,
  onDelete,
  onForward,
  onBackward,
  onToggleLock,
  onToggleHidden,
  onAlignToPage,
  onReplaceImage,
  onRemoveFrameContent,
  onEnterCropMode,
  onLiveAdjustments,
  onCommitAdjustments,
  onResetImageEdits,
  onLiveFade,
  onCommitFade,
  onEnterFadeMode,
  isEditingFade,
  animationPanelOpen,
  onToggleAnimationPanel,
  hasAnimations,
}) {
  const fileInputRef = useRef(null);
  const { objectUrl } = useAsset(item.contentAssetId);
  const hasContent = !!item.contentAssetId;

  return (
    <OverflowToolbar className="w-full" innerClassName="justify-start gap-3">
      <OverflowToolbar.Item keepOnMobile>
        <LabeledField label="Frame shape">
          <select
            className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-700 outline-none focus:border-amber-400 focus:bg-white"
            value={item.frameKind}
            onChange={(event) => onChange({ frameKind: event.target.value })}
          >
            {FRAME_KIND_ORDER.map((kind) => (
              <option key={kind} value={kind}>
                {FRAME_KINDS[kind].label}
              </option>
            ))}
          </select>
        </LabeledField>
      </OverflowToolbar.Item>

      <OverflowToolbar.Item>
        <>
          <ToolbarDivider />
          <IconButton icon={Replace} label={hasContent ? "Replace image" : "Add image"} onClick={() => fileInputRef.current?.click()} />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onReplaceImage(file);
              event.target.value = "";
            }}
          />
          {hasContent && <IconButton icon={Crop} label="Edit content" onClick={onEnterCropMode} />}
          {hasContent && <IconButton icon={ImageOff} label="Remove" title="Remove image from frame" onClick={onRemoveFrameContent} />}
        </>
      </OverflowToolbar.Item>

      <OverflowToolbar.Item>
        <>
          <ToolbarDivider />
          <SliderField label="Opacity" value={item.opacity ?? 1} min={0.1} max={1} onChange={(value) => onChange({ opacity: value })} />
        </>
      </OverflowToolbar.Item>

      {hasContent && (
        <OverflowToolbar.Item>
          <>
            <ToolbarDivider />
            <IconToggleButton icon={FlipHorizontal} active={!!item.flipX} onClick={() => onChange({ flipX: !item.flipX })} title="Flip horizontal" />
            <IconToggleButton icon={FlipVertical} active={!!item.flipY} onClick={() => onChange({ flipY: !item.flipY })} title="Flip vertical" />
          </>
        </OverflowToolbar.Item>
      )}

      {hasContent && (
        <OverflowToolbar.Item>
          <>
            <ToolbarDivider />
            <FiltersPopover
              adjustments={item.adjustments}
              previewSrc={objectUrl}
              onChange={(adjustments) => onChange({ adjustments })}
              onLiveChange={onLiveAdjustments}
              onCommit={onCommitAdjustments}
            />

            <FadePopover
              opacityMask={item.opacityMask}
              onChange={(opacityMask) => onChange({ opacityMask })}
              onLiveChange={onLiveFade}
              onCommit={onCommitFade}
              onEnterEditMode={onEnterFadeMode}
              isEditingOnCanvas={isEditingFade}
            />
          </>
        </OverflowToolbar.Item>
      )}

      {hasContent && (
        <OverflowToolbar.Item>
          <>
            <ToolbarDivider />
            <IconButton icon={RotateCcw} label="Reset edits" title="Reset image edits" onClick={onResetImageEdits} />
          </>
        </OverflowToolbar.Item>
      )}

      <OverflowToolbar.Item keepOnMobile>
        <>
          <ToolbarDivider />
          <ObjectMoreMenu
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
            animationPanelOpen={animationPanelOpen}
            onToggleAnimationPanel={onToggleAnimationPanel}
            hasAnimations={hasAnimations}
          />
        </>
      </OverflowToolbar.Item>
    </OverflowToolbar>
  );
}
