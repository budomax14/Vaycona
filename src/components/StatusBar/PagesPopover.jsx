import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from "lucide-react";
import PopoverPortal from "./PopoverPortal";

function PageRow({ page, index, isActive, isOnly, onActivate, onDuplicate, onDelete, onRename, onMoveUp, onMoveDown, isFirst, isLast }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(page.name || `Page ${index + 1}`);

  return (
    <div
      className={`flex items-center gap-1 rounded-lg px-2 py-1.5 ${isActive ? "bg-amber-50" : "hover:bg-gray-50"}`}
    >
      {editing ? (
        <input
          autoFocus
          className="flex-1 rounded border border-amber-300 px-1.5 py-0.5 text-xs"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            onRename(page.id, draft.trim() || `Page ${index + 1}`);
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      ) : (
        <button
          className={`flex-1 truncate text-left text-xs font-medium ${isActive ? "text-amber-700" : "text-gray-600"}`}
          onClick={() => onActivate(page.id)}
          onDoubleClick={() => {
            setDraft(page.name || `Page ${index + 1}`);
            setEditing(true);
          }}
        >
          {page.name || `Page ${index + 1}`}
        </button>
      )}

      <button
        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:pointer-events-none disabled:opacity-30"
        onClick={() => onMoveUp(page.id)}
        disabled={isFirst}
        title="Move page up"
        aria-label="Move page up"
      >
        <ChevronUp size={13} />
      </button>
      <button
        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:pointer-events-none disabled:opacity-30"
        onClick={() => onMoveDown(page.id)}
        disabled={isLast}
        title="Move page down"
        aria-label="Move page down"
      >
        <ChevronDown size={13} />
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
  );
}

export default function PagesPopover({ pages, activePageId, onActivate, onAdd, onDuplicate, onDelete, onRename, onMoveUp, onMoveDown }) {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const triggerRef = useRef(null);
  const contentRef = useRef(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setAnchorRect(null);
      return;
    }
    setAnchorRect(triggerRef.current.getBoundingClientRect());
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function handleOutside(event) {
      const inTrigger = triggerRef.current?.contains(event.target);
      const inContent = contentRef.current?.contains(event.target);
      if (!inTrigger && !inContent) setOpen(false);
    }
    window.addEventListener("mousedown", handleOutside);
    return () => window.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const activeIndex = pages.findIndex((page) => page.id === activePageId);

  return (
    <>
      <button
        ref={triggerRef}
        className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${
          open ? "bg-gray-100 text-gray-800" : "text-gray-500 hover:bg-gray-100"
        }`}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Pages, ${activeIndex + 1} of ${pages.length}`}
        aria-expanded={open}
      >
        Pages ({pages.length}) <ChevronUp size={12} />
      </button>
      <PopoverPortal ref={contentRef} anchorRect={anchorRect} align="left">
        {open && (
          <div className="max-h-96 w-64 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
            {pages.map((page, index) => (
              <PageRow
                key={page.id}
                page={page}
                index={index}
                isActive={page.id === activePageId}
                isOnly={pages.length === 1}
                isFirst={index === 0}
                isLast={index === pages.length - 1}
                onActivate={onActivate}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                onRename={onRename}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
              />
            ))}
            <button
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-1.5 text-xs font-medium text-gray-500 hover:border-amber-400 hover:text-amber-700"
              onClick={onAdd}
            >
              <Plus size={13} /> Add page
            </button>
          </div>
        )}
      </PopoverPortal>
    </>
  );
}
