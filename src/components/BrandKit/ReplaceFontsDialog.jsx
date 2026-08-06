import React, { useMemo, useState } from "react";
import BrandModal from "./BrandModal";
import { listProjectFonts, planFontReplacement } from "../../fontReplace";
import { FONT_LIBRARY } from "../../fontLibrary";

const SCOPE_OPTIONS = [
  { key: "page", label: "Current page" },
  { key: "pages", label: "Selected pages" },
  { key: "project", label: "Entire project" },
];

// Document-wide font replacement (spec §53/§54).
export default function ReplaceFontsDialog({ isOpen, onClose, items, activePageId, selectedPageIds, onReplace }) {
  const projectFonts = useMemo(() => (isOpen ? listProjectFonts(items) : []), [isOpen, items]);
  const [fromFamily, setFromFamily] = useState(null);
  const [toFamily, setToFamily] = useState("");
  const [scope, setScope] = useState("project");
  const [applying, setApplying] = useState(false);

  const scopeParams = scope === "page" ? { pageId: activePageId } : scope === "pages" ? { pageIds: selectedPageIds?.length ? selectedPageIds : [activePageId] } : {};
  const plan = fromFamily && toFamily ? planFontReplacement({ items }, { fromFamily, toFamily, scope, ...scopeParams }) : null;

  async function handleApply() {
    if (!plan || plan.affectedItemCount === 0) return;
    setApplying(true);
    try {
      await onReplace({ fromFamily, toFamily, scope, ...scopeParams });
      onClose();
    } finally {
      setApplying(false);
    }
  }

  return (
    <BrandModal
      isOpen={isOpen}
      onClose={onClose}
      title="Replace fonts"
      width="max-w-lg"
      footer={
        <>
          <button className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100" onClick={onClose}>Cancel</button>
          <button
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:pointer-events-none disabled:opacity-40"
            onClick={handleApply}
            disabled={!plan || plan.affectedItemCount === 0 || applying}
          >
            {applying ? "Replacing…" : `Replace (${plan?.affectedItemCount || 0} object(s))`}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Fonts in this project</p>
          {projectFonts.length === 0 && <p className="text-xs text-gray-400">No text objects yet.</p>}
          <div className="flex flex-wrap gap-1.5">
            {projectFonts.map(({ family, count, known }) => (
              <button
                key={family}
                className={`rounded-lg border px-2.5 py-1 text-xs ${fromFamily === family ? "border-amber-400 bg-amber-50" : "border-gray-200 hover:bg-gray-50"} ${!known ? "text-red-600" : ""}`}
                onClick={() => setFromFamily(family)}
                title={known ? undefined : "Not available in this app — treated as missing"}
              >
                {family} ({count}){!known && " ⚠"}
              </button>
            ))}
          </div>
        </div>

        {fromFamily && (
          <>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">Replace with</span>
              <select className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm" value={toFamily} onChange={(event) => setToFamily(event.target.value)}>
                <option value="">Choose a font…</option>
                {FONT_LIBRARY.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
              </select>
            </label>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Scope</p>
              <div className="flex gap-1.5">
                {SCOPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${scope === opt.key ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                    onClick={() => setScope(opt.key)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {plan && (
              <div className="rounded-lg bg-gray-50 p-2 text-xs text-gray-600 space-y-1">
                <p>{plan.affectedItemCount} text object(s), {plan.affectedRunCount} styled run(s) will change.</p>
                <p>Font weights (bold/italic) are preserved — only the family changes.</p>
                <p>Text boxes may reflow; check for overflow after replacing.</p>
              </div>
            )}
          </>
        )}
      </div>
    </BrandModal>
  );
}
