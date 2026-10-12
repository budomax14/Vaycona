import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, Info, Loader2, Printer, X } from "lucide-react";
import { useLanguage } from "../../languageContext";
import { LABEL_STRINGS } from "../../i18n/labels";
import { getPaperSize, MM_PER_INCH, PX_PER_INCH } from "../../print/paperSizes";
import { buildLabelPrintPlan } from "../../print/labelSheet";
import { buildLabelSheetPdf, labelPrintDpi } from "../../print/labelPdf";
import { MAX_OFFSET_IN } from "../../print/labelProject";
import { printPdfFromClick } from "../../print/printDelivery";
import { runExportPreflight } from "../../export/exportPreflight";
import { downloadExportResult } from "../../export/exportService";
import { isMobileDevice } from "../../canvasPixelBudget";
import { useLabelImages } from "./useLabelImages";
import LabelSheetView from "./LabelSheetView";
import FreeProjectNotice from "../FreeProjectNotice";

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

// Inches on Letter sheets, millimetres on metric ones; always stored as inches.
function OffsetField({ label, valueIn, metric, onChange }) {
  const unit = metric ? "mm" : "in";
  const toDisplay = (v) => (metric ? Math.round(v * MM_PER_INCH * 10) / 10 : Math.round(v * 1000) / 1000);
  const [draft, setDraft] = useState(String(toDisplay(valueIn)));
  useEffect(() => setDraft(String(toDisplay(valueIn))), [valueIn, metric]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = () => {
    const n = Number(draft);
    if (!Number.isFinite(n)) return setDraft(String(toDisplay(valueIn)));
    onChange(metric ? n / MM_PER_INCH : n);
  };
  const max = toDisplay(MAX_OFFSET_IN);
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-gray-700">
      {label}
      <span className="flex items-center gap-1">
        <input
          type="number"
          step={metric ? 0.5 : 0.01}
          min={-max}
          max={max}
          className="w-20 rounded-md border border-gray-200 px-2 py-1 text-right text-xs"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
        />
        <span className="w-5 text-gray-400">{unit}</span>
      </span>
    </label>
  );
}

function isBlankPage(page, items) {
  return (!page.background || page.background.toLowerCase() === "#ffffff") && !items.some((it) => it.pageId === page.id);
}

