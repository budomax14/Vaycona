import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, Info, Loader2, Printer, X } from "lucide-react";
import { useLanguage } from "../../languageContext";
import { PRINT_STRINGS } from "../../i18n/print";
import { PAPER_SIZES, PAPER_SIZE_KEYS, PX_PER_INCH } from "../../print/paperSizes";
import { panelSizeIn, sheetSizeIn } from "../../print/printProducts";
import { buildPrintPlan } from "../../print/printPlan";
import { buildCardPdf, printDpi } from "../../print/printPdf";
import { printPdfFromClick } from "../../print/printDelivery";
import { runExportPreflight } from "../../export/exportPreflight";
import { downloadExportResult } from "../../export/exportService";
import SheetPreview from "./SheetPreview";
import { usePanelImages } from "./usePanelImages";

function Segmented({ value, options, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-flow-col gap-1 rounded-lg bg-gray-100 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          role="radio"
          aria-checked={value === opt.value}
          className={`rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
            value === opt.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
          }`}
          onClick={() => onChange(opt.value)}
        >
          <div>{opt.label}</div>
          {opt.hint && <div className="text-[10px] font-normal text-gray-400">{opt.hint}</div>}
        </button>
      ))}
    </div>
  );
}

function Check({ checked, onChange, children, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 py-1 text-sm text-gray-700">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-amber-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {children}
        {hint && <span className="block text-[11px] leading-snug text-gray-400">{hint}</span>}
      </span>
    </label>
  );
}

function formatSize(widthIn, heightIn, paperSize) {
  if (paperSize === "a4") return `${Math.round(widthIn * 25.4)} × ${Math.round(heightIn * 25.4)} mm`;
  const r = (v) => Math.round(v * 100) / 100;
  return `${r(widthIn)} × ${r(heightIn)} in`;
}

