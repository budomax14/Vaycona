import React, { useState } from "react";
import { ChevronDown, ChevronsDown, ChevronsUp, ChevronUp, Copy, FileImage, Plus, Trash2 } from "lucide-react";
import { ColorField } from "../../PropertiesToolbar/toolbarUi";
import ThumbnailStage from "./ThumbnailStage";
import { usePageThumbnails } from "./usePageThumbnails";
import { DEFAULT_PAGE_DURATION_MS } from "../../../animation/animationSchema";
import { TRANSITION_TYPE_LIST, getTransitionPresetLabel } from "../../../animation/transitionService";

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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(page.name || `Page ${index + 1}`);

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
        aria-label={`Activate ${page.name || `Page ${index + 1}`}`}
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
            Active
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
              onRename(page.id, draft.trim() || `Page ${index + 1}`);
              setEditing(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                setDraft(page.name || `Page ${index + 1}`);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            className="min-w-0 flex-1 truncate text-left text-xs font-medium text-gray-700"
            onDoubleClick={() => {
              setDraft(page.name || `Page ${index + 1}`);
              setEditing(true);
            }}
            title="Double-click to rename"
          >
            {index + 1}. {page.name || `Page ${index + 1}`}
          </button>
        )}
      </div>

      <div className="flex items-center gap-0.5">
        <button
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:pointer-events-none disabled:opacity-30"
          onClick={() => onMoveToStart(page.id)}
          disabled={isFirst}
          title="Move to beginning"
          aria-label="Move page to beginning"
        >
          <ChevronsUp size={13} />
        </button>
        <button
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:pointer-events-none disabled:opacity-30"
          onClick={() => onMoveUp(page.id)}
          disabled={isFirst}
          title="Move up"
          aria-label="Move page up"
        >
          <ChevronUp size={13} />
        </button>
        <button
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:pointer-events-none disabled:opacity-30"
          onClick={() => onMoveDown(page.id)}
          disabled={isLast}
          title="Move down"
          aria-label="Move page down"
        >
          <ChevronDown size={13} />
        </button>
        <button
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:pointer-events-none disabled:opacity-30"
          onClick={() => onMoveToEnd(page.id)}
          disabled={isLast}
          title="Move to end"
          aria-label="Move page to end"
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
          title="Resize page"
          aria-label="Resize page"
        >
          <FileImage size={13} />
        </button>
        <button
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          onClick={() => onDuplicate(page.id)}
          title="Duplicate page"
          aria-label="Duplicate page"
        >
          <Copy size={13} />
        </button>
        <button
          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:pointer-events-none disabled:opacity-30"
          onClick={() => onDelete(page.id)}
          disabled={isOnly}
          title={isOnly ? "Can't delete the only page" : "Delete page"}
          aria-label={isOnly ? "Can't delete the only page" : "Delete page"}
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
}) {
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
        <h3 className="text-sm font-semibold text-gray-800">Pages</h3>
        <span className="text-[11px] font-medium text-gray-400">{pages.length} pages</span>
      </div>

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
            title="Apply this page's duration to every page"
          >
            Duration → all pages
          </button>
          <button
            className="flex-1 rounded border border-gray-200 py-1 text-gray-500 hover:bg-gray-50"
            onClick={() => onApplyTransitionToAll(activePage?.transition || { type: "none" })}
            title="Apply this page's transition to every page boundary"
          >
            Transition → all pages
          </button>
        </div>
      )}

      <button
        className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2 text-xs font-medium text-gray-500 hover:border-amber-400 hover:text-amber-700"
        onClick={onAdd}
      >
        <Plus size={14} /> Add page
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
