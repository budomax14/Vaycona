import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, FileUp, Loader2, UploadCloud, X } from "lucide-react";
import { PROJECT_FILE_EXTENSION } from "../constants";
import { useLanguage } from "../languageContext";
import { DIALOG_STRINGS } from "../i18n/dialogs";

function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

// Staged import dialog (spec §14/§15/§19): pick/drop a file -> inspect
// (manifest-only, no asset extraction) -> preview -> Open as new /
// Replace / Cancel -> storing progress -> done/error. All the actual
// async work (inspectProjectPackage/validateAndRepairImportedProject/
// importPackageAssets) is owned by App.jsx and passed in as callbacks —
// this component only drives the staged UI.
export default function ImportProjectDialog({
  isOpen,
  onClose,
  onFileSelected, // (file) => Promise<{ ok, preview?, error? }>
  onOpenAsNew, // () => Promise<{ ok, error? }>
  onReplaceCurrent, // () => Promise<{ ok, error? }>
  preview, // inspection preview summary once a file has been validated
  stage, // 'idle' | 'inspecting' | 'preview' | 'importing' | 'done' | 'error'
  error,
  importProgress, // { current, total } while storing assets
}) {
  const { language } = useLanguage();
  const t = DIALOG_STRINGS[language].importProject;
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (isOpen) dialogRef.current?.querySelector("button, input")?.focus();
  }, [isOpen, stage]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(event) {
      if (event.key === "Escape" && stage !== "importing") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, stage, onClose]);

  if (!isOpen) return null;

  function handleFiles(fileList) {
    const file = fileList?.[0];
    if (file) onFileSelected(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 id="import-dialog-title" className="text-base font-semibold text-gray-900">
            {t.title}
          </h2>
          <button
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-40"
            onClick={onClose}
            disabled={stage === "importing"}
            aria-label={t.closeAria}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">
          {(stage === "idle" || stage === "error") && (
            <>
              <div
                role="button"
                tabIndex={0}
                aria-label={t.dropzoneAria}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                  isDragOver ? "border-amber-400 bg-amber-50" : "border-gray-200"
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragOver(false);
                  handleFiles(event.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <UploadCloud size={28} className="text-gray-400" />
                <p className="text-sm text-gray-600">{t.dropzoneText(PROJECT_FILE_EXTENSION)}</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={PROJECT_FILE_EXTENSION}
                  className="sr-only"
                  aria-label={t.fileInputAria}
                  onChange={(event) => handleFiles(event.target.files)}
                />
              </div>
              {stage === "error" && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <span>{error || t.errorFallback}</span>
                </div>
              )}
            </>
          )}

          {stage === "inspecting" && (
            <div className="flex flex-col items-center gap-2 py-8 text-sm text-gray-500">
              <Loader2 size={22} className="animate-spin text-amber-600" />
              {t.checkingFile}
            </div>
          )}

          {stage === "preview" && preview && (
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border border-gray-200 p-3.5">
                <div className="font-medium text-gray-800">{preview.projectName}</div>
                <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span>{t.pages}</span>
                  <span>{preview.pageCount}</span>
                  <span>{t.objects}</span>
                  <span>{preview.objectCount}</span>
                  <span>{t.assets}</span>
                  <span>{preview.assetCount}</span>
                  <span>{t.fileSize}</span>
                  <span>{formatBytes(preview.fileSize)}</span>
                  <span>{t.exported}</span>
                  <span>{preview.exportedAt ? new Date(preview.exportedAt).toLocaleString() : t.unknown}</span>
                </div>
              </div>
              {preview.migrationRequired && (
                <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  {t.migrationNote}
                </p>
              )}
              {preview.missingAssetCount > 0 && (
                <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  {t.missingAssetsNote(preview.missingAssetCount)}
                </p>
              )}
              {preview.warnings?.map((warning) => (
                <p key={warning} className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  {warning}
                </p>
              ))}
            </div>
          )}

          {stage === "importing" && (
            <div className="flex flex-col items-center gap-2 py-8 text-sm text-gray-500" aria-live="polite">
              <Loader2 size={22} className="animate-spin text-amber-600" />
              {importProgress ? t.storingAssets(importProgress.current, importProgress.total) : t.importingProject}
            </div>
          )}
        </div>

        {stage === "preview" && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 px-5 py-4">
            <button className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100" onClick={onClose}>
              {t.cancel}
            </button>
            <button
              className="rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={onOpenAsNew}
            >
              {t.openAsNew}
            </button>
            <button
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              onClick={onReplaceCurrent}
            >
              <FileUp size={14} /> {t.replaceCurrent}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
