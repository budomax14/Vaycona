import React, { useEffect, useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { UNITS } from "../measurement";
import {
  GRID_SPACING_PRESETS,
  LAYOUT_GRID_PRESETS,
  MARGIN_PRESETS,
  SAFE_AREA_PRESETS,
  MAX_COLUMNS,
  MAX_ROWS,
  validateLayoutGridGeometry,
} from "../precisionDefaults";
import { SNAP_SENSITIVITY_PRESETS } from "../precisionPreferences";

function Section({ title, children }) {
  return (
    <section className="border-b border-gray-100 px-5 py-4 last:border-b-0">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ label, children }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-gray-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

const numInput = "w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm outline-none focus:border-amber-400";

export default function PrecisionSettingsDialog({
  isOpen,
  onClose,
  prefs,
  onUpdatePrefs,
  page,
  pageWidth,
  pageHeight,
  onUpdateGrid,
  onUpdateMargins,
  onUpdateSafeArea,
  onUpdateBleed,
  onUpdateLayoutGrid,
  onUpdateBaselineGrid,
  onResetView,
}) {
  const dialogRef = useRef(null);
  const [layoutGridError, setLayoutGridError] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(event) {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll("button, input, select");
        if (!focusable || focusable.length === 0) return;
        const list = Array.from(focusable).filter((el) => !el.disabled);
        const first = list[0];
        const last = list[list.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || !page) return null;
  const { grid, margins, safeArea, bleed, layoutGrid, baselineGrid } = page;

  function applyLayoutGridChange(changes) {
    const next = { ...layoutGrid, ...changes };
    const errors = validateLayoutGridGeometry(next, pageWidth, pageHeight);
    setLayoutGridError(errors[0] || null);
    if (errors.length === 0) onUpdateLayoutGrid(changes);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="presentation">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="precision-settings-title" className="flex max-h-[88vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 id="precision-settings-title" className="text-base font-semibold text-gray-900">Precision settings</h2>
          <div className="flex items-center gap-1">
            <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100" onClick={onResetView} title="Reset precision view">
              <RotateCcw size={12} /> Reset view
            </button>
            <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label="Close precision settings">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto">
          <Section title="Units">
            <Row label="Preferred unit">
              <select className={numInput} style={{ width: 96 }} value={prefs.defaultUnit} onChange={(event) => onUpdatePrefs({ defaultUnit: event.target.value })}>
                {UNITS.map((u) => (
                  <option key={u.key} value={u.key}>{u.label}</option>
                ))}
              </select>
            </Row>
          </Section>

          <Section title="Rulers and guides">
            <Toggle label="Show rulers" checked={prefs.showRulers} onChange={(v) => onUpdatePrefs({ showRulers: v })} />
            <Toggle label="Snap to guides" checked={prefs.snapToGuides} onChange={(v) => onUpdatePrefs({ snapToGuides: v })} />
          </Section>

          <Section title="Smart snapping">
            <Toggle label="Show smart guides" checked={prefs.showSmartGuides} onChange={(v) => onUpdatePrefs({ showSmartGuides: v })} />
            <Toggle label="Snap to objects" checked={prefs.snapToObjects} onChange={(v) => onUpdatePrefs({ snapToObjects: v })} />
            <Toggle label="Snap to page edges/center" checked={prefs.snapToPage} onChange={(v) => onUpdatePrefs({ snapToPage: v })} />
            <Toggle label="Snap to margins" checked={prefs.snapToMargins} onChange={(v) => onUpdatePrefs({ snapToMargins: v })} />
            <Toggle label="Snap to layout grid" checked={prefs.snapToLayoutGrid} onChange={(v) => onUpdatePrefs({ snapToLayoutGrid: v })} />
            <Toggle label="Snap to equal spacing" checked={prefs.snapToEqualSpacing} onChange={(v) => onUpdatePrefs({ snapToEqualSpacing: v })} />
            <Row label="Snap sensitivity">
              <select
                className={numInput}
                style={{ width: 110 }}
                value={Object.entries(SNAP_SENSITIVITY_PRESETS).find(([, v]) => v === prefs.snapSensitivityPx)?.[0] || "custom"}
                onChange={(event) => {
                  const key = event.target.value;
                  if (key === "custom") return;
                  onUpdatePrefs({ snapSensitivityKey: key, snapSensitivityPx: SNAP_SENSITIVITY_PRESETS[key] });
                }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="custom">Custom</option>
              </select>
            </Row>
            {Object.entries(SNAP_SENSITIVITY_PRESETS).every(([, v]) => v !== prefs.snapSensitivityPx) && (
              <Row label="Custom sensitivity (px)">
                <input type="number" min={1} max={60} className={numInput} value={prefs.snapSensitivityPx} onChange={(event) => onUpdatePrefs({ snapSensitivityPx: Number(event.target.value) })} />
              </Row>
            )}
          </Section>

          <Section title="Grid (this page)">
            <Row label="Type">
              <select className={numInput} style={{ width: 96 }} value={grid.type} onChange={(event) => onUpdateGrid({ type: event.target.value })}>
                <option value="square">Square</option>
                <option value="dot">Dot</option>
              </select>
            </Row>
            <Toggle label="Show grid" checked={grid.visible} onChange={(v) => onUpdateGrid({ visible: v })} />
            <Toggle label="Snap to grid" checked={grid.snap} onChange={(v) => onUpdateGrid({ snap: v })} />
            <Row label="Spacing preset">
              <select
                className={numInput}
                style={{ width: 96 }}
                value={GRID_SPACING_PRESETS.includes(grid.spacingX) && grid.spacingX === grid.spacingY ? grid.spacingX : ""}
                onChange={(event) => {
                  const v = Number(event.target.value);
                  if (v) onUpdateGrid({ spacingX: v, spacingY: v });
                }}
              >
                <option value="">Custom</option>
                {GRID_SPACING_PRESETS.map((p) => (
                  <option key={p} value={p}>{p}px</option>
                ))}
              </select>
            </Row>
            <Row label="Spacing X / Y (px)">
              <span className="flex gap-1.5">
                <input type="number" min={1} className={numInput} style={{ width: 64 }} value={grid.spacingX} onChange={(event) => onUpdateGrid({ spacingX: Number(event.target.value), spacingY: grid.equalSpacing ? Number(event.target.value) : grid.spacingY })} />
                <input type="number" min={1} className={numInput} style={{ width: 64 }} value={grid.spacingY} disabled={grid.equalSpacing} onChange={(event) => onUpdateGrid({ spacingY: Number(event.target.value) })} />
              </span>
            </Row>
            <Toggle label="Lock equal X/Y spacing" checked={grid.equalSpacing} onChange={(v) => onUpdateGrid({ equalSpacing: v, spacingY: v ? grid.spacingX : grid.spacingY })} />
            <Row label="Offset X / Y (px)">
              <span className="flex gap-1.5">
                <input type="number" className={numInput} style={{ width: 64 }} value={grid.offsetX} onChange={(event) => onUpdateGrid({ offsetX: Number(event.target.value) })} />
                <input type="number" className={numInput} style={{ width: 64 }} value={grid.offsetY} onChange={(event) => onUpdateGrid({ offsetY: Number(event.target.value) })} />
              </span>
            </Row>
            <Row label="Subdivisions">
              <input type="number" min={1} max={20} className={numInput} value={grid.subdivisions} onChange={(event) => onUpdateGrid({ subdivisions: Number(event.target.value) })} />
            </Row>
            <Row label="Major line every N">
              <input type="number" min={1} max={50} className={numInput} value={grid.majorInterval} onChange={(event) => onUpdateGrid({ majorInterval: Number(event.target.value) })} />
            </Row>
            <Row label="Opacity">
              <input type="range" min={0.1} max={1} step={0.05} value={grid.opacity} onChange={(event) => onUpdateGrid({ opacity: Number(event.target.value) })} />
            </Row>
          </Section>

          <Section title="Margins (this page)">
            <Toggle label="Show margins" checked={margins.visible} onChange={(v) => onUpdateMargins({ visible: v })} />
            <Toggle label="Snap to margins" checked={margins.snap} onChange={(v) => onUpdateMargins({ snap: v })} />
            <Row label="Preset">
              <select
                className={numInput}
                style={{ width: 110 }}
                value={margins.preset}
                onChange={(event) => {
                  const preset = MARGIN_PRESETS[event.target.value];
                  if (preset) onUpdateMargins({ preset: event.target.value, ...preset });
                }}
              >
                {Object.keys(MARGIN_PRESETS).map((key) => (
                  <option key={key} value={key}>{key}</option>
                ))}
                <option value="custom">custom</option>
              </select>
            </Row>
            <Toggle label="Link all sides" checked={margins.linked} onChange={(v) => onUpdateMargins({ linked: v })} />
            <Row label="Top / Right / Bottom / Left (px)">
              <span className="flex gap-1">
                {["top", "right", "bottom", "left"].map((side) => (
                  <input
                    key={side}
                    type="number"
                    min={0}
                    className={numInput}
                    style={{ width: 50 }}
                    value={margins[side]}
                    onChange={(event) => {
                      const v = Number(event.target.value);
                      if (margins.linked) onUpdateMargins({ preset: "custom", top: v, right: v, bottom: v, left: v });
                      else onUpdateMargins({ preset: "custom", [side]: v });
                    }}
                  />
                ))}
              </span>
            </Row>
          </Section>

          <Section title="Safe area">
            <Toggle label="Show safe area" checked={safeArea.visible} onChange={(v) => onUpdateSafeArea({ visible: v })} />
            <Row label="Preset">
              <select
                className={numInput}
                style={{ width: 170 }}
                value={safeArea.preset}
                onChange={(event) => {
                  const preset = SAFE_AREA_PRESETS[event.target.value];
                  if (preset) onUpdateSafeArea({ preset: event.target.value, insetPercent: preset.inset });
                }}
              >
                {Object.entries(SAFE_AREA_PRESETS).map(([key, p]) => (
                  <option key={key} value={key}>{p.label}</option>
                ))}
              </select>
            </Row>
          </Section>

          <Section title="Bleed preview">
            <Toggle label="Show bleed" checked={bleed.visible} onChange={(v) => onUpdateBleed({ visible: v })} />
            <Row label="Bleed size (px)">
              <input type="number" min={0} className={numInput} value={bleed.sizePx} onChange={(event) => onUpdateBleed({ sizePx: Number(event.target.value), preset: "custom" })} />
            </Row>
          </Section>

          <Section title="Columns and rows">
            <Toggle label="Show layout grid" checked={layoutGrid.visible} onChange={(v) => onUpdateLayoutGrid({ visible: v })} />
            <Toggle label="Snap to layout grid" checked={layoutGrid.snap} onChange={(v) => onUpdateLayoutGrid({ snap: v })} />
            <Row label="Preset">
              <select
                className={numInput}
                style={{ width: 170 }}
                defaultValue=""
                onChange={(event) => {
                  const preset = LAYOUT_GRID_PRESETS.find((p) => p.key === event.target.value);
                  if (preset) applyLayoutGridChange({ columns: preset.columns, rows: preset.rows, gutter: preset.gutter });
                  event.target.value = "";
                }}
              >
                <option value="" disabled>Choose preset…</option>
                {LAYOUT_GRID_PRESETS.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </Row>
            <Row label={`Columns (0-${MAX_COLUMNS})`}>
              <input type="number" min={0} max={MAX_COLUMNS} className={numInput} value={layoutGrid.columns} onChange={(event) => applyLayoutGridChange({ columns: Number(event.target.value) })} />
            </Row>
            <Row label={`Rows (0-${MAX_ROWS})`}>
              <input type="number" min={0} max={MAX_ROWS} className={numInput} value={layoutGrid.rows} onChange={(event) => applyLayoutGridChange({ rows: Number(event.target.value) })} />
            </Row>
            <Row label="Gutter (px)">
              <input type="number" min={0} className={numInput} value={layoutGrid.gutter} onChange={(event) => applyLayoutGridChange({ gutter: Number(event.target.value) })} />
            </Row>
            {layoutGridError && <p className="text-xs text-red-600" role="alert">{layoutGridError}</p>}
          </Section>

          <Section title="Baseline grid">
            <Toggle label="Show baseline grid" checked={baselineGrid.visible} onChange={(v) => onUpdateBaselineGrid({ visible: v })} />
            <Toggle label="Snap text to baseline" checked={baselineGrid.snap} onChange={(v) => onUpdateBaselineGrid({ snap: v })} />
            <Row label="Baseline spacing (px)">
              <input type="number" min={1} className={numInput} value={baselineGrid.spacing} onChange={(event) => onUpdateBaselineGrid({ spacing: Number(event.target.value) })} />
            </Row>
            <Row label="Offset (px)">
              <input type="number" className={numInput} value={baselineGrid.offset} onChange={(event) => onUpdateBaselineGrid({ offset: Number(event.target.value) })} />
            </Row>
            <p className="text-xs text-gray-400">Baseline snapping applies to a text box's top position only — it does not rewrite internal line-height layout.</p>
          </Section>

          <Section title="Keyboard">
            <Row label="Standard nudge (px)">
              <input type="number" min={0.01} className={numInput} value={prefs.nudgeStandard} onChange={(event) => onUpdatePrefs({ nudgeStandard: Number(event.target.value) })} />
            </Row>
            <Row label="Large nudge — Shift (px)">
              <input type="number" min={0.01} className={numInput} value={prefs.nudgeLarge} onChange={(event) => onUpdatePrefs({ nudgeLarge: Number(event.target.value) })} />
            </Row>
            <Row label="Fine nudge — Alt (px)">
              <input type="number" min={0.001} step={0.01} className={numInput} value={prefs.nudgeFine} onChange={(event) => onUpdatePrefs({ nudgeFine: Number(event.target.value) })} />
            </Row>
          </Section>

          <Section title="Measurements">
            <Toggle label="Show distance labels while dragging" checked={prefs.showMeasurementLabels} onChange={(v) => onUpdatePrefs({ showMeasurementLabels: v })} />
          </Section>
        </div>

        <div className="flex justify-end border-t border-gray-200 px-5 py-3">
          <button className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
