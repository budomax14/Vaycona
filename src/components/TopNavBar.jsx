import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Download, Home, LogOut, Loader2, Redo2, Save, Scaling, Settings, Share2, ShieldCheck, Undo2, User } from "lucide-react";
import { useAuth } from "../authContext";
import { useTheme } from "../themeContext";
import { useLanguage } from "../languageContext";
import { STRINGS } from "../i18n";
import { navigateTo } from "../adminRoute";
import ToolbarPopover from "./PropertiesToolbar/ToolbarPopover";

// Tailwind's built-in `md:` variant only reads viewport WIDTH — a landscape
// phone is wide (>768px) but short (~375-440px tall), so `md:` alone can't
// tell "desktop" apart from "phone lying on its side." Both MenuDropdown's
// height cap and MenuSubmenu's flyout-vs-inline layout below need genuine
// vertical room, not just width, so they share this compound arbitrary
// variant instead.
const SPACIOUS = "[@media(min-width:768px)_and_(min-height:640px)]";

// Short, human labels for the autosave status (spec §3) — internal status
// names ("saving"/"error"/...) are never shown to the user directly.
function saveStatusLabel(t, status, lastSavedAt) {
  if (status === "saving") return t.saving;
  if (status === "error") return t.couldntSave;
  if (status === "unsaved") return t.unsavedChanges;
  if (lastSavedAt) return t.savedAgo(relativeTime(t, lastSavedAt));
  return t.saved;
}

function relativeTime(t, timestamp) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 5) return t.justNow;
  if (seconds < 60) return t.secondsAgo(seconds);
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t.minutesAgo(minutes);
  const hours = Math.round(minutes / 60);
  return t.hoursAgo(hours);
}

// Opens via ToolbarPopover (portalled to <body>, fixed-positioned off the
// trigger's own on-screen rect) rather than an ordinary absolutely-
// positioned child — the header needs `overflow-x-auto` on phone widths
// (see TopNavBar below) to reach the icons a 768px-wide bar no longer
// forces into view, and per the CSS overflow spec, giving an element a
// non-visible overflow-x forces its overflow-y to compute as `auto` too,
// which would silently clip an ordinary dropdown to the header's own
// height. Same fix ToolbarPopover already applies for PropertiesToolbar's
// row and StatusBar's popovers.
function MenuDropdown({ label, children }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  return (
    <div className="relative shrink-0">
      <div ref={anchorRef} className="inline-flex">
        <button
          className={`flex items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 ${
            open ? "bg-gray-100 text-gray-900" : ""
          }`}
          onClick={() => setOpen((v) => !v)}
        >
          {label}
          <ChevronDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
        </button>
      </div>
      <ToolbarPopover isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <div
          className={`max-h-[80vh] min-w-[230px] overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg ${SPACIOUS}:max-h-none ${SPACIOUS}:overflow-visible`}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      </ToolbarPopover>
    </div>
  );
}

