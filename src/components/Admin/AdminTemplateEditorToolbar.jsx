import React, { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Eye, Loader2, Redo2, Settings, Undo2, Upload } from "lucide-react";

// Renders INSTEAD OF TopNavBar when App.jsx is in editorMode="template"
// (see App.jsx's top-level render branch). Deliberately a much smaller
// action set than the full editor's TopNavBar — Save Draft / Save &
// Publish / Preview / Cancel plus undo/redo and a save-status readout,
// matching TopNavBar's visual language (same header height/classes) so
// switching between the two doesn't feel like a different app.
function saveStatusLabel(status) {
  if (status === "saving") return "Saving…";
  if (status === "error") return "Save failed";
  if (status === "unsaved") return "Unsaved changes";
  return "Saved";
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
  const [localName, setLocalName] = useState(templateName || "");

  useEffect(() => {
    setLocalName(templateName || "");
  }, [templateName]);

  return (
    <header className="flex h-16 items-center gap-2 border-b border-gray-200 bg-white px-3 shadow-sm md:gap-3 md:px-4">
      <button className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" onClick={onCancel} title="Back to dashboard" aria-label="Back to dashboard">
        <ArrowLeft size={18} />
      </button>

      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-500 text-lg font-black text-white">
          T
        </div>
        <span className="hidden text-sm font-semibold text-gray-800 lg:inline">Template Editor</span>
      </div>

      <input
        className="ml-1 w-full max-w-48 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100 md:ml-2 md:max-w-xs"
        value={localName}
        onChange={(event) => setLocalName(event.target.value)}
        onBlur={() => localName.trim() && localName !== templateName && onNameChange(localName.trim())}
        aria-label="Template name"
      />

      <button className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" onClick={onOpenSettings} title="Template settings" aria-label="Template settings">
        <Settings size={17} />
      </button>

      <button
        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-30"
        onClick={onUndo}
        disabled={!canUndo}
        title={undoLabel ? `Undo: ${undoLabel}` : "Undo"}
        aria-label={undoLabel ? `Undo: ${undoLabel}` : "Undo"}
      >
        <Undo2 size={17} />
      </button>
      <button
        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-30"
        onClick={onRedo}
        disabled={!canRedo}
        title={redoLabel ? `Redo: ${redoLabel}` : "Redo"}
        aria-label={redoLabel ? `Redo: ${redoLabel}` : "Redo"}
      >
        <Redo2 size={17} />
      </button>

      <span
        className={`ml-1 flex items-center gap-1.5 text-xs font-medium ${saveStatus === "error" ? "text-red-600" : "text-gray-400"}`}
        aria-live="polite"
      >
        {saveStatus === "saving" ? <Loader2 size={13} className="animate-spin" /> : saveStatus === "error" ? <AlertTriangle size={13} /> : null}
        {saveStatusLabel(saveStatus)}
      </span>

      <div className="ml-auto flex items-center gap-1.5 md:gap-2">
        <button className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          onClick={onPreview}
        >
          <Eye size={15} /> <span className="hidden md:inline">Preview</span>
        </button>
        <button className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100" onClick={onSaveDraft}>
          Save Draft
        </button>
        <button
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:pointer-events-none disabled:opacity-60"
          onClick={onSaveAndPublish}
          disabled={publishing}
        >
          {publishing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          Save &amp; Publish
        </button>
      </div>
    </header>
  );
}
