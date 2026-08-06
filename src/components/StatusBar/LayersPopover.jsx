import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronUp, Eye, EyeOff, Layers, Lock, Unlock } from "lucide-react";
import PopoverPortal from "./PopoverPortal";
import { isEffectivelyHidden, isEffectivelyLocked } from "../../hierarchy";
import { layerLabel } from "../LeftSidebar/panels/LayerRow";

function LayerRow({ item, isSelected, itemsById, onSelect, onToggleHidden, onToggleLocked, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(layerLabel(item));
  const effectivelyHidden = isEffectivelyHidden(item, itemsById);
  const effectivelyLocked = isEffectivelyLocked(item, itemsById);

  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
        isSelected ? "bg-amber-50" : "hover:bg-gray-50"
      }`}
    >
      {editing ? (
        <input
          autoFocus
          className="flex-1 rounded border border-amber-300 px-1.5 py-0.5 text-xs"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            onRename(item.id, draft.trim() || layerLabel(item));
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      ) : (
        <button
          className={`flex-1 truncate text-left text-xs font-medium ${
            isSelected ? "text-amber-700" : "text-gray-600"
          } ${effectivelyHidden ? "opacity-40" : ""}`}
          onClick={(event) =>
            onSelect(item.id, { additive: event.shiftKey || event.metaKey || event.ctrlKey })
          }
          onDoubleClick={() => {
            setDraft(layerLabel(item));
            setEditing(true);
          }}
        >
          {layerLabel(item)}
          {item.type === "group" && (
            <span className="ml-1.5 rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-600">G</span>
          )}
        </button>
      )}

      <button
        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        onClick={() => onToggleHidden(item.id)}
        title={item.hidden ? "Show layer" : effectivelyHidden ? "Hidden by parent group" : "Hide layer"}
      >
        {effectivelyHidden ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      <button
        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        onClick={() => onToggleLocked(item.id)}
        title={item.locked ? "Unlock layer" : effectivelyLocked ? "Locked by parent group" : "Lock layer"}
      >
        {effectivelyLocked ? <Lock size={13} /> : <Unlock size={13} />}
      </button>
    </div>
  );
}

// A quick flat-list companion to the full hierarchical Layers sidebar
// panel — both call the exact same App.jsx selection/rename/toggle
// functions (one state source), just two different UIs for two different
// levels of detail.
export default function LayersPopover({ items, selectedIds, onSelect, onToggleHidden, onToggleLocked, onRename }) {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const triggerRef = useRef(null);
  const contentRef = useRef(null);
  const itemsById = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);

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

  return (
    <>
      <button
        ref={triggerRef}
        className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${
          open ? "bg-gray-100 text-gray-800" : "text-gray-500 hover:bg-gray-100"
        }`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Layers size={13} /> Layers ({items.length}) <ChevronUp size={12} />
      </button>
      <PopoverPortal ref={contentRef} anchorRect={anchorRect} align="right">
        {open && (
          <div className="max-h-96 w-64 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
            {items.length === 0 ? (
              <p className="px-2 py-3 text-xs text-gray-400">No layers yet.</p>
            ) : (
              [...items]
                .reverse()
                .map((item) => (
                  <LayerRow
                    key={item.id}
                    item={item}
                    itemsById={itemsById}
                    isSelected={selectedIds.includes(item.id)}
                    onSelect={onSelect}
                    onToggleHidden={onToggleHidden}
                    onToggleLocked={onToggleLocked}
                    onRename={onRename}
                  />
                ))
            )}
          </div>
        )}
      </PopoverPortal>
    </>
  );
}
