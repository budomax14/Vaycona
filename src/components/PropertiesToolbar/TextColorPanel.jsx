import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link2, Maximize2, Minus, Plus, StretchHorizontal, Unlink, X } from "lucide-react";
import { useRecentColors } from "../../recentColorsContext";
import { useBrandKits } from "../../brandKitContext";
import { useDocumentColors } from "../../documentColorsContext";
import { STARTER_PALETTE } from "./toolbarUi";
import { GRADIENT_PRESETS, defaultGradient, gradientToCss } from "../../gradientFill";
import { computeImageFillLayout, normalizeImageFill } from "../../imageFill";
import { useAsset } from "../../useAsset";
import { useImageElement } from "../../useImageElement";
import ImageAssetPickerModal from "../ImageAssetPickerModal";

function isValidHex(value) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

function SwatchGrid({ colors, onPick, size = "h-6 w-6" }) {
  return (
    <div className="grid grid-cols-9 gap-1.5">
      {colors.map((hex, i) => (
        <button
          key={`${hex}-${i}`}
          type="button"
          className={`${size} rounded border border-gray-200`}
          style={{ backgroundColor: hex }}
          title={hex}
          aria-label={`Use color ${hex}`}
          onClick={() => onPick(hex)}
        />
      ))}
    </div>
  );
}

// Image tab body — mirrors the Gradient tab's "preview + controls" shape.
// Position X/Y are exposed as fine-tune fields alongside the primary
// canvas-drag interaction (ImageFillOverlay.jsx), which most users will
// reach for first.
function ImageFillTab({ imageValue, assetStatus, assetPreviewUrl, canPanX, canPanY, onChangeImage, onOpenPicker, onRemove, description }) {
  if (!imageValue?.assetId) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-xs text-gray-500">{description}</p>
        <button
          type="button"
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          onClick={onOpenPicker}
        >
          Choose image
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          {assetPreviewUrl && <img src={assetPreviewUrl} alt="" className="h-full w-full object-cover" />}
        </div>
        <button
          type="button"
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:border-amber-300 hover:text-amber-700"
          onClick={onOpenPicker}
        >
          Replace image
        </button>
      </div>

      {assetStatus === "missing" && (
        <div className="rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-700">This image is missing from your uploads.</div>
      )}

      <div>
        <span className="mb-1 block text-xs font-medium text-gray-500">Fit</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
              (imageValue.fit || "fill") === "fill" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
            }`}
            onClick={() => onChangeImage({ fit: "fill" })}
            title="Fill — cover the whole box, crop excess"
          >
            <Maximize2 size={12} /> Fill
          </button>
          <button
            type="button"
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
              imageValue.fit === "stretch" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
            }`}
            onClick={() => onChangeImage({ fit: "stretch" })}
            title="Stretch — show the whole image at the box's exact size, may distort"
          >
            <StretchHorizontal size={12} /> Stretch
          </button>
        </div>
      </div>

      {imageValue.fit === "stretch" ? (
        <p className="text-[11px] text-gray-400">
          Stretch draws the whole image at the box's exact size — it always fully fills the box, but may distort its
          proportions. Zoom and position don't apply in this mode.
        </p>
      ) : (
        <>
          <label className="block">
            <span className="mb-1 flex justify-between text-xs font-medium text-gray-500">
              <span>Zoom</span>
              <span>{Math.round(imageValue.zoom * 100)}%</span>
            </span>
            <input
              type="range"
              min={1}
              max={8}
              step={0.05}
              value={imageValue.zoom}
              className="w-full accent-amber-600"
              onChange={(event) => onChangeImage({ zoom: Number(event.target.value) })}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">Position X</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(imageValue.offsetX * 100)}
                disabled={!canPanX}
                className="w-full accent-amber-600 disabled:opacity-40"
                onChange={(event) => onChangeImage({ offsetX: Number(event.target.value) / 100 })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">Position Y</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(imageValue.offsetY * 100)}
                disabled={!canPanY}
                className="w-full accent-amber-600 disabled:opacity-40"
                onChange={(event) => onChangeImage({ offsetY: Number(event.target.value) / 100 })}
              />
            </label>
          </div>
          {/* At zoom 100% the image exactly covers the box (like any "cover"
              fit crop), so one or both axes can have zero room to pan — the
              slider looks live but visibly does nothing, which read as broken
              rather than "zoom in first" without this. */}
          {!canPanX || !canPanY ? (
            <p className="text-[11px] text-amber-600">
              {!canPanX && !canPanY ? "Position" : !canPanX ? "Position X" : "Position Y"} needs more Zoom before it can move —
              the image already fills the text at 100%.
            </p>
          ) : (
            <p className="text-[11px] text-gray-400">Tip: drag the image directly on the canvas to reposition it.</p>
          )}
        </>
      )}

      <label className="block">
        <span className="mb-1 flex justify-between text-xs font-medium text-gray-500">
          <span>Rotation</span>
          <span>{Math.round(imageValue.rotation)}°</span>
        </span>
        <input
          type="range"
          min={0}
          max={360}
          value={imageValue.rotation}
          className="w-full accent-amber-600"
          onChange={(event) => onChangeImage({ rotation: Number(event.target.value) })}
        />
      </label>

      <div className="flex gap-1.5">
        <button
          type="button"
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium ${imageValue.flipX ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}
          onClick={() => onChangeImage({ flipX: !imageValue.flipX })}
        >
          Flip horizontal
        </button>
        <button
          type="button"
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium ${imageValue.flipY ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}
          onClick={() => onChangeImage({ flipY: !imageValue.flipY })}
        >
          Flip vertical
        </button>
      </div>

      <label className="block">
        <span className="mb-1 flex justify-between text-xs font-medium text-gray-500">
          <span>Opacity</span>
          <span>{Math.round(imageValue.opacity * 100)}%</span>
        </span>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.01}
          value={imageValue.opacity}
          className="w-full accent-amber-600"
          onChange={(event) => onChangeImage({ opacity: Number(event.target.value) })}
        />
      </label>

      <div className="flex gap-1.5 pt-1">
        <button
          type="button"
          className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-amber-300 hover:text-amber-700"
          onClick={() => onChangeImage({ zoom: 1, offsetX: 0.5, offsetY: 0.5, rotation: 0 })}
        >
          Reset position
        </button>
        <button
          type="button"
          className="flex-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          onClick={onRemove}
        >
          Remove image fill
        </button>
      </div>
    </>
  );
}

