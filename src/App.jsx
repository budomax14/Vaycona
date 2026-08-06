import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layer, Rect, Stage, Transformer } from "react-konva";
import DesignNode from "./DesignNode";
import CanvasOverlays from "./CanvasOverlays";
import ContextMenu from "./ContextMenu";
import SelectionToolbar from "./components/SelectionToolbar";
import RotationIndicator from "./components/RotationIndicator";
import TopNavBar from "./components/TopNavBar";
import PropertiesToolbar from "./components/PropertiesToolbar/PropertiesToolbar";
import LeftSidebar, { SECTIONS } from "./components/LeftSidebar/LeftSidebar";
import UploadsPanel from "./components/LeftSidebar/panels/UploadsPanel";
import TextPanel from "./components/LeftSidebar/panels/TextPanel";
import ShapesPanel from "./components/LeftSidebar/panels/ShapesPanel";
import BackgroundsPanel from "./components/LeftSidebar/panels/BackgroundsPanel";
import ElementsPanel from "./components/LeftSidebar/panels/ElementsPanel";
import IconsPanel from "./components/LeftSidebar/panels/IconsPanel";
import LayersPanel from "./components/LeftSidebar/panels/LayersPanel";
import PagesPanel from "./components/LeftSidebar/panels/PagesPanel";
import ComingSoonPanel from "./components/LeftSidebar/panels/ComingSoonPanel";
import StatusBar from "./components/StatusBar/StatusBar";
import Workspace from "./components/Workspace/Workspace";
import ResizeModal from "./components/ResizeModal";
import { RecentColorsProvider } from "./recentColorsContext";
import {
  createHistory,
  pushHistoryEntry,
  canUndo as historyCanUndo,
  canRedo as historyCanRedo,
  undoLabel,
  redoLabel,
  HISTORY_LIMIT,
} from "./history";
import LineEndpointHandles, { getLineEndpointsContent } from "./components/LineEndpointHandles";
import { getApplyMatrix, getDefaultProps, getTransforms } from "./objectRegistry";
import {
  expandToLeafIds,
  getAncestorChain,
  getDescendantIds,
  isEffectivelyHidden,
  isEffectivelyLocked,
  recomputeAffectedGroupBounds,
  reorderLayerItems,
  repairHierarchy,
  resolveClickSelection,
} from "./hierarchy";
import { SHAPE_KIND_ORDER } from "./shapeKinds";
import { LINE_KIND_ORDER } from "./lineKinds";
import { findIconByName } from "./iconCatalog";
import { FRAME_KIND_ORDER } from "./frameKinds";
import TextEditOverlay from "./components/TextEditOverlay";
import CropOverlay from "./components/CropOverlay";
import ImageFillOverlay from "./components/ImageFillOverlay";
import { ensureRichText, isValidRichText as isValidRichTextShape, plainTextOf } from "./richText";
import { defaultTextEffects } from "./textEffects";
import { getPresetByKey } from "./textStyles";
import { borderDashProps } from "./borderStyles";
import { getItemBounds, rectsIntersect, unionBounds } from "./bounds";
import { screenToContent, contentToScreen } from "./viewport";
import { collectSnapCandidates, computeSnap, snapResizeEdge, thresholdForScale } from "./snapping";
import { alignItems, alignToPage, distributeItems } from "./alignment";
import {
  normalizeGuide,
  createGuide,
  normalizePagePrecision,
  defaultPagePrecision,
  MAX_GUIDES_PER_PAGE,
} from "./precisionDefaults";
import { isSupportedUnit, DEFAULT_UNIT } from "./measurement";
import { loadPrecisionPrefs, savePrecisionPrefs, normalizePrecisionPrefs } from "./precisionPreferences";
import GuideManagerDialog from "./components/GuideManagerDialog";
import PrecisionSettingsDialog from "./components/PrecisionSettingsDialog";
import { isTypingTarget, useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { useMediaQuery } from "./useMediaQuery";
import { putAsset, deleteAsset, getAssetBlob, getAssetMeta, listAssetIndex, listAssets, regenerateAssetThumbnail } from "./assetStore";
import { createAutosaveService, SAVE_STATUS, readSavedRecord, checkStorageQuota } from "./autosaveService";
import {
  createSnapshot,
  getNewestValidSnapshot,
  listSnapshotSummaries,
  getSnapshotById,
  deleteSnapshot,
  removeObsoleteSnapshots,
  isSnapshotShapeValid,
  markSessionOpen,
  heartbeatSession,
  markSessionClosed,
  wasPriorSessionUnclean,
  HEARTBEAT_INTERVAL,
  consumeSkipRecoveryFlag,
  consumeForceRecoveryFlag,
} from "./recoveryService";
import RecoveryDialog from "./components/RecoveryDialog";
import RecoveryCenter from "./components/RecoveryCenter";
import ExportDialog from "./components/ExportDialog";
import { buildExportRequest } from "./export/exportRequest";
import { runExport, downloadExportResult } from "./export/exportService";
import {
  analyzeExportAssets,
  exportProjectPackage,
  downloadBlob,
  inspectProjectPackage,
  validateAndRepairImportedProject,
  importPackageAssets,
  applyAssetRemap,
} from "./projectPackage";
import { getWorkspaceId, resetWorkspaceId } from "./recoveryService";
import ExportProjectDialog from "./components/ExportProjectDialog";
import ImportProjectDialog from "./components/ImportProjectDialog";
import {
  createVersion,
  listVersionSummaries,
  getVersionById,
  renameVersion,
  deleteVersion,
  isVersionShapeValid,
  estimateVersionStorageBytes,
} from "./versionHistoryService";
import { validateProject, repairProject } from "./projectValidator";
import VersionHistoryPanel from "./components/VersionHistoryPanel";
import ProjectSafetyPanel from "./components/ProjectSafetyPanel";
import {
  ensureBuiltInTemplatesSeeded,
  listTemplateSummaries,
  getTemplateById,
  createTemplate,
  setTemplateFavorite,
  deleteTemplate,
  duplicateTemplate,
  recordTemplateUsed,
  isTemplateShapeValid,
  updateTemplatePayload,
  publishTemplate,
} from "./templateService";
import { cloneWorkspaceDataWithNewIds, cloneItemsForInsertion, cloneGuidesForPage, recenterItems } from "./idRemap";
import TemplateBrowser from "./components/TemplateBrowser";
import HomePage from "./components/HomePage";
import TemplatePreviewDialog from "./components/TemplatePreviewDialog";
import SaveAsTemplateDialog from "./components/SaveAsTemplateDialog";
import AdminTemplateEditorToolbar from "./components/Admin/AdminTemplateEditorToolbar";
import ConfirmDeleteTemplateDialog from "./components/Admin/ConfirmDeleteTemplateDialog";
import { navigateTo } from "./adminRoute";
import { DEFAULT_CROP, legacyInsetsToCrop, normalizeCrop } from "./imageCrop";
import { normalizeImageFill } from "./imageFill";
import { DEFAULT_ADJUSTMENTS, normalizeAdjustments } from "./imageEffects";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  PASTEBOARD_MARGIN_PX,
  RENDER_SCALE_CAP,
  WORKSPACE_STORAGE_KEY,
  ADMIN_TEMPLATE_DRAFT_STORAGE_KEY_PREFIX,
  PROJECT_SCHEMA_VERSION,
  AUTOSAVE_DEBOUNCE_MS,
  MAX_IMAGE_DIMENSION,
} from "./constants";

// --- Phase 11: Brand Kit / design tokens ---
import { DocumentColorsProvider } from "./documentColorsContext";
import { useBrandKits } from "./brandKitContext";
import {
  addResource,
  updateResource,
  getBrandKitById,
  createObjectStyle,
  createImageStyle,
  createTypographyToken,
  createLogoResource,
  recordBrandKitUsed,
} from "./brandKitService";
import {
  applyColorToken,
  detachColor,
  applyTypographyStyle as resolveApplyTypographyStyle,
  detachTypographyStyle,
  typographyTokenFromItem,
  applyObjectStyle as resolveApplyObjectStyle,
  detachObjectStyle,
  objectStylePropsFromItem,
  applyImageStyle as resolveApplyImageStyle,
  detachImageStyle,
  imageStylePropsFromItem,
  applyBackgroundStyle as resolveApplyBackgroundStyle,
} from "./brandApply";
import { planThemeApplication, applyThemeToProject } from "./themeApply";
import { applyColorReplacement } from "./colorReplace";
import { applyFontReplacement, planFontReplacement } from "./fontReplace";
import { validateSvgSafety, sanitizeSvg, extractSvgDimensions, rasterizeSvgToPngBlob } from "./svgSafety";
import BrandPanel from "./components/LeftSidebar/panels/BrandPanel";
import BrandKitManagerDialog from "./components/BrandKit/BrandKitManagerDialog";
import ThemeApplyDialog from "./components/BrandKit/ThemeApplyDialog";
import ReplaceColorsDialog from "./components/BrandKit/ReplaceColorsDialog";
import ReplaceFontsDialog from "./components/BrandKit/ReplaceFontsDialog";
import BrandAuditDialog from "./components/BrandKit/BrandAuditDialog";
// --- Phase 12: animation / timeline / presentation / animated export ---
import {
  computeAnimatedItems,
  latestAnimationEndTime,
  applyAnimationToItem,
  removeAnimationById,
  removeStageAnimations,
  removeAllAnimations,
  updateAnimation,
  computeStaggerStartTimes,
  resolveStaticExportItems,
} from "./animation/animationService";
import { createPlaybackEngine } from "./animation/playbackService";
import { clampPageDuration, DEFAULT_PAGE_DURATION_MS, clampTransition, defaultTransition, clampPresentationSettings, defaultPresentationSettings } from "./animation/animationSchema";
import { useReducedMotion } from "./useReducedMotion";
import AnimationPanel from "./components/Animation/AnimationPanel";
import Timeline from "./components/Timeline/Timeline";
import PresentationMode from "./components/Presentation/PresentationMode";
import ExportAnimationDialog from "./components/ExportAnimationDialog";

// Konva's own transform is pinned at this fixed value forever (see plan
// notes in Workspace.jsx / constants.js) — actual zoom is a CSS transform
// applied on top, so this never changes and can be a plain constant.
//
// This is content-space -> `canvasFrameRef`-local Konva-pixel space, used
// everywhere a DOM overlay (rulers, guides, selection toolbar, text/crop
// overlays...) positions itself relative to that div. `canvasFrameRef`
// itself is always exactly page-sized/positioned — content (0,0) is its
// own local (0,0) — regardless of the pasteboard below, so x/y stay 0.
const KONVA_VIEWPORT = { scale: RENDER_SCALE_CAP, x: 0, y: 0 };

// content-space -> the live Stage's own ABSOLUTE pixel space. NOT the same
// as KONVA_VIEWPORT above: the Stage is rendered PASTEBOARD_MARGIN_PX
// larger than the page and shifted via its own x/y (see renderActivePage)
// so pasteboard content stays visible, which means the Stage's absolute
// pixel origin sits PASTEBOARD_MARGIN_PX*RENDER_SCALE_CAP away from content
// (0,0). Konva APIs that hand back/expect ABSOLUTE stage-pixel positions
// directly — currently only dragBoundFunc's return value — need this one
// instead of KONVA_VIEWPORT, or the dragged node lands off by exactly the
// pasteboard margin (the bounding box/Transformer, which Konva keeps in
// perfect sync with the node's real x/y, ends up in the wrong place while
// still perfectly containing its own text — this is what read as
// "container and text out of sync" but was really the whole node landing
// somewhere it shouldn't).
const STAGE_ABSOLUTE_VIEWPORT = {
  scale: RENDER_SCALE_CAP,
  x: PASTEBOARD_MARGIN_PX * RENDER_SCALE_CAP,
  y: PASTEBOARD_MARGIN_PX * RENDER_SCALE_CAP,
};

// Phase 10 §58: the increment itself is now configurable (precisionPrefs.
// rotationSnapIncrement, default 15°) rather than a fixed 45° set — the
// old MAJOR_ROTATION_SNAPS constant is superseded by buildRotationSnaps()
// below. Shift still requests a finer subdivision than whatever the
// configured increment is, same modifier semantics as before.
function buildRotationSnaps(stepDeg) {
  const step = Math.max(1, Math.min(90, stepDeg || 15));
  const count = Math.round(360 / step);
  return Array.from({ length: count }, (_, i) => i * step);
}
const FINE_ROTATION_STEP = 5;

const starterItems = [
  {
    id: crypto.randomUUID(),
    type: "text",
    text: "Create something amazing",
    x: 190,
    y: 90,
    width: 520,
    height: 80,
    fontSize: 46,
    fontFamily: "Arial",
    fill: "#111827",
    align: "center",
    rotation: 0,
    opacity: 1,
  },
  {
    id: crypto.randomUUID(),
    type: "text",
    text: "Your personal Duma Studio",
    x: 250,
    y: 175,
    width: 400,
    height: 50,
    fontSize: 24,
    fontFamily: "Arial",
    fill: "#6b7280",
    align: "center",
    rotation: 0,
    opacity: 1,
  },
];

// Fills safe defaults for any missing/malformed field so older or partial
// saved data never crashes rendering/interaction math that assumes these
// fields exist. Phase 3 also folds the old standalone "circle" type into
// "shape" + shapeKind:"circle" here (one-time, non-breaking migration —
// see the Phase 3 completion notes for why no schemaVersion bump is
// needed: every change is additive/defaulting, not a breaking format
// change) and normalizes unknown shape/line/frame kinds to a safe default.
function validateItem(raw, fallbackPageId) {
  if (!raw || typeof raw !== "object" || !raw.type) return null;
  const now = Date.now();

  let normalized = raw;
  if (normalized.type === "circle") {
    normalized = { ...normalized, type: "shape", shapeKind: "circle" };
  }
  if (normalized.type === "shape" && !SHAPE_KIND_ORDER.includes(normalized.shapeKind)) {
    normalized = { ...normalized, shapeKind: "rectangle" };
  }
  if (normalized.type === "line" && !LINE_KIND_ORDER.includes(normalized.lineKind)) {
    normalized = { ...normalized, lineKind: "straight" };
  }
  if (normalized.type === "frame" && !FRAME_KIND_ORDER.includes(normalized.frameKind)) {
    normalized = { ...normalized, frameKind: "rectangle" };
  }
  if (normalized.type === "icon" && !findIconByName(normalized.iconName)) {
    normalized = { ...normalized, iconName: "Star" };
  }
  if (normalized.type === "image") {
    // Phase 6 fields, additive/defaulting only (same pattern as the text
    // block below — no schemaVersion bump). Legacy `src` (a pre-Phase-6
    // data URL) and a legacy {top,right,bottom,left}-shaped `crop` are
    // deliberately left AS-IS here rather than normalized away — IndexedDB
    // is async, so the actual conversion (data URL -> asset, legacy insets
    // -> the new crop shape) happens in the post-mount
    // migrateLegacyImageAssets effect, which needs to see the original
    // values. A crop that's already in the new shape (or absent) is
    // normalized immediately as usual.
    const imageDefaults = getDefaultProps("image");
    const looksLegacyCrop = normalized.crop && typeof normalized.crop === "object" && ("top" in normalized.crop || "left" in normalized.crop);
    normalized = {
      ...imageDefaults,
      ...normalized,
      crop: looksLegacyCrop ? normalized.crop : normalizeCrop(normalized.crop),
      adjustments: normalizeAdjustments(normalized.adjustments),
    };
  }
  if (normalized.type === "frame") {
    // contentSrc (a pre-Phase-6 data URL placeholder reservation, never
    // actually populated by any real feature) is likewise left as-is for
    // migrateLegacyImageAssets to convert into contentAssetId.
    const frameDefaults = getDefaultProps("frame", normalized.frameKind);
    normalized = {
      ...frameDefaults,
      ...normalized,
      crop: normalizeCrop(normalized.crop),
      adjustments: normalizeAdjustments(normalized.adjustments),
    };
  }
  if (normalized.type === "text") {
    // Phase 4 fields, additive/defaulting only (see Phase 4 completion
    // notes — no schemaVersion bump). Malformed richText (wrong shape)
    // is dropped rather than kept broken — ensureRichText() synthesizes
    // a valid one from the legacy flat fields on next read, so one bad
    // object never breaks project load.
    const textDefaults = getDefaultProps("text");
    normalized = {
      ...textDefaults,
      ...normalized,
      richText: isValidRichTextShape(normalized.richText) ? normalized.richText : undefined,
      background: { ...textDefaults.background, ...(normalized.background || {}) },
      border: { ...textDefaults.border, ...(normalized.border || {}) },
      effects: {
        ...defaultTextEffects(),
        ...(normalized.effects || {}),
        shadow: { ...defaultTextEffects().shadow, ...(normalized.effects?.shadow || {}) },
        outline: { ...defaultTextEffects().outline, ...(normalized.effects?.outline || {}) },
        glow: { ...defaultTextEffects().glow, ...(normalized.effects?.glow || {}) },
      },
    };
  }

  return {
    ...normalized,
    id: typeof normalized.id === "string" ? normalized.id : crypto.randomUUID(),
    pageId: typeof normalized.pageId === "string" ? normalized.pageId : fallbackPageId,
    // Phase 5: real parent/child hierarchy replaces the old flat groupId
    // tag. `groupId` (if present) is intentionally left in the spread
    // above so migrateFlatGroupsToGroupObjects (array-level, run once at
    // load) can still read it and synthesize real group items from it;
    // validateItem itself only needs to make sure parentId is well-typed.
    parentId: typeof normalized.parentId === "string" ? normalized.parentId : null,
    x: typeof normalized.x === "number" ? normalized.x : 0,
    y: typeof normalized.y === "number" ? normalized.y : 0,
    width: typeof normalized.width === "number" && normalized.width > 0 ? normalized.width : 100,
    height: typeof normalized.height === "number" && normalized.height >= 0 ? normalized.height : 100,
    rotation: typeof normalized.rotation === "number" ? normalized.rotation : 0,
    opacity: typeof normalized.opacity === "number" ? normalized.opacity : 1,
    locked: !!normalized.locked,
    hidden: !!normalized.hidden,
    createdAt: typeof normalized.createdAt === "number" ? normalized.createdAt : now,
    updatedAt: typeof normalized.updatedAt === "number" ? normalized.updatedAt : now,
  };
}

// Phase 5: folds the old flat groupId tag (Phase 2's convenience
// multi-select marker) into real group objects with parent/child
// hierarchy — a one-time, non-breaking migration (additive, no
// schemaVersion bump, consistent with every prior phase's approach).
// Group members were never guaranteed contiguous under the old flat
// model, so migrated members are placed contiguously at the position of
// their first-encountered member — a documented, minor z-order shuffle
// limited to previously-grouped items, not a data-loss concern.
function migrateFlatGroupsToGroupObjects(items) {
  const byGroupTag = new Map();
  items.forEach((item) => {
    if (item.groupId) {
      if (!byGroupTag.has(item.groupId)) byGroupTag.set(item.groupId, []);
      byGroupTag.get(item.groupId).push(item);
    }
  });
  if (byGroupTag.size === 0) return items.map(({ groupId, ...rest }) => rest);

  const now = Date.now();
  const next = [];
  const emittedGroupTags = new Set();
  items.forEach((item) => {
    const { groupId: tag, ...rest } = item;
    if (!tag || !byGroupTag.has(tag)) {
      next.push(rest);
      return;
    }
    if (emittedGroupTags.has(tag)) return;
    emittedGroupTags.add(tag);
    const members = byGroupTag.get(tag);
    const newGroupId = crypto.randomUUID();
    members.forEach((member) => {
      const { groupId: _drop, ...memberRest } = member;
      next.push({ ...memberRest, parentId: newGroupId });
    });
    const box = unionBounds(members.map(getItemBounds));
    next.push({
      id: newGroupId,
      type: "group",
      pageId: rest.pageId,
      parentId: null,
      name: "Group",
      x: box.left,
      y: box.top,
      width: box.width,
      height: box.height,
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      createdAt: now,
      updatedAt: now,
    });
  });
  return next;
}

// Phase 5: background moves from one global value to a per-page field.
// Migration copies the existing global value onto every existing page
// (non-destructive — nothing visually changes on first load).
function migratePageBackgrounds(pages, legacyGlobalBackground) {
  return pages.map((page) => ({
    background: typeof page.background === "string" ? page.background : legacyGlobalBackground || "#ffffff",
    ...page,
  }));
}

// Phase 10: every page gets its own grid/margins/safeArea/bleed/layoutGrid/
// baselineGrid settings object, additive/defaulting like every prior
// page-level migration (Phase 5's background) — no schemaVersion bump.
function migratePagePrecision(pages) {
  return pages.map((page) => ({ ...page, ...normalizePagePrecision(page) }));
}

// Phase 10: guides gain pageId/color/locked/hidden/label. A guide that
// predates this (no pageId at all) becomes a GLOBAL guide (pageId: null —
// still renders/snaps on every page, exactly matching its old behavior)
// rather than guessing which single page it "belonged" to.
//
// Ruler-dragged guides are always global now (App.jsx beginGuideDrag), so
// any pre-existing page-scoped guide here predates that and is forced to
// global too — otherwise it would be stuck on the one page it was dragged
// onto and never show up on pages added afterward.
function migrateGuides(rawGuides) {
  if (!Array.isArray(rawGuides)) return [];
  return rawGuides.map((g) => normalizeGuide(g)).filter(Boolean).map((g) => ({ ...g, pageId: null }));
}

// Recovery snapshots (Phase 7C) reference assets by the same stable IDs
// the project already uses — never binary data. Computed fresh from a
// given items array (rather than reusing the `usedAssetIds` useMemo)
// so callers reading from itemsRef.current inside a timer always get the
// truly-current set, not one captured at whatever render defined it.
function usedAssetIdsFrom(items) {
  const set = new Set();
  items.forEach((item) => {
    if (item.assetId) set.add(item.assetId);
    if (item.contentAssetId) set.add(item.contentAssetId);
  });
  return [...set];
}

function buildFallbackWorkspace() {
  const fallbackPage = {
    id: crypto.randomUUID(),
    name: "Page 1",
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    background: "#ffffff",
    ...defaultPagePrecision(),
  };
  const now = Date.now();
  // Routed through the same validator as any loaded project so the
  // starter content always has every field's safe defaults too (not just
  // whatever starterItems happened to hardcode at the time it was written).
  const fallbackItems = starterItems
    .map((item) => validateItem({ ...item, pageId: fallbackPage.id, createdAt: now, updatedAt: now }, fallbackPage.id))
    .filter(Boolean);
  return {
    pages: [fallbackPage],
    activePageId: fallbackPage.id,
    scale: 1,
    hasManualZoomOrPan: false,
    items: fallbackItems,
    guides: [],
    snapToGuides: true,
    preferredUnit: undefined,
    presentationSettings: defaultPresentationSettings(),
  };
}

// Shared by loadWorkspaceState (normal boot) and recovery restoration
// (Phase 7C) — the same validate/migrate/repair pipeline either way, so a
// recovery snapshot's data is loaded exactly as safely as a normal save.
// Returns null if `parsed` isn't a usable workspace shape at all (caller
// falls back further — to .backup, a recovery snapshot, or starter
// content).
function normalizeParsedWorkspace(parsed) {
  if (!parsed || !Array.isArray(parsed.pages) || parsed.pages.length === 0) return null;
  const activePageId = parsed.pages.some((page) => page.id === parsed.activePageId)
    ? parsed.activePageId
    : parsed.pages[0].id;
  const fallbackPageId = parsed.pages[0].id;
  let items = Array.isArray(parsed.items) ? parsed.items.map((item) => validateItem(item, fallbackPageId)).filter(Boolean) : [];
  items = migrateFlatGroupsToGroupObjects(items);
  items = repairHierarchy(items);
  let pages = migratePageBackgrounds(parsed.pages, parsed.background);
  pages = migratePagePrecision(pages);
  return {
    pages,
    activePageId,
    scale: typeof parsed.scale === "number" ? parsed.scale : 1,
    hasManualZoomOrPan: true,
    items,
    guides: migrateGuides(parsed.guides),
    snapToGuides: parsed.snapToGuides ?? true,
    preferredUnit: isSupportedUnit(parsed.preferredUnit) ? parsed.preferredUnit : undefined,
    presentationSettings: clampPresentationSettings(parsed.presentationSettings),
  };
}

// Phase 7B wraps a saved record as {schemaVersion, revision, updatedAt,
// checksum, data}; readSavedRecord verifies the checksum and returns null
// on a corrupt/absent read. Records written before Phase 7B are the raw
// {pages, items, ...} object with no wrapper — recognized by the absence
// of `data`/`schemaVersion` and used as-is.
function unwrapWorkspaceRecord(record) {
  return record.data && record.schemaVersion ? record.data : record;
}

// `storageKey`/`seedData` (Template Management Admin): the normal editor
// always calls this with WORKSPACE_STORAGE_KEY and no seed, exactly as
// before. The admin template editor calls it with a per-template draft key
// (crash-safety staging, never WORKSPACE_STORAGE_KEY — see App()'s
// `workspaceStorageKey`) and the template's own `data` as `seedData`, used
// only when no draft record exists yet for this template (first time
// opening it, or after a clean Save Draft/Publish elsewhere).
function loadWorkspaceState(storageKey = WORKSPACE_STORAGE_KEY, seedData = null) {
  const fallback = seedData ? normalizeParsedWorkspace(seedData) || buildFallbackWorkspace() : buildFallbackWorkspace();
  try {
    const primary = readSavedRecord(storageKey);
    if (primary) {
      const normalized = normalizeParsedWorkspace(unwrapWorkspaceRecord(primary));
      if (normalized) return { ...normalized, sourceRevision: primary.revision ?? null, sourceUpdatedAt: primary.updatedAt ?? null };
    }

    // Primary is missing or failed validation/checksum. If a raw value is
    // present at all, it means the primary write is CORRUPT (not just
    // "never saved") — fall back to the .backup record before giving up
    // (spec §14) rather than silently discarding it.
    const primaryRaw = localStorage.getItem(storageKey);
    if (primaryRaw) {
      const backup = readSavedRecord(`${storageKey}.backup`);
      if (backup) {
        const normalized = normalizeParsedWorkspace(unwrapWorkspaceRecord(backup));
        if (normalized) {
          return { ...normalized, sourceRevision: backup.revision ?? null, sourceUpdatedAt: backup.updatedAt ?? null, usedBackup: true };
        }
      }
    }
    return fallback;
  } catch {
    return fallback;
  }
}

