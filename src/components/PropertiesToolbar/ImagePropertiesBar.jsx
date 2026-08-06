import React, { useRef } from "react";
import { Crop, Maximize, Replace, Undo2 } from "lucide-react";
import { IconButton, NumberField, SliderField, ToolbarDivider } from "./toolbarUi";
import ObjectTransformMenu from "./ObjectTransformMenu";
import TransformMenu from "./TransformMenu";
import FiltersPopover from "./FiltersPopover";
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
  brand,
}) {
  const fileInputRef = useRef(null);
  const { objectUrl } = useAsset(item.assetId);

  return (
    <>
      <ObjectTransformMenu
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

      <ToolbarDivider />

      <IconButton icon={Crop} label="Crop" onClick={onEnterCropMode} disabled={!item.assetId} />

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

      <ToolbarDivider />

      <TransformMenu item={item} onChange={onChange} />

      <ToolbarDivider />

      <FiltersPopover
        adjustments={item.adjustments}
        previewSrc={objectUrl}
        onChange={(adjustments) => onChange({ adjustments })}
        onLiveChange={onLiveAdjustments}
        onCommit={onCommitAdjustments}
      />

      {brand && <ImageStylePicker style={brand.imageStyle} />}

      <ToolbarDivider />

      <IconButton icon={Maximize} label="Restore ratio" title="Restore original aspect ratio" onClick={onRestoreOriginalRatio} />
      <IconButton icon={Undo2} label="Reset edits" title="Reset image edits" onClick={onResetImageEdits} />
    </>
  );
}
