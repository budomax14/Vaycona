import React, { useEffect, useRef, useState } from "react";
import BrandModal from "./BrandModal";
import { MAX_BRAND_KIT_NAME_LENGTH, MAX_BRAND_KIT_DESCRIPTION_LENGTH } from "../../constants";
import { isValidColor } from "../../brandColor";
import { FONT_LIBRARY } from "../../fontLibrary";

const STARTER_COLORS = ["#8b5cf6", "#111827", "#ffffff"];

// Create-brand-kit workflow (spec §7) — name required, everything else
// (initial colors, heading/body font, logo) optional and skippable. Never
// touches the current project — `onCreate` only writes to the brand-kit
// store; activating the new kit is a separate, explicit step in the
// manager.
export default function CreateBrandKitDialog({ isOpen, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [colors, setColors] = useState(STARTER_COLORS);
  const [headingFont, setHeadingFont] = useState("");
  const [bodyFont, setBodyFont] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setDescription("");
      setColors(STARTER_COLORS);
      setHeadingFont("");
      setBodyFont("");
      setLogoFile(null);
      setError(null);
      setSaving(false);
    }
  }, [isOpen]);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Brand kit name is required.");
      return;
    }
    const validColors = colors.filter((c) => isValidColor(c));
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        name: trimmed,
        description: description.trim(),
        colors: validColors,
        headingFont: headingFont || null,
        bodyFont: bodyFont || null,
        logoFile,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Could not create brand kit.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BrandModal
      isOpen={isOpen}
      onClose={onClose}
      title="Create brand kit"
      subtitle="Name is required — everything else can be added later."
      footer={
        <>
          <button className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100" onClick={onClose}>
            Cancel
          </button>
          <button
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:pointer-events-none disabled:opacity-40"
            onClick={handleCreate}
            disabled={!name.trim() || saving}
          >
            {saving ? "Creating…" : "Create brand kit"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Brand name</span>
          <input
            autoFocus
            type="text"
            maxLength={MAX_BRAND_KIT_NAME_LENGTH}
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-amber-400"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Description (optional)</span>
          <textarea
            rows={2}
            maxLength={MAX_BRAND_KIT_DESCRIPTION_LENGTH}
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-amber-400"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <div>
          <span className="mb-1 block text-xs font-medium text-gray-500">Initial colors (optional)</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {colors.map((color, index) => (
              <input
                key={index}
                type="color"
                className="h-8 w-8 cursor-pointer rounded-md border border-gray-200"
                value={color}
                onChange={(event) => setColors((prev) => prev.map((c, i) => (i === index ? event.target.value : c)))}
              />
            ))}
            <button
              type="button"
              className="h-8 rounded-md border border-dashed border-gray-300 px-2 text-xs text-gray-500 hover:bg-gray-50"
              onClick={() => setColors((prev) => [...prev, "#8b5cf6"])}
            >
              + Add
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">Heading font (optional)</span>
            <select className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm" value={headingFont} onChange={(event) => setHeadingFont(event.target.value)}>
              <option value="">None</option>
              {FONT_LIBRARY.map((f) => (
                <option key={f.name} value={f.name}>{f.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">Body font (optional)</span>
            <select className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm" value={bodyFont} onChange={(event) => setBodyFont(event.target.value)}>
              <option value="">None</option>
              {FONT_LIBRARY.map((f) => (
                <option key={f.name} value={f.name}>{f.name}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Logo (optional)</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
            className="block w-full text-xs text-gray-600"
            onChange={(event) => setLogoFile(event.target.files?.[0] || null)}
          />
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </BrandModal>
  );
}