// `editorMode`/`templateSession` (Template Management Admin) — everything
// below defaults to exactly today's behavior when omitted; every new
// branch these introduce is additive and gated on `editorMode === "template"`.
// See AdminApp.jsx for the caller and src/components/Admin/ for the UI.
export default function App({ editorMode = "workspace", templateSession = null } = {}) {
  // Phase 11 — brand kit context is provided by AppRoot.jsx (an ancestor
  // of App), so it's safe to consume it here directly.
  const { activeBrandKit, activeBrandKitId, refresh: refreshBrandKits } = useBrandKits();

  // Template Management Admin — the ONE place "which storage key does this
  // mount's autosave/initial-load use" is decided. Never WORKSPACE_STORAGE_KEY
  // in template mode, so editing a template can never read from or write to
  // the user's personal project (see constants.js's comment on this key).
  const workspaceStorageKey =
    editorMode === "template" && templateSession
      ? `${ADMIN_TEMPLATE_DRAFT_STORAGE_KEY_PREFIX}:${templateSession.templateId}`
      : WORKSPACE_STORAGE_KEY;
  const [isBrandManagerOpen, setIsBrandManagerOpen] = useState(false);
  const [isThemeDialogOpen, setIsThemeDialogOpen] = useState(false);
  const [isReplaceColorsOpen, setIsReplaceColorsOpen] = useState(false);
  const [isReplaceFontsOpen, setIsReplaceFontsOpen] = useState(false);
  const [isBrandAuditOpen, setIsBrandAuditOpen] = useState(false);

  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const canvasFrameRef = useRef(null);
  const workspaceRef = useRef(null);
  const nodesMapRef = useRef(new Map());
  const clipboardRef = useRef([]);
  const dragOriginsRef = useRef(null);
  // Phase 10 — coalesces a burst of held-down-arrow-key nudges into ONE
  // history entry (spec §55/§76/§123): each keypress live-updates items
  // immediately (so it still feels instant) and (re)starts a short idle
  // timer; only once the key is released long enough does a single commit
  // land, carrying the movable ids from the START of the burst.
  const nudgeSessionRef = useRef(null);
  const draggingGuideRef = useRef(null);
  const lineDragRef = useRef(null);
  const marqueeStartRef = useRef(null);
  // Captures each selected group's bounds + line-member ids at gesture
  // start, so handleTransformEnd can carry line/arrow descendants along
  // via a computed delta (they opt out of the shared Transformer).
  const groupTransformStartRef = useRef([]);

  const initialWorkspace = useMemo(
    () => loadWorkspaceState(workspaceStorageKey, templateSession?.initialData ?? null),
    // Intentionally the initial mount's storageKey/seed only — AdminTemplateEditorRoute
    // remounts App with a fresh `key={templateId}` when switching templates
    // (see AdminApp.jsx), so this never needs to react to prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [items, setItems] = useState(initialWorkspace.items);
  const [selectedIds, setSelectedIds] = useState([]);
  // History snapshots capture {items, pages} together (Phase 5 widens the
  // existing items-only history so page actions — add/duplicate/delete/
  // reorder/resize/background — are undoable too; see commit/commitPages
  // below). Background is now a per-page field (page.background), not a
  // separate top-level state. Phase 7A adds per-entry metadata (type/
  // label/timestamp/affected ids), a no-op guard, and a size limit — see
  // history.js.
  const [historyState, setHistoryState] = useState(() => createHistory(initialWorkspace.items, initialWorkspace.pages, initialWorkspace.guides));
  const [projectName, setProjectName] = useState("My Design");
  const [status, setStatus] = useState("");
  // Centralized autosave's reported status (Phase 7B) — see autosaveRef
  // below, the single source of truth for what gets written to
  // WORKSPACE_STORAGE_KEY. Distinct from `status` above (a transient toast
  // message for one-off actions like manual Save/Load).
  const [saveStatus, setSaveStatus] = useState({ status: SAVE_STATUS.SAVED, lastSavedAt: null, lastError: null });
  // Set only when local storage is estimated >90% full (spec §12) — checked
  // on save failure and manual Save, never polled.
  const [storageWarning, setStorageWarning] = useState(null);
  // Phase 7C recovery — null unless the startup comparison finds a
  // recovery snapshot worth offering. `null` reason means no dialog.
  const [recoveryOffer, setRecoveryOffer] = useState(null);
  const [isRecoveryCenterOpen, setIsRecoveryCenterOpen] = useState(false);
  const [recoverySnapshots, setRecoverySnapshots] = useState([]);

  // Phase 7D project import/export — kept distinct from saveStatus (spec
  // §40): exporting a file or opening the import dialog says nothing
  // about whether the LOCAL project is saved.
  const [exportDialogStage, setExportDialogStage] = useState(null); // null = closed
  const [exportError, setExportError] = useState(null);
  // Phase 9 — design export (PNG/JPEG/PDF/SVG), fully distinct from the
  // .canvasproject package export dialog state directly above.
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportDialogFormat, setExportDialogFormat] = useState(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importStage, setImportStage] = useState("idle");
  const [importPreview, setImportPreview] = useState(null);
  const [importError, setImportError] = useState(null);
  const [importProgress, setImportProgress] = useState(null);

  // Phase 7E — local version history + Project Safety. Separate from
  // undo/redo, autosave, recovery snapshots, and exported packages.
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [versions, setVersions] = useState([]);
  const [isProjectSafetyOpen, setIsProjectSafetyOpen] = useState(false);
  const [validationReport, setValidationReport] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [unusedAssetInfo, setUnusedAssetInfo] = useState(null);
  const [storageEstimate, setStorageEstimate] = useState(null);
  const [isCleaning, setIsCleaning] = useState(false);

  // Phase 8 — templates + reusable pages/sections. Separate from version
  // history/recovery (spec: templates never carry undo/redo, recovery
  // snapshots, or version records).
  const [isTemplateBrowserOpen, setIsTemplateBrowserOpen] = useState(false);
  const [templateSummaries, setTemplateSummaries] = useState([]);
  const [reusablePages, setReusablePages] = useState([]);
  const [reusableSections, setReusableSections] = useState([]);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [isSaveAsTemplateOpen, setIsSaveAsTemplateOpen] = useState(false);
  const [deleteTemplateTarget, setDeleteTemplateTarget] = useState(null);
  const [saveTemplateError, setSaveTemplateError] = useState(null);

  // Landing page (Home) — shown before the canvas in normal workspace mode
  // so picking a design is a real first step, not skippable. Never shown
  // in template-editing mode (AdminApp already put the user on a specific
  // template; there's nothing to "pick").
  const [showHomePage, setShowHomePage] = useState(editorMode === "workspace");

  useEffect(() => {
    if (editorMode === "workspace") refreshTemplateLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [pages, setPages] = useState(initialWorkspace.pages);
  const [activePageId, setActivePageId] = useState(initialWorkspace.activePageId);
  const [scale, setScale] = useState(initialWorkspace.scale);
  const [hasManualZoomOrPan, setHasManualZoomOrPan] = useState(initialWorkspace.hasManualZoomOrPan);
  const [isResizeOpen, setIsResizeOpen] = useState(false);
  const [isExportAnimationOpen, setIsExportAnimationOpen] = useState(false);

  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [isShiftDown, setIsShiftDown] = useState(false);
  const [isAltDown, setIsAltDown] = useState(false);
  const [cursorPos, setCursorPos] = useState(null);
  const [marquee, setMarquee] = useState(null);
  // Explicit, centralized "what's happening right now" signal — additive
  // alongside the existing per-gesture refs (dragOriginsRef etc, which keep
  // doing their own bookkeeping), set at the start/end of each gesture
  // rather than inferred from scattered booleans. Panning is tracked
  // separately inside Workspace.jsx, since it's fully self-contained there.
  const [interactionMode, setInteractionMode] = useState("idle");
  const [rotationAngle, setRotationAngle] = useState(0);

  const [guides, setGuides] = useState(initialWorkspace.guides);
  const [snapToGuides, setSnapToGuides] = useState(initialWorkspace.snapToGuides);
  const [alignmentLines, setAlignmentLines] = useState({ vertical: [], horizontal: [] });
  const [equalSpacing, setEqualSpacing] = useState({ horizontal: null, vertical: null });
  const [distanceLabels, setDistanceLabels] = useState([]);

  // Phase 10 — precision layout tools. `preferredUnit` is durable PROJECT
  // state (spec §6/§69), persisted like scale/guides; `precisionPrefs` is
  // application-level (spec §69's other category — ruler/smart-guide
  // visibility, snap sensitivity, nudge increments, measurement-label
  // visibility, default unit), loaded once from its own localStorage key
  // (see precisionPreferences.js) and never round-tripped through the
  // project file. Per-page grid/margins/safeArea/bleed/layoutGrid/
  // baselineGrid settings live ON the page object itself (see
  // precisionDefaults.js) — already durable and already undoable for free
  // via the existing pages/commitPages machinery, no new plumbing needed.
  const [preferredUnit, setPreferredUnit] = useState(initialWorkspace.preferredUnit || DEFAULT_UNIT);
  // Phase 12 — presentation settings (autoplay/loop/speed/navigation mode)
  // are durable project data (spec §3) but, like preferredUnit above,
  // aren't part of undo history — changing them is a view/behavior
  // preference, not a content edit.
  const [presentationSettings, setPresentationSettings] = useState(
    () => clampPresentationSettings(initialWorkspace.presentationSettings) || defaultPresentationSettings()
  );
  const presentationSettingsRef = useRef(presentationSettings);
  presentationSettingsRef.current = presentationSettings;
  const { reducedMotion, override: reducedMotionOverride, setOverride: setReducedMotionOverride } = useReducedMotion();
  // Runtime-only editor preview state (spec §3/§56/§57 — never serialized,
  // never part of history/autosave). A single playbackService engine drives
  // BOTH the Timeline's playhead and any in-canvas page preview — see spec
  // §43 "one playback loop drives the current preview".
  const [previewTimeMs, setPreviewTimeMs] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [animationPanelOpen, setAnimationPanelOpen] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);
  const previewEngineRef = useRef(null);
  if (!previewEngineRef.current) {
    previewEngineRef.current = createPlaybackEngine({
      duration: DEFAULT_PAGE_DURATION_MS,
      onTick: (t) => setPreviewTimeMs(t),
      onEnded: () => setIsPreviewPlaying(false),
      loop: false,
    });
  }
  useEffect(() => () => previewEngineRef.current?.destroy(), []);
  const [precisionPrefs, setPrecisionPrefs] = useState(() => loadPrecisionPrefs());
  const [selectedGuideId, setSelectedGuideId] = useState(null);
  const [isGuideManagerOpen, setIsGuideManagerOpen] = useState(false);
  const [isPrecisionSettingsOpen, setIsPrecisionSettingsOpen] = useState(false);
  const activeUnit = preferredUnit || precisionPrefs.defaultUnit;
  const [contextMenu, setContextMenu] = useState(null);

  const [activeSidebarSection, setActiveSidebarSection] = useState(null);
  const isCompact = useMediaQuery("(max-width: 1024px)");

  // Inline text-edit mode — parallel to selectedIds (the item stays
  // selected while its edit-mode id is set), see enterTextEdit/exitTextEdit.
  const [editingTextId, setEditingTextId] = useState(null);
  const pendingCaretPointRef = useRef(null);
  const overlayRef = useRef(null);
  const [copiedTextStyle, setCopiedTextStyle] = useState(null);

  // Group "entry" (drill-down) state — parallel in shape to editingTextId.
  // See hierarchy.js's resolveClickSelection for the exact click model.
  const [enteredGroupId, setEnteredGroupId] = useState(null);

  // Crop mode (Phase 6) — parallel in shape to editingTextId/enteredGroupId.
  // A snapshot of the crop value at entry is kept so Cancel can restore it
  // exactly without needing an undo step (only Apply commits to history).
  const [croppingItemId, setCroppingItemId] = useState(null);
  const cropEntrySnapshotRef = useRef(null);

  // Image Fill position/zoom drag mode — parallel in shape to crop mode
  // above: entry snapshots the pre-gesture fillImage so Cancel can restore
  // it without an undo step, live drag/zoom (ImageFillOverlay.jsx) calls
  // updateItem(...,false), and a single commit lands the whole gesture as
  // one history entry.
  const [imageFillEditItemId, setImageFillEditItemId] = useState(null);
  const imageFillEntrySnapshotRef = useRef(null);

  // Tracks the async remove-background job (triggered from the right-click
  // context menu) so the menu can show a busy state and a stray second
  // click can't kick off a duplicate job for the same item.
  const [removingBackgroundId, setRemovingBackgroundId] = useState(null);

  const activePage = pages.find((page) => page.id === activePageId) || pages[0];
  // Background is a per-page field now (Phase 5) — kept as a same-named
  // local so every existing consumer (CanvasPropertiesBar, BackgroundsPanel)
  // keeps working with zero prop-shape changes.
  const background = activePage?.background ?? "#ffffff";

  // Ref mirrors so the handlers passed to the memoized DesignNode (below)
  // can stay referentially stable via useCallback([]) while still reading
  // live values every drag frame.
  const itemsRef = useRef(items);
  const pagesRef = useRef(pages);
  const activePageRef = useRef(activePage);
  const activePageIdRef = useRef(activePageId);
  const guidesRef = useRef(guides);
  const snapToGuidesRef = useRef(snapToGuides);
  const preferredUnitRef = useRef(preferredUnit);
  const precisionPrefsRef = useRef(precisionPrefs);
  const selectedIdsRef = useRef(selectedIds);
  const scaleRef = useRef(scale);
  const isAltDownRef = useRef(isAltDown);
  const editingTextIdRef = useRef(editingTextId);
  const enteredGroupIdRef = useRef(enteredGroupId);
  const croppingItemIdRef = useRef(croppingItemId);
  const imageFillEditItemIdRef = useRef(imageFillEditItemId);
  const interactionModeRef = useRef(interactionMode);
  // Mirrors historyState, but also updated SYNCHRONOUSLY by commit/
  // commitPages/commitBoth/undo/redo (not just after render, like the
  // mirrors above) — needed so a flush-then-undo happening in the same
  // event-handler tick (e.g. Cmd+Z while still inside an active text edit,
  // see useKeyboardShortcuts wiring below) sees the just-flushed entry
  // rather than the previous render's stale index.
  const historyStateRef = useRef(historyState);
  itemsRef.current = items;
  pagesRef.current = pages;
  activePageRef.current = activePage;
  activePageIdRef.current = activePageId;
  guidesRef.current = guides;
  snapToGuidesRef.current = snapToGuides;
  preferredUnitRef.current = preferredUnit;
  precisionPrefsRef.current = precisionPrefs;
  selectedIdsRef.current = selectedIds;
  scaleRef.current = scale;
  isAltDownRef.current = isAltDown;
  editingTextIdRef.current = editingTextId;
  enteredGroupIdRef.current = enteredGroupId;
  croppingItemIdRef.current = croppingItemId;
  imageFillEditItemIdRef.current = imageFillEditItemId;
  interactionModeRef.current = interactionMode;

  // Phase 10 — application-level precision prefs persist to their own
  // localStorage key (never the project file) on every change, mirroring
  // recentColorsContext.jsx's own small-preference pattern rather than
  // going through the autosave service.
  useEffect(() => {
    savePrecisionPrefs(precisionPrefs);
  }, [precisionPrefs]);

  // Every assetId/contentAssetId currently referenced anywhere in the
  // project (all pages, not just the active one) — backs the Uploads
  // panel's "warn before removing a used asset" behavior (spec §5).
  const usedAssetIds = useMemo(() => {
    const set = new Set();
    items.forEach((item) => {
      if (item.assetId) set.add(item.assetId);
      if (item.contentAssetId) set.add(item.contentAssetId);
    });
    return set;
  }, [items]);

  // One-time, async, non-undoable bookkeeping pass (mirrors the existing
  // migrateFlatGroupsToGroupObjects/migratePageBackgrounds philosophy) that
  // converts any pre-Phase-6 data-URL image (`item.src` / `item.contentSrc`)
  // into a real IndexedDB asset, and legacy inset-shaped crops into the new
  // crop model. Can't run synchronously in loadWorkspaceState() like the
  // other migrations because IndexedDB access is inherently async.
  useEffect(() => {
    let cancelled = false;
    async function migrateLegacySrc(dataUrl, name) {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      return putAsset(blob, { name: name || "Untitled image", sourceType: "duplicate" });
    }
    async function run() {
      const current = itemsRef.current;
      const legacyImages = current.filter((it) => it.type === "image" && it.src && !it.assetId);
      const legacyFrames = current.filter((it) => it.type === "frame" && it.contentSrc && !it.contentAssetId);
      if (legacyImages.length === 0 && legacyFrames.length === 0) return;

      const updatesById = new Map();
      for (const item of legacyImages) {
        const meta = await migrateLegacySrc(item.src, item.name);
        if (cancelled) return;
        if (meta.id) {
          const looksLegacyCrop = item.crop && typeof item.crop === "object" && ("top" in item.crop || "left" in item.crop);
          updatesById.set(item.id, {
            assetId: meta.id,
            src: undefined,
            crop: looksLegacyCrop ? legacyInsetsToCrop(item.crop) : normalizeCrop(item.crop),
          });
        }
      }
      for (const item of legacyFrames) {
        const meta = await migrateLegacySrc(item.contentSrc, item.name);
        if (cancelled) return;
        if (meta.id) updatesById.set(item.id, { contentAssetId: meta.id, contentSrc: undefined });
      }
      if (cancelled || updatesById.size === 0) return;
      setItems((prev) => prev.map((it) => (updatesById.has(it.id) ? { ...it, ...updatesById.get(it.id) } : it)));
    }
    run();
    return () => {
      cancelled = true;
    };
    // Runs once at mount, like the other load-time migrations — items can
    // change afterward for many unrelated reasons that shouldn't re-trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One-time built-in template seed check (Phase 8, spec §42) — cheap
  // (an IndexedDB read + a localStorage version flag), never reseeds
  // duplicates, and never blocks the editor becoming interactive.
  useEffect(() => {
    ensureBuiltInTemplatesSeeded();
  }, []);

  // Centralized autosave service (Phase 7B) — the single writer of the
  // workspace record; nothing else in this file calls
  // localStorage.setItem(WORKSPACE_STORAGE_KEY, ...) directly. Created
  // once (lazy ref init, not useMemo — must never be recreated) with a
  // `serialize` closure that reads refs, not render-scope state, since
  // it's called later from a timer, not from this render.
  const autosaveRef = useRef(null);
  if (!autosaveRef.current) {
    autosaveRef.current = createAutosaveService({
      storageKey: workspaceStorageKey,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      debounceMs: AUTOSAVE_DEBOUNCE_MS,
      serialize: () => buildCurrentProjectData(),
      onStatusChange: (next) => {
        setSaveStatus(next);
        // Recovery snapshots/quota warnings are a workspace-only concern —
        // the admin template editor has its own durability (this same
        // autosave service, just pointed at a per-template draft key
        // above) and its own explicit Save Draft/Publish commit point;
        // see templateSession handling further down this file.
        if (editorMode !== "workspace") return;
        // On-demand only (spec §12) — checked right when a failure makes
        // quota relevant, not polled continuously.
        if (next.status === SAVE_STATUS.ERROR) {
          checkStorageQuota().then((estimate) => {
            if (estimate && estimate.percentUsed > 0.9) setStorageWarning(estimate);
          });
          // A failed normal save should create or preserve a recovery
          // snapshot (spec §6) — the autosave service itself stays
          // unaware of recovery; this is the integration boundary.
          createRecoverySnapshotNow("save-failure");
        } else if (next.status === SAVE_STATUS.SAVED) {
          // Successful autosave makes equivalent periodic snapshots
          // redundant (spec §6/§21) — best-effort, never blocks anything.
          removeObsoleteSnapshots(buildCurrentProjectData()).catch(() => {});
        }
      },
    });
  }

  // Skips the very first run (the state that just LOADED isn't a new,
  // unsaved change) — every run after that schedules a debounced save.
  const isFirstAutosaveRunRef = useRef(true);
  useEffect(() => {
    if (isFirstAutosaveRunRef.current) {
      isFirstAutosaveRunRef.current = false;
      return;
    }
    // historyState changes exactly once per committed transaction (and on
    // undo/redo) — see history.js's no-op guard — so this already follows
    // "save after a committed change", not every keystroke/drag frame
    // (spec §4/§5). guides are now PART of historyState (Phase 10) but are
    // listed again here defensively; snapToGuides/scale/activePageId/
    // preferredUnit aren't part of undo history but are still persisted
    // project/view state.
    autosaveRef.current.scheduleSave();
  }, [historyState, guides, snapToGuides, scale, activePageId, preferredUnit, presentationSettings]);

  // Best-effort — most browsers don't await async work in `beforeunload`,
  // but a pending localStorage write is synchronous, so flushing here
  // reliably lands the newest state if a save was still debouncing.
  useEffect(() => {
    function handleBeforeUnload(event) {
      const wasPending = autosaveRef.current.getStatus().dirty;
      autosaveRef.current.flush();
      const status = autosaveRef.current.getStatus();
      if (wasPending && status.status === SAVE_STATUS.ERROR) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Commits any active compatible edit, then flushes/forces an immediate
  // save — used by the toolbar's Save control, Cmd/Ctrl+S, and (below)
  // failure Retry. Crop mode is left alone: forcing an Apply as a save
  // side effect would be a surprising, unrequested edit (spec §14).
  function saveNow() {
    if (editingTextIdRef.current) exitTextEdit();
    autosaveRef.current.saveNow();
    checkStorageQuota().then((estimate) => {
      if (estimate && estimate.percentUsed > 0.9) setStorageWarning(estimate);
    });
  }

  function retrySave() {
    autosaveRef.current.retry();
  }

  // --- Phase 7C: crash recovery ---
  // Separate from autosave (above) on purpose — creating/restoring a
  // snapshot here never touches WORKSPACE_STORAGE_KEY directly and never
  // changes the Phase 7B save-status label by itself.

  const sessionIdRef = useRef(null);
  const snapshotCommitCounterRef = useRef(0);
  const COMMIT_SNAPSHOT_THRESHOLD = 20;
  const PERIODIC_SNAPSHOT_INTERVAL_MS = 45000;

  // Best-effort safety net — a failure here must never surface as an
  // editor error or interrupt anything else in progress.
  // Single source for "the current committed project as a plain data
  // object" — used by autosave's serializer, recovery snapshots, versions,
  // export, and validation, so they can never quietly drift apart.
  function buildCurrentProjectData() {
    return {
      pages: pagesRef.current,
      activePageId: activePageIdRef.current,
      scale: scaleRef.current,
      items: itemsRef.current,
      guides: guidesRef.current,
      snapToGuides: snapToGuidesRef.current,
      preferredUnit: preferredUnitRef.current,
      presentationSettings: presentationSettingsRef.current,
    };
  }

  async function createRecoverySnapshotNow(reason, protectedFlag = false) {
    // Recovery snapshots are a workspace-only concept (spec: template
    // drafts get their own durability, see the autosave block above) —
    // guarding this one definition covers every call site in this file.
    if (editorMode !== "workspace") return;
    try {
      const data = buildCurrentProjectData();
      await createSnapshot({
        reason,
        data,
        baseRevision: autosaveRef.current.getStatus().revision,
        projectUpdatedAt: Date.now(),
        assetIds: usedAssetIdsFrom(itemsRef.current),
        protectedFlag,
      });
    } catch {
      // IndexedDB unavailable/full — recovery is a safety net, not a
      // requirement; normal autosave is unaffected either way.
    }
  }

  async function refreshRecoverySnapshotList() {
    setRecoverySnapshots(await listSnapshotSummaries());
  }

  // --- Phase 7E: local version history ---
  // Separate store/purpose from recovery snapshots above (spec §2) —
  // meaningful, named/system milestones meant to be browsed and kept
  // around, not constant background safety copies.

  async function createAutoMilestone(type) {
    try {
      const data = buildCurrentProjectData();
      const assetIds = usedAssetIdsFrom(data.items);
      const assetIndex = listAssetIndex();
      await createVersion({
        type,
        data,
        sourceRevision: autosaveRef.current.getStatus().revision,
        assetIds,
        missingAssetCount: assetIds.filter((id) => !assetIndex[id]).length,
        protectedFlag: true,
      });
    } catch {
      // Best-effort, same as recovery snapshots — never blocks the
      // operation it's protecting.
    }
  }

  async function refreshVersionList() {
    setVersions(await listVersionSummaries());
  }

  function openVersionHistory() {
    refreshVersionList();
    setIsVersionHistoryOpen(true);
  }

  async function handleCreateManualVersion(name, note) {
    if (editingTextIdRef.current) exitTextEdit();
    autosaveRef.current.flush();
    const data = buildCurrentProjectData();
    const assetIds = usedAssetIdsFrom(data.items);
    const assetIndex = listAssetIndex();
    await createVersion({
      type: "manual",
      name,
      note,
      data,
      sourceRevision: autosaveRef.current.getStatus().revision,
      assetIds,
      missingAssetCount: assetIds.filter((id) => !assetIndex[id]).length,
    });
    refreshVersionList();
    setStatus(`Version "${name}" created.`);
    window.setTimeout(() => setStatus(""), 2500);
  }

  async function handleRestoreVersionAction(id) {
    const version = await getVersionById(id);
    if (!version || !isVersionShapeValid(version)) {
      setStatus("That version could not be validated and was skipped.");
      window.setTimeout(() => setStatus(""), 3000);
      return;
    }
    const confirmed = window.confirm(
      `Restore "${version.name || "this version"}"? The current document will be replaced. A recovery snapshot will be created first, current unsaved changes will be saved if possible, and this version will remain available afterward.`
    );
    if (!confirmed) return;

    if (editingTextIdRef.current) exitTextEdit();
    autosaveRef.current.flush();
    await createRecoverySnapshotNow("before-replacement", true);
    await createAutoMilestone("before-version-restore");

    const normalized = normalizeParsedWorkspace(version.data);
    if (!normalized) {
      setStatus("That version's data could not be loaded.");
      window.setTimeout(() => setStatus(""), 3000);
      return;
    }

    loadWorkspaceDataIntoEditor(normalized);

    autosaveRef.current.markDirty();
    autosaveRef.current.saveNow();
    const saveResult = autosaveRef.current.getStatus();
    setIsVersionHistoryOpen(false);
    setStatus(
      saveResult.status === SAVE_STATUS.SAVED
        ? "Version restored and saved."
        : "Version restored, but saving failed. Your previous state is safely backed up in Recovery."
    );
    window.setTimeout(() => setStatus(""), 4000);
  }

  async function handleRenameVersionAction(id, name) {
    await renameVersion(id, name);
    refreshVersionList();
  }

  async function handleDeleteVersionAction(id) {
    if (!window.confirm("Delete this version? This cannot be undone.")) return;
    await deleteVersion(id);
    refreshVersionList();
  }

  // --- Phase 7E: Project Safety (overview + validation + cleanup) ---

  async function refreshStorageEstimate() {
    const [quotaInfo, versionBytes, allAssets] = await Promise.all([
      checkStorageQuota(),
      estimateVersionStorageBytes(),
      listAssets(),
    ]);
    const assetBytes = allAssets.reduce((sum, a) => sum + (a.size || 0), 0);
    const recoverySummaries = await listSnapshotSummaries();
    let recoveryBytes = 0;
    for (const summary of recoverySummaries) {
      const full = await getSnapshotById(summary.id);
      if (full?.data) recoveryBytes += JSON.stringify(full.data).length;
    }
    setStorageEstimate({
      assets: assetBytes,
      recovery: recoveryBytes,
      versions: versionBytes,
      total: quotaInfo?.usage ?? assetBytes + recoveryBytes + versionBytes,
      quota: quotaInfo?.quota ?? 0,
    });
  }

  function openProjectSafety() {
    setIsProjectSafetyOpen(true);
    refreshRecoverySnapshotList();
    refreshVersionList();
    setValidationReport(null);
    setUnusedAssetInfo(null);
    refreshStorageEstimate();
  }

  function handleValidateProject() {
    setIsValidating(true);
    const data = buildCurrentProjectData();
    const assetIndex = listAssetIndex();
    const report = validateProject(data, { assetIndex });
    setValidationReport(report);
    setIsValidating(false);
  }

  async function handleApplyRepairs() {
    if (!validationReport || validationReport.repairs.length === 0) return;
    const confirmed = window.confirm(
      `Apply ${validationReport.repairs.length} safe repair(s)? A recovery snapshot and a safety version will be created first.`
    );
    if (!confirmed) return;
    autosaveRef.current.flush();
    await createRecoverySnapshotNow("before-repair", true);
    await createAutoMilestone("before-repair");

    const repaired = repairProject(buildCurrentProjectData());
    // Routed through the normal history system (spec §25 step 8: "mark
    // the project Unsaved") — repairs are a real, undoable document edit,
    // not a silent background rewrite.
    commitBoth(repaired.items, repaired.pages, { type: "repair", label: "Apply safe repairs" });

    const revalidation = validateProject(repaired, { assetIndex: listAssetIndex() });
    setValidationReport(revalidation);
    setStatus("Safe repairs applied.");
    window.setTimeout(() => setStatus(""), 3000);
  }

  async function findUnusedAssetIds() {
    const [allAssets, recoverySummaries, versionSummaries] = await Promise.all([
      listAssets(),
      listSnapshotSummaries(),
      listVersionSummaries(),
    ]);
    const referenced = new Set(usedAssetIdsFrom(itemsRef.current));
    recoverySummaries.forEach((s) => (s.assetIds || []).forEach((id) => referenced.add(id)));
    versionSummaries.forEach((v) => (v.assetIds || []).forEach((id) => referenced.add(id)));
    return allAssets.filter((asset) => !referenced.has(asset.id));
  }

  async function handleCheckUnusedAssets() {
    const unused = await findUnusedAssetIds();
    setUnusedAssetInfo({
      ids: unused.map((a) => a.id),
      count: unused.length,
      approxBytes: unused.reduce((sum, a) => sum + (a.size || 0), 0),
    });
  }

  async function handleDeleteUnusedAssets() {
    if (!unusedAssetInfo || unusedAssetInfo.count === 0) return;
    if (!window.confirm(`Delete ${unusedAssetInfo.count} unused uploaded asset(s)? This cannot be undone.`)) return;
    setIsCleaning(true);
    for (const id of unusedAssetInfo.ids) {
      // eslint-disable-next-line no-await-in-loop
      await deleteAsset(id);
    }
    setUnusedAssetInfo(null);
    await refreshStorageEstimate();
    setIsCleaning(false);
  }

  async function handleRebuildThumbnails() {
    const allAssets = await listAssets();
    for (const asset of allAssets) {
      // eslint-disable-next-line no-await-in-loop
      await regenerateAssetThumbnail(asset.id);
    }
  }

  // --- Phase 8: templates + reusable pages/sections ---
  // A "project"-kind template IS just a workspace data payload (spec §16
  // integrates with, not competes with, the existing serializer/validator/
  // ID model) — creating a project from one reuses the exact same
  // normalizeParsedWorkspace + loadWorkspaceDataIntoEditor + resetWorkspaceId
  // path project import's "Open as new" already established in Phase 7D.

  async function refreshTemplateLists() {
    const [projects, pageTemplates, sectionTemplates] = await Promise.all([
      listTemplateSummaries("project"),
      listTemplateSummaries("page"),
      listTemplateSummaries("section"),
    ]);
    // Template Management Admin — the end-user gallery only ever shows
    // published templates. Existing records with no `status` field yet
    // (pre-dating this feature) default to published, matching their prior
    // behavior exactly (see templateService.createTemplate's default).
    setTemplateSummaries(projects.filter((t) => (t.status || "published") === "published"));
    setReusablePages(pageTemplates);
    setReusableSections(sectionTemplates);
  }

  function openTemplateBrowser() {
    refreshTemplateLists();
    setIsTemplateBrowserOpen(true);
  }

  async function handleSelectTemplate(id) {
    const full = await getTemplateById(id);
    setPreviewTemplate(full);
  }

  async function handleToggleTemplateFavorite(id) {
    const current = templateSummaries.find((t) => t.id === id) || previewTemplate;
    await setTemplateFavorite(id, !current?.favorite);
    refreshTemplateLists();
    if (previewTemplate?.id === id) setPreviewTemplate(await getTemplateById(id));
  }

  function handleDeleteTemplateAction(id) {
    const target = templateSummaries.find((t) => t.id === id);
    if (!target || target.builtIn) return;
    setDeleteTemplateTarget(target);
  }

  async function confirmDeleteTemplate() {
    if (!deleteTemplateTarget) return;
    await deleteTemplate(deleteTemplateTarget.id);
    setDeleteTemplateTarget(null);
    refreshTemplateLists();
  }

  async function handleDuplicateTemplateAction(id) {
    await duplicateTemplate(id);
    refreshTemplateLists();
  }

  // Template package export (spec §40) reuses projectPackage.js's exact
  // packaging/validation pipeline rather than a second archive format —
  // a template's `data` is already the same workspace shape a project
  // export packages, so this is the same function with the template's
  // own name/asset list standing in for the live project's.
  async function handleExportTemplate(id) {
    const template = await getTemplateById(id);
    if (!template) return;
    const result = await exportProjectPackage({
      data: template.data,
      projectName: template.name,
      workspaceId: template.id,
    });
    if (result.ok) downloadBlob(result.blob, result.filename);
    else setStatus("Could not export this template.");
    window.setTimeout(() => setStatus(""), 3000);
  }

  // MIN/MAX guard against pathological sizes (spec §32) — reuses the same
  // ceiling image uploads already respect.
  function clampPageDimension(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.round(Math.min(Math.max(n, 20), MAX_IMAGE_DIMENSION));
  }

  // Shared "replace the single active workspace with fresh data" sequence
  // — used by both blank-design creation and create-project-from-template,
  // matching the safety pattern project import's replace/open-as-new
  // already uses (flush, protect, fresh workspace identity, fresh history).
  async function replaceWorkspaceWith(data, { projectName: nextProjectName }) {
    autosaveRef.current.flush();
    await createRecoverySnapshotNow("before-replacement", true);
    resetWorkspaceId();
    loadWorkspaceDataIntoEditor(data);
    setProjectName(nextProjectName);
    autosaveRef.current.markDirty();
    autosaveRef.current.saveNow();
    return autosaveRef.current.getStatus();
  }

  async function createBlankDesign(width, height, label) {
    const pageId = crypto.randomUUID();
    const safeWidth = clampPageDimension(width, 1080);
    const safeHeight = clampPageDimension(height, 1080);
    const data = {
      pages: [{ id: pageId, name: "Page 1", width: safeWidth, height: safeHeight, background: "#ffffff", ...defaultPagePrecision() }],
      activePageId: pageId,
      scale: 1,
      items: [],
      guides: [],
      snapToGuides: true,
      preferredUnit,
    };
    const result = await replaceWorkspaceWith(data, { projectName: label || "Untitled Design" });
    setIsTemplateBrowserOpen(false);
    setShowHomePage(false);
    setStatus(result.status === SAVE_STATUS.SAVED ? "Blank design created." : "Created, but saving failed.");
    window.setTimeout(() => setStatus(""), 2500);
  }

  async function useTemplate(templateId) {
    const template = await getTemplateById(templateId);
    if (!template || !isTemplateShapeValid(template)) {
      setStatus("That template could not be validated and was skipped.");
      window.setTimeout(() => setStatus(""), 3000);
      return;
    }
    const report = validateProject(template.data);
    if (report.status === "fatal") {
      setStatus("This template's data is invalid and can't be used.");
      window.setTimeout(() => setStatus(""), 3000);
      return;
    }
    const safeData = report.repairs.length > 0 ? repairProject(template.data) : template.data;
    const normalized = normalizeParsedWorkspace(safeData);
    if (!normalized) {
      setStatus("This template's data could not be loaded.");
      window.setTimeout(() => setStatus(""), 3000);
      return;
    }

    // Every page/object/group ID is regenerated together (spec §16/§17) —
    // the template record itself is never mutated by this.
    const { data: cloned } = cloneWorkspaceDataWithNewIds(normalized);
    const result = await replaceWorkspaceWith(cloned, { projectName: template.name });

    if (result.status === SAVE_STATUS.SAVED) {
      // Usage/recent tracking only after a confirmed successful creation
      // (spec §50) — never on preview, cancel, or a failed save.
      await recordTemplateUsed(templateId);
    }
    setPreviewTemplate(null);
    setIsTemplateBrowserOpen(false);
    setShowHomePage(false);
    setStatus(result.status === SAVE_STATUS.SAVED ? `Created from "${template.name}".` : "Created, but saving failed. Your previous project is backed up in Recovery.");
    window.setTimeout(() => setStatus(""), 3500);
  }

  function openSaveAsTemplateDialog() {
    if (editingTextIdRef.current) exitTextEdit();
    setSaveTemplateError(null);
    setIsSaveAsTemplateOpen(true);
  }

  async function handleSaveAsTemplate({ name, description, category, tags }) {
    autosaveRef.current.flush();
    const data = buildCurrentProjectData();
    const report = validateProject(data);
    if (report.status === "fatal") {
      setSaveTemplateError("This project has an issue and can't be saved as a template right now.");
      return;
    }
    const assetIds = usedAssetIdsFrom(data.items);
    let thumbnail = null;
    try {
      thumbnail = captureStagePng();
    } catch {
      // Thumbnail is best-effort (spec §45/§15) — a failure here must not
      // block saving the template itself.
    }
    try {
      await createTemplate({
        kind: "project",
        name,
        description,
        category,
        tags,
        data,
        assetIds,
        pageCount: data.pages.length,
        objectCount: data.items.length,
        groupCount: data.items.filter((it) => it.type === "group").length,
        pageWidth: data.pages[0]?.width,
        pageHeight: data.pages[0]?.height,
        thumbnail,
        createdFromProjectId: getWorkspaceId(),
      });
      setIsSaveAsTemplateOpen(false);
      setStatus(`Template "${name}" saved.`);
      window.setTimeout(() => setStatus(""), 2500);
    } catch (err) {
      // Current project (undo/redo/save state) is completely untouched by
      // this whole function — a failure here can't affect it either.
      setSaveTemplateError(`Could not save template: ${err?.message || "storage error"}.`);
    }
  }

  // --- Template Management Admin: template-editor save/publish/preview/cancel ---
  // Mirrors handleSaveAsTemplate's own pattern (flush -> buildCurrentProjectData
  // -> validate/repair -> capture thumbnail -> persist) rather than relying on
  // the per-template draft autosave above to reach the real template record on
  // its own — this is the one explicit, awaited commit point into the actual
  // gallery-visible template (see templateService.updateTemplatePayload).
  const [isPublishing, setIsPublishing] = useState(false);

  async function commitTemplateDraft() {
    if (editingTextIdRef.current) exitTextEdit();
    autosaveRef.current.flush(); // local per-template draft safety net
    const data = buildCurrentProjectData();
    const report = validateProject(data);
    const safeData = report.status !== "fatal" && report.repairs.length > 0 ? repairProject(data) : data;
    const assetIds = usedAssetIdsFrom(safeData.items);
    let thumbnail;
    try {
      thumbnail = captureStagePng();
    } catch {
      thumbnail = undefined; // keep whatever thumbnail the template already has
    }
    await updateTemplatePayload(templateSession.templateId, {
      data: safeData,
      assetIds,
      pageCount: safeData.pages.length,
      objectCount: safeData.items.length,
      groupCount: safeData.items.filter((it) => it.type === "group").length,
      thumbnail,
      pageWidth: safeData.pages[0]?.width,
      pageHeight: safeData.pages[0]?.height,
    });
  }

  async function handleTemplateSaveDraft() {
    await commitTemplateDraft();
    templateSession.onSaveDraft?.();
  }

  async function handleTemplateSaveAndPublish() {
    setIsPublishing(true);
    await commitTemplateDraft();
    const result = await publishTemplate(templateSession.templateId);
    setIsPublishing(false);
    templateSession.onPublish?.(result);
  }

  function handleTemplateCancel() {
    if (editingTextIdRef.current) exitTextEdit();
    autosaveRef.current.flush();
    templateSession.onCancel?.();
  }

  // Reuses the same previewTemplate state + <TemplatePreviewDialog/> the
  // end-user "New design" flow already renders below — a synthetic record
  // (no `id`) built from the live in-editor data, never persisted.
  function handleTemplatePreview() {
    if (editingTextIdRef.current) exitTextEdit();
    const data = buildCurrentProjectData();
    setPreviewTemplate({
      name: templateSession.templateName,
      data,
      pageWidth: data.pages[0]?.width,
      pageHeight: data.pages[0]?.height,
      pageCount: data.pages.length,
      objectCount: data.items.length,
      assetCount: usedAssetIdsFrom(data.items).length,
      category: null,
      tags: [],
      favorite: false,
    });
  }

  // --- Reusable sections (spec §35/§36) ---

  async function saveSelectionAsReusableSection() {
    if (selectedIds.length === 0) return;
    const name = window.prompt("Name this reusable section:");
    if (!name || !name.trim()) return;
    const sourceItems = getExpandedSelectionItems(selectedItems);
    const bounds = unionBounds(sourceItems.map(getItemBounds));
    // Positions stored relative to the section's own origin (spec §36) —
    // remapped to an absolute page position again on insert.
    const relativeItems = sourceItems.map((it) => ({ ...it, x: it.x - bounds.left, y: it.y - bounds.top }));
    const assetIds = usedAssetIdsFrom(relativeItems);
    await createTemplate({
      kind: "section",
      name: name.trim(),
      category: "personal",
      tags: [],
      data: { items: relativeItems, bounds: { width: bounds.width, height: bounds.height } },
      assetIds,
      pageCount: 0,
      objectCount: relativeItems.length,
      groupCount: relativeItems.filter((it) => it.type === "group").length,
      pageWidth: bounds.width,
      pageHeight: bounds.height,
    });
    refreshTemplateLists();
    setStatus("Section saved.");
    window.setTimeout(() => setStatus(""), 2000);
  }

  async function insertReusableSection(id) {
    const record = await getTemplateById(id);
    if (!record) return;
    const { items: cloned, idMap } = cloneItemsForInsertion(record.data.items, activePageId);
    const bounds = unionBounds(cloned.map(getItemBounds));
    const center = { x: activePage.width / 2, y: activePage.height / 2 };
    const recentered = recenterItems(cloned, bounds, center);
    commit([...items, ...recentered], {
      type: "insert-section",
      label: `Insert "${record.name}"`,
      itemIds: [...idMap.values()],
    });
    setSelectedIds(recentered.filter((it) => !it.parentId).map((it) => it.id));
    await recordTemplateUsed(id);
    setIsTemplateBrowserOpen(false);
  }

  async function handleDeleteReusableSection(id) {
    const target = reusableSections.find((t) => t.id === id);
    if (!window.confirm(`Delete "${target?.name || "this section"}"? This cannot be undone.`)) return;
    await deleteTemplate(id);
    refreshTemplateLists();
  }

  // --- Reusable pages (spec §34) ---

  async function savePageAsReusable(pageId) {
    const sourcePage = pages.find((p) => p.id === pageId);
    if (!sourcePage) return;
    const name = window.prompt("Name this reusable page:", sourcePage.name);
    if (!name || !name.trim()) return;
    const templatePageId = "template-page";
    const pageItems = items.filter((it) => it.pageId === pageId).map((it) => ({ ...it, pageId: templatePageId }));
    // Page-scoped guides travel with the page (spec §72); global guides
    // are never captured here — they belong to the whole project, not any
    // one reusable page.
    const pageGuides = guides.filter((g) => g.pageId === pageId).map((g) => ({ ...g, pageId: templatePageId }));
    const assetIds = usedAssetIdsFrom(pageItems);
    await createTemplate({
      kind: "page",
      name: name.trim(),
      category: "personal",
      tags: [],
      data: { page: { ...sourcePage, id: templatePageId }, items: pageItems, guides: pageGuides },
      assetIds,
      pageCount: 1,
      objectCount: pageItems.length,
      groupCount: pageItems.filter((it) => it.type === "group").length,
      pageWidth: sourcePage.width,
      pageHeight: sourcePage.height,
    });
    refreshTemplateLists();
    setStatus("Page saved as reusable.");
    window.setTimeout(() => setStatus(""), 2000);
  }

  async function insertReusablePage(id) {
    const record = await getTemplateById(id);
    if (!record) return;
    const newPageId = crypto.randomUUID();
    const newPage = { ...record.data.page, id: newPageId, name: record.name };
    const { items: cloned } = cloneItemsForInsertion(record.data.items, newPageId);
    // Guides get fresh IDs and follow the new page (spec §72) — set BEFORE
    // commitBoth so the same history entry captures both (see commitBoth's
    // own comment on this pattern).
    const clonedGuides = cloneGuidesForPage(record.data.guides, newPageId);
    guidesRef.current = [...guidesRef.current, ...clonedGuides];
    setGuides(guidesRef.current);
    commitBoth([...items, ...cloned], [...pages, newPage], {
      type: "insert-page",
      label: `Insert page "${record.name}"`,
      itemIds: cloned.map((it) => it.id),
      pageIds: [newPageId],
    });
    activatePage(newPageId);
    await recordTemplateUsed(id);
    setIsTemplateBrowserOpen(false);
  }

  async function handleDeleteReusablePage(id) {
    const target = reusablePages.find((t) => t.id === id);
    if (!window.confirm(`Delete "${target?.name || "this page"}"? This cannot be undone.`)) return;
    await deleteTemplate(id);
    refreshTemplateLists();
  }

  // Loads a snapshot's data the same validated way loadWorkspaceState()
  // loads a normal save (spec §9/§12) — shared normalizeParsedWorkspace
  // pipeline, not a second ad hoc one.
  // Applies an already-`normalizeParsedWorkspace`'d data object as the
  // live document — shared by recovery restore, project import, and
  // version restore, so the exact same "replace everything, fresh
  // history, mark unsaved" sequence can't drift apart between them.
  function loadWorkspaceDataIntoEditor(normalized) {
    setPages(normalized.pages);
    pagesRef.current = normalized.pages;
    setItems(normalized.items);
    itemsRef.current = normalized.items;
    setActivePageId(normalized.activePageId);
    activePageIdRef.current = normalized.activePageId;
    setScale(normalized.scale);
    scaleRef.current = normalized.scale;
    setGuides(normalized.guides);
    guidesRef.current = normalized.guides;
    setSnapToGuides(normalized.snapToGuides);
    snapToGuidesRef.current = normalized.snapToGuides;
    if (isSupportedUnit(normalized.preferredUnit)) {
      setPreferredUnit(normalized.preferredUnit);
      preferredUnitRef.current = normalized.preferredUnit;
    }
    setHasManualZoomOrPan(true);
    const freshHistory = createHistory(normalized.items, normalized.pages, normalized.guides);
    historyStateRef.current = freshHistory;
    setHistoryState(freshHistory);
    setSelectedIds([]);
    setEnteredGroupId(null);
  }

  async function handleRecoverLatest(snapshot) {
    if (!isSnapshotShapeValid(snapshot)) {
      setRecoveryOffer(null);
      setStatus("That recovery snapshot could not be validated and was skipped.");
      window.setTimeout(() => setStatus(""), 3000);
      return;
    }
    const normalized = normalizeParsedWorkspace(snapshot.data);
    if (!normalized) {
      setRecoveryOffer(null);
      setStatus("That recovery snapshot could not be loaded.");
      window.setTimeout(() => setStatus(""), 3000);
      return;
    }

    // Protect the pre-recovery state before touching anything (spec §12
    // step 4) — a manual/protected snapshot, exempt from auto-pruning.
    await createRecoverySnapshotNow("manual-safety", true);

    loadWorkspaceDataIntoEditor(normalized);

    // Marks Unsaved and drives a normal save through the existing Phase 7B
    // service (spec §12 steps 9-10) — never a direct storage write here.
    autosaveRef.current.markDirty();
    autosaveRef.current.saveNow();
    const saveResult = autosaveRef.current.getStatus();
    if (saveResult.status === SAVE_STATUS.SAVED) {
      // Only removed once represented in a successful normal save.
      await deleteSnapshot(snapshot.id);
      setStatus("Recovered work saved.");
    } else {
      setStatus("Recovered — but saving failed. Your recovery snapshot is kept safe.");
    }
    window.setTimeout(() => setStatus(""), 3000);
    setRecoveryOffer(null);
    refreshRecoverySnapshotList();
  }

  // Keeps the already-loaded saved (or .backup) version on screen — the
  // recovery snapshot is left alone, not destroyed (spec §13).
  function handleOpenSavedVersion() {
    setRecoveryOffer(null);
  }

  async function handleDeleteRecoveryOffer() {
    if (recoveryOffer?.snapshot?.id) await deleteSnapshot(recoveryOffer.snapshot.id);
    setRecoveryOffer(null);
  }

  // --- Recovery Center (File menu) ---

  function openRecoveryCenter() {
    refreshRecoverySnapshotList();
    setIsRecoveryCenterOpen(true);
  }

  async function handleRestoreFromCenter(id) {
    const snapshot = await getSnapshotById(id);
    if (!snapshot) return;
    if (!window.confirm("Restore this recovery snapshot? Your current unsaved changes will be backed up first.")) return;
    setIsRecoveryCenterOpen(false);
    await handleRecoverLatest(snapshot);
  }

  async function handleDeleteFromCenter(id) {
    if (!window.confirm("Delete this recovery snapshot? This cannot be undone.")) return;
    await deleteSnapshot(id);
    refreshRecoverySnapshotList();
  }

  async function handleDeleteAllUnprotectedFromCenter() {
    if (!window.confirm("Delete all unprotected recovery snapshots? Protected snapshots are kept.")) return;
    const summaries = await listSnapshotSummaries();
    for (const summary of summaries) {
      if (!summary.protected) await deleteSnapshot(summary.id);
    }
    refreshRecoverySnapshotList();
  }

  async function handleCreateManualSnapshotFromCenter() {
    await createRecoverySnapshotNow("manual-safety", true);
    refreshRecoverySnapshotList();
  }

  // --- Phase 7D: editable project file export ---

  async function exportProject() {
    if (editingTextIdRef.current) exitTextEdit(); // commit any active compatible edit (spec §6)
    autosaveRef.current.flush();
    await createRecoverySnapshotNow("manual-safety", true); // export prep can't alter state here, but cheap insurance

    const data = buildCurrentProjectData();
    const { missingAssetIds } = await analyzeExportAssets(data.items);
    if (missingAssetIds.length > 0) {
      const proceed = window.confirm(
        `${missingAssetIds.length} referenced image(s) are missing locally and would be exported as placeholders. Export anyway?`
      );
      if (!proceed) return;
    }

    setExportError(null);
    setExportDialogStage("preparing");
    const result = await exportProjectPackage({
      data,
      projectName,
      workspaceId: getWorkspaceId(),
      onProgress: (stage) => setExportDialogStage(stage),
    });
    if (!result.ok) {
      setExportError(result.errors?.join(" ") || "Export failed.");
      setExportDialogStage("error");
      return;
    }
    downloadBlob(result.blob, result.filename);
    setExportDialogStage("done");
    // The open project is left completely unchanged (spec §6 step 13) —
    // nothing above touched items/pages/history.
  }

  // --- Phase 7D: editable project file import ---

  const importInspectionRef = useRef(null);

  function openImportDialog() {
    setImportStage("idle");
    setImportError(null);
    setImportPreview(null);
    importInspectionRef.current = null;
    setIsImportDialogOpen(true);
  }

  function closeImportDialog() {
    setIsImportDialogOpen(false);
    importInspectionRef.current = null;
  }

  async function handleImportFileSelected(file) {
    setImportStage("inspecting");
    setImportError(null);
    const inspection = await inspectProjectPackage(file);
    if (!inspection.ok) {
      setImportError(inspection.message);
      setImportStage("error");
      return;
    }
    importInspectionRef.current = inspection;
    setImportPreview({
      projectName: inspection.manifest.projectName || "Untitled Project",
      pageCount: inspection.manifest.pageCount ?? inspection.projectJson.pages.length,
      objectCount: inspection.manifest.objectCount ?? inspection.projectJson.items.length,
      assetCount: inspection.manifest.assetCount ?? 0,
      fileSize: inspection.fileSize,
      exportedAt: inspection.manifest.exportedAt,
      migrationRequired: inspection.migrationRequired,
      missingAssetCount: (inspection.manifest.missingAssetIds || []).length,
      warnings: [],
    });
    setImportStage("preview");
  }

  async function finalizeImport(replacing) {
    const inspection = importInspectionRef.current;
    if (!inspection) return;

    const confirmed = window.confirm(
      replacing
        ? "Replace the current project with this imported one? Your current work will be backed up to Recovery first."
        : "Open this imported project? Your current work will be backed up to Recovery first."
    );
    if (!confirmed) return;

    setImportStage("importing");
    setImportProgress(null);

    const { errors, data: normalized } = validateAndRepairImportedProject(inspection.projectJson, normalizeParsedWorkspace);
    if (errors.length) {
      setImportError(errors.join(" "));
      setImportStage("error");
      return;
    }

    // Protect the outgoing state before touching anything (spec §21/§37) —
    // flush + protected recovery snapshot, same pattern recovery
    // restoration uses, plus an automatic milestone version (spec §6).
    autosaveRef.current.flush();
    await createRecoverySnapshotNow("before-replacement", true);
    await createAutoMilestone(replacing ? "before-replacement" : "before-import");

    let assetResult;
    try {
      assetResult = await importPackageAssets(inspection.zip, inspection.manifest, {
        onProgress: (current, total) => setImportProgress({ current, total }),
      });
    } catch (err) {
      setImportError(`Importing assets failed: ${err?.message || "storage error"}.`);
      setImportStage("error");
      return; // current project untouched — nothing was applied yet
    }

    const finalItems = applyAssetRemap(normalized.items, assetResult.remap);

    if (!replacing) resetWorkspaceId();

    loadWorkspaceDataIntoEditor({ ...normalized, items: finalItems });
    setProjectName(inspection.manifest.projectName || "Imported Project");

    autosaveRef.current.markDirty();
    autosaveRef.current.saveNow();
    const saveResult = autosaveRef.current.getStatus();

    setImportStage("done");
    setIsImportDialogOpen(false);
    importInspectionRef.current = null;
    const missingNote = assetResult.missingAssetIds.length + assetResult.corruptedAssetIds.length;
    setStatus(
      saveResult.status === SAVE_STATUS.SAVED
        ? `Project imported and saved.${missingNote ? ` ${missingNote} image(s) are missing and show as placeholders.` : ""}`
        : "Project imported, but saving failed. Your previous project is safely backed up in Recovery."
    );
    window.setTimeout(() => setStatus(""), 4500);
  }

  // Periodic snapshots — only while dirty, only at a safe (idle, not
  // typing/cropping) moment (spec §5).
  useEffect(() => {
    const interval = setInterval(() => {
      const autosaveStatus = autosaveRef.current.getStatus();
      if (!autosaveStatus.dirty) return;
      if (interactionModeRef.current !== "idle") return;
      if (editingTextIdRef.current) return;
      if (croppingItemIdRef.current) return;
      if (imageFillEditItemIdRef.current) return;
      createRecoverySnapshotNow("periodic-dirty");
    }, PERIODIC_SNAPSHOT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Snapshot after a configured number of committed history actions while
  // dirty (spec §5) — counts committed transactions, not renders.
  const isFirstCommitCounterRunRef = useRef(true);
  useEffect(() => {
    if (isFirstCommitCounterRunRef.current) {
      isFirstCommitCounterRunRef.current = false;
      return;
    }
    snapshotCommitCounterRef.current += 1;
    if (autosaveRef.current.getStatus().dirty && snapshotCommitCounterRef.current >= COMMIT_SNAPSHOT_THRESHOLD) {
      snapshotCommitCounterRef.current = 0;
      createRecoverySnapshotNow("periodic-dirty");
    }
  }, [historyState]);

  // Startup comparison (spec §10) — runs once, before the session-marker
  // effect below overwrites the marker this reads via wasPriorSessionUnclean.
  useEffect(() => {
    if (editorMode !== "workspace") return undefined;
    let cancelled = false;
    async function runStartupRecoveryCheck() {
      if (consumeForceRecoveryFlag()) {
        // Set by the top-level error screen's "Recover unsaved work" —
        // skip the dialog and recover immediately on this boot.
        const snapshot = await getNewestValidSnapshot();
        if (!cancelled && snapshot) await handleRecoverLatest(snapshot);
        return;
      }
      if (consumeSkipRecoveryFlag()) return; // set by "Open last saved version" from the error screen
      const priorUnclean = wasPriorSessionUnclean();
      const snapshot = await getNewestValidSnapshot();
      if (cancelled || !snapshot) return;

      const savedUpdatedAt = initialWorkspace.sourceUpdatedAt || 0;
      const savedRevision = initialWorkspace.sourceRevision;
      const snapshotTimestamp = snapshot.projectUpdatedAt || snapshot.createdAt;
      // Avoids the "identical/older/only-viewport-differs" cases from
      // spec §10: requires the snapshot to be newer AND not already
      // represented by an equal-or-higher saved revision.
      const worthOffering =
        snapshotTimestamp > savedUpdatedAt && (savedRevision == null || snapshot.baseRevision == null || snapshot.baseRevision >= savedRevision);
      if (!worthOffering) return;

      setRecoveryOffer({ snapshot, reason: priorUnclean ? "unclean-session" : snapshot.reason });
    }
    runStartupRecoveryCheck();
    return () => {
      cancelled = true;
    };
    // Runs once at mount, like the other load-time checks (see the legacy-
    // asset migration effect above) — handleRecoverLatest only reads refs
    // and stable setters, so it's safe to call from this one-time effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Session-open/heartbeat/clean-close marker (spec §8) — supporting
  // evidence only, read by the effect above BEFORE this one overwrites it.
  useEffect(() => {
    // The session-open/heartbeat/clean-close marker is global (one key,
    // not per-workspace) and exists purely to support the workspace
    // recovery-offer heuristic above — running it from a template-editor
    // mount would incorrectly mark the NORMAL workspace's next session as
    // following an "unclean" close.
    if (editorMode !== "workspace") return undefined;
    const sessionId = markSessionOpen();
    sessionIdRef.current = sessionId;
    const heartbeatTimer = setInterval(() => heartbeatSession(sessionId), HEARTBEAT_INTERVAL);
    function handleUnload() {
      markSessionClosed(sessionId);
    }
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      clearInterval(heartbeatTimer);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);

  // Dev-only diagnostics (spec §15/Phase 7A) — inspect via
  // `window.__historyDebug()` in the browser console. Never included in a
  // production build (import.meta.env.DEV is compiled out by Vite).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__historyDebug = () => ({
      undoCount: historyState.index,
      redoCount: historyState.history.length - 1 - historyState.index,
      activeTransaction: editingTextId ? "text-edit" : croppingItemId ? "crop" : imageFillEditItemId ? "image-fill" : null,
      lastCommitted: historyState.history[historyState.index]?.meta ?? null,
      historyLimit: HISTORY_LIMIT,
      approxSizeBytes: (() => {
        try {
          return JSON.stringify(historyState.history).length;
        } catch {
          return null;
        }
      })(),
    });
    return () => {
      delete window.__historyDebug;
    };
  }, [historyState, editingTextId, croppingItemId, imageFillEditItemId]);

  const pageItems = useMemo(
    () => items.filter((item) => item.pageId === activePageId),
    [items, activePageId]
  );
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds]
  );
  const hasGroupedSelection = selectedItems.some((item) => item.type === "group");
  const itemsById = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);

  // Phase 12 — while the Timeline is open (scrubbing) or page preview is
  // actively playing, the CANVAS renders the ANIMATED frame at
  // previewTimeMs instead of the raw durable items (spec §8: "derive the
  // animated visual state from durable base geometry" — `items` itself is
  // never touched). Only the render loop below substitutes this; every
  // other consumer of `items`/`itemsById` (selection, properties panel,
  // layers, etc.) keeps reading the real, un-animated data.
  const showAnimatedFrame = timelineOpen || isPreviewPlaying;
  const displayItems = useMemo(
    () => (showAnimatedFrame ? computeAnimatedItems(items, activePageId, previewTimeMs, { reducedMotion }) : items),
    [items, activePageId, previewTimeMs, showAnimatedFrame, reducedMotion]
  );
  const displayPageItems = useMemo(() => displayItems.filter((item) => item.pageId === activePageId), [displayItems, activePageId]);
  const displayItemsById = useMemo(() => new Map(displayItems.map((it) => [it.id, it])), [displayItems]);
  const isSelectionLocked =
    selectedItems.length > 0 && selectedItems.every((item) => isEffectivelyLocked(item, itemsById));
  const selectedBoundsContent = useMemo(() => {
    if (selectedItems.length === 0) return null;
    return unionBounds(selectedItems.map(getItemBounds));
  }, [selectedItems]);

  // Stable — safe to call from the useCallback([])-wrapped drag handlers
  // below without stale closures. Accepts either a concrete next-items
  // array OR an updater function `(prevItems) => nextItems` — the updater
  // form is what lets a caller (e.g. commitEditingText) commit "whatever
  // the current pending state is". Resolved against itemsRef.current
  // (NOT the render-scope `items` closure, and NOT via a nested setState
  // updater) so it's correct even when called synchronously right after a
  // non-committing update in the same tick (e.g. paste: live-update then
  // immediately flush, no render in between) — itemsRef.current is kept
  // synchronously current by every items-touching call below, not just by
  // the per-render mirror at the top of the component.
  //
  // History snapshots capture {items, pages} together (see historyState
  // init above) so page actions are undoable too; commit() only ever
  // *changes* items, but still snapshots the CURRENT pages (via pagesRef)
  // alongside it so an interleaved undo stream stays consistent.
  //
  // historyStateRef is likewise updated synchronously (not just per-render)
  // so a flush-then-undo happening in the same tick — Cmd+Z while still
  // inside an active text edit, see undo()/redo() and useKeyboardShortcuts
  // — sees the entry this commit just pushed rather than a stale index.
  //
  // `meta` describes the action for the history entry (type/label/affected
  // ids — see history.js's pushHistoryEntry) — every call site below passes
  // one; a same-shaped default is only a safety net, not meant to be relied
  // on. pushHistoryEntry itself no-ops (returns prevHistory unchanged) when
  // resolvedItems/resolvedPages are equivalent to the current top entry, so
  // callers don't need their own "did anything actually change" checks.
  const commit = useCallback((nextItemsOrUpdater, meta = { type: "edit", label: "Edit" }) => {
    const resolvedItems =
      typeof nextItemsOrUpdater === "function" ? nextItemsOrUpdater(itemsRef.current) : nextItemsOrUpdater;
    itemsRef.current = resolvedItems;
    setItems(resolvedItems);
    const nextHistory = pushHistoryEntry(historyStateRef.current, resolvedItems, pagesRef.current, meta, guidesRef.current);
    historyStateRef.current = nextHistory;
    setHistoryState(nextHistory);
  }, []);

  // Sibling to commit() for actions that change `pages` (add/duplicate/
  // delete/reorder/resize/rename/background/precision settings) — same
  // shape, snapshots the current items alongside the new pages value.
  const commitPages = useCallback((nextPagesOrUpdater, meta = { type: "edit", label: "Edit" }) => {
    const resolvedPages =
      typeof nextPagesOrUpdater === "function" ? nextPagesOrUpdater(pagesRef.current) : nextPagesOrUpdater;
    pagesRef.current = resolvedPages;
    setPages(resolvedPages);
    const nextHistory = pushHistoryEntry(historyStateRef.current, itemsRef.current, resolvedPages, meta, guidesRef.current);
    historyStateRef.current = nextHistory;
    setHistoryState(nextHistory);
  }, []);

  // For actions that change BOTH items and pages as one atomic undo step
  // (e.g. deleting a page also deletes its items). Callers that also need
  // to change guides in the SAME undo step (e.g. inserting a reusable page
  // that carries its own guides) set guidesRef.current/setGuides BEFORE
  // calling this — pushHistoryEntry below always snapshots whatever
  // guidesRef.current holds at call time.
  const commitBoth = useCallback((nextItems, nextPages, meta = { type: "edit", label: "Edit" }) => {
    const nextHistory = pushHistoryEntry(historyStateRef.current, nextItems, nextPages, meta, guidesRef.current);
    historyStateRef.current = nextHistory;
    setHistoryState(nextHistory);
    itemsRef.current = nextItems;
    setItems(nextItems);
    pagesRef.current = nextPages;
    setPages(nextPages);
  }, []);

  // Phase 10 — the guide-equivalent of commit()/commitPages(): one
  // history transaction per committed guide change (add/move/delete/lock/
  // color/label — spec §76), items/pages carried forward unchanged.
  const commitGuides = useCallback((nextGuidesOrUpdater, meta = { type: "edit-guide", label: "Edit guide" }) => {
    const resolvedGuides =
      typeof nextGuidesOrUpdater === "function" ? nextGuidesOrUpdater(guidesRef.current) : nextGuidesOrUpdater;
    guidesRef.current = resolvedGuides;
    setGuides(resolvedGuides);
    const nextHistory = pushHistoryEntry(historyStateRef.current, itemsRef.current, pagesRef.current, meta, resolvedGuides);
    historyStateRef.current = nextHistory;
    setHistoryState(nextHistory);
  }, []);

  function updateItem(id, changes, commitChange = true, meta = { type: "edit-property", label: "Edit object", itemIds: [id] }) {
    if (commitChange) {
      const next = itemsRef.current.map((item) => (item.id === id ? { ...item, ...changes, updatedAt: Date.now() } : item));
      commit(next, meta);
    } else {
      // Resolved against itemsRef.current (see commit() above) — typing
      // fires several non-committing updates per second, and each must
      // see the previous one's result, including within the same tick
      // (paste/format/list-toggle all live-update then immediately flush
      // with no render in between).
      const next = itemsRef.current.map((item) => (item.id === id ? { ...item, ...changes, updatedAt: Date.now() } : item));
      itemsRef.current = next;
      setItems(next);
    }
  }

  // Batched sibling to updateItem — edits every id in one pass and commits
  // exactly one history entry, so a mixed-selection field edit (see
  // MultiSelectPropertiesBar) doesn't push N undo entries for one action.
  function updateItems(ids, changes, meta) {
    const idSet = new Set(ids);
    const now = Date.now();
    const next = items.map((item) => (idSet.has(item.id) ? { ...item, ...changes, updatedAt: now } : item));
    commit(next, meta || { type: "edit-property", label: ids.length > 1 ? `Edit ${ids.length} objects` : "Edit object", itemIds: ids });
  }

  // --- Phase 12: animation CRUD (spec §17/§18/§55 — one history
  // transaction per commit, never per preview/playback frame). All reuse
  // the existing updateItem()/commit() machinery rather than a parallel
  // history path — see animationService.js for the pure item-editing
  // helpers these just wrap. ---

  function applyAnimation(itemId, stage, presetId, overrides = {}) {
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item) return;
    const updated = applyAnimationToItem(item, { stage, presetId, pageId: item.pageId, overrides });
    updateItem(itemId, { animations: updated.animations }, true, {
      type: "apply-animation",
      label: `Apply ${stage} animation`,
      itemIds: [itemId],
    });
  }

  // Applies the same preset to every id in `itemIds`, optionally staggering
  // each object's startTime (spec §20/§21) — one grouped history entry.
  function applyAnimationToSelection(itemIds, stage, presetId, { overrides = {}, staggerDelayMs = 0, reverseOrder = false } = {}) {
    if (itemIds.length === 0) return;
    const startTimes = staggerDelayMs > 0 ? computeStaggerStartTimes(itemIds, { baseStartTime: overrides.startTime || 0, staggerDelayMs, reverseOrder }) : null;
    const idSet = new Set(itemIds);
    const now = Date.now();
    const next = itemsRef.current.map((item) => {
      if (!idSet.has(item.id)) return item;
      const perItemOverrides = startTimes ? { ...overrides, startTime: startTimes.get(item.id) } : overrides;
      const updated = applyAnimationToItem(item, { stage, presetId, pageId: item.pageId, overrides: perItemOverrides });
      return { ...updated, updatedAt: now };
    });
    commit(next, { type: "apply-animation-sequence", label: `Apply animation to ${itemIds.length} objects`, itemIds });
  }

  function removeAnimation(itemId, animationId) {
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item) return;
    updateItem(itemId, { animations: removeAnimationById(item, animationId).animations }, true, {
      type: "remove-animation",
      label: "Remove animation",
      itemIds: [itemId],
    });
  }

  function removeAnimationStage(itemId, stage) {
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item) return;
    updateItem(itemId, { animations: removeStageAnimations(item, stage).animations }, true, {
      type: "remove-animation",
      label: `Remove ${stage} animation`,
      itemIds: [itemId],
    });
  }

  function removeAllItemAnimations(itemId) {
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item) return;
    const updated = removeAllAnimations(item);
    updateItem(itemId, { animations: updated.animations, motionPath: undefined }, true, {
      type: "remove-animation",
      label: "Remove all animations",
      itemIds: [itemId],
    });
  }

  // Bulk removal — spec §18: shows affected count in the UI (AnimationPanel),
  // is undoable, preserves the visual base state (removing an animation
  // never touches x/y/width/height/rotation/opacity themselves).
  function removeAllAnimationsFromSelection(itemIds) {
    const idSet = new Set(itemIds);
    const now = Date.now();
    const next = itemsRef.current.map((item) => (idSet.has(item.id) ? { ...removeAllAnimations(item), updatedAt: now } : item));
    commit(next, { type: "remove-animation", label: `Remove animations from ${itemIds.length} objects`, itemIds });
  }

  function removeAllAnimationsFromPage(pageId) {
    const affected = itemsRef.current.filter((it) => it.pageId === pageId && (it.animations?.length || it.motionPath));
    if (affected.length === 0) return;
    const now = Date.now();
    const next = itemsRef.current.map((item) => (item.pageId === pageId ? { ...removeAllAnimations(item), updatedAt: now } : item));
    commit(next, { type: "remove-animation", label: "Remove all animations on page", pageIds: [pageId], itemIds: affected.map((i) => i.id) });
  }

  function updateAnimationTiming(itemId, animationId, changes) {
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item) return;
    updateItem(itemId, { animations: updateAnimation(item, animationId, changes).animations }, true, {
      type: "edit-animation-timing",
      label: "Edit animation timing",
      itemIds: [itemId],
    });
  }

  function setItemMotionPath(itemId, motionPath) {
    updateItem(itemId, { motionPath }, true, { type: "edit-motion-path", label: "Edit motion path", itemIds: [itemId] });
  }

  function removeItemMotionPath(itemId) {
    updateItem(itemId, { motionPath: undefined }, true, { type: "edit-motion-path", label: "Remove motion path", itemIds: [itemId] });
  }

  function setPageDuration(pageId, durationMs) {
    commitPages(pagesRef.current.map((p) => (p.id === pageId ? { ...p, duration: clampPageDuration(durationMs) } : p)), {
      type: "page-duration",
      label: "Change page duration",
      pageIds: [pageId],
    });
  }

  // spec §31 — extends (never silently shortens) the page to fit its
  // latest animation end time.
  function fitPageDurationToContent(pageId) {
    const latest = latestAnimationEndTime(itemsRef.current, pageId);
    if (latest <= 0) return;
    setPageDuration(pageId, Math.max(latest, DEFAULT_PAGE_DURATION_MS));
  }

  function applyDurationToAllPages(durationMs) {
    const clamped = clampPageDuration(durationMs);
    commitPages(pagesRef.current.map((p) => ({ ...p, duration: clamped })), {
      type: "page-duration",
      label: "Apply duration to all pages",
      pageIds: pagesRef.current.map((p) => p.id),
    });
  }

  function setPageTransition(pageId, transitionChanges) {
    const page = pagesRef.current.find((p) => p.id === pageId);
    const next = clampTransition({ ...(page?.transition || defaultTransition()), ...transitionChanges });
    commitPages(pagesRef.current.map((p) => (p.id === pageId ? { ...p, transition: next } : p)), {
      type: "page-transition",
      label: "Change page transition",
      pageIds: [pageId],
    });
  }

  function applyTransitionToAllPages(transitionChanges) {
    const next = clampTransition({ ...defaultTransition(), ...transitionChanges });
    commitPages(pagesRef.current.map((p) => ({ ...p, transition: next })), {
      type: "page-transition",
      label: "Apply transition to all pages",
      pageIds: pagesRef.current.map((p) => p.id),
    });
  }

  function updatePresentationSettings(changes) {
    setPresentationSettings((prev) => clampPresentationSettings({ ...prev, ...changes }));
  }

  // --- Phase 12: editor preview playback (spec §46/§56 — runtime-only,
  // never committed/autosaved) ---

  function playPagePreview() {
    previewEngineRef.current.setDuration(activePage?.duration || DEFAULT_PAGE_DURATION_MS);
    previewEngineRef.current.play();
    setIsPreviewPlaying(true);
  }
  function pausePagePreview() {
    previewEngineRef.current.pause();
    setIsPreviewPlaying(false);
  }
  function stopPagePreview() {
    previewEngineRef.current.stop();
    setIsPreviewPlaying(false);
    setPreviewTimeMs(0);
  }
  function seekPagePreview(ms) {
    previewEngineRef.current.seek(ms);
    setPreviewTimeMs(ms);
  }

  // Bulk flip toggles each selected item's OWN current flip state (unlike
  // updateItems, which would set every item to the same shared value) —
  // one commit for the whole multi-selection (spec §51).
  function bulkFlipSelection(ids, axis) {
    const idSet = new Set(ids);
    const field = axis === "x" ? "flipX" : "flipY";
    const now = Date.now();
    const next = items.map((item) => (idSet.has(item.id) ? { ...item, [field]: !item[field], updatedAt: now } : item));
    commit(next, { type: "flip", label: ids.length > 1 ? `Flip ${ids.length} objects` : "Flip object", itemIds: ids });
  }

  function addItem(partial, label) {
    const now = Date.now();
    const newId = crypto.randomUUID();
    const next = [
      ...items,
      {
        id: newId,
        pageId: activePageId,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        createdAt: now,
        updatedAt: now,
        ...partial,
      },
    ];
    const typeLabel = partial.type ? partial.type[0].toUpperCase() + partial.type.slice(1) : "object";
    commit(next, { type: "add-object", label: label || `Add ${typeLabel}`, itemIds: [newId], pageIds: [activePageId] });
    setSelectedIds([newId]);
  }

  function addText(presetKey = "heading") {
    const preset = getPresetByKey(presetKey) || getPresetByKey("heading");
    addItem({
      type: "text",
      ...getDefaultProps("text"),
      ...centerPositionFor(preset.width, preset.height),
      text: preset.text,
      width: preset.width,
      height: preset.height,
      fontSize: preset.fontSize,
      fontWeight: preset.fontWeight,
      italic: !!preset.italic,
      align: preset.align,
      lineHeight: preset.lineHeight,
      letterSpacing: preset.letterSpacing,
      textTransform: preset.textTransform || "none",
      autoSize: preset.autoSize,
      fontFamily: "Arial",
      fill: "#111827",
    }, "Add text");
  }

  // Center placement on the active page (not screen coordinates) — correct
  // regardless of current scroll/pan position, satisfying "if the active
  // page is outside the viewport, place the object in the page center."
  function centerPositionFor(width, height) {
    return { x: activePage.width / 2 - width / 2, y: activePage.height / 2 - height / 2 };
  }

  function addShape(shapeKind = "rectangle") {
    const width = 200;
    const height = 200;
    addItem(
      {
        type: "shape",
        ...centerPositionFor(width, height),
        width,
        height,
        ...getDefaultProps("shape", shapeKind),
      },
      `Add ${shapeKind}`
    );
  }

  function addLine(lineKind = "straight") {
    const width = 260;
    addItem(
      {
        type: "line",
        ...centerPositionFor(width, 0),
        width,
        ...getDefaultProps("line", lineKind),
      },
      `Add ${lineKind} line`
    );
  }

  function addIcon(iconName) {
    const width = 80;
    const height = 80;
    addItem(
      {
        type: "icon",
        ...centerPositionFor(width, height),
        width,
        height,
        ...getDefaultProps("icon", iconName),
      },
      "Add icon"
    );
  }

  function addFrame(frameKind = "rectangle") {
    const width = 240;
    const height = 240;
    addItem(
      {
        type: "frame",
        ...centerPositionFor(width, height),
        width,
        height,
        ...getDefaultProps("frame", frameKind),
      },
      "Add frame"
    );
  }

  // Adds an already-uploaded asset to the active page — used by clicking/
  // dragging an Uploads panel thumbnail, dropping a file, and pasting.
  // `centerPosition` (if given) is the point the image's CENTER should
  // land on (a drop/paste point); omitted, it defaults to the page center.
  // Aspect ratio is always preserved and the box is scaled down if the
  // asset is larger than a reasonable fraction of the page, per spec §8.
  async function addImageItem(assetId, centerPosition) {
    const meta = await getAssetMeta(assetId);
    const naturalWidth = meta?.width || 350;
    const naturalHeight = meta?.height || 260;
    const maxWidth = Math.min(activePageRef.current.width * 0.8, 480);
    const maxHeight = Math.min(activePageRef.current.height * 0.8, 480);
    const shrink = Math.min(1, maxWidth / naturalWidth, maxHeight / naturalHeight);
    const width = naturalWidth * shrink;
    const height = naturalHeight * shrink;
    const center = centerPosition || {
      x: activePageRef.current.width / 2,
      y: activePageRef.current.height / 2,
    };
    const now = Date.now();
    const newItem = {
      id: crypto.randomUUID(),
      type: "image",
      pageId: activePageId,
      parentId: null,
      ...getDefaultProps("image"),
      assetId,
      naturalWidth,
      naturalHeight,
      x: center.x - width / 2,
      y: center.y - height / 2,
      width,
      height,
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      createdAt: now,
      updatedAt: now,
    };
    commit((prev) => [...prev, newItem], { type: "add-object", label: "Add image", itemIds: [newItem.id], pageIds: [activePageId] });
    setSelectedIds([newItem.id]);
  }

  // Sets (or replaces) a frame's content in one call — used by dragging an
  // upload onto an empty/filled frame, clicking an image while an empty
  // frame is selected, or the frame's Add/Replace image button. Always
  // resets to a centered Fill crop (spec §21/§13's recommended behavior),
  // and preserves the frame's own position/size/rotation/group membership.
  function setFrameContent(frameId, assetId, meta) {
    updateItem(
      frameId,
      {
        contentAssetId: assetId,
        naturalWidth: meta?.width || null,
        naturalHeight: meta?.height || null,
        crop: { ...DEFAULT_CROP },
      },
      true,
      { type: "replace-frame-content", label: "Replace frame image", itemIds: [frameId] }
    );
    setSelectedIds([frameId]);
  }

  function removeFrameContent(frameId) {
    updateItem(
      frameId,
      { contentAssetId: null, crop: { ...DEFAULT_CROP } },
      true,
      { type: "remove-frame-content", label: "Remove frame image", itemIds: [frameId] }
    );
  }

  // Creates a standalone image object carrying the frame's current visible
  // crop/adjustments/flip forward, at the frame's own bounds, then empties
  // the frame back to a placeholder — the frame is preserved, not removed.
  function extractFrameContent(frameId) {
    const frame = itemsRef.current.find((it) => it.id === frameId);
    if (!frame?.contentAssetId) return;
    const now = Date.now();
    const newImage = {
      id: crypto.randomUUID(),
      type: "image",
      pageId: frame.pageId,
      parentId: frame.parentId,
      ...getDefaultProps("image"),
      assetId: frame.contentAssetId,
      naturalWidth: frame.naturalWidth,
      naturalHeight: frame.naturalHeight,
      crop: { ...normalizeCrop(frame.crop) },
      adjustments: { ...normalizeAdjustments(frame.adjustments) },
      flipX: frame.flipX,
      flipY: frame.flipY,
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      rotation: frame.rotation,
      opacity: frame.opacity,
      locked: false,
      hidden: false,
      createdAt: now,
      updatedAt: now,
    };
    commit(
      (prev) => [
        ...prev.map((it) => (it.id === frameId ? { ...it, contentAssetId: null, crop: { ...DEFAULT_CROP } } : it)),
        newImage,
      ],
      { type: "extract-frame-content", label: "Extract frame image", itemIds: [frameId, newImage.id] }
    );
    setSelectedIds([newImage.id]);
  }

  // Double-click model (Phase 5 decision 6): drills one level deeper into
  // a group hierarchy per click, choosing the immediate child on the path
  // to the clicked leaf; once there's no more group between the current
  // entry level and the leaf, falls back to type-specific behavior
  // (starting inline text edit — the only Phase 4 double-click meaning).
  function handleItemDblClick(itemId, clientX, clientY) {
    const chain = getAncestorChain(items, itemId); // [itemId, parent, ..., topmost]
    const enteredIdx = enteredGroupId ? chain.indexOf(enteredGroupId) : -1;

    if (enteredIdx > 0) {
      const nextLevelId = chain[enteredIdx - 1];
      const nextItem = items.find((it) => it.id === nextLevelId);
      if (nextItem?.type === "group") {
        setEnteredGroupId(nextLevelId);
        setSelectedIds([itemId]);
        return;
      }
    } else if (enteredIdx === -1 && chain.length > 1) {
      const topGroupId = chain[chain.length - 1];
      const topItem = items.find((it) => it.id === topGroupId);
      if (topItem?.type === "group") {
        setEnteredGroupId(topGroupId);
        setSelectedIds([itemId]);
        return;
      }
    }

    const item = items.find((it) => it.id === itemId);
    if (item?.type === "text" && !isEffectivelyLocked(item, itemsById)) enterTextEdit(itemId, clientX, clientY);
    else if (item?.type === "image" && !isEffectivelyLocked(item, itemsById)) enterCropMode(itemId);
    else if (item?.type === "frame" && item.contentAssetId && !isEffectivelyLocked(item, itemsById)) enterCropMode(itemId);
  }

  // --- Inline text editing (Phase 4) ---

  function enterTextEdit(itemId, clientX, clientY) {
    const item = itemsRef.current.find((it) => it.id === itemId);
    // Built fresh from itemsRef rather than closing over the render-scoped
    // itemsById memo: this is also called from the Enter-key shortcut
    // effect below, whose handler is captured once at mount (empty deps)
    // and would otherwise walk a permanently stale ancestor map.
    if (!item || isEffectivelyLocked(item, new Map(itemsRef.current.map((it) => [it.id, it])))) return;
    setSelectedIds([itemId]);
    pendingCaretPointRef.current = clientX != null ? { x: clientX, y: clientY } : null;
    setEditingTextId(itemId);
  }

  function exitTextEdit() {
    if (!editingTextId) return;
    overlayRef.current?.flush();
    setEditingTextId(null);
  }

  function updateEditingTextLive(richText) {
    updateItem(editingTextId, { richText, text: plainTextOf(richText) }, false);
  }

  function commitEditingText() {
    // Updater form (see commit() above) — guarantees this reads whatever
    // richText the immediately-preceding updateEditingTextLive() call just
    // queued, even called synchronously right after it in the same tick.
    commit((prevItems) => prevItems, { type: "text-edit", label: "Edit text", itemIds: editingTextIdRef.current ? [editingTextIdRef.current] : [] });
  }

  // Lets TextEditOverlay's own drag-margin frame reposition the object
  // without leaving edit mode — same non-committing-live-update-then-one-
  // commit-on-release shape as updateEditingTextLive/commitEditingText
  // above (and liveCropChange/commitCropGesture for crop mode).
  function moveEditingTextLive(x, y) {
    updateItem(editingTextId, { x, y }, false);
  }

  function commitEditingTextMove() {
    commit((prevItems) => prevItems, { type: "move", label: "Move object", itemIds: editingTextIdRef.current ? [editingTextIdRef.current] : [] });
  }

  // --- Crop mode (Phase 6) — parallel in shape to inline text editing
  // above: entry snapshots the pre-gesture crop so Cancel can restore it
  // without an undo step; live drag/zoom calls updateItem(...,false) (the
  // same non-committing pattern updateEditingTextLive established) and a
  // single commit() lands the whole gesture as one history entry. ---

  function enterCropMode(itemId) {
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item || isEffectivelyLocked(item, itemsById)) return;
    const hasContent = item.type === "frame" ? !!item.contentAssetId : !!item.assetId;
    if (!hasContent) return;
    if (editingTextIdRef.current) exitTextEdit();
    cropEntrySnapshotRef.current = { itemId, crop: { ...normalizeCrop(item.crop) } };
    setSelectedIds([itemId]);
    setCroppingItemId(itemId);
  }

  // Live crop changes (drag/wheel-zoom in CropOverlay, or a toolbar action
  // that should feel live) — non-committing, mirrors updateEditingTextLive.
  function liveCropChange(itemId, crop) {
    updateItem(itemId, { crop }, false);
  }

  // Discrete, one-click crop actions (fit/fill toggle, aspect preset,
  // center) commit immediately — each is its own single undo step, exactly
  // like any other toolbar field edit elsewhere in the app.
  function commitCropChange(itemId, crop) {
    updateItem(itemId, { crop }, true, { type: "crop", label: "Crop image", itemIds: [itemId] });
  }

  function commitCropGesture() {
    // Finalizes whatever the immediately-preceding liveCropChange queued —
    // same updater-form trick as commitEditingText.
    commit((prevItems) => prevItems, {
      type: "crop",
      label: "Crop image",
      itemIds: croppingItemIdRef.current ? [croppingItemIdRef.current] : [],
    });
  }

  // Resizes the object's own box to a target aspect ratio, keeping it
  // centered on its current position — used by the crop toolbar's aspect
  // presets (spec §16). The crop itself needs no separate adjustment since
  // Fill/Fit are both computed live from the box's current width/height.
  function setCropAspectRatio(itemId, ratio) {
    if (!ratio || !Number.isFinite(ratio)) return; // "Free" preset — no-op
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item) return;
    const centerX = item.x + item.width / 2;
    const centerY = item.y + item.height / 2;
    const area = item.width * item.height;
    const newHeight = Math.sqrt(area / ratio);
    const newWidth = newHeight * ratio;
    updateItem(
      itemId,
      {
        width: Math.max(20, newWidth),
        height: Math.max(20, newHeight),
        x: centerX - newWidth / 2,
        y: centerY - newHeight / 2,
      },
      true,
      { type: "crop-aspect", label: "Set crop aspect ratio", itemIds: [itemId] }
    );
  }

  function applyCropMode() {
    if (!croppingItemId) return false;
    setCroppingItemId(null);
    cropEntrySnapshotRef.current = null;
    return true;
  }

  // Clicking outside the crop overlay APPLIES the crop (matching
  // TextEditOverlay's own outside-click-commits convention, and the
  // documented choice for "does clicking outside apply or cancel?" —
  // spec §14) — finalizes whatever the last live drag/zoom queued.
  function applyCropModeAndCommit() {
    if (!applyCropMode()) return;
    commitCropGesture();
  }

  function cancelCropMode() {
    if (!croppingItemId) return false;
    const snapshot = cropEntrySnapshotRef.current;
    if (snapshot && snapshot.itemId === croppingItemId) {
      // Restore the pre-entry crop via a plain (non-history) setItems —
      // there is nothing to undo since nothing was committed yet.
      setItems((prev) => prev.map((it) => (it.id === snapshot.itemId ? { ...it, crop: snapshot.crop } : it)));
    }
    setCroppingItemId(null);
    cropEntrySnapshotRef.current = null;
    return true;
  }

  // --- Image Fill position/zoom drag mode — parallel in shape to crop
  // mode above (see its own header comment). Entered while the Image tab
  // of TextColorPanel is open for a selected text item with an active
  // fillImage (TextPropertiesBar.jsx's onImageTabActiveChange), so the
  // on-canvas drag (ImageFillOverlay.jsx) never fights with normal
  // object-move dragging. ---

  function enterImageFillEditMode(itemId) {
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item || (item.type !== "text" && item.type !== "shape") || !item.fillImage?.assetId || isEffectivelyLocked(item, itemsById)) return;
    if (editingTextIdRef.current) exitTextEdit();
    if (croppingItemIdRef.current) cancelCropMode();
    imageFillEntrySnapshotRef.current = { itemId, fillImage: { ...normalizeImageFill(item.fillImage) } };
    setImageFillEditItemId(itemId);
  }

  function liveImageFillChange(itemId, fillImage) {
    updateItem(itemId, { fillImage }, false);
  }

  function commitImageFillGesture() {
    const targetId = imageFillEditItemIdRef.current;
    const target = targetId ? itemsRef.current.find((it) => it.id === targetId) : null;
    commit((prevItems) => prevItems, {
      type: "image-fill",
      label: target?.type === "shape" ? "Edit shape image fill" : "Edit text image fill",
      itemIds: targetId ? [targetId] : [],
    });
  }

  function applyImageFillEditModeAndCommit() {
    if (!imageFillEditItemId) return;
    setImageFillEditItemId(null);
    imageFillEntrySnapshotRef.current = null;
    commitImageFillGesture();
  }

  function cancelImageFillEditMode() {
    if (!imageFillEditItemId) return false;
    const snapshot = imageFillEntrySnapshotRef.current;
    if (snapshot && snapshot.itemId === imageFillEditItemId) {
      setItems((prev) => prev.map((it) => (it.id === snapshot.itemId ? { ...it, fillImage: snapshot.fillImage } : it)));
    }
    setImageFillEditItemId(null);
    imageFillEntrySnapshotRef.current = null;
    return true;
  }

  // --- Remove background (right-click context menu action) ---
  // Runs entirely client-side (@imgly/background-removal, WASM/onnxruntime
  // -web) — no server component, consistent with this app's local-only
  // asset model (spec: no backend/auth). Follows the same "produce a new
  // asset, swap item.assetId" shape as replaceImageSrc (App.jsx ~3190),
  // but — unlike Replace — deliberately keeps the existing crop/adjustments
  // instead of resetting them, since it's still logically the same image,
  // just with its background matted out to transparency (same pixel
  // dimensions in, same dimensions out).
  async function removeImageBackground(itemId) {
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item || item.type !== "image" || !item.assetId) return;
    if (removingBackgroundId) return; // one job at a time
    setRemovingBackgroundId(itemId);
    setStatus("Removing background…");
    try {
      const sourceBlob = await getAssetBlob(item.assetId);
      if (!sourceBlob) throw new Error("Original image could not be found.");
      const { removeBackground } = await import("@imgly/background-removal");
      const cutoutBlob = await removeBackground(sourceBlob);
      const sourceMeta = await getAssetMeta(item.assetId);
      const file = new File([cutoutBlob], `${sourceMeta?.name || "image"}-no-bg.png`, { type: "image/png" });
      const result = await uploadFileToLibrary(file);
      if (!result.id) throw new Error(result.errorMessage || "Could not save the processed image.");
      const stillPresent = itemsRef.current.find((it) => it.id === itemId);
      if (!stillPresent) return; // item was deleted while processing
      updateItem(
        itemId,
        { assetId: result.id, naturalWidth: result.width, naturalHeight: result.height },
        true,
        { type: "remove-background", label: "Remove background", itemIds: [itemId] }
      );
      setStatus("Background removed.");
    } catch (err) {
      setStatus(err?.message || "Could not remove the background.");
    } finally {
      setRemovingBackgroundId(null);
      window.setTimeout(() => setStatus(""), 3000);
    }
  }

  // --- Image/frame adjustments (Phase 6) ---

  // Slider drag: non-committing per tick, one commit on release — see
  // GroupedSliderField (toolbarUi.jsx), built specifically so these don't
  // push one history entry per native `input` event.
  function liveAdjustmentsChange(itemId, adjustments) {
    updateItem(itemId, { adjustments }, false);
  }

  function commitAdjustmentsGesture() {
    commit((prevItems) => prevItems, { type: "image-adjustments", label: "Adjust image", itemIds: [...selectedIdsRef.current] });
  }

  // Restores the object's box to the asset's real natural aspect ratio,
  // keeping it centered — does not touch the source asset itself.
  function restoreOriginalAspectRatio(itemId) {
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item?.naturalWidth || !item?.naturalHeight) return;
    setCropAspectRatio(itemId, item.naturalWidth / item.naturalHeight);
  }

  // Resets crop/focal-point/fit/flip/adjustments/filters/border/corner-
  // radius/shadow to their defaults while preserving object position,
  // dimensions, and rotation (spec §35's recommended behavior) — a single
  // commit, so Undo restores every prior edit in one step.
  function resetImageEdits(itemId) {
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item) return;
    updateItem(
      itemId,
      {
        crop: { ...DEFAULT_CROP },
        adjustments: { ...DEFAULT_ADJUSTMENTS },
        flipX: false,
        flipY: false,
        cornerRadius: 0,
        shadow: false,
      },
      true,
      { type: "reset-image-edits", label: "Reset image edits", itemIds: [itemId] }
    );
  }

  const LEGACY_FIELD_BY_STYLE_KEY = {
    bold: "fontWeight",
    italic: "italic",
    underline: "underline",
    strikethrough: "strikethrough",
    color: "fill",
    fontFamily: "fontFamily",
    fontSize: "fontSize",
  };

  // Routes a formatting command to range-based editing (while inline-
  // editing that exact object) or to the whole-object legacy fields
  // (everything else) — the same command works from the toolbar in both
  // modes without the toolbar needing to know which one is active.
  function applyTextFormat(itemId, styleKey, value) {
    if (editingTextId === itemId) {
      overlayRef.current?.applyFormat(styleKey, value);
      return;
    }
    const field = LEGACY_FIELD_BY_STYLE_KEY[styleKey];
    if (!field) return;
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item) return;
    let nextValue = value;
    if (styleKey === "bold" && value === undefined) nextValue = item.fontWeight === "bold" ? "normal" : "bold";
    else if (["italic", "underline", "strikethrough"].includes(styleKey) && value === undefined) nextValue = !item[field];
    else if (styleKey === "bold") nextValue = value ? "bold" : "normal";
    updateItem(itemId, { [field]: nextValue }, true, { type: "text-format", label: "Format text", itemIds: [itemId] });
  }

  function applyTextListFormat(itemId, listType) {
    if (editingTextId !== itemId) return;
    // Lists are inherently a rich-text (per-paragraph) concept, so there
    // is nothing meaningful to toggle on a whole, non-edited object —
    // these commands only do something while actively inline-editing.
    if (listType === "indent") overlayRef.current?.indent(1);
    else if (listType === "outdent") overlayRef.current?.indent(-1);
    else overlayRef.current?.toggleList(listType);
  }

  function copyTextStyle(itemId) {
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item || item.type !== "text") return;
    setCopiedTextStyle({
      fontFamily: item.fontFamily,
      fontSize: item.fontSize,
      fontWeight: item.fontWeight,
      italic: item.italic,
      underline: item.underline,
      fill: item.fill,
      align: item.align,
      lineHeight: item.lineHeight,
      letterSpacing: item.letterSpacing,
      paragraphSpacing: item.paragraphSpacing,
      textTransform: item.textTransform,
      background: item.background,
      border: item.border,
      effects: item.effects,
    });
  }

  function pasteTextStyle(itemId) {
    if (!copiedTextStyle) return;
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item || item.type !== "text") return;
    // Copies values onto the object (content/position/size/id untouched);
    // clears any existing richText override so the pasted whole-object
    // style is what actually renders.
    updateItem(itemId, { ...copiedTextStyle, richText: undefined }, true, { type: "text-format", label: "Paste text style", itemIds: [itemId] });
  }

  function clearTextFormatting(itemId) {
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item || item.type !== "text") return;
    if (editingTextId === itemId) {
      // Reset to the object's base style but keep typed content — rebuild
      // richText as one plain run per paragraph using current base fields.
      const plain = plainTextOf(ensureRichText(item));
      updateItem(
        itemId,
        { text: plain, richText: undefined, fontWeight: "normal", italic: false, underline: false },
        true,
        { type: "text-format", label: "Clear text formatting", itemIds: [itemId] }
      );
      exitTextEdit();
      return;
    }
    updateItem(
      itemId,
      { richText: undefined, fontWeight: "normal", italic: false, underline: false },
      true,
      { type: "text-format", label: "Clear text formatting", itemIds: [itemId] }
    );
  }

  function applyProjectTextStyle(itemId, style) {
    updateItem(itemId, { ...style, richText: undefined }, true, { type: "text-format", label: "Apply text style", itemIds: [itemId] });
  }

  // Registers a file as a library asset only — does not add anything to
  // the page. Returns the putAsset result so the Uploads panel can show
  // progress/error/retry state per attempt (spec §1/§3).
  async function uploadFileToLibrary(file) {
    const result = await putAsset(file);
    if (result.status === "error") setStatus(result.errorMessage);
    return result;
  }

  // --- Phase 11: applying/detaching brand-kit resources onto canvas
  // objects/pages. Every one of these goes through updateItem/commit/
  // commitPages/commitBoth — the SAME history + autosave path every other
  // property edit already uses (spec §81/§82) — brandApply.js/themeApply.js
  // only compute the next item/page value, never touch history themselves.

  function applyBrandColorField(itemId, fieldPath, token) {
    if (!activeBrandKitId) return;
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item) return;
    updateItem(itemId, applyColorToken(item, fieldPath, activeBrandKitId, token), true, {
      type: "apply-brand-color", label: "Apply brand color", itemIds: [itemId],
    });
    recordBrandKitUsed(activeBrandKitId);
  }

  function detachBrandColorField(itemId, fieldPath) {
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item) return;
    updateItem(itemId, detachColor(item, fieldPath), true, {
      type: "detach-brand-color", label: "Detach brand color", itemIds: [itemId],
    });
  }

  function applyTypographyStyleToSelection(itemId, styleId) {
    if (!activeBrandKit) return;
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item) return;
    updateItem(itemId, resolveApplyTypographyStyle(item, activeBrandKit, styleId), true, {
      type: "apply-typography-style", label: "Apply text style", itemIds: [itemId],
    });
    recordBrandKitUsed(activeBrandKit.id);
  }

  function detachTypographyStyleFromSelection(itemId) {
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item) return;
    updateItem(itemId, detachTypographyStyle(item), true, {
      type: "detach-typography-style", label: "Detach text style", itemIds: [itemId],
    });
  }

  async function createTypographyStyleFromSelection(itemId) {
    if (!activeBrandKit) return;
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item || item.type !== "text") return;
    const name = window.prompt("Name this text style", "New text style");
    if (!name) return;
    const kit = await addResource(activeBrandKit.id, "typography", createTypographyToken({ name, ...typographyTokenFromItem(item, activeBrandKit) }));
    await refreshBrandKits();
    const newest = kit.typography[kit.typography.length - 1];
    if (newest) applyTypographyStyleToSelection(itemId, newest.id);
  }

  // Redefines the linked style FROM the current selection's values, then
  // updates every OTHER item in the current project still linked to it
  // (spec §56) — detached text and text linked to a DIFFERENT brand kit
  // are untouched.
  async function updateTypographyStyleFromSelection(itemId) {
    if (!activeBrandKit) return;
    const item = itemsRef.current.find((it) => it.id === itemId);
    const ref = item?.typographyStyleRef;
    if (!item || !ref || ref.brandKitId !== activeBrandKit.id) return;
    await updateResource(activeBrandKit.id, "typography", ref.styleId, typographyTokenFromItem(item, activeBrandKit));
    const updatedKit = await getBrandKitById(activeBrandKit.id);
    const affectedIds = [];
    const next = itemsRef.current.map((it) => {
      if (it.typographyStyleRef?.brandKitId !== activeBrandKit.id || it.typographyStyleRef?.styleId !== ref.styleId) return it;
      affectedIds.push(it.id);
      return resolveApplyTypographyStyle(it, updatedKit, ref.styleId);
    });
    commit(next, { type: "update-typography-style", label: "Update text style", itemIds: affectedIds });
    await refreshBrandKits();
  }

  function applyObjectStyleToSelection(itemId, styleId) {
    if (!activeBrandKit) return;
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item) return;
    updateItem(itemId, resolveApplyObjectStyle(item, activeBrandKit, styleId), true, {
      type: "apply-object-style", label: "Apply object style", itemIds: [itemId],
    });
    recordBrandKitUsed(activeBrandKit.id);
  }

  function detachObjectStyleFromSelection(itemId) {
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item) return;
    updateItem(itemId, detachObjectStyle(item), true, { type: "detach-object-style", label: "Detach object style", itemIds: [itemId] });
  }

  async function createObjectStyleFromSelection(itemId) {
    if (!activeBrandKit) return;
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item) return;
    const name = window.prompt("Name this object style", "New object style");
    if (!name) return;
    const kit = await addResource(activeBrandKit.id, "objectStyles", createObjectStyle({
      name, category: item.type, appliesTo: [item.type], props: objectStylePropsFromItem(item),
    }));
    await refreshBrandKits();
    const newest = kit.objectStyles[kit.objectStyles.length - 1];
    if (newest) applyObjectStyleToSelection(itemId, newest.id);
  }

  function applyImageStyleToSelection(itemId, styleId) {
    if (!activeBrandKit) return;
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item) return;
    updateItem(itemId, resolveApplyImageStyle(item, activeBrandKit, styleId), true, {
      type: "apply-image-style", label: "Apply image style", itemIds: [itemId],
    });
    recordBrandKitUsed(activeBrandKit.id);
  }

  function detachImageStyleFromSelection(itemId) {
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item) return;
    updateItem(itemId, detachImageStyle(item), true, { type: "detach-image-style", label: "Detach image style", itemIds: [itemId] });
  }

  async function createImageStyleFromSelection(itemId) {
    if (!activeBrandKit) return;
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!item) return;
    const name = window.prompt("Name this image style", "New image style");
    if (!name) return;
    const kit = await addResource(activeBrandKit.id, "imageStyles", createImageStyle({ name, ...imageStylePropsFromItem(item) }));
    await refreshBrandKits();
    const newest = kit.imageStyles[kit.imageStyles.length - 1];
    if (newest) applyImageStyleToSelection(itemId, newest.id);
  }

  function applyBrandBackgroundStyle(pageId, styleId) {
    if (!activeBrandKit) return;
    commitPages((prev) => prev.map((p) => (p.id === pageId ? resolveApplyBackgroundStyle(p, activeBrandKit, styleId) : p)), {
      type: "apply-brand-background", label: "Apply brand background", pageIds: [pageId],
    });
    recordBrandKitUsed(activeBrandKit.id);
  }

  // Theme application (spec §48-50/§83): flushes autosave and takes a
  // protected recovery snapshot + auto version milestone before any BROAD
  // application (project scope, or a large affected count), then applies
  // through one grouped commitBoth() transaction. See themeApply.js for
  // why only already-brand-linked objects/pages are touched.
  async function applyBrandTheme(themeId, scope, scopeParams) {
    if (!activeBrandKit) return;
    const theme = activeBrandKit.themes.find((t) => t.id === themeId);
    if (!theme) return;
    const data = { items: itemsRef.current, pages: pagesRef.current };
    const plan = planThemeApplication(activeBrandKit, theme, data, scope, scopeParams);
    if (plan.affectedCount === 0) return;
    if (scope === "project" || plan.affectedCount > 20) {
      autosaveRef.current.flush();
      await createRecoverySnapshotNow("before-theme-apply", true);
      await createAutoMilestone("before-theme-apply");
    }
    const { nextItems, nextPages } = applyThemeToProject(activeBrandKit, theme, data, scope, scopeParams);
    commitBoth(nextItems, nextPages, {
      type: "apply-theme", label: `Apply theme: ${theme.name}`, itemIds: plan.affectedItemIds, pageIds: plan.affectedPageIds,
    });
    recordBrandKitUsed(activeBrandKit.id);
  }

  function applyBrandColorReplacement(plan) {
    const next = applyColorReplacement(itemsRef.current, plan);
    commit(next, { type: "replace-colors", label: "Replace colors", itemIds: plan.affectedItemIds, pageIds: plan.affectedPageIds });
  }

  function applyBrandFontReplacement(params) {
    const plan = planFontReplacement({ items: itemsRef.current }, params);
    const next = applyFontReplacement(itemsRef.current, params);
    commit(next, { type: "replace-fonts", label: "Replace fonts", itemIds: plan.affectedItemIds });
  }

  async function uploadLogoToBrandKit(file) {
    if (!activeBrandKit) return;
    if (file.type === "image/svg+xml") {
      const text = await file.text();
      const sanitized = sanitizeSvg(text);
      if (!sanitized) {
        setStatus("Could not read this SVG logo.");
        return;
      }
      const { safe, reasons } = validateSvgSafety(text);
      if (!safe) setStatus(`Logo was sanitized before saving (${reasons[0] || "unsafe content removed"}).`);
      const { width, height } = extractSvgDimensions(sanitized);
      await addResource(activeBrandKit.id, "logos", createLogoResource({
        isSvg: true, svgContent: sanitized, name: file.name.replace(/\.svg$/i, ""), fileType: "image/svg+xml",
        width: width || 200, height: height || 200, transparency: true,
      }));
    } else {
      const result = await putAsset(file, { name: file.name, sourceType: "brand-logo" });
      if (result.status === "error") {
        setStatus(result.errorMessage);
        return;
      }
      await addResource(activeBrandKit.id, "logos", createLogoResource({
        assetId: result.id, name: file.name, fileType: result.mimeType, width: result.width, height: result.height,
      }));
    }
    await refreshBrandKits();
  }

  // Inserting a logo (spec §32) always produces a normal, fully editable
  // `image` object — a vector (SVG) logo is rasterized once at insert time
  // (see svgSafety.rasterizeSvgToPngBlob) so it goes through this app's
  // existing raster image pipeline (crop/filters/export) unchanged; the
  // sanitized SVG source itself stays on the brand-kit resource untouched.
  async function insertBrandLogo(logoId) {
    if (!activeBrandKit) return;
    const logo = activeBrandKit.logos.find((l) => l.id === logoId);
    if (!logo) return;
    let assetId = logo.assetId;
    let naturalWidth = logo.width || 200;
    let naturalHeight = logo.height || 200;
    if (!assetId && logo.isSvg && logo.svgContent) {
      try {
        const blob = await rasterizeSvgToPngBlob(logo.svgContent, logo.width || 400, logo.height || 400);
        const file = new File([blob], `${logo.name || "logo"}.png`, { type: "image/png" });
        const result = await putAsset(file, { name: logo.name, sourceType: "brand-logo-raster" });
        if (!result.id) {
          setStatus(result.errorMessage || "Could not insert logo.");
          return;
        }
        assetId = result.id;
        naturalWidth = result.width;
        naturalHeight = result.height;
      } catch {
        setStatus("Could not insert logo.");
        return;
      }
    }
    if (!assetId) return;

    const maxWidth = Math.min(activePageRef.current.width * 0.5, 300);
    const maxHeight = Math.min(activePageRef.current.height * 0.5, 300);
    const shrink = Math.min(1, maxWidth / naturalWidth, maxHeight / naturalHeight);
    const width = naturalWidth * shrink;
    const height = naturalHeight * shrink;
    const center = { x: activePageRef.current.width / 2, y: activePageRef.current.height / 2 };
    const now = Date.now();
    const newItem = {
      id: crypto.randomUUID(),
      type: "image",
      pageId: activePageId,
      parentId: null,
      ...getDefaultProps("image"),
      assetId,
      naturalWidth,
      naturalHeight,
      x: center.x - width / 2,
      y: center.y - height / 2,
      width,
      height,
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      brandAssetRef: { brandKitId: activeBrandKit.id, resourceId: logo.id, fallbackAssetId: assetId },
      createdAt: now,
      updatedAt: now,
    };
    commit((prev) => [...prev, newItem], { type: "add-object", label: "Insert logo", itemIds: [newItem.id], pageIds: [activePageId] });
    setSelectedIds([newItem.id]);
    recordBrandKitUsed(activeBrandKit.id);
  }

  function selectBrandAuditUsage(pageId, itemIds) {
    if (pageId && pageId !== activePageId) activatePage(pageId);
    setSelectedIds(itemIds);
    setIsBrandAuditOpen(false);
  }

  // Replaces a standalone image's OR a filled frame's content with a newly
  // uploaded file. Preserves position/size/rotation/layer order/group
  // membership/opacity/lock/visibility (only assetId/crop/adjustments/flip
  // change) and resets crop to a centered Fill state, per spec §13's
  // recommended behavior — Undo restores the previous asset and crop in
  // one step since this is a single commit.
  async function replaceImageSrc(id, file) {
    const result = await uploadFileToLibrary(file);
    if (!result.id) return;
    const item = itemsRef.current.find((it) => it.id === id);
    if (!item) return;
    if (item.type === "frame") {
      setFrameContent(id, result.id, result);
    } else {
      updateItem(
        id,
        {
          assetId: result.id,
          naturalWidth: result.width,
          naturalHeight: result.height,
          crop: { ...DEFAULT_CROP },
          adjustments: { ...DEFAULT_ADJUSTMENTS },
        },
        true,
        { type: "replace-image", label: "Replace image", itemIds: [id] }
      );
    }
  }

  // Removing an asset from the Uploads library never touches objects that
  // already reference it (spec §5: "do not automatically delete the binary
  // asset merely because one image object is deleted" — and the reverse
  // holds too here) — those objects simply become "missing asset" the next
  // time useAsset resolves them (ImageNode/FrameNode already render a
  // placeholder for that state). The panel itself asks for confirmation
  // first when usedAssetIds shows the asset is currently referenced.
  async function removeAssetFromLibrary(assetId) {
    await deleteAsset(assetId);
  }

  // Shared by align/distribute below: applies a per-item position delta
  // computed against the LOGICAL selection (which may include groups,
  // each represented by its own derived bounding box — decision 3) by
  // shifting every descendant LEAF of a group instead of the group's own
  // stored fields, then re-deriving that group's (and any ancestors')
  // bounds — keeps a group's visual position in sync with its children
  // rather than detaching the group's bounding marker from its members.
  function applyPositionDeltas(itemsList, deltaById) {
    const now = Date.now();
    let next = itemsList;
    const affectedParentIds = new Set();
    deltaById.forEach(({ dx, dy }, id) => {
      if (!dx && !dy) return;
      const item = next.find((it) => it.id === id);
      if (!item) return;
      if (item.type === "group") {
        const leafIds = new Set(expandToLeafIds(next, [id]));
        next = next.map((it) => (leafIds.has(it.id) ? { ...it, x: it.x + dx, y: it.y + dy, updatedAt: now } : it));
        affectedParentIds.add(id);
      } else {
        next = next.map((it) => (it.id === id ? { ...it, x: it.x + dx, y: it.y + dy, updatedAt: now } : it));
        if (item.parentId) affectedParentIds.add(item.parentId);
      }
    });
    return recomputeAffectedGroupBounds(next, [...affectedParentIds]);
  }

  // Expands the logical selection (leaves and/or groups) to every item
  // that must move/delete/copy together with it — a group's full subtree.
  function getExpandedSelectionItems(selected) {
    const ids = new Set();
    selected.forEach((it) => {
      ids.add(it.id);
      if (it.type === "group") getDescendantIds(items, it.id).forEach((id) => ids.add(id));
    });
    return items.filter((it) => ids.has(it.id));
  }

  function removeSelection() {
    if (selectedIds.length === 0) return;
    const deletableTopLevel = selectedItems.filter((item) => !isEffectivelyLocked(item, itemsById));
    if (deletableTopLevel.length === 0) return;
    const idsToDelete = new Set(deletableTopLevel.flatMap((it) => [it.id, ...getDescendantIds(items, it.id)]));
    const affectedParentIds = deletableTopLevel.map((it) => it.parentId).filter(Boolean);
    commit(
      (prev) => recomputeAffectedGroupBounds(prev.filter((item) => !idsToDelete.has(item.id)), affectedParentIds),
      {
        type: "delete-object",
        label: deletableTopLevel.length > 1 ? `Delete ${deletableTopLevel.length} objects` : "Delete object",
        itemIds: [...idsToDelete],
      }
    );
    setSelectedIds((prev) => prev.filter((id) => !idsToDelete.has(id)));
  }

  // forward/backward/front/back all reduce to one reorder primitive
  // (hierarchy.js's reorderLayerItems), scoped to the selection's actual
  // siblings (same parentId + page) so moving a nested item never jumps
  // out of its group and moving a top-level item never jumps into one.
  function reorderSelection(direction) {
    if (selectedIds.length === 0) return;
    const selectedSet = new Set(selectedIds);
    const anchor = items.find((it) => selectedSet.has(it.id));
    if (!anchor) return;
    const parentId = anchor.parentId ?? null;
    const siblings = items.filter((it) => (it.parentId ?? null) === parentId && it.pageId === anchor.pageId);
    const selectedSiblingIds = siblings.filter((it) => selectedSet.has(it.id)).map((it) => it.id);
    if (selectedSiblingIds.length === 0) return;

    const reorderMeta = { type: "reorder-layer", label: "Reorder layer", itemIds: selectedSiblingIds };
    if (direction === "front") {
      const last = siblings[siblings.length - 1];
      if (!last || selectedSet.has(last.id)) return;
      commit((prev) => reorderLayerItems(prev, selectedSiblingIds, last.id, "after"), reorderMeta);
    } else if (direction === "back") {
      const first = siblings[0];
      if (!first || selectedSet.has(first.id)) return;
      commit((prev) => reorderLayerItems(prev, selectedSiblingIds, first.id, "before"), reorderMeta);
    } else if (direction === "forward") {
      const idx = siblings.findIndex((it) => it.id === selectedSiblingIds[selectedSiblingIds.length - 1]);
      const next = siblings[idx + 1];
      if (!next || selectedSet.has(next.id)) return;
      commit((prev) => reorderLayerItems(prev, selectedSiblingIds, next.id, "after"), reorderMeta);
    } else if (direction === "backward") {
      const idx = siblings.findIndex((it) => it.id === selectedSiblingIds[0]);
      const prevSibling = siblings[idx - 1];
      if (!prevSibling || selectedSet.has(prevSibling.id)) return;
      commit((prev) => reorderLayerItems(prev, selectedSiblingIds, prevSibling.id, "before"), reorderMeta);
    }
  }

  // Returns { cloned, idMap } — idMap lets callers translate an original
  // (pre-clone) id to its new clone id, needed to reselect exactly the
  // logical roots of what was duplicated/pasted (not every descendant).
  function cloneWithNewIds(sourceItems, offset = 20) {
    const now = Date.now();
    const idMap = new Map();
    sourceItems.forEach((item) => idMap.set(item.id, crypto.randomUUID()));
    const cloned = sourceItems.map((item) => ({
      ...item,
      id: idMap.get(item.id),
      // A duplicated child whose parent group ISN'T part of this clone
      // batch stays attached to that same existing group (matches how
      // duplicating one member of a group is expected to behave); a
      // duplicated parent group's own children get remapped to the new
      // group id together.
      parentId: idMap.has(item.parentId) ? idMap.get(item.parentId) : item.parentId ?? null,
      x: item.x + offset,
      y: item.y + offset,
      createdAt: now,
      updatedAt: now,
    }));
    return { cloned, idMap };
  }

  function copySelection() {
    if (selectedIds.length === 0) return;
    clipboardRef.current = getExpandedSelectionItems(selectedItems).map((item) => ({ ...item }));
  }

  function cutSelection() {
    copySelection();
    removeSelection();
  }

  function pasteClipboard() {
    if (clipboardRef.current.length === 0) return;
    // Pasting always assigns every pasted object (and any nested children)
    // to the currently active page, even if copied from a different one —
    // a group can't span pages, so its whole subtree moves together.
    const { cloned, idMap } = cloneWithNewIds(clipboardRef.current);
    const repaged = cloned.map((item) => ({ ...item, pageId: activePageId }));
    commit([...items, ...repaged], {
      type: "paste",
      label: repaged.length > 1 ? `Paste ${repaged.length} objects` : "Paste object",
      itemIds: repaged.map((it) => it.id),
      pageIds: [activePageId],
    });
    const rootOriginalIds = clipboardRef.current
      .filter((it) => !it.parentId || !clipboardRef.current.some((other) => other.id === it.parentId))
      .map((it) => it.id);
    setSelectedIds(rootOriginalIds.map((id) => idMap.get(id)).filter(Boolean));
  }

  function duplicateSelection() {
    if (selectedIds.length === 0) return;
    const sourceItems = getExpandedSelectionItems(selectedItems);
    const { cloned, idMap } = cloneWithNewIds(sourceItems);
    commit([...items, ...cloned], {
      type: "duplicate",
      label: cloned.length > 1 ? `Duplicate ${cloned.length} objects` : "Duplicate object",
      itemIds: cloned.map((it) => it.id),
    });
    setSelectedIds(selectedIds.map((id) => idMap.get(id)).filter(Boolean));
  }

  // Real group objects (Phase 5) — see hierarchy.js for the full model.
  // Requires the selection to share one page AND one parent (grouping
  // across pages, or a selection that already spans different nesting
  // levels, is disabled rather than guessed at).
  function groupSelection() {
    if (selectedIds.length < 2) return;
    const selectedSet = new Set(selectedIds);
    const toGroup = items.filter((it) => selectedSet.has(it.id));
    if (toGroup.length < 2) return;
    const pageId = toGroup[0].pageId;
    const parentId = toGroup[0].parentId ?? null;
    if (toGroup.some((it) => it.pageId !== pageId || (it.parentId ?? null) !== parentId)) return;

    const now = Date.now();
    const box = unionBounds(toGroup.map(getItemBounds));
    const groupId = crypto.randomUUID();
    const groupItem = {
      id: groupId,
      type: "group",
      pageId,
      parentId,
      name: "Group",
      x: box.left,
      y: box.top,
      width: box.width,
      height: box.height,
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      createdAt: now,
      updatedAt: now,
    };

    // Contiguity invariant (hierarchy.js): members are reinserted as one
    // contiguous block, group item immediately after its children, at the
    // array position of the first-encountered (lowest-stacked) member.
    const next = [];
    let inserted = false;
    items.forEach((it) => {
      if (selectedSet.has(it.id)) {
        if (!inserted) {
          toGroup.forEach((member) => next.push({ ...member, parentId: groupId, updatedAt: now }));
          next.push(groupItem);
          inserted = true;
        }
      } else {
        next.push(it);
      }
    });
    commit(next, { type: "group", label: "Group objects", itemIds: [groupId, ...toGroup.map((it) => it.id)] });
    setSelectedIds([groupId]);
  }

  function ungroupSelection() {
    const groupsToUngroup = selectedItems.filter((it) => it.type === "group");
    if (groupsToUngroup.length === 0) return;
    const now = Date.now();
    const groupIds = new Set(groupsToUngroup.map((g) => g.id));
    const childIdsToSelect = items.filter((it) => groupIds.has(it.parentId)).map((it) => it.id);
    const next = items
      .filter((it) => !groupIds.has(it.id))
      .map((it) => {
        if (groupIds.has(it.parentId)) {
          const parentGroup = groupsToUngroup.find((g) => g.id === it.parentId);
          return { ...it, parentId: parentGroup.parentId ?? null, updatedAt: now };
        }
        return it;
      });
    commit(next, { type: "ungroup", label: "Ungroup objects", itemIds: [...groupIds, ...childIdsToSelect] });
    setSelectedIds(childIdsToSelect);
  }

  // GroupPropertiesBar's X/Y fields — moves every descendant leaf by the
  // same delta (see applyPositionDeltas) rather than writing the group's
  // own derived x/y directly, keeping the group's bounding box in sync.
  function moveGroupBy(groupId, dx, dy) {
    if (!dx && !dy) return;
    commit(applyPositionDeltas(items, new Map([[groupId, { dx, dy }]])), {
      type: "move",
      label: "Move group",
      itemIds: [groupId],
    });
  }

  // Group opacity has no real composited Konva node to apply to (decision
  // in the Phase 5 plan) — implemented as a direct bulk-set onto every
  // descendant leaf. Documented tradeoff: not a reversible per-child
  // override like lock/hidden, just a plain overwrite.
  function setGroupOpacity(groupId, value) {
    const leafIds = new Set(expandToLeafIds(items, [groupId]));
    const now = Date.now();
    commit(
      items.map((item) =>
        leafIds.has(item.id) || item.id === groupId ? { ...item, opacity: value, updatedAt: now } : item
      ),
      { type: "edit-property", label: "Change group opacity", itemIds: [groupId] }
    );
  }

  function toggleLockSelection() {
    if (selectedIds.length === 0) return;
    const allLocked = selectedItems.every((item) => item.locked);
    commit(
      items.map((item) =>
        selectedIds.includes(item.id) ? { ...item, locked: !allLocked, updatedAt: Date.now() } : item
      ),
      { type: "toggle-lock", label: allLocked ? "Unlock objects" : "Lock objects", itemIds: [...selectedIds] }
    );
  }

  function toggleHiddenSelection() {
    if (selectedIds.length === 0) return;
    const allHidden = selectedItems.every((item) => item.hidden);
    commit(
      items.map((item) =>
        selectedIds.includes(item.id) ? { ...item, hidden: !allHidden, updatedAt: Date.now() } : item
      ),
      { type: "toggle-hidden", label: allHidden ? "Show objects" : "Hide objects", itemIds: [...selectedIds] }
    );
  }

  function toggleItemLocked(id) {
    const target = items.find((item) => item.id === id);
    updateItem(id, { locked: !target?.locked }, true, {
      type: "toggle-lock",
      label: target?.locked ? "Unlock object" : "Lock object",
      itemIds: [id],
    });
  }

  function toggleItemHidden(id) {
    const target = items.find((item) => item.id === id);
    updateItem(id, { hidden: !target?.hidden }, true, {
      type: "toggle-hidden",
      label: target?.hidden ? "Show object" : "Hide object",
      itemIds: [id],
    });
  }

  function renameItem(id, name) {
    updateItem(id, { name }, true, { type: "rename-object", label: "Rename object", itemIds: [id] });
  }

  const NUDGE_COALESCE_MS = 500;

  // dirX/dirY: -1/0/1 direction from the arrow key. size: "standard" |
  // "large" | "fine" (spec §55) — the actual px increment is read from
  // precisionPrefs, never hardcoded, so Precision Settings' nudge fields
  // (spec §56) take effect immediately.
  function nudgeSelection(dirX, dirY, size = "standard") {
    if (selectedIds.length === 0) return;
    const movable = selectedItems.filter((item) => !isEffectivelyLocked(item, itemsById));
    if (movable.length === 0) return;
    const prefs = precisionPrefsRef.current;
    const increment = size === "large" ? prefs.nudgeLarge : size === "fine" ? prefs.nudgeFine : prefs.nudgeStandard;
    const dx = dirX * increment;
    const dy = dirY * increment;
    const ids = movable.map((item) => item.id);

    if (!nudgeSessionRef.current) {
      nudgeSessionRef.current = { ids, timer: null };
    }
    const session = nudgeSessionRef.current;
    const deltaById = new Map(ids.map((id) => [id, { dx, dy }]));
    const next = applyPositionDeltas(itemsRef.current, deltaById);
    itemsRef.current = next;
    setItems(next);

    clearTimeout(session.timer);
    session.timer = setTimeout(() => {
      nudgeSessionRef.current = null;
      commit(itemsRef.current, {
        type: "nudge",
        label: session.ids.length > 1 ? `Move ${session.ids.length} objects` : "Move object",
        itemIds: session.ids,
      });
    }, NUDGE_COALESCE_MS);
  }

  // Phase 10 §51/§52 — numeric X/Y/Width/Height for a multi-selection,
  // applied to the COMBINED bounding box: X/Y translate every selected
  // item by the same delta (relative positions preserved exactly);
  // Width/Height scale every item's position+size proportionally around
  // the group's top-left corner (documented as the one supported anchor
  // for multi-selection resize this phase — per-item anchor selection
  // for a multi-selection is a further-scope enhancement, not built here).
  function applyMultiSelectionTransform(changes) {
    if (selectedIds.length === 0) return;
    const selectedSet = new Set(selectedIds);
    const toTransform = items.filter((item) => selectedSet.has(item.id));
    if (toTransform.length === 0) return;
    const bounds = unionBounds(toTransform.map(getItemBounds));

    let scaleX = 1;
    let scaleY = 1;
    const originX = bounds.left;
    const originY = bounds.top;
    if (changes.width !== undefined && bounds.width > 0) scaleX = changes.width / bounds.width;
    if (changes.height !== undefined && bounds.height > 0) scaleY = changes.height / bounds.height;
    const dx = changes.x !== undefined ? changes.x - bounds.left : 0;
    const dy = changes.y !== undefined ? changes.y - bounds.top : 0;

    const next = items.map((item) => {
      if (!selectedSet.has(item.id)) return item;
      const relX = item.x - originX;
      const relY = item.y - originY;
      return {
        ...item,
        x: originX + relX * scaleX + dx,
        y: originY + relY * scaleY + dy,
        width: item.width * scaleX,
        height: item.height * scaleY,
        updatedAt: Date.now(),
      };
    });
    commit(next, { type: "resize", label: `Transform ${toTransform.length} objects`, itemIds: [...selectedIds] });
  }

  function alignSelection(edge) {
    if (selectedIds.length < 2) return;
    const selectedSet = new Set(selectedIds);
    const toAlign = items.filter((item) => selectedSet.has(item.id));
    const aligned = alignItems(toAlign, edge);
    const deltaById = new Map(
      aligned.map((a) => {
        const orig = toAlign.find((o) => o.id === a.id);
        return [a.id, { dx: a.x - orig.x, dy: a.y - orig.y }];
      })
    );
    commit(applyPositionDeltas(items, deltaById), {
      type: "align",
      label: toAlign.length > 1 ? `Align ${toAlign.length} objects` : "Align object",
      itemIds: toAlign.map((it) => it.id),
    });
  }

  // mode: "center-h" | "center-v" | "center-both" — relative to the active
  // page, for one or more selected items (each recentered independently).
  function alignSelectionToPage(mode) {
    if (selectedIds.length === 0) return;
    const selectedSet = new Set(selectedIds);
    const toAlign = items.filter((item) => selectedSet.has(item.id) && !isEffectivelyLocked(item, itemsById));
    if (toAlign.length === 0) return;
    const aligned = alignToPage(toAlign, activePage, mode);
    const deltaById = new Map(
      aligned.map((a) => {
        const orig = toAlign.find((o) => o.id === a.id);
        return [a.id, { dx: a.x - orig.x, dy: a.y - orig.y }];
      })
    );
    commit(applyPositionDeltas(items, deltaById), {
      type: "align",
      label: toAlign.length > 1 ? `Align ${toAlign.length} objects to page` : "Align object to page",
      itemIds: toAlign.map((it) => it.id),
    });
  }

  function distributeSelection(axis) {
    if (selectedIds.length < 3) return;
    const selectedSet = new Set(selectedIds);
    const toDistribute = items.filter((item) => selectedSet.has(item.id));
    const distributed = distributeItems(toDistribute, axis);
    const deltaById = new Map(
      distributed.map((a) => {
        const orig = toDistribute.find((o) => o.id === a.id);
        return [a.id, { dx: a.x - orig.x, dy: a.y - orig.y }];
      })
    );
    commit(applyPositionDeltas(items, deltaById), {
      type: "distribute",
      label: `Distribute ${toDistribute.length} objects`,
      itemIds: toDistribute.map((it) => it.id),
    });
  }

  // --- Group transform helpers (Phase 5 decision 8) ---

  // Lines/arrows opt out of the shared multi-node Transformer (endpoint
  // handles instead), so they can't ride along on Konva's native
  // multi-node rigid-group transform like every other leaf type when
  // they're a member of a transformed group. This recomputes each line's
  // x/y/width/rotation from a computed old-box -> new-box affine delta
  // (translate + uniform scale) via the registry's `applyMatrix` hook —
  // see objectRegistry.js's `line` entry. Documented limitation: this is
  // computed from axis-aligned bounds, so large-angle group ROTATION
  // isn't perfectly angle-preserving for line members (translate/resize
  // are exact) — flagged for future refinement, not blocking this phase.
  function applyGroupDeltaToLines(itemsList, lineIds, oldBox, newBox) {
    if (lineIds.length === 0) return itemsList;
    const sx = oldBox.width > 0 ? newBox.width / oldBox.width : 1;
    const sy = oldBox.height > 0 ? newBox.height / oldBox.height : 1;
    const transformPoint = (point) => ({
      x: newBox.x + (point.x - oldBox.x) * sx,
      y: newBox.y + (point.y - oldBox.y) * sy,
    });
    const lineIdSet = new Set(lineIds);
    return itemsList.map((item) => {
      if (!lineIdSet.has(item.id)) return item;
      const applyMatrix = getApplyMatrix(item.type);
      if (!applyMatrix) return item;
      return { ...item, ...applyMatrix(item, transformPoint), updatedAt: Date.now() };
    });
  }

  // Restores a page id that's still valid after a snapshot swap — undoing
  // "add page" or redoing "delete page" can leave the currently-active
  // page id absent from the restored `pages` array.
  function pickValidActivePageId(candidatePages, preferredId) {
    return candidatePages.some((p) => p.id === preferredId) ? preferredId : candidatePages[0]?.id;
  }

  // Undo/redo never create a new "normal" history entry — they only move
  // `historyState.index` across the existing stack (see history.js). Both
  // read/write historyStateRef synchronously (not just the historyState
  // variable) so a flush-then-undo happening in the same tick — Cmd+Z while
  // still inside an active text edit, see useKeyboardShortcuts wiring below
  // — sees the entry that flush just pushed rather than a stale index.
  function undo() {
    if (editingTextIdRef.current) exitTextEdit(); // flushes pending typing into its own entry first
    if (croppingItemIdRef.current) cancelCropMode(); // uncommitted crop gesture — revert, don't fold into undo
    if (imageFillEditItemIdRef.current) cancelImageFillEditMode(); // uncommitted image-fill gesture — same reasoning
    const current = historyStateRef.current;
    if (!historyCanUndo(current)) return;
    const undoneEntry = current.history[current.index];
    const nextIndex = current.index - 1;
    const snapshot = current.history[nextIndex];
    const nextHistory = { ...current, index: nextIndex };
    historyStateRef.current = nextHistory;
    setHistoryState(nextHistory);
    setItems(snapshot.items);
    setPages(snapshot.pages);
    setGuides(snapshot.guides || []);
    // Restores a sensible selection (spec §10) — whatever the undone action
    // touched, if it still exists post-undo (e.g. undoing a delete restores
    // the deleted object AND reselects it; undoing an add leaves nothing to
    // select since the object is now gone).
    setSelectedIds(undoneEntry.meta.itemIds.filter((id) => snapshot.items.some((it) => it.id === id)));
    setEnteredGroupId(null);
    setActivePageId((prev) => pickValidActivePageId(snapshot.pages, prev));
  }

  function redo() {
    if (editingTextIdRef.current) exitTextEdit();
    if (croppingItemIdRef.current) cancelCropMode();
    if (imageFillEditItemIdRef.current) cancelImageFillEditMode();
    const current = historyStateRef.current;
    if (!historyCanRedo(current)) return;
    const nextIndex = current.index + 1;
    const snapshot = current.history[nextIndex];
    const nextHistory = { ...current, index: nextIndex };
    historyStateRef.current = nextHistory;
    setHistoryState(nextHistory);
    setItems(snapshot.items);
    setPages(snapshot.pages);
    setGuides(snapshot.guides || []);
    setSelectedIds(snapshot.meta.itemIds.filter((id) => snapshot.items.some((it) => it.id === id)));
    setEnteredGroupId(null);
    setActivePageId((prev) => pickValidActivePageId(snapshot.pages, prev));
  }

  // The live stage's canvas now extends PASTEBOARD_MARGIN_PX beyond the
  // page on every edge (see renderActivePage) so off-page objects stay
  // visible while editing — crop back to just the page rect here so
  // template thumbnails never include pasteboard margin or stray content
  // parked outside the page.
  function captureStagePng() {
    const stage = stageRef.current;
    const page = activePageRef.current;
    const marginPx = PASTEBOARD_MARGIN_PX * RENDER_SCALE_CAP;
    return stage.toDataURL({
      x: marginPx,
      y: marginPx,
      width: page.width * RENDER_SCALE_CAP,
      height: page.height * RENDER_SCALE_CAP,
      pixelRatio: 2 / RENDER_SCALE_CAP,
      mimeType: "image/png",
    });
  }

  // Phase 9 — the real PNG/JPEG/PDF/SVG export/download pipeline lives in
  // src/export/*; this function just opens the dialog that drives it (see
  // ExportDialog.jsx / exportService.js). `format` is only an initial
  // preset (from a specific File-menu item) — the dialog lets the user
  // change it before exporting.
  function openExportDialog(format = null) {
    setExportDialogFormat(format);
    setIsExportDialogOpen(true);
  }

  // Share button — this app has no backend, so there's no persistent
  // shareable link to generate. Instead this renders the current page to a
  // PNG (same pipeline as export) and hands it to the OS share sheet via
  // the Web Share API, so the user can send it to Messages/Mail/AirDrop/
  // whatever's registered. Falls back to a normal download if the browser
  // doesn't support sharing files (e.g. desktop Firefox).
  async function shareDesign() {
    if (editingTextIdRef.current) exitTextEdit();
    const context = { pages, activePageId, items: resolveStaticExportItems(items, pages), projectName };
    const { request, errors } = buildExportRequest(
      { format: "png", pageSelection: "current", filenameBase: projectName },
      context
    );
    if (errors.length) {
      setStatus(errors[0]);
      window.setTimeout(() => setStatus(""), 3000);
      return;
    }
    setStatus("Preparing to share…");
    try {
      const result = await runExport(request, context);
      const file = new File([result.blob], result.filename, { type: result.blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: projectName });
        setStatus("");
        return;
      }
      downloadExportResult(result.blob, result.filename);
      setStatus("Sharing isn't supported in this browser — downloaded instead");
      window.setTimeout(() => setStatus(""), 3000);
    } catch (error) {
      if (error?.name === "AbortError") {
        setStatus("");
        return;
      }
      setStatus(error?.message || "Couldn't share this design.");
      window.setTimeout(() => setStatus(""), 3000);
    }
  }

  // File > Print — reuses the same PDF pipeline as "Export as PDF" (spec
  // rule 7: one render pipeline) rather than a separate print-specific
  // renderer or a CSS @media print stylesheet, which would either
  // duplicate rendering logic or bake in whatever's currently selected/
  // zoomed on screen. Opens the print-ready PDF in a new (real, top-level)
  // tab rather than a hidden iframe — the hidden-iframe auto-print trick is
  // known-flaky (the PDF plugin isn't reliably ready when print() fires);
  // a genuine tab navigated to the PDF is what actually supports
  // window.print() reliably in Chromium/Firefox. Still best-effort: some
  // browsers restrict or ignore print() on a plugin-rendered document, in
  // which case the tab is left open with its own print button as a
  // fallback the user can click themselves.
  async function handlePrint() {
    if (editingTextIdRef.current) exitTextEdit();
    // Opened synchronously, before any `await`, so it stays tied to this
    // click's user-gesture — otherwise the browser treats the later
    // `.location` assignment as a script-initiated popup and silently
    // blocks it (confirmed: an async window.open() after the PDF render
    // produced a blank, un-navigated tab).
    const printWindow = window.open("", "_blank");
    const context = { pages, activePageId, items: resolveStaticExportItems(items, pages), projectName };
    const { request, errors } = buildExportRequest(
      { format: "pdf", pageSelection: "current", pdfMode: "standard", filenameBase: projectName },
      context
    );
    if (errors.length) {
      printWindow?.close();
      setStatus(errors[0]);
      window.setTimeout(() => setStatus(""), 3000);
      return;
    }
    setStatus("Preparing to print…");
    try {
      const result = await runExport(request, context);
      const url = URL.createObjectURL(result.blob);
      if (printWindow) {
        printWindow.location.href = url;
        // Best-effort auto-print: whichever fires first — the tab's own
        // `load` event, or the fallback timer for browsers that don't
        // fire `load` for a plugin-rendered PDF — triggers print(), with
        // a short settle delay so the PDF viewer has actually painted
        // before the OS print dialog opens. The `printed` guard stops
        // both paths from opening the dialog twice.
        let printed = false;
        const tryPrint = () => {
          if (printed) return;
          printed = true;
          window.setTimeout(() => {
            try {
              printWindow.focus();
              printWindow.print();
            } catch {
              // Left silent — the tab itself is still open and usable,
              // with its own print button, so this isn't a dead end.
            }
          }, 300);
        };
        printWindow.addEventListener("load", tryPrint, { once: true });
        window.setTimeout(tryPrint, 1500);
      } else {
        // Popup blocked outright (no window handle at all) — fall back to
        // downloading the PDF instead of losing the render entirely.
        downloadExportResult(result.blob, result.filename);
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setStatus("");
    } catch (err) {
      printWindow?.close();
      setStatus(err.message || "Print failed.");
      window.setTimeout(() => setStatus(""), 3000);
    }
  }

  function isEmptyClickTarget(event) {
    const clickedEmpty = event.target === event.target.getStage();
    const clickedBackground = event.target.name() === "canvas-background";
    return clickedEmpty || clickedBackground;
  }

  function handleStageMouseDown(event) {
    setContextMenu(null);
    if (isSpaceDown || event.evt.button === 1) return;
    if (!isEmptyClickTarget(event)) return;

    const additive = event.evt.shiftKey || event.evt.metaKey || event.evt.ctrlKey;
    if (!additive) setSelectedIds([]);

    const pointer = stageRef.current.getRelativePointerPosition();
    marqueeStartRef.current = { start: pointer, additive };
    setMarquee({ x: pointer.x, y: pointer.y, width: 0, height: 0 });
    setInteractionMode("marquee");
  }

  function handleStageMouseMove() {
    const stage = stageRef.current;
    const pointer = stage.getRelativePointerPosition();
    if (pointer) setCursorPos(pointer);

    if (marqueeStartRef.current && pointer) {
      const { start } = marqueeStartRef.current;
      setMarquee({
        x: Math.min(start.x, pointer.x),
        y: Math.min(start.y, pointer.y),
        width: Math.abs(pointer.x - start.x),
        height: Math.abs(pointer.y - start.y),
      });
    }
  }

  function handleStageMouseUp() {
    if (marqueeStartRef.current && marquee) {
      const { additive } = marqueeStartRef.current;
      const hasArea = marquee.width > 2 || marquee.height > 2;
      if (hasArea) {
        const marqueeBounds = {
          left: marquee.x,
          top: marquee.y,
          right: marquee.x + marquee.width,
          bottom: marquee.y + marquee.height,
        };
        // Intersect (not fully-contained) — chosen behavior: an object is
        // selected if the marquee touches any part of it.
        const intersecting = items
          .filter(
            (item) =>
              item.pageId === activePageId &&
              item.type !== "group" &&
              !isEffectivelyHidden(item, itemsById) &&
              rectsIntersect(getItemBounds(item), marqueeBounds)
          )
          .map((item) => item.id);
        const resolvedSet = new Set(
          intersecting.map((id) => resolveClickSelection(items, id, { enteredGroupId }))
        );
        const resolved = Array.from(resolvedSet);
        setSelectedIds((prev) => (additive ? Array.from(new Set([...prev, ...resolved])) : resolved));
      }
    }
    marqueeStartRef.current = null;
    setMarquee(null);
    setInteractionMode("idle");
  }

  function handleStageMouseLeave() {
    setCursorPos(null);
  }

  function clientToScreen(clientX, clientY) {
    const rect = canvasFrameRef.current.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  // Inverse of clientToScreen+screenToContent (same rect/scale convention)
  // — used to anchor the right-click context menu just outside a content-
  // space bounding box's right edge instead of at the raw click point, so
  // it always opens beside the selection regardless of where inside it the
  // user actually right-clicked.
  const CONTEXT_MENU_GAP_PX = 12;
  function contentBoundsToMenuAnchor(bounds) {
    const rect = canvasFrameRef.current.getBoundingClientRect();
    const scaleNow = scaleRef.current;
    return {
      x: rect.left + bounds.right * scaleNow + CONTEXT_MENU_GAP_PX,
      y: rect.top + bounds.top * scaleNow,
    };
  }

  // Restricted candidate set for guide-drag snapping (spec §17): page
  // edges/center, this page's margins, and every OTHER guide — reuses the
  // one snapping engine (spec rule 3) rather than a guide-specific snap
  // calculation.
  function guideSnapCandidates(orientation, excludeId) {
    const page = activePageRef.current;
    const others = guidesRef.current.filter((g) => g.id !== excludeId && (g.pageId === page.id || g.pageId === null));
    const { vertical, horizontal } = collectSnapCandidates({
      page,
      items: [],
      excludeIds: new Set(),
      guides: others,
      toggles: { snapToObjects: false, snapToEqualSpacing: false, snapToGrid: false, ...precisionPrefsRef.current },
    });
    return orientation === "vertical" ? vertical : horizontal;
  }

  function updateGuidePosFromClient(clientX, clientY, orientation, id) {
    const screenPoint = clientToScreen(clientX, clientY);
    const contentPoint = screenToContent(screenPoint, { scale, x: 0, y: 0 });
    let pos = orientation === "vertical" ? contentPoint.x : contentPoint.y;
    if (!isAltDownRef.current && snapToGuidesRef.current) {
      const candidates = guideSnapCandidates(orientation, id);
      const threshold = thresholdForScale(precisionPrefsRef.current.snapSensitivityPx, scaleRef.current);
      const snappedPos = snapResizeEdge(pos, candidates, threshold);
      pos = snappedPos;
    }
    pos = Math.round(pos * 100) / 100;
    setGuides((prev) => prev.map((g) => (g.id === id ? { ...g, pos } : g)));
    return pos;
  }

  function handleGuideDragMove(event) {
    const drag = draggingGuideRef.current;
    if (!drag) return;
    updateGuidePosFromClient(event.clientX, event.clientY, drag.orientation, drag.id);
  }

  function endGuideDragListeners() {
    window.removeEventListener("mousemove", handleGuideDragMove);
    window.removeEventListener("mouseup", handleGuideDragUp);
    window.removeEventListener("keydown", handleGuideDragKeyDown);
  }

  function handleGuideDragUp(event) {
    const drag = draggingGuideRef.current;
    endGuideDragListeners();
    draggingGuideRef.current = null;
    if (!drag) return;

    const pos = updateGuidePosFromClient(event.clientX, event.clientY, drag.orientation, drag.id);
    const limit = drag.orientation === "vertical" ? activePage.width : activePage.height;
    const droppedOutside = pos < 0 || pos > limit;
    if (droppedOutside) {
      // New guides dropped outside the page are discarded silently
      // (spec §16); an EXISTING guide dragged back onto the ruler is a
      // deliberate delete gesture (spec §18) — either way, no history
      // entry for a guide that ends up not existing.
      commitGuides((prev) => prev.filter((g) => g.id !== drag.id), {
        type: drag.isNew ? "discard-guide" : "delete-guide",
        label: drag.isNew ? "Discard guide" : "Delete guide",
      });
      return;
    }
    commitGuides(guidesRef.current.map((g) => (g.id === drag.id ? { ...g, pos } : g)), {
      type: drag.isNew ? "add-guide" : "move-guide",
      label: drag.isNew ? "Add guide" : "Move guide",
    });
  }

  // Escape cancels an in-progress guide drag (spec §16): a brand-new guide
  // is removed entirely; an existing guide being moved snaps back to its
  // pre-drag position. Neither path commits a history entry.
  function handleGuideDragKeyDown(event) {
    if (event.key !== "Escape") return;
    const drag = draggingGuideRef.current;
    if (!drag) return;
    endGuideDragListeners();
    draggingGuideRef.current = null;
    if (drag.isNew) {
      setGuides((prev) => prev.filter((g) => g.id !== drag.id));
    } else {
      setGuides((prev) => prev.map((g) => (g.id === drag.id ? { ...g, pos: drag.originalPos } : g)));
    }
  }

  function beginGuideDrag(orientation, existingId = null) {
    if (existingId) {
      const existing = guidesRef.current.find((g) => g.id === existingId);
      if (existing?.locked) return; // spec §19 — locked guides never move
      setSelectedGuideId(existingId);
      draggingGuideRef.current = { id: existingId, orientation, isNew: false, originalPos: existing?.pos ?? 0 };
    } else {
      const guide = createGuide({ pageId: null, orientation, pos: -99999 });
      setGuides((prev) => [...prev, guide]);
      draggingGuideRef.current = { id: guide.id, orientation, isNew: true, originalPos: null };
      setSelectedGuideId(guide.id);
    }
    window.addEventListener("mousemove", handleGuideDragMove);
    window.addEventListener("mouseup", handleGuideDragUp);
    window.addEventListener("keydown", handleGuideDragKeyDown);
  }

  // --- Line/arrow endpoint dragging (LineEndpointHandles.jsx) ---
  // Mirrors the guide-drag pattern above: window-level mousemove/mouseup,
  // one commit() on release. The endpoint NOT being dragged is captured
  // once at drag start and kept fixed for the whole gesture.
  function handleLineEndpointDragMove(event) {
    const drag = lineDragRef.current;
    if (!drag) return;
    const screenPoint = clientToScreen(event.clientX, event.clientY);
    const contentPoint = screenToContent(screenPoint, { scale, x: 0, y: 0 });
    const changes = computeLineChangesForEndpoint(drag, contentPoint);
    updateItem(drag.id, changes, false);
  }

  function handleLineEndpointDragUp(event) {
    const drag = lineDragRef.current;
    window.removeEventListener("mousemove", handleLineEndpointDragMove);
    window.removeEventListener("mouseup", handleLineEndpointDragUp);
    lineDragRef.current = null;
    if (!drag) return;
    const screenPoint = clientToScreen(event.clientX, event.clientY);
    const contentPoint = screenToContent(screenPoint, { scale, x: 0, y: 0 });
    const changes = computeLineChangesForEndpoint(drag, contentPoint);
    updateItem(drag.id, changes, true, { type: "resize", label: "Resize line", itemIds: [drag.id] });
  }

  function computeLineChangesForEndpoint(drag, point) {
    if (drag.endpoint === "end") {
      const dx = point.x - drag.fixed.x;
      const dy = point.y - drag.fixed.y;
      return { width: Math.max(1, Math.hypot(dx, dy)), rotation: (Math.atan2(dy, dx) * 180) / Math.PI };
    }
    const dx = drag.fixed.x - point.x;
    const dy = drag.fixed.y - point.y;
    return {
      x: point.x,
      y: point.y,
      width: Math.max(1, Math.hypot(dx, dy)),
      rotation: (Math.atan2(dy, dx) * 180) / Math.PI,
    };
  }

  function beginLineEndpointDrag(item, endpoint) {
    const { start, end } = getLineEndpointsContent(item);
    lineDragRef.current = { id: item.id, endpoint, fixed: endpoint === "end" ? start : end };
    window.addEventListener("mousemove", handleLineEndpointDragMove);
    window.addEventListener("mouseup", handleLineEndpointDragUp);
  }

  function deleteGuide(id) {
    if (selectedGuideId === id) setSelectedGuideId(null);
    commitGuides((prev) => prev.filter((g) => g.id !== id), { type: "delete-guide", label: "Delete guide" });
  }

  // Delete-key handler wired into useKeyboardShortcuts (spec §22/§88) —
  // returns whether it handled the key, so the hook's generic "delete
  // selected objects" fallback only runs when no guide is selected.
  function deleteSelectedGuide() {
    if (!selectedGuideId) return false;
    const guide = guidesRef.current.find((g) => g.id === selectedGuideId);
    if (!guide || guide.locked) return false;
    deleteGuide(selectedGuideId);
    return true;
  }

  function selectGuide(id) {
    setSelectedGuideId((prev) => (prev === id ? null : id));
  }

  function updateGuide(id, changes) {
    commitGuides((prev) => prev.map((g) => (g.id === id ? { ...g, ...changes } : g)), { type: "edit-guide", label: "Edit guide" });
  }

  function toggleAllGuidesLockedOnPage() {
    const scoped = guidesRef.current.filter((g) => g.pageId === activePageId || g.pageId === null);
    const allLocked = scoped.length > 0 && scoped.every((g) => g.locked);
    commitGuides(
      (prev) => prev.map((g) => (g.pageId === activePageId || g.pageId === null ? { ...g, locked: !allLocked } : g)),
      { type: "edit-guide", label: allLocked ? "Unlock guides" : "Lock guides" }
    );
  }

  function addGuideNumeric({ orientation, pos, pageId, color, locked }) {
    const scopedCount = guidesRef.current.filter((g) => g.pageId === pageId || g.pageId === null).length;
    if (scopedCount >= MAX_GUIDES_PER_PAGE) {
      setStatus(`This page already has the maximum of ${MAX_GUIDES_PER_PAGE} guides — try a layout grid instead.`);
      window.setTimeout(() => setStatus(""), 3500);
      return;
    }
    const guide = createGuide({ orientation, pos, pageId, color, locked });
    commitGuides((prev) => [...prev, guide], { type: "add-guide", label: "Add guide" });
  }

  function clearPageGuides(pageId) {
    commitGuides((prev) => prev.filter((g) => g.pageId !== pageId), { type: "delete-guide", label: "Clear page guides" });
  }

  function clearGuides() {
    commitGuides([], { type: "delete-guide", label: "Clear all guides" });
  }

  function handleCanvasDragOver(event) {
    event.preventDefault();
  }

  // Finds the topmost unlocked, visible, EMPTY-or-filled frame on the
  // active page whose (rotation-ignored, matching bounds.js's existing
  // simplification everywhere else) bounding box contains a content-space
  // point — used so dropping/pasting an image directly over a frame
  // assigns it as that frame's content instead of adding a new standalone
  // image behind it (spec §21/§49).
  function findFrameAtContentPoint(point) {
    const candidates = itemsRef.current.filter(
      (it) => it.pageId === activePageId && it.type === "frame" && !isEffectivelyLocked(it, itemsById) && !isEffectivelyHidden(it, itemsById)
    );
    for (let i = candidates.length - 1; i >= 0; i -= 1) {
      const it = candidates[i];
      if (point.x >= it.x && point.x <= it.x + it.width && point.y >= it.y && point.y <= it.y + it.height) return it;
    }
    return null;
  }

  async function dropAssetAtContentPoint(assetId, contentPoint) {
    const targetFrame = findFrameAtContentPoint(contentPoint);
    if (targetFrame) {
      const meta = await getAssetMeta(assetId);
      setFrameContent(targetFrame.id, assetId, meta);
      return;
    }
    addImageItem(assetId, contentPoint);
  }

  function handleCanvasDrop(event) {
    event.preventDefault();
    const screenPoint = clientToScreen(event.clientX, event.clientY);
    const contentPoint = screenToContent(screenPoint, { scale, x: 0, y: 0 });

    const assetId = event.dataTransfer.getData("application/x-upload-asset-id");
    if (assetId) {
      dropAssetAtContentPoint(assetId, contentPoint);
      return;
    }

    // Raw OS file(s) dragged straight from the desktop/Finder — upload
    // each, then place the first on the page (or into a frame if dropped
    // over one).
    const files = Array.from(event.dataTransfer.files || []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    (async () => {
      for (const [index, file] of files.entries()) {
        const result = await uploadFileToLibrary(file);
        if (!result.id) continue;
        if (index === 0) await dropAssetAtContentPoint(result.id, contentPoint);
      }
    })();
  }

  // Clipboard image paste (spec §48). Ignored while the user is typing/
  // inline-editing text so normal text paste keeps working unaffected.
  // Adds to the active page when the canvas is focused; if the Uploads
  // panel is the active sidebar section, registers the asset without
  // placing it on the page.
  function handleWindowPaste(event) {
    if (isTypingTarget(document.activeElement) || editingTextIdRef.current) return;
    const files = Array.from(event.clipboardData?.files || []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    event.preventDefault();
    (async () => {
      for (const file of files) {
        const named = file.name && file.name !== "image.png" ? file : new File([file], `Pasted image ${new Date().toLocaleString()}.png`, { type: file.type });
        const result = await uploadFileToLibrary(named);
        if (!result.id) continue;
        if (activeSidebarSection !== "uploads") {
          await addImageItem(result.id);
        }
      }
    })();
  }

  useEffect(() => {
    window.addEventListener("paste", handleWindowPaste);
    return () => window.removeEventListener("paste", handleWindowPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSidebarSection]);

  // Stable handlers below are passed to the memoized DesignNode and must
  // never change identity across renders — they read live state via the
  // ref mirrors above instead of closing over items/etc directly.

  // Stable — resolves the current selection to live Konva nodes and binds
  // them to the shared Transformer. Called both from the effect below (on
  // selection/items changes) and directly from registerNode (see there for
  // why: a brand-new node's registration can otherwise fire *after* this
  // effect for the same commit, an ordering React doesn't guarantee across
  // ref-callback-driven registration vs a parent's own effect).
  const syncTransformerNodes = useCallback(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const currentItems = itemsRef.current;
    const itemsByIdNow = new Map(currentItems.map((it) => [it.id, it]));
    // A group has no Konva node of its own (hierarchy.js decision 4) — its
    // selection is expanded to every descendant LEAF, which Konva's native
    // multi-node Transformer already treats as one rigid unit (proven by
    // ordinary multi-select resize/rotate). Lines among those leaves still
    // opt out (see the `usesTransformer` filter below) and are handled
    // separately in handleTransformEnd via the registry's applyMatrix hook.
    const leafIds = expandToLeafIds(currentItems, selectedIdsRef.current);
    const nodes = leafIds
      .filter((id) => {
        const it = itemsByIdNow.get(id);
        if (!it || isEffectivelyLocked(it, itemsByIdNow)) return false;
        // A text object currently being inline-edited hides its handles too
        // (TextEditOverlay is the only interaction surface while editing).
        if (id === editingTextIdRef.current) return false;
        return getTransforms(it).usesTransformer !== false;
      })
      .map((id) => nodesMapRef.current.get(id))
      .filter(Boolean);
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, []);

  const registerNode = useCallback(
    (id, node) => {
      if (node) {
        nodesMapRef.current.set(id, node);
        // A just-added, just-auto-selected object registers itself after
        // the selection-driven effect already ran for this commit — sync
        // immediately rather than leaving the Transformer's handles bound
        // to nothing until some later, unrelated selection change.
        if (selectedIdsRef.current.includes(id)) syncTransformerNodes();
      } else {
        nodesMapRef.current.delete(id);
      }
    },
    [syncTransformerNodes]
  );

  // Click-resolution model (hierarchy.js decision 6): Ctrl/Cmd+click always
  // selects the clicked item directly; otherwise a click resolves up to
  // the outermost ancestor, or to the entered group's immediate child if
  // currently drilled into that group. `additive` (Shift or Ctrl/Cmd,
  // matching the existing multi-select convention) toggles the resolved
  // target in/out of the selection instead of replacing it.
  const handleSelect = useCallback((id, { additive, ctrlKey } = {}) => {
    const resolved = resolveClickSelection(itemsRef.current, id, {
      ctrlKey,
      enteredGroupId: enteredGroupIdRef.current,
    });
    setSelectedIds((prev) => {
      if (additive) {
        if (prev.includes(resolved)) return prev.filter((pid) => pid !== resolved);
        return [...prev, resolved];
      }
      return [resolved];
    });
  }, []);

  const handleItemContextMenu = useCallback((id, nativeEvent) => {
    const resolved = resolveClickSelection(itemsRef.current, id, {
      ctrlKey: nativeEvent.metaKey || nativeEvent.ctrlKey,
      enteredGroupId: enteredGroupIdRef.current,
    });
    // Right-clicking inside an existing multi-selection keeps that whole
    // selection (matches setSelectedIds below); anywhere else it becomes
    // the sole new selection — the menu then anchors to whichever of
    // those ends up selected, not the raw click point.
    const nextSelectedIds = selectedIdsRef.current.includes(resolved) ? selectedIdsRef.current : [resolved];
    if (nextSelectedIds !== selectedIdsRef.current) {
      setSelectedIds(nextSelectedIds);
    }
    const expandedIds = expandToLeafIds(itemsRef.current, nextSelectedIds);
    const targetItems = itemsRef.current.filter((it) => expandedIds.includes(it.id));
    const bounds = targetItems.length ? unionBounds(targetItems.map(getItemBounds)) : null;
    const result = bounds ? contentBoundsToMenuAnchor(bounds) : { x: nativeEvent.clientX, y: nativeEvent.clientY };
    setContextMenu(result);
  }, []);

  const onItemDragStart = useCallback((id, node) => {
    const items = itemsRef.current;
    // If the physically-dragged leaf is part of the current logical
    // selection (expanded through any selected group), the whole
    // expanded set moves together; otherwise just the one leaf does
    // (matches the pre-Phase-5 shape of this check exactly, just against
    // the expanded leaf set instead of the raw selectedIds).
    const expandedSelected = expandToLeafIds(items, selectedIdsRef.current);
    const idsToMove = expandedSelected.includes(id) ? expandedSelected : [id];
    const startPositions = new Map();
    idsToMove.forEach((itemId) => {
      const item = items.find((candidate) => candidate.id === itemId);
      if (item) startPositions.set(itemId, { x: item.x, y: item.y });
    });
    const pointerStartContent = node.getStage().getRelativePointerPosition();
    dragOriginsRef.current = { leaderId: id, startPositions, pointerStartContent };
    setInteractionMode("dragging");
  }, []);

  const onItemDragMove = useCallback((id, node) => {
    const origin = dragOriginsRef.current;
    if (!origin || origin.leaderId !== id) return;
    const start = origin.startPositions.get(id);
    const deltaX = node.x() - start.x;
    const deltaY = node.y() - start.y;

    origin.startPositions.forEach((pos, otherId) => {
      if (otherId === id) return;
      const otherNode = nodesMapRef.current.get(otherId);
      if (otherNode) otherNode.position({ x: pos.x + deltaX, y: pos.y + deltaY });
    });
    node.getLayer()?.batchDraw();
  }, []);

  const onItemDragEnd = useCallback(
    (id, node) => {
      const origin = dragOriginsRef.current;
      if (!origin) return;
      const start = origin.startPositions.get(id);
      const deltaX = node.x() - start.x;
      const deltaY = node.y() - start.y;

      const now = Date.now();
      const movedItems = itemsRef.current.filter((item) => origin.startPositions.has(item.id));
      const affectedParentIds = [...new Set(movedItems.map((item) => item.parentId).filter(Boolean))];
      const next = itemsRef.current.map((item) => {
        if (!origin.startPositions.has(item.id)) return item;
        const s = origin.startPositions.get(item.id);
        return { ...item, x: s.x + deltaX, y: s.y + deltaY, updatedAt: now };
      });
      const movedIds = [...origin.startPositions.keys()];
      commit(recomputeAffectedGroupBounds(next, affectedParentIds), {
        type: "move",
        label: movedIds.length > 1 ? `Move ${movedIds.length} objects` : "Move object",
        itemIds: movedIds,
      });
      dragOriginsRef.current = null;
      setAlignmentLines({ vertical: [], horizontal: [] });
      setEqualSpacing({ horizontal: null, vertical: null });
      setDistanceLabels([]);
      setInteractionMode("idle");
    },
    [commit]
  );

  const dragBoundFunc = useCallback(function dragBoundFunc(pos) {
    const origin = dragOriginsRef.current;
    const id = this.id();
    if (!origin || origin.leaderId !== id) return pos;

    const stage = this.getStage();
    const pointerNow = stage.getRelativePointerPosition();
    if (!pointerNow) return pos;

    const items = itemsRef.current;
    const guides = guidesRef.current;
    const snapToGuides = snapToGuidesRef.current;
    const page = activePageRef.current;
    const scaleNow = scaleRef.current;

    const start = origin.startPositions.get(id);
    const deltaX = pointerNow.x - origin.pointerStartContent.x;
    const deltaY = pointerNow.y - origin.pointerStartContent.y;

    const idsToMove = [...origin.startPositions.keys()];
    const movingBoundsList = idsToMove.map((itemId) => {
      const it = items.find((candidate) => candidate.id === itemId);
      const s = origin.startPositions.get(itemId);
      return getItemBounds({ ...it, x: s.x + deltaX, y: s.y + deltaY });
    });
    const groupBounds = unionBounds(movingBoundsList);
    const leaderContentPos = { x: start.x + deltaX, y: start.y + deltaY };

    // Alt/Option temporarily disables snapping for this drag (spec §43).
    if (isAltDownRef.current) {
      setAlignmentLines({ vertical: [], horizontal: [] });
      setEqualSpacing({ horizontal: null, vertical: null });
      setDistanceLabels([]);
      return contentToScreen(leaderContentPos, STAGE_ABSOLUTE_VIEWPORT);
    }

    const excludeIds = new Set(idsToMove);
    const itemsByIdNow = new Map(items.map((it) => [it.id, it]));
    const pageItemsForSnap = items.filter((item) => item.pageId === page.id && !isEffectivelyHidden(item, itemsByIdNow));
    const relevantGuides = guides.filter((g) => g.pageId === page.id || g.pageId === null);
    const prefs = precisionPrefsRef.current;
    const candidates = collectSnapCandidates({
      page,
      items: pageItemsForSnap,
      excludeIds,
      guides: relevantGuides,
      toggles: { ...prefs, snapToGuides },
    });
    const thresholdContentPx = thresholdForScale(prefs.snapSensitivityPx, scaleNow);
    const siblingBounds = prefs.snapToEqualSpacing
      ? pageItemsForSnap.filter((it) => !excludeIds.has(it.id)).map((it) => ({ ...getItemBounds(it), id: it.id }))
      : [];
    const { dx, dy, lines, equalSpacing: equalSpacingResult } = computeSnap(groupBounds, candidates, thresholdContentPx, siblingBounds);
    setAlignmentLines(lines);
    setEqualSpacing(equalSpacingResult);

    if (prefs.showMeasurementLabels && !equalSpacingResult.horizontal && !equalSpacingResult.vertical) {
      const snappedBounds = { left: groupBounds.left + dx, right: groupBounds.right + dx, top: groupBounds.top + dy, bottom: groupBounds.bottom + dy };
      const labels = [];
      // Measure from whichever edge is nearer on each axis, not always from
      // the page's top-left — otherwise an object dragged toward the right
      // or bottom of the page (its left/top distance easily exceeding a
      // fixed cutoff) never gets a label at all.
      const distLeft = Math.round(snappedBounds.left);
      const distRight = Math.round(page.width - snappedBounds.right);
      const distTop = Math.round(snappedBounds.top);
      const distBottom = Math.round(page.height - snappedBounds.bottom);
      const nearestX = Math.abs(distRight) < Math.abs(distLeft) ? "right" : "left";
      const nearestY = Math.abs(distBottom) < Math.abs(distTop) ? "bottom" : "top";
      const distX = nearestX === "right" ? distRight : distLeft;
      const distY = nearestY === "bottom" ? distBottom : distTop;
      if (distX >= 0) {
        const x = nearestX === "right" ? (snappedBounds.right + page.width) / 2 : snappedBounds.left / 2;
        labels.push({ x, y: (snappedBounds.top + snappedBounds.bottom) / 2, text: String(distX) });
      }
      if (distY >= 0) {
        const y = nearestY === "bottom" ? (snappedBounds.bottom + page.height) / 2 : snappedBounds.top / 2;
        labels.push({ x: (snappedBounds.left + snappedBounds.right) / 2, y, text: String(distY) });
      }
      setDistanceLabels(labels);
    } else {
      setDistanceLabels([]);
    }

    return contentToScreen({ x: leaderContentPos.x + dx, y: leaderContentPos.y + dy }, STAGE_ABSOLUTE_VIEWPORT);
  }, []);

  function handleCanvasContextMenu(event) {
    event.evt.preventDefault();
    setContextMenu({ x: event.evt.clientX, y: event.evt.clientY });
  }

  function handleContextMenuAction(action) {
    switch (action) {
      case "copy":
        copySelection();
        break;
      case "paste":
        pasteClipboard();
        break;
      case "duplicate":
        duplicateSelection();
        break;
      case "delete":
        removeSelection();
        break;
      case "bring-to-front":
        reorderSelection("front");
        break;
      case "bring-forward":
        reorderSelection("forward");
        break;
      case "send-backward":
        reorderSelection("backward");
        break;
      case "send-to-back":
        reorderSelection("back");
        break;
      case "toggle-lock":
        toggleLockSelection();
        break;
      case "remove-background":
        if (selectedItems.length === 1) removeImageBackground(selectedItems[0].id);
        break;
      default:
        break;
    }
  }

  function selectAll() {
    setSelectedIds(pageItems.map((item) => item.id));
  }

  // Arrow keys during crop mode nudge the crop's focal point (the visible
  // image) instead of the object's own position (spec §53); Delete/
  // Backspace never deletes the object while cropping (spec §53 note).
  function nudgeCropFocalPoint(dirX, dirY, size = "standard") {
    const item = itemsRef.current.find((it) => it.id === croppingItemIdRef.current);
    if (!item) return;
    const crop = normalizeCrop(item.crop);
    const step = (size === "large" ? 10 : size === "fine" ? 0.1 : 1) * 0.01;
    updateItem(
      item.id,
      {
        crop: {
          ...crop,
          focalX: Math.max(0, Math.min(1, crop.focalX - dirX * step)),
          focalY: Math.max(0, Math.min(1, crop.focalY - dirY * step)),
        },
      },
      true,
      { type: "crop", label: "Adjust focal point", itemIds: [item.id] }
    );
  }

  // Arrow keys during image-fill edit mode nudge the fill's focal point
  // instead of the object's own position — same reasoning/shape as
  // nudgeCropFocalPoint above.
  function nudgeImageFillPosition(dirX, dirY, size = "standard") {
    const item = itemsRef.current.find((it) => it.id === imageFillEditItemIdRef.current);
    if (!item) return;
    const fillImage = normalizeImageFill(item.fillImage);
    const step = (size === "large" ? 10 : size === "fine" ? 0.1 : 1) * 0.01;
    updateItem(
      item.id,
      {
        fillImage: {
          ...fillImage,
          offsetX: Math.max(0, Math.min(1, fillImage.offsetX - dirX * step)),
          offsetY: Math.max(0, Math.min(1, fillImage.offsetY - dirY * step)),
        },
      },
      true,
      { type: "image-fill", label: "Adjust image fill position", itemIds: [item.id] }
    );
  }

  useKeyboardShortcuts({
    onUndo: undo,
    onRedo: redo,
    onSaveNow: saveNow,
    onCopy: copySelection,
    onPaste: pasteClipboard,
    onCut: cutSelection,
    onDuplicate: duplicateSelection,
    onDelete: () => {
      if (croppingItemId || imageFillEditItemId) return;
      removeSelection();
    },
    onSelectAll: selectAll,
    onDeselect: () => {
      setSelectedIds([]);
      setContextMenu(null);
    },
    onGroup: groupSelection,
    onUngroup: ungroupSelection,
    onNudge: croppingItemId ? nudgeCropFocalPoint : imageFillEditItemId ? nudgeImageFillPosition : nudgeSelection,
    onExitTextEdit: exitTextEdit,
    onBringForward: () => reorderSelection("forward"),
    onSendBackward: () => reorderSelection("backward"),
    onBringToFront: () => reorderSelection("front"),
    onSendToBack: () => reorderSelection("back"),
    onExitGroupEntry: () => {
      if (!enteredGroupId) return false;
      const currentGroup = items.find((it) => it.id === enteredGroupId);
      setEnteredGroupId(currentGroup?.parentId ?? null);
      return true;
    },
    onCancelCrop: () => cancelImageFillEditMode() || cancelCropMode(),
    onToggleRulers: () => setPrecisionPrefs((prev) => ({ ...prev, showRulers: !prev.showRulers })),
    onToggleGuidesVisible: () => setPrecisionPrefs((prev) => ({ ...prev, showGuides: !prev.showGuides })),
    onDeleteSelectedGuide: deleteSelectedGuide,
    onPrint: handlePrint,
  });

  // Enter begins inline editing when exactly one (unlocked) text object is
  // selected and nothing is being edited yet — kept as its own effect
  // (mirrors the existing zoom-shortcut effect below) since it's a
  // one-off key, not part of the generic shortcut set.
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== "Enter" || isTypingTarget(document.activeElement)) return;
      if (editingTextIdRef.current) return;
      const onlySelected = selectedIdsRef.current;
      if (onlySelected.length !== 1) return;
      const item = itemsRef.current.find((it) => it.id === onlySelected[0]);
      if (item?.type === "text" && !item.locked) {
        event.preventDefault();
        enterTextEdit(item.id);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.code === "Space" && !isTypingTarget(document.activeElement)) {
        event.preventDefault();
        setIsSpaceDown(true);
      }
      if (event.key === "Shift") setIsShiftDown(true);
      if (event.key === "Alt") setIsAltDown(true);
    }
    function handleKeyUp(event) {
      if (event.code === "Space") setIsSpaceDown(false);
      if (event.key === "Shift") setIsShiftDown(false);
      if (event.key === "Alt") setIsAltDown(false);
    }
    function handleBlur() {
      // Prevents a modifier from getting "stuck" true if the window loses
      // focus (e.g. an OS shortcut) while the key is physically held.
      setIsSpaceDown(false);
      setIsShiftDown(false);
      setIsAltDown(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // Zoom keyboard shortcuts (Ctrl/Cmd +/-/0). preventDefault stops the
  // browser's own page-zoom from firing on the same combo.
  useEffect(() => {
    function handleKeyDown(event) {
      if (isTypingTarget(document.activeElement)) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key === "=" || event.key === "+") {
        event.preventDefault();
        workspaceRef.current?.zoomIn();
      } else if (event.key === "-") {
        event.preventDefault();
        workspaceRef.current?.zoomOut();
      } else if (event.key === "0") {
        event.preventDefault();
        setHasManualZoomOrPan(false);
        workspaceRef.current?.fitToScreen({ force: true });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    syncTransformerNodes();
  }, [selectedIds, items, editingTextId, syncTransformerNodes]);

  function handleTransformStart() {
    const anchor = transformerRef.current?.getActiveAnchor();
    setInteractionMode(anchor === "rotater" ? "rotating" : "resizing");
    // Capture each currently-selected GROUP's bounds before the gesture —
    // handleTransformEnd uses this to compute an old-box -> new-box delta
    // for any line/arrow descendants, which opt out of this Transformer
    // (see syncTransformerNodes) and so don't move on their own.
    const groupsInSelection = selectedIdsRef.current
      .map((id) => itemsRef.current.find((it) => it.id === id))
      .filter((it) => it?.type === "group");
    groupTransformStartRef.current = groupsInSelection.map((g) => ({
      groupId: g.id,
      box: { x: g.x, y: g.y, width: g.width, height: g.height },
      lineIds: expandToLeafIds(itemsRef.current, [g.id]).filter(
        (id) => itemsRef.current.find((it) => it.id === id)?.type === "line"
      ),
    }));
  }

  function handleTransform() {
    if (transformerRef.current?.getActiveAnchor() !== "rotater") return;
    const nodes = transformerRef.current.nodes();
    if (nodes.length > 0) setRotationAngle(nodes[0].rotation());
  }

  function handleTransformEnd() {
    const transformer = transformerRef.current;
    const nodes = transformer.nodes();
    const now = Date.now();
    const updates = new Map();
    nodes.forEach((node) => {
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      const update = {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        width: Math.max(20, node.width() * scaleX),
        height: Math.max(20, node.height() * scaleY),
        updatedAt: now,
      };
      const sourceItem = items.find((it) => it.id === node.id());
      if (sourceItem?.type === "text") {
        // Font size scales with the box resize — the usual expected
        // behavior for text in a design editor (Phase 5 decision 8),
        // whether the text is resized alone or as part of a group.
        const geometricScale = Math.sqrt(Math.abs(scaleX * scaleY));
        update.fontSize = Math.max(1, (sourceItem.fontSize || 24) * geometricScale);
      }
      updates.set(node.id(), update);
    });

    let next = items.map((item) => (updates.has(item.id) ? { ...item, ...updates.get(item.id) } : item));

    // Carry line/arrow descendants of any transformed group along via a
    // computed old-box -> new-box delta (translate + uniform scale) —
    // see objectRegistry.js's `line.applyMatrix` and the documented
    // large-angle-rotation limitation in the Phase 5 plan.
    const affectedParentIds = new Set();
    groupTransformStartRef.current.forEach(({ groupId, box: oldBox, lineIds }) => {
      const nonLineLeafIds = expandToLeafIds(next, [groupId]).filter((id) => !lineIds.includes(id));
      const nonLineBounds = nonLineLeafIds
        .map((id) => next.find((it) => it.id === id))
        .filter(Boolean)
        .map(getItemBounds);
      const unioned = nonLineBounds.length ? unionBounds(nonLineBounds) : null;
      const newBox = unioned ? { x: unioned.left, y: unioned.top, width: unioned.width, height: unioned.height } : oldBox;
      next = applyGroupDeltaToLines(next, lineIds, oldBox, newBox);
      affectedParentIds.add(groupId);
    });
    groupTransformStartRef.current = [];

    next = recomputeAffectedGroupBounds(next, [...affectedParentIds]);
    const transformedIds = [...updates.keys()];
    const isRotate = interactionMode === "rotating";
    commit(next, {
      type: isRotate ? "rotate" : "resize",
      label: isRotate
        ? transformedIds.length > 1
          ? `Rotate ${transformedIds.length} objects`
          : "Rotate object"
        : transformedIds.length > 1
          ? `Resize ${transformedIds.length} objects`
          : "Resize object",
      itemIds: transformedIds,
    });
    setInteractionMode("idle");
  }

  // --- Page management ---

  // Changing pages clears the old page's selection, exits inline text
  // editing safely (flushing any pending typing transaction first), backs
  // out of any entered group, and closes incompatible menus — per Phase 5
  // section 28. Zoom/pan (`scale`/scroll position) is left untouched here:
  // this app uses one project-wide viewport, not a per-page one (Phase 1
  // behavior, unchanged).
  function activatePage(id) {
    if (editingTextIdRef.current) exitTextEdit();
    // A running page preview is scoped to the page it started on — switch
    // pages out from under it and it'd not only look wrong, it would keep
    // the NEW page's canvas locked/uneditable until the old timer runs out
    // (see the Timeline/AnimationPanel onClose fix above for the same
    // failure mode).
    if (isPreviewPlaying) stopPagePreview();
    setActivePageId(id);
    setSelectedIds([]);
    setEnteredGroupId(null);
    setContextMenu(null);
    setHasManualZoomOrPan(false);
  }

  function addPage(direction = "after") {
    const source = activePage;
    const newPage = {
      id: crypto.randomUUID(),
      name: `Page ${pages.length + 1}`,
      width: source.width,
      height: source.height,
      background: "#ffffff",
      ...defaultPagePrecision(),
    };
    const index = pages.findIndex((page) => page.id === activePageId);
    const insertAt = direction === "before" ? index : index + 1;
    commitPages((prev) => [...prev.slice(0, insertAt), newPage, ...prev.slice(insertAt)], {
      type: "add-page",
      label: "Add page",
      pageIds: [newPage.id],
    });
    activatePage(newPage.id);
  }

  // Duplicates the page's full item hierarchy with every id remapped —
  // groups/children get fresh ids and their parent/child references are
  // remapped together, never reusing an id from the original page.
  function duplicatePage(id) {
    const source = pages.find((page) => page.id === id);
    if (!source) return;
    const newPageId = crypto.randomUUID();
    const newPage = { ...source, id: newPageId, name: `${source.name || "Page"} copy` };
    const index = pages.findIndex((page) => page.id === id);
    const nextPages = [...pages.slice(0, index + 1), newPage, ...pages.slice(index + 1)];

    const sourceItems = items.filter((it) => it.pageId === id);
    const idMap = new Map();
    sourceItems.forEach((it) => idMap.set(it.id, crypto.randomUUID()));
    const now = Date.now();
    const clonedItems = sourceItems.map((it) => ({
      ...it,
      id: idMap.get(it.id),
      pageId: newPageId,
      parentId: idMap.has(it.parentId) ? idMap.get(it.parentId) : null,
      createdAt: now,
      updatedAt: now,
    }));

    commitBoth([...items, ...clonedItems], nextPages, {
      type: "duplicate-page",
      label: "Duplicate page",
      pageIds: [newPageId],
      itemIds: clonedItems.map((it) => it.id),
    });
    activatePage(newPageId);
  }

  function deletePage(id) {
    if (pages.length <= 1) return;
    const index = pages.findIndex((page) => page.id === id);
    const nextPages = pages.filter((page) => page.id !== id);
    // Deleting a page also removes its own objects (including any of its
    // groups) — one combined undo step, no orphaned hierarchy references
    // left behind since every item on that page is gone together.
    const nextItems = items.filter((item) => item.pageId !== id);
    commitBoth(nextItems, nextPages, {
      type: "delete-page",
      label: "Delete page",
      pageIds: [id],
      itemIds: items.filter((item) => item.pageId === id).map((item) => item.id),
    });
    if (activePageId === id) {
      activatePage((nextPages[Math.max(0, index - 1)] || nextPages[0]).id);
    }
  }

  function renamePage(id, name) {
    commitPages((prev) => prev.map((page) => (page.id === id ? { ...page, name } : page)), {
      type: "rename-page",
      label: "Rename page",
      pageIds: [id],
    });
  }

  const reorderPageMeta = (id) => ({ type: "reorder-page", label: "Reorder page", pageIds: [id] });

  function movePageUp(id) {
    commitPages((prev) => {
      const index = prev.findIndex((page) => page.id === id);
      if (index <= 0) return prev;
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    }, reorderPageMeta(id));
  }

  function movePageDown(id) {
    commitPages((prev) => {
      const index = prev.findIndex((page) => page.id === id);
      if (index === -1 || index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    }, reorderPageMeta(id));
  }

  function movePageToStart(id) {
    commitPages((prev) => {
      const page = prev.find((p) => p.id === id);
      if (!page) return prev;
      return [page, ...prev.filter((p) => p.id !== id)];
    }, reorderPageMeta(id));
  }

  function movePageToEnd(id) {
    commitPages((prev) => {
      const page = prev.find((p) => p.id === id);
      if (!page) return prev;
      return [...prev.filter((p) => p.id !== id), page];
    }, reorderPageMeta(id));
  }

  function goToPrevPage() {
    const index = pages.findIndex((page) => page.id === activePageId);
    if (index > 0) activatePage(pages[index - 1].id);
  }

  function goToNextPage() {
    const index = pages.findIndex((page) => page.id === activePageId);
    if (index < pages.length - 1) activatePage(pages[index + 1].id);
  }

  function resizeActivePage(width, height) {
    commitPages((prev) => prev.map((page) => (page.id === activePageId ? { ...page, width, height } : page)), {
      type: "resize-page",
      label: "Resize page",
      pageIds: [activePageId],
    });
    setHasManualZoomOrPan(false);
  }

  function updatePageBackground(pageId, color) {
    commitPages((prev) => prev.map((page) => (page.id === pageId ? { ...page, background: color } : page)), {
      type: "change-background",
      label: "Change background",
      pageIds: [pageId],
    });
  }

  // Page border — additive field like background/precision before it (see
  // migratePageBackgrounds/migratePagePrecision above): old saved pages
  // simply have no `border` key, which every reader below treats as
  // disabled (`page.border?.enabled` is falsy), so no migration step is
  // needed to keep them loading correctly.
  function updatePageBorder(pageId, patch) {
    commitPages(
      (prev) => prev.map((page) => (page.id === pageId ? { ...page, border: { ...page.border, ...patch } } : page)),
      { type: "change-page-border", label: "Change page border", pageIds: [pageId] }
    );
  }

  // Phase 10 — one generic updater for every per-page precision field
  // (grid/margins/safeArea/bleed/layoutGrid/baselineGrid — spec §29/§68).
  // Routed through the EXISTING commitPages (already undoable, already
  // autosaved/recovered/versioned via the pages array) rather than any new
  // persistence plumbing.
  function updateActivePagePrecision(field, changes, label) {
    commitPages(
      (prev) => prev.map((page) => (page.id === activePageId ? { ...page, [field]: { ...page[field], ...changes } } : page)),
      { type: `precision-${field}`, label: label || "Update layout settings", pageIds: [activePageId] }
    );
  }

  function toggleActivePagePrecisionVisible(field) {
    updateActivePagePrecision(field, { visible: !activePage[field].visible }, "Toggle layout overlay");
  }

  function resetPrecisionView() {
    setPrecisionPrefs((prev) => ({ ...prev, showRulers: true, showGuides: true, showSmartGuides: true }));
    commitPages(
      (prev) =>
        prev.map((page) =>
          page.id === activePageId
            ? {
                ...page,
                grid: { ...page.grid, visible: false },
                margins: { ...page.margins, visible: false },
                safeArea: { ...page.safeArea, visible: false },
                bleed: { ...page.bleed, visible: false },
                layoutGrid: { ...page.layoutGrid, visible: false },
                baselineGrid: { ...page.baselineGrid, visible: false },
              }
            : page
        ),
      { type: "precision-reset", label: "Reset precision view", pageIds: [activePageId] }
    );
  }

  // Moves an object (or a whole group's subtree) to another page —
  // preserves relative position, clamping the moved root into the
  // destination page's bounds when it would otherwise fall outside them.
  // A child moved out from its group is detached from that group first
  // (can't leave a group split across two pages); moving a group moves
  // its entire subtree together, hierarchy intact.
  function moveItemToPage(itemId, targetPageId) {
    const item = items.find((it) => it.id === itemId);
    const targetPage = pages.find((p) => p.id === targetPageId);
    if (!item || !targetPage || item.pageId === targetPageId) return;
    const idsToMove = new Set(item.type === "group" ? [itemId, ...getDescendantIds(items, itemId)] : [itemId]);
    const now = Date.now();
    const affectedParentIds = item.parentId ? [item.parentId] : [];

    const clampedX = Math.min(Math.max(item.x, 0), Math.max(0, targetPage.width - item.width));
    const clampedY = Math.min(Math.max(item.y, 0), Math.max(0, targetPage.height - item.height));
    const dx = clampedX - item.x;
    const dy = clampedY - item.y;

    let next = items.map((it) => {
      if (!idsToMove.has(it.id)) return it;
      return {
        ...it,
        pageId: targetPageId,
        parentId: it.id === itemId ? null : it.parentId,
        x: it.x + dx,
        y: it.y + dy,
        updatedAt: now,
      };
    });
    next = recomputeAffectedGroupBounds(next, affectedParentIds);
    commit(next, {
      type: "move-to-page",
      label: "Move object to page",
      itemIds: [...idsToMove],
      pageIds: [item.pageId, targetPageId],
    });
    setSelectedIds((prev) => prev.filter((id) => !idsToMove.has(id)));
  }

  function handleFitToScreen() {
    setHasManualZoomOrPan(false);
    workspaceRef.current?.fitToScreen({ force: true });
  }

  function renderActivePage(page) {
    const konvaWidth = page.width * RENDER_SCALE_CAP;
    const konvaHeight = page.height * RENDER_SCALE_CAP;
    const displayScale = scale / RENDER_SCALE_CAP;
    const pageGuides = guides.filter((g) => precisionPrefs.showGuides && (g.pageId === page.id || g.pageId === null));

    // Pasteboard: the Stage's own canvas is rendered PASTEBOARD_MARGIN_PX
    // larger than the page on every edge, so an object placed exactly
    // where the user drops it — including partly or fully off the page —
    // stays visible instead of vanishing the instant it crosses the page
    // edge (the render surface used to be sized exactly to the page, so
    // there was nothing drawn beyond it). Achieved via the Stage's own
    // x/y offset rather than an inner Layer offset so every existing
    // content-space calculation elsewhere in this file (dragBoundFunc's
    // getRelativePointerPosition deltas, marquee/cursor pos, KONVA_VIEWPORT/
    // contentToScreen for the DOM overlays below, snapping, rulers) keeps
    // treating content (0,0) as the page's top-left with zero changes —
    // only this wrapper + the Stage's own size/position need to know the
    // margin exists. `canvasFrameRef` itself stays exactly page-sized, so
    // ruler alignment and the page-boundary ring in PageSlot are untouched.
    // Exports/thumbnails are unaffected: real export uses a completely
    // separate page-sized offscreen Stage (export/offscreenRenderer.jsx),
    // and captureStagePng() explicitly crops this stage back to the page
    // rect for template thumbnails.
    const pasteboardMarginPx = PASTEBOARD_MARGIN_PX * RENDER_SCALE_CAP;
    const pasteboardWidth = konvaWidth + pasteboardMarginPx * 2;
    const pasteboardHeight = konvaHeight + pasteboardMarginPx * 2;

    return (
      <div
        className="canvas-frame"
        style={{ width: page.width * scale, height: page.height * scale }}
        onDrop={handleCanvasDrop}
        onDragOver={handleCanvasDragOver}
      >
        <div
            ref={canvasFrameRef}
            style={{
              position: "relative",
              width: konvaWidth,
              height: konvaHeight,
              transform: `scale(${displayScale})`,
              transformOrigin: "top left",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: -pasteboardMarginPx,
                top: -pasteboardMarginPx,
                width: pasteboardWidth,
                height: pasteboardHeight,
              }}
            >
              <Stage
                ref={stageRef}
                width={pasteboardWidth}
                height={pasteboardHeight}
                scaleX={RENDER_SCALE_CAP}
                scaleY={RENDER_SCALE_CAP}
                x={pasteboardMarginPx}
                y={pasteboardMarginPx}
                onMouseDown={handleStageMouseDown}
                onMouseMove={handleStageMouseMove}
                onMouseUp={handleStageMouseUp}
                onMouseLeave={handleStageMouseLeave}
                onTouchStart={handleStageMouseDown}
                onContextMenu={handleCanvasContextMenu}
              >
                <Layer>
                <Rect name="canvas-background" x={0} y={0} width={page.width} height={page.height} fill={background} />
                {displayPageItems
                  .filter((item) => item.type !== "group" && !isEffectivelyHidden(item, displayItemsById))
                  .map((item) => (
                    <DesignNode
                      key={item.id}
                      item={item}
                      isSpaceDown={isSpaceDown || isPreviewPlaying}
                      isEditingText={editingTextId === item.id}
                      isLocked={isPreviewPlaying || isEffectivelyLocked(item, displayItemsById)}
                      onSelect={handleSelect}
                      onContextMenu={handleItemContextMenu}
                      onDragStart={onItemDragStart}
                      onDragMove={onItemDragMove}
                      onDragEnd={onItemDragEnd}
                      onItemDblClick={handleItemDblClick}
                      dragBoundFunc={dragBoundFunc}
                      registerNode={registerNode}
                    />
                  ))}
                {activePage?.border?.enabled && (
                  <Rect
                    name="canvas-border"
                    x={0}
                    y={0}
                    width={page.width}
                    height={page.height}
                    stroke={activePage.border.color || "#111827"}
                    strokeWidth={activePage.border.width ?? 4}
                    {...borderDashProps(activePage.border.style, activePage.border.width)}
                    listening={false}
                  />
                )}
                {/* Phase 12 spec §46: preview/playback excludes selection
                    outlines and resize handles entirely. */}
                {!isPreviewPlaying && <Transformer
                  ref={transformerRef}
                  rotateEnabled
                  flipEnabled={false}
                  // Free (unlocked) resize by default for every object
                  // type, including images — Shift is the modifier that
                  // constrains to the original aspect ratio, same as every
                  // other type. Images previously defaulted the other way
                  // (locked unless Shift), which read as rigid/inflexible
                  // once actually resizing an upload on the page.
                  keepRatio={isShiftDown}
                  centeredScaling={isAltDown}
                  rotationSnaps={
                    !precisionPrefs.snapRotation
                      ? []
                      : isShiftDown
                        ? buildRotationSnaps(FINE_ROTATION_STEP)
                        : buildRotationSnaps(precisionPrefs.rotationSnapIncrement)
                  }
                  rotationSnapTolerance={isShiftDown ? 2.5 : 3}
                  rotateAnchorOffset={16}
                  anchorSize={8 / scale}
                  borderStrokeWidth={1.5 / scale}
                  boundBoxFunc={(oldBox, newBox) => {
                    if (newBox.width < 20 || newBox.height < 20) return oldBox;
                    return newBox;
                  }}
                  onTransformStart={handleTransformStart}
                  onTransform={handleTransform}
                  onTransformEnd={handleTransformEnd}
                />}
                </Layer>
              </Stage>
            </div>

            {!isPreviewPlaying && <CanvasOverlays
              pageWidth={page.width}
              pageHeight={page.height}
              viewport={KONVA_VIEWPORT}
              guides={pageGuides}
              selectedGuideId={selectedGuideId}
              onGuideDragStart={(orientation, id) => beginGuideDrag(orientation, id)}
              onGuideDelete={deleteGuide}
              onGuideSelect={selectGuide}
              marquee={marquee}
              grid={page.grid}
              margins={page.margins}
              safeArea={page.safeArea}
              bleed={page.bleed}
              layoutGrid={page.layoutGrid}
              baselineGrid={page.baselineGrid}
              alignmentLines={precisionPrefs.showSmartGuides ? alignmentLines : { vertical: [], horizontal: [] }}
              equalSpacing={precisionPrefs.showSmartGuides ? equalSpacing : { horizontal: null, vertical: null }}
              distanceLabels={distanceLabels}
              unit={activeUnit}
            />}

            {!isPreviewPlaying && !editingTextId && !croppingItemId && !imageFillEditItemId && (
              <SelectionToolbar
                selectionBoundsContent={selectedBoundsContent}
                viewport={KONVA_VIEWPORT}
                frameSize={{ width: konvaWidth, height: konvaHeight }}
                isLocked={isSelectionLocked}
                onDuplicate={duplicateSelection}
                onDelete={removeSelection}
                onForward={() => reorderSelection("forward")}
                onBackward={() => reorderSelection("backward")}
                onToggleLock={toggleLockSelection}
              />
            )}

            <RotationIndicator
              visible={interactionMode === "rotating" && !editingTextId && !croppingItemId && !imageFillEditItemId}
              angle={rotationAngle}
              selectionBoundsContent={selectedBoundsContent}
              viewport={KONVA_VIEWPORT}
            />

            {!editingTextId && !croppingItemId && !imageFillEditItemId && selectedItems.length === 1 && selectedItems[0].type === "line" && !isEffectivelyLocked(selectedItems[0], itemsById) && (
              <LineEndpointHandles
                item={selectedItems[0]}
                viewport={KONVA_VIEWPORT}
                onDragStart={(endpoint) => beginLineEndpointDrag(selectedItems[0], endpoint)}
              />
            )}

            {editingTextId &&
              (() => {
                const editingItem = items.find((it) => it.id === editingTextId);
                if (!editingItem) return null;
                return (
                  <TextEditOverlay
                    key={editingTextId}
                    ref={overlayRef}
                    item={editingItem}
                    viewport={KONVA_VIEWPORT}
                    liveScale={scale}
                    initialClientPoint={pendingCaretPointRef.current}
                    onLiveUpdate={updateEditingTextLive}
                    onCommit={commitEditingText}
                    onRequestExit={exitTextEdit}
                    onMoveLiveChange={moveEditingTextLive}
                    onMoveCommit={commitEditingTextMove}
                  />
                );
              })()}

            {croppingItemId &&
              (() => {
                const croppingItem = items.find((it) => it.id === croppingItemId);
                if (!croppingItem) return null;
                return (
                  <CropOverlay
                    key={croppingItemId}
                    item={croppingItem}
                    viewport={KONVA_VIEWPORT}
                    scale={scale}
                    onLiveChange={(crop) => liveCropChange(croppingItemId, crop)}
                    onRequestExit={applyCropModeAndCommit}
                  />
                );
              })()}

            {imageFillEditItemId &&
              (() => {
                const imageFillItem = items.find((it) => it.id === imageFillEditItemId);
                if (!imageFillItem) return null;
                return (
                  <ImageFillOverlay
                    key={imageFillEditItemId}
                    item={imageFillItem}
                    viewport={KONVA_VIEWPORT}
                    scale={scale}
                    onLiveChange={(fillImage) => liveImageFillChange(imageFillEditItemId, fillImage)}
                    onRequestExit={applyImageFillEditModeAndCommit}
                  />
                );
              })()}

            {contextMenu && (
              <ContextMenu
                position={contextMenu}
                onClose={() => setContextMenu(null)}
                onAction={handleContextMenuAction}
                hasSelection={selectedIds.length > 0}
                hasClipboard={clipboardRef.current.length > 0}
                isLocked={isSelectionLocked}
                canRemoveBackground={
                  selectedItems.length === 1 && selectedItems[0].type === "image" && !!selectedItems[0].assetId
                }
                isRemovingBackground={selectedItems.length === 1 && removingBackgroundId === selectedItems[0].id}
              />
            )}
          </div>
        </div>
      );
  }

  // Derived only when a recovery offer exists — cheap synchronous read of
  // the asset index (see assetStore.js) to count missing references
  // without waiting on IndexedDB (spec §16).
  const recoverySummaryForDialog = recoveryOffer
    ? (() => {
        const assetIndex = listAssetIndex();
        const assetIds = recoveryOffer.snapshot.assetIds || [];
        return {
          createdAt: recoveryOffer.snapshot.createdAt,
          pageCount: recoveryOffer.snapshot.pageCount,
          objectCount: recoveryOffer.snapshot.objectCount,
          assetCount: assetIds.length,
          missingAssetCount: assetIds.filter((id) => !assetIndex[id]).length,
          baseRevision: recoveryOffer.snapshot.baseRevision,
          reason: recoveryOffer.snapshot.reason,
        };
      })()
    : null;
  const savedSummaryForDialog = {
    updatedAt: initialWorkspace.sourceUpdatedAt || null,
    pageCount: pages.length,
    objectCount: items.length,
  };
  const currentMissingAssetCount = (() => {
    const assetIndex = listAssetIndex();
    return [...usedAssetIds].filter((id) => !assetIndex[id]).length;
  })();
  const currentProjectSummary = {
    pageCount: pages.length,
    objectCount: items.length,
    groupCount: items.filter((it) => it.type === "group").length,
    assetCount: usedAssetIds.size,
    revision: saveStatus.revision,
    updatedAt: saveStatus.lastSavedAt,
  };

  // The canvas/editor UI (below) never mounts until a design is chosen —
  // this is a real gate, not an overlay dismissable by clicking past it.
  if (showHomePage) {
    return (
      <>
        <HomePage
          templates={templateSummaries}
          onSelectTemplate={handleSelectTemplate}
          onCreateBlank={createBlankDesign}
          onContinue={() => setShowHomePage(false)}
          hasExistingDesign={items.length > 0 || pages.length > 1 || !!saveStatus.lastSavedAt}
          projectName={projectName}
          lastSavedAt={saveStatus.lastSavedAt}
        />
        <TemplatePreviewDialog
          isOpen={!!previewTemplate}
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onUse={() => previewTemplate?.id && useTemplate(previewTemplate.id)}
          onToggleFavorite={() => previewTemplate?.id && handleToggleTemplateFavorite(previewTemplate.id)}
          onExport={() => previewTemplate?.id && handleExportTemplate(previewTemplate.id)}
        />
      </>
    );
  }

  return (
    <RecentColorsProvider>
    <DocumentColorsProvider items={items}>
    <div className="flex h-screen flex-col overflow-hidden bg-gray-100 text-gray-900">
      {editorMode === "template" && templateSession ? (
        <AdminTemplateEditorToolbar
          templateName={templateSession.templateName}
          onNameChange={templateSession.onNameChange}
          saveStatus={saveStatus.status}
          canUndo={historyCanUndo(historyState)}
          onUndo={undo}
          undoLabel={undoLabel(historyState)}
          canRedo={historyCanRedo(historyState)}
          onRedo={redo}
          redoLabel={redoLabel(historyState)}
          onPreview={handleTemplatePreview}
          onSaveDraft={handleTemplateSaveDraft}
          onSaveAndPublish={handleTemplateSaveAndPublish}
          onCancel={handleTemplateCancel}
          onOpenSettings={templateSession.onOpenSettings}
          publishing={isPublishing}
        />
      ) : (
      <TopNavBar
        projectName={projectName}
        onProjectNameChange={setProjectName}
        canUndo={historyCanUndo(historyState)}
        onUndo={undo}
        undoLabel={undoLabel(historyState)}
        canRedo={historyCanRedo(historyState)}
        onRedo={redo}
        redoLabel={redoLabel(historyState)}
        onSave={saveNow}
        saveStatus={saveStatus.status}
        lastSavedAt={saveStatus.lastSavedAt}
        saveError={saveStatus.lastError}
        storageWarning={storageWarning}
        onRetrySave={retrySave}
        onOpenRecoveryCenter={openRecoveryCenter}
        onOpenVersionHistory={openVersionHistory}
        onOpenTemplateBrowser={openTemplateBrowser}
        onOpenSaveAsTemplate={openSaveAsTemplateDialog}
        onOpenBrandManager={() => setIsBrandManagerOpen(true)}
        onSaveSelectionAsSection={saveSelectionAsReusableSection}
        onSaveActivePageAsReusable={() => savePageAsReusable(activePageId)}
        hasSelection={selectedIds.length > 0}
        onOpenProjectSafety={openProjectSafety}
        onExportProject={exportProject}
        onImportProject={openImportDialog}
        onOpenExport={() => openExportDialog(null)}
        onShareDesign={shareDesign}
        onOpenHome={() => setShowHomePage(true)}
        onPrint={handlePrint}
        onExportPng={() => openExportDialog("png")}
        onExportJpeg={() => openExportDialog("jpeg")}
        onExportPdf={() => openExportDialog("pdf")}
        onExportSvg={() => openExportDialog("svg")}
        onOpenExportAnimation={() => setIsExportAnimationOpen(true)}
        onCopy={copySelection}
        onPaste={pasteClipboard}
        onDuplicate={duplicateSelection}
        onDelete={removeSelection}
        onSelectAll={selectAll}
        showGrid={activePage.grid.visible}
        onToggleGrid={() => toggleActivePagePrecisionVisible("grid")}
        showMargins={activePage.margins.visible}
        onToggleMargins={() => toggleActivePagePrecisionVisible("margins")}
        showBleed={activePage.bleed.visible}
        onToggleBleed={() => toggleActivePagePrecisionVisible("bleed")}
        snapToGuides={snapToGuides}
        onToggleSnapToGuides={() => setSnapToGuides((v) => !v)}
        onClearGuides={clearGuides}
        showRulers={precisionPrefs.showRulers}
        onToggleRulers={() => setPrecisionPrefs((prev) => ({ ...prev, showRulers: !prev.showRulers }))}
        showGuides={precisionPrefs.showGuides}
        onToggleGuidesVisible={() => setPrecisionPrefs((prev) => ({ ...prev, showGuides: !prev.showGuides }))}
        guidesLocked={guides.length > 0 && guides.every((g) => g.locked)}
        onToggleLockAllGuides={toggleAllGuidesLockedOnPage}
        snapEnabled={precisionPrefs.snapToObjects || precisionPrefs.snapToGuides || precisionPrefs.snapToGrid || precisionPrefs.snapToPage}
        onToggleSnap={() =>
          setPrecisionPrefs((prev) => {
            const next = !(prev.snapToObjects || prev.snapToGuides || prev.snapToGrid || prev.snapToPage);
            return { ...prev, snapToObjects: next, snapToPage: next, snapToMargins: next, snapToLayoutGrid: next, snapToEqualSpacing: next };
          })
        }
        showSmartGuides={precisionPrefs.showSmartGuides}
        onToggleSmartGuides={() => setPrecisionPrefs((prev) => ({ ...prev, showSmartGuides: !prev.showSmartGuides }))}
        showSafeArea={activePage.safeArea.visible}
        onToggleSafeArea={() => toggleActivePagePrecisionVisible("safeArea")}
        showLayoutGrid={activePage.layoutGrid.visible}
        onToggleLayoutGrid={() => toggleActivePagePrecisionVisible("layoutGrid")}
        onOpenGuideManager={() => setIsGuideManagerOpen(true)}
        onOpenPrecisionSettings={() => setIsPrecisionSettingsOpen(true)}
        onResetPrecisionView={resetPrecisionView}
        onZoomIn={() => workspaceRef.current?.zoomIn()}
        onZoomOut={() => workspaceRef.current?.zoomOut()}
        onResetZoom={handleFitToScreen}
        onOpenResize={() => setIsResizeOpen(true)}
        onOpenAdmin={() => navigateTo("#/admin")}
      />
      )}

      <PropertiesToolbar
        selectedItems={selectedItems}
        background={background}
        onBackgroundChange={(color) => updatePageBackground(activePageId, color)}
        pageBorder={activePage?.border}
        onPageBorderChange={(patch) => updatePageBorder(activePageId, patch)}
        onUpdateItem={updateItem}
        onUpdateItems={updateItems}
        onReplaceImage={replaceImageSrc}
        hasGroupedSelection={hasGroupedSelection}
        onAlign={alignSelection}
        onDistribute={distributeSelection}
        onAlignToPage={alignSelectionToPage}
        onForward={() => reorderSelection("forward")}
        onBackward={() => reorderSelection("backward")}
        onGroup={groupSelection}
        onUngroup={ungroupSelection}
        onDelete={removeSelection}
        onDuplicate={duplicateSelection}
        onToggleLock={toggleLockSelection}
        onToggleHidden={toggleHiddenSelection}
        onMoveGroupBy={moveGroupBy}
        onSetGroupOpacity={setGroupOpacity}
        editingTextId={editingTextId}
        onEditText={enterTextEdit}
        onExitTextEdit={exitTextEdit}
        onApplyFormat={applyTextFormat}
        onApplyListFormat={applyTextListFormat}
        onCopyTextStyle={copyTextStyle}
        onPasteTextStyle={pasteTextStyle}
        hasCopiedTextStyle={!!copiedTextStyle}
        onClearTextFormatting={clearTextFormatting}
        onApplyProjectTextStyle={applyProjectTextStyle}
        onRemoveFrameContent={removeFrameContent}
        croppingItemId={croppingItemId}
        croppingNaturalSize={(() => {
          const cropItem = items.find((it) => it.id === croppingItemId);
          return cropItem ? { width: cropItem.naturalWidth, height: cropItem.naturalHeight } : null;
        })()}
        onEnterCropMode={enterCropMode}
        onCropCommit={commitCropChange}
        onZoomLiveChange={(itemId, zoom) => {
          const item = itemsRef.current.find((it) => it.id === itemId);
          if (item) liveCropChange(itemId, { ...normalizeCrop(item.crop), zoom });
        }}
        onZoomCommit={commitCropGesture}
        onSetCropAspect={setCropAspectRatio}
        onApplyCrop={applyCropModeAndCommit}
        onCancelCrop={cancelCropMode}
        onEnterImageFillEditMode={enterImageFillEditMode}
        onExitImageFillEditMode={applyImageFillEditModeAndCommit}
        onLiveAdjustments={liveAdjustmentsChange}
        onCommitAdjustments={commitAdjustmentsGesture}
        onRestoreOriginalRatio={restoreOriginalAspectRatio}
        onResetImageEdits={resetImageEdits}
        onBulkFlip={bulkFlipSelection}
        onBulkFilterPreset={(ids, adjustments) => updateItems(ids, { adjustments })}
        unit={activeUnit}
        onTransformBounds={applyMultiSelectionTransform}
        onApplyBrandColorField={applyBrandColorField}
        onDetachBrandColorField={detachBrandColorField}
        onApplyObjectStyle={applyObjectStyleToSelection}
        onCreateObjectStyleFromSelection={createObjectStyleFromSelection}
        onDetachObjectStyle={detachObjectStyleFromSelection}
        onApplyImageStyle={applyImageStyleToSelection}
        onCreateImageStyleFromSelection={createImageStyleFromSelection}
        onDetachImageStyle={detachImageStyleFromSelection}
        onApplyTypographyStyle={applyTypographyStyleToSelection}
        onCreateTypographyFromSelection={createTypographyStyleFromSelection}
        onUpdateTypographyFromSelection={updateTypographyStyleFromSelection}
        onDetachTypographyStyle={detachTypographyStyleFromSelection}
        animationPanelOpen={animationPanelOpen}
        onToggleAnimationPanel={() => setAnimationPanelOpen((v) => !v)}
        hasAnimations={selectedItems.some((it) => it.animations?.length || it.motionPath)}
      />

      <main className="flex flex-1 overflow-hidden">
        <LeftSidebar
          activeSection={activeSidebarSection}
          onSectionChange={(key) => (key === "templates" ? openTemplateBrowser() : setActiveSidebarSection(key))}
          isCompact={isCompact}
        >
          {activeSidebarSection === "uploads" && (
            <UploadsPanel
              onUploadFile={uploadFileToLibrary}
              onAddFromAsset={(assetId) => addImageItem(assetId)}
              onRemoveAsset={removeAssetFromLibrary}
              usedAssetIds={usedAssetIds}
            />
          )}
          {activeSidebarSection === "text" && <TextPanel onAddPreset={(key) => addText(key)} />}
          {activeSidebarSection === "shapes" && <ShapesPanel onAddShape={addShape} onAddLine={addLine} />}
          {activeSidebarSection === "elements" && (
            <ElementsPanel onAddShape={addShape} onAddLine={addLine} onAddFrame={addFrame} />
          )}
          {activeSidebarSection === "icons" && <IconsPanel onAddIcon={addIcon} />}
          {activeSidebarSection === "backgrounds" && (
            <BackgroundsPanel
              background={background}
              onBackgroundChange={(color) => updatePageBackground(activePageId, color)}
              backgroundStyleRef={activePage?.backgroundStyleRef}
              onApplyBrandBackgroundStyle={(styleId) => applyBrandBackgroundStyle(activePageId, styleId)}
            />
          )}
          {activeSidebarSection === "brand" && (
            <BrandPanel
              selectedItems={selectedItems}
              items={items}
              pages={pages}
              onOpenManager={() => setIsBrandManagerOpen(true)}
              onInsertLogo={insertBrandLogo}
              onUploadLogo={uploadLogoToBrandKit}
              onApplyTypography={(styleId) => applyTypographyStyleToSelection(selectedItems[0]?.id, styleId)}
              onCreateTypographyFromSelection={() => createTypographyStyleFromSelection(selectedItems[0]?.id)}
              onApplyObjectStyle={(styleId) => applyObjectStyleToSelection(selectedItems[0]?.id, styleId)}
              onCreateObjectStyleFromSelection={() => createObjectStyleFromSelection(selectedItems[0]?.id)}
              onApplyImageStyle={(styleId) => applyImageStyleToSelection(selectedItems[0]?.id, styleId)}
              onCreateImageStyleFromSelection={() => createImageStyleFromSelection(selectedItems[0]?.id)}
              onApplyBackgroundStyle={(styleId) => applyBrandBackgroundStyle(activePageId, styleId)}
              onOpenThemeDialog={() => setIsThemeDialogOpen(true)}
              onOpenReplaceColors={() => setIsReplaceColorsOpen(true)}
              onOpenReplaceFonts={() => setIsReplaceFontsOpen(true)}
              onOpenBrandAudit={() => setIsBrandAuditOpen(true)}
            />
          )}
          {activeSidebarSection === "layers" && (
            <LayersPanel
              items={items}
              activePageId={activePageId}
              pages={pages}
              selectedIds={selectedIds}
              onSetSelectedIds={setSelectedIds}
              onRename={renameItem}
              onToggleHidden={toggleItemHidden}
              onToggleLocked={toggleItemLocked}
              onReorder={(draggedIds, targetId, position) =>
                commit((prev) => reorderLayerItems(prev, draggedIds, targetId, position), {
                  type: "reorder-layer",
                  label: "Reorder layer",
                  itemIds: draggedIds,
                })
              }
              onGroup={groupSelection}
              onUngroup={ungroupSelection}
              onDuplicate={duplicateSelection}
              onDelete={removeSelection}
              onCopy={copySelection}
              onCut={cutSelection}
              onReorderAction={reorderSelection}
              onMoveToPage={moveItemToPage}
            />
          )}
          {activeSidebarSection === "pages" && (
            <PagesPanel
              pages={pages}
              items={items}
              activePageId={activePageId}
              onActivate={activatePage}
              onAdd={() => addPage()}
              onDuplicate={duplicatePage}
              onDelete={deletePage}
              onRename={renamePage}
              onReorder={(draggedId, targetId) => {
                const fromIndex = pages.findIndex((p) => p.id === draggedId);
                const toIndex = pages.findIndex((p) => p.id === targetId);
                if (fromIndex === -1 || toIndex === -1) return;
                commitPages(
                  (prev) => {
                    const next = [...prev];
                    const [moved] = next.splice(fromIndex, 1);
                    next.splice(toIndex, 0, moved);
                    return next;
                  },
                  { type: "reorder-page", label: "Reorder page", pageIds: [draggedId] }
                );
              }}
              onMoveUp={movePageUp}
              onMoveDown={movePageDown}
              onMoveToStart={movePageToStart}
              onMoveToEnd={movePageToEnd}
              onBackgroundChange={updatePageBackground}
              onOpenResize={(pageId) => {
                if (pageId !== activePageId) activatePage(pageId);
                setIsResizeOpen(true);
              }}
              onSetDuration={setPageDuration}
              onSetTransition={setPageTransition}
              onApplyDurationToAll={applyDurationToAllPages}
              onApplyTransitionToAll={applyTransitionToAllPages}
            />
          )}
          {activeSidebarSection &&
            !["uploads", "text", "shapes", "elements", "icons", "backgrounds", "layers", "pages", "brand"].includes(
              activeSidebarSection
            ) && <ComingSoonPanel title={SECTIONS.find((section) => section.key === activeSidebarSection)?.label} />}
        </LeftSidebar>

        <div className="relative flex flex-1 flex-col overflow-hidden">
          <div className="relative flex flex-1 overflow-hidden">
            {status && (
              <div className="absolute top-4 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
                {status}
              </div>
            )}

            <Workspace
              ref={workspaceRef}
              pages={pages}
              items={items}
              activePageId={activePageId}
              onActivatePage={activatePage}
              scale={scale}
              onScaleChange={setScale}
              autoFit={!hasManualZoomOrPan}
              onManualInteraction={() => setHasManualZoomOrPan(true)}
              isSpaceDown={isSpaceDown}
              renderActivePage={renderActivePage}
              // Rulers are editor chrome, not part of the page/canvas-frame —
              // Workspace positions them around the workspace viewport itself.
              // Phase 12 spec §46: an actively-playing preview excludes
              // rulers too; on narrow viewports there isn't room for the
              // gutters, so they auto-hide there without touching the
              // underlying preference (it reapplies once space allows).
              showRulers={precisionPrefs.showRulers && !isPreviewPlaying && !isCompact}
              unit={activeUnit}
              cursorContentPos={cursorPos}
              onGuideDragStart={beginGuideDrag}
              selectionExtent={
                selectedBoundsContent
                  ? {
                      horizontal: { start: selectedBoundsContent.left, end: selectedBoundsContent.right },
                      vertical: { start: selectedBoundsContent.top, end: selectedBoundsContent.bottom },
                    }
                  : null
              }
            />

            {animationPanelOpen && selectedItems.length >= 1 && (
              <AnimationPanel
                selectedItems={selectedItems}
                page={activePage}
                reducedMotion={reducedMotion}
                onClose={() => {
                  // Closing the panel must always return the canvas to its
                  // normal editable state — leaving playback running with
                  // no visible Stop control would strand the user unable
                  // to select/drag/edit until the animation finishes on
                  // its own.
                  stopPagePreview();
                  setAnimationPanelOpen(false);
                }}
                onApply={applyAnimation}
                onApplyToSelection={applyAnimationToSelection}
                onRemove={removeAnimation}
                onRemoveStage={removeAnimationStage}
                onRemoveAll={removeAllItemAnimations}
                onRemoveAllFromSelection={removeAllAnimationsFromSelection}
                onUpdateTiming={updateAnimationTiming}
                onSetMotionPath={setItemMotionPath}
                onRemoveMotionPath={removeItemMotionPath}
                previewTimeMs={previewTimeMs}
                isPreviewPlaying={isPreviewPlaying}
                onPreviewSeek={seekPagePreview}
                onPreviewPlay={playPagePreview}
                onPreviewPause={pausePagePreview}
                reducedMotionOverride={reducedMotionOverride}
                onSetReducedMotionOverride={setReducedMotionOverride}
              />
            )}
          </div>

          {timelineOpen && (
            <Timeline
              items={items}
              page={activePage}
              selectedIds={selectedIds}
              onSelectIds={setSelectedIds}
              timeMs={previewTimeMs}
              isPlaying={isPreviewPlaying}
              onPlay={playPagePreview}
              onPause={pausePagePreview}
              onStop={stopPagePreview}
              onSeek={seekPagePreview}
              onUpdateAnimation={updateAnimationTiming}
              onRemoveClip={removeAnimation}
              onDuplicateClip={(itemId, animationId) => {
                const item = itemsRef.current.find((it) => it.id === itemId);
                const anim = item?.animations?.find((a) => a.id === animationId);
                if (!item || !anim) return;
                applyAnimation(itemId, anim.stage, anim.presetId, { ...anim, startTime: anim.startTime + anim.duration + 100 });
              }}
              onClose={() => {
                stopPagePreview();
                setTimelineOpen(false);
              }}
              onFitDuration={() => fitPageDurationToContent(activePageId)}
              onClearPage={() => removeAllAnimationsFromPage(activePageId)}
            />
          )}
        </div>
      </main>

      <StatusBar
        pages={pages}
        activePageId={activePageId}
        activePage={activePage}
        onActivatePage={activatePage}
        onPrevPage={goToPrevPage}
        onNextPage={goToNextPage}
        onAddPage={addPage}
        onDuplicatePage={duplicatePage}
        onDeletePage={deletePage}
        onRenamePage={renamePage}
        onMovePageUp={movePageUp}
        onMovePageDown={movePageDown}
        cursorPos={cursorPos}
        selectedBounds={selectedBoundsContent}
        viewportScale={scale}
        onZoomTo={(value) => workspaceRef.current?.zoomTo(value)}
        onZoomIn={() => workspaceRef.current?.zoomIn()}
        onZoomOut={() => workspaceRef.current?.zoomOut()}
        onFitToScreen={handleFitToScreen}
        items={pageItems}
        selectedIds={selectedIds}
        onSelectLayer={handleSelect}
        onToggleHidden={toggleItemHidden}
        onToggleLocked={toggleItemLocked}
        onRenameLayer={renameItem}
        unit={activeUnit}
        onUnitChange={(nextUnit) => setPreferredUnit(nextUnit)}
        timelineOpen={timelineOpen}
        onToggleTimeline={() => setTimelineOpen((v) => !v)}
        onOpenPresentation={() => setIsPresenting(true)}
      />

      {isPresenting && (
        <PresentationMode
          pages={pages}
          items={items}
          presentationSettings={presentationSettings}
          reducedMotion={reducedMotion}
          onUpdatePresentationSettings={updatePresentationSettings}
          initialPageId={activePageId}
          onExit={() => setIsPresenting(false)}
        />
      )}

      <ExportAnimationDialog
        isOpen={isExportAnimationOpen}
        onClose={() => setIsExportAnimationOpen(false)}
        pages={pages}
        items={items}
        activePageId={activePageId}
        projectName={projectName}
        reducedMotion={reducedMotion}
      />

      <ResizeModal
        isOpen={isResizeOpen}
        onClose={() => setIsResizeOpen(false)}
        currentWidth={activePage.width}
        currentHeight={activePage.height}
        onApply={resizeActivePage}
      />

      <GuideManagerDialog
        isOpen={isGuideManagerOpen}
        onClose={() => setIsGuideManagerOpen(false)}
        guides={guides}
        pages={pages}
        activePageId={activePageId}
        unit={activeUnit}
        onAdd={addGuideNumeric}
        onUpdate={updateGuide}
        onDelete={deleteGuide}
        onClearPage={clearPageGuides}
        onClearAll={clearGuides}
      />

      <PrecisionSettingsDialog
        isOpen={isPrecisionSettingsOpen}
        onClose={() => setIsPrecisionSettingsOpen(false)}
        prefs={precisionPrefs}
        onUpdatePrefs={(partial) => setPrecisionPrefs((prev) => normalizePrecisionPrefs({ ...prev, ...partial }))}
        page={activePage}
        pageWidth={activePage.width}
        pageHeight={activePage.height}
        onUpdateGrid={(changes) => updateActivePagePrecision("grid", changes, "Change grid settings")}
        onUpdateMargins={(changes) => updateActivePagePrecision("margins", changes, "Change margins")}
        onUpdateSafeArea={(changes) => updateActivePagePrecision("safeArea", changes, "Change safe area")}
        onUpdateBleed={(changes) => updateActivePagePrecision("bleed", changes, "Change bleed")}
        onUpdateLayoutGrid={(changes) => updateActivePagePrecision("layoutGrid", changes, "Change layout grid")}
        onUpdateBaselineGrid={(changes) => updateActivePagePrecision("baselineGrid", changes, "Change baseline grid")}
        onResetView={resetPrecisionView}
      />

      <RecoveryDialog
        isOpen={!!recoveryOffer}
        recoverySummary={recoverySummaryForDialog}
        savedSummary={savedSummaryForDialog}
        reason={recoveryOffer?.reason}
        onRecover={() => recoveryOffer && handleRecoverLatest(recoveryOffer.snapshot)}
        onOpenSaved={handleOpenSavedVersion}
        onDelete={handleDeleteRecoveryOffer}
      />

      <RecoveryCenter
        isOpen={isRecoveryCenterOpen}
        onClose={() => setIsRecoveryCenterOpen(false)}
        saveStatus={saveStatus.status}
        lastSavedAt={saveStatus.lastSavedAt}
        snapshots={recoverySnapshots}
        onRestore={handleRestoreFromCenter}
        onDelete={handleDeleteFromCenter}
        onDeleteAllUnprotected={handleDeleteAllUnprotectedFromCenter}
        onCreateManualSnapshot={handleCreateManualSnapshotFromCenter}
      />

      <ExportProjectDialog
        isOpen={exportDialogStage !== null}
        stage={exportDialogStage}
        error={exportError}
        onClose={() => setExportDialogStage(null)}
      />

      <ExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        pages={pages}
        activePageId={activePageId}
        items={items}
        projectName={projectName}
        initialFormat={exportDialogFormat}
        onFlushBeforeExport={() => {
          if (editingTextIdRef.current) exitTextEdit();
          autosaveRef.current.flush();
        }}
        onCreateVersionBeforeExport={() => createAutoMilestone("before-export")}
      />

      <ImportProjectDialog
        isOpen={isImportDialogOpen}
        onClose={closeImportDialog}
        onFileSelected={handleImportFileSelected}
        onOpenAsNew={() => finalizeImport(false)}
        onReplaceCurrent={() => finalizeImport(true)}
        preview={importPreview}
        stage={importStage}
        error={importError}
        importProgress={importProgress}
      />

      <VersionHistoryPanel
        isOpen={isVersionHistoryOpen}
        onClose={() => setIsVersionHistoryOpen(false)}
        versions={versions}
        currentSummary={currentProjectSummary}
        onCreateVersion={handleCreateManualVersion}
        onRestore={handleRestoreVersionAction}
        onRename={handleRenameVersionAction}
        onDelete={handleDeleteVersionAction}
      />

      <ProjectSafetyPanel
        isOpen={isProjectSafetyOpen}
        onClose={() => setIsProjectSafetyOpen(false)}
        saveStatus={saveStatus.status}
        lastSavedAt={saveStatus.lastSavedAt}
        saveRevision={saveStatus.revision}
        schemaVersion={PROJECT_SCHEMA_VERSION}
        recoverySnapshotCount={recoverySnapshots.length}
        versionCount={versions.length}
        latestManualVersionAt={versions.find((v) => v.type === "manual")?.createdAt || null}
        missingAssetCount={currentMissingAssetCount}
        unusedAssetInfo={unusedAssetInfo}
        storageEstimate={storageEstimate}
        validationReport={validationReport}
        isValidating={isValidating}
        isCleaning={isCleaning}
        onRetrySave={retrySave}
        onValidateProject={handleValidateProject}
        onApplyRepairs={handleApplyRepairs}
        onCheckUnusedAssets={handleCheckUnusedAssets}
        onDeleteUnusedAssets={handleDeleteUnusedAssets}
        onRebuildThumbnails={handleRebuildThumbnails}
      />

      <TemplateBrowser
        isOpen={isTemplateBrowserOpen}
        onClose={() => setIsTemplateBrowserOpen(false)}
        templates={templateSummaries}
        reusablePages={reusablePages}
        reusableSections={reusableSections}
        onSelectTemplate={handleSelectTemplate}
        onToggleFavorite={handleToggleTemplateFavorite}
        onDeleteTemplate={handleDeleteTemplateAction}
        onDuplicateTemplate={handleDuplicateTemplateAction}
        onCreateBlank={createBlankDesign}
        onInsertPage={insertReusablePage}
        onDeletePage={handleDeleteReusablePage}
        onInsertSection={insertReusableSection}
        onDeleteSection={handleDeleteReusableSection}
      />

      <TemplatePreviewDialog
        isOpen={!!previewTemplate}
        template={previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        // A template-mode Preview (see handleTemplatePreview above) builds a
        // synthetic record with no `id` — it isn't a saved template, so
        // Use/Favorite/Export don't apply; only Close is meaningful there.
        onUse={() => previewTemplate?.id && useTemplate(previewTemplate.id)}
        onToggleFavorite={() => previewTemplate?.id && handleToggleTemplateFavorite(previewTemplate.id)}
        onExport={() => previewTemplate?.id && handleExportTemplate(previewTemplate.id)}
      />

      <SaveAsTemplateDialog
        isOpen={isSaveAsTemplateOpen}
        onClose={() => setIsSaveAsTemplateOpen(false)}
        onSave={handleSaveAsTemplate}
        previewPage={activePage}
        previewItems={pageItems}
        pageCount={pages.length}
        error={saveTemplateError}
      />

      <ConfirmDeleteTemplateDialog
        isOpen={!!deleteTemplateTarget}
        templateName={deleteTemplateTarget?.name}
        onConfirm={confirmDeleteTemplate}
        onCancel={() => setDeleteTemplateTarget(null)}
      />

      <BrandKitManagerDialog isOpen={isBrandManagerOpen} onClose={() => setIsBrandManagerOpen(false)} items={items} pages={pages} />

      <ThemeApplyDialog
        isOpen={isThemeDialogOpen}
        onClose={() => setIsThemeDialogOpen(false)}
        items={items}
        pages={pages}
        activePageId={activePageId}
        selectedPageIds={[activePageId]}
        selectedItemIds={selectedIds}
        onApplyTheme={applyBrandTheme}
      />

      <ReplaceColorsDialog
        isOpen={isReplaceColorsOpen}
        onClose={() => setIsReplaceColorsOpen(false)}
        items={items}
        pages={pages}
        activePageId={activePageId}
        selectedPageIds={[activePageId]}
        onReplace={applyBrandColorReplacement}
      />

      <ReplaceFontsDialog
        isOpen={isReplaceFontsOpen}
        onClose={() => setIsReplaceFontsOpen(false)}
        items={items}
        activePageId={activePageId}
        selectedPageIds={[activePageId]}
        onReplace={applyBrandFontReplacement}
      />

      <BrandAuditDialog
        isOpen={isBrandAuditOpen}
        onClose={() => setIsBrandAuditOpen(false)}
        items={items}
        pages={pages}
        onSelectUsages={selectBrandAuditUsage}
      />
    </div>
    </DocumentColorsProvider>
    </RecentColorsProvider>
  );
}
