import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Download, Loader2, RotateCcw, X } from "lucide-react";
import { renderPageToCanvas } from "../export/offscreenRenderer";
import { runExportPreflight, preloadExportFonts } from "../export/exportPreflight";
import { PREVIEW_PRODUCTS, PREVIEW_COLORS, findPreviewProduct, findPreviewView } from "../preview/previewProducts";
import { loadGarment, tintGarment, composeGarment, fitDesignToBox, designHeightFraction } from "../preview/garmentRender";
import { useLanguage } from "../languageContext";
import { PREVIEW_STRINGS } from "../i18n/preview";

// Long side of the rendered artwork, in pixels — plenty for a design that is
// shown on a garment at most ~1000px across.
const DESIGN_RENDER_SIZE = 1400;
const MIN_SIZE_PERCENT = 10;
const MAX_SIZE_PERCENT = 300;
const NUDGE_STEP = 0.005;
const NUDGE_STEP_LARGE = 0.02;
// How long the design's outline lingers after the last move/resize input.
const OUTLINE_LINGER_MS = 600;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function ChoiceButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
        active ? "border-amber-500 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
      }`}
      onClick={onClick}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function ControlGroup({ heading, children }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{heading}</div>
      {children}
    </div>
  );
}

export default function PreviewDialog({ isOpen, onClose, pages, items, activePageId, onSaveToUploads }) {
  const { language } = useLanguage();
  const t = PREVIEW_STRINGS[language];

  const [productId, setProductId] = useState(PREVIEW_PRODUCTS[0].id);
  const [viewId, setViewId] = useState("front");
  const [placementId, setPlacementId] = useState(null);
  const [color, setColor] = useState(PREVIEW_COLORS[0]);
  const [pageId, setPageId] = useState(null);
  const [includeBackground, setIncludeBackground] = useState(false);

  const [garment, setGarment] = useState(null);
  const [designCanvas, setDesignCanvas] = useState(null);
  const [design, setDesign] = useState(null);
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState(null);
  const [showOutline, setShowOutline] = useState(false);
  const [saveState, setSaveState] = useState({ status: "idle", message: null });

  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const outlineTimerRef = useRef(null);
  const sliderHeldRef = useRef(false);

  const product = findPreviewProduct(productId);
  const view = findPreviewView(product, viewId);
  const placement = view.placements.find((p) => p.id === placementId) || view.placements[0];
  const page = pages.find((p) => p.id === pageId) || null;
  const designAspect = designCanvas ? designCanvas.height / designCanvas.width : 1;

  // Each open starts on the page being edited.
  useEffect(() => {
    if (isOpen) setPageId(activePageId);
  }, [isOpen, activePageId]);

  // Keeps the view/placement valid when the product changes (the dress shirt
  // has only a front) and drops a placement the new view doesn't offer.
  useEffect(() => {
    if (!product.views.some((v) => v.id === viewId)) setViewId(product.views[0].id);
  }, [product, viewId]);
  useEffect(() => {
    if (!view.placements.some((p) => p.id === placementId)) setPlacementId(view.placements[0].id);
  }, [view, placementId]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    setGarment(null);
    loadGarment(view.image)
      .then((loaded) => {
        if (!cancelled) setGarment(loaded);
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err?.message || t.errorGeneric);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, view.image]);

  // Renders the chosen page as flat artwork — transparent unless the user
  // asks for the page background, since ink only exists where the design is.
  useEffect(() => {
    if (!isOpen || !page) return undefined;
    const controller = new AbortController();
    let cancelled = false;
    setStatus("rendering");
    setErrorMessage(null);

    (async () => {
      try {
        const pixelScale = DESIGN_RENDER_SIZE / Math.max(page.width, page.height);
        const preflight = await runExportPreflight({ pages, items }, { pageIds: [page.id], pixelScale });
        await preloadExportFonts(preflight.fontFamilies);
        const canvas = await renderPageToCanvas({
          page,
          items,
          pixelScale,
          backgroundFill: includeBackground ? page.background || "#ffffff" : null,
          availableAssetIds: preflight.availableAssetIds,
          signal: controller.signal,
        });
        if (cancelled) return;
        setDesignCanvas(canvas);
        setStatus("done");
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(err?.message || t.errorGeneric);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, page?.id, includeBackground]);

  // Snaps the design to the print area whenever the garment, view, placement
  // or design shape changes — never on a color change, so a moved design
  // stays where the user put it while they try colors.
  const placementBox = placement.box;
  const presetKey = `${view.image}|${placement.id}|${designAspect}`;
  const preset = useMemo(
    () => (garment && designCanvas ? fitDesignToBox(garment, placementBox, designAspect) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [garment, presetKey]
  );
  useEffect(() => {
    if (preset) setDesign(preset);
  }, [preset]);

  const tinted = useMemo(() => (garment ? tintGarment(garment, color) : null), [garment, color]);

  useEffect(() => {
    if (!garment || !tinted || !canvasRef.current) return;
    composeGarment(canvasRef.current.getContext("2d"), garment, tinted, designCanvas, design);
  }, [garment, tinted, designCanvas, design]);

  // The dashed outline only exists while the user is moving or resizing:
  // `holdOutline` keeps it up for as long as a drag/slider is held,
  // `flashOutline` shows it briefly for one-off inputs (arrow keys).
  const clearOutlineTimer = () => {
    if (outlineTimerRef.current) window.clearTimeout(outlineTimerRef.current);
    outlineTimerRef.current = null;
  };
  const holdOutline = () => {
    clearOutlineTimer();
    setShowOutline(true);
  };
  const flashOutline = () => {
    holdOutline();
    outlineTimerRef.current = window.setTimeout(() => setShowOutline(false), OUTLINE_LINGER_MS);
  };
  useEffect(() => clearOutlineTimer, []);
  useEffect(() => {
    if (!isOpen) {
      clearOutlineTimer();
      setShowOutline(false);
      setSaveState({ status: "idle", message: null });
    }
  }, [isOpen]);
  // A finished download's "saved" note describes the previous look — clear it
  // as soon as anything about the preview changes.
  useEffect(() => {
    setSaveState({ status: "idle", message: null });
  }, [garment, color, design, designCanvas]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const moveDesign = (dx, dy) =>
    setDesign((current) => (current ? { ...current, cx: clamp(current.cx + dx, 0, 1), cy: clamp(current.cy + dy, 0, 1) } : current));

  function handlePointerDown(e) {
    if (!design || !stageRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    holdOutline();
    dragRef.current = { startX: e.clientX, startY: e.clientY, cx: design.cx, cy: design.cy };
  }

  function handlePointerMove(e) {
    const drag = dragRef.current;
    if (!drag || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    setDesign((current) =>
      current
        ? {
            ...current,
            cx: clamp(drag.cx + (e.clientX - drag.startX) / rect.width, 0, 1),
            cy: clamp(drag.cy + (e.clientY - drag.startY) / rect.height, 0, 1),
          }
        : current
    );
  }

  function handlePointerUp() {
    if (!dragRef.current) return;
    dragRef.current = null;
    flashOutline();
  }

  function handleDesignKeyDown(e) {
    const step = e.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    flashOutline();
    moveDesign(...move);
  }

  // Saves the preview as a PNG download and also adds it to the Uploads
  // library (left panel), so it can be dropped straight onto a page.
  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const fileName = `${productId}-${viewId}-preview.png`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);

      if (!onSaveToUploads) return;
      setSaveState({ status: "saving", message: null });
      try {
        const name = `${t.products[productId]} ${t.views[viewId]} ${t.previewSuffix}`;
        const result = await onSaveToUploads(new File([blob], fileName, { type: "image/png" }), { name, sourceType: "preview" });
        if (result?.status === "error") throw new Error(result.errorMessage);
        setSaveState({ status: "saved", message: t.savedToUploads });
      } catch (err) {
        setSaveState({ status: "error", message: err?.message || t.saveToUploadsFailed });
      }
    }, "image/png");
  }

  const sizePercent = design && preset ? Math.round((design.w / preset.w) * 100) : 100;
  const designHeight = garment && design ? designHeightFraction(garment, design, designAspect) : 0;
  const ready = status === "done" && garment && design;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-dialog-title"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 id="preview-dialog-title" className="text-base font-semibold text-gray-900">
            {t.title}
          </h2>
          <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label={t.closeAria}>
            <X size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4 md:flex-row">
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="mb-3 text-sm text-gray-500">{t.description}</p>
            <div className="relative flex min-h-[320px] flex-1 items-center justify-center overflow-hidden rounded-xl bg-gray-100 p-3">
              {status === "error" && (
                <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-red-600">
                  <AlertTriangle size={22} />
                  <span className="text-sm">{errorMessage}</span>
                </div>
              )}
              {status !== "error" && (
                <div ref={stageRef} className="relative inline-block max-w-full select-none">
                  {garment && (
                    <canvas
                      ref={canvasRef}
                      width={garment.width}
                      height={garment.height}
                      className="block h-auto max-h-[62vh] w-auto max-w-full"
                    />
                  )}
                  {ready && (
                    <div
                      role="group"
                      tabIndex={0}
                      aria-label={t.designAria}
                      className={`absolute cursor-move touch-none rounded-sm outline-dashed outline-1 outline-offset-0 transition-[outline-color] duration-150 ${
                        showOutline ? "outline-amber-500" : "outline-transparent"
                      }`}
                      style={{
                        left: `${(design.cx - design.w / 2) * 100}%`,
                        top: `${(design.cy - designHeight / 2) * 100}%`,
                        width: `${design.w * 100}%`,
                        height: `${designHeight * 100}%`,
                      }}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      onKeyDown={handleDesignKeyDown}
                    />
                  )}
                </div>
              )}
              {status === "rendering" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/60 text-gray-600">
                  <Loader2 size={22} className="animate-spin" />
                  <span className="text-sm">{t.rendering}</span>
                </div>
              )}
            </div>
            <p className="mt-2 text-center text-xs text-gray-400">{t.moveHint}</p>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-4 md:w-72">
            <ControlGroup heading={t.designHeading}>
              <select
                className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700"
                value={page?.id || ""}
                onChange={(e) => setPageId(e.target.value)}
                aria-label={t.pageLabel}
              >
                {pages.map((p, index) => (
                  <option key={p.id} value={p.id}>
                    {p.name || t.pageFallback(index + 1)}
                  </option>
                ))}
              </select>
              <label className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={includeBackground} onChange={(e) => setIncludeBackground(e.target.checked)} />
                {t.includeBackground}
              </label>
            </ControlGroup>

            <ControlGroup heading={t.garmentHeading}>
              <div className="flex flex-wrap gap-1.5">
                {PREVIEW_PRODUCTS.map((p) => (
                  <ChoiceButton key={p.id} active={p.id === productId} onClick={() => setProductId(p.id)}>
                    {t.products[p.id]}
                  </ChoiceButton>
                ))}
              </div>
            </ControlGroup>

            {product.views.length > 1 && (
              <ControlGroup heading={t.viewHeading}>
                <div className="flex flex-wrap gap-1.5">
                  {product.views.map((v) => (
                    <ChoiceButton key={v.id} active={v.id === view.id} onClick={() => setViewId(v.id)}>
                      {t.views[v.id]}
                    </ChoiceButton>
                  ))}
                </div>
              </ControlGroup>
            )}

            {view.placements.length > 1 && (
              <ControlGroup heading={t.placementHeading}>
                <div className="flex flex-wrap gap-1.5">
                  {view.placements.map((p) => (
                    <ChoiceButton key={p.id} active={p.id === placement.id} onClick={() => setPlacementId(p.id)}>
                      {t.placements[p.id]}
                    </ChoiceButton>
                  ))}
                </div>
              </ControlGroup>
            )}

            <ControlGroup heading={t.colorHeading}>
              <div className="flex flex-wrap items-center gap-1.5">
                {PREVIEW_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className={`h-7 w-7 rounded-full border ${
                      hex === color ? "border-amber-600 ring-2 ring-amber-300" : "border-gray-300 hover:scale-110"
                    }`}
                    style={{ backgroundColor: hex }}
                    onClick={() => setColor(hex)}
                    aria-label={t.colorAria(hex)}
                    aria-pressed={hex === color}
                  />
                ))}
                <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border border-gray-300" title={t.customColor}>
                  <span
                    className="absolute inset-0"
                    style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }}
                    aria-hidden="true"
                  />
                  <input
                    type="color"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    aria-label={t.customColor}
                  />
                </label>
              </div>
            </ControlGroup>

            <ControlGroup heading={t.sizeHeading}>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  className="flex-1 accent-amber-600"
                  min={MIN_SIZE_PERCENT}
                  max={MAX_SIZE_PERCENT}
                  value={sizePercent}
                  disabled={!ready}
                  onPointerDown={() => {
                    sliderHeldRef.current = true;
                    holdOutline();
                  }}
                  onPointerUp={() => {
                    sliderHeldRef.current = false;
                    flashOutline();
                  }}
                  onPointerCancel={() => {
                    sliderHeldRef.current = false;
                    flashOutline();
                  }}
                  onChange={(e) => {
                    if (!preset) return;
                    // A held slider already keeps the outline up; keyboard
                    // steps have no press/release, so they flash it instead.
                    if (!sliderHeldRef.current) flashOutline();
                    const percent = Number(e.target.value);
                    setDesign((current) => (current ? { ...current, w: (preset.w * percent) / 100 } : current));
                  }}
                  aria-label={t.sizeHeading}
                />
                <span className="w-10 text-right text-xs text-gray-500">{sizePercent}%</span>
              </div>
              <button
                type="button"
                className="mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                onClick={() => preset && setDesign(preset)}
                disabled={!ready}
              >
                <RotateCcw size={14} /> {t.resetPosition}
              </button>
            </ControlGroup>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
          {saveState.message && (
            <span
              className={`mr-auto flex items-center gap-1.5 text-sm ${saveState.status === "error" ? "text-red-600" : "text-green-700"}`}
              role="status"
            >
              {saveState.status === "error" ? <AlertTriangle size={14} /> : <Check size={14} />}
              {saveState.message}
            </span>
          )}
          <button className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100" onClick={onClose}>
            {t.close}
          </button>
          <button
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
            onClick={handleDownload}
            disabled={!ready || saveState.status === "saving"}
          >
            <Download size={16} /> {t.download}
          </button>
        </div>
      </div>
    </div>
  );
}
