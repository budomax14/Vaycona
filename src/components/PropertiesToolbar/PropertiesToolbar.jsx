import React from "react";
import { Sparkles } from "lucide-react";
import CanvasPropertiesBar from "./CanvasPropertiesBar";
import MultiSelectPropertiesBar from "./MultiSelectPropertiesBar";
import CropModePropertiesBar from "./CropModePropertiesBar";
import { getPropertiesBar } from "../../objectRegistry";

export default function PropertiesToolbar({
  selectedItems,
  background,
  unit,
  onBackgroundChange,
  pageBorder,
  onPageBorderChange,
  onUpdateItem,
  onUpdateItems,
  onReplaceImage,
  onRemoveFrameContent,
  hasGroupedSelection,
  onAlign,
  onDistribute,
  onAlignToPage,
  onForward,
  onBackward,
  onGroup,
  onUngroup,
  onDelete,
  onDuplicate,
  onToggleLock,
  onToggleHidden,
  onMoveGroupBy,
  onSetGroupOpacity,
  editingTextId,
  onEditText,
  onExitTextEdit,
  onApplyFormat,
  onApplyListFormat,
  onCopyTextStyle,
  onPasteTextStyle,
  hasCopiedTextStyle,
  onClearTextFormatting,
  onApplyProjectTextStyle,
  // Phase 6 — crop mode + image/frame editing
  croppingItemId,
  croppingNaturalSize,
  onEnterCropMode,
  onCropCommit,
  onZoomLiveChange,
  onZoomCommit,
  onSetCropAspect,
  onApplyCrop,
  onCancelCrop,
  onResetCrop,
  onLiveAdjustments,
  onCommitAdjustments,
  onRestoreOriginalRatio,
  onResetImageEdits,
  onBulkFlip,
  onBulkFilterPreset,
  onTransformBounds,
  // Image Fill for text — on-canvas drag-to-reposition mode, mirroring
  // crop mode's shape (see App.jsx's imageFillEditItemId block).
  onEnterImageFillEditMode,
  onExitImageFillEditMode,
  // Phase 11 — brand color/style linking (all optional; see App.jsx's
  // buildBrandBarProps). Bundled into one `brand` prop per selected item
  // rather than a dozen more individual props threaded through every Bar.
  onApplyBrandColorField,
  onDetachBrandColorField,
  onApplyObjectStyle,
  onCreateObjectStyleFromSelection,
  onDetachObjectStyle,
  onApplyImageStyle,
  onCreateImageStyleFromSelection,
  onDetachImageStyle,
  onApplyTypographyStyle,
  onCreateTypographyFromSelection,
  onUpdateTypographyFromSelection,
  onDetachTypographyStyle,
  // Phase 12 — Animation panel toggle. Deliberately NOT threaded through
  // every per-type Bar (registry rule 3/6: one centralized animation UI,
  // not one implemented per object component) — a single button here
  // covers every animatable type/selection shape at once.
  animationPanelOpen,
  onToggleAnimationPanel,
  hasAnimations,
}) {
  const single = selectedItems.length === 1 ? selectedItems[0] : null;

  if (single && croppingItemId === single.id) {
    return (
      <div data-crop-toolbar-safe className="flex h-16 shrink-0 items-center gap-3 overflow-x-auto border-b border-gray-200 bg-white px-4">
        <CropModePropertiesBar
          item={single}
          naturalWidth={croppingNaturalSize?.width || 0}
          naturalHeight={croppingNaturalSize?.height || 0}
          onCropCommit={(crop) => onCropCommit(single.id, crop)}
          onZoomLiveChange={(zoom) => onZoomLiveChange(single.id, zoom)}
          onZoomCommit={onZoomCommit}
          onSetAspect={(ratio) => onSetCropAspect(single.id, ratio)}
          onApply={onApplyCrop}
          onCancel={onCancelCrop}
          onReset={() => onResetCrop(single.id)}
        />
      </div>
    );
  }

  const transformProps = single && {
    item: single,
    unit,
    onDuplicate,
    onDelete,
    onForward,
    onBackward,
    onToggleLock,
    onToggleHidden,
  };
  const Bar = single && getPropertiesBar(single.type);
  const isImageLike = single && (single.type === "image" || single.type === "frame");

  // One bundle per selected item, built fresh each render (cheap plain
  // closures) — Bars destructure only the pieces they use (colorField for
  // Shape/Text/Icon, objectStyle for Shape/Icon, imageStyle for Image,
  // typography for Text).
  const brand = single && {
    colorField: (fieldPath) => ({
      tokenRef: single.colorLinks?.[fieldPath] || null,
      onApplyToken: (token) => onApplyBrandColorField(single.id, fieldPath, token),
      onDetach: () => onDetachBrandColorField(single.id, fieldPath),
    }),
    objectStyle: {
      ref: single.objectStyleRef || null,
      onApply: (styleId) => onApplyObjectStyle(single.id, styleId),
      onCreateFromSelection: () => onCreateObjectStyleFromSelection(single.id),
      onDetach: () => onDetachObjectStyle(single.id),
    },
    imageStyle: {
      ref: single.imageStyleRef || null,
      onApply: (styleId) => onApplyImageStyle(single.id, styleId),
      onCreateFromSelection: () => onCreateImageStyleFromSelection(single.id),
      onDetach: () => onDetachImageStyle(single.id),
    },
    typography: {
      ref: single.typographyStyleRef || null,
      onApply: (styleId) => onApplyTypographyStyle(single.id, styleId),
      onCreateFromSelection: () => onCreateTypographyFromSelection(single.id),
      onUpdateFromSelection: () => onUpdateTypographyFromSelection(single.id),
      onDetach: () => onDetachTypographyStyle(single.id),
    },
  };

  return (
    <div
      data-text-toolbar-safe
      className="flex h-16 shrink-0 items-center gap-3 overflow-x-auto border-b border-gray-200 bg-white px-4"
    >
      {selectedItems.length === 0 && (
        <CanvasPropertiesBar
          background={background}
          onBackgroundChange={onBackgroundChange}
          border={pageBorder}
          onBorderChange={onPageBorderChange}
        />
      )}

      {single && Bar && (
        <Bar
          {...transformProps}
          onChange={(changes) => onUpdateItem(single.id, changes)}
          onAlignToPage={onAlignToPage}
          brand={brand}
          onReplaceImage={isImageLike ? (file) => onReplaceImage(single.id, file) : undefined}
          onRemoveFrameContent={single.type === "frame" ? () => onRemoveFrameContent(single.id) : undefined}
          onEnterCropMode={isImageLike ? () => onEnterCropMode(single.id) : undefined}
          onLiveAdjustments={isImageLike ? (adjustments) => onLiveAdjustments(single.id, adjustments) : undefined}
          onCommitAdjustments={onCommitAdjustments}
          onRestoreOriginalRatio={single.type === "image" ? () => onRestoreOriginalRatio(single.id) : undefined}
          onResetImageEdits={isImageLike ? () => onResetImageEdits(single.id) : undefined}
          isEditingText={single.type === "text" && editingTextId === single.id}
          onEditText={
            single.type === "text"
              ? () => (editingTextId === single.id ? onExitTextEdit() : onEditText(single.id))
              : undefined
          }
          onApplyFormat={single.type === "text" ? (key, value) => onApplyFormat(single.id, key, value) : undefined}
          onApplyListFormat={single.type === "text" ? (listType) => onApplyListFormat(single.id, listType) : undefined}
          onCopyTextStyle={single.type === "text" ? () => onCopyTextStyle(single.id) : undefined}
          onPasteTextStyle={single.type === "text" ? () => onPasteTextStyle(single.id) : undefined}
          hasCopiedTextStyle={hasCopiedTextStyle}
          onClearTextFormatting={single.type === "text" ? () => onClearTextFormatting(single.id) : undefined}
          onApplyProjectTextStyle={single.type === "text" ? (style) => onApplyProjectTextStyle(single.id, style) : undefined}
          onEnterImageFillEditMode={
            single.type === "text" || single.type === "shape" ? () => onEnterImageFillEditMode(single.id) : undefined
          }
          onExitImageFillEditMode={single.type === "text" || single.type === "shape" ? onExitImageFillEditMode : undefined}
          onUngroup={single.type === "group" ? onUngroup : undefined}
          onMoveBy={single.type === "group" ? (dx, dy) => onMoveGroupBy(single.id, dx, dy) : undefined}
          onSetGroupOpacity={single.type === "group" ? (value) => onSetGroupOpacity(single.id, value) : undefined}
        />
      )}

      {selectedItems.length > 1 && (
        <MultiSelectPropertiesBar
          items={selectedItems}
          count={selectedItems.length}
          unit={unit}
          canDistribute={selectedItems.length >= 3}
          hasGroupedSelection={hasGroupedSelection}
          onUpdateItems={onUpdateItems}
          onTransformBounds={onTransformBounds}
          onAlign={onAlign}
          onDistribute={onDistribute}
          onForward={onForward}
          onBackward={onBackward}
          onGroup={onGroup}
          onUngroup={onUngroup}
          onDelete={onDelete}
          onBulkFlip={onBulkFlip}
          onBulkFilterPreset={onBulkFilterPreset}
        />
      )}

      {selectedItems.length >= 1 && (
        <button
          type="button"
          onClick={onToggleAnimationPanel}
          className={`ml-auto flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium transition-colors ${
            animationPanelOpen
              ? "border-amber-300 bg-amber-50 text-amber-700"
              : hasAnimations
                ? "border-amber-200 bg-white text-amber-600 hover:bg-amber-50"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          }`}
          title="Animate"
          aria-pressed={animationPanelOpen}
        >
          <Sparkles size={15} />
          Animate
        </button>
      )}
    </div>
  );
}
