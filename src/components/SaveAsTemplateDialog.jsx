import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { TEMPLATE_CATEGORIES, MAX_TEMPLATE_NAME_LENGTH, MAX_TEMPLATE_DESCRIPTION_LENGTH } from "../templateService";
import TemplateMiniPreview from "./TemplateMiniPreview";

export default function SaveAsTemplateDialog({ isOpen, onClose, onSave, previewPage, previewItems, pageCount, error }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(TEMPLATE_CATEGORIES[0].key);
  const [tagsInput, setTagsInput] = useState("");
  const nameRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setDescription("");
      setCategory(TEMPLATE_CATEGORIES[0].key);
      setTagsInput("");
      nameRef.current?.focus();
    }
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

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    onSave({ name: trimmed, description: description.trim(), category, tags });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="save-template-title" className="flex w-full max-w-md gap-0 overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex w-32 shrink-0 items-center justify-center bg-gray-50">
          <TemplateMiniPreview page={previewPage} items={previewItems} className="aspect-square w-24 rounded-lg shadow" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h2 id="save-template-title" className="text-sm font-semibold text-gray-900">
              Save as template
            </h2>
            <button className="rounded-lg p-1 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-3 px-4 py-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">Name</span>
              <input
                ref={nameRef}
                type="text"
                maxLength={MAX_TEMPLATE_NAME_LENGTH}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-amber-400"
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && handleSave()}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">Description (optional)</span>
              <textarea
                maxLength={MAX_TEMPLATE_DESCRIPTION_LENGTH}
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-amber-400"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">Category</span>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {TEMPLATE_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">Tags (comma separated)</span>
              <input
                type="text"
                placeholder="wedding, elegant"
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-amber-400"
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
              />
            </label>
            <p className="text-xs text-gray-400">{pageCount} page{pageCount === 1 ? "" : "s"} will be included.</p>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3">
            <button className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100" onClick={onClose}>
              Cancel
            </button>
            <button
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:pointer-events-none disabled:opacity-40"
              onClick={handleSave}
              disabled={!name.trim()}
            >
              Save template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
