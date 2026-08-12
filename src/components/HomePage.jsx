import React, { useMemo, useState } from "react";
import { LogOut, Plus, Search, Settings, User, X } from "lucide-react";
import TemplateMiniPreview from "./TemplateMiniPreview";
import { PAGE_SIZE_PRESETS, UNITS, getUnit, orientationOf } from "../pageSizes";
import { useTheme } from "../themeContext";
import { useLanguage } from "../languageContext";
import { useAuth } from "../authContext";
import { STRINGS } from "../i18n";

// The landing page shown before the editor mounts (and whenever the user
// clicks Home in TopNavBar) — picking a design is a prerequisite for seeing
// the canvas, not an overlay on top of it. Deliberately lighter than
// TemplateBrowser.jsx (no favorites/category/sort/reusable-pages tabs):
// this is a first screen, not the full template-management surface, which
// stays reachable from inside the editor via File > "New design…".
//
// Dark mode itself needs no per-element styling here: index.css remaps
// Tailwind's gray/white CSS variables under `.dark` on <html>, so the plain
// bg-gray-*/text-gray-*/bg-white classes below already re-theme globally.
export default function HomePage({ templates, onSelectTemplate, onCreateBlank, onContinue, hasExistingDesign, projectName, lastSavedAt }) {
  const [query, setQuery] = useState("");
  const [customWidth, setCustomWidth] = useState(1080);
  const [customHeight, setCustomHeight] = useState(1080);
  const [customUnit, setCustomUnit] = useState("px");
  const { language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const t = STRINGS[language].home;
  const c = STRINGS[language].common;
  const nav = STRINGS[language].topNav;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? templates.filter((tpl) => tpl.name.toLowerCase().includes(q) || (tpl.category || "").toLowerCase().includes(q))
      : templates;
    return [...list].sort((a, b) => (a.builtIn === b.builtIn ? 0 : a.builtIn ? -1 : 1));
  }, [templates, query]);

  return (
    <div className="flex h-screen flex-col overflow-y-auto bg-gray-50 text-gray-900">
      <header
        className="relative flex h-28 shrink-0 items-start justify-between bg-gray-900 bg-cover bg-center px-6 py-4 md:h-36"
        style={{ backgroundImage: "url(/herob.PNG)" }}
      >
        <div className="relative">
          <button
            className="settings-glow rounded-full bg-amber-500 p-2 text-white transition-colors hover:bg-amber-400"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-label={c.settings}
            title={c.settings}
          >
            <Settings size={18} />
          </button>

          {settingsOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setSettingsOpen(false)} />
              <div className="absolute left-0 z-20 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">{c.settings}</span>
                  <button
                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
                    onClick={() => setSettingsOpen(false)}
                    aria-label="Close settings"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="mb-3">
                  <span className="mb-1.5 block text-xs font-medium text-gray-500">{c.language}</span>
                  <div className="flex gap-1 rounded-lg border border-gray-200 p-1">
                    {[
                      { key: "en", label: "English" },
                      { key: "fr", label: "Français" },
                    ].map((option) => (
                      <button
                        key={option.key}
                        className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                          language === option.key ? "bg-amber-100 text-amber-700" : "text-gray-500 hover:bg-gray-50"
                        }`}
                        onClick={() => setLanguage(option.key)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="mb-1.5 block text-xs font-medium text-gray-500">{c.theme}</span>
                  <div className="flex gap-1 rounded-lg border border-gray-200 p-1">
                    {[
                      { key: "light", label: c.light },
                      { key: "dark", label: c.dark },
                    ].map((option) => (
                      <button
                        key={option.key}
                        className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                          theme === option.key ? "bg-amber-100 text-amber-700" : "text-gray-500 hover:bg-gray-50"
                        }`}
                        onClick={() => setTheme(option.key)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
            onClick={() => setProfileOpen((v) => !v)}
            aria-label={nav.accountMenu}
            title={user?.email || nav.accountMenu}
          >
            <User size={18} />
          </button>

          {profileOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl">
                <div className="px-3 py-2">
                  <div className="truncate text-xs text-gray-500">{user?.email}</div>
                </div>
                <div className="my-1 h-px bg-gray-100" />
                <button
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-700"
                  onClick={() => {
                    setProfileOpen(false);
                    signOut();
                  }}
                >
                  <LogOut size={14} />
                  {nav.logOut}
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">{t.heading}</h1>

        {hasExistingDesign && (
          <button
            className="mb-8 flex w-full flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-left hover:border-amber-300 sm:flex-row sm:items-center sm:justify-between"
            onClick={onContinue}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-amber-800">{t.continueEditing(projectName)}</div>
              <div className="text-xs text-amber-600">
                {lastSavedAt ? t.lastSaved(new Date(lastSavedAt).toLocaleString()) : t.resumeDesign}
              </div>
            </div>
            <span className="shrink-0 self-start rounded-lg bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white sm:self-auto">
              {t.continue}
            </span>
          </button>
        )}

        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{t.startNewDesign}</h2>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white p-3">
            <button
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              onClick={() => onCreateBlank(getUnit(customUnit).toPx(customWidth), getUnit(customUnit).toPx(customHeight))}
            >
              <Plus size={14} /> {t.blankDesign}
            </button>
            <span className="text-xs text-gray-400">{t.orCustomSize}</span>
            <input
              type="number"
              min="1"
              aria-label="Custom width"
              className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
              value={customWidth}
              onChange={(event) => setCustomWidth(Number(event.target.value))}
            />
            <span className="text-xs text-gray-400">×</span>
            <input
              type="number"
              min="1"
              aria-label="Custom height"
              className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
              value={customHeight}
              onChange={(event) => setCustomHeight(Number(event.target.value))}
            />
            <select
              aria-label="Custom size unit"
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
              value={customUnit}
              onChange={(event) => setCustomUnit(event.target.value)}
            >
              {UNITS.map((u) => (
                <option key={u.key} value={u.key}>
                  {u.label}
                </option>
              ))}
            </select>
            <span className="mx-1 h-4 w-px bg-gray-200" />
            {PAGE_SIZE_PRESETS.slice(0, 6).map((preset) => (
              <button
                key={preset.key}
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:border-amber-300 hover:text-amber-700"
                onClick={() => onCreateBlank(preset.width, preset.height, preset.label)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t.templates}</h2>
            <div className="relative w-full sm:w-56">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                aria-label="Search templates"
                placeholder={t.searchPlaceholder}
                className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-amber-400"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">{t.noMatches}</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {filtered.map((template) => (
                <button
                  key={template.id}
                  className="group overflow-hidden rounded-xl border border-gray-200 bg-white text-left hover:border-amber-300"
                  onClick={() => onSelectTemplate(template.id)}
                  aria-label={`Preview ${template.name}, ${template.pageWidth} by ${template.pageHeight} pixels`}
                >
                  <div className="aspect-square w-full bg-gray-50">
                    {template.thumbnail ? (
                      <img src={template.thumbnail} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <TemplateMiniPreview
                        page={template.previewSnapshot?.page || { id: "x", width: template.pageWidth || 1, height: template.pageHeight || 1, background: "#fff" }}
                        items={template.previewSnapshot?.items || []}
                        className="h-full w-full"
                      />
                    )}
                  </div>
                  <div className="p-2">
                    <div className="truncate text-xs font-medium text-gray-800">{template.name}</div>
                    <div className="text-[10px] text-gray-400">
                      {template.pageWidth}×{template.pageHeight} · {orientationOf(template.pageWidth, template.pageHeight)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
