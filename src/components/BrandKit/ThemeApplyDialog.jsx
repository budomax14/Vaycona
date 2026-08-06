import React, { useMemo, useState } from "react";
import BrandModal from "./BrandModal";
import { useBrandKits } from "../../brandKitContext";
import { addResource, createTheme } from "../../brandKitService";
import { planThemeApplication } from "../../themeApply";

const SCOPE_OPTIONS = [
  { key: "page", label: "Current page" },
  { key: "pages", label: "Selected pages" },
  { key: "project", label: "Entire project" },
  { key: "selection", label: "Selected objects only" },
];

// Theme create/preview/apply (spec §47-50). Preview is a static,
// non-destructive summary (swatches + affected-object count) rather than a
// live canvas overlay — nothing is written to items/pages/history/autosave
// until "Apply" is pressed, which satisfies spec §50's hard requirements
// (no history/autosave during preview, exact restore on cancel is trivial
// since nothing was ever changed) while keeping scope reasonable for this
// phase; a fully live canvas preview overlay is a documented limitation.
export default function ThemeApplyDialog({ isOpen, onClose, items, pages, activePageId, selectedPageIds, selectedItemIds, onApplyTheme }) {
  const { activeBrandKit, refresh } = useBrandKits();
  const [selectedThemeId, setSelectedThemeId] = useState(null);
  const [scope, setScope] = useState("page");
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ name: "", primaryColorId: "", backgroundColorId: "", textColorId: "", bodyTypographyId: "", shapeObjectStyleId: "", backgroundStyleId: "" });
  const [applying, setApplying] = useState(false);

  const theme = activeBrandKit?.themes.find((t) => t.id === selectedThemeId) || null;

  const scopeParams = useMemo(() => {
    if (scope === "page") return { pageId: activePageId };
    if (scope === "pages") return { pageIds: selectedPageIds?.length ? selectedPageIds : [activePageId] };
    if (scope === "selection") return { itemIds: selectedItemIds || [] };
    return {};
  }, [scope, activePageId, selectedPageIds, selectedItemIds]);

  const plan = theme && items && pages ? planThemeApplication(activeBrandKit, theme, { items, pages }, scope, scopeParams) : null;

  async function handleCreateTheme() {
    if (!draft.name.trim()) return;
    const created = await addResource(activeBrandKit.id, "themes", createTheme({
      name: draft.name.trim(),
      primaryColorId: draft.primaryColorId || null,
      backgroundColorId: draft.backgroundColorId || null,
      textColorId: draft.textColorId || null,
      bodyTypographyId: draft.bodyTypographyId || null,
      shapeObjectStyleId: draft.shapeObjectStyleId || null,
      backgroundStyleId: draft.backgroundStyleId || null,
    }));
    setShowCreate(false);
    setDraft({ name: "", primaryColorId: "", backgroundColorId: "", textColorId: "", bodyTypographyId: "", shapeObjectStyleId: "", backgroundStyleId: "" });
    await refresh();
    const newest = created.themes[created.themes.length - 1];
    if (newest) setSelectedThemeId(newest.id);
  }

  async function handleApply() {
    if (!theme) return;
    setApplying(true);
    try {
      await onApplyTheme(theme.id, scope, scopeParams);
      onClose();
    } finally {
      setApplying(false);
    }
  }

  if (!activeBrandKit) {
    return (
      <BrandModal isOpen={isOpen} onClose={onClose} title="Themes">
        <p className="text-sm text-gray-500">Set an active brand kit first (Brand panel → Manage) to create or apply themes.</p>
      </BrandModal>
    );
  }

  return (
    <BrandModal
      isOpen={isOpen}
      onClose={onClose}
      title="Brand themes"
      width="max-w-xl"
      footer={
        <>
          <button className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100" onClick={onClose}>Cancel</button>
          <button
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:pointer-events-none disabled:opacity-40"
            onClick={handleApply}
            disabled={!theme || applying || (plan && plan.affectedCount === 0)}
          >
            {applying ? "Applying…" : `Apply theme${plan ? ` (${plan.affectedCount} affected)` : ""}`}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {activeBrandKit.themes.map((t) => (
            <button
              key={t.id}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${selectedThemeId === t.id ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              onClick={() => setSelectedThemeId(t.id)}
            >
              {t.name}
            </button>
          ))}
          <button className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50" onClick={() => setShowCreate((v) => !v)}>
            + New theme
          </button>
        </div>

        {showCreate && (
          <div className="space-y-2 rounded-xl border border-gray-200 p-3">
            <input
              type="text"
              placeholder="Theme name"
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              value={draft.name}
              onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label>Primary color
                <select className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1" value={draft.primaryColorId} onChange={(event) => setDraft((d) => ({ ...d, primaryColorId: event.target.value }))}>
                  <option value="">None</option>
                  {activeBrandKit.colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label>Background color
                <select className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1" value={draft.backgroundColorId} onChange={(event) => setDraft((d) => ({ ...d, backgroundColorId: event.target.value }))}>
                  <option value="">None</option>
                  {activeBrandKit.colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label>Body typography
                <select className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1" value={draft.bodyTypographyId} onChange={(event) => setDraft((d) => ({ ...d, bodyTypographyId: event.target.value }))}>
                  <option value="">None</option>
                  {activeBrandKit.typography.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <label>Shape object style
                <select className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1" value={draft.shapeObjectStyleId} onChange={(event) => setDraft((d) => ({ ...d, shapeObjectStyleId: event.target.value }))}>
                  <option value="">None</option>
                  {activeBrandKit.objectStyles.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className="col-span-2">Background style
                <select className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1" value={draft.backgroundStyleId} onChange={(event) => setDraft((d) => ({ ...d, backgroundStyleId: event.target.value }))}>
                  <option value="">None</option>
                  {activeBrandKit.backgroundStyles.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
            </div>
            <button className="w-full rounded-lg bg-gray-800 py-1.5 text-xs font-semibold text-white hover:bg-gray-900" onClick={handleCreateTheme}>
              Save theme
            </button>
          </div>
        )}

        {theme && (
          <>
            <div className="rounded-xl border border-gray-200 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Preview</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                {["primaryColorId", "backgroundColorId", "textColorId"].map((field) => {
                  const color = activeBrandKit.colors.find((c) => c.id === theme[field]);
                  return color ? <span key={field} className="flex items-center gap-1"><span className="h-4 w-4 rounded-full border border-gray-200" style={{ backgroundColor: color.hex }} /> {color.name}</span> : null;
                })}
                {theme.bodyTypographyId && <span>Body: {activeBrandKit.typography.find((t) => t.id === theme.bodyTypographyId)?.name}</span>}
                {theme.shapeObjectStyleId && <span>Shapes: {activeBrandKit.objectStyles.find((s) => s.id === theme.shapeObjectStyleId)?.name}</span>}
                {theme.backgroundStyleId && <span>Background: {activeBrandKit.backgroundStyles.find((b) => b.id === theme.backgroundStyleId)?.name}</span>}
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Only objects/pages already linked to this brand kit will change — unlinked (arbitrary) colors and fonts are left untouched.
              </p>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Apply to</p>
              <div className="flex flex-wrap gap-1.5">
                {SCOPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${scope === opt.key ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                    onClick={() => setScope(opt.key)}
                    disabled={opt.key === "selection" && !selectedItemIds?.length}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {plan && <p className="mt-1.5 text-xs text-gray-500">{plan.affectedCount} object/page(s) will change.</p>}
            </div>
          </>
        )}
      </div>
    </BrandModal>
  );
}
