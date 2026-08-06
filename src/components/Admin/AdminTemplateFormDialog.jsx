import React, { useEffect, useRef, useState } from "react";
import { Plus, Upload, X } from "lucide-react";
import { MAX_TEMPLATE_NAME_LENGTH, MAX_TEMPLATE_DESCRIPTION_LENGTH } from "../../templateService";
import { listAllCategories, addCustomCategory } from "../../adminTemplateCategories";
import { validateImageFile } from "../../assetStore";
import { ASSET_THUMB_SIZE } from "../../constants";
import { UNITS, PAGE_SIZE_PRESETS, getUnit } from "../../pageSizes";

function readFileAsThumbnailDataUrl(file, maxSize = ASSET_THUMB_SIZE) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
      const width = Math.max(1, Math.round(img.naturalWidth * scale));
      const height = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read image."));
    };
    img.src = url;
  });
}

// Used both for "Create new template" (name + canvas setup, always starts
// as a draft — there's no content yet, so publishing isn't offered here;
// see templatePublishBlockedReason in templateService.js) and, from inside
// the admin template editor, "Template settings" (name/description/
// category/tags/background/thumbnail/publish state of an EXISTING
// template — width/height changes go through the real editor's own
// Resize tool instead, so a live canvas and this dialog never disagree
// about page size).
export default function AdminTemplateFormDialog({ isOpen, mode, initialValues, onClose, onSubmit, publishBlockedReason }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1080);
  const [unit, setUnit] = useState("px");
  const [background, setBackground] = useState("#ffffff");
  const [status, setStatus] = useState("draft");
  const [thumbnail, setThumbnail] = useState(null);
  const [thumbnailError, setThumbnailError] = useState(null);
  const [categories, setCategories] = useState(() => listAllCategories());
  const [newCategoryInput, setNewCategoryInput] = useState(null); // null = not adding
  const nameRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setCategories(listAllCategories());
    setName(initialValues?.name || "");
    setDescription(initialValues?.description || "");
    setCategory(initialValues?.category || listAllCategories()[0]?.key || "personal");
    setTagsInput((initialValues?.tags || []).join(", "));
    setWidth(initialValues?.width || 1080);
    setHeight(initialValues?.height || 1080);
    setUnit("px");
    setBackground(initialValues?.background || "#ffffff");
    setStatus(initialValues?.status || "draft");
    setThumbnail(initialValues?.thumbnail || null);
    setThumbnailError(null);
    setNewCategoryInput(null);
    nameRef.current?.focus();
  }, [isOpen, initialValues]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleThumbnailChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.ok) {
      setThumbnailError(validation.error);
      return;
    }
    setThumbnailError(null);
    try {
      setThumbnail(await readFileAsThumbnailDataUrl(file));
    } catch {
      setThumbnailError("Could not read that image.");
    }
  }

  function handleAddCategory() {
    const trimmed = (newCategoryInput || "").trim();
    if (!trimmed) return;
    const key = addCustomCategory(trimmed);
    if (key) {
      setCategories(listAllCategories());
      setCategory(key);
    }
    setNewCategoryInput(null);
  }

  function handleSubmit() {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);

    if (mode === "create") {
      const unitConfig = getUnit(unit);
      onSubmit({
        name: trimmedName,
        description: description.trim(),
        category,
        tags,
        width: Math.round(unitConfig.toPx(Number(width) || 0)) || 1080,
        height: Math.round(unitConfig.toPx(Number(height) || 0)) || 1080,
        background,
      });
      return;
    }

    onSubmit({ name: trimmedName, description: description.trim(), category, tags, background, thumbnail, status });
  }

  const canPublishNow = mode === "edit" && !publishBlockedReason;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="admin-template-form-title" className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5">
          <h2 id="admin-template-form-title" className="text-sm font-semibold text-gray-900">
            {mode === "create" ? "Create new template" : "Template settings"}
          </h2>
          <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">Template name</span>
            <input
              ref={nameRef}
              type="text"
              maxLength={MAX_TEMPLATE_NAME_LENGTH}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">Description (optional)</span>
            <textarea
              maxLength={MAX_TEMPLATE_DESCRIPTION_LENGTH}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <div className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">Category</span>
            <div className="flex gap-2">
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-gray-300 px-2.5 text-xs font-medium text-gray-500 hover:border-amber-300 hover:text-amber-700"
                onClick={() => setNewCategoryInput(newCategoryInput === null ? "" : null)}
              >
                <Plus size={12} /> New
              </button>
            </div>
            {newCategoryInput !== null && (
              <div className="mt-1.5 flex gap-1.5">
                <input
                  autoFocus
                  type="text"
                  placeholder="Category name"
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-amber-400"
                  value={newCategoryInput}
                  onChange={(event) => setNewCategoryInput(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && handleAddCategory()}
                />
                <button type="button" className="rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-amber-700" onClick={handleAddCategory}>
                  Add
                </button>
              </div>
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">Tags (comma separated)</span>
            <input
              type="text"
              placeholder="wedding, elegant"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
            />
          </label>

          {mode === "create" && (
            <div className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">Canvas size</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  aria-label="Width"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={width}
                  onChange={(event) => setWidth(Number(event.target.value))}
                />
                <span className="text-gray-400">×</span>
                <input
                  type="number"
                  min="1"
                  aria-label="Height"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={height}
                  onChange={(event) => setHeight(Number(event.target.value))}
                />
                <select
                  aria-label="Unit"
                  className="shrink-0 rounded-lg border border-gray-200 px-2 py-2 text-xs"
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                >
                  {UNITS.map((u) => (
                    <option key={u.key} value={u.key}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {PAGE_SIZE_PRESETS.slice(0, 6).map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] text-gray-600 hover:border-amber-300 hover:text-amber-700"
                    onClick={() => {
                      setUnit("px");
                      setWidth(preset.width);
                      setHeight(preset.height);
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">Background color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-9 w-11 shrink-0 cursor-pointer rounded-lg border border-gray-200"
                value={/^#[0-9a-f]{6}$/i.test(background) ? background : "#ffffff"}
                onChange={(event) => setBackground(event.target.value)}
              />
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono outline-none focus:border-amber-400"
                value={background}
                onChange={(event) => setBackground(event.target.value)}
              />
            </div>
          </label>

          {mode === "edit" && (
            <>
              <div className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">Thumbnail</span>
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                    {thumbnail && <img src={thumbnail} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                    <Upload size={12} /> Upload cover image
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleThumbnailChange} />
                  </label>
                </div>
                {thumbnailError && <p className="mt-1 text-xs text-red-600">{thumbnailError}</p>}
                <p className="mt-1 text-[11px] text-gray-400">
                  Leave blank to auto-generate from the canvas when you save.
                </p>
              </div>

              <div className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">Status</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium ${status === "draft" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}
                    onClick={() => setStatus("draft")}
                  >
                    Draft
                  </button>
                  <button
                    type="button"
                    disabled={status !== "published" && !canPublishNow}
                    title={status !== "published" && !canPublishNow ? publishBlockedReason : undefined}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}
                    onClick={() => setStatus("published")}
                  >
                    Published
                  </button>
                </div>
                {status !== "published" && !canPublishNow && publishBlockedReason && (
                  <p className="mt-1 text-[11px] text-amber-600">{publishBlockedReason}</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3.5">
          <button className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100" onClick={onClose}>
            Cancel
          </button>
          <button
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:pointer-events-none disabled:opacity-40"
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            {mode === "create" ? "Create & open editor" : "Save settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
