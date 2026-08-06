import React, { useState } from "react";
import { Check, Copy, Download, Star, Trash2, Upload, Pencil } from "lucide-react";
import BrandModal from "./BrandModal";
import CreateBrandKitDialog from "./CreateBrandKitDialog";
import { useBrandKits } from "../../brandKitContext";
import {
  createBrandKit,
  deleteBrandKit,
  duplicateBrandKit,
  setBrandKitFavorite,
  updateBrandKitMetadata,
  setActiveBrandKitId,
  addResource,
  createColorToken,
  createLogoResource,
  getBrandKitById,
  BRAND_RESOURCE_COLLECTIONS,
} from "../../brandKitService";
import { exportBrandKitPackage, inspectBrandKitPackage, importBrandKitAsNew, downloadBlob } from "../../brandKitPackage";
import { putAsset } from "../../assetStore";
import { findUnusedBrandResources } from "../../styleUsage";

function relativeTime(timestamp) {
  if (!timestamp) return "Never";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// Brand Kit Manager (spec §6) — the full-featured surface for managing
// MULTIPLE local brand kits; the sidebar BrandPanel stays scoped to just
// the active kit's resources (spec §6 "do not overload the normal editor
// with the complete manager").
export default function BrandKitManagerDialog({ isOpen, onClose, items, pages }) {
  const { summaries, activeBrandKitId, refresh } = useBrandKits();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, usage }
  const [importError, setImportError] = useState(null);

  const filtered = summaries.filter((kit) => !search.trim() || kit.name.toLowerCase().includes(search.trim().toLowerCase()));

  async function handleCreate({ name, description, colors, headingFont, bodyFont, logoFile }) {
    const kit = await createBrandKit({ name, description });
    for (const hex of colors) {
      await addResource(kit.id, "colors", createColorToken({ name: "Color", value: hex, role: "custom" }));
    }
    if (logoFile) {
      const meta = await putAsset(logoFile, { name: logoFile.name, sourceType: "brand-logo" });
      if (meta.id) {
        await addResource(kit.id, "logos", createLogoResource({ assetId: meta.id, name: logoFile.name, fileType: logoFile.type, width: meta.width, height: meta.height }));
      }
    }
    await refresh();
  }

  async function handleDeleteRequest(id) {
    const kit = await getBrandKitById(id);
    const unused = findUnusedBrandResources(kit, { items, pages });
    const totalResources = Object.values({
      colors: kit.colors, typography: kit.typography, objectStyles: kit.objectStyles,
      imageStyles: kit.imageStyles, backgroundStyles: kit.backgroundStyles, gradients: kit.gradients,
      logos: kit.logos, graphics: kit.graphics,
    }).reduce((sum, list) => sum + list.length, 0);
    const totalUnused = Object.values(unused).reduce((sum, list) => sum + list.length, 0);
    setDeleteConfirm({ id, name: kit.name, usedCount: totalResources - totalUnused });
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    setBusyId(deleteConfirm.id);
    await deleteBrandKit(deleteConfirm.id);
    setBusyId(null);
    setDeleteConfirm(null);
    await refresh();
  }

  async function handleExport(id) {
    const kit = await getBrandKitById(id);
    if (!kit) return;
    const { blob, filename } = await exportBrandKitPackage(kit);
    downloadBlob(blob, filename);
  }

  async function handleImportFile(file) {
    setImportError(null);
    const inspected = await inspectBrandKitPackage(file);
    if (!inspected.ok) {
      setImportError(inspected.message);
      return;
    }
    const { kit } = await importBrandKitAsNew(inspected.zip, inspected.brandJson, inspected.manifest);
    // Every existing write path goes through mutateKit on an already-
    // created record (see brandKitService.js) — rather than a second "put
    // a full record" path, import creates an empty kit first, then adds
    // each resource through the same addResource() call every other
    // creation flow uses.
    const created = await createBrandKit({ name: kit.name, description: kit.description });
    for (const key of BRAND_RESOURCE_COLLECTIONS) {
      for (const resource of kit[key] || []) {
        // eslint-disable-next-line no-await-in-loop
        await addResource(created.id, key, resource);
      }
    }
    await refresh();
  }

  return (
    <>
      <BrandModal isOpen={isOpen} onClose={onClose} title="Brand kits" width="max-w-2xl">
        <div className="mb-3 flex items-center gap-2">
          <input
            type="text"
            placeholder="Search brand kits…"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-amber-400"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search brand kits"
          />
          <button className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700" onClick={() => setShowCreate(true)}>
            + Create
          </button>
          <label className="cursor-pointer rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50" title="Import brand kit (.brandkit)">
            <Upload size={16} />
            <input type="file" accept=".brandkit,.zip" hidden onChange={(event) => event.target.files?.[0] && handleImportFile(event.target.files[0])} />
          </label>
        </div>

        {importError && <p className="mb-2 text-xs text-red-600">{importError}</p>}

        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
            {summaries.length === 0 ? "No brand kits yet. Create one to get started." : "No brand kits match your search."}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {filtered.map((kit) => {
            const isActive = kit.id === activeBrandKitId;
            const isRenaming = renamingId === kit.id;
            return (
              <div key={kit.id} className={`rounded-xl border p-3 ${isActive ? "border-amber-400 bg-amber-50/40" : "border-gray-200"}`}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  {isRenaming ? (
                    <input
                      autoFocus
                      className="w-full rounded border border-gray-200 px-1.5 py-0.5 text-sm"
                      value={renameDraft}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      onBlur={async () => {
                        await updateBrandKitMetadata(kit.id, { name: renameDraft });
                        setRenamingId(null);
                        refresh();
                      }}
                      onKeyDown={(event) => event.key === "Enter" && event.target.blur()}
                    />
                  ) : (
                    <h3 className="truncate text-sm font-semibold text-gray-900">{kit.name}</h3>
                  )}
                  <button
                    className={`shrink-0 ${kit.favorite ? "text-amber-500" : "text-gray-300"} hover:text-amber-500`}
                    onClick={() => setBrandKitFavorite(kit.id, !kit.favorite).then(refresh)}
                    aria-label={kit.favorite ? "Unfavorite" : "Favorite"}
                    aria-pressed={kit.favorite}
                  >
                    <Star size={14} fill={kit.favorite ? "currentColor" : "none"} />
                  </button>
                </div>

                {kit.colorPreview?.length > 0 && (
                  <div className="mb-2 flex gap-1">
                    {kit.colorPreview.map((hex, i) => (
                      <span key={i} className="h-4 w-4 rounded-full border border-gray-200" style={{ backgroundColor: hex }} />
                    ))}
                  </div>
                )}
                {kit.fontPreview?.length > 0 && (
                  <p className="mb-1 truncate text-xs text-gray-500">{kit.fontPreview.join(", ")}</p>
                )}
                <p className="mb-2 text-xs text-gray-400">
                  {kit.resourceCount} resource{kit.resourceCount === 1 ? "" : "s"} · Used {relativeTime(kit.lastUsedAt)}
                </p>

                <div className="flex flex-wrap items-center gap-1">
                  <button
                    className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${isActive ? "bg-amber-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                    onClick={() => setActiveBrandKitId(isActive ? null : kit.id)}
                  >
                    {isActive && <Check size={12} />} {isActive ? "Active" : "Set active"}
                  </button>
                  <button className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50" title="Rename" onClick={() => { setRenamingId(kit.id); setRenameDraft(kit.name); }}>
                    <Pencil size={13} />
                  </button>
                  <button
                    className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"
                    title="Duplicate"
                    disabled={busyId === kit.id}
                    onClick={async () => { setBusyId(kit.id); await duplicateBrandKit(kit.id); setBusyId(null); refresh(); }}
                  >
                    <Copy size={13} />
                  </button>
                  <button className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50" title="Export .brandkit" onClick={() => handleExport(kit.id)}>
                    <Download size={13} />
                  </button>
                  <button className="rounded-lg border border-gray-200 p-1.5 text-red-500 hover:bg-red-50" title="Delete" onClick={() => handleDeleteRequest(kit.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </BrandModal>

      <CreateBrandKitDialog isOpen={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreate} />

      {deleteConfirm && (
        <BrandModal
          isOpen
          onClose={() => setDeleteConfirm(null)}
          title={`Delete "${deleteConfirm.name}"?`}
          width="max-w-sm"
          footer={
            <>
              <button className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
              <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700" onClick={confirmDelete}>
                Delete brand kit
              </button>
            </>
          }
        >
          <p className="text-sm text-gray-600">
            {deleteConfirm.usedCount > 0
              ? `${deleteConfirm.usedCount} resource(s) from this kit are used in the current project. They will keep their current appearance (fallback values are preserved on each object) but will no longer update if you edit this brand kit later.`
              : "No resources from this kit appear to be in use in the current project."}
          </p>
        </BrandModal>
      )}
    </>
  );
}
