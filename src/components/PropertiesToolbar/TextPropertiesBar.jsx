import React, { useState } from "react";
import { Bold, Check, Italic, Type, Underline } from "lucide-react";
import { IconButton, IconToggleButton, NumberField, SliderField, ToolbarDivider } from "./toolbarUi";
import FontFamilyPicker from "./FontFamilyPicker";
import TextColorPanel from "./TextColorPanel";
import TextAlignMenu from "./TextAlignMenu";
import TextListMenu from "./TextListMenu";
import TextEffectsMenu from "./TextEffectsMenu";
import TextCurveMenu from "./TextCurveMenu";
import TextMoreMenu from "./TextMoreMenu";
import { normalizeImageFill } from "../../imageFill";
import { useAsset } from "../../useAsset";

// Trimmed to the controls used on nearly every edit — font, size, bold/
// italic/underline, color, alignment, opacity, list, effects — everything
// else (strikethrough, vertical align, spacing, case, text box sizing,
// background/border, brand typography, format painter, arrange, transform)
// still lives one click away in TextMoreMenu, just not cluttering the main
// row anymore.
export default function TextPropertiesBar({
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
  isEditingText,
  onEditText,
  onApplyFormat,
  onApplyListFormat,
  onCopyTextStyle,
  onPasteTextStyle,
  hasCopiedTextStyle,
  onClearTextFormatting,
  onApplyProjectTextStyle,
  onEnterImageFillEditMode,
  onExitImageFillEditMode,
  brand,
}) {
  const [isColorPanelOpen, setIsColorPanelOpen] = useState(false);
  const colorBrand = brand?.colorField("fill");
  const { objectUrl: fillImagePreviewUrl } = useAsset(item.fillImage?.assetId);

  return (
    <>
      <IconToggleButton
        icon={isEditingText ? Check : Type}
        active={isEditingText}
        onClick={onEditText}
        title={isEditingText ? "Done editing" : "Edit text"}
      />

      <ToolbarDivider />

      <FontFamilyPicker value={item.fontFamily} onChange={(fontFamily) => onApplyFormat("fontFamily", fontFamily)} />

      <NumberField
        label="Size"
        value={item.fontSize || 24}
        min={1}
        max={800}
        onChange={(value) => onApplyFormat("fontSize", value)}
      />

      <ToolbarDivider />

      <IconToggleButton icon={Bold} active={item.fontWeight === "bold"} onClick={() => onApplyFormat("bold")} title="Bold (Cmd/Ctrl+B)" />
      <IconToggleButton icon={Italic} active={!!item.italic} onClick={() => onApplyFormat("italic")} title="Italic (Cmd/Ctrl+I)" />
      <IconToggleButton icon={Underline} active={!!item.underline} onClick={() => onApplyFormat("underline")} title="Underline (Cmd/Ctrl+U)" />

      <ToolbarDivider />

      <div className="relative shrink-0" data-text-toolbar-safe>
        <button
          type="button"
          className={`h-8 w-10 shrink-0 cursor-pointer rounded-lg border p-0.5 ${isColorPanelOpen ? "border-amber-400 ring-2 ring-amber-100" : "border-gray-200"}`}
          style={{ background: item.fillImage?.assetId || item.fillGradient ? undefined : item.fill || "#111827" }}
          title="Text color"
          aria-label="Text color"
          onClick={() => setIsColorPanelOpen((v) => !v)}
        >
          {item.fillImage?.assetId ? (
            fillImagePreviewUrl && (
              <span
                className="block h-full w-full rounded-md bg-cover bg-center"
                style={{ backgroundImage: `url(${fillImagePreviewUrl})` }}
              />
            )
          ) : item.fillGradient ? (
            <span
              className="block h-full w-full rounded-md"
              style={{ background: `linear-gradient(90deg, ${item.fillGradient.stops.map((s) => s.color).join(", ")})` }}
            />
          ) : null}
        </button>
      </div>

      <ToolbarDivider />

      <TextAlignMenu item={item} onChange={onChange} />

      <ToolbarDivider />

      <SliderField label="Opacity" value={item.opacity ?? 1} min={0.1} max={1} onChange={(value) => onChange({ opacity: value })} />

      <ToolbarDivider />

      <TextListMenu onApplyListFormat={onApplyListFormat} />
      <TextEffectsMenu item={item} onChange={onChange} />
      <TextCurveMenu item={item} onChange={onChange} />

      <ToolbarDivider />

      <TextMoreMenu
        item={item}
        unit={unit}
        onChange={onChange}
        onApplyFormat={onApplyFormat}
        onCopyTextStyle={onCopyTextStyle}
        onPasteTextStyle={onPasteTextStyle}
        hasCopiedTextStyle={hasCopiedTextStyle}
        onClearTextFormatting={onClearTextFormatting}
        onApplyProjectTextStyle={onApplyProjectTextStyle}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onForward={onForward}
        onBackward={onBackward}
        onToggleLock={onToggleLock}
        onToggleHidden={onToggleHidden}
        onAlignToPage={onAlignToPage}
        brand={brand}
      />

      <TextColorPanel
        isOpen={isColorPanelOpen}
        onClose={() => setIsColorPanelOpen(false)}
        solidValue={item.fill || "#111827"}
        gradientValue={item.fillGradient || null}
        imageValue={item.fillImage || null}
        imageBoxWidth={item.width}
        imageBoxHeight={item.height}
        onChangeSolid={(hex) => {
          if (item.fillGradient || item.fillImage) onChange({ fill: hex, fillGradient: undefined, fillImage: undefined });
          else onApplyFormat("color", hex);
        }}
        onChangeGradient={(gradient) => onChange({ fillGradient: gradient, fillImage: undefined })}
        onChangeImage={(patch) => onChange({ fillImage: { ...normalizeImageFill(item.fillImage), ...patch }, fillGradient: undefined })}
        onPickImageAsset={(assetId) => {
          const current = normalizeImageFill(item.fillImage);
          onChange({
            fillImage: { ...current, assetId, zoom: 1, offsetX: 0.5, offsetY: 0.5, rotation: 0 },
            fillGradient: undefined,
          });
        }}
        onRemoveImage={() => onChange({ fillImage: undefined })}
        onImageTabActiveChange={(isActive) => {
          if (isActive && item.fillImage?.assetId) onEnterImageFillEditMode?.();
          else onExitImageFillEditMode?.();
        }}
        tokenRef={colorBrand?.tokenRef}
        onApplyToken={colorBrand?.onApplyToken}
        onDetach={
          colorBrand?.onDetach
            ? () => {
                colorBrand.onDetach();
                setIsColorPanelOpen(false);
              }
            : undefined
        }
      />
    </>
  );
}
