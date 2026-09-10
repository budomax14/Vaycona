import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ICON_CATEGORIES, searchIcons } from "../../../iconCatalog";
import { useLanguage } from "../../../languageContext";
import { PANEL_STRINGS } from "../../../i18n/panels";
import IconGlyph from "./IconGlyph";

export default function IconsPanel({ onAddIcon }) {
  const { language } = useLanguage();
  const t = PANEL_STRINGS[language].icons;
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchIcons(query), [query]);
  const grouped = useMemo(() => {
    if (query.trim()) return [{ category: t.resultsCategory, icons: results }];
    return ICON_CATEGORIES.map((category) => ({
      category,
      icons: results.filter((icon) => icon.category === category),
    }));
  }, [results, query, t.resultsCategory]);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-800">{t.title}</h3>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchAria}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-2 text-sm text-gray-700 outline-none focus:border-amber-400 focus:bg-white"
        />
      </div>

      {grouped.every((group) => group.icons.length === 0) && (
        <p className="text-sm text-gray-400">{t.noMatches(query)}</p>
      )}

      {grouped.map(
        (group) =>
          group.icons.length > 0 && (
            <div key={group.category} className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                {group.category}
              </span>
              <div className="grid grid-cols-4 gap-2">
                {group.icons.map((icon) => (
                  <button
                    key={icon.name}
                    type="button"
                    className="flex flex-col items-center gap-1 rounded-xl border border-gray-200 py-3 text-gray-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
                    onClick={() => onAddIcon(icon.name)}
                    title={icon.name}
                    aria-label={t.addIconAria(icon.name)}
                  >
                    <IconGlyph icon={icon} size={20} />
                  </button>
                ))}
              </div>
            </div>
          )
      )}
    </div>
  );
}