// The label sheet's print preview + print-ready PDF. The preview is drawn
// from the same plan and the same label renderer as the PDF, so it shows
// exactly where every label lands on the paper (printer nudge included).
export default function LabelPrintDialog({ isOpen, onClose, sheet, pages, items, projectName, resolveWatermark, freeProjectStatus, onUpgrade, onUpdateSettings, onBeforeExport }) {
  const { language } = useLanguage();
  const t = LABEL_STRINGS[language].print;
  const [job, setJob] = useState({ status: "idle", message: null });
  const [lowResCount, setLowResCount] = useState(0);
  const [previewOutlines, setPreviewOutlines] = useState(false);
  const abortRef = useRef(null);
  const plan = useMemo(() => (sheet ? buildLabelPrintPlan(sheet) : null), [sheet]);
  const uniquePages = plan?.uniquePages;
  const { images, progress } = useLabelImages({
    pages: uniquePages || [],
    items,
    label: sheet?.template.label,
    enabled: isOpen && !!sheet,
    pxPerInch: isMobileDevice() ? 110 : 160,
    debounceMs: 50,
  });
  const dpi = labelPrintDpi(sheet?.settings.quality);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKey = (e) => e.key === "Escape" && job.status !== "working" && onClose();
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose, job.status]);

  useEffect(() => {
    if (!isOpen) {
      abortRef.current?.abort();
      setJob({ status: "idle", message: null });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !uniquePages) return undefined;
    let cancelled = false;
    runExportPreflight({ pages, items }, { pageIds: uniquePages.map((p) => p.id), pixelScale: dpi / PX_PER_INCH })
      .then((result) => !cancelled && setLowResCount(result.lowResCount || 0))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen, uniquePages, pages, items, dpi]);

  if (!isOpen || !sheet || !plan) return null;

  const paper = getPaperSize(plan.paperKey);
  const metric = plan.paperKey !== "letter";
  const settings = sheet.settings;
  const working = job.status === "working";
  const emptyCount = plan.slots.filter((slot) => !slot.page || isBlankPage(slot.page, items)).length;
  const hasOffset = settings.offsetXIn !== 0 || settings.offsetYIn !== 0;

  async function makePdf() {
    onBeforeExport?.();
    const controller = new AbortController();
    abortRef.current = controller;
    setJob({ status: "working", message: t.working });
    const watermark = await resolveWatermark();
    return buildLabelSheetPdf({
      sheet,
      pages,
      items,
      projectName,
      watermark,
      dpi,
      signal: controller.signal,
      onProgress: (p) => {
        if (p.stage === "rendering") setJob({ status: "working", message: t.renderingLabel(p.index + 1, p.total) });
      },
    });
  }

  function finish(promise) {
    promise
      .then(() => setJob({ status: "done", message: t.done }))
      .catch((err) => {
        if (err?.name === "ExportCancelledError") return setJob({ status: "idle", message: null });
        return setJob({ status: "error", message: err?.message || t.failed });
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
    <div className="preview-safe-edges fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 sm:items-center" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="label-print-title"
        className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-full sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5">
          <h2 id="label-print-title" className="text-base font-semibold text-gray-900">
            {t.title}
          </h2>
          <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label={t.closeAria} disabled={working}>
            <X size={18} />
          </button>
        </div>

        <div className="grid flex-1 overflow-y-auto md:grid-cols-[300px_1fr]">
          <div className="flex flex-col gap-5 border-gray-200 px-5 py-4 md:border-r">
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t.quality}</h3>
              <Segmented
                label={t.quality}
                value={settings.quality}
                onChange={(quality) => onUpdateSettings({ quality })}
                options={[
                  { value: "standard", label: t.qualityStandard, hint: t.qualityStandardHint },
                  { value: "high", label: t.qualityHigh, hint: t.qualityHighHint },
                ]}
              />
              {isMobileDevice() && <p className="mt-1.5 text-[11px] text-gray-400">{t.qualityPhoneNote}</p>}
            </section>

            <section>
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t.alignment}</h3>
                {hasOffset && (
                  <button className="text-[11px] font-medium text-amber-700 hover:underline" onClick={() => onUpdateSettings({ offsetXIn: 0, offsetYIn: 0 })}>
                    {t.resetOffset}
                  </button>
                )}
              </div>
              <p className="mb-2 text-[11px] leading-snug text-gray-400">{t.alignmentHint}</p>
              <div className="flex flex-col gap-1.5">
                <OffsetField label={t.offsetX} valueIn={settings.offsetXIn} metric={metric} onChange={(v) => onUpdateSettings({ offsetXIn: v })} />
                <OffsetField label={t.offsetY} valueIn={settings.offsetYIn} metric={metric} onChange={(v) => onUpdateSettings({ offsetYIn: v })} />
              </div>
            </section>

            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{t.testPrint}</h3>
              <label className="flex cursor-pointer items-start gap-2 py-1 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-amber-600"
                  checked={settings.printOutlines}
                  onChange={(e) => onUpdateSettings({ printOutlines: e.target.checked })}
                />
                <span>
                  {t.printOutlines}
                  <span className="block text-[11px] leading-snug text-gray-400">{t.printOutlinesHint}</span>
                </span>
              </label>
            </section>
          </div>

          <div className="order-first flex flex-col gap-4 bg-gray-50 px-5 py-4 md:order-none">
            <div role="alert" className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3">
              <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-red-800">
                <AlertTriangle size={16} /> {t.warningTitle}
              </h3>
              <p className="text-xs leading-snug text-red-900">{t.warningBody}</p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-amber-900">
                <Info size={15} /> {t.beforeTitle}
              </h3>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-amber-900">
                {t.steps(`${paper.label} (${paper.dimensionsLabel})`).map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t.sheetPreview(paper.dimensionsLabel)}</h3>
                <span className="flex items-center gap-3">
                  {progress.rendering && (
                    <span className="flex items-center gap-1 text-[11px] text-gray-400">
                      <Loader2 size={12} className="animate-spin" /> {t.rendering(progress.done, progress.total)}
                    </span>
                  )}
                  <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-gray-600" title={t.previewOutlinesHint}>
                    <input type="checkbox" className="h-3.5 w-3.5 accent-amber-600" checked={previewOutlines} onChange={(e) => setPreviewOutlines(e.target.checked)} />
                    {t.previewOutlines}
                  </label>
                </span>
              </div>
              <div className="mx-auto max-w-md">
                <LabelSheetView plan={plan} images={images} showOutlines={previewOutlines || settings.printOutlines} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              {settings.printOutlines && (
                <p className="flex items-start gap-1.5 text-xs font-medium text-red-700">
                  <AlertTriangle size={14} className="mt-px shrink-0" /> {t.outlinesOnWarning}
                </p>
              )}
              {emptyCount > 0 && emptyCount < plan.slots.length && (
                <p className="flex items-start gap-1.5 text-xs text-gray-500">
                  <Info size={14} className="mt-px shrink-0" /> {t.emptyLabels(emptyCount)}
                </p>
              )}
              {lowResCount > 0 && (
                <p className="flex items-start gap-1.5 text-xs text-amber-700">
                  <AlertTriangle size={14} className="mt-px shrink-0" /> {t.lowRes(lowResCount)}
                </p>
              )}
            </div>
          </div>
        </div>

        {freeProjectStatus && (
          <div className="border-t border-gray-200 px-5 pt-3">
            <FreeProjectNotice status={freeProjectStatus} onUpgrade={onUpgrade} />
          </div>
        )}
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
              t.exactSize(paper.dimensionsLabel, dpi)
            )}
          </div>
          <div className="flex gap-2">
            <button
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 hover:border-amber-300 hover:text-amber-700 disabled:opacity-50 sm:flex-none"
              onClick={handleDownload}
              disabled={working}
            >
              <Download size={15} /> {t.downloadPdf}
            </button>
            <button
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50 sm:flex-none"
              onClick={handlePrint}
              disabled={working}
            >
              <Printer size={15} /> {t.print}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
