import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  FileImage,
  FileText,
  Loader2,
  Scissors,
  X,
} from "lucide-react";
import { getUnit, UNITS } from "../pageSizes";
import {
  BLEED_PRESETS,
  DEFAULT_PRINT_SCALE,
  DEFAULT_STANDARD_SCALE,
  EXPORT_SETTINGS_STORAGE_KEY,
  JPEG_QUALITY_PRESETS,
  SCALE_PRESETS,
} from "../export/exportConstants";
import { estimatedOutputDimensions, estimateFileSizeRange, parsePageRange } from "../export/exportRequest";
import { prepareExportRequest, runExport, runPreflight, downloadExportResult, ExportCancelledError } from "../export/exportService";
import { resolveStaticExportItems } from "../animation/animationService";

const STAGE_LABELS = {
  preparing: "Preparing pages…",
  "loading-fonts": "Loading fonts…",
  rendering: "Rendering",
  packaging: "Packaging files…",
  finalizing: "Finishing up…",
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function loadRememberedSettings() {
  try {
    const raw = localStorage.getItem(EXPORT_SETTINGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function rememberSettings(partial) {
  try {
    const current = loadRememberedSettings();
    localStorage.setItem(EXPORT_SETTINGS_STORAGE_KEY, JSON.stringify({ ...current, ...partial }));
  } catch {
    // Best-effort only — never blocks export.
  }
}

const FORMAT_OPTIONS = [
  { key: "png", label: "PNG", icon: FileImage, hint: "Sharp edges, transparency" },
  { key: "jpeg", label: "JPEG", icon: FileImage, hint: "Smaller files, photos" },
  { key: "pdf", label: "PDF", icon: FileText, hint: "Multi-page, print" },
  { key: "svg", label: "SVG", icon: Scissors, hint: "Vector, single page" },
];

export default function ExportDialog({
  isOpen,
  onClose,
  pages,
  activePageId,
  items,
  projectName,
  onFlushBeforeExport,
  onCreateVersionBeforeExport,
  initialFormat,
  watermark = false,
}) {
  const remembered = useMemo(() => (isOpen ? loadRememberedSettings() : {}), [isOpen]);
  const [format, setFormat] = useState("png");
  const [pageSelection, setPageSelection] = useState("current");
  const [customPageIds, setCustomPageIds] = useState([]);
  const [rangeText, setRangeText] = useState("");
  const [rangeError, setRangeError] = useState(null);
  const [scale, setScale] = useState(1);
  const [useCustomDimensions, setUseCustomDimensions] = useState(false);
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");
  const [customUnit, setCustomUnit] = useState("px");
  const [lockAspect, setLockAspect] = useState(true);
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [backgroundOverride, setBackgroundOverride] = useState(null);
  const [jpegQuality, setJpegQuality] = useState("high");
  const [pdfMode, setPdfMode] = useState("standard");
  const [bleedPresetKey, setBleedPresetKey] = useState("none");
  const [customBleedIn, setCustomBleedIn] = useState(0.125);
  const [cropMarks, setCropMarks] = useState(false);
  const [filenameBase, setFilenameBase] = useState(projectName);
  const [createVersionBeforeExport, setCreateVersionBeforeExport] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [step, setStep] = useState("form"); // form | preflight | progress | done | error
  const [preflightResult, setPreflightResult] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [formErrors, setFormErrors] = useState([]);
  const [progress, setProgress] = useState({ stage: "preparing" });
  const [resultInfo, setResultInfo] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const controllerRef = useRef(null);
  const dialogRef = useRef(null);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep("form");
    setFormErrors([]);
    setResultInfo(null);
    setErrorMessage(null);
    setFormat(initialFormat && ["png", "jpeg", "pdf", "svg"].includes(initialFormat) ? initialFormat : remembered.format || "png");
    setPageSelection(remembered.pageSelection || "current");
    setCustomPageIds([]);
    setRangeText("");
    setRangeError(null);
    setScale(remembered.scale || 1);
    setUseCustomDimensions(false);
    setCustomWidth("");
    setCustomHeight("");
    setLockAspect(true);
    setTransparentBackground(false);
    setBackgroundOverride(null);
    setJpegQuality(remembered.jpegQuality || "high");
    setPdfMode(remembered.pdfMode || "standard");
    setBleedPresetKey("none");
    setCropMarks(false);
    setFilenameBase(projectName);
    setCreateVersionBeforeExport(false);
    setAdvancedOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    // PDF print mode defaults to a sharper scale unless the user already
    // touched the scale control themselves this session.
    if (format === "pdf") setScale(pdfMode === "print" ? DEFAULT_PRINT_SCALE : DEFAULT_STANDARD_SCALE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, pdfMode]);

  useEffect(() => {
    if (isOpen && step === "form") window.setTimeout(() => firstFieldRef.current?.focus(), 10);
  }, [isOpen, step]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(event) {
      if (event.key === "Escape") {
        if (step === "progress") cancelExport();
        else onClose();
        return;
      }
      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll("button, input, select, [tabindex]:not([tabindex='-1'])");
        if (!focusable || focusable.length === 0) return;
        const list = Array.from(focusable).filter((el) => !el.disabled);
        const first = list[0];
        const last = list[list.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, step]);

  if (!isOpen) return null;

  const isMultiPageCapable = format !== "svg";
  const bleedPx = format === "pdf" && pdfMode === "print"
    ? bleedPresetKey === "none"
      ? 0
      : getUnit("in").toPx(bleedPresetKey === "custom" ? Number(customBleedIn) || 0 : BLEED_PRESETS.find((b) => b.key === bleedPresetKey)?.inches || 0)
    : 0;

  function buildRawRequest() {
    let resolvedPageIds = [];
    if (!isMultiPageCapable) resolvedPageIds = [activePageId];
    else if (pageSelection === "all") resolvedPageIds = pages.map((p) => p.id);
    else if (pageSelection === "custom") resolvedPageIds = customPageIds;
    else resolvedPageIds = [activePageId];

    return {
      format,
      pageSelection: isMultiPageCapable ? pageSelection : "current",
      pageIds: resolvedPageIds,
      scale,
      useCustomDimensions,
      customWidth,
      customHeight,
      customUnit,
      transparentBackground,
      backgroundOverride,
      jpegQuality,
      pdfMode,
      bleedPx,
      cropMarks,
      filenameBase,
      createVersionBeforeExport,
      watermark,
    };
  }

  // Phase 12 spec §67/§68 — static export always uses each page's fully
  // visible "final design state" (every entrance finished, no exit yet
  // started), never a raw mid-entrance frame. A no-op for any page with no
  // animations, so pre-Phase-12 projects export byte-for-byte the same.
  const context = { pages, activePageId, items: resolveStaticExportItems(items, pages), projectName };
  const { request: livePreviewRequest } = prepareExportRequest(buildRawRequest(), context);
  const previewPage = pages.find((p) => p.id === (livePreviewRequest.pageIds[0] || activePageId)) || pages[0];
  const outputDims = previewPage ? estimatedOutputDimensions(previewPage, livePreviewRequest) : null;
  const sizeRange = previewPage ? estimateFileSizeRange(previewPage, livePreviewRequest) : null;

  function applyRangeText(text) {
    setRangeText(text);
    if (!text.trim()) {
      setCustomPageIds([]);
      setRangeError(null);
      return;
    }
    const { indices, errors } = parsePageRange(text, pages.length);
    if (errors.length) {
      setRangeError(errors[0]);
      return;
    }
    setRangeError(null);
    setCustomPageIds(indices.map((i) => pages[i].id));
  }

  function togglePageCheckbox(pageId) {
    setCustomPageIds((prev) => (prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]));
  }

  async function handleExportClick() {
    const { request, errors } = prepareExportRequest(buildRawRequest(), context);
    if (errors.length) {
      setFormErrors(errors);
      return;
    }
    setFormErrors([]);
    onFlushBeforeExport?.();
    setPendingRequest(request);

    const preflight = await runPreflight(request, context);
    setPreflightResult(preflight);
    if (preflight.status === "blocked") {
      setStep("preflight");
      return;
    }
    if (preflight.status === "warnings") {
      setStep("preflight");
      return;
    }
    await startRender(request, preflight);
  }

  async function startRender(request, preflight) {
    rememberSettings({ format: request.format, scale: request.scale, jpegQuality: request.jpegQuality, pdfMode: request.pdfMode, pageSelection });
    if (createVersionBeforeExport) {
      try {
        await onCreateVersionBeforeExport?.();
      } catch {
        // Best-effort — never blocks the export itself.
      }
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setStep("progress");
    setProgress({ stage: "preparing" });
    try {
      const result = await runExport(request, context, {
        signal: controller.signal,
        preflight,
        onProgress: (info) => setProgress(info),
      });
      downloadExportResult(result.blob, result.filename);
      setResultInfo(result);
      setStep("done");
    } catch (err) {
      if (err instanceof ExportCancelledError) {
        setStep("form");
        return;
      }
      setErrorMessage(err?.message || "Export failed unexpectedly.");
      setStep("error");
    } finally {
      controllerRef.current = null;
    }
  }

  function cancelExport() {
    controllerRef.current?.abort();
  }

  function retryExport() {
    if (pendingRequest) startRender(pendingRequest, preflightResult);
  }

  const progressPageLabel =
    progress.stage === "rendering" && progress.pageCount > 1
      ? `Rendering page ${progress.pageIndex + 1} of ${progress.pageCount} (${progress.pageName})`
      : progress.stage === "rendering"
        ? `Rendering ${progress.pageName || "page"}…`
        : STAGE_LABELS[progress.stage] || "Working…";
  const progressPercent = progress.stage === "rendering" && progress.pageCount > 0 ? Math.round(((progress.pageIndex || 0) / progress.pageCount) * 100) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 id="export-dialog-title" className="text-base font-semibold text-gray-900">
            Export design
          </h2>
          <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={step === "progress" ? cancelExport : onClose} aria-label="Close export dialog">
            <X size={18} />
          </button>
        </div>

        {step === "form" && (
          <div className="overflow-y-auto px-5 py-4">
            {formErrors.length > 0 && (
              <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {formErrors.map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
              </div>
            )}

            {watermark && (
              <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Free plan exports include a small watermark. Upgrade to Pro or Business for clean exports.
              </div>
            )}

            <fieldset className="mb-5">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">File type</legend>
              <div className="grid grid-cols-4 gap-2">
                {FORMAT_OPTIONS.map((opt, i) => (
                  <button
                    key={opt.key}
                    ref={i === 0 ? firstFieldRef : undefined}
                    type="button"
                    className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center transition-colors ${
                      format === opt.key ? "border-amber-500 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600 hover:border-amber-300"
                    }`}
                    onClick={() => setFormat(opt.key)}
                    aria-pressed={format === opt.key}
                  >
                    <opt.icon size={18} />
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <span className="text-[10px] text-gray-400">{opt.hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {isMultiPageCapable && (
              <fieldset className="mb-5">
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Pages</legend>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "current", label: "Current page" },
                    { key: "all", label: `All pages (${pages.length})` },
                    { key: "custom", label: "Custom selection" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                        pageSelection === opt.key ? "border-amber-500 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600 hover:border-amber-300"
                      }`}
                      onClick={() => setPageSelection(opt.key)}
                      aria-pressed={pageSelection === opt.key}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {pageSelection === "custom" && (
                  <div className="mt-3 space-y-2">
                    <label className="block text-xs font-medium text-gray-500" htmlFor="export-page-range">
                      Page range (e.g. 1-3,6)
                    </label>
                    <input
                      id="export-page-range"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
                      value={rangeText}
                      onChange={(event) => applyRangeText(event.target.value)}
                      placeholder="1-3,6"
                    />
                    {rangeError && <p className="text-xs text-red-600">{rangeError}</p>}
                    <div className="grid max-h-32 grid-cols-2 gap-1 overflow-y-auto rounded-lg border border-gray-100 p-2 sm:grid-cols-3">
                      {pages.map((page, i) => (
                        <label key={page.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                          <input
                            type="checkbox"
                            checked={customPageIds.includes(page.id)}
                            onChange={() => togglePageCheckbox(page.id)}
                            aria-label={`Page ${i + 1}: ${page.name || `Page ${i + 1}`}`}
                          />
                          {i + 1}. {page.name || `Page ${i + 1}`}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </fieldset>
            )}
            {!isMultiPageCapable && (
              <p className="mb-5 text-xs text-gray-400">SVG export supports one page at a time — exporting the current page.</p>
            )}

            {format !== "pdf" && (
              <fieldset className="mb-5">
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Scale</legend>
                <div className="flex flex-wrap gap-2">
                  {SCALE_PRESETS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                        !useCustomDimensions && scale === s ? "border-amber-500 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600 hover:border-amber-300"
                      }`}
                      onClick={() => {
                        setUseCustomDimensions(false);
                        setScale(s);
                      }}
                      aria-pressed={!useCustomDimensions && scale === s}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {format === "png" && (
              <fieldset className="mb-5 flex items-center justify-between">
                <label htmlFor="export-transparent" className="text-sm font-medium text-gray-700">
                  Transparent background
                </label>
                <input id="export-transparent" type="checkbox" checked={transparentBackground} onChange={(event) => setTransparentBackground(event.target.checked)} />
              </fieldset>
            )}

            {format === "jpeg" && (
              <fieldset className="mb-5">
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Quality</legend>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(JPEG_QUALITY_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      type="button"
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                        jpegQuality === key ? "border-amber-500 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600 hover:border-amber-300"
                      }`}
                      onClick={() => setJpegQuality(key)}
                      aria-pressed={jpegQuality === key}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-gray-400">Lower quality makes a smaller file but may show compression artifacts.</p>
              </fieldset>
            )}

            {format === "pdf" && (
              <>
                <fieldset className="mb-5">
                  <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">PDF mode</legend>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={`flex-1 rounded-lg border px-3 py-2 text-left text-sm ${
                        pdfMode === "standard" ? "border-amber-500 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600"
                      }`}
                      onClick={() => setPdfMode("standard")}
                      aria-pressed={pdfMode === "standard"}
                    >
                      <span className="block font-semibold">Standard</span>
                      <span className="block text-xs text-gray-400">Smaller file, for sharing/screen viewing</span>
                    </button>
                    <button
                      type="button"
                      className={`flex-1 rounded-lg border px-3 py-2 text-left text-sm ${
                        pdfMode === "print" ? "border-amber-500 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600"
                      }`}
                      onClick={() => setPdfMode("print")}
                      aria-pressed={pdfMode === "print"}
                    >
                      <span className="block font-semibold">Print</span>
                      <span className="block text-xs text-gray-400">Higher resolution, bleed, crop marks</span>
                    </button>
                  </div>
                </fieldset>

                {pdfMode === "print" && (
                  <fieldset className="mb-5">
                    <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Bleed</legend>
                    <div className="flex flex-wrap items-center gap-2">
                      {BLEED_PRESETS.map((preset) => (
                        <button
                          key={preset.key}
                          type="button"
                          className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                            bleedPresetKey === preset.key ? "border-amber-500 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600"
                          }`}
                          onClick={() => setBleedPresetKey(preset.key)}
                          aria-pressed={bleedPresetKey === preset.key}
                        >
                          {preset.label}
                        </button>
                      ))}
                      {bleedPresetKey === "custom" && (
                        <label className="flex items-center gap-1 text-sm text-gray-600">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm"
                            value={customBleedIn}
                            onChange={(event) => setCustomBleedIn(event.target.value)}
                            aria-label="Custom bleed in inches"
                          />
                          in
                        </label>
                      )}
                    </div>
                    <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={cropMarks} onChange={(event) => setCropMarks(event.target.checked)} />
                      Add crop marks
                    </label>
                  </fieldset>
                )}
                <p className="mb-5 text-xs text-gray-400">
                  Print PDF output stays RGB (this app doesn't perform CMYK color separation) — export a physical proof before a professional print run.
                </p>
              </>
            )}

            <button
              type="button"
              className="mb-3 flex items-center gap-1 text-xs font-medium text-amber-600"
              onClick={() => setAdvancedOpen((v) => !v)}
              aria-expanded={advancedOpen}
            >
              <ChevronDown size={14} className={advancedOpen ? "rotate-180 transition-transform" : "transition-transform"} />
              Advanced settings
            </button>
            {advancedOpen && (
              <div className="mb-5 space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Filename</label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
                    value={filenameBase}
                    onChange={(event) => setFilenameBase(event.target.value)}
                  />
                </div>
                {format !== "pdf" && (
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={useCustomDimensions} onChange={(event) => setUseCustomDimensions(event.target.checked)} />
                    Use custom width/height instead of scale
                  </label>
                )}
                {useCustomDimensions && format !== "pdf" && (
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500">Width</span>
                      <input
                        type="number"
                        className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                        value={customWidth}
                        onChange={(event) => {
                          const val = event.target.value;
                          setCustomWidth(val);
                          if (lockAspect && previewPage) {
                            const unit = getUnit(customUnit);
                            const ratio = previewPage.height / previewPage.width;
                            setCustomHeight(String(Math.round(unit.fromPx(unit.toPx(Number(val) || 0) * ratio) * 100) / 100));
                          }
                        }}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500">Height</span>
                      <input
                        type="number"
                        className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                        value={customHeight}
                        onChange={(event) => setCustomHeight(event.target.value)}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500">Unit</span>
                      <select className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" value={customUnit} onChange={(event) => setCustomUnit(event.target.value)}>
                        {UNITS.map((u) => (
                          <option key={u.key} value={u.key}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="mb-1.5 flex items-center gap-1 text-xs text-gray-600">
                      <input type="checkbox" checked={lockAspect} onChange={(event) => setLockAspect(event.target.checked)} />
                      Lock aspect ratio
                    </label>
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={createVersionBeforeExport} onChange={(event) => setCreateVersionBeforeExport(event.target.checked)} />
                  Create a version before exporting
                </label>
              </div>
            )}

            {previewPage && outputDims && (
              <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-xs text-gray-500">
                Estimated output: <span className="font-medium text-gray-700">{outputDims.width}×{outputDims.height}px</span>
                {sizeRange && (
                  <>
                    {" "}
                    · <span className="font-medium text-gray-700">{formatBytes(sizeRange[0])}–{formatBytes(sizeRange[1])}</span>
                    {livePreviewRequest.zipMultiple ? " per page (zipped)" : ""}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {step === "preflight" && preflightResult && (
          <div className="overflow-y-auto px-5 py-4">
            <div className="mb-3 flex items-center gap-2 text-amber-700">
              <AlertTriangle size={18} />
              <h3 className="text-sm font-semibold">
                {preflightResult.status === "blocked" ? "This export can't proceed" : "Before you export"}
              </h3>
            </div>
            <ul className="mb-4 space-y-2 text-sm text-gray-600">
              {preflightResult.blockers.map((b, i) => (
                <li key={`b-${i}`} className="rounded-lg bg-red-50 px-3 py-2 text-red-700">
                  {b}
                </li>
              ))}
              {preflightResult.warnings.map((w, i) => (
                <li key={`w-${i}`} className="rounded-lg bg-amber-50 px-3 py-2 text-amber-700">
                  {w.message}
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <button className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100" onClick={() => setStep("form")}>
                Go back
              </button>
              {preflightResult.status !== "blocked" && (
                <button
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                  onClick={() => startRender(pendingRequest, preflightResult)}
                >
                  Export anyway
                </button>
              )}
            </div>
          </div>
        )}

        {step === "progress" && (
          <div className="flex flex-col items-center gap-4 px-5 py-10">
            <Loader2 size={28} className="animate-spin text-amber-600" />
            <div className="text-center" aria-live="polite">
              <p className="text-sm font-medium text-gray-700">{progressPageLabel}</p>
              {progressPercent !== null && <p className="mt-1 text-xs text-gray-400">{progressPercent}% of pages rendered</p>}
            </div>
            <button className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50" onClick={cancelExport}>
              Cancel
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
            <p className="text-sm font-medium text-gray-800">Downloaded {resultInfo?.filename}</p>
            {resultInfo?.bleedNote && <p className="max-w-md text-xs text-gray-400">{resultInfo.bleedNote}</p>}
            <button className="mt-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700" onClick={onClose}>
              Done
            </button>
          </div>
        )}

        {step === "error" && (
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle size={20} />
            </div>
            <p className="text-sm font-medium text-gray-800">{errorMessage}</p>
            <div className="mt-2 flex gap-2">
              <button className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100" onClick={onClose}>
                Close
              </button>
              <button className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700" onClick={retryExport}>
                Retry
              </button>
            </div>
          </div>
        )}

        {step === "form" && (
          <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
            <button className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100" onClick={onClose}>
              Cancel
            </button>
            <button className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700" onClick={handleExportClick}>
              <Download size={15} /> Export
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
