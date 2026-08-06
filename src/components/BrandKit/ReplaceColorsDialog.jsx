import React, { useMemo, useState } from "react";
import BrandModal from "./BrandModal";
import { collectDocumentColors } from "../../styleUsage";
import { planColorReplacement } from "../../colorReplace";
import { isValidColor } from "../../brandColor";

const SCOPE_OPTIONS = [
  { key: "page", label: "Current page" },
  { key: "pages", label: "Selected pages" },
  { key: "project", label: "Entire project" },
];

// Document-wide color replacement (spec §51/§52). Defaults to exact
// matching (tolerance 0) — similar-color matching is opt-in via the
// tolerance slider, never the default.
export default function ReplaceColorsDialog({ isOpen, onClose, items, pages, activePageId, selectedPageIds, onReplace }) {
  const documentColors = useMemo(() => (isOpen ? collectDocumentColors(items) : []), [isOpen, items]);
  const [fromColor, setFromColor] = useState(null);
  const [toColor, setToColor] = useState("#000000");
  const [scope, setScope] = useState("project");
  const [tolerance, setTolerance] = useState(0);
  const [applying, setApplying] = useState(false);

  const scopeParams = scope === "page" ? { pageId: activePageId } : scope === "pages" ? { pageIds: selectedPageIds?.length ? selectedPageIds : [activePageId] } : {};
  const plan = fromColor && isValidColor(toColor)
    ? planColorReplacement({ items, pages }, { fromColor, toColor, scope, ...scopeParams, tolerance })
    : null;

  async function handleApply() {
    if (!plan || plan.changes.length === 0) return;
    setApplying(true);
    try {
      await onReplace(plan);
      onClose();
    } finally {
      setApplying(false);
    }
  }

  return (
    <BrandModal
      isOpen={isOpen}
      onClose={onClose}
      title="Replace colors"
      width="max-w-lg"
      footer={
        <>
          <button className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100" onClick={onClose}>Cancel</button>
          <button
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:pointer-events-none disabled:opacity-40"
            onClick={handleApply}
            disabled={!plan || plan.changes.length === 0 || applying}
          >
            {applying ? "Replacing…" : `Replace (${plan?.changes.length || 0})`}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Document colors</p>
          {documentColors.length === 0 && <p className="text-xs text-gray-400">No colors found in this project yet.</p>}
          <div className="flex flex-wrap gap-1.5">
            {documentColors.map(({ hex, count }) => (
              <button
                key={hex}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${fromColor === hex ? "border-amber-400 bg-amber-50" : "border-gray-200 hover:bg-gray-50"}`}
                onClick={() => setFromColor(hex)}
              >
                <span className="h-4 w-4 rounded-full border border-gray-200" style={{ backgroundColor: hex }} /> {hex} ({count})
              </button>
            ))}
          </div>
        </div>

        {fromColor && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Replace</span>
              <span className="h-5 w-5 rounded-full border border-gray-200" style={{ backgroundColor: fromColor }} />
              <span className="text-xs text-gray-500">with</span>
              <input type="color" className="h-8 w-8 cursor-pointer rounded-md border border-gray-200" value={toColor} onChange={(event) => setToColor(event.target.value)} />
              <input
                type="text"
                className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-xs"
                value={toColor}
                onChange={(event) => setToColor(event.target.value)}
              />
            </div>

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

            <label className="block">
              <span className="mb-1 flex justify-between text-xs text-gray-500">
                <span>Similar-color tolerance</span>
                <span>{tolerance === 0 ? "Exact match" : `${Math.round(tolerance * 100)}%`}</span>
              </span>
              <input type="range" className="w-full accent-amber-600" min={0} max={0.3} step={0.02} value={tolerance} onChange={(event) => setTolerance(Number(event.target.value))} />
            </label>

            {plan && (
              <div className="rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
                {plan.changes.length} field(s) across {plan.affectedItemIds.length} object(s) on {plan.affectedPageIds.length} page(s) will change.
                Image pixels are never modified.
              </div>
            )}
          </>
        )}
      </div>
    </BrandModal>
  );
}
