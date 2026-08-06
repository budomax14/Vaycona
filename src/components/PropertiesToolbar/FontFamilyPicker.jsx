import React, { useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { FONT_CATEGORIES, FONT_LIBRARY } from "../../fontLibrary";
import { useFontLoader } from "../../useFontLoader";
import ToolbarPopover from "./ToolbarPopover";

const RECENT_FONTS_KEY = "personal-canva-recent-fonts-v1";
const RECENT_FONTS_MAX = 6;

function loadRecentFonts() {
  try {
    const raw = localStorage.getItem(RECENT_FONTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function recordRecentFont(name) {
  const next = [name, ...loadRecentFonts().filter((f) => f !== name)].slice(0, RECENT_FONTS_MAX);
  localStorage.setItem(RECENT_FONTS_KEY, JSON.stringify(next));
}

function FontRow({ name, cssStack, onSelect }) {
  const ready = useFontLoader(name);
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-gray-100"
      style={{ fontFamily: ready ? cssStack : undefined }}
      onClick={onSelect}
    >
      <span>{name}</span>
      {!ready && <span className="text-[10px] text-gray-400">loading…</span>}
    </button>
  );
}

// Font-family selector: search by name, recently-used row, category
// labels, each entry previewed in its own typeface once loaded (loading
// state shown in the meantime — see useFontLoader.js). Fonts load on
// demand here, not at app startup. Opens via ToolbarPopover (portalled) —
// PropertiesToolbar's row clips ordinary anchored dropdowns, see that
// component's comment.
export default function FontFamilyPicker({ value, mixed, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState(loadRecentFonts);
  const anchorRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? FONT_LIBRARY.filter((f) => f.name.toLowerCase().includes(q)) : FONT_LIBRARY;
  }, [query]);

  function select(name) {
    recordRecentFont(name);
    setRecent(loadRecentFonts());
    onChange(name);
    setOpen(false);
  }

  return (
    <div className="relative shrink-0" data-text-toolbar-safe>
      <button
        ref={anchorRef}
        type="button"
        className="flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm text-gray-700 hover:border-amber-400"
        onClick={() => setOpen((v) => !v)}
        aria-label="Font family"
      >
        <span className="max-w-[100px] truncate">{mixed ? "Mixed" : value || "Arial"}</span>
        <ChevronDown size={14} />
      </button>

      <ToolbarPopover isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <div className="w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-lg" data-text-toolbar-safe>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search fonts"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-7 pr-2 text-sm outline-none focus:border-amber-400 focus:bg-white"
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {!query && recent.length > 0 && (
              <>
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Recently used</div>
                {recent.map((name) => {
                  const entry = FONT_LIBRARY.find((f) => f.name === name);
                  if (!entry) return null;
                  return <FontRow key={name} name={entry.name} cssStack={entry.cssStack} onSelect={() => select(entry.name)} />;
                })}
              </>
            )}
            {FONT_CATEGORIES.map((category) => {
              const inCategory = filtered.filter((f) => f.category === category);
              if (inCategory.length === 0) return null;
              return (
                <div key={category}>
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{category}</div>
                  {inCategory.map((entry) => (
                    <FontRow key={entry.name} name={entry.name} cssStack={entry.cssStack} onSelect={() => select(entry.name)} />
                  ))}
                </div>
              );
            })}
            {filtered.length === 0 && <p className="px-2 py-3 text-sm text-gray-400">No fonts match "{query}".</p>}
          </div>
        </div>
      </ToolbarPopover>
    </div>
  );
}
