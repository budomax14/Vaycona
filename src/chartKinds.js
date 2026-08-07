// One entry per chart kind, mirroring shapeKinds.js/frameKinds.js/lineKinds.js.
// `family` groups kinds that share a Recharts container/data shape
// (ChartRenderer.jsx switches on it); `orientation` distinguishes the two
// bar layouts. Kinds with `comingSoon: true` are registered (so labels/
// ordering exist for future sidebar entries) but have no renderer support
// yet — ChartRenderer.jsx and ChartPropertiesBar.jsx both check for this.
export const CHART_KINDS = {
  bar: { label: "Bar Chart", family: "bar", orientation: "vertical" },
  barHorizontal: { label: "Horizontal Bar Chart", family: "bar", orientation: "horizontal" },
  line: { label: "Line Chart", family: "line" },
  area: { label: "Area Chart", family: "line", extraDefaults: { areaFill: true } },
  pie: { label: "Pie Chart", family: "pie", extraDefaults: { donutInnerRadius: 0 } },
  donut: { label: "Donut Chart", family: "pie", extraDefaults: { donutInnerRadius: 60 } },

  // Not yet implemented — reserved so the data model/registry shape never
  // has to change when these are added, per spec §1/§8.
  stackedBar: { label: "Stacked Bar Chart", family: "bar", orientation: "vertical", comingSoon: true },
  scatter: { label: "Scatter Plot", family: "scatter", comingSoon: true },
  radar: { label: "Radar Chart", family: "radar", comingSoon: true },
  gauge: { label: "Gauge Chart", family: "gauge", comingSoon: true },
  combo: { label: "Combination Chart", family: "combo", comingSoon: true },
};

export const CHART_KIND_ORDER = Object.keys(CHART_KINDS);

// The kinds actually offered in the Elements sidebar today (spec §1).
export const CHART_KIND_ORDER_AVAILABLE = CHART_KIND_ORDER.filter((kind) => !CHART_KINDS[kind].comingSoon);

export const DEFAULT_CHART_DATA = [
  { category: "Jan", series1: 120 },
  { category: "Feb", series1: 180 },
  { category: "Mar", series1: 145 },
  { category: "Apr", series1: 230 },
  { category: "May", series1: 190 },
];

export const DEFAULT_CHART_SERIES = [{ key: "series1", name: "Sales", color: "#8b5cf6" }];

export const CHART_SERIES_PALETTE = ["#8b5cf6", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#ec4899", "#14b8a6", "#f97316"];

export function defaultChartSettings(chartKind) {
  return {
    showTitle: true,
    titleFontFamily: "Arial",
    titleFontSize: 18,
    titleColor: "#111827",
    showLegend: true,
    legendPosition: "bottom",
    showDataLabels: false,
    dataLabelFontSize: 11,
    dataLabelColor: "#111827",
    showGrid: true,
    showXAxis: true,
    showYAxis: true,
    background: "transparent",
    border: { enabled: false, color: "#111827", width: 1, radius: 0 },
    barCornerRadius: 4,
    barGap: 0.2,
    lineThickness: 2,
    lineCurve: "linear",
    showDataPoints: true,
    dataPointSize: 4,
    areaFill: false,
    showPercentage: false,
    sliceSpacing: 0,
    donutInnerRadius: 60,
    ...(CHART_KINDS[chartKind]?.extraDefaults ?? {}),
  };
}

// Reusable programmatic entry point (spec §24 — future AI wiring calls
// this same function). Returns a ready-to-spread `addItem` partial; does
// not touch app state itself.
export function createChart({ chartKind = "bar", title = "Chart Title", data, series, settings } = {}) {
  return {
    type: "chart",
    chartKind,
    title,
    data: data && data.length ? data : DEFAULT_CHART_DATA.map((row) => ({ ...row })),
    series: series && series.length ? series : DEFAULT_CHART_SERIES.map((s) => ({ ...s })),
    // Sparse, index-aligned with `data` — only populated when a user
    // explicitly overrides one pie/donut slice's color (see
    // getSliceColor in ChartRenderer.jsx); unset slots fall back to
    // CHART_SERIES_PALETTE by index, so rows can be added/removed
    // without needing to keep this array in sync.
    sliceColors: [],
    settings: { ...defaultChartSettings(chartKind), ...settings },
  };
}

export function getSliceColor(item, index) {
  return item.sliceColors?.[index] || CHART_SERIES_PALETTE[index % CHART_SERIES_PALETTE.length];
}
