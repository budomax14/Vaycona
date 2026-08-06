import React, { useState } from "react";
import { ChevronDown, ChevronRight, Image as ImageIcon, Plus, Trash2, Wand2 } from "lucide-react";
import { useBrandKits } from "../../../brandKitContext";
import {
  addResource,
  deleteResource,
  setResourceFavorite,
  createColorToken,
  createPalette,
  setActiveBrandKitId,
} from "../../../brandKitService";
import { findStyleUsage } from "../../../styleUsage";
import { useAsset } from "../../../useAsset";

function Section({ title, children, defaultOpen = true, action }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 pb-3 pt-2 first:pt-0">
      <div className="flex items-center justify-between">
        <button className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />} {title}
        </button>
        {action}
      </div>
      {open && <div className="mt-2 space-y-2">{children}</div>}
    </div>
  );
}

function LogoThumb({ logo }) {
  const { objectUrl } = useAsset(logo.assetId);
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-gray-200 bg-[repeating-conic-gradient(#f3f4f6_0%_25%,white_0%_50%)] bg-[length:10px_10px]">
      {logo.isSvg && logo.svgContent ? (
        // Sanitized on upload (see svgSafety.js) — safe to render inline.
        <div className="h-10 w-10" dangerouslySetInnerHTML={{ __html: logo.svgContent }} />
      ) : objectUrl ? (
        <img src={objectUrl} alt={logo.name} className="max-h-10 max-w-10 object-contain" />
      ) : (
        <ImageIcon size={16} className="text-gray-300" />
      )}
    </div>
  );
}

export default function BrandPanel({
  selectedItems,
  items,
  pages,
  onOpenManager,
  onInsertLogo,
  onApplyTypography,
  onCreateTypographyFromSelection,
  onApplyObjectStyle,
  onCreateObjectStyleFromSelection,
  onApplyImageStyle,
  onCreateImageStyleFromSelection,
  onApplyBackgroundStyle,
  onOpenThemeDialog,
  onOpenReplaceColors,
  onOpenReplaceFonts,
  onOpenBrandAudit,
  onUploadLogo,
}) {
  const { summaries, activeBrandKit, activeBrandKitId, refresh } = useBrandKits();
  const [newColorName, setNewColorName] = useState("");
  const [newColorHex, setNewColorHex] = useState("#8b5cf6");

  const single = selectedItems?.length === 1 ? selectedItems[0] : null;
  const textSelected = single?.type === "text";
  const objectStyleCompatible = single && ["shape", "line", "icon", "frame"].includes(single.type);
  const imageSelected = single && (single.type === "image" || single.type === "frame");

  if (!activeBrandKit) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-gray-800">Brand kit</h3>
        {summaries.length === 0 ? (
          <p className="text-xs text-gray-500">No brand kits yet. Create one to store reusable colors, fonts, logos, and styles.</p>
        ) : (
          <p className="text-xs text-gray-500">No active brand kit. Choose one to use its colors, fonts, and styles here.</p>
        )}
        <button className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700" onClick={onOpenManager}>
          {summaries.length === 0 ? "Create a brand kit" : "Choose a brand kit"}
        </button>
      </div>
    );
  }

  async function handleAddColor() {
    if (!newColorName.trim()) return;
    await addResource(activeBrandKit.id, "colors", createColorToken({ name: newColorName.trim(), value: newColorHex }));
    setNewColorName("");
    refresh();
  }

  async function handleDeleteColor(colorId) {
    const usages = findStyleUsage({ items, pages }, activeBrandKit.id, colorId, "color");
    if (usages.length > 0 && !window.confirm(`This color is used in ${usages.length} place(s). Objects will keep their current color but the link will be removed if you delete it. Delete anyway?`)) {
      return;
    }
    await deleteResource(activeBrandKit.id, "colors", colorId);
    refresh();
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <select
          className="min-w-0 flex-1 truncate rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-700"
          value={activeBrandKitId || ""}
          onChange={(event) => setActiveBrandKitId(event.target.value || null)}
          aria-label="Active brand kit"
        >
          {summaries.map((kit) => (
            <option key={kit.id} value={kit.id}>{kit.name}</option>
          ))}
        </select>
        <button className="shrink-0 rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50" onClick={onOpenManager}>
          Manage
        </button>
      </div>

      <Section title="Colors">
        <div className="flex flex-wrap gap-1.5">
          {activeBrandKit.colors.map((color) => (
            <div key={color.id} className="group relative">
              <button
                className="h-7 w-7 rounded-full border border-gray-200"
                style={{ backgroundColor: color.hex }}
                title={`${color.name} (${color.hex})`}
                onClick={() => navigator.clipboard?.writeText(color.hex).catch(() => {})}
              />
              <button
                className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-white text-gray-400 shadow group-hover:flex hover:text-red-500"
                title="Delete color"
                aria-label={`Delete color ${color.name}`}
                onClick={() => handleDeleteColor(color.id)}
              >
                <Trash2 size={9} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <input type="color" className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-gray-200" value={newColorHex} onChange={(event) => setNewColorHex(event.target.value)} />
          <input
            type="text"
            placeholder="Color name"
            className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none focus:border-amber-400"
            value={newColorName}
            onChange={(event) => setNewColorName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleAddColor()}
          />
          <button className="shrink-0 rounded-lg bg-gray-100 p-1.5 text-gray-600 hover:bg-gray-200" onClick={handleAddColor} aria-label="Add color">
            <Plus size={12} />
          </button>
        </div>
        {activeBrandKit.colors.length >= 2 && (
          <button
            className="text-xs font-medium text-amber-600 hover:underline"
            onClick={async () => {
              await addResource(activeBrandKit.id, "palettes", createPalette({ name: "New palette", colorIds: activeBrandKit.colors.map((c) => c.id) }));
              refresh();
            }}
          >
            + Save all as palette
          </button>
        )}
      </Section>

      <Section title="Typography" defaultOpen={false} action={textSelected && (
        <button className="text-[11px] font-medium text-amber-600 hover:underline" onClick={onCreateTypographyFromSelection}>+ From selection</button>
      )}>
        {activeBrandKit.typography.length === 0 && <p className="text-xs text-gray-400">No text styles yet.</p>}
        {activeBrandKit.typography.map((style) => {
          const font = activeBrandKit.fonts.find((f) => f.id === style.fontId);
          const isLinked = textSelected && single.typographyStyleRef?.brandKitId === activeBrandKit.id && single.typographyStyleRef?.styleId === style.id;
          return (
            <div key={style.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-2 py-1.5">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-gray-700" style={{ fontFamily: font?.cssStack }}>{style.name}</p>
                <p className="text-[10px] text-gray-400">{font?.family || "Default"} · {style.fontSize}px</p>
              </div>
              {textSelected && (
                <button
                  className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold ${isLinked ? "bg-amber-100 text-amber-700" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                  onClick={() => onApplyTypography(style.id)}
                >
                  {isLinked ? "Applied" : "Apply"}
                </button>
              )}
            </div>
          );
        })}
      </Section>

      <Section title="Logos" defaultOpen={false} action={
        <label className="cursor-pointer text-[11px] font-medium text-amber-600 hover:underline">
          + Upload
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" hidden onChange={(event) => event.target.files?.[0] && onUploadLogo(event.target.files[0])} />
        </label>
      }>
        {activeBrandKit.logos.length === 0 && <p className="text-xs text-gray-400">No logos yet.</p>}
        <div className="flex flex-wrap gap-2">
          {activeBrandKit.logos.map((logo) => (
            <button key={logo.id} className="flex flex-col items-center gap-1" onClick={() => onInsertLogo(logo.id)} title={`Insert ${logo.name}`}>
              <LogoThumb logo={logo} />
              <span className="max-w-14 truncate text-[10px] text-gray-500">{logo.name}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Object styles" defaultOpen={false} action={objectStyleCompatible && (
        <button className="text-[11px] font-medium text-amber-600 hover:underline" onClick={onCreateObjectStyleFromSelection}>+ From selection</button>
      )}>
        {activeBrandKit.objectStyles.length === 0 && <p className="text-xs text-gray-400">No object styles yet.</p>}
        {activeBrandKit.objectStyles.map((style) => (
          <div key={style.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-2 py-1.5">
            <div className="flex items-center gap-2">
              <span className="h-5 w-5 shrink-0 rounded border border-gray-200" style={{ backgroundColor: style.props.fill || "#e5e7eb" }} />
              <span className="text-xs font-semibold text-gray-700">{style.name}</span>
            </div>
            {objectStyleCompatible && (
              <button className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50" onClick={() => onApplyObjectStyle(style.id)}>
                Apply
              </button>
            )}
          </div>
        ))}
      </Section>

      <Section title="Image styles" defaultOpen={false} action={imageSelected && (
        <button className="text-[11px] font-medium text-amber-600 hover:underline" onClick={onCreateImageStyleFromSelection}>+ From selection</button>
      )}>
        {activeBrandKit.imageStyles.length === 0 && <p className="text-xs text-gray-400">No image styles yet.</p>}
        {activeBrandKit.imageStyles.map((style) => (
          <div key={style.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-2 py-1.5">
            <span className="text-xs font-semibold text-gray-700">{style.name}</span>
            {imageSelected && (
              <button className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50" onClick={() => onApplyImageStyle(style.id)}>
                Apply
              </button>
            )}
          </div>
        ))}
      </Section>

      <Section title="Backgrounds" defaultOpen={false}>
        {activeBrandKit.backgroundStyles.length === 0 && <p className="text-xs text-gray-400">No background styles yet.</p>}
        {activeBrandKit.backgroundStyles.map((bg) => {
          const color = activeBrandKit.colors.find((c) => c.id === bg.colorId);
          return (
            <div key={bg.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-2 py-1.5">
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 shrink-0 rounded border border-gray-200" style={{ backgroundColor: color?.hex || bg.color || "#ffffff" }} />
                <span className="text-xs font-semibold text-gray-700">{bg.name}</span>
              </div>
              <button className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50" onClick={() => onApplyBackgroundStyle(bg.id)}>
                Apply
              </button>
            </div>
          );
        })}
      </Section>

      <Section title="Tools" defaultOpen={false}>
        <button className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50" onClick={onOpenThemeDialog}>
          <Wand2 size={13} /> Themes
        </button>
        <button className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50" onClick={onOpenReplaceColors}>
          Replace colors…
        </button>
        <button className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50" onClick={onOpenReplaceFonts}>
          Replace fonts…
        </button>
        <button className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50" onClick={onOpenBrandAudit}>
          Brand audit…
        </button>
      </Section>
    </div>
  );
}
