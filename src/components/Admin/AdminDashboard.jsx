import React, { useEffect, useMemo, useState } from "react";
import { Copy, Edit3, Eye, LayoutTemplate, LogOut, Plus, Search, Trash2, Upload, X } from "lucide-react";
import {
  listTemplateSummaries,
  getTemplateById,
  duplicateTemplate,
  deleteTemplate,
  setTemplateFavorite,
  publishTemplate,
  unpublishTemplate,
} from "../../templateService";
import { listAllCategories } from "../../adminTemplateCategories";
import { exportProjectPackage, downloadBlob } from "../../projectPackage";
import TemplateMiniPreview from "../TemplateMiniPreview";
import TemplatePreviewDialog from "../TemplatePreviewDialog";
import ConfirmDeleteTemplateDialog from "./ConfirmDeleteTemplateDialog";
import { orientationOf } from "../../pageSizes";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Draft" },
];

const SORT_OPTIONS = [
  { key: "recent-updated", label: "Recently updated" },
  { key: "recent-created", label: "Recently created" },
  { key: "name", label: "Name" },
  { key: "most-used", label: "Most used" },
];

function formatDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminDashboard({ onCreateNew, onEditTemplate, onExitAdmin }) {
  const [templates, setTemplates] = useState(null); // null = loading
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("recent-updated");
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const categories = useMemo(() => listAllCategories(), [templates]);

  async function refresh() {
    const all = await listTemplateSummaries("project");
    setTemplates(all);
  }

  useEffect(() => {
    refresh();
  }, []);

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2500);
  }

  const filtered = useMemo(() => {
    if (!templates) return [];
    let list = templates;
    if (statusFilter !== "all") list = list.filter((t) => (t.status || "published") === statusFilter);
    if (category) list = list.filter((t) => t.category === category);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q) ||
          (t.category || "").toLowerCase().includes(q) ||
          (t.tags || []).some((tag) => tag.includes(q))
      );
    }
    const sorted = [...list];
    if (sort === "recent-created") sorted.sort((a, b) => b.createdAt - a.createdAt);
    else if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "most-used") sorted.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
    else sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    return sorted;
  }, [templates, query, category, statusFilter, sort]);

  async function handlePreview(id) {
    const full = await getTemplateById(id);
    setPreviewTemplate(full);
  }

  async function handleToggleFavorite(id) {
    const current = templates.find((t) => t.id === id) || previewTemplate;
    await setTemplateFavorite(id, !current?.favorite);
    refresh();
    if (previewTemplate?.id === id) setPreviewTemplate(await getTemplateById(id));
  }

  async function handleExportFromPreview() {
    if (!previewTemplate) return;
    const result = await exportProjectPackage({
      data: previewTemplate.data,
      projectName: previewTemplate.name,
      workspaceId: previewTemplate.id,
    });
    if (result.ok) downloadBlob(result.blob, result.filename);
    else showToast("Could not export this template.");
  }

  async function handleDuplicate(id) {
    await duplicateTemplate(id);
    showToast("Template duplicated.");
    refresh();
  }

  async function handlePublish(id) {
    const result = await publishTemplate(id);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast("Published — now visible in the template gallery.");
    refresh();
  }

  async function handleUnpublish(id) {
    const result = await unpublishTemplate(id);
    if (!result) {
      showToast("Built-in templates are always published and can't be changed here.");
      return;
    }
    showToast("Unpublished — removed from the gallery, not deleted.");
    refresh();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const ok = await deleteTemplate(deleteTarget.id);
    setDeleteTarget(null);
    if (ok) {
      showToast("Template deleted.");
      refresh();
    } else {
      showToast("This template can't be deleted.");
    }
  }

  return (
    <div className="desktop-only-shell min-h-screen bg-gray-50">
      <header className="flex h-16 items-center gap-3 border-b border-gray-200 bg-white px-4 shadow-sm md:px-6">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-emerald-400 text-white">
          <LayoutTemplate size={18} />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-gray-900">Template Admin</h1>
          <p className="text-xs text-gray-400">Create, edit, and publish templates for the design gallery</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            onClick={onExitAdmin}
          >
            <LogOut size={15} /> Back to editor
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
            onClick={onCreateNew}
          >
            <Plus size={16} /> Create new template
          </button>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              aria-label="Search templates"
              placeholder="Search by name, tag, or category…"
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-amber-400"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <select
            aria-label="Sort templates"
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-600"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.key}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                statusFilter === s.key ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
              onClick={() => setStatusFilter(s.key)}
            >
              {s.label}
            </button>
          ))}
          <span className="mx-1 h-3 w-px bg-gray-200" />
          {categories.map((c) => (
            <button
              key={c.key}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                category === c.key ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
              onClick={() => setCategory((cur) => (cur === c.key ? null : c.key))}
            >
              {c.label}
            </button>
          ))}
        </div>

        {templates === null ? (
          <p className="py-16 text-center text-sm text-gray-400">Loading templates…</p>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            <p className="mb-2">No templates match your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((template) => (
              <AdminTemplateCard
                key={template.id}
                template={template}
                onEdit={() => onEditTemplate(template.id)}
                onPreview={() => handlePreview(template.id)}
                onDuplicate={() => handleDuplicate(template.id)}
                onPublish={() => handlePublish(template.id)}
                onUnpublish={() => handleUnpublish(template.id)}
                onDelete={() => setDeleteTarget(template)}
              />
            ))}
          </div>
        )}
      </main>

      <TemplatePreviewDialog
        isOpen={!!previewTemplate}
        template={previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        onUse={async () => {
          const source = previewTemplate;
          setPreviewTemplate(null);
          if (source.builtIn) {
            // Built-in templates are protected/read-only here — "editing"
            // one means customizing an independent copy, the same
            // relationship a duplicate already has to its source.
            const copy = await duplicateTemplate(source.id);
            refresh();
            if (copy) onEditTemplate(copy.id);
            return;
          }
          onEditTemplate(source.id);
        }}
        onToggleFavorite={() => handleToggleFavorite(previewTemplate.id)}
        onExport={handleExportFromPreview}
      />

      <ConfirmDeleteTemplateDialog
        isOpen={!!deleteTarget}
        templateName={deleteTarget?.name}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function AdminTemplateCard({ template, onEdit, onPreview, onDuplicate, onPublish, onUnpublish, onDelete }) {
  const status = template.status || "published";
  const orientation = orientationOf(template.pageWidth, template.pageHeight);

  return (
    <div className="group overflow-hidden rounded-xl border border-gray-200 bg-white">
      <button className="block w-full text-left" onClick={onPreview} aria-label={`Preview ${template.name}`}>
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
      </button>

      <div className="p-3">
        <div className="mb-1 flex items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {status}
          </span>
          {template.builtIn && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">Built-in</span>
          )}
          <span className="truncate text-[10px] text-gray-400 capitalize">{template.category}</span>
        </div>
        <div className="truncate text-sm font-medium text-gray-800">{template.name}</div>
        <div className="mt-0.5 text-[11px] text-gray-400">
          {template.pageWidth}×{template.pageHeight} · {orientation}
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-gray-400">
          <span>Created {formatDate(template.createdAt)}</span>
          <span>Updated {formatDate(template.updatedAt)}</span>
          <span>Used {template.usageCount || 0}×</span>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1">
          <button className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100" onClick={onEdit}>
            <Edit3 size={11} /> Edit
          </button>
          <button className="flex items-center gap-1 rounded-lg bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-100" onClick={onPreview}>
            <Eye size={11} /> Preview
          </button>
          <button className="flex items-center gap-1 rounded-lg bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-100" onClick={onDuplicate}>
            <Copy size={11} /> Duplicate
          </button>
          {!template.builtIn &&
            (status === "published" ? (
              <button className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100" onClick={onUnpublish}>
                <X size={11} /> Unpublish
              </button>
            ) : (
              <button className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100" onClick={onPublish}>
                <Upload size={11} /> Publish
              </button>
            ))}
          {!template.builtIn && (
            <button className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-100" onClick={onDelete}>
              <Trash2 size={11} /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
