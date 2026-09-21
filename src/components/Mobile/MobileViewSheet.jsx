import React from "react";
import { Clock, Maximize, Minus, Play, Plus } from "lucide-react";
import MobileSheet from "./MobileSheet";
import { UNITS, formatMeasurement } from "../../measurement";
import { useLanguage } from "../../languageContext";
import { MOBILE_STRINGS } from "../../i18n/mobile";

// What the desktop status bar offers (zoom, page size, units, timeline,
// present), collected behind the bottom bar's View button.
export default function MobileViewSheet({
  isOpen,
  onClose,
  activePage,
  unit,
  onUnitChange,
  viewportScale,
  onZoomTo,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  timelineOpen,
  onToggleTimeline,
  onOpenPresentation,
}) {
  const { language } = useLanguage();
  const t = MOBILE_STRINGS[language].view;
  const rowButton = "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-medium text-gray-700 active:bg-gray-50";

  return (
    <MobileSheet isOpen={isOpen} onClose={onClose} title={t.title} aboveBar>
      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{t.zoom}</div>
          <div className="flex items-center gap-2">
            <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 text-gray-700" onClick={onZoomOut} aria-label={t.zoomOut}>
              <Minus size={18} />
            </button>
            <div className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">
              <input
                type="number"
                inputMode="numeric"
                className="w-14 bg-transparent text-right outline-none"
                value={Math.round(viewportScale * 100)}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value) && value > 0) onZoomTo(value / 100);
                }}
                aria-label={t.zoomPercentage}
              />
              <span>%</span>
            </div>
            <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 text-gray-700" onClick={onZoomIn} aria-label={t.zoomIn}>
              <Plus size={18} />
            </button>
          </div>
          <button className={`${rowButton} mt-2 w-full`} onClick={onFitToScreen}>
            <Maximize size={16} /> {t.fit}
          </button>
        </div>

        <div className="flex gap-2">
          <button className={rowButton} onClick={onToggleTimeline} aria-pressed={timelineOpen}>
            <Clock size={16} /> {t.timeline}
          </button>
          <button
            className={rowButton}
            onClick={() => {
              onClose();
              onOpenPresentation();
            }}
          >
            <Play size={16} /> {t.present}
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm text-gray-600">
          <span>
            {t.pageSize}: {formatMeasurement(activePage.width, unit)} × {formatMeasurement(activePage.height, unit)}
          </span>
          <select
            className="min-h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-600"
            value={unit}
            onChange={(event) => onUnitChange(event.target.value)}
            aria-label={t.units}
          >
            {UNITS.map((u) => (
              <option key={u.key} value={u.key}>
                {u.key}
              </option>
            ))}
          </select>
        </div>
      </div>
    </MobileSheet>
  );
}
