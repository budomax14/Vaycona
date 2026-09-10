import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, ImageOff, Loader2, RefreshCw, ShieldAlert, Sparkles, Trash2, X } from "lucide-react";
import { useLanguage } from "../languageContext";
import { DIALOG_STRINGS } from "../i18n/dialogs";

function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
function formatTimestamp(ts, t) {
  if (!ts) return t.never;
  const date = new Date(ts);
  return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

// Compact "Project Safety" area (Phase 7E) — an overview, not a dashboard:
// current save state, counts across the other Phase 7 systems, an
// on-demand storage estimate, a validation report, and a few safe cleanup
// actions. Reuses the same modal convention as the other Phase 7 dialogs.
export default function ProjectSafetyPanel({
  isOpen,
  onClose,
  saveStatus,
  lastSavedAt,
  saveRevision,
  schemaVersion,
  recoverySnapshotCount,
  versionCount,
  latestManualVersionAt,
  missingAssetCount,
  unusedAssetInfo, // { count, approxBytes } | null (not yet checked)
  storageEstimate, // { project, assets, recovery, versions, total, quota } | null
  validationReport, // result of validateProject, or null
  isValidating,
  isCleaning,
  onRetrySave,
  onValidateProject,
  onApplyRepairs,
  onCheckUnusedAssets,
  onDeleteUnusedAssets,
  onRebuildThumbnails,
}) {
  const { language } = useLanguage();
  const t = DIALOG_STRINGS[language].projectSafety;
  const [rebuildStatus, setRebuildStatus] = useState(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
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

  async function handleRebuild() {
    setRebuildStatus("running");
    await onRebuildThumbnails();
    setRebuildStatus("done");
    window.setTimeout(() => setRebuildStatus(null), 2500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-safety-title"
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 id="project-safety-title" className="text-base font-semibold text-gray-900">
            {t.title}
          </h2>
          <button ref={closeRef} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label={t.closeAria}>
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm">
          {/* Status overview */}
          <div className="mb-4 flex items-center gap-2">
            {saveStatus === "saved" ? (
              <CheckCircle2 size={16} className="text-emerald-500" />
            ) : (
              <ShieldAlert size={16} className="text-amber-500" />
            )}
            <span className="font-medium text-gray-700">
              {saveStatus === "saved" ? t.savedOk : saveStatus === "error" ? t.saveFailed : t.unsavedChanges}
            </span>
            {saveStatus === "error" && (
              <button className="ml-auto rounded-lg px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50" onClick={onRetrySave}>
                {t.retry}
              </button>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl border border-gray-200 p-3.5 text-xs text-gray-600">
            <dt>{t.lastSaved}</dt>
            <dd>{formatTimestamp(lastSavedAt, t)}</dd>
            <dt>{t.saveRevision}</dt>
            <dd>{saveRevision ?? "—"}</dd>
            <dt>{t.projectSchema}</dt>
            <dd>v{schemaVersion}</dd>
            <dt>{t.recoverySnapshots}</dt>
            <dd>{recoverySnapshotCount}</dd>
            <dt>{t.localVersions}</dt>
            <dd>{versionCount}</dd>
            <dt>{t.latestManualVersion}</dt>
            <dd>{latestManualVersionAt ? formatTimestamp(latestManualVersionAt, t) : t.none}</dd>
            <dt>{t.missingAssets}</dt>
            <dd className={missingAssetCount > 0 ? "font-medium text-amber-600" : ""}>{missingAssetCount}</dd>
          </dl>

          {/* Storage usage */}
          <div className="mt-4">
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{t.estimatedStorageUse}</h3>
            {storageEstimate ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl border border-gray-200 p-3.5 text-xs text-gray-600">
                <dt>{t.uploadedAssets}</dt>
                <dd>{formatBytes(storageEstimate.assets)}</dd>
                <dt>{t.recoverySnapshots}</dt>
                <dd>{formatBytes(storageEstimate.recovery)}</dd>
                <dt>{t.localVersions}</dt>
                <dd>{formatBytes(storageEstimate.versions)}</dd>
                <dt>{t.totalEstimate}</dt>
                <dd>{formatBytes(storageEstimate.total)}</dd>
                {storageEstimate.quota > 0 && storageEstimate.total / storageEstimate.quota > 0.8 && (
                  <dd className="col-span-2 mt-1 flex items-center gap-1.5 text-amber-600">
                    <ShieldAlert size={12} /> {t.storageWarning}
                  </dd>
                )}
              </dl>
            ) : (
              <p className="text-xs text-gray-400">{t.estimateUnavailable}</p>
            )}
            <p className="mt-1 text-[11px] text-gray-400">{t.approxNote}</p>
          </div>

          {/* Validation */}
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t.projectValidation}</h3>
              <button
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50"
                onClick={onValidateProject}
                disabled={isValidating}
              >
                {isValidating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {t.validateProject}
              </button>
            </div>
            {validationReport && (
              <div className="rounded-xl border border-gray-200 p-3.5 text-xs">
                <p className="mb-1 font-medium text-gray-700" aria-live="polite">
                  {t.statusLabel(validationReport.status === "ok" ? t.healthy : validationReport.status)}
                </p>
                <p className="text-gray-500">
                  {t.reportSummary(
                    validationReport.fatalErrors.length,
                    validationReport.errors.length,
                    validationReport.warnings.length,
                    validationReport.repairs.length
                  )}
                </p>
                {validationReport.repairs.length > 0 && (
                  <button
                    className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                    onClick={onApplyRepairs}
                  >
                    {t.applySafeRepairs}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Cleanup tools */}
          <div className="mt-4">
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{t.cleanupTools}</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-xl border border-gray-200 p-3">
                <div>
                  <div className="text-xs font-medium text-gray-700">{t.unusedAssets}</div>
                  {unusedAssetInfo && (
                    <div className="text-[11px] text-gray-400">
                      {t.unusedAssetsInfo(unusedAssetInfo.count, formatBytes(unusedAssetInfo.approxBytes))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100" onClick={onCheckUnusedAssets}>
                    {t.check}
                  </button>
                  {unusedAssetInfo?.count > 0 && (
                    <button
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      onClick={onDeleteUnusedAssets}
                      disabled={isCleaning}
                    >
                      <Trash2 size={12} /> {t.delete}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-gray-200 p-3">
                <div className="text-xs font-medium text-gray-700">{t.rebuildThumbnails}</div>
                <button
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                  onClick={handleRebuild}
                  disabled={rebuildStatus === "running"}
                >
                  {rebuildStatus === "running" ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : rebuildStatus === "done" ? (
                    <CheckCircle2 size={12} className="text-emerald-500" />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  {rebuildStatus === "done" ? t.done : t.rebuild}
                </button>
              </div>

              {missingAssetCount > 0 && (
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <ImageOff size={13} /> {t.missingAssetNote(missingAssetCount)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