export default function PrintSettingsDialog({ isOpen, onClose, card, pages, items, projectName, watermark, onUpdateSettings, onBeforeExport }) {
  const { language } = useLanguage();
  const t = PRINT_STRINGS[language];
  const s = t.settings;
  const [job, setJob] = useState({ status: "idle", message: null });
  const [lowResCount, setLowResCount] = useState(0);
  const abortRef = useRef(null);
  const { images, status: previewStatus } = usePanelImages(card, items, isOpen);
  const plan = useMemo(() => (card ? buildPrintPlan(card) : null), [card]);
  const dpi = useMemo(() => printDpi(), []);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(e) {
      if (e.key === "Escape" && job.status !== "working") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose, job.status]);

  useEffect(() => {
    if (!isOpen) {
      abortRef.current?.abort();
      setJob({ status: "idle", message: null });
    }
  }, [isOpen]);

  // Same preflight the export uses, just for its low-resolution count at
  // the real print DPI.
  useEffect(() => {
    if (!isOpen || !card) return;
    let cancelled = false;
    const pageIds = card.panelOrder.map((key) => card.panels[key].id);
    runExportPreflight({ pages, items }, { pageIds, pixelScale: dpi / PX_PER_INCH })
      .then((result) => !cancelled && setLowResCount(result.lowResCount || 0))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen, card, pages, items, dpi]);

  if (!isOpen || !card || !plan) return null;

  const settings = card.settings;
  const sheet = sheetSizeIn(card.product, settings.paperSize);
  const edgeMode = settings.edgeMode || "standard";
  // Cut to size prints a smaller finished card — report its real size.
  const cutSlot = edgeMode === "trim" ? plan.pages[0].slots[0].trim : null;
  const panel = cutSlot ? { widthIn: cutSlot.width, heightIn: cutSlot.height } : panelSizeIn(card.product, settings.paperSize);
  const edgeWord = plan.duplex?.edge === "long" ? s.edgeLong : s.edgeShort;
  // The edge-mode step goes just before the last step (folding).
  const baseSteps = settings.duplex ? s.duplexSteps(edgeWord) : s.manualSteps(edgeWord);
  const edgeSteps = edgeMode === "borderless" ? [s.borderlessStep(PAPER_SIZES[settings.paperSize].label)] : edgeMode === "trim" ? [s.trimStep] : [];
  const steps = [...baseSteps.slice(0, -1), ...edgeSteps, baseSteps[baseSteps.length - 1]];
  const working = job.status === "working";

  function makePdf() {
    onBeforeExport?.();
    const controller = new AbortController();
    abortRef.current = controller;
    setJob({ status: "working", message: s.working });
    return buildCardPdf({
      card,
      pages,
      items,
      projectName,
      watermark,
      dpi,
      signal: controller.signal,
      onProgress: (p) => {
        if (p.stage === "rendering") setJob({ status: "working", message: s.renderingPanel(t.panelNames[p.panel] || p.panel) });
      },
    });
  }

  function finish(promise) {
    promise
      .then(() => setJob({ status: "done", message: s.done }))
      .catch((err) => {
        if (err?.name === "ExportCancelledError") return setJob({ status: "idle", message: null });
        return setJob({ status: "error", message: err?.message || s.failed });
      });
  }

  const handleDownload = () =>
    finish(
      makePdf().then((result) => {
        downloadExportResult(result.blob, result.filename);
        return result;
      })
    );

  // printPdfFromClick opens its tab synchronously — keep this call first.
  const handlePrint = () => finish(printPdfFromClick(makePdf));

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-settings-title"
        className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5">
          <h2 id="print-settings-title" className="text-base font-semibold text-gray-900">
            {s.title}
          </h2>
          <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label={s.closeAria} disabled={working}>
            <X size={18} />
          </button>
        </div>

        <div className="grid flex-1 overflow-y-auto md:grid-cols-[320px_1fr]">
          <div className="flex flex-col gap-5 border-gray-200 px-5 py-4 md:border-r">
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{s.paperSize}</h3>
              <Segmented
                label={s.paperSize}
                value={settings.paperSize}
                onChange={(paperSize) => onUpdateSettings({ paperSize })}
                options={PAPER_SIZE_KEYS.map((key) => ({ value: key, label: PAPER_SIZES[key].label, hint: PAPER_SIZES[key].dimensionsLabel }))}
              />
              <p className="mt-2 text-[11px] leading-snug text-gray-400">
                {s.finished(formatSize(panel.widthIn, panel.heightIn, settings.paperSize), formatSize(sheet.widthIn, sheet.heightIn, settings.paperSize))}
              </p>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{s.printing}</h3>
              <Segmented
                label={s.printing}
                value={settings.duplex ? "duplex" : "single"}
                onChange={(v) => onUpdateSettings({ duplex: v === "duplex" })}
                options={[
                  { value: "duplex", label: s.doubleSided },
                  { value: "single", label: s.singleSided },
                ]}
              />
              <h4 className="mb-1.5 mt-3 text-[11px] font-medium text-gray-500">{s.duplexEdge}</h4>
              <Segmented
                label={s.duplexEdge}
                value={settings.duplexEdge}
                onChange={(duplexEdge) => onUpdateSettings({ duplexEdge })}
                options={[
                  { value: "long", label: s.flipLong, hint: s.flipLongHint },
                  { value: "short", label: s.flipShort },
                ]}
              />
              <p className="mt-1.5 text-[11px] leading-snug text-gray-400">{s.duplexEdgeHint}</p>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{s.edges}</h3>
              <Segmented
                label={s.edges}
                value={edgeMode}
                onChange={(mode) => onUpdateSettings({ edgeMode: mode })}
                options={[
                  { value: "standard", label: s.edgeStandard },
                  { value: "borderless", label: s.edgeBorderless },
                  { value: "trim", label: s.edgeTrim },
                ]}
              />
              <p className="mt-1.5 text-[11px] leading-snug text-gray-400">
                {edgeMode === "borderless" ? s.edgeBorderlessHint : edgeMode === "trim" ? s.edgeTrimHint : s.edgeStandardHint}
              </p>
            </section>

            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{s.guides}</h3>
              <p className="mb-1 text-[11px] leading-snug text-gray-400">{s.guidesHint}</p>
              <Check checked={settings.guides.fold} onChange={(v) => onUpdateSettings({ guides: { fold: v } })}>
                {s.showFold}
              </Check>
              <Check checked={settings.guides.safe} onChange={(v) => onUpdateSettings({ guides: { safe: v } })}>
                {s.showSafe}
              </Check>
              <Check checked={settings.guides.bleed} onChange={(v) => onUpdateSettings({ guides: { bleed: v } })}>
                {s.showBleed}
              </Check>
              <Check checked={settings.guides.trim} onChange={(v) => onUpdateSettings({ guides: { trim: v } })}>
                {s.showTrim}
              </Check>
            </section>

            {edgeMode === "standard" && (
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{s.professional}</h3>
              <Check checked={settings.bleed} onChange={(v) => onUpdateSettings({ bleed: v, guides: v ? { bleed: true } : {} })} hint={s.bleedHint}>
                {s.bleed}
              </Check>
              <Check checked={settings.printGuides} onChange={(v) => onUpdateSettings({ printGuides: v })} hint={s.printGuidesHint(settings.bleed)}>
                {s.printGuides}
              </Check>
            </section>
            )}
          </div>

          <div className="order-first flex flex-col gap-4 bg-gray-50 px-5 py-4 md:order-none">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-amber-900">
                <Info size={15} /> {s.instructionsTitle}
              </h3>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-amber-900">
                {steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="mt-2 text-[11px] text-amber-800/80">{s.testTip}</p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{s.sheetPreview}</h3>
                {previewStatus === "rendering" && (
                  <span className="flex items-center gap-1 text-[11px] text-gray-400">
                    <Loader2 size={12} className="animate-spin" /> {s.rendering}
                  </span>
                )}
              </div>
              <div className="mx-auto max-w-md">
                <SheetPreview plan={plan} images={images} loading={previewStatus === "rendering"} />
              </div>
            </div>

            {lowResCount > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-amber-700">
                <AlertTriangle size={14} className="mt-px shrink-0" /> {s.lowRes(lowResCount)}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-[1.25rem] text-xs text-gray-500" aria-live="polite">
            {working ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={13} className="animate-spin" /> {job.message}
              </span>
            ) : job.status === "error" ? (
              <span className="text-red-600">{job.message}</span>
            ) : job.status === "done" ? (
              job.message
            ) : (
              s.dpiNote(dpi)
            )}
          </div>
          <div className="flex gap-2">
            <button
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 hover:border-amber-300 hover:text-amber-700 disabled:opacity-50 sm:flex-none"
              onClick={handleDownload}
              disabled={working}
            >
              <Download size={15} /> {s.downloadPdf}
            </button>
            <button
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50 sm:flex-none"
              onClick={handlePrint}
              disabled={working}
            >
              <Printer size={15} /> {s.print}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