// Nested flyout container for grouping related MenuItems under one row —
// compresses long flat menus (File had 18 top-level rows) into fewer
// top-level rows, each opening its own container to the right, marked
// with a trailing arrow (the same affordance every native OS submenu
// uses). Opens on hover or click; closes on outside click, same pattern
// as MenuDropdown's own outside-click handling.
//
// The panel itself flies out to the right only when there's genuinely room
// for it — MenuDropdown's panel is portalled (fixed-positioned to the
// viewport, see MenuDropdown above) so a flyout anchored off *its* right
// edge has nowhere to go on a narrow screen; otherwise it expands inline
// underneath the trigger instead, same as a standard mobile accordion.
// Gated on BOTH width and height (not Tailwind's width-only `md:`) because
// a landscape phone is wide (>768px) but short (~375-440px tall) — treating
// that as "desktop" would strip MenuDropdown's height cap/scroll (see
// its own class list above) and let the last items in a long menu render
// off the bottom of the screen with no way to reach them.
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
          // Stops this from also bubbling into MenuDropdown's own
          // onClick={() => setOpen(false)} — opening a submenu shouldn't
          // close the whole File menu out from under it. A real MenuItem
          // clicked inside the flyout below still bubbles normally, so
          // picking an actual action still closes everything as expected.
          //
          // Always opens (never toggles closed) — a tap/click also fires a
          // synthetic mouseenter first (real on touch devices, since
          // browsers replay touch as compatibility mouse events; also
          // reachable on desktop by clicking while already hovering),
          // which already flips `open` true via onMouseEnter below, so a
          // toggle here would immediately flip it back closed and the
          // submenu would never visibly open. Outside-click already closes
          // it, same as clicking away from any other submenu.
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <span>{label}</span>
        <ChevronRight size={14} className="text-gray-400" />
      </button>
      {open && (
        <div
          className={`mt-0.5 space-y-0.5 rounded-lg bg-gray-50 p-1 ${SPACIOUS}:absolute ${SPACIOUS}:left-full ${SPACIOUS}:top-0 ${SPACIOUS}:z-40 ${SPACIOUS}:ml-1 ${SPACIOUS}:mt-0 ${SPACIOUS}:min-w-[230px] ${SPACIOUS}:space-y-0 ${SPACIOUS}:rounded-xl ${SPACIOUS}:border ${SPACIOUS}:border-gray-200 ${SPACIOUS}:bg-white ${SPACIOUS}:p-1.5 ${SPACIOUS}:shadow-lg`}
        >
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
  const { language } = useLanguage();
  const { isAdmin } = useAuth();
  const t = STRINGS[language].topNav;

  // Re-renders periodically just so "Saved Xs/m ago" keeps advancing
  // without needing the parent to re-render on a timer of its own.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const saveLabel = saveStatusLabel(t, saveStatus, lastSavedAt);
  const saveTitle =
    saveStatus === "error"
      ? t.couldntSaveWithError(saveError)
      : storageWarning
        ? t.storageWarning(saveLabel)
        : t.saveNowTitle(saveLabel);

  return (
    <header className="flex h-16 items-center gap-2 overflow-x-auto border-b border-gray-200 bg-white px-3 shadow-sm md:gap-3 md:px-4">
      <button
        className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100"
        onClick={onOpenHome}
        title={t.backToHome}
        aria-label={t.backToHome}
      >
        <Home size={18} />
      </button>

      <nav className="flex shrink-0 items-center gap-0.5 border-l border-gray-200 pl-2 md:pl-3">
        <MenuDropdown label={t.fileMenu}>
          <MenuItem label={t.newDesign} onClick={onOpenTemplateBrowser} />
          <MenuItem label={t.saveAsTemplate} onClick={onOpenSaveAsTemplate} />
          <MenuItem label={t.print} shortcut="Ctrl/Cmd+P" onClick={onPrint} />
          <MenuSubmenu label={t.exportAs}>
            <MenuItem label={t.exportPng} onClick={onExportPng} />
            <MenuItem label={t.exportJpeg} onClick={onExportJpeg} />
            <MenuItem label={t.exportPdf} onClick={onExportPdf} />
            <MenuItem label={t.exportSvg} onClick={onExportSvg} />
            <MenuItem label={t.exportAnimation} onClick={onOpenExportAnimation} />
          </MenuSubmenu>
          <MenuItem label={t.brandKits} onClick={onOpenBrandManager} />
          <MenuSubmenu label={t.reusableContent}>
            <MenuItem label={t.saveSelectionAsSection} onClick={onSaveSelectionAsSection} disabled={!hasSelection} />
            <MenuItem label={t.saveCurrentPageAsReusable} onClick={onSaveActivePageAsReusable} />
          </MenuSubmenu>
          <MenuDivider />
          <MenuItem label={t.saveNow(saveLabel)} shortcut="Ctrl/Cmd+S" onClick={saveStatus === "error" ? onRetrySave : onSave} />
          <MenuDivider />
          <MenuItem label={t.exportProject} onClick={onExportProject} />
          <MenuItem label={t.importProject} onClick={onImportProject} />
          <MenuDivider />
          <MenuSubmenu label={t.projectManagement}>
            <MenuItem label={t.versionHistory} onClick={onOpenVersionHistory} />
            <MenuItem label={t.projectRecovery} onClick={onOpenRecoveryCenter} />
            <MenuItem label={t.projectSafety} onClick={onOpenProjectSafety} />
          </MenuSubmenu>
          <MenuDivider />
          <MenuItem label={t.downloadExport} shortcut="Ctrl/Cmd+Shift+E" onClick={onOpenExport} />

        </MenuDropdown>

        <MenuDropdown label={t.editMenu}>
          <MenuItem label={undoLabel ? t.undoWithLabel(undoLabel) : t.undo} shortcut="Ctrl/Cmd+Z" onClick={onUndo} disabled={!canUndo} />
          <MenuItem label={redoLabel ? t.redoWithLabel(redoLabel) : t.redo} shortcut="Ctrl/Cmd+Shift+Z" onClick={onRedo} disabled={!canRedo} />
          <MenuDivider />
          <MenuItem label={t.copy} shortcut="Ctrl/Cmd+C" onClick={onCopy} />
          <MenuItem label={t.paste} shortcut="Ctrl/Cmd+V" onClick={onPaste} />
          <MenuItem label={t.duplicate} shortcut="Ctrl/Cmd+D" onClick={onDuplicate} />
          <MenuItem label={t.delete} shortcut="Delete" onClick={onDelete} />
          <MenuDivider />
          <MenuItem label={t.selectAll} shortcut="Ctrl/Cmd+A" onClick={onSelectAll} />
        </MenuDropdown>

        <MenuDropdown label={t.viewMenu}>
          <MenuItem label={t.zoomIn} onClick={onZoomIn} />
          <MenuItem label={t.zoomOut} onClick={onZoomOut} />
          <MenuItem label={t.resetZoom} onClick={onResetZoom} />
          <MenuDivider />
          <MenuCheckItem label={t.showRulers} shortcut="Shift+R" checked={showRulers} onClick={onToggleRulers} />
          <MenuCheckItem label={t.showGuides} shortcut="Ctrl/Cmd+;" checked={showGuides} onClick={onToggleGuidesVisible} />
          <MenuCheckItem label={t.lockAllGuides} checked={guidesLocked} onClick={onToggleLockAllGuides} />
          <MenuCheckItem label={t.showGrid} checked={showGrid} onClick={onToggleGrid} />
          <MenuCheckItem label={t.showSafeMargins} checked={showMargins} onClick={onToggleMargins} />
          <MenuCheckItem label={t.showSafeArea} checked={showSafeArea} onClick={onToggleSafeArea} />
          <MenuCheckItem label={t.showBleedLines} checked={showBleed} onClick={onToggleBleed} />
          <MenuCheckItem label={t.showLayoutGrid} checked={showLayoutGrid} onClick={onToggleLayoutGrid} />
          <MenuDivider />
          <MenuCheckItem label={t.showSmartGuides} checked={showSmartGuides} onClick={onToggleSmartGuides} />
          <MenuCheckItem label={t.snapToGuides} checked={snapToGuides} onClick={onToggleSnapToGuides} />
          <MenuCheckItem label={t.snappingEnabled} checked={snapEnabled} onClick={onToggleSnap} />
          <MenuItem label={t.clearGuides} onClick={onClearGuides} />
          <MenuDivider />
          <MenuItem label={t.guideManager} onClick={onOpenGuideManager} />
          <MenuItem label={t.precisionSettings} onClick={onOpenPrecisionSettings} />
          <MenuItem label={t.resetPrecisionView} onClick={onResetPrecisionView} />
        </MenuDropdown>

        <MenuDropdown label={t.helpMenu}>
          <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {t.keyboardShortcuts}
          </div>
          <div className="grid gap-1 px-3 pb-2 text-xs text-gray-600">
            <div className="flex justify-between gap-4">
              <span>{t.shortcutUndoRedo}</span>
              <span>Ctrl/Cmd+Z / Shift+Z</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>{t.shortcutCopyPaste}</span>
              <span>Ctrl/Cmd+C / V</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>{t.shortcutDuplicate}</span>
              <span>Ctrl/Cmd+D</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>{t.shortcutGroupUngroup}</span>
              <span>Ctrl/Cmd+G / Shift+G</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>{t.shortcutDelete}</span>
              <span>Delete / Backspace</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>{t.shortcutPanCanvas}</span>
              <span>Hold Space</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>{t.shortcutZoom}</span>
              <span>Ctrl/Cmd + Scroll</span>
            </div>
          </div>
          <MenuDivider />
          <MenuItem label={t.aboutVaycona} onClick={() => {}} />
        </MenuDropdown>
      </nav>

      <input
        className="ml-1 w-full max-w-30 shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-center text-sm font-medium text-gray-700 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100 md:ml-2 md:max-w-xs"
        value={projectName}
        onChange={(event) => onProjectNameChange(event.target.value)}
        aria-label={t.projectNameLabel}
      />

      <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-1.5">
        <button
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          onClick={onOpenResize}
          title={t.resizePage}
          aria-label={t.resizePage}
        >
          <Scaling size={17} />
        </button>
        <button
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-30"
          onClick={onUndo}
          disabled={!canUndo}
          title={undoLabel ? t.undoWithLabel(undoLabel) : t.undo}
          aria-label={undoLabel ? t.undoWithLabel(undoLabel) : t.undo}
        >
          <Undo2 size={17} />
        </button>
        <button
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-30"
          onClick={onRedo}
          disabled={!canRedo}
          title={redoLabel ? t.redoWithLabel(redoLabel) : t.redo}
          aria-label={redoLabel ? t.redoWithLabel(redoLabel) : t.redo}
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
          <span className="hidden md:inline">{saveStatus === "error" ? t.retrySave : saveLabel}</span>
        </button>
        <button
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-2.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 md:px-3.5"
          onClick={onOpenExport}
          title={t.exportTitle}
          aria-label={t.exportAriaLabel}
        >
          <Download size={16} /> <span className="hidden md:inline">{t.exportButton}</span>
        </button>
        <button
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          onClick={onShareDesign}
          title={t.shareDesign}
          aria-label={t.shareDesign}
        >
          <Share2 size={17} />
        </button>
        {isAdmin && (
          <button
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 md:px-3"
            onClick={() => navigateTo("#/admin")}
            title={t.adminPanel}
            aria-label={t.adminPanel}
          >
            <ShieldCheck size={16} /> <span className="hidden md:inline">{t.adminPanel}</span>
          </button>
        )}
        <SettingsMenu />
        <AccountMenu />
      </div>
    </header>
  );
}

function SettingsMenu() {
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const c = STRINGS[language].common;
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  return (
    <div className="relative shrink-0">
      <div ref={anchorRef} className="inline-flex">
        <button
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          onClick={() => setOpen((v) => !v)}
          title={c.settings}
          aria-label={c.settings}
        >
          <Settings size={17} />
        </button>
      </div>
      <ToolbarPopover isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)} align="right">
        <div className="w-56 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
          <span className="mb-1.5 block text-xs font-medium text-gray-500">{c.language}</span>
          <div className="mb-3 flex gap-1 rounded-lg border border-gray-200 p-1">
            {[
              { key: "en", label: "English" },
              { key: "fr", label: "Français" },
            ].map((option) => (
              <button
                key={option.key}
                className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                  language === option.key ? "bg-amber-100 text-amber-700" : "text-gray-500 hover:bg-gray-50"
                }`}
                onClick={() => setLanguage(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <span className="mb-1.5 block text-xs font-medium text-gray-500">{c.theme}</span>
          <div className="flex gap-1 rounded-lg border border-gray-200 p-1">
            {[
              { key: "light", label: c.light },
              { key: "dark", label: c.dark },
            ].map((option) => (
              <button
                key={option.key}
                className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                  theme === option.key ? "bg-amber-100 text-amber-700" : "text-gray-500 hover:bg-gray-50"
                }`}
                onClick={() => setTheme(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </ToolbarPopover>
    </div>
  );
}

function AccountMenu() {
  const { user, signOut } = useAuth();
  const { language } = useLanguage();
  const t = STRINGS[language].topNav;
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  return (
    <div className="relative shrink-0">
      <div ref={anchorRef} className="inline-flex">
        <button
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
          title={user?.email || "Account"}
          aria-label={t.accountMenu}
          onClick={() => setOpen((v) => !v)}
        >
          <User size={16} />
        </button>
      </div>
      <ToolbarPopover isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)} align="right">
        <div className="min-w-[220px] rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg">
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
            {t.logOut}
          </button>
        </div>
      </ToolbarPopover>
    </div>
  );
}
