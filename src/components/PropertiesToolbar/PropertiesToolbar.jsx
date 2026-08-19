import React from "react";
import CanvasPropertiesBar from "./CanvasPropertiesBar";
import MultiSelectPropertiesBar from "./MultiSelectPropertiesBar";
import CropModePropertiesBar from "./CropModePropertiesBar";
import GrabItModePropertiesBar from "./GrabItModePropertiesBar";
import SelectionMoreMenu from "./SelectionMoreMenu";
import { getPropertiesBar } from "../../objectRegistry";
import { ensureRichText, measureAutoHeight } from "../../richText";

// Mirrors App.jsx's own handleTransformEnd rule for a horizontal-only
// canvas drag: typing an exact width into the Position & Size panel is the
// same "user manually resized the box horizontally" gesture, so it gets
// the same auto-height reflow (never a font-size change) rather than
// silently leaving the box too short/tall for its rewrapped content.
function textUsesAutoHeight(item) {
  return !!item && item.type === "text" && !item.curve && item.autoSize !== "fixed" && item.autoSize !== "auto-width";
}

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
  groupChildren,
  onDistributeGroupChildren,
  onToggleLockSpacing,
  onFillGroupWithImage,
  editingTextId,
  onEditText,
  onExitTextEdit,
  onEditChartData,
  tableEdit,
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
  // Fade / opacity mask — mirrors onLiveAdjustments/onCommitAdjustments'
  // shape; onEnterFadeMode/fadeEditItemId mirror crop mode's on-canvas
  // edit-mode toggle (see App.jsx's own "Fade mode" section).
  fadeEditItemId,
  onLiveFade,
  onCommitFade,
  onEnterFadeMode,
  // Grab It — on-canvas "pick a design out of this image" mode. Mirrors
  // crop mode's whole-row toolbar swap (see the croppingItemId branch
  // below) rather than fade's inline popover, since it's a full mode with
  // its own status/settings, not a quick per-field edit.
  grabItEditItemId,
  onToggleGrabItMode,
  grabIt,
  onDoneGrabIt,
  // Image Fill for text — on-canvas drag-to-reposition mode, mirroring
  // crop mode's shape (see App.jsx's imageFillEditItemId block).
  onEnterImageFillEditMode,
  onExitImageFillEditMode,
  shapeFillOpenRequest,
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

  if (single && grabItEditItemId === single.id) {
    return (
      <div data-grab-it-toolbar-safe className="flex h-16 shrink-0 items-center gap-3 overflow-x-auto border-b border-gray-200 bg-white px-4">
        <GrabItModePropertiesBar
          regionCount={grabIt?.regions?.length || 0}
          isDetecting={!!grabIt?.isDetecting}
          error={grabIt?.error}
          sensitivity={grabIt?.sensitivity ?? 0.5}
          onSensitivityChange={grabIt?.setSensitivity}
          mergeAmount={grabIt?.mergeAmount ?? 0.5}
          onMergeAmountChange={grabIt?.setMergeAmount}
          showAllRegions={!!grabIt?.showAllRegions}
          onToggleShowAllRegions={grabIt?.setShowAllRegions}
          onResetDetection={grabIt?.resetDetection}
          onDone={onDoneGrabIt}
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
          onChange={(changes) => {
            if (changes.width !== undefined && changes.height === undefined && textUsesAutoHeight(single)) {
              changes = { ...changes, height: measureAutoHeight({ ...single, width: changes.width }, ensureRichText(single)) };
            }
            onUpdateItem(single.id, changes);
          }}
          onAlignToPage={onAlignToPage}
          brand={brand}
          onReplaceImage={isImageLike ? (file) => onReplaceImage(single.id, file) : undefined}
          onRemoveFrameContent={single.type === "frame" ? () => onRemoveFrameContent(single.id) : undefined}
          onEnterCropMode={isImageLike ? () => onEnterCropMode(single.id) : undefined}
          onLiveAdjustments={isImageLike ? (adjustments) => onLiveAdjustments(single.id, adjustments) : undefined}
          onCommitAdjustments={onCommitAdjustments}
          onRestoreOriginalRatio={single.type === "image" ? () => onRestoreOriginalRatio(single.id) : undefined}
          onResetImageEdits={isImageLike ? () => onResetImageEdits(single.id) : undefined}
          onLiveFade={isImageLike || single.type === "shape" ? (opacityMask) => onLiveFade(single.id, opacityMask) : undefined}
          onCommitFade={isImageLike || single.type === "shape" ? onCommitFade : undefined}
          onEnterFadeMode={isImageLike || single.type === "shape" ? () => onEnterFadeMode(single.id) : undefined}
          isEditingFade={fadeEditItemId === single.id}
          onEnterGrabItMode={single.type === "image" ? () => onToggleGrabItMode(single.id) : undefined}
          isGrabItActive={grabItEditItemId === single.id}
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
          onEditChartData={single.type === "chart" ? () => onEditChartData(single.id) : undefined}
          tableEdit={single.type === "table" ? tableEdit : undefined}
          onApplyProjectTextStyle={single.type === "text" ? (style) => onApplyProjectTextStyle(single.id, style) : undefined}
          onEnterImageFillEditMode={
            single.type === "text" || single.type === "shape" ? () => onEnterImageFillEditMode(single.id) : undefined
          }
          onExitImageFillEditMode={single.type === "text" || single.type === "shape" ? onExitImageFillEditMode : undefined}
          shapeFillOpenRequest={single.type === "shape" ? shapeFillOpenRequest : undefined}
          onUngroup={single.type === "group" ? onUngroup : undefined}
          onMoveBy={single.type === "group" ? (dx, dy) => onMoveGroupBy(single.id, dx, dy) : undefined}
          onSetGroupOpacity={single.type === "group" ? (value) => onSetGroupOpacity(single.id, value) : undefined}
          groupChildren={single.type === "group" ? groupChildren : undefined}
          onDistributeChildren={
            single.type === "group" ? (axis, gapPx) => onDistributeGroupChildren(single.id, axis, gapPx) : undefined
          }
          onToggleLockSpacing={single.type === "group" ? () => onToggleLockSpacing(single.id) : undefined}
          onFillWithImage={single.type === "group" ? (assetId) => onFillGroupWithImage(single.id, assetId) : undefined}
          animationPanelOpen={single.type !== "group" ? animationPanelOpen : undefined}
          onToggleAnimationPanel={single.type !== "group" ? onToggleAnimationPanel : undefined}
          hasAnimations={single.type !== "group" ? hasAnimations : undefined}
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
          animationPanelOpen={animationPanelOpen}
          onToggleAnimationPanel={onToggleAnimationPanel}
          hasAnimations={hasAnimations}
        />
      )}

      {/* Fallback for a selected group, which has no per-type More menu of
          its own — the multi-select case renders its own SelectionMoreMenu
          inline (next to Group/Ungroup) inside MultiSelectPropertiesBar
          instead; single shape/icon/frame/image/text selections get
          Animate folded into their own Bar's More menu above. So there is
          never more than one "More" button in the row at once. */}
      {single && single.type === "group" && (
        <SelectionMoreMenu
          animationPanelOpen={animationPanelOpen}
          onToggleAnimationPanel={onToggleAnimationPanel}
          hasAnimations={hasAnimations}
        />
      )}
    </div>
  );
}
