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
import { useLanguage } from "../../../languageContext";
import { PANEL_STRINGS } from "../../../i18n/panels";

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
  const { language } = useLanguage();
  const t = PANEL_STRINGS[language].brand;

  const single = selectedItems?.length === 1 ? selectedItems[0] : null;
  const textSelected = single?.type === "text";
  const objectStyleCompatible = single && ["shape", "line", "icon", "frame"].includes(single.type);
  const imageSelected = single && (single.type === "image" || single.type === "frame");

  if (!activeBrandKit) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-gray-800">{t.brandKit}</h3>
        {summaries.length === 0 ? (
          <p className="text-xs text-gray-500">{t.noKitsYet}</p>
        ) : (
          <p className="text-xs text-gray-500">{t.noActiveKit}</p>
        )}
        <button className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700" onClick={onOpenManager}>
          {summaries.length === 0 ? t.createBrandKit : t.chooseBrandKit}
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
    if (usages.length > 0 && !window.confirm(t.confirmDeleteColor(usages.length))) {
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
          aria-label={t.activeBrandKitAria}
        >
          {summaries.map((kit) => (
            <option key={kit.id} value={kit.id}>{kit.name}</option>
          ))}
        </select>
        <button className="shrink-0 rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50" onClick={onOpenManager}>
          {t.manage}
        </button>
      </div>

      <Section title={t.colors}>
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
                title={t.deleteColor}
                aria-label={t.deleteColorAria(color.name)}
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
            placeholder={t.colorNamePlaceholder}
            className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none focus:border-amber-400"
            value={newColorName}
            onChange={(event) => setNewColorName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleAddColor()}
          />
          <button className="shrink-0 rounded-lg bg-gray-100 p-1.5 text-gray-600 hover:bg-gray-200" onClick={handleAddColor} aria-label={t.addColorAria}>
            <Plus size={12} />
          </button>
        </div>
        {activeBrandKit.colors.length >= 2 && (
          <button
            className="text-xs font-medium text-amber-600 hover:underline"
            onClick={async () => {
              await addResource(activeBrandKit.id, "palettes", createPalette({ name: t.newPaletteName, colorIds: activeBrandKit.colors.map((c) => c.id) }));
              refresh();
            }}
          >
            {t.saveAllAsPalette}
          </button>
        )}
      </Section>

      <Section title={t.typography} defaultOpen={false} action={textSelected && (
        <button className="text-[11px] font-medium text-amber-600 hover:underline" onClick={onCreateTypographyFromSelection}>{t.fromSelection}</button>
      )}>
        {activeBrandKit.typography.length === 0 && <p className="text-xs text-gray-400">{t.noTextStyles}</p>}
        {activeBrandKit.typography.map((style) => {
          const font = activeBrandKit.fonts.find((f) => f.id === style.fontId);
          const isLinked = textSelected && single.typographyStyleRef?.brandKitId === activeBrandKit.id && single.typographyStyleRef?.styleId === style.id;
          return (
            <div key={style.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-2 py-1.5">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-gray-700" style={{ fontFamily: font?.cssStack }}>{style.name}</p>
                <p className="text-[10px] text-gray-400">{font?.family || t.defaultFontLabel} · {style.fontSize}px</p>
              </div>
              {textSelected && (
                <button
                  className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold ${isLinked ? "bg-amber-100 text-amber-700" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                  onClick={() => onApplyTypography(style.id)}
                >
                  {isLinked ? t.applied : t.apply}
                </button>
              )}
            </div>
          );
        })}
      </Section>

      <Section title={t.logos} defaultOpen={false} action={
        <label className="cursor-pointer text-[11px] font-medium text-amber-600 hover:underline">
          {t.upload}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" hidden onChange={(event) => event.target.files?.[0] && onUploadLogo(event.target.files[0])} />
        </label>
      }>
        {activeBrandKit.logos.length === 0 && <p className="text-xs text-gray-400">{t.noLogosYet}</p>}
        <div className="flex flex-wrap gap-2">
          {activeBrandKit.logos.map((logo) => (
            <button key={logo.id} className="flex flex-col items-center gap-1" onClick={() => onInsertLogo(logo.id)} title={t.insertLogoAria(logo.name)}>
              <LogoThumb logo={logo} />
              <span className="max-w-14 truncate text-[10px] text-gray-500">{logo.name}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title={t.objectStyles} defaultOpen={false} action={objectStyleCompatible && (
        <button className="text-[11px] font-medium text-amber-600 hover:underline" onClick={onCreateObjectStyleFromSelection}>{t.fromSelection}</button>
      )}>
        {activeBrandKit.objectStyles.length === 0 && <p className="text-xs text-gray-400">{t.noObjectStylesYet}</p>}
        {activeBrandKit.objectStyles.map((style) => (
          <div key={style.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-2 py-1.5">
            <div className="flex items-center gap-2">
              <span className="h-5 w-5 shrink-0 rounded border border-gray-200" style={{ backgroundColor: style.props.fill || "#e5e7eb" }} />
              <span className="text-xs font-semibold text-gray-700">{style.name}</span>
            </div>
            {objectStyleCompatible && (
              <button className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50" onClick={() => onApplyObjectStyle(style.id)}>
                {t.apply}
              </button>
            )}
          </div>
        ))}
      </Section>

      <Section title={t.imageStyles} defaultOpen={false} action={imageSelected && (
        <button className="text-[11px] font-medium text-amber-600 hover:underline" onClick={onCreateImageStyleFromSelection}>{t.fromSelection}</button>
      )}>
        {activeBrandKit.imageStyles.length === 0 && <p className="text-xs text-gray-400">{t.noImageStylesYet}</p>}
        {activeBrandKit.imageStyles.map((style) => (
          <div key={style.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-2 py-1.5">
            <span className="text-xs font-semibold text-gray-700">{style.name}</span>
            {imageSelected && (
              <button className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50" onClick={() => onApplyImageStyle(style.id)}>
                {t.apply}
              </button>
            )}
          </div>
        ))}
      </Section>

      <Section title={t.backgrounds} defaultOpen={false}>
        {activeBrandKit.backgroundStyles.length === 0 && <p className="text-xs text-gray-400">{t.noBackgroundStylesYet}</p>}
        {activeBrandKit.backgroundStyles.map((bg) => {
          const color = activeBrandKit.colors.find((c) => c.id === bg.colorId);
          return (
            <div key={bg.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-2 py-1.5">
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 shrink-0 rounded border border-gray-200" style={{ backgroundColor: color?.hex || bg.color || "#ffffff" }} />
                <span className="text-xs font-semibold text-gray-700">{bg.name}</span>
              </div>
              <button className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50" onClick={() => onApplyBackgroundStyle(bg.id)}>
                {t.apply}
              </button>
            </div>
          );
        })}
      </Section>

      <Section title={t.tools} defaultOpen={false}>
        <button className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50" onClick={onOpenThemeDialog}>
          <Wand2 size={13} /> {t.themes}
        </button>
        <button className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50" onClick={onOpenReplaceColors}>
          {t.replaceColors}
        </button>
        <button className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50" onClick={onOpenReplaceFonts}>
          {t.replaceFonts}
        </button>
        <button className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50" onClick={onOpenBrandAudit}>
          {t.brandAudit}
        </button>
      </Section>
    </div>
  );
}
