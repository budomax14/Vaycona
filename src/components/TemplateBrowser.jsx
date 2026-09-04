import React, { useEffect, useMemo, useRef, useState } from "react";
import { Heart, Layers, Lock, MoreVertical, Plus, RectangleHorizontal, RectangleVertical, Repeat2, Search, Trash2, X } from "lucide-react";
import TemplateMiniPreview from "./TemplateMiniPreview";
import { PAGE_SIZE_PRESETS, UNITS, getUnit, orientationOf } from "../pageSizes";
import { TEMPLATE_CATEGORIES } from "../templateService";
import { TIER_RANK } from "../subscriptionContext";

const SORT_OPTIONS = [
  { key: "recommended", label: "Recommended" },
  { key: "recent-used", label: "Recently used" },
  { key: "recent-created", label: "Recently created" },
  { key: "name", label: "Name" },
  { key: "most-used", label: "Most used" },
];

function toUnit(px, unitKey) {
  return Math.round(getUnit(unitKey).fromPx(px) * 100) / 100;
}

function matchesSearch(t, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    t.name.toLowerCase().includes(q) ||
    (t.description || "").toLowerCase().includes(q) ||
    (t.category || "").toLowerCase().includes(q) ||
    (t.tags || []).some((tag) => tag.includes(q)) ||
    `${t.pageWidth}x${t.pageHeight}`.includes(q)
  );
}

