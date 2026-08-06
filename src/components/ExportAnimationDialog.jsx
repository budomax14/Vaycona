import React, { useEffect, useRef, useState } from "react";
import { X, Download, AlertTriangle } from "lucide-react";
import { runAnimatedExport, isVideoExportSupported } from "../animation/export/animatedExportService";
import { downloadExportResult } from "../export/exportService";
import { FRAME_RATE_PRESETS, DEFAULT_ANIMATED_EXPORT_FPS, ANIMATED_EXPORT_FORMATS } from "../export/exportConstants";

// Phase 12 — GIF/WebM export dialog (spec §69-79). Kept as its own
// component rather than folded into the large existing ExportDialog.jsx
// (session-efficiency rule 8: avoid redesigning unrelated editor panels) —
// static PNG/JPEG/PDF/SVG export is untouched; this only calls the new
// animatedExportService orchestrator.
export default function ExportAnimationDialog({ isOpen, onClose, pages, items, activePageId, projectName, reducedMotion }) {
  const [format, setFormat] = useState("gif");
  const [scope, setScope] = useState("single");
  const [fps, setFps] = useState(DEFAULT_ANIMATED_EXPORT_FPS);
  const [scale, setScale] = useState(1);
  const [loopForever, setLoopForever] = useState(true);
  const [step, setStep] = useState("form"); // form | progress | done | error
  const [progress, setProgress] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [resultInfo, setResultInfo] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setStep("form");
      setErrorMessage(null);
      setResultInfo(null);
      setProgress(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const videoSupported = isVideoExportSupported();
  const pageIds = scope === "single" ? [activePageId] : pages.map((p) => p.id);

  async function handleExport() {
    setStep("progress");
    setErrorMessage(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await runAnimatedExport(
        {
          format,
          scope,
          pageIds,
          fps,
          scale,
          loopCount: loopForever ? 0 : -1,
          filenameBase: projectName,
          reducedMotion,
        },
        { pages, items },
        {
          signal: controller.signal,
          onProgress: (p) => setProgress(p),
        }
      );
      downloadExportResult(result.blob, result.filename);
      setResultInfo({ filename: result.filename, size: result.blob.size });
      setStep("done");
    } catch (err) {
      if (err?.name === "ExportCancelledError") {
        setStep("form");
        return;
      }
      setErrorMessage(err?.message || "Animated export failed.");
      setStep("error");
    } finally {
      abortRef.current = null;
    }
  }

  function cancelExport() {
    abortRef.current?.abort();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Export animation</h2>
          <button
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
            onClick={step === "progress" ? cancelExport : onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {step === "form" && (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-600">Format</span>
              <div className="flex gap-2">
                {ANIMATED_EXPORT_FORMATS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    disabled={f === "webm" && !videoSupported}
                    className={`flex-1 rounded-lg border py-2 text-sm font-medium disabled:opacity-40 ${
                      format === f ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
              {format === "webm" && !videoSupported && (
                <p className="text-[11px] text-amber-600">This browser doesn't support local WebM encoding — try GIF instead.</p>
              )}
            </div>

            <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
              Scope
              <select value={scope} onChange={(e) => setScope(e.target.value)} className="rounded border border-gray-200 px-2 py-1.5 text-sm">
                <option value="single">Current page</option>
                <option value="presentation">Entire presentation ({pages.length} pages)</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                Frame rate
                <select value={fps} onChange={(e) => setFps(Number(e.target.value))} className="rounded border border-gray-200 px-2 py-1.5 text-sm">
                  {FRAME_RATE_PRESETS.map((f) => (
                    <option key={f} value={f}>{f} fps</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                Scale
                <select value={scale} onChange={(e) => setScale(Number(e.target.value))} className="rounded border border-gray-200 px-2 py-1.5 text-sm">
                  {[0.5, 1, 1.5, 2].map((s) => (
                    <option key={s} value={s}>{s}×</option>
                  ))}
                </select>
              </label>
            </div>

            {format === "gif" && (
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={loopForever} onChange={(e) => setLoopForever(e.target.checked)} />
                Loop forever
              </label>
            )}

            <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                {format === "gif"
                  ? "GIF export uses a 256-color palette with no partial transparency and no audio. Large or long exports may take a while."
                  : "WebM export has no audio. Encoding happens locally in your browser and may take a while for longer exports."}
              </span>
            </div>

            <button
              onClick={handleExport}
              disabled={format === "webm" && !videoSupported}
              className="flex items-center justify-center gap-2 rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40"
            >
              <Download size={15} /> Export {format.toUpperCase()}
            </button>
          </>
        )}

        {step === "progress" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600" />
            <p className="text-sm text-gray-600">
              {progress?.stage === "rendering" || progress?.stage === "encoding"
                ? `Rendering frame ${progress.frameIndex} of ${progress.frameCount}…`
                : progress?.stage === "loading-fonts"
                  ? "Loading fonts…"
                  : progress?.stage === "finalizing"
                    ? "Finalizing file…"
                    : "Preparing…"}
            </p>
            <button onClick={cancelExport} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <p className="text-sm font-medium text-gray-800">Exported {resultInfo?.filename}</p>
            <p className="text-xs text-gray-500">{Math.round((resultInfo?.size || 0) / 1024)} KB</p>
            <button onClick={onClose} className="mt-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800">
              Done
            </button>
          </div>
        )}

        {step === "error" && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <AlertTriangle size={20} className="text-red-500" />
            <p className="text-sm text-gray-700">{errorMessage}</p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => setStep("form")} className="rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Try again
              </button>
              <button onClick={onClose} className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
