import React, { useEffect, useRef, useState } from "react";
import { Clock, FileWarning, Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { MAX_VERSION_NAME_LENGTH, MAX_VERSION_NOTE_LENGTH } from "../versionHistoryService";

function formatTimestamp(ts) {
  if (!ts) return "Unknown time";
  const date = new Date(ts);
  return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

const TYPE_LABELS = {
  manual: "Manual version",
  "auto-milestone": "Automatic milestone",
  "before-import": "Before import",
  "before-replacement": "Before replacement",
  "before-migration": "Before update",
  "before-repair": "Before repair",
  "before-reset": "Before reset",
  "before-version-restore": "Before version restore",
};

// Local version history (Phase 7E) — a clean chronological list, newest
// first, deliberately NOT a visual timeline. Kept distinct from the
// Recovery Center (emergency snapshots) per spec §2/§8.
export default function VersionHistoryPanel({
  isOpen,
  onClose,
  versions,
  currentSummary, // { pageCount, objectCount, groupCount, assetCount, revision, updatedAt }
  onCreateVersion, // (name, note) => Promise
  onRestore, // (id) => Promise
  onRename, // (id, name) => Promise
  onDelete, // (id) => Promise
}) {
  const [nameInput, setNameInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const closeRef = useRef(null);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) nameInputRef.current?.focus();
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

  async function handleCreate() {
    const name = nameInput.trim();
    if (!name) return;
    await onCreateVersion(name, noteInput.trim());
    setNameInput("");
    setNoteInput("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-history-title"
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 id="version-history-title" className="text-base font-semibold text-gray-900">
            Version history
          </h2>
          <button ref={closeRef} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label="Close version history">
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-gray-100 px-5 py-3">
          <label htmlFor="version-name-input" className="mb-1 block text-xs font-medium text-gray-500">
            Create a named version of the current project
          </label>
          <div className="flex gap-2">
            <input
              id="version-name-input"
              ref={nameInputRef}
              type="text"
              maxLength={MAX_VERSION_NAME_LENGTH}
              placeholder="e.g. Before client changes"
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleCreate();
              }}
            />
            <button
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:pointer-events-none disabled:opacity-40"
              onClick={handleCreate}
              disabled={!nameInput.trim()}
            >
              <Plus size={14} /> Create
            </button>
          </div>
          <input
            type="text"
            maxLength={MAX_VERSION_NOTE_LENGTH}
            placeholder="Optional note"
            aria-label="Optional note for this version"
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-amber-400"
            value={noteInput}
            onChange={(event) => setNoteInput(event.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {versions.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No versions yet.</p>
          ) : (
            <ul className="space-y-2">
              {versions.map((version) => {
                const diff = {
                  pages: (version.pageCount || 0) - (currentSummary?.pageCount || 0),
                  objects: (version.objectCount || 0) - (currentSummary?.objectCount || 0),
                  assets: (version.assetCount || 0) - (currentSummary?.assetCount || 0),
                };
                return (
                  <li key={version.id} className="rounded-xl border border-gray-200 px-3.5 py-2.5">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        {renamingId === version.id ? (
                          <input
                            autoFocus
                            className="w-full rounded border border-amber-300 px-2 py-0.5 text-sm"
                            value={renameValue}
                            maxLength={MAX_VERSION_NAME_LENGTH}
                            onChange={(event) => setRenameValue(event.target.value)}
                            onKeyDown={async (event) => {
                              if (event.key === "Enter" && renameValue.trim()) {
                                await onRename(version.id, renameValue.trim());
                                setRenamingId(null);
                              } else if (event.key === "Escape") {
                                setRenamingId(null);
                              }
                            }}
                            onBlur={() => setRenamingId(null)}
                          />
                        ) : (
                          <div className="flex items-center gap-1.5 truncate text-sm font-medium text-gray-800">
                            {version.name || TYPE_LABELS[version.type] || "Version"}
                            {version.protected && (
                              <ShieldCheck size={12} className="shrink-0 text-amber-500" aria-label="Protected" />
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock size={11} /> {formatTimestamp(version.createdAt)} · {TYPE_LABELS[version.type] || version.type}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {version.type === "manual" && (
                          <button
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
                            onClick={() => {
                              setRenamingId(version.id);
                              setRenameValue(version.name || "");
                            }}
                            aria-label={`Rename ${version.name || "version"}`}
                            title="Rename"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                        <button
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-50"
                          onClick={() => onRestore(version.id)}
                        >
                          Restore
                        </button>
                        <button
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                          onClick={() => onDelete(version.id)}
                          aria-label={`Delete ${version.name || "version"}`}
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {version.missingAssetCount > 0 && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600">
                        <FileWarning size={12} /> {version.missingAssetCount} missing asset
                        {version.missingAssetCount === 1 ? "" : "s"}
                      </div>
                    )}

                    <button
                      type="button"
                      className="mt-1.5 text-xs font-medium text-gray-400 hover:text-gray-600"
                      onClick={() => setExpandedId((id) => (id === version.id ? null : version.id))}
                      aria-expanded={expandedId === version.id}
                    >
                      {expandedId === version.id ? "Hide comparison" : "Compare to current"}
                    </button>
                    {expandedId === version.id && (
                      <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 rounded-lg bg-gray-50 p-2.5 text-xs text-gray-600">
                        <dt>Pages</dt>
                        <dd>{version.pageCount} ({diff.pages >= 0 ? "+" : ""}{diff.pages} vs current)</dd>
                        <dt>Objects</dt>
                        <dd>{version.objectCount} ({diff.objects >= 0 ? "+" : ""}{diff.objects} vs current)</dd>
                        <dt>Assets</dt>
                        <dd>{version.assetCount} ({diff.assets >= 0 ? "+" : ""}{diff.assets} vs current)</dd>
                        <dt>Note</dt>
                        <dd className="col-span-2">{version.note || "—"}</dd>
                      </dl>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-gray-100 px-5 py-2.5 text-center text-[11px] text-gray-400">
          This compares object/page counts only — not a visual design comparison.
        </div>
      </div>
    </div>
  );
}
