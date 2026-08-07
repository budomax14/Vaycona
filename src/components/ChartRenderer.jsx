import React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_KINDS, getSliceColor } from "../chartKinds";

// Pure Recharts tree builder: (chartKind + data + series + settings) -> a
// single <svg>-rooted element sized to explicit width/height (not
// ResponsiveContainer — this is deliberately used both live-on-canvas via
// an offscreen mount (useChartImage.js, which needs a deterministic,
// synchronously-known size to rasterize) and in the data editor's preview
// pane, so a fixed pixel size is simpler and more reliable than a
// ResizeObserver-driven container in a detached/offscreen DOM node).
//
// Everything that must survive export (title, legend, data labels,
// background, border) is built as real SVG children of the chart
// component rather than via Recharts' <Legend>/<Tooltip>, which render
// into a sibling HTML wrapper div outside the <svg>. useChartImage.js only
// serializes the <svg> element itself, so anything drawn outside it would
// silently vanish from both the on-canvas chart and every export path.
// Tooltip is the one exception: it's only ever used in the live preview
// (interactive prop), never in the rasterized/exported version, matching
// spec §20 (tooltips may appear while editing, never in exports).
const TICK_STYLE = { fontSize: 11, fill: "#6b7280" };
const LEGEND_ITEM_HEIGHT = 18;
const LEGEND_SWATCH = 9;

function estimateTextWidth(text) {
  return Math.max(10, String(text ?? "").length * 6.2);
}

function BackgroundRect({ width, height, settings }) {
  const hasFill = settings.background && settings.background !== "transparent";
  const border = settings.border || {};
  if (!hasFill && !border.enabled) return null;
  return (
    <rect
      x={0.5}
      y={0.5}
      width={Math.max(0, width - 1)}
      height={Math.max(0, height - 1)}
      rx={border.radius || 0}
      fill={hasFill ? settings.background : "none"}
      stroke={border.enabled ? border.color || "#111827" : "none"}
      strokeWidth={border.enabled ? border.width || 1 : 0}
    />
  );
}

function TitleText({ width, title, settings }) {
  if (!settings.showTitle || !title) return null;
  return (
    <text
      x={width / 2}
      y={20}
      textAnchor="middle"
      fontSize={settings.titleFontSize || 18}
      fontFamily={settings.titleFontFamily || "Arial"}
      fontWeight={600}
      fill={settings.titleColor || "#111827"}
    >
      {title}
    </text>
  );
}

// Custom legend rendered as plain SVG (swatch rect + text per item) instead
// of Recharts' <Legend>, for the same "must stay inside the <svg>" reason
// as the title above.
function Legend({ items, position, width, height }) {
  if (!items.length) return null;
  if (position === "left" || position === "right") {
    const colWidth = Math.max(...items.map((it) => LEGEND_SWATCH + 6 + estimateTextWidth(it.label))) + 8;
    const x = position === "left" ? 6 : width - colWidth;
    const totalHeight = items.length * LEGEND_ITEM_HEIGHT;
    const startY = Math.max(8, height / 2 - totalHeight / 2);
    return (
      <g>
        {items.map((item, i) => (
          <g key={item.label + i} transform={`translate(${x}, ${startY + i * LEGEND_ITEM_HEIGHT})`}>
            <rect width={LEGEND_SWATCH} height={LEGEND_SWATCH} rx={2} fill={item.color} />
            <text x={LEGEND_SWATCH + 6} y={LEGEND_SWATCH} fontSize={11} fill="#374151">
              {item.label}
            </text>
          </g>
        ))}
      </g>
    );
  }
  // top / bottom: single horizontal row, centered
  const rowWidth = items.reduce((sum, it) => sum + LEGEND_SWATCH + 6 + estimateTextWidth(it.label) + 16, 0) - 16;
  let x = Math.max(8, width / 2 - rowWidth / 2);
  const y = position === "top" ? 6 : height - LEGEND_ITEM_HEIGHT + 2;
  return (
    <g>
      {items.map((item, i) => {
        const itemWidth = LEGEND_SWATCH + 6 + estimateTextWidth(item.label);
        const node = (
          <g key={item.label + i} transform={`translate(${x}, ${y})`}>
            <rect width={LEGEND_SWATCH} height={LEGEND_SWATCH} rx={2} fill={item.color} />
            <text x={LEGEND_SWATCH + 6} y={LEGEND_SWATCH} fontSize={11} fill="#374151">
              {item.label}
            </text>
          </g>
        );
        x += itemWidth + 16;
        return node;
      })}
    </g>
  );
}

