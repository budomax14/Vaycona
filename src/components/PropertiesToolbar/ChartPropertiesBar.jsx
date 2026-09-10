import React, { useEffect, useState } from "react";
import { SlidersHorizontal, Table } from "lucide-react";
import { SliderField, ToolbarDivider } from "./toolbarUi";
import OverflowToolbar from "../OverflowToolbar/OverflowToolbar";
import ChartSettingsPanel from "./ChartSettingsPanel";
import ChartColorsPanel from "./ChartColorsPanel";
import ObjectMoreMenu from "./ObjectMoreMenu";
import { CHART_KINDS, getSliceColor } from "../../chartKinds";
import { useLanguage } from "../../languageContext";
import { OBJECT_PROPERTIES_STRINGS } from "../../i18n/objectProperties";

export default function ChartPropertiesBar({
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
  onEditChartData,
  chartStyleOpenRequest,
  animationPanelOpen,
  onToggleAnimationPanel,
  hasAnimations,
}) {
  const { language } = useLanguage();
  const t = OBJECT_PROPERTIES_STRINGS[language].chart;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isColorsOpen, setIsColorsOpen] = useState(false);

  // Double-clicking the chart on canvas bumps chartStyleOpenRequest (set
  // outside this component in App.jsx), so this just opens the panel
  // whenever that counter changes — mirrors ShapePropertiesBar's
  // shapeFillOpenRequest.
  useEffect(() => {
    if (chartStyleOpenRequest) setIsSettingsOpen(true);
  }, [chartStyleOpenRequest]);

  const isPie = (CHART_KINDS[item.chartKind]?.family || "bar") === "pie";
  const swatchColor = isPie ? getSliceColor(item, 0) : item.series?.[0]?.color || "#8b5cf6";

  return (
    <>
      <OverflowToolbar className="w-full" innerClassName="justify-start gap-3">
        <OverflowToolbar.Item keepOnMobile>
          <>
            <button
              type="button"
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-sm font-semibold text-white hover:bg-amber-700"
              onClick={onEditChartData}
            >
              <Table size={15} />
              {t.editData}
            </button>

            <span className="shrink-0 text-xs font-medium text-gray-400">{CHART_KINDS[item.chartKind]?.label || t.chartFallback}</span>
          </>
        </OverflowToolbar.Item>

        <OverflowToolbar.Item keepOnMobile>
          <>
            <ToolbarDivider />
            <button
              type="button"
              className={`h-8 w-10 shrink-0 cursor-pointer rounded-lg border p-0.5 ${isColorsOpen ? "border-amber-400 ring-2 ring-amber-100" : "border-gray-200"}`}
              style={{ background: swatchColor }}
              title={t.chartColors}
              aria-label={t.chartColors}
              onClick={() => setIsColorsOpen((v) => !v)}
            />
          </>
        </OverflowToolbar.Item>

        <OverflowToolbar.Item>
          <>
            <ToolbarDivider />
            <button
              type="button"
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${
                isSettingsOpen ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
              onClick={() => setIsSettingsOpen((v) => !v)}
            >
              <SlidersHorizontal size={15} />
              {t.style}
            </button>
          </>
        </OverflowToolbar.Item>

        <OverflowToolbar.Item>
          <>
            <ToolbarDivider />
            <SliderField label={t.opacity} value={item.opacity ?? 1} min={0.1} max={1} onChange={(value) => onChange({ opacity: value })} />
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

      <ChartSettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} item={item} onChange={onChange} />
      <ChartColorsPanel isOpen={isColorsOpen} onClose={() => setIsColorsOpen(false)} item={item} onChange={onChange} />
    </>
  );
}
