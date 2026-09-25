import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { FONT_CATEGORIES, FONT_LIBRARY } from "../../fontLibrary";
import { useFontLoader } from "../../useFontLoader";
import { useLanguage } from "../../languageContext";
import { TEXT_PROPERTIES_STRINGS } from "../../i18n/textProperties";
import ResponsiveSheet from "../ResponsiveSheet/ResponsiveSheet";
import { useBreakpoint } from "../../useBreakpoint";

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
  try {
    localStorage.setItem(RECENT_FONTS_KEY, JSON.stringify(next));
  } catch {
    // Storage full/blocked — recent fonts just won't persist.
  }
}

// `lazy` (phone): only load this row's font once it scrolls into view.
// Opening the picker used to start loading every library font at once —
// dozens of stylesheet + font-file downloads, which stalled the sheet's
// opening for over half a second and weighed on iOS memory.
function FontRow({ name, cssStack, onSelect, lazy = false }) {
  const { language } = useLanguage();
  const t = TEXT_PROPERTIES_STRINGS[language].fontFamilyPicker;
  const rowRef = useRef(null);
  const [inView, setInView] = useState(!lazy);
  useEffect(() => {
    if (inView || !rowRef.current || typeof IntersectionObserver === "undefined") {
      if (!inView) setInView(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px 0px" }
    );
    observer.observe(rowRef.current);
    return () => observer.disconnect();
  }, [inView]);
  const ready = useFontLoader(inView ? name : null);
  return (
    <button
      ref={rowRef}
      type="button"
      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-gray-100"
      style={{ fontFamily: ready ? cssStack : undefined }}
      onClick={onSelect}
    >
      <span>{name}</span>
      {!ready && <span className="text-[10px] text-gray-400">{t.loading}</span>}
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
  const { language } = useLanguage();
  const t = TEXT_PROPERTIES_STRINGS[language].fontFamilyPicker;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState(loadRecentFonts);
  const anchorRef = useRef(null);
  // Phone: a bottom sheet (ResponsiveSheet) instead of the anchored popover,
  // and no search autofocus. Autofocus raised the iOS keyboard, whose
  // viewport resize/scroll closed the popover the instant it opened — the
  // font list never stayed up long enough to pick from.
  const { isMobile } = useBreakpoint();

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
        onClick={() => {
          // Phone: start each open with the full list, not the last search.
          if (isMobile && !open) setQuery("");
          setOpen((v) => !v);
        }}
        aria-label={t.fontFamilyLabel}
      >
        <span className="max-w-[100px] truncate">{mixed ? t.mixed : value || "Arial"}</span>
        <ChevronDown size={14} />
      </button>

      <ResponsiveSheet isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <div className={isMobile ? "w-full" : "w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-lg"} data-text-toolbar-safe>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <input
              autoFocus={!isMobile}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-7 pr-2 text-sm outline-none focus:border-amber-400 focus:bg-white"
            />
          </div>

          <div className={isMobile ? "max-h-[50vh] overflow-y-auto overscroll-contain" : "max-h-64 overflow-y-auto"}>
            {!query && recent.length > 0 && (
              <>
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t.recentlyUsed}</div>
                {recent.map((name) => {
                  const entry = FONT_LIBRARY.find((f) => f.name === name);
                  if (!entry) return null;
                  return <FontRow key={name} name={entry.name} cssStack={entry.cssStack} onSelect={() => select(entry.name)} lazy={isMobile} />;
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
                    <FontRow key={entry.name} name={entry.name} cssStack={entry.cssStack} onSelect={() => select(entry.name)} lazy={isMobile} />
                  ))}
                </div>
              );
            })}
            {filtered.length === 0 && <p className="px-2 py-3 text-sm text-gray-400">{t.noFontsMatch(query)}</p>}
          </div>
        </div>
      </ResponsiveSheet>
    </div>
  );
}
