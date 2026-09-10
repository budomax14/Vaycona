import React from "react";
import { ColorField, SliderField, ToolbarDivider } from "./toolbarUi";
import OverflowToolbar from "../OverflowToolbar/OverflowToolbar";
import ObjectMoreMenu from "./ObjectMoreMenu";
import ObjectStylePicker from "./ObjectStylePicker";
import { useLanguage } from "../../languageContext";
import { OBJECT_PROPERTIES_STRINGS } from "../../i18n/objectProperties";

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
  animationPanelOpen,
  onToggleAnimationPanel,
  hasAnimations,
}) {
  const { language } = useLanguage();
  const t = OBJECT_PROPERTIES_STRINGS[language].icon;
  return (
    <OverflowToolbar className="w-full" innerClassName="justify-start gap-3">
      <OverflowToolbar.Item keepOnMobile>
        <ColorField
          label={t.color}
          value={item.fill || "#111827"}
          onChange={(value) => onChange({ fill: value })}
          {...(brand ? brand.colorField("fill") : {})}
        />
      </OverflowToolbar.Item>

      {brand && (
        <OverflowToolbar.Item>
          <ObjectStylePicker compatibleWith="icon" style={brand.objectStyle} />
        </OverflowToolbar.Item>
      )}

      <OverflowToolbar.Item>
        <>
          <ToolbarDivider />
          <SliderField
            label={t.opacity}
            value={item.opacity ?? 1}
            min={0.1}
            max={1}
            onChange={(value) => onChange({ opacity: value })}
          />
        </>
      </OverflowToolbar.Item>

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
