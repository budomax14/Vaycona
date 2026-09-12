import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import TemplateMiniPreview from "../../TemplateMiniPreview";
import { useLanguage } from "../../../languageContext";
import { PANEL_STRINGS } from "../../../i18n/panels";

// Admin-published designs (AdminUploadDesignDialog / the template editor's
// Publish) — `templates` is App.jsx's already-merged local+cloud
// `templateSummaries` list, pre-filtered to status:"published". Clicking a
// design reuses the exact same handleSelectTemplate -> previewTemplate ->
// TemplatePreviewDialog "Use" flow the Home page and full Template Browser
// already go through, so behavior (replacing the current workspace) stays
// consistent everywhere a template can be picked from.
export default function DesignPanel({ templates, onSelectTemplate }) {
  const { language } = useLanguage();
  const t = PANEL_STRINGS[language].design;
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (tpl) =>
        tpl.name.toLowerCase().includes(q) ||
        (tpl.category || "").toLowerCase().includes(q) ||
        (tpl.tags || []).some((tag) => tag.includes(q))
    );
  }, [templates, query]);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-800">{t.title}</h3>
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-amber-400"
        />
      </div>

      {templates.length === 0 ? (
        <p className="py-8 text-center text-xs text-gray-400">{t.empty}</p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-xs text-gray-400">{t.noMatches}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              className="overflow-hidden rounded-xl border border-gray-200 text-left hover:border-amber-400"
              onClick={() => onSelectTemplate(tpl.id)}
              title={tpl.name}
              aria-label={t.useDesignAria(tpl.name)}
            >
              <div className="aspect-square w-full bg-gray-50">
                {tpl.thumbnail ? (
                  <img src={tpl.thumbnail} alt="" className="h-full w-full object-cover" />
                ) : (
                  <TemplateMiniPreview
                    page={tpl.previewSnapshot?.page || { id: "x", width: tpl.pageWidth || 1, height: tpl.pageHeight || 1, background: "#fff" }}
                    items={tpl.previewSnapshot?.items || []}
                    className="h-full w-full"
                  />
                )}
              </div>
              <div className="truncate px-1.5 py-1 text-[11px] font-medium text-gray-600">{tpl.name}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
