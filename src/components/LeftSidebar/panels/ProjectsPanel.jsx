import React, { useState } from "react";
import { FileImage, MoreVertical, Save, Trash2 } from "lucide-react";

function formatTimestamp(ts) {
  if (!ts) return "";
  const date = new Date(ts);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? `Today at ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function ProjectRow({ project, isActive, onOpen, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.name);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={`group relative flex flex-col gap-2 rounded-xl border p-2 transition-colors ${isActive ? "border-amber-400 bg-amber-50" : "border-gray-200 hover:border-gray-300"}`}>
      <button
        className="relative flex w-full items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white"
        style={{ aspectRatio: "16 / 11" }}
        onClick={() => onOpen(project.id)}
        aria-label={`Open ${project.name}`}
      >
        {project.thumbnail ? (
          <img src={project.thumbnail} alt="" className="h-full w-full object-contain" />
        ) : (
          <FileImage size={20} className="text-gray-300" />
        )}
        {isActive && (
          <span className="absolute left-1 top-1 rounded bg-amber-600 px-1.5 py-0.5 text-[9px] font-bold text-white">Open</span>
        )}
      </button>

      <div className="flex items-center gap-1">
        {editing ? (
          <input
            autoFocus
            className="min-w-0 flex-1 rounded border border-amber-300 px-1.5 py-0.5 text-xs"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              onRename(project.id, draft.trim() || project.name);
              setEditing(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                setDraft(project.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button className="min-w-0 flex-1 truncate text-left text-xs font-medium text-gray-700" onDoubleClick={() => setEditing(true)} onClick={() => onOpen(project.id)} title={project.name}>
            {project.name}
          </button>
        )}
        <div className="relative shrink-0">
          <button
            className="rounded p-1 text-gray-400 opacity-0 hover:bg-gray-100 group-hover:opacity-100"
            aria-label={`More options for ${project.name}`}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreVertical size={13} />
          </button>
          {menuOpen && (
            <>
              <button className="fixed inset-0 z-10 cursor-default" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-32 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
                  onClick={() => {
                    setMenuOpen(false);
                    setEditing(true);
                  }}
                >
                  Rename
                </button>
                <button
                  className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(project.id);
                  }}
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <p className="text-[10px] text-gray-400">{formatTimestamp(project.updatedAt)}</p>
    </div>
  );
}

// Personal "My Projects" panel — separate from the shared Templates
// gallery. `activeProjectId` is whichever saved project the live workspace
// is currently linked to (if any), so "Save project" knows whether to
// update it in place or ask for a new name.
export default function ProjectsPanel({ projects, activeProjectId, onSaveProject, onSaveProjectAsNew, onOpen, onRename, onDelete }) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-800">Projects</h3>

      <button
        className="flex items-center justify-center gap-2 rounded-xl bg-amber-600 py-2 text-sm font-medium text-white hover:bg-amber-700"
        onClick={onSaveProject}
      >
        <Save size={15} /> {activeProjectId ? "Save project" : "Save current project"}
      </button>
      {activeProjectId && (
        <button className="text-xs font-medium text-amber-700 hover:underline" onClick={onSaveProjectAsNew}>
          Save as a new project
        </button>
      )}

      {projects.length === 0 ? (
        <p className="text-xs text-gray-400">Projects you save will appear here so you can reopen them anytime.</p>
      ) : (
        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto pb-2">
          {projects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              isActive={project.id === activeProjectId}
              onOpen={onOpen}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
