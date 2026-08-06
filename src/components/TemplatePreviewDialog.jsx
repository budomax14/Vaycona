import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Heart, X } from "lucide-react";
import TemplateMiniPreview from "./TemplateMiniPreview";
import { orientationOf } from "../pageSizes";

// Template preview (spec §14) — shows real page content (via
// TemplateMiniPreview) and metadata, never the raw project JSON. Multi-
// page templates get simple prev/next navigation between page previews;
// this never mounts the full editor.
export default function TemplatePreviewDialog({ isOpen, template, onClose, onUse, onToggleFavorite, onExport }) {
  const [pageIndex, setPageIndex] = useState(0);
  const primaryRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPageIndex(0);
      primaryRef.current?.focus();
    }
  }, [isOpen, template?.id]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || !template) return null;

  const pages = template.data?.pages || [];
  const page = pages[pageIndex];
  const missingAssetCount = template.missingAssetCount || 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="template-preview-title" className="flex w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-1 flex-col items-center justify-center bg-gray-50 p-6">
          <div className="relative w-full max-w-sm">
            <TemplateMiniPreview page={page} items={template.data?.items || []} className="aspect-square w-full rounded-xl shadow" />
            {pages.length > 1 && (
              <>
                <button
                  className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow disabled:opacity-30"
                  onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                  disabled={pageIndex === 0}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow disabled:opacity-30"
                  onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
                  disabled={pageIndex === pages.length - 1}
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </>
            )}
          </div>
          {pages.length > 1 && (
            <p className="mt-2 text-xs text-gray-500">
              Page {pageIndex + 1} of {pages.length}
            </p>
          )}
        </div>

        <div className="flex w-72 shrink-0 flex-col border-l border-gray-200">
          <div className="flex items-start justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <h2 id="template-preview-title" className="text-sm font-semibold text-gray-900">
                {template.name}
              </h2>
              <p className="text-xs text-gray-400">
                {template.pageWidth}×{template.pageHeight} · {orientationOf(template.pageWidth, template.pageHeight)}
              </p>
            </div>
            <button className="rounded-lg p-1 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label="Close preview">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 text-xs text-gray-600">
            {template.description && <p className="mb-3">{template.description}</p>}
            <dl className="grid grid-cols-2 gap-y-1">
              <dt>Pages</dt>
              <dd>{template.pageCount}</dd>
              <dt>Objects</dt>
              <dd>{template.objectCount}</dd>
              <dt>Assets</dt>
              <dd>{template.assetCount}</dd>
              <dt>Category</dt>
              <dd className="capitalize">{template.category}</dd>
            </dl>
            {template.tags?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {template.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {missingAssetCount > 0 && (
              <p className="mt-3 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] text-amber-700">
                {missingAssetCount} image{missingAssetCount === 1 ? "" : "s"} in this template can't be found and will show
                as missing.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-gray-200 px-4 py-3">
            <button
              className={`rounded-lg border border-gray-200 p-2 ${template.favorite ? "text-red-500" : "text-gray-400"}`}
              onClick={onToggleFavorite}
              aria-label={template.favorite ? "Unfavorite" : "Favorite"}
            >
              <Heart size={14} fill={template.favorite ? "currentColor" : "none"} />
            </button>
            <button className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:text-gray-600" onClick={onExport} aria-label="Export template as a project file">
              <Download size={14} />
            </button>
            <button
              ref={primaryRef}
              className="flex-1 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              onClick={onUse}
            >
              Use template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
