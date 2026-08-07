import React from "react";
import { AreaChart, BarChart3, BarChartHorizontal, Donut, LineChart, PieChart } from "lucide-react";
import { CHART_KIND_ORDER_AVAILABLE, CHART_KINDS } from "../../../chartKinds";

const CHART_ICONS = {
  bar: BarChart3,
  barHorizontal: BarChartHorizontal,
  line: LineChart,
  area: AreaChart,
  pie: PieChart,
  donut: Donut,
};

export default function ChartPanel({ onAddChart }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-sm font-semibold text-gray-800">Chart</h3>
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
              aria-label={`Add ${CHART_KINDS[kind].label}`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{CHART_KINDS[kind].label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
