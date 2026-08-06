import React, { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Lock, Plus, Trash2, Unlock, X } from "lucide-react";
import { GUIDE_COLORS, MAX_GUIDE_LABEL_LENGTH } from "../precisionDefaults";
import { formatBareValue, parseMeasurementInput, unitLabel } from "../measurement";

function GuideRow({ guide, pageName, unit, onUpdate, onDelete }) {
  const [posDraft, setPosDraft] = useState(formatBareValue(guide.pos, unit));
  const [labelDraft, setLabelDraft] = useState(guide.label || "");

  useEffect(() => setPosDraft(formatBareValue(guide.pos, unit)), [guide.pos, unit]);
  useEffect(() => setLabelDraft(guide.label || ""), [guide.label]);

  function commitPos() {
    const parsed = parseMeasurementInput(posDraft, unit);
    if (parsed.ok) onUpdate(guide.id, { pos: Math.round(parsed.px * 100) / 100 });
    else setPosDraft(formatBareValue(guide.pos, unit));
  }

  return (
    <div className="grid grid-cols-[20px_56px_1fr_70px_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-gray-50">
      <span
        className="h-3 w-3 shrink-0 rounded-full border border-white shadow"
        style={{ background: GUIDE_COLORS.find((c) => c.key === guide.color)?.value }}
        aria-hidden="true"
      />
      <span className="text-gray-500">{guide.orientation === "vertical" ? "Vert." : "Horiz."}</span>
      <input
        aria-label="Guide label"
        className="min-w-0 rounded border border-transparent bg-transparent px-1 py-0.5 text-gray-700 hover:border-gray-200 focus:border-amber-400 focus:bg-white focus:outline-none"
        value={labelDraft}
        maxLength={MAX_GUIDE_LABEL_LENGTH}
        placeholder={pageName || "Global"}
        onChange={(event) => setLabelDraft(event.target.value)}
        onBlur={() => onUpdate(guide.id, { label: labelDraft })}
      />
      <div className="flex items-center gap-1">
        <input
          aria-label={`Position (${unitLabel(unit)})`}
          type="text"
          inputMode="decimal"
          className="w-14 rounded border border-gray-200 px-1.5 py-0.5 text-right text-gray-700 outline-none focus:border-amber-400"
          value={posDraft}
          onChange={(event) => setPosDraft(event.target.value)}
          onBlur={commitPos}
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        />
      </div>
      <div className="flex items-center gap-0.5">
        <button
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          onClick={() => onUpdate(guide.id, { locked: !guide.locked })}
          title={guide.locked ? "Unlock guide" : "Lock guide"}
          aria-label={guide.locked ? "Unlock guide" : "Lock guide"}
          aria-pressed={guide.locked}
        >
          {guide.locked ? <Lock size={12} /> : <Unlock size={12} />}
        </button>
        <button
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          onClick={() => onUpdate(guide.id, { hidden: !guide.hidden })}
          title={guide.hidden ? "Show guide" : "Hide guide"}
          aria-label={guide.hidden ? "Show guide" : "Hide guide"}
          aria-pressed={guide.hidden}
        >
          {guide.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
        <div className="flex items-center gap-0.5 rounded border border-gray-100 p-0.5" role="radiogroup" aria-label="Guide color">
          {GUIDE_COLORS.map((c) => (
            <button
              key={c.key}
              className={`h-3 w-3 rounded-full ${guide.color === c.key ? "ring-2 ring-offset-1 ring-amber-400" : ""}`}
              style={{ background: c.value }}
              onClick={() => onUpdate(guide.id, { color: c.key })}
              aria-label={`Set color ${c.key}`}
              role="radio"
              aria-checked={guide.color === c.key}
            />
          ))}
        </div>
        <button
          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
          onClick={() => onDelete(guide.id)}
          title="Delete guide"
          aria-label="Delete guide"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

export default function GuideManagerDialog({
  isOpen,
  onClose,
  guides,
  pages,
  activePageId,
  unit,
  onAdd,
  onUpdate,
  onDelete,
  onClearPage,
  onClearAll,
}) {
  const [scopeFilter, setScopeFilter] = useState("page"); // "page" | "all"
  const [newOrientation, setNewOrientation] = useState("horizontal");
  const [newPos, setNewPos] = useState("0");
  const [newScope, setNewScope] = useState("page"); // "page" | "global"
  const dialogRef = useRef(null);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    if (isOpen) window.setTimeout(() => firstFieldRef.current?.focus(), 10);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const pageName = (pageId) => pages.find((p) => p.id === pageId)?.name || null;
  const visibleGuides = guides.filter((g) => scopeFilter === "all" || g.pageId === activePageId || g.pageId === null);

  function handleAdd() {
    const parsed = parseMeasurementInput(newPos, unit);
    if (!parsed.ok) return;
    onAdd({ orientation: newOrientation, pos: Math.round(parsed.px * 100) / 100, pageId: newScope === "global" ? null : activePageId });
    setNewPos("0");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="presentation">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="guide-manager-title" className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 id="guide-manager-title" className="text-base font-semibold text-gray-900">Guide Manager</h2>
          <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label="Close Guide Manager">
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-gray-100 px-5 py-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-gray-500">
              Orientation
              <select ref={firstFieldRef} className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" value={newOrientation} onChange={(event) => setNewOrientation(event.target.value)}>
                <option value="horizontal">Horizontal</option>
                <option value="vertical">Vertical</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-500">
              {`Position (${unitLabel(unit)})`}
              <input
                type="text"
                inputMode="decimal"
                className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                value={newPos}
                onChange={(event) => setNewPos(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && handleAdd()}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-500">
              Scope
              <select className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" value={newScope} onChange={(event) => setNewScope(event.target.value)}>
                <option value="page">This page</option>
                <option value="global">All pages</option>
              </select>
            </label>
            <button className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700" onClick={handleAdd}>
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-2 text-xs">
          <div className="flex gap-1">
            <button className={`rounded-full px-2.5 py-1 font-medium ${scopeFilter === "page" ? "bg-amber-100 text-amber-700" : "text-gray-500 hover:bg-gray-100"}`} onClick={() => setScopeFilter("page")}>
              This page
            </button>
            <button className={`rounded-full px-2.5 py-1 font-medium ${scopeFilter === "all" ? "bg-amber-100 text-amber-700" : "text-gray-500 hover:bg-gray-100"}`} onClick={() => setScopeFilter("all")}>
              All pages ({guides.length})
            </button>
          </div>
          <span className="text-gray-400">{visibleGuides.length} guide{visibleGuides.length === 1 ? "" : "s"}</span>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-2">
          {visibleGuides.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-gray-400">No guides yet. Add one above, or drag from a ruler on the canvas.</p>
          ) : (
            visibleGuides.map((guide) => (
              <GuideRow key={guide.id} guide={guide} pageName={pageName(guide.pageId)} unit={unit} onUpdate={onUpdate} onDelete={onDelete} />
            ))
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
          <button className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100" onClick={() => onClearPage(activePageId)}>
            Clear this page's guides
          </button>
          <button
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            onClick={() => {
              if (window.confirm(`Delete all ${guides.length} guide(s) in this project? This cannot be undone (but can be undone via Undo).`)) onClearAll();
            }}
          >
            Clear all guides
          </button>
        </div>
      </div>
    </div>
  );
}