// Docked panel (not a small anchored dropdown) that opens on the right
// side of the screen — same slot LeftSidebar's compact overlay panel uses
// (top-32/bottom-9, below TopNavBar + the PropertiesToolbar row, above
// StatusBar), portalled to <body> so it always renders above the canvas
// regardless of any clipping ancestor. Two tabs: Solid (the same brand/
// document/recent sections ColorField's dropdown has, plus a much larger
// starter palette) and Gradient (linear/radial, editable stops, presets).
export default function TextColorPanel({
  isOpen,
  onClose,
  solidValue,
  gradientValue,
  imageValue,
  imageBoxWidth,
  imageBoxHeight,
  onChangeSolid,
  onChangeGradient,
  onChangeImage,
  onPickImageAsset,
  onRemoveImage,
  onImageTabActiveChange,
  tokenRef,
  onApplyToken,
  onDetach,
  title = "Text color",
  imageFillDescription = "Fill this text with an image, clipped to the letters.",
}) {
  const [tab, setTab] = useState(imageValue?.assetId ? "image" : gradientValue ? "gradient" : "solid");
  const [hexDraft, setHexDraft] = useState(solidValue || "");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const panelRef = useRef(null);
  const { recentColors, recordColor } = useRecentColors();
  const { activeBrandKit } = useBrandKits();
  const documentColors = useDocumentColors();
  const { objectUrl: imagePreviewUrl, status: imageAssetStatus } = useAsset(imageValue?.assetId);
  // Same "fill" (cover) crop math the renderer uses (imageFill.js) —
  // needed here purely to know whether Position X/Y currently have any
  // room to move: at zoom 100% the image exactly covers the box, so one
  // or both axes can have zero pannable slack until the user zooms in.
  const { naturalWidth: imageNaturalWidth, naturalHeight: imageNaturalHeight } = useImageElement(imagePreviewUrl);
  const isStretch = imageValue?.fit === "stretch";
  const imageFillLayout =
    imageValue?.assetId && imageNaturalWidth && !isStretch
      ? computeImageFillLayout(imageValue, imageNaturalWidth, imageNaturalHeight, imageBoxWidth || 1, imageBoxHeight || 1)
      : null;
  // "stretch" always exactly fills the box on both axes by construction —
  // there's no excess to pan around in, so both are false rather than
  // reading a cropRect that mode never has (see imageFill.js).
  const canPanX = isStretch ? false : !imageFillLayout || imageFillLayout.cropRect.width < imageNaturalWidth - 0.5;
  const canPanY = isStretch ? false : !imageFillLayout || imageFillLayout.cropRect.height < imageNaturalHeight - 0.5;

  useEffect(() => {
    if (isOpen) {
      setTab(imageValue?.assetId ? "image" : gradientValue ? "gradient" : "solid");
      setHexDraft(solidValue || "");
    }
    // Only re-sync when the panel (re)opens — not on every keystroke while
    // typing a hex value below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Reports "the Image tab is the active, open tab" up to TextPropertiesBar
  // so it can enter/exit the on-canvas drag-to-reposition mode
  // (ImageFillOverlay.jsx) — that mode must be explicitly scoped to this
  // tab being open, otherwise it would fight with normal object-move
  // dragging every time image-fill text is simply selected.
  useEffect(() => {
    onImageTabActiveChange?.(isOpen && tab === "image");
    return () => onImageTabActiveChange?.(false);
  }, [isOpen, tab, onImageTabActiveChange]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(event) {
      // The asset picker (ImageAssetPickerModal/BrandModal) renders as a
      // DOM sibling of panelRef, not a descendant — it needs its own
      // Escape-to-close (handled inside BrandModal itself) without this
      // listener also closing the color panel underneath it.
      if (isPickerOpen) return;
      if (event.key === "Escape") onClose();
    }
    function handleOutside(event) {
      if (isPickerOpen) return;
      if (panelRef.current && !panelRef.current.contains(event.target)) onClose();
    }
    window.addEventListener("keydown", handleKey);
    window.addEventListener("mousedown", handleOutside);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("mousedown", handleOutside);
    };
  }, [isOpen, onClose, isPickerOpen]);

  if (!isOpen) return null;

  function applySolid(hex) {
    setHexDraft(hex);
    onChangeSolid(hex);
    recordColor(hex);
  }

  function applyBrandColor(token) {
    if (onApplyToken) onApplyToken(token);
    else applySolid(token.hex);
    recordColor(token.hex);
  }

  const linkedToken = tokenRef && activeBrandKit?.id === tokenRef.brandKitId
    ? activeBrandKit?.colors.find((c) => c.id === tokenRef.tokenId)
    : null;
  const brandColors = activeBrandKit?.colors || [];

  const gradient = gradientValue || defaultGradient();

  function updateGradient(patch) {
    onChangeGradient({ ...gradient, ...patch });
  }

  function updateStop(index, patch) {
    const stops = gradient.stops.map((s, i) => (i === index ? { ...s, ...patch } : s));
    updateGradient({ stops });
  }

  function addStop() {
    if (gradient.stops.length >= 6) return;
    const sorted = [...gradient.stops].sort((a, b) => a.position - b.position);
    const mid = sorted.length >= 2 ? (sorted[0].position + sorted[sorted.length - 1].position) / 2 : 0.5;
    updateGradient({ stops: [...gradient.stops, { position: Math.round(mid * 100) / 100, color: "#ffffff" }] });
  }

  function removeStop(index) {
    if (gradient.stops.length <= 2) return;
    updateGradient({ stops: gradient.stops.filter((_, i) => i !== index) });
  }

  return (
    <>
      {createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label={title}
          className="fixed right-0 top-32 bottom-9 z-40 flex w-80 flex-col overflow-y-auto border-l border-gray-200 bg-white shadow-2xl"
        >
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className="flex gap-1 border-b border-gray-100 px-4 pt-2">
        {[
          { key: "solid", label: "Solid" },
          { key: "gradient", label: "Gradient" },
          { key: "image", label: "Image" },
        ].map((t) => (
          <button
            key={t.key}
            className={`rounded-t-lg px-3 py-2 text-sm font-medium ${
              tab === t.key ? "border-b-2 border-amber-600 text-amber-700" : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-4 p-4">
        {tab === "solid" ? (
          <>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-gray-200 p-0.5"
                value={isValidHex(hexDraft) ? hexDraft : solidValue || "#000000"}
                onChange={(event) => applySolid(event.target.value)}
              />
              <input
                type="text"
                className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-2 text-sm text-gray-700 outline-none focus:border-amber-400 focus:bg-white"
                value={hexDraft}
                placeholder="#000000"
                onChange={(event) => setHexDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && isValidHex(hexDraft)) applySolid(hexDraft);
                }}
                onBlur={() => {
                  if (isValidHex(hexDraft)) applySolid(hexDraft);
                }}
              />
            </div>

            {tokenRef && onDetach && (
              <div className="flex items-center justify-between rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-700">
                <span className="flex items-center gap-1 truncate">
                  <Link2 size={12} /> Linked{linkedToken ? `: ${linkedToken.name}` : " (missing token)"}
                </span>
                <button type="button" className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-semibold hover:bg-amber-100" onClick={onDetach}>
                  <Unlink size={12} /> Detach
                </button>
              </div>
            )}

            {brandColors.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Brand colors</div>
                <div className="grid grid-cols-9 gap-1.5">
                  {brandColors.map((token) => (
                    <button
                      key={token.id}
                      type="button"
                      className="h-6 w-6 rounded border border-gray-200"
                      style={{ backgroundColor: token.hex }}
                      title={`${token.name} (${token.hex})`}
                      aria-label={`Use brand color ${token.name}`}
                      onClick={() => applyBrandColor(token)}
                    />
                  ))}
                </div>
              </div>
            )}

            {documentColors.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Document colors</div>
                <SwatchGrid colors={documentColors.map((c) => c.hex)} onPick={applySolid} />
              </div>
            )}

            {recentColors.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Recent</div>
                <SwatchGrid colors={recentColors} onPick={applySolid} />
              </div>
            )}

            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Palette</div>
              <SwatchGrid colors={STARTER_PALETTE} onPick={applySolid} />
            </div>
          </>
        ) : tab === "gradient" ? (
          <>
            <div
              className="h-16 w-full rounded-lg border border-gray-200"
              style={{ background: gradientToCss(gradient) }}
            />

            <div className="flex gap-1.5">
              {["linear", "radial"].map((type) => (
                <button
                  key={type}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
                    gradient.type === type ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
                  }`}
                  onClick={() => updateGradient({ type })}
                >
                  {type}
                </button>
              ))}
            </div>

            {gradient.type === "linear" && (
              <label className="block">
                <span className="mb-1 flex justify-between text-xs font-medium text-gray-500">
                  <span>Angle</span>
                  <span>{gradient.angle ?? 90}°</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={gradient.angle ?? 90}
                  className="w-full accent-amber-600"
                  onChange={(event) => updateGradient({ angle: Number(event.target.value) })}
                />
              </label>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Color stops</span>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-lg border border-dashed border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-500 hover:border-amber-300 hover:text-amber-700 disabled:opacity-40"
                  onClick={addStop}
                  disabled={gradient.stops.length >= 6}
                >
                  <Plus size={11} /> Add stop
                </button>
              </div>
              {gradient.stops.map((stop, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="color"
                    className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-gray-200 p-0.5"
                    value={isValidHex(stop.color) ? stop.color : "#000000"}
                    onChange={(event) => updateStop(index, { color: event.target.value })}
                  />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={stop.position}
                    className="w-full accent-amber-600"
                    onChange={(event) => updateStop(index, { position: Number(event.target.value) })}
                  />
                  <span className="w-9 shrink-0 text-right text-[11px] text-gray-400">{Math.round(stop.position * 100)}%</span>
                  <button
                    type="button"
                    className="shrink-0 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:pointer-events-none disabled:opacity-0"
                    onClick={() => removeStop(index)}
                    disabled={gradient.stops.length <= 2}
                    aria-label="Remove color stop"
                  >
                    <Minus size={13} />
                  </button>
                </div>
              ))}
            </div>

            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Presets</div>
              <div className="grid grid-cols-4 gap-2">
                {GRADIENT_PRESETS.map((preset, i) => (
                  <button
                    key={i}
                    type="button"
                    className="h-10 rounded-lg border border-gray-200"
                    style={{ background: gradientToCss(preset) }}
                    aria-label={`Use gradient preset ${i + 1}`}
                    onClick={() => onChangeGradient(preset)}
                  />
                ))}
              </div>
            </div>
          </>
        ) : (
          <ImageFillTab
            imageValue={imageValue ? normalizeImageFill(imageValue) : null}
            assetStatus={imageAssetStatus}
            assetPreviewUrl={imagePreviewUrl}
            canPanX={canPanX}
            canPanY={canPanY}
            onChangeImage={onChangeImage}
            onOpenPicker={() => setIsPickerOpen(true)}
            onRemove={onRemoveImage}
            description={imageFillDescription}
          />
        )}
          </div>
        </div>,
        document.body
      )}
      <ImageAssetPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onPick={(assetId) => {
          setIsPickerOpen(false);
          onPickImageAsset(assetId);
        }}
      />
    </>
  );
}
