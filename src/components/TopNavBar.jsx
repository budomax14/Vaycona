import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Download, Home, LogOut, Loader2, Redo2, Save, Scaling, Share2, Undo2, User } from "lucide-react";
import { useAuth } from "../authContext";

// Short, human labels for the autosave status (spec §3) — internal status
// names ("saving"/"error"/...) are never shown to the user directly.
function saveStatusLabel(status, lastSavedAt) {
  if (status === "saving") return "Saving…";
  if (status === "error") return "Couldn't save";
  if (status === "unsaved") return "Unsaved changes";
  if (lastSavedAt) return `Saved ${relativeTime(lastSavedAt)}`;
  return "Saved";
}

function relativeTime(timestamp) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function MenuDropdown({ label, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handleOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    window.addEventListener("mousedown", handleOutside);
    return () => window.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        className={`flex items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 ${
          open ? "bg-gray-100 text-gray-900" : ""
        }`}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <ChevronDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-30 mt-1 min-w-[230px] rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// Nested flyout container for grouping related MenuItems under one row —
// compresses long flat menus (File had 18 top-level rows) into fewer
// top-level rows, each opening its own container to the right, marked
// with a trailing arrow (the same affordance every native OS submenu
// uses). Opens on hover or click; closes on outside click, same pattern
// as MenuDropdown's own outside-click handling.
function MenuSubmenu({ label, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handleOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    window.addEventListener("mousedown", handleOutside);
    return () => window.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-700 ${
          open ? "bg-amber-50 text-amber-700" : ""
        }`}
        onClick={(event) => {
          // Stops this toggle from also bubbling into MenuDropdown's own
          // onClick={() => setOpen(false)} — opening a submenu shouldn't
          // close the whole File menu out from under it. A real MenuItem
          // clicked inside the flyout below still bubbles normally, so
          // picking an actual action still closes everything as expected.
          event.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span>{label}</span>
        <ChevronRight size={14} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute left-full top-0 z-40 ml-1 min-w-[230px] rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, shortcut, onClick, disabled }) {
  return (
    <button
      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-700 disabled:pointer-events-none disabled:opacity-40"
      onClick={onClick}
      disabled={disabled}
    >
      <span>{label}</span>
      {shortcut && <span className="text-xs text-gray-400">{shortcut}</span>}
    </button>
  );
}

function MenuCheckItem({ label, checked, onClick }) {
  return (
    <button
      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-700"
      onClick={onClick}
    >
      <span>{label}</span>
      {checked && <Check size={14} className="text-amber-600" />}
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1 h-px bg-gray-100" />;
}

export default function TopNavBar({
  projectName,
  onProjectNameChange,
  canUndo,
  onUndo,
  undoLabel,
  canRedo,
  onRedo,
  redoLabel,
  onSave,
  saveStatus,
  lastSavedAt,
  saveError,
  storageWarning,
  onRetrySave,
  onOpenRecoveryCenter,
  onOpenVersionHistory,
  onOpenTemplateBrowser,
  onOpenSaveAsTemplate,
  onOpenBrandManager,
  onSaveSelectionAsSection,
  onSaveActivePageAsReusable,
  hasSelection,
  onOpenProjectSafety,
  onExportProject,
  onImportProject,
  onOpenExport,
  onShareDesign,
  onOpenHome,
  onPrint,
  onExportPng,
  onExportPdf,
  onExportJpeg,
  onExportSvg,
  onOpenExportAnimation,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onSelectAll,
  showGrid,
  onToggleGrid,
  showMargins,
  onToggleMargins,
  showBleed,
  onToggleBleed,
  snapToGuides,
  onToggleSnapToGuides,
  onClearGuides,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onOpenResize,
  showRulers,
  onToggleRulers,
  showGuides,
  onToggleGuidesVisible,
  guidesLocked,
  onToggleLockAllGuides,
  snapEnabled,
  onToggleSnap,
  showSmartGuides,
  onToggleSmartGuides,
  showSafeArea,
  onToggleSafeArea,
  showLayoutGrid,
  onToggleLayoutGrid,
  onOpenGuideManager,
  onOpenPrecisionSettings,
  onResetPrecisionView,
}) {
  // Re-renders periodically just so "Saved Xs/m ago" keeps advancing
  // without needing the parent to re-render on a timer of its own.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const saveLabel = saveStatusLabel(saveStatus, lastSavedAt);
  const saveTitle =
    saveStatus === "error"
      ? `Couldn't save${saveError ? `: ${saveError}` : ""} — click to retry`
      : storageWarning
        ? `${saveLabel} — local storage is nearly full`
        : `${saveLabel} (Save now: Ctrl/Cmd+S)`;

  return (
    <header className="flex h-16 items-center gap-2 border-b border-gray-200 bg-white px-3 shadow-sm md:gap-3 md:px-4">
      <button
        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
        onClick={onOpenHome}
        title="Back to home"
        aria-label="Back to home"
      >
        <Home size={18} />
      </button>

      <nav className="flex items-center gap-0.5 border-l border-gray-200 pl-2 md:pl-3">
        <MenuDropdown label="File">
          <MenuItem label="New design…" onClick={onOpenTemplateBrowser} />
          <MenuItem label="Save as template…" onClick={onOpenSaveAsTemplate} />
          <MenuItem label="Print…" shortcut="Ctrl/Cmd+P" onClick={onPrint} />
          <MenuSubmenu label="Export as">
            <MenuItem label="PNG" onClick={onExportPng} />
            <MenuItem label="JPEG" onClick={onExportJpeg} />
            <MenuItem label="PDF" onClick={onExportPdf} />
            <MenuItem label="SVG" onClick={onExportSvg} />
            <MenuItem label="Animation (GIF / WebM)…" onClick={onOpenExportAnimation} />
          </MenuSubmenu>
          <MenuItem label="Brand kits…" onClick={onOpenBrandManager} />
          <MenuSubmenu label="Reusable content">
            <MenuItem label="Save selection as reusable section" onClick={onSaveSelectionAsSection} disabled={!hasSelection} />
            <MenuItem label="Save current page as reusable" onClick={onSaveActivePageAsReusable} />
          </MenuSubmenu>
          <MenuDivider />
          <MenuItem label={`Save now (${saveLabel})`} shortcut="Ctrl/Cmd+S" onClick={saveStatus === "error" ? onRetrySave : onSave} />
          <MenuDivider />
          <MenuItem label="Export project" onClick={onExportProject} />
          <MenuItem label="Import project…" onClick={onImportProject} />
          <MenuDivider />
          <MenuSubmenu label="Project management">
            <MenuItem label="Version history" onClick={onOpenVersionHistory} />
            <MenuItem label="Project recovery" onClick={onOpenRecoveryCenter} />
            <MenuItem label="Project safety" onClick={onOpenProjectSafety} />
          </MenuSubmenu>
          <MenuDivider />
          <MenuItem label="Download / Export…" shortcut="Ctrl/Cmd+Shift+E" onClick={onOpenExport} />
          
        </MenuDropdown>

        <MenuDropdown label="Edit">
          <MenuItem label={undoLabel ? `Undo: ${undoLabel}` : "Undo"} shortcut="Ctrl/Cmd+Z" onClick={onUndo} disabled={!canUndo} />
          <MenuItem label={redoLabel ? `Redo: ${redoLabel}` : "Redo"} shortcut="Ctrl/Cmd+Shift+Z" onClick={onRedo} disabled={!canRedo} />
          <MenuDivider />
          <MenuItem label="Copy" shortcut="Ctrl/Cmd+C" onClick={onCopy} />
          <MenuItem label="Paste" shortcut="Ctrl/Cmd+V" onClick={onPaste} />
          <MenuItem label="Duplicate" shortcut="Ctrl/Cmd+D" onClick={onDuplicate} />
          <MenuItem label="Delete" shortcut="Delete" onClick={onDelete} />
          <MenuDivider />
          <MenuItem label="Select All" shortcut="Ctrl/Cmd+A" onClick={onSelectAll} />
        </MenuDropdown>

        <MenuDropdown label="View">
          <MenuItem label="Zoom in" onClick={onZoomIn} />
          <MenuItem label="Zoom out" onClick={onZoomOut} />
          <MenuItem label="Reset zoom" onClick={onResetZoom} />
          <MenuDivider />
          <MenuCheckItem label="Show rulers" shortcut="Shift+R" checked={showRulers} onClick={onToggleRulers} />
          <MenuCheckItem label="Show guides" shortcut="Ctrl/Cmd+;" checked={showGuides} onClick={onToggleGuidesVisible} />
          <MenuCheckItem label="Lock all guides" checked={guidesLocked} onClick={onToggleLockAllGuides} />
          <MenuCheckItem label="Show grid" checked={showGrid} onClick={onToggleGrid} />
          <MenuCheckItem label="Show safe margins" checked={showMargins} onClick={onToggleMargins} />
          <MenuCheckItem label="Show safe area" checked={showSafeArea} onClick={onToggleSafeArea} />
          <MenuCheckItem label="Show bleed lines" checked={showBleed} onClick={onToggleBleed} />
          <MenuCheckItem label="Show layout grid (columns/rows)" checked={showLayoutGrid} onClick={onToggleLayoutGrid} />
          <MenuDivider />
          <MenuCheckItem label="Show smart guides" checked={showSmartGuides} onClick={onToggleSmartGuides} />
          <MenuCheckItem label="Snap to guides" checked={snapToGuides} onClick={onToggleSnapToGuides} />
          <MenuCheckItem label="Snapping enabled" checked={snapEnabled} onClick={onToggleSnap} />
          <MenuItem label="Clear guides" onClick={onClearGuides} />
          <MenuDivider />
          <MenuItem label="Guide Manager…" onClick={onOpenGuideManager} />
          <MenuItem label="Precision settings…" onClick={onOpenPrecisionSettings} />
          <MenuItem label="Reset precision view" onClick={onResetPrecisionView} />
        </MenuDropdown>

        <MenuDropdown label="Help">
          <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Keyboard shortcuts
          </div>
          <div className="grid gap-1 px-3 pb-2 text-xs text-gray-600">
            <div className="flex justify-between gap-4">
              <span>Undo / Redo</span>
              <span>Ctrl/Cmd+Z / Shift+Z</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Copy / Paste</span>
              <span>Ctrl/Cmd+C / V</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Duplicate</span>
              <span>Ctrl/Cmd+D</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Group / Ungroup</span>
              <span>Ctrl/Cmd+G / Shift+G</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Delete</span>
              <span>Delete / Backspace</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Pan canvas</span>
              <span>Hold Space</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Zoom</span>
              <span>Ctrl/Cmd + Scroll</span>
            </div>
          </div>
          <MenuDivider />
          <MenuItem label="About Vaycona" onClick={() => {}} />
        </MenuDropdown>
      </nav>

      <input
        className="ml-1 w-full max-w-30 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-center text-sm font-medium text-gray-700 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100 md:ml-2 md:max-w-xs"
        value={projectName}
        onChange={(event) => onProjectNameChange(event.target.value)}
        aria-label="Project name"
      />

      <div className="ml-auto flex items-center gap-1 md:gap-1.5">
        <button
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          onClick={onOpenResize}
          title="Resize page"
          aria-label="Resize page"
        >
          <Scaling size={17} />
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
        <button
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium hover:bg-gray-100 md:px-3 ${
            saveStatus === "error" ? "text-red-600" : "text-gray-600"
          }`}
          onClick={saveStatus === "error" ? onRetrySave : onSave}
          title={saveTitle}
          aria-label={saveTitle}
          aria-live="polite"
        >
          {saveStatus === "saving" ? (
            <Loader2 size={16} className="animate-spin" />
          ) : saveStatus === "error" ? (
            <AlertTriangle size={16} />
          ) : (
            <Save size={16} />
          )}
          <span className="hidden md:inline">{saveStatus === "error" ? "Retry save" : saveLabel}</span>
        </button>
        <button
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-2.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 md:px-3.5"
          onClick={onOpenExport}
          title="Download / Export design (PNG, JPEG, PDF, SVG)"
          aria-label="Download or export design"
        >
          <Download size={16} /> <span className="hidden md:inline">Export</span>
        </button>
        <button
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          onClick={onShareDesign}
          title="Share design"
          aria-label="Share design"
        >
          <Share2 size={17} />
        </button>
        <AccountMenu />
      </div>
    </header>
  );
}

function AccountMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handleOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    window.addEventListener("mousedown", handleOutside);
    return () => window.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
        title={user?.email || "Account"}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
      >
        <User size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-[220px] rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg">
          <div className="truncate px-3 py-2 text-xs text-gray-500">{user?.email}</div>
          <div className="my-1 h-px bg-gray-100" />
          <button
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-700"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
          >
            <LogOut size={14} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
