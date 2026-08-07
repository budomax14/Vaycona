import React from "react";
import { ColorField, SliderField, ToolbarDivider } from "./toolbarUi";
import ObjectMoreMenu from "./ObjectMoreMenu";
import ObjectStylePicker from "./ObjectStylePicker";

export default function IconPropertiesBar({
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
  brand,
}) {
  return (
    <>
      <ColorField
        label="Color"
        value={item.fill || "#111827"}
        onChange={(value) => onChange({ fill: value })}
        {...(brand ? brand.colorField("fill") : {})}
      />

      {brand && <ObjectStylePicker compatibleWith="icon" style={brand.objectStyle} />}

      <ToolbarDivider />

      <SliderField
        label="Opacity"
        value={item.opacity ?? 1}
        min={0.1}
        max={1}
        onChange={(value) => onChange({ opacity: value })}
      />

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
      />
    </>
  );
}
