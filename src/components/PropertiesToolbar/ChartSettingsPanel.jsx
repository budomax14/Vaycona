import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ColorField, NumberField, SliderField } from "./toolbarUi";
import FontFamilyPicker from "./FontFamilyPicker";
import { CHART_KINDS, CHART_KIND_ORDER_AVAILABLE } from "../../chartKinds";

const LEGEND_POSITIONS = ["top", "bottom", "left", "right"];

// Styled as the same right-side flyout shell TextColorPanel.jsx uses
// (fixed, portal-mounted, Escape/outside-click to close) — reused here
// rather than invented anew so "Chart settings" feels like the same kind
// of panel as "Shape fill" instead of a bespoke dashboard.
function Section({ title, children }) {
  return (
    <div className="space-y-2 border-b border-gray-100 pb-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ToggleRow({ label, active, onClick }) {
  return (
    <button
      type="button"
      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm font-medium ${
        active ? "bg-amber-50 text-amber-700" : "bg-gray-50 text-gray-600"
      }`}
      onClick={onClick}
    >
      {label}
      <span className={`h-4 w-7 rounded-full transition-colors ${active ? "bg-amber-500" : "bg-gray-300"}`}>
        <span className={`block h-3 w-3 translate-y-0.5 rounded-full bg-white transition-transform ${active ? "translate-x-3.5" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}

export default function ChartSettingsPanel({ isOpen, onClose, item, onChange }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }
    function handleOutside(event) {
      if (panelRef.current && panelRef.current.contains(event.target)) return;
      // ColorField's own picker (ToolbarPopover) portals to document.body
      // as a DOM sibling of this panel, not a descendant of panelRef — so
      // without this check, clicking any of this panel's color swatches
      // (title/background/border/data-label) reads as "outside" and
      // closes the whole settings panel before the click registers (same
      // fix ToolbarPopover.jsx itself uses for nested popovers).
      if (event.target.closest?.("[data-toolbar-popover]")) return;
      onClose();
    }
    window.addEventListener("keydown", handleKey);
    window.addEventListener("mousedown", handleOutside);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("mousedown", handleOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const settings = item.settings || {};
  const kindDef = CHART_KINDS[item.chartKind] || CHART_KINDS.bar;
  const family = kindDef.family;
  const isBar = family === "bar";
  const isLine = family === "line";
  const isPie = family === "pie";

  function patchSettings(changes) {
    onChange({ settings: { ...settings, ...changes } });
  }

  function changeChartKind(nextKind) {
    // Preserve data/series untouched; only swap chartKind and apply that
    // kind's own default overrides (e.g. donut's inner radius) on top of
    // whatever the user already customized (spec §6: "preserve data
    // whenever possible").
    onChange({ chartKind: nextKind, settings: { ...settings, ...(CHART_KINDS[nextKind]?.extraDefaults ?? {}) } });
  }

  const border = settings.border || { enabled: false, color: "#111827", width: 1, radius: 0 };

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Chart settings"
      className="fixed right-0 top-32 bottom-9 z-40 flex w-full max-w-[85vw] flex-col overflow-y-auto border-l border-gray-200 bg-white shadow-2xl sm:w-80 sm:max-w-none"
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Chart settings</h2>
        <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 space-y-4 p-4">
        <Section title="Chart type">
          <select
            className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm text-gray-700 outline-none focus:border-amber-400 focus:bg-white"
            value={item.chartKind}
            onChange={(event) => changeChartKind(event.target.value)}
          >
            {CHART_KIND_ORDER_AVAILABLE.map((kind) => (
              <option key={kind} value={kind}>
                {CHART_KINDS[kind].label}
              </option>
            ))}
          </select>
        </Section>

        <Section title="Title">
          <input
            type="text"
            className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-sm text-gray-700 outline-none focus:border-amber-400 focus:bg-white"
            value={item.title ?? ""}
            placeholder="Chart title"
            onChange={(event) => onChange({ title: event.target.value })}
          />
          <ToggleRow label="Show title" active={!!settings.showTitle} onClick={() => patchSettings({ showTitle: !settings.showTitle })} />
          {settings.showTitle && (
            <>
              <FontFamilyPicker value={settings.titleFontFamily || "Arial"} onChange={(value) => patchSettings({ titleFontFamily: value })} />
              <div className="flex items-center gap-2">
                <NumberField label="Size" value={settings.titleFontSize || 18} min={8} max={72} onChange={(value) => patchSettings({ titleFontSize: value })} />
                <ColorField label="Color" value={settings.titleColor || "#111827"} onChange={(value) => patchSettings({ titleColor: value })} />
              </div>
            </>
          )}
        </Section>

        <Section title="Background">
          <ToggleRow
            label="Solid background"
            active={settings.background !== "transparent"}
            onClick={() => patchSettings({ background: settings.background !== "transparent" ? "transparent" : "#ffffff" })}
          />
          {settings.background !== "transparent" && (
            <ColorField label="Color" value={settings.background || "#ffffff"} onChange={(value) => patchSettings({ background: value })} />
          )}
        </Section>

        <Section title="Border">
          <ToggleRow label="Show border" active={!!border.enabled} onClick={() => patchSettings({ border: { ...border, enabled: !border.enabled } })} />
          {border.enabled && (
            <>
              <ColorField label="Color" value={border.color || "#111827"} onChange={(value) => patchSettings({ border: { ...border, color: value } })} />
              <div className="flex items-center gap-2">
                <NumberField label="Width" value={border.width ?? 1} min={0} max={20} onChange={(value) => patchSettings({ border: { ...border, width: value } })} />
                <NumberField label="Radius" value={border.radius ?? 0} min={0} max={40} onChange={(value) => patchSettings({ border: { ...border, radius: value } })} />
              </div>
            </>
          )}
        </Section>

        <Section title="Data labels">
          <ToggleRow label="Show data labels" active={!!settings.showDataLabels} onClick={() => patchSettings({ showDataLabels: !settings.showDataLabels })} />
          {isPie && (
            <ToggleRow label="Show percentage" active={!!settings.showPercentage} onClick={() => patchSettings({ showPercentage: !settings.showPercentage })} />
          )}
          {settings.showDataLabels && (
            <div className="flex items-center gap-2">
              <NumberField label="Size" value={settings.dataLabelFontSize || 11} min={6} max={32} onChange={(value) => patchSettings({ dataLabelFontSize: value })} />
              <ColorField label="Color" value={settings.dataLabelColor || "#111827"} onChange={(value) => patchSettings({ dataLabelColor: value })} />
            </div>
          )}
        </Section>

        {!isPie && (
          <Section title="Grid & axes">
            <ToggleRow label="Grid lines" active={!!settings.showGrid} onClick={() => patchSettings({ showGrid: !settings.showGrid })} />
            <ToggleRow label="X-axis" active={!!settings.showXAxis} onClick={() => patchSettings({ showXAxis: !settings.showXAxis })} />
            <ToggleRow label="Y-axis" active={!!settings.showYAxis} onClick={() => patchSettings({ showYAxis: !settings.showYAxis })} />
          </Section>
        )}

        <Section title="Legend">
          <ToggleRow label="Show legend" active={!!settings.showLegend} onClick={() => patchSettings({ showLegend: !settings.showLegend })} />
          {settings.showLegend && (
            <select
              className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm text-gray-700 outline-none focus:border-amber-400 focus:bg-white"
              value={settings.legendPosition || "bottom"}
              onChange={(event) => patchSettings({ legendPosition: event.target.value })}
            >
              {LEGEND_POSITIONS.map((pos) => (
                <option key={pos} value={pos}>
                  {pos[0].toUpperCase() + pos.slice(1)}
                </option>
              ))}
            </select>
          )}
        </Section>

        {isBar && (
          <Section title="Bar settings">
            <NumberField label="Corner radius" value={settings.barCornerRadius ?? 4} min={0} max={40} onChange={(value) => patchSettings({ barCornerRadius: value })} />
            <SliderField label="Bar spacing" value={settings.barGap ?? 0.2} min={0} max={0.8} step={0.05} onChange={(value) => patchSettings({ barGap: value })} />
          </Section>
        )}

        {isLine && (
          <Section title="Line settings">
            <NumberField label="Thickness" value={settings.lineThickness ?? 2} min={1} max={20} onChange={(value) => patchSettings({ lineThickness: value })} />
            <ToggleRow
              label="Smooth curve"
              active={settings.lineCurve === "monotone"}
              onClick={() => patchSettings({ lineCurve: settings.lineCurve === "monotone" ? "linear" : "monotone" })}
            />
            <ToggleRow label="Data points" active={!!settings.showDataPoints} onClick={() => patchSettings({ showDataPoints: !settings.showDataPoints })} />
            {settings.showDataPoints && (
              <NumberField label="Point size" value={settings.dataPointSize ?? 4} min={1} max={16} onChange={(value) => patchSettings({ dataPointSize: value })} />
            )}
            <ToggleRow label="Area fill" active={!!settings.areaFill} onClick={() => patchSettings({ areaFill: !settings.areaFill })} />
          </Section>
        )}

        {isPie && (
          <Section title="Pie & donut settings">
            <NumberField label="Slice spacing" value={settings.sliceSpacing ?? 0} min={0} max={10} onChange={(value) => patchSettings({ sliceSpacing: value })} />
            <div>
              <span className="mb-1 block text-xs font-medium text-gray-500">Donut size: {settings.donutInnerRadius ?? 0}%</span>
              <SliderField
                label="Donut size"
                value={settings.donutInnerRadius ?? 0}
                min={0}
                max={80}
                step={1}
                onChange={(value) => patchSettings({ donutInnerRadius: value })}
              />
            </div>
          </Section>
        )}
      </div>
    </div>,
    document.body
  );
}