function getPlotMargin(settings, hasLegend) {
  const margin = { top: 8, right: 16, bottom: 8, left: 8 };
  if (settings.showTitle) margin.top += 24;
  if (hasLegend) {
    if (settings.legendPosition === "top") margin.top += 22;
    else if (settings.legendPosition === "bottom") margin.bottom += 22;
    else if (settings.legendPosition === "left") margin.left += 90;
    else if (settings.legendPosition === "right") margin.right += 90;
  }
  return margin;
}

function renderPieLabel(settings) {
  return (props) => {
    const { cx, cy, midAngle, outerRadius, percent, name } = props;
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 14;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const parts = [];
    if (settings.showDataLabels) parts.push(name);
    if (settings.showPercentage) parts.push(`${Math.round(percent * 100)}%`);
    if (!parts.length) return null;
    return (
      <text x={x} y={y} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={11} fill="#374151">
        {parts.join(" · ")}
      </text>
    );
  };
}

function EmptyState({ width, height }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect width={width} height={height} fill="#f9fafb" stroke="#e5e7eb" strokeDasharray="6 6" />
      <text x={width / 2} y={height / 2} textAnchor="middle" dominantBaseline="middle" fontSize={13} fill="#9ca3af">
        No chart data
      </text>
    </svg>
  );
}

