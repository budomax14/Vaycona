import React from "react";
import {
  AreaChart,
  Award,
  BarChart3,
  BarChartHorizontal,
  Circle,
  Diamond,
  Donut,
  Hexagon,
  Heart,
  LineChart,
  MessageSquare,
  Minus,
  MoveRight,
  MoveHorizontal,
  Pentagon,
  PieChart,
  Plus,
  RectangleHorizontal,
  Star,
  Triangle,
} from "lucide-react";
import { SHAPE_KIND_ORDER } from "../../../shapeKinds";
import { LINE_KIND_ORDER, LINE_KINDS } from "../../../lineKinds";
import { FRAME_KIND_ORDER, FRAME_KINDS } from "../../../frameKinds";
import { CHART_KIND_ORDER_AVAILABLE, CHART_KINDS } from "../../../chartKinds";
import { useLanguage } from "../../../languageContext";
import { PANEL_STRINGS } from "../../../i18n/panels";

const CHART_ICONS = {
  bar: BarChart3,
  barHorizontal: BarChartHorizontal,
  line: LineChart,
  area: AreaChart,
  pie: PieChart,
  donut: Donut,
};

const SHAPE_ICONS = {
  rectangle: RectangleHorizontal,
  roundedRectangle: RectangleHorizontal,
  circle: Circle,
  ellipse: Circle,
  oval: Circle,
  triangle: Triangle,
  diamond: Diamond,
  pentagon: Pentagon,
  hexagon: Hexagon,
  star: Star,
  speechBubble: MessageSquare,
  heart: Heart,
  cross: Plus,
  badge: Award,
  ring: Donut,
};

const LINE_ICONS = {
  straight: Minus,
  dashed: MoveHorizontal,
  dotted: MoveHorizontal,
  arrow: MoveRight,
  doubleArrow: MoveRight,
};

export default function ElementsPanel({ onAddShape, onAddLine, onAddFrame, onAddChart, onAddTable }) {
  const { language } = useLanguage();
  const t = PANEL_STRINGS[language].elements;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold text-gray-800">{t.title}</h3>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t.shapes}</span>
        <div className="grid grid-cols-3 gap-2">
          {SHAPE_KIND_ORDER.map((kind) => {
            const Icon = SHAPE_ICONS[kind];
            const label = t.shapeLabels[kind];
            return (
              <button
                key={kind}
                type="button"
                className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 py-4 text-gray-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
                onClick={() => onAddShape(kind)}
                title={label}
                aria-label={t.addShapeAria(label)}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t.linesAndArrows}</span>
        <div className="grid grid-cols-3 gap-2">
          {LINE_KIND_ORDER.map((kind) => {
            const Icon = LINE_ICONS[kind];
            return (
              <button
                key={kind}
                type="button"
                className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 py-4 text-gray-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
                onClick={() => onAddLine(kind)}
                title={LINE_KINDS[kind].label}
                aria-label={t.addAria(LINE_KINDS[kind].label)}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{LINE_KINDS[kind].label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t.charts}</span>
        <div className="grid grid-cols-3 gap-2">
          {CHART_KIND_ORDER_AVAILABLE.map((kind) => {
            const Icon = CHART_ICONS[kind];
            return (
              <button
                key={kind}
                type="button"
                className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 py-4 text-gray-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
                onClick={() => onAddChart(kind)}
                title={CHART_KINDS[kind].label}
                aria-label={t.addAria(CHART_KINDS[kind].label)}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{CHART_KINDS[kind].label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {onAddTable && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t.table}</span>
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
            onClick={() => onAddTable(3, 3)}
          >
            {t.addTable}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t.frames}</span>
        <div className="grid grid-cols-3 gap-2">
          {FRAME_KIND_ORDER.map((kind) => (
            <button
              key={kind}
              type="button"
              className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-4 text-gray-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
              onClick={() => onAddFrame(kind)}
              title={FRAME_KINDS[kind].label}
              aria-label={t.addAria(FRAME_KINDS[kind].label)}
            >
              <span className="text-[10px] font-medium">{FRAME_KINDS[kind].label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
