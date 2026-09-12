import React, { useState } from "react";
import { ChevronDown, ChevronsDown, ChevronsUp, ChevronUp, Copy, FileImage, Plus, Trash2 } from "lucide-react";
import { ColorField } from "../../PropertiesToolbar/toolbarUi";
import ThumbnailStage from "./ThumbnailStage";
import { usePageThumbnails } from "./usePageThumbnails";
import { DEFAULT_PAGE_DURATION_MS } from "../../../animation/animationSchema";
import { TRANSITION_TYPE_LIST, getTransitionPresetLabel } from "../../../animation/transitionService";
import { PAGE_NUMBER_POSITIONS } from "../../../pageNumbering";
import { useLanguage } from "../../../languageContext";
import { PANEL_STRINGS } from "../../../i18n/panels";

function pageNumberDotClass(position) {
  const [vSide, hSide] = position.split("-");
  const vClass = vSide === "top" ? "top-1" : "bottom-1";
  const hClass = hSide === "left" ? "left-1" : hSide === "right" ? "right-1" : "left-1/2 -translate-x-1/2";
  return `${vClass} ${hClass}`;
}

const THUMB_WIDTH = 120;
const THUMB_HEIGHT = 82;

function PageRow({
  page,
  index,
  isActive,
  isOnly,
  isFirst,
  isLast,
  thumbnailUrl,
  isRendering,
  isDragOver,
  onActivate,
  onDuplicate,
  onDelete,
  onRename,
  onBackgroundChange,
  onOpenResize,
  onMoveUp,
  onMoveDown,
  onMoveToStart,
  onMoveToEnd,
  onDragStart,
  onDragOver,
  onDrop,
  onSetDuration,
  onSetTransition,
}) {
  const { language } = useLanguage();
  const t = PANEL_STRINGS[language].pages;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(page.name || t.pageDefaultName(index + 1));

  return (
    <div
      draggable
      onDragStart={(event) => onDragStart(event, page.id)}
      onDragOver={(event) => onDragOver(event, page.id)}
      onDrop={(event) => onDrop(event, page.id)}
      className={`flex flex-col gap-2 rounded-xl border p-2 transition-colors ${
        isActive ? "border-amber-400 bg-amber-50" : "border-gray-200 hover:border-gray-300"
      } ${isDragOver ? "ring-2 ring-amber-400" : ""}`}
    >
      <button
        className="relative flex items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white"
        style={{ width: "100%", height: THUMB_HEIGHT, aspectRatio: `${THUMB_WIDTH} / ${THUMB_HEIGHT}` }}
        onClick={() => onActivate(page.id)}
        aria-label={t.activateAria(page.name || t.pageDefaultName(index + 1))}
        title={`${page.width} x ${page.height}`}
      >
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          <FileImage size={20} className="text-gray-300" />
        )}
        {isRendering && <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-400" />}
        {isActive && (
          <span className="absolute left-1 top-1 rounded bg-amber-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
            {t.active}
          </span>
        )}
      </button>

      <div className="flex items-center gap-1">
        {editing ? (
          <input
            autoFocus
            className="min-w-0 flex-1 rounded border border-amber-300 px-1.5 py-0.5 text-xs"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              onRename(page.id, draft.trim() || t.pageDefaultName(index + 1));
              setEditing(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                setDraft(page.name || t.pageDefaultName(index + 1));
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            className="min-w-0 flex-1 truncate text-left text-xs font-medium text-gray-700"
            onDoubleClick={() => {
              setDraft(page.name || t.pageDefaultName(index + 1));
              setEditing(true);
            }}
            title={t.doubleClickToRename}
          >
            {index + 1}. {page.name || t.pageDefaultName(index + 1)}
          </button>
        )}
      </div>

      <div className="flex items-center gap-0.5">
        <button
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:pointer-events-none disabled:opacity-30"
          onClick={() => onMoveToStart(page.id)}
          disabled={isFirst}
          title={t.moveToBeginning}
          aria-label={t.moveToBeginning}
        >
          <ChevronsUp size={13} />
        </button>
        <button
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:pointer-events-none disabled:opacity-30"
          onClick={() => onMoveUp(page.id)}
          disabled={isFirst}
          title={t.moveUp}
          aria-label={t.moveUp}
        >
          <ChevronUp size={13} />
        </button>
        <button
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:pointer-events-none disabled:opacity-30"
          onClick={() => onMoveDown(page.id)}
          disabled={isLast}
          title={t.moveDown}
          aria-label={t.moveDown}
        >
          <ChevronDown size={13} />
        </button>
        <button
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:pointer-events-none disabled:opacity-30"
          onClick={() => onMoveToEnd(page.id)}
          disabled={isLast}
          title={t.moveToEnd}
          aria-label={t.moveToEnd}
        >
          <ChevronsDown size={13} />
        </button>
      </div>

      <div className="flex items-center justify-between gap-1">
        <ColorField label="" value={page.background || "#ffffff"} onChange={(color) => onBackgroundChange(page.id, color)} />
        <span className="truncate text-[10px] text-gray-400">
          {page.width}×{page.height}
        </span>
      </div>

      {/* Phase 12 — page duration + outgoing transition (spec §30/§32). */}
      <div className="flex items-center gap-1 text-[10px] text-gray-500">
        <label className="flex items-center gap-1">
          <input
            type="number"
            min={0.5}
            max={300}
            step={0.5}
            value={((page.duration ?? DEFAULT_PAGE_DURATION_MS) / 1000).toFixed(1)}
            onChange={(event) => onSetDuration(page.id, Math.round(Number(event.target.value) * 1000))}
            className="w-12 rounded border border-gray-200 px-1 py-0.5 text-[10px]"
            aria-label={`Duration for ${page.name || `Page ${index + 1}`}`}
          />
          s
        </label>
        <select
          value={page.transition?.type || "none"}
          onChange={(event) => onSetTransition(page.id, { type: event.target.value })}
          className="min-w-0 flex-1 rounded border border-gray-200 px-1 py-0.5 text-[10px]"
          aria-label={`Transition after ${page.name || `Page ${index + 1}`}`}
        >
          {TRANSITION_TYPE_LIST.map((t) => (
            <option key={t} value={t}>{getTransitionPresetLabel(t)}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-end gap-0.5">
        <button
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          onClick={() => onOpenResize(page.id)}
          title={t.resizePage}
          aria-label={t.resizePage}
        >
          <FileImage size={13} />
        </button>
        <button
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          onClick={() => onDuplicate(page.id)}
          title={t.duplicatePage}
          aria-label={t.duplicatePage}
        >
          <Copy size={13} />
        </button>
        <button
          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:pointer-events-none disabled:opacity-30"
          onClick={() => onDelete(page.id)}
          disabled={isOnly}
          title={isOnly ? t.cantDeleteOnlyPage : t.deletePage}
          aria-label={isOnly ? t.cantDeleteOnlyPage : t.deletePage}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// Bottom StatusBar's PagesPopover and this panel call the exact same
// App.jsx functions (add/duplicate/rename/delete/reorder/background) —
// one shared state source, per the Phase 5 requirement, just two UIs.
export default function PagesPanel({
  pages,
  items,
  activePageId,
  onActivate,
  onAdd,
  onDuplicate,
  onDelete,
  onRename,
  onReorder,
  onMoveUp,
  onMoveDown,
  onMoveToStart,
  onMoveToEnd,
  onBackgroundChange,
  onOpenResize,
  onSetDuration,
  onSetTransition,
  onApplyDurationToAll,
  onApplyTransitionToAll,
  pageNumbers,
  onChangePageNumbers,
}) {
  const { language } = useLanguage();
  const t = PANEL_STRINGS[language].pages;
  const { thumbnails, renderingPageId, handleCapture } = usePageThumbnails(pages, items);
  const activePage = pages.find((p) => p.id === activePageId) || pages[0];
  const [dragOverId, setDragOverId] = useState(null);
  const dragIdRef = React.useRef(null);

  function handleDragStart(event, pageId) {
    dragIdRef.current = pageId;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", pageId);
  }

  function handleDragOver(event, pageId) {
    event.preventDefault();
    if (dragIdRef.current && dragIdRef.current !== pageId) setDragOverId(pageId);
  }

  function handleDrop(event, targetPageId) {
    event.preventDefault();
    setDragOverId(null);
    const draggedId = dragIdRef.current;
    dragIdRef.current = null;
    if (!draggedId || draggedId === targetPageId) return;
    onReorder(draggedId, targetPageId);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">{t.title}</h3>
        <span className="text-[11px] font-medium text-gray-400">{t.pagesCount(pages.length)}</span>
      </div>

      {onChangePageNumbers && (
        <div className="flex shrink-0 flex-col gap-2 rounded-xl border border-gray-200 p-2.5">
          <label className="flex items-center justify-between gap-2 text-xs font-medium text-gray-700">
            {t.pageNumbers}
            <input
              type="checkbox"
              checked={!!pageNumbers?.enabled}
              onChange={(event) => onChangePageNumbers({ ...pageNumbers, enabled: event.target.checked })}
              className="h-3.5 w-3.5 rounded border-gray-300"
              aria-label={t.pageNumbers}
            />
          </label>
          {pageNumbers?.enabled && (
            <div className="grid grid-cols-3 gap-1.5">
              {PAGE_NUMBER_POSITIONS.map((position) => (
                <button
                  key={position}
                  type="button"
                  className={`relative h-8 rounded-lg border ${
                    pageNumbers.position === position ? "border-amber-400 bg-amber-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => onChangePageNumbers({ ...pageNumbers, position })}
                  title={t.pageNumberPositions[position]}
                  aria-label={t.pageNumberPositions[position]}
                >
                  <span
                    className={`absolute h-1.5 w-1.5 rounded-full ${
                      pageNumbers.position === position ? "bg-amber-600" : "bg-gray-400"
                    } ${pageNumberDotClass(position)}`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto pb-2">
        {pages.map((page, index) => (
          <PageRow
            key={page.id}
            page={page}
            index={index}
            isActive={page.id === activePageId}
            isOnly={pages.length === 1}
            isFirst={index === 0}
            isLast={index === pages.length - 1}
            thumbnailUrl={thumbnails.get(page.id)}
            isRendering={renderingPageId === page.id}
            isDragOver={dragOverId === page.id}
            onActivate={onActivate}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onRename={onRename}
            onBackgroundChange={onBackgroundChange}
            onOpenResize={onOpenResize}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onMoveToStart={onMoveToStart}
            onMoveToEnd={onMoveToEnd}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onSetDuration={onSetDuration}
            onSetTransition={onSetTransition}
          />
        ))}
      </div>

      {pages.length > 1 && (activePage?.duration || activePage?.transition) && (
        <div className="flex gap-1.5 text-[10px]">
          <button
            className="flex-1 rounded border border-gray-200 py-1 text-gray-500 hover:bg-gray-50"
            onClick={() => onApplyDurationToAll(activePage?.duration ?? DEFAULT_PAGE_DURATION_MS)}
            title={t.applyDurationTitle}
          >
            {t.durationToAllPages}
          </button>
          <button
            className="flex-1 rounded border border-gray-200 py-1 text-gray-500 hover:bg-gray-50"
            onClick={() => onApplyTransitionToAll(activePage?.transition || { type: "none" })}
            title={t.applyTransitionTitle}
          >
            {t.transitionToAllPages}
          </button>
        </div>
      )}

      <button
        className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2 text-xs font-medium text-gray-500 hover:border-amber-400 hover:text-amber-700"
        onClick={onAdd}
      >
        <Plus size={14} /> {t.addPage}
      </button>

      {renderingPageId && (
        <ThumbnailHost page={pages.find((p) => p.id === renderingPageId)} items={items} onCapture={(url) => handleCapture(renderingPageId, url)} />
      )}
    </div>
  );
}

// Mounts exactly one offscreen render at a time (the queue's current
// page) — kept as a separate always-invisible instance so the per-row
// placeholder above doesn't need to duplicate the real capture callback.
function ThumbnailHost({ page, items, onCapture }) {
  if (!page) return null;
  return (
    <div style={{ position: "fixed", left: -9999, top: -9999 }} aria-hidden="true">
      <ThumbnailStage page={page} items={items} width={THUMB_WIDTH} height={THUMB_HEIGHT} onCapture={onCapture} />
    </div>
  );
}
