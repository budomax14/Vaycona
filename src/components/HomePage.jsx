import React, { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import TemplateMiniPreview from "./TemplateMiniPreview";
import { PAGE_SIZE_PRESETS, UNITS, getUnit, orientationOf } from "../pageSizes";

// The landing page shown before the editor mounts (and whenever the user
// clicks Home in TopNavBar) — picking a design is a prerequisite for seeing
// the canvas, not an overlay on top of it. Deliberately lighter than
// TemplateBrowser.jsx (no favorites/category/sort/reusable-pages tabs):
// this is a first screen, not the full template-management surface, which
// stays reachable from inside the editor via File > "New design…".
export default function HomePage({ templates, onSelectTemplate, onCreateBlank, onContinue, hasExistingDesign, projectName, lastSavedAt }) {
  const [query, setQuery] = useState("");
  const [customWidth, setCustomWidth] = useState(1080);
  const [customHeight, setCustomHeight] = useState(1080);
  const [customUnit, setCustomUnit] = useState("px");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? templates.filter((t) => t.name.toLowerCase().includes(q) || (t.category || "").toLowerCase().includes(q))
      : templates;
    return [...list].sort((a, b) => (a.builtIn === b.builtIn ? 0 : a.builtIn ? -1 : 1));
  }, [templates, query]);

  return (
    <div className="flex h-screen flex-col overflow-y-auto bg-gray-50 text-gray-900">
      <header className="flex items-center gap-2.5 border-b border-gray-200 bg-white px-6 py-4">
        <img src="/logo.png" alt="Duma Studio" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
        <span className="text-sm font-semibold text-gray-800">Duma Studio</span>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Let's make something amazing.</h1>

        {hasExistingDesign && (
          <button
            className="mb-8 flex w-full items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-left hover:border-amber-300"
            onClick={onContinue}
          >
            <div>
              <div className="text-sm font-semibold text-amber-800">Continue editing "{projectName}"</div>
              <div className="text-xs text-amber-600">{lastSavedAt ? `Last saved ${new Date(lastSavedAt).toLocaleString()}` : "Resume your in-progress design"}</div>
            </div>
            <span className="rounded-lg bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white">Continue</span>
          </button>
        )}

        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Start a new design</h2>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white p-3">
            <button
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              onClick={() => onCreateBlank(getUnit(customUnit).toPx(customWidth), getUnit(customUnit).toPx(customHeight))}
            >
              <Plus size={14} /> Blank design
            </button>
            <span className="text-xs text-gray-400">or custom size:</span>
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
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Templates</h2>
            <div className="relative w-56">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                aria-label="Search templates"
                placeholder="Search templates…"
                className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-amber-400"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">No templates match your search.</div>
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
