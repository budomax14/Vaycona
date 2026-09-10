import React from "react";
import { ChevronLeft, ChevronRight, Maximize, Clock, Play } from "lucide-react";
import ZoomControl from "./ZoomControl";
import LayersPopover from "./LayersPopover";
import PagesPopover from "./PagesPopover";
import { UNITS, formatMeasurement } from "../../measurement";
import { useLanguage } from "../../languageContext";
import { STATUS_BAR_STRINGS } from "../../i18n/statusBarAndMenus";

export default function StatusBar({
  pages,
  activePageId,
  activePage,
  onActivatePage,
  onPrevPage,
  onNextPage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onRenamePage,
  onMovePageUp,
  onMovePageDown,
  cursorPos,
  selectedBounds,
  viewportScale,
  onZoomTo,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  items,
  selectedIds,
  onSelectLayer,
  onToggleHidden,
  onToggleLocked,
  onRenameLayer,
  onReorderLayer,
  unit,
  onUnitChange,
  // Phase 12
  timelineOpen,
  onToggleTimeline,
  onOpenPresentation,
}) {
  const { language } = useLanguage();
  const t = STATUS_BAR_STRINGS[language].statusBar;
  const activeIndex = pages.findIndex((page) => page.id === activePageId);

  return (
    <footer className="flex h-9 shrink-0 items-center gap-2 overflow-x-auto border-t border-gray-200 bg-white px-3 text-xs text-gray-500 md:gap-4 md:px-4">
      <div className="flex shrink-0 items-center gap-1">
        <button
          className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-30"
          onClick={onPrevPage}
          disabled={activeIndex <= 0}
          title={t.previousPage}
          aria-label={t.previousPage}
        >
          <ChevronLeft size={13} />
        </button>
        <span className="font-medium text-gray-700">
          {t.pageOf(activeIndex + 1, pages.length)}
        </span>
        <button
          className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-30"
          onClick={onNextPage}
          disabled={activeIndex >= pages.length - 1}
          title={t.nextPage}
          aria-label={t.nextPage}
        >
          <ChevronRight size={13} />
        </button>
        <PagesPopover
          pages={pages}
          activePageId={activePageId}
          onActivate={onActivatePage}
          onAdd={onAddPage}
          onDuplicate={onDuplicatePage}
          onDelete={onDeletePage}
          onRename={onRenamePage}
          onMoveUp={onMovePageUp}
          onMoveDown={onMovePageDown}
        />
      </div>

      <span className="h-3 w-px shrink-0 bg-gray-200" />

      <span className="hidden shrink-0 md:inline">
        {formatMeasurement(activePage.width, unit)} × {formatMeasurement(activePage.height, unit)}
      </span>

      <span className="hidden h-3 w-px shrink-0 bg-gray-200 md:inline" />

      <span className="hidden shrink-0 sm:inline" aria-live="off">
        {cursorPos ? t.cursorPosition(formatMeasurement(cursorPos.x, unit), formatMeasurement(cursorPos.y, unit)) : t.cursorPositionEmpty}
      </span>

      {selectedBounds && (
        <>
          <span className="hidden h-3 w-px shrink-0 bg-gray-200 lg:inline" />
          <span className="hidden shrink-0 lg:inline">
            {t.selection(
              formatMeasurement(selectedBounds.left, unit),
              formatMeasurement(selectedBounds.top, unit),
              formatMeasurement(selectedBounds.width, unit),
              formatMeasurement(selectedBounds.height, unit)
            )}
          </span>
        </>
      )}

      <span className="hidden h-3 w-px shrink-0 bg-gray-200 md:inline" />
      <select
        className="hidden shrink-0 rounded border border-gray-200 bg-white px-1 py-0.5 text-xs text-gray-500 md:inline"
        value={unit}
        onChange={(event) => onUnitChange(event.target.value)}
        aria-label={t.measurementUnit}
      >
        {UNITS.map((u) => (
          <option key={u.key} value={u.key}>{u.key}</option>
        ))}
      </select>

      <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-4">
        <button
          className={`flex items-center gap-1 rounded-md px-1.5 py-1 ${timelineOpen ? "bg-amber-50 text-amber-700" : "text-gray-500 hover:bg-gray-100"}`}
          onClick={onToggleTimeline}
          title={t.timeline}
          aria-pressed={timelineOpen}
        >
          <Clock size={13} />
          <span className="hidden lg:inline">{t.timeline}</span>
        </button>
        <button
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-gray-500 hover:bg-gray-100"
          onClick={onOpenPresentation}
          title={t.present}
        >
          <Play size={13} />
          <span className="hidden lg:inline">{t.present}</span>
        </button>
        <span className="h-3 w-px bg-gray-200" />
        <LayersPopover
          items={items}
          selectedIds={selectedIds}
          onSelect={onSelectLayer}
          onToggleHidden={onToggleHidden}
          onToggleLocked={onToggleLocked}
          onRename={onRenameLayer}
          onReorder={onReorderLayer}
        />
        <span className="h-3 w-px bg-gray-200" />
        <button
          className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
          onClick={onFitToScreen}
          title={t.fitToScreen}
          aria-label={t.fitToScreen}
        >
          <Maximize size={13} />
        </button>
        <ZoomControl scale={viewportScale} onZoomTo={onZoomTo} onZoomIn={onZoomIn} onZoomOut={onZoomOut} />
      </div>
    </footer>
  );
}
