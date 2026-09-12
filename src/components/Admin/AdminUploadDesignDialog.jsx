import React, { useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { MAX_TEMPLATE_NAME_LENGTH, createTemplate, publishTemplate } from "../../templateService";
import { listAllCategories } from "../../adminTemplateCategories";
import { validateImageFile, putAsset } from "../../assetStore";
import { getDefaultProps } from "../../objectRegistry";
import { ASSET_THUMB_SIZE } from "../../constants";
import { useLanguage } from "../../languageContext";
import { MISC_STRINGS } from "../../i18n/misc";

function readImageDimensionsAndThumbnail(file, maxSize = ASSET_THUMB_SIZE) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
      const thumbWidth = Math.max(1, Math.round(img.naturalWidth * scale));
      const thumbHeight = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = thumbWidth;
      canvas.height = thumbHeight;
      canvas.getContext("2d").drawImage(img, 0, 0, thumbWidth, thumbHeight);
      const thumbnail = canvas.toDataURL("image/png");
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight, thumbnail });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read image."));
    };
    img.src = url;
  });
}

// Lets an admin publish a ready-made design image directly, without
// building it inside the template editor first (AdminCreateTemplateScreen's
// blank-canvas flow) — the image becomes a single-page "project" template
// (one page sized to the image, one image object filling it), which then
// flows through the exact same createTemplate/publishTemplate pipeline as
// any editor-built template, so it shows up in the end-user Designs panel
// (App.jsx's DesignPanel) and the admin dashboard grid identically.
export default function AdminUploadDesignDialog({ isOpen, onClose, onUploaded }) {
  const { language } = useLanguage();
  const t = MISC_STRINGS[language].adminUploadDesignDialog;
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [tier, setTier] = useState("free");
  const [publishNow, setPublishNow] = useState(true);
  const [categories, setCategories] = useState(() => listAllCategories());
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const cats = listAllCategories();
    setCategories(cats);
    setFile(null);
    setPreview(null);
    setName("");
    setCategory(cats[0]?.key || "personal");
    setTagsInput("");
    setTier("free");
    setPublishNow(true);
    setError(null);
    setIsSubmitting(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleFileChange(event) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;
    const validation = validateImageFile(picked);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    setError(null);
    try {
      const { thumbnail } = await readImageDimensionsAndThumbnail(picked);
      setFile(picked);
      setPreview(thumbnail);
      if (!name.trim()) setName(picked.name.replace(/\.[^./]+$/, ""));
    } catch {
      setError(t.couldNotReadImage);
    }
  }

  async function handleSubmit() {
    const trimmedName = name.trim();
    if (!file || !trimmedName || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const assetMeta = await putAsset(file, { name: trimmedName, sourceType: "admin-design-upload" });
      if (assetMeta.status === "error") {
        setError(assetMeta.errorMessage || t.uploadFailed);
        setIsSubmitting(false);
        return;
      }
      const dims = await readImageDimensionsAndThumbnail(file, 480);
      const now = Date.now();
      const pageId = crypto.randomUUID();
      const itemId = crypto.randomUUID();
      const data = {
        pages: [{ id: pageId, name: "Page 1", width: dims.width, height: dims.height, background: "#ffffff" }],
        activePageId: pageId,
        scale: 1,
        items: [
          {
            id: itemId,
            type: "image",
            pageId,
            x: 0,
            y: 0,
            width: dims.width,
            height: dims.height,
            rotation: 0,
            opacity: 1,
            locked: false,
            hidden: false,
            createdAt: now,
            updatedAt: now,
            ...getDefaultProps("image"),
            assetId: assetMeta.id,
            naturalWidth: dims.width,
            naturalHeight: dims.height,
          },
        ],
        guides: [],
        snapToGuides: true,
      };
      const tags = tagsInput.split(",").map((tag) => tag.trim()).filter(Boolean);
      const template = await createTemplate({
        kind: "project",
        name: trimmedName,
        description: "",
        category,
        tags,
        data,
        assetIds: [assetMeta.id],
        pageCount: 1,
        objectCount: 1,
        groupCount: 0,
        pageWidth: dims.width,
        pageHeight: dims.height,
        thumbnail: dims.thumbnail,
        status: "draft",
        createdBy: "admin",
        tier,
      });
      if (publishNow) await publishTemplate(template.id);
      onUploaded?.();
      onClose();
    } catch {
      setError(t.uploadFailed);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-upload-design-title"
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5">
          <h2 id="admin-upload-design-title" className="text-sm font-semibold text-gray-900">
            {t.title}
          </h2>
          <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label={t.close}>
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          <div className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">{t.designFile}</span>
            {preview ? (
              <div className="flex items-center gap-3">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                  <img src={preview} alt="" className="h-full w-full object-contain" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="max-w-[180px] truncate text-xs text-gray-600">{file?.name}</span>
                  <button
                    type="button"
                    className="w-fit rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {t.replaceFile}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-6 text-gray-500 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={20} />
                <span className="text-xs font-medium">{t.chooseFile}</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFileChange}
            />
            {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">{t.designName}</span>
            <input
              type="text"
              maxLength={MAX_TEMPLATE_NAME_LENGTH}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">{t.category}</span>
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
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">{t.planRequired}</span>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={tier}
              onChange={(event) => setTier(event.target.value)}
            >
              <option value="free">{t.freeEveryone}</option>
              <option value="pro">{t.pro}</option>
              <option value="business">{t.business}</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">{t.tagsLabel}</span>
            <input
              type="text"
              placeholder={t.tagsPlaceholder}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
            />
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
            <input
              type="checkbox"
              checked={publishNow}
              onChange={(event) => setPublishNow(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300"
            />
            {t.publishImmediately}
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3.5">
          <button className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100" onClick={onClose}>
            {t.cancel}
          </button>
          <button
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:pointer-events-none disabled:opacity-40"
            onClick={handleSubmit}
            disabled={!file || !name.trim() || isSubmitting}
          >
            {isSubmitting ? t.uploading : t.uploadDesign}
          </button>
        </div>
      </div>
    </div>
  );
}
