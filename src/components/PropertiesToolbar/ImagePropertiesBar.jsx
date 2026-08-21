import React, { useRef } from "react";
import { Crop, Grab, Maximize, Replace, Undo2 } from "lucide-react";
import { IconButton, NumberField, SliderField, ToolbarDivider } from "./toolbarUi";
import OverflowToolbar from "../OverflowToolbar/OverflowToolbar";
import ObjectMoreMenu from "./ObjectMoreMenu";
import FiltersPopover from "./FiltersPopover";
import FadePopover from "./FadePopover";
import ImageStylePicker from "./ImageStylePicker";
import { useAsset } from "../../useAsset";

export default function ImagePropertiesBar({
  item,
  unit,
  onChange,
  onReplaceImage,
  onDuplicate,
  onDelete,
  onForward,
  onBackward,
  onToggleLock,
  onToggleHidden,
  onAlignToPage,
  onEnterCropMode,
  onLiveAdjustments,
  onCommitAdjustments,
  onRestoreOriginalRatio,
  onResetImageEdits,
  onLiveFade,
  onCommitFade,
  onEnterFadeMode,
  isEditingFade,
  onEnterGrabItMode,
  isGrabItActive,
  brand,
  animationPanelOpen,
  onToggleAnimationPanel,
  hasAnimations,
}) {
  const fileInputRef = useRef(null);
  const { objectUrl } = useAsset(item.assetId);

  return (
    <OverflowToolbar className="w-full" innerClassName="justify-start gap-3">
      <OverflowToolbar.Item keepOnMobile>
        <>
          <IconButton icon={Crop} label="Crop" onClick={onEnterCropMode} disabled={!item.assetId} />

          <IconButton
            icon={Grab}
            label="Grab it"
            title="Pick a design from this image and turn it into its own element."
            onClick={onEnterGrabItMode}
            disabled={!item.assetId}
            active={isGrabItActive}
          />

          <IconButton icon={Replace} label="Replace" onClick={() => fileInputRef.current?.click()} />
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
        </>
      </OverflowToolbar.Item>

      <OverflowToolbar.Item>
        <>
          <ToolbarDivider />
          <SliderField
            label="Opacity"
            value={item.opacity ?? 1}
            min={0.1}
            max={1}
            onChange={(value) => onChange({ opacity: value })}
          />
          <NumberField
            label="Corner radius"
            value={item.cornerRadius || 0}
            min={0}
            max={100}
            onChange={(value) => onChange({ cornerRadius: value })}
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

          {brand && <ImageStylePicker style={brand.imageStyle} />}
        </>
      </OverflowToolbar.Item>

      <OverflowToolbar.Item>
        <>
          <ToolbarDivider />
          <IconButton icon={Maximize} label="Restore ratio" title="Restore original aspect ratio" onClick={onRestoreOriginalRatio} />
          <IconButton icon={Undo2} label="Reset edits" title="Reset image edits" onClick={onResetImageEdits} />
        </>
      </OverflowToolbar.Item>

      <OverflowToolbar.Item keepOnMobile>
        <>
          <ToolbarDivider />
          <ObjectMoreMenu
            showTransform
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
