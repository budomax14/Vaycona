import React, { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Eye, Loader2, Redo2, Save, Settings, Undo2, Upload } from "lucide-react";
import { useLanguage } from "../../languageContext";
import { MISC_STRINGS } from "../../i18n/misc";

// Renders INSTEAD OF TopNavBar when App.jsx is in editorMode="template"
// (see App.jsx's top-level render branch). Deliberately a much smaller
// action set than the full editor's TopNavBar — Save Draft / Save &
// Publish / Preview / Cancel plus undo/redo and a save-status readout,
// matching TopNavBar's visual language (same header height/classes) so
// switching between the two doesn't feel like a different app.
function saveStatusLabel(status, t) {
  if (status === "saving") return t.saving;
  if (status === "error") return t.saveFailed;
  if (status === "unsaved") return t.unsavedChanges;
  return t.saved;
}

export default function AdminTemplateEditorToolbar({
  templateName,
  onNameChange,
  saveStatus,
  canUndo,
  onUndo,
  undoLabel,
  canRedo,
  onRedo,
  redoLabel,
  onPreview,
  onSaveDraft,
  onSaveAndPublish,
  onCancel,
  onOpenSettings,
  publishing,
}) {
  const { language } = useLanguage();
  const t = MISC_STRINGS[language].adminTemplateEditorToolbar;
  const [localName, setLocalName] = useState(templateName || "");

  useEffect(() => {
    setLocalName(templateName || "");
  }, [templateName]);

  return (
    <header className="flex h-16 items-center gap-1 border-b border-gray-200 bg-white px-2 shadow-sm sm:gap-2 sm:px-3 md:gap-3 md:px-4">
      <button className="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 sm:p-2" onClick={onCancel} title={t.backToDashboard} aria-label={t.backToDashboard}>
        <ArrowLeft size={18} />
      </button>

      <div className="hidden items-center gap-2.5 sm:flex">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-500 text-lg font-black text-white">
          T
        </div>
        <span className="hidden text-sm font-semibold text-gray-800 lg:inline">{t.templateEditor}</span>
      </div>

      <input
        className="ml-1 w-full min-w-0 max-w-48 flex-1 rounded-lg sm:flex-none border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100 md:ml-2 md:max-w-xs"
        value={localName}
        onChange={(event) => setLocalName(event.target.value)}
        onBlur={() => localName.trim() && localName !== templateName && onNameChange(localName.trim())}
        aria-label={t.templateNameAriaLabel}
      />

      <button className="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 sm:p-2" onClick={onOpenSettings} title={t.templateSettings} aria-label={t.templateSettings}>
        <Settings size={17} />
      </button>

      <button
        className="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 sm:p-2 disabled:pointer-events-none disabled:opacity-30"
        onClick={onUndo}
        disabled={!canUndo}
        title={undoLabel ? t.undoWithLabel(undoLabel) : t.undo}
        aria-label={undoLabel ? t.undoWithLabel(undoLabel) : t.undo}
      >
        <Undo2 size={17} />
      </button>
      <button
        className="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 sm:p-2 disabled:pointer-events-none disabled:opacity-30"
        onClick={onRedo}
        disabled={!canRedo}
        title={redoLabel ? t.redoWithLabel(redoLabel) : t.redo}
        aria-label={redoLabel ? t.redoWithLabel(redoLabel) : t.redo}
      >
        <Redo2 size={17} />
      </button>

      <span
        className={`ml-1 flex shrink-0 items-center gap-1.5 text-xs font-medium ${saveStatus === "error" ? "text-red-600" : "text-gray-400"}`}
        aria-live="polite"
        title={saveStatusLabel(saveStatus, t)}
      >
        {saveStatus === "saving" ? <Loader2 size={13} className="animate-spin" /> : saveStatus === "error" ? <AlertTriangle size={13} /> : null}
        <span className="hidden sm:inline">{saveStatusLabel(saveStatus, t)}</span>
      </span>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5 md:gap-2">
        <button className="hidden rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 sm:block" onClick={onCancel}>
          {t.cancel}
        </button>
        <button
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 sm:px-3"
          onClick={onPreview}
          aria-label={t.preview}
          title={t.preview}
        >
          <Eye size={15} /> <span className="hidden md:inline">{t.preview}</span>
        </button>
        <button
          className="flex items-center rounded-lg border border-gray-200 px-2.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 sm:px-3"
          onClick={onSaveDraft}
          aria-label={t.saveDraft}
          title={t.saveDraft}
        >
          <Save size={15} className="sm:hidden" />
          <span className="hidden sm:inline">{t.saveDraft}</span>
        </button>
        <button
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-2.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:pointer-events-none disabled:opacity-60 sm:px-3"
          onClick={onSaveAndPublish}
          disabled={publishing}
          aria-label={t.saveAndPublish}
          title={t.saveAndPublish}
        >
          {publishing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          <span className="hidden sm:inline">{t.saveAndPublish}</span>
        </button>
      </div>
    </header>
  );
}