// Template Browser + New Design entry point (Phase 8 spec §9/§47) — this
// app has no separate home screen, so per the spec's own fallback this
// dialog IS the "New Design" flow: blank/custom size at the top, then
// search/filter/favorite/recent template browsing below. Reusable
// pages/sections get their own tab rather than a third separate dialog.
export default function TemplateBrowser({
  isOpen,
  onClose,
  templates,
  reusablePages,
  reusableSections,
  onSelectTemplate,
  onToggleFavorite,
  onDeleteTemplate,
  onDuplicateTemplate,
  onCreateBlank,
  onInsertPage,
  onDeletePage,
  onInsertSection,
  onDeleteSection,
  userTier = "free",
  onRequireUpgrade,
  unit: sharedUnit,
  onUnitChange,
}) {
  const [tab, setTab] = useState("templates"); // templates | pages | sections
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState(null);
  const [orientation, setOrientation] = useState(null);
  const [scope, setScope] = useState("all"); // all | favorites | recent | mine
  const [sort, setSort] = useState("recommended");
  // Defaults stay the same physical size as before (1080x1080px), just
  // expressed in inches to match the new default unit.
  const [customWidth, setCustomWidth] = useState(11.25);
  const [customHeight, setCustomHeight] = useState(11.25);
  const [customUnit, setCustomUnit] = useState(sharedUnit || "in");
  const closeRef = useRef(null);

  function changeCustomUnit(nextUnitKey) {
    const currentUnit = getUnit(customUnit);
    const nextUnit = getUnit(nextUnitKey);
    const widthPx = currentUnit.toPx(customWidth);
    const heightPx = currentUnit.toPx(customHeight);
    setCustomUnit(nextUnitKey);
    setCustomWidth(Math.round(nextUnit.fromPx(widthPx) * 100) / 100);
    setCustomHeight(Math.round(nextUnit.fromPx(heightPx) * 100) / 100);
    onUnitChange?.(nextUnitKey);
  }

  function swapCustomDimensions() {
    setCustomWidth(customHeight);
    setCustomHeight(customWidth);
  }

  function setCustomOrientation(nextOrientation) {
    const [small, large] = [Math.min(customWidth, customHeight), Math.max(customWidth, customHeight)];
    if (nextOrientation === "portrait") {
      setCustomWidth(small);
      setCustomHeight(large);
    } else {
      setCustomWidth(large);
      setCustomHeight(small);
    }
  }

  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
  }, [isOpen]);

  // Opening the dialog adopts whichever unit is active elsewhere in the app
  // (the ruler, the resize dialog) so this never shows a stale unit — see
  // changeCustomUnit above for the reverse direction.
  useEffect(() => {
    if (!isOpen || !sharedUnit || sharedUnit === customUnit) return;
    const currentUnit = getUnit(customUnit);
    const nextUnit = getUnit(sharedUnit);
    const widthPx = currentUnit.toPx(customWidth);
    const heightPx = currentUnit.toPx(customHeight);
    setCustomUnit(sharedUnit);
    setCustomWidth(Math.round(nextUnit.fromPx(widthPx) * 100) / 100);
    setCustomHeight(Math.round(nextUnit.fromPx(heightPx) * 100) / 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const filtered = useMemo(() => {
    let list = templates;
    if (scope === "favorites") list = list.filter((t) => t.favorite);
    else if (scope === "recent") list = list.filter((t) => t.lastUsedAt);
    else if (scope === "mine") list = list.filter((t) => !t.builtIn);
    if (category) list = list.filter((t) => t.category === category);
    if (orientation) list = list.filter((t) => orientationOf(t.pageWidth, t.pageHeight) === orientation);
    list = list.filter((t) => matchesSearch(t, debouncedQuery));

    const sorted = [...list];
    if (sort === "recent-used") sorted.sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0));
    else if (sort === "recent-created") sorted.sort((a, b) => b.createdAt - a.createdAt);
    else if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "most-used") sorted.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
    // "recommended" trusts the order `templates` already arrives in — App.jsx's
    // templateSummaries sorts by sortOrder, the admin's drag-to-reorder order
    // from the Template Admin dashboard — so no extra sort is applied here.
    return sorted;
  }, [templates, scope, category, orientation, debouncedQuery, sort]);

  if (!isOpen) return null;

  const activeFilterCount = (category ? 1 : 0) + (orientation ? 1 : 0) + (scope !== "all" ? 1 : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-browser-title"
        className="flex h-[85vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-4">
          <button
            ref={closeRef}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
          <h2 id="template-browser-title" className="flex-1 text-center text-base font-semibold text-gray-900">
            New design
          </h2>
          {/* Mirrors the close button's width so the title lands in the true center. */}
          <span className="h-8 w-8 shrink-0" aria-hidden="true" />
        </div>

        <div className="flex gap-1 border-b border-gray-100 px-5 pt-2">
          {[
            { key: "templates", label: "Templates" },
            { key: "pages", label: "Reusable pages" },
            { key: "sections", label: "Reusable sections" },
          ].map((t) => (
            <button
              key={t.key}
              className={`rounded-t-lg px-3 py-2 text-sm font-medium ${
                tab === t.key ? "border-b-2 border-amber-600 text-amber-700" : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "templates" && (
          <>
            <div className="border-b border-gray-100 px-5 py-3">
              <div className="mb-2 rounded-xl border border-dashed border-gray-200 p-3">
                <div className="mb-2.5 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Unit</h3>
                  <div className="flex gap-1 rounded-lg border border-gray-200 p-1">
                    {UNITS.map((u) => (
                      <button
                        key={u.key}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                          customUnit === u.key ? "bg-amber-100 text-amber-700" : "text-gray-500 hover:bg-gray-50"
                        }`}
                        onClick={() => changeCustomUnit(u.key)}
                        title={u.label}
                      >
                        {u.key}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-2.5 flex flex-wrap gap-1.5">
                  {PAGE_SIZE_PRESETS.slice(0, 6).map((preset) => {
                    const unitDef = getUnit(customUnit);
                    const displayWidth = Math.round(unitDef.fromPx(preset.width) * 100) / 100;
                    const displayHeight = Math.round(unitDef.fromPx(preset.height) * 100) / 100;
                    return (
                      <button
                        key={preset.key}
                        className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-left text-xs text-gray-600 hover:border-amber-300 hover:bg-amber-50/50 hover:text-amber-700"
                        onClick={() => onCreateBlank(preset.width, preset.height, preset.label)}
                      >
                        <span className="block font-medium">{preset.label}</span>
                        <span className="block text-[10px] text-gray-400">
                          {displayWidth} × {displayHeight} {customUnit}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <button
                    className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                    onClick={() => onCreateBlank(customWidth && getUnit(customUnit).toPx(customWidth), customHeight && getUnit(customUnit).toPx(customHeight))}
                  >
                    <Plus size={14} /> Blank design
                  </button>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-medium text-gray-500">Width</span>
                    <input
                      type="number"
                      min="1"
                      aria-label="Custom width"
                      className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                      value={customWidth}
                      onChange={(event) => setCustomWidth(Number(event.target.value))}
                    />
                  </label>
                  <button
                    className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"
                    onClick={swapCustomDimensions}
                    title="Swap width and height"
                    aria-label="Swap width and height"
                  >
                    <Repeat2 size={14} />
                  </button>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-medium text-gray-500">Height</span>
                    <input
                      type="number"
                      min="1"
                      aria-label="Custom height"
                      className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                      value={customHeight}
                      onChange={(event) => setCustomHeight(Number(event.target.value))}
                    />
                  </label>
                  <div className="flex gap-1 rounded-lg border border-gray-200 p-1">
                    <button
                      className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium ${
                        customHeight >= customWidth ? "bg-amber-100 text-amber-700" : "text-gray-500 hover:bg-gray-50"
                      }`}
                      onClick={() => setCustomOrientation("portrait")}
                    >
                      <RectangleVertical size={13} /> Portrait
                    </button>
                    <button
                      className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium ${
                        customHeight < customWidth ? "bg-amber-100 text-amber-700" : "text-gray-500 hover:bg-gray-50"
                      }`}
                      onClick={() => setCustomOrientation("landscape")}
                    >
                      <RectangleHorizontal size={13} /> Landscape
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    aria-label="Search templates"
                    placeholder="Search by name, tag, or size…"
                    className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-7 text-sm outline-none focus:border-amber-400"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  {query && (
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setQuery("")}
                      aria-label="Clear search"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <select
                  aria-label="Sort templates"
                  className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-600"
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {["all", "favorites", "recent", "mine"].map((s) => (
                  <button
                    key={s}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      scope === s ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                    onClick={() => setScope(s)}
                  >
                    {s === "all" ? "All" : s === "favorites" ? "Favorites" : s === "recent" ? "Recently used" : "My templates"}
                  </button>
                ))}
                <span className="mx-1 h-3 w-px bg-gray-200" />
                {TEMPLATE_CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      category === c.key ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                    onClick={() => setCategory((cur) => (cur === c.key ? null : c.key))}
                  >
                    {c.label}
                  </button>
                ))}
                <span className="mx-1 h-3 w-px bg-gray-200" />
                {["square", "landscape", "portrait"].map((o) => (
                  <button
                    key={o}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                      orientation === o ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                    onClick={() => setOrientation((cur) => (cur === o ? null : o))}
                  >
                    {o}
                  </button>
                ))}
                {activeFilterCount > 0 && (
                  <button
                    className="ml-1 text-xs font-medium text-amber-600 hover:underline"
                    onClick={() => {
                      setCategory(null);
                      setOrientation(null);
                      setScope("all");
                    }}
                  >
                    Reset filters
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {filtered.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-400">
                  <p className="mb-2">No templates match your search.</p>
                  <button
                    className="text-amber-600 hover:underline"
                    onClick={() => {
                      setQuery("");
                      setCategory(null);
                      setOrientation(null);
                      setScope("all");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {filtered.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      unit={customUnit}
                      locked={TIER_RANK[template.tier || "free"] > TIER_RANK[userTier]}
                      onSelect={() => onSelectTemplate(template.id)}
                      onRequireUpgrade={onRequireUpgrade}
                      onToggleFavorite={() => onToggleFavorite(template.id)}
                      onDelete={!template.builtIn ? () => onDeleteTemplate(template.id) : null}
                      onDuplicate={() => onDuplicateTemplate(template.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === "pages" && (
          <ReusableList
            emptyLabel="No reusable pages yet. Use “Save page as reusable” from the Pages panel."
            items={reusablePages}
            onInsert={onInsertPage}
            onDelete={onDeletePage}
          />
        )}
        {tab === "sections" && (
          <ReusableList
            emptyLabel="No reusable sections yet. Select objects, then “Save as reusable section.”"
            items={reusableSections}
            onInsert={onInsertSection}
            onDelete={onDeleteSection}
          />
        )}
      </div>
    </div>
  );
}

function TemplateCard({ template, unit = "in", locked, onSelect, onRequireUpgrade, onToggleFavorite, onDelete, onDuplicate }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const orientation = orientationOf(template.pageWidth, template.pageHeight);
  return (
    <div className="group relative overflow-hidden rounded-xl border border-gray-200 hover:border-amber-300">
      <button
        className="block w-full text-left"
        onClick={locked ? onRequireUpgrade : onSelect}
        aria-label={
          locked
            ? `${template.name} requires an upgrade`
            : `Preview ${template.name}, ${toUnit(template.pageWidth, unit)} by ${toUnit(template.pageHeight, unit)} ${getUnit(unit).label}`
        }
      >
        <div className="relative aspect-square w-full bg-gray-50">
          {template.thumbnail ? (
            <img src={template.thumbnail} alt="" className="h-full w-full object-cover" />
          ) : (
            <TemplateMiniPreview
              page={template.previewSnapshot?.page || { id: "x", width: template.pageWidth || 1, height: template.pageHeight || 1, background: "#fff" }}
              items={template.previewSnapshot?.items || []}
              className="h-full w-full"
            />
          )}
          {locked && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[10px] font-semibold text-amber-700">
                <Lock size={11} />
                {template.tier === "business" ? "Business" : "Pro"}
              </span>
            </div>
          )}
        </div>
        <div className="p-2">
          <div className="truncate text-xs font-medium text-gray-800">{template.name}</div>
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span>
              {toUnit(template.pageWidth, unit)}×{toUnit(template.pageHeight, unit)} {unit} · {orientation}
            </span>
            {!template.builtIn && <span className="rounded bg-amber-50 px-1 text-amber-500">Mine</span>}
          </div>
        </div>
      </button>

      <button
        className={`absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1.5 shadow-sm ${template.favorite ? "text-red-500" : "text-gray-400"}`}
        onClick={onToggleFavorite}
        aria-label={template.favorite ? `Unfavorite ${template.name}` : `Favorite ${template.name}`}
      >
        <Heart size={13} fill={template.favorite ? "currentColor" : "none"} />
      </button>

      <div className="absolute left-1.5 top-1.5">
        <button
          className="rounded-full bg-white/90 p-1.5 text-gray-500 shadow-sm"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={`More actions for ${template.name}`}
          aria-expanded={menuOpen}
        >
          <MoreVertical size={13} />
        </button>
        {menuOpen && (
          <div className="absolute left-0 top-full z-10 mt-1 w-32 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
            <button
              className="w-full rounded px-2 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
              onClick={() => {
                setMenuOpen(false);
                onDuplicate();
              }}
            >
              Duplicate
            </button>
            {onDelete && (
              <button
                className="w-full rounded px-2 py-1.5 text-left text-xs text-red-600 hover:bg-red-50"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ReusableList({ items, emptyLabel, onInsert, onDelete }) {
  return (
    <div className="flex-1 overflow-y-auto p-5">
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-gray-400">
          <Layers size={22} className="text-gray-300" />
          <p className="max-w-xs">{emptyLabel}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-gray-200 p-2">
              <div className="mb-1.5 aspect-square w-full overflow-hidden rounded-lg bg-gray-50">
                <TemplateMiniPreview
                  page={item.previewSnapshot?.page || { id: "x", width: item.pageWidth || 1, height: item.pageHeight || 1, background: "#fff" }}
                  items={item.previewSnapshot?.items || []}
                  className="h-full w-full"
                />
              </div>
              <div className="truncate text-xs font-medium text-gray-700">{item.name}</div>
              <div className="mt-1.5 flex gap-1">
                <button
                  className="flex-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100"
                  onClick={() => onInsert(item.id)}
                >
                  Insert
                </button>
                <button
                  className="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  onClick={() => onDelete(item.id)}
                  aria-label={`Delete ${item.name}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