export default function ChartRenderer({ item, width, height, interactive = false }) {
  const w = Math.max(20, Math.round(width));
  const h = Math.max(20, Math.round(height));
  const { chartKind, data, series, settings = {}, title } = item;
  const kindDef = CHART_KINDS[chartKind] || CHART_KINDS.bar;
  const family = kindDef.family;

  const hasData = Array.isArray(data) && data.length > 0 && Array.isArray(series) && series.length > 0;
  if (!hasData || (family !== "bar" && family !== "line" && family !== "pie")) {
    return <EmptyState width={w} height={h} />;
  }

  const background = <BackgroundRect width={w} height={h} settings={settings} />;
  const titleNode = <TitleText width={w} title={title} settings={settings} />;
  // Tooltip renders into an HTML div positioned outside the <svg> (a
  // Recharts implementation detail, same as the reason Legend is
  // hand-built above) — fine for the live/interactive preview (which
  // stays mounted in the real DOM) but never requested by
  // useChartImage.js's offscreen rasterization pass, so it's absent from
  // both the on-canvas chart and every export path, matching spec §20.
  const tooltip = interactive ? <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} /> : null;

  if (family === "bar") {
    const isHorizontal = kindDef.orientation === "horizontal";
    const legendItems = settings.showLegend ? series.map((s) => ({ label: s.name || s.key, color: s.color })) : [];
    const margin = getPlotMargin(settings, legendItems.length > 0);
    return (
      <BarChart
        width={w}
        height={h}
        data={data}
        layout={isHorizontal ? "vertical" : "horizontal"}
        barCategoryGap={`${Math.round((settings.barGap ?? 0.2) * 100)}%`}
        margin={margin}
      >
        {background}
        {settings.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
        {isHorizontal ? (
          <>
            {settings.showXAxis && <XAxis type="number" tick={TICK_STYLE} axisLine={{ stroke: "#d1d5db" }} />}
            {settings.showYAxis && <YAxis type="category" dataKey="category" tick={TICK_STYLE} axisLine={{ stroke: "#d1d5db" }} width={70} />}
          </>
        ) : (
          <>
            {settings.showXAxis && <XAxis dataKey="category" tick={TICK_STYLE} axisLine={{ stroke: "#d1d5db" }} />}
            {settings.showYAxis && <YAxis tick={TICK_STYLE} axisLine={{ stroke: "#d1d5db" }} />}
          </>
        )}
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name || s.key}
            fill={s.color || "#8b5cf6"}
            radius={isHorizontal ? [0, settings.barCornerRadius ?? 4, settings.barCornerRadius ?? 4, 0] : [settings.barCornerRadius ?? 4, settings.barCornerRadius ?? 4, 0, 0]}
            isAnimationActive={false}
            label={
              settings.showDataLabels
                ? { position: isHorizontal ? "right" : "top", fontSize: settings.dataLabelFontSize || 11, fill: settings.dataLabelColor || "#111827" }
                : undefined
            }
          />
        ))}
        {titleNode}
        {tooltip}
        <Legend items={legendItems} position={settings.legendPosition || "bottom"} width={w} height={h} />
      </BarChart>
    );
  }

  if (family === "line") {
    const isArea = chartKind === "area" || settings.areaFill;
    const Container = isArea ? AreaChart : LineChart;
    const Mark = isArea ? Area : Line;
    const legendItems = settings.showLegend ? series.map((s) => ({ label: s.name || s.key, color: s.color })) : [];
    const margin = getPlotMargin(settings, legendItems.length > 0);
    const curveType = settings.lineCurve === "monotone" ? "monotone" : "linear";
    return (
      <Container width={w} height={h} data={data} margin={margin}>
        {background}
        {settings.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
        {settings.showXAxis && <XAxis dataKey="category" tick={TICK_STYLE} axisLine={{ stroke: "#d1d5db" }} />}
        {settings.showYAxis && <YAxis tick={TICK_STYLE} axisLine={{ stroke: "#d1d5db" }} />}
        {series.map((s) => (
          <Mark
            key={s.key}
            type={curveType}
            dataKey={s.key}
            name={s.name || s.key}
            stroke={s.color || "#8b5cf6"}
            strokeWidth={settings.lineThickness ?? 2}
            fill={isArea ? s.color || "#8b5cf6" : undefined}
            fillOpacity={isArea ? 0.3 : undefined}
            dot={settings.showDataPoints ? { r: settings.dataPointSize ?? 4, fill: s.color } : false}
            isAnimationActive={false}
            label={
              settings.showDataLabels
                ? { position: "top", fontSize: settings.dataLabelFontSize || 11, fill: settings.dataLabelColor || "#111827" }
                : undefined
            }
          />
        ))}
        {titleNode}
        {tooltip}
        <Legend items={legendItems} position={settings.legendPosition || "bottom"} width={w} height={h} />
      </Container>
    );
  }

  // family === "pie"
  const valueKey = series[0]?.key || "value";
  const legendItems = settings.showLegend ? data.map((row, i) => ({ label: String(row.category ?? `Slice ${i + 1}`), color: getSliceColor(item, i) })) : [];
  const margin = getPlotMargin(settings, legendItems.length > 0);
  const plotWidth = w - margin.left - margin.right;
  const plotHeight = h - margin.top - margin.bottom;
  const outerRadius = Math.max(4, Math.min(plotWidth, plotHeight) / 2 - 6);
  const innerRadiusPct = Math.max(0, Math.min(80, settings.donutInnerRadius ?? 0));
  const innerRadius = outerRadius * (innerRadiusPct / 100);
  const cx = margin.left + plotWidth / 2;
  const cy = margin.top + plotHeight / 2;
  const showLabels = settings.showDataLabels || settings.showPercentage;
  return (
    <PieChart width={w} height={h}>
      {background}
      <Pie
        data={data}
        dataKey={valueKey}
        nameKey="category"
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        paddingAngle={settings.sliceSpacing || 0}
        isAnimationActive={false}
        label={showLabels ? renderPieLabel(settings) : false}
        labelLine={showLabels}
      >
        {data.map((_, i) => (
          <Cell key={i} fill={getSliceColor(item, i)} />
        ))}
      </Pie>
      {titleNode}
      {tooltip}
      <Legend items={legendItems} position={settings.legendPosition || "bottom"} width={w} height={h} />
    </PieChart>
  );
}
