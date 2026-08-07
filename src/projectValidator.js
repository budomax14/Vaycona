// Centralized project validator (Phase 7E) — the one place structural
// checks are reported from. Normal load (loadWorkspaceState/
// normalizeParsedWorkspace in App.jsx) already silently defaults/repairs
// as it goes via validateItem + migrateFlatGroupsToGroupObjects +
// repairHierarchy; this module reuses those same primitives (plus
// hierarchy.js/richText.js/imageCrop.js/imageEffects.js) but produces a
// structured REPORT — used by Version History, project-package import
// preview, recovery, and a manual "Validate project" action — instead of
// fixing things invisibly. `repairProject` applies only the unambiguous
// repairs the report calls out.

import { validateHierarchy, repairHierarchy } from "./hierarchy";
import { isValidRichText } from "./richText";
import { normalizeCrop } from "./imageCrop";
import { normalizeAdjustments } from "./imageEffects";
import { REGISTRY } from "./objectRegistry";
import {
  GUIDE_ORIENTATIONS,
  isSafeGuideColorKey,
  normalizePagePrecision,
} from "./precisionDefaults";
import { isSupportedUnit } from "./measurement";
import {
  clampAnimation,
  clampMotionPath,
  clampPageDuration,
  clampTransition,
  clampPresentationSettings,
  MAX_MOTION_PATH_POINTS,
  MIN_MOTION_PATH_POINTS,
} from "./animation/animationSchema";
import { getPreset } from "./animation/animationRegistry";

// Spec §64 — a preset id that no longer resolves (older project, edited-by-
// hand file, future preset removed) falls back to one safe default PER
// STAGE rather than silently vanishing; the original id is preserved under
// customParams so a future preset with that id could still be re-matched.
const FALLBACK_PRESET_BY_STAGE = { entrance: "fadeIn", exit: "fadeOut", emphasis: "pulse", motion: "moveX" };

function resolveAnimationPreset(anim) {
  if (getPreset(anim.presetId)) return anim;
  return {
    ...anim,
    presetId: FALLBACK_PRESET_BY_STAGE[anim.stage] || "fadeIn",
    customParams: { ...(anim.customParams || {}), __unsupportedPresetId: anim.presetId },
  };
}

const SUPPORTED_TYPES = new Set(Object.keys(REGISTRY));

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function pushFinding(list, severity, code, message, ref) {
  list.push({ severity, code, message, ref: ref || null });
}

// `assetIndex` (optional): a Set/object of currently-available asset IDs,
// used only to flag missing references — never to reject the project.
export function validateProject(data, { assetIndex } = {}) {
  const fatalErrors = [];
  const errors = [];
  const warnings = [];
  const repairs = [];
  const info = [];

  const pages = Array.isArray(data?.pages) ? data.pages : null;
  const items = Array.isArray(data?.items) ? data.items : null;

  if (!pages || pages.length === 0) {
    pushFinding(fatalErrors, "fatal", "no-pages", "Project has no pages.");
    return { status: "fatal", fatalErrors, errors, warnings, repairs, info };
  }
  if (!items) {
    pushFinding(fatalErrors, "fatal", "no-items", "Project is missing its object list.");
    return { status: "fatal", fatalErrors, errors, warnings, repairs, info };
  }

  // --- pages ---
  const pageIds = new Set();
  for (const page of pages) {
    if (!page || typeof page.id !== "string") {
      pushFinding(fatalErrors, "fatal", "invalid-page", "A page is missing a valid ID.");
      continue;
    }
    if (pageIds.has(page.id)) pushFinding(errors, "error", "duplicate-page-id", `Duplicate page ID: ${page.id}`, page.id);
    pageIds.add(page.id);
    if (!isFiniteNumber(page.width) || !isFiniteNumber(page.height) || page.width <= 0 || page.height <= 0) {
      pushFinding(warnings, "warning", "invalid-page-size", `Page "${page.name || page.id}" has an invalid size and will use a safe default.`, page.id);
      repairs.push({ code: "page-size-default", message: `Applied a default size to page "${page.name || page.id}".`, ref: page.id });
    }

    // --- Phase 12: page duration / outgoing transition — same
    // "diff against the normalizer" pattern as the precision-fields check
    // below, so range logic lives once in animationSchema.js. ---
    if (page.duration != null && page.duration !== clampPageDuration(page.duration)) {
      pushFinding(warnings, "warning", "invalid-page-duration", `Page "${page.name || page.id}" had an invalid duration and was corrected.`, page.id);
      repairs.push({ code: "fix-page-duration", message: `Corrected duration for page "${page.name || page.id}".`, ref: page.id });
    }
    if (page.transition != null && JSON.stringify(page.transition) !== JSON.stringify(clampTransition(page.transition))) {
      pushFinding(warnings, "warning", "invalid-page-transition", `Page "${page.name || page.id}" had an invalid transition and was reset to a safe value.`, page.id);
      repairs.push({ code: "fix-page-transition", message: `Corrected transition for page "${page.name || page.id}".`, ref: page.id });
    }
  }

  // --- objects: uniqueness, type, page reference, numeric ranges ---
  const idSet = new Set();
  const byId = new Map();
  const animationIdRegistry = new Map(); // animation id -> owning item id (cross-item duplicate detection, spec §65)
  for (const item of items) {
    if (!item || typeof item.id !== "string") {
      pushFinding(errors, "error", "invalid-object", "An object is missing a valid ID and will be skipped.");
      continue;
    }
    if (idSet.has(item.id)) pushFinding(errors, "error", "duplicate-object-id", `Duplicate object ID: ${item.id}`, item.id);
    idSet.add(item.id);
    byId.set(item.id, item);

    if (!SUPPORTED_TYPES.has(item.type)) {
      pushFinding(errors, "error", "unsupported-type", `Object "${item.id}" has an unsupported type ("${item.type}").`, item.id);
    }
    if (!pageIds.has(item.pageId)) {
      pushFinding(warnings, "warning", "invalid-page-ref", `Object "${item.id}" referenced a missing page and will be reassigned.`, item.id);
      repairs.push({ code: "reassign-page", message: `Reassigned object "${item.id}" to a valid page.`, ref: item.id });
    }
    if (!isFiniteNumber(item.x) || !isFiniteNumber(item.y)) {
      pushFinding(warnings, "warning", "invalid-position", `Object "${item.id}" had a non-finite position and was reset to 0,0.`, item.id);
      repairs.push({ code: "reset-position", message: `Reset position for object "${item.id}".`, ref: item.id });
    }
    if (!isFiniteNumber(item.width) || !isFiniteNumber(item.height) || item.width <= 0 || item.height < 0) {
      pushFinding(warnings, "warning", "invalid-size", `Object "${item.id}" had an invalid size and was corrected.`, item.id);
      repairs.push({ code: "clamp-size", message: `Corrected size for object "${item.id}".`, ref: item.id });
    }
    if (item.rotation != null && !isFiniteNumber(item.rotation)) {
      pushFinding(warnings, "warning", "invalid-rotation", `Object "${item.id}" had an invalid rotation and was reset to 0°.`, item.id);
      repairs.push({ code: "reset-rotation", message: `Reset rotation for object "${item.id}".`, ref: item.id });
    }
    if (item.opacity != null && (!isFiniteNumber(item.opacity) || item.opacity < 0 || item.opacity > 1)) {
      pushFinding(warnings, "warning", "invalid-opacity", `Object "${item.id}" had an invalid opacity and was clamped to 0-1.`, item.id);
      repairs.push({ code: "clamp-opacity", message: `Clamped opacity for object "${item.id}".`, ref: item.id });
    }
    if (item.type === "text" && item.richText !== undefined && !isValidRichText(item.richText)) {
      pushFinding(warnings, "warning", "invalid-richtext", `Text object "${item.id}" had an invalid rich-text structure and was reset to plain text.`, item.id);
      repairs.push({ code: "reset-richtext", message: `Reset rich text for object "${item.id}".`, ref: item.id });
    }
    if ((item.type === "image" || item.type === "frame") && assetIndex) {
      const assetId = item.type === "frame" ? item.contentAssetId : item.assetId;
      if (assetId && !assetIndex.has?.(assetId) && !(assetId in (assetIndex || {}))) {
        pushFinding(info, "info", "missing-asset", `${item.type === "frame" ? "Frame" : "Image"} "${item.id}" references a missing image asset.`, item.id);
      }
    }
    if ((item.type === "text" || item.type === "shape") && item.fillImage?.assetId && assetIndex) {
      const assetId = item.fillImage.assetId;
      if (!assetIndex.has?.(assetId) && !(assetId in (assetIndex || {}))) {
        pushFinding(info, "info", "missing-asset", `${item.type === "shape" ? "Shape" : "Text"} "${item.id}" references a missing image fill asset.`, item.id);
      }
    }

    // Phase 11 — brand-kit link fields are always secondary to the item's
    // own literal values (see brandLinks.js's fallback-value design note),
    // so a malformed ref is never fatal: repair just clears the pointer,
    // leaving the object's current appearance untouched. Whether the
    // referenced brand kit/token still actually EXISTS is deliberately not
    // checked here — this validator has no brand-kit data to check against
    // and unresolved refs render fine via the item's own literal fields.
    const isWellFormedRef = (ref, idField) => ref == null || (typeof ref === "object" && typeof ref.brandKitId === "string" && typeof ref[idField] === "string");
    if (item.colorLinks && typeof item.colorLinks === "object") {
      const malformed = Object.entries(item.colorLinks).filter(([, ref]) => !isWellFormedRef(ref, "tokenId"));
      if (malformed.length > 0) {
        pushFinding(warnings, "warning", "malformed-color-link", `Object "${item.id}" had a malformed brand-color link and it was cleared.`, item.id);
        repairs.push({ code: "clear-malformed-color-link", message: `Cleared malformed brand-color link(s) on "${item.id}".`, ref: item.id });
      }
    }
    if (!isWellFormedRef(item.typographyStyleRef, "styleId")) {
      pushFinding(warnings, "warning", "malformed-typography-ref", `Object "${item.id}" had a malformed brand text-style link and it was cleared.`, item.id);
      repairs.push({ code: "clear-malformed-typography-ref", message: `Cleared malformed text-style link on "${item.id}".`, ref: item.id });
    }
    if (!isWellFormedRef(item.objectStyleRef, "styleId")) {
      pushFinding(warnings, "warning", "malformed-object-style-ref", `Object "${item.id}" had a malformed brand object-style link and it was cleared.`, item.id);
      repairs.push({ code: "clear-malformed-object-style-ref", message: `Cleared malformed object-style link on "${item.id}".`, ref: item.id });
    }
    if (!isWellFormedRef(item.imageStyleRef, "styleId")) {
      pushFinding(warnings, "warning", "malformed-image-style-ref", `Object "${item.id}" had a malformed brand image-style link and it was cleared.`, item.id);
      repairs.push({ code: "clear-malformed-image-style-ref", message: `Cleared malformed image-style link on "${item.id}".`, ref: item.id });
    }

    // --- Phase 12: animation assignments ---
    if (item.animations !== undefined) {
      if (!Array.isArray(item.animations)) {
        pushFinding(warnings, "warning", "invalid-animations", `Object "${item.id}" had a corrupted animation list and it was cleared.`, item.id);
        repairs.push({ code: "clear-animations", message: `Cleared corrupted animation list on "${item.id}".`, ref: item.id });
      } else {
        const localAnimIds = new Set();
        let badRefCount = 0;
        let unsupportedPresetCount = 0;
        let timingIssueCount = 0;
        let duplicateIdCount = 0;
        for (const anim of item.animations) {
          if (!anim || typeof anim !== "object") continue;
          if (anim.id && localAnimIds.has(anim.id)) duplicateIdCount++;
          if (anim.id) localAnimIds.add(anim.id);
          if (anim.id && animationIdRegistry.has(anim.id) && animationIdRegistry.get(anim.id) !== item.id) {
            duplicateIdCount++;
          }
          if (anim.id) animationIdRegistry.set(anim.id, item.id);
          if (anim.objectId !== item.id || anim.pageId !== item.pageId) badRefCount++;
          if (!getPreset(anim.presetId)) unsupportedPresetCount++;
          const clamped = clampAnimation(anim);
          if (clamped && JSON.stringify({ ...anim, id: null, objectId: null, pageId: null, updatedAt: null, createdAt: null }) !==
              JSON.stringify({ ...clamped, id: null, objectId: null, pageId: null, updatedAt: null, createdAt: null })) {
            timingIssueCount++;
          }
        }
        if (duplicateIdCount > 0) {
          pushFinding(warnings, "warning", "duplicate-animation-id", `Object "${item.id}" had duplicate animation IDs and they were regenerated.`, item.id);
          repairs.push({ code: "fix-duplicate-animation-id", message: `Regenerated ${duplicateIdCount} duplicate animation ID(s) on "${item.id}".`, ref: item.id });
        }
        if (badRefCount > 0) {
          pushFinding(warnings, "warning", "animation-bad-ref", `Object "${item.id}" had ${badRefCount} animation(s) with a mismatched object/page reference and they were corrected.`, item.id);
          repairs.push({ code: "fix-animation-ref", message: `Corrected ${badRefCount} animation reference(s) on "${item.id}".`, ref: item.id });
        }
        if (unsupportedPresetCount > 0) {
          pushFinding(warnings, "warning", "unsupported-preset", `Object "${item.id}" had ${unsupportedPresetCount} animation(s) using an unrecognized preset — a safe fallback (fade) will be used and the original preset id preserved.`, item.id);
          repairs.push({ code: "fallback-preset", message: `Applied a safe fallback preset to ${unsupportedPresetCount} animation(s) on "${item.id}".`, ref: item.id });
        }
        if (timingIssueCount > 0) {
          pushFinding(warnings, "warning", "animation-timing", `Object "${item.id}" had ${timingIssueCount} animation(s) with unsafe timing/parameter values and they were clamped.`, item.id);
          repairs.push({ code: "clamp-animation-timing", message: `Clamped timing/parameters for ${timingIssueCount} animation(s) on "${item.id}".`, ref: item.id });
        }
      }
    }

    // --- Phase 12: motion path ---
    if (item.motionPath !== undefined && item.motionPath !== null) {
      const mp = item.motionPath;
      const pointCount = Array.isArray(mp?.points) ? mp.points.length : 0;
      if (!clampMotionPath(mp) || pointCount < MIN_MOTION_PATH_POINTS) {
        pushFinding(warnings, "warning", "invalid-motion-path", `Object "${item.id}" had an invalid motion path and it was removed.`, item.id);
        repairs.push({ code: "remove-invalid-motion-path", message: `Removed invalid motion path on "${item.id}".`, ref: item.id });
      } else if (pointCount > MAX_MOTION_PATH_POINTS || JSON.stringify(mp) !== JSON.stringify(clampMotionPath(mp))) {
        pushFinding(warnings, "warning", "motion-path-clamped", `Object "${item.id}"'s motion path exceeded safe limits and was simplified.`, item.id);
        repairs.push({ code: "clamp-motion-path", message: `Simplified motion path on "${item.id}".`, ref: item.id });
      }
      if (mp?.objectId != null && mp.objectId !== item.id) {
        pushFinding(warnings, "warning", "motion-path-bad-ref", `Object "${item.id}"'s motion path referenced a different object and was corrected.`, item.id);
        repairs.push({ code: "fix-motion-path-ref", message: `Corrected motion path reference on "${item.id}".`, ref: item.id });
      }
    }
  }

  // --- hierarchy: reuse the existing validator/repairer directly ---
  const problems = validateHierarchy(items);
  const cycleCount = problems.cyclic.length;
  const orphanCount = new Set([...problems.missingParent, ...problems.crossPage]).size;
  if (cycleCount > 0) {
    pushFinding(warnings, "warning", "hierarchy-cycle", `${cycleCount} object(s) were part of a group cycle and were moved to the top level.`);
    repairs.push({ code: "break-cycle", message: `Broke ${cycleCount} group cycle reference(s).` });
  }
  if (orphanCount > 0) {
    pushFinding(warnings, "warning", "hierarchy-orphan", `${orphanCount} object(s) referenced an invalid parent and were moved to the top level.`);
    repairs.push({ code: "orphan-to-top-level", message: `Moved ${orphanCount} object(s) to the top level.` });
  }

  // --- Phase 10: guides ---
  const guides = Array.isArray(data.guides) ? data.guides : [];
  const guideIdSet = new Set();
  let duplicateGuideIds = 0;
  let missingGuideIds = 0;
  let badGuideOrientation = 0;
  let badGuidePosition = 0;
  let badGuideColor = 0;
  let badGuidePageRef = 0;
  for (const guide of guides) {
    if (!guide || typeof guide.id !== "string" || !guide.id) missingGuideIds++;
    else if (guideIdSet.has(guide.id)) duplicateGuideIds++;
    else guideIdSet.add(guide.id);
    if (!GUIDE_ORIENTATIONS.includes(guide?.orientation)) badGuideOrientation++;
    if (!isFiniteNumber(guide?.pos)) badGuidePosition++;
    if (guide?.color != null && !isSafeGuideColorKey(guide.color)) badGuideColor++;
    if (guide?.pageId != null && !pageIds.has(guide.pageId)) badGuidePageRef++;
  }
  if (missingGuideIds > 0 || duplicateGuideIds > 0) {
    pushFinding(warnings, "warning", "guide-id", `${missingGuideIds + duplicateGuideIds} guide(s) had a missing or duplicate ID and will be assigned a new one.`);
    repairs.push({ code: "fix-guide-ids", message: `Generated fresh IDs for ${missingGuideIds + duplicateGuideIds} guide(s).` });
  }
  if (badGuideOrientation > 0) {
    pushFinding(warnings, "warning", "guide-orientation", `${badGuideOrientation} guide(s) had an invalid orientation and were reset to horizontal.`);
    repairs.push({ code: "fix-guide-orientation", message: `Reset orientation for ${badGuideOrientation} guide(s).` });
  }
  if (badGuidePosition > 0) {
    pushFinding(warnings, "warning", "guide-position", `${badGuidePosition} guide(s) had a non-finite position and were removed.`);
    repairs.push({ code: "remove-invalid-guides", message: `Removed ${badGuidePosition} guide(s) with an invalid position.` });
  }
  if (badGuideColor > 0) {
    pushFinding(warnings, "warning", "guide-color", `${badGuideColor} guide(s) used an unsupported color and were reset to the default.`);
    repairs.push({ code: "fix-guide-color", message: `Reset color for ${badGuideColor} guide(s).` });
  }
  if (badGuidePageRef > 0) {
    pushFinding(warnings, "warning", "guide-page-ref", `${badGuidePageRef} guide(s) referenced a missing page and were removed.`);
    repairs.push({ code: "remove-orphan-guides", message: `Removed ${badGuidePageRef} guide(s) referencing a missing page.` });
  }

  // --- Phase 10: per-page precision fields (grid/margins/safeArea/bleed/
  // layoutGrid/baselineGrid) — normalizePagePrecision already clamps every
  // numeric field to a safe range, so any page whose stored value would
  // change under normalization is reported as repairable rather than
  // re-deriving the same range checks a second time here. ---
  let pagesNeedingPrecisionRepair = 0;
  for (const page of pages) {
    if (!page) continue;
    const normalized = normalizePagePrecision(page);
    const before = JSON.stringify({ grid: page.grid, margins: page.margins, safeArea: page.safeArea, bleed: page.bleed, layoutGrid: page.layoutGrid, baselineGrid: page.baselineGrid });
    const after = JSON.stringify(normalized);
    if (before !== after) pagesNeedingPrecisionRepair++;
  }
  if (pagesNeedingPrecisionRepair > 0) {
    pushFinding(warnings, "warning", "page-precision", `${pagesNeedingPrecisionRepair} page(s) had invalid grid/margin/safe-area/bleed/layout settings and will use safe corrected values.`);
    repairs.push({ code: "fix-page-precision", message: `Corrected precision settings on ${pagesNeedingPrecisionRepair} page(s).` });
  }

  // --- Phase 10: project preferred unit ---
  if (data.preferredUnit != null && !isSupportedUnit(data.preferredUnit)) {
    pushFinding(warnings, "warning", "invalid-unit", `Project's preferred unit ("${data.preferredUnit}") isn't supported and will use pixels.`);
    repairs.push({ code: "fix-preferred-unit", message: "Reset preferred unit to pixels." });
  }

  // --- Phase 12: presentation settings (autoplay/loop/speed/navigation) ---
  if (data.presentationSettings != null && JSON.stringify(data.presentationSettings) !== JSON.stringify(clampPresentationSettings(data.presentationSettings))) {
    pushFinding(warnings, "warning", "invalid-presentation-settings", "Presentation settings had an invalid value and were reset to safe defaults.");
    repairs.push({ code: "fix-presentation-settings", message: "Corrected presentation settings." });
  }

  const status = fatalErrors.length ? "fatal" : errors.length ? "error" : repairs.length ? "repairable" : "ok";
  return { status, fatalErrors, errors, warnings, repairs, info };
}

// Applies only the unambiguous repairs validateProject already reported —
// reuses repairHierarchy/normalizeCrop/normalizeAdjustments rather than a
// second repair implementation. Safe to call even when nothing needs
// fixing (returns the input items/pages, structurally unchanged).
export function repairProject(data) {
  const pageDefaults = { width: 900, height: 620 };
  const validPageIds = new Set((data.pages || []).map((p) => p?.id).filter(Boolean));
  const fallbackPageId = data.pages?.[0]?.id;

  const pages = (data.pages || []).map((page) => ({
    ...page,
    width: isFiniteNumber(page.width) && page.width > 0 ? page.width : pageDefaults.width,
    height: isFiniteNumber(page.height) && page.height > 0 ? page.height : pageDefaults.height,
    ...normalizePagePrecision(page),
    // Phase 12
    ...(page.duration != null ? { duration: clampPageDuration(page.duration) } : {}),
    ...(page.transition != null ? { transition: clampTransition(page.transition) } : {}),
  }));

  // Phase 10 — guides: drop anything with a non-finite position or a
  // page reference to a page that no longer exists (never guessed back
  // onto some other page), then re-key by a fresh ID wherever the
  // original was missing/duplicated.
  const seenGuideIds = new Set();
  const guides = (data.guides || [])
    .filter((g) => g && isFiniteNumber(g.pos) && (g.pageId == null || validPageIds.has(g.pageId)))
    .map((g) => {
      const orientation = GUIDE_ORIENTATIONS.includes(g.orientation) ? g.orientation : "horizontal";
      const color = isSafeGuideColorKey(g.color) ? g.color : undefined;
      const needsFreshId = typeof g.id !== "string" || !g.id || seenGuideIds.has(g.id);
      const id = needsFreshId ? crypto.randomUUID() : g.id;
      seenGuideIds.add(id);
      return { ...g, id, orientation, color };
    });

  const preferredUnit = isSupportedUnit(data.preferredUnit) ? data.preferredUnit : undefined;

  let items = (data.items || []).map((item) => {
    if (!item || typeof item.id !== "string") return item;
    const next = { ...item };
    if (!validPageIds.has(next.pageId)) next.pageId = fallbackPageId;
    if (!isFiniteNumber(next.x)) next.x = 0;
    if (!isFiniteNumber(next.y)) next.y = 0;
    if (!isFiniteNumber(next.width) || next.width <= 0) next.width = 100;
    if (!isFiniteNumber(next.height) || next.height < 0) next.height = 100;
    if (next.rotation != null && !isFiniteNumber(next.rotation)) next.rotation = 0;
    if (next.opacity != null) next.opacity = Math.min(1, Math.max(0, isFiniteNumber(next.opacity) ? next.opacity : 1));
    if (next.type === "text" && next.richText !== undefined && !isValidRichText(next.richText)) next.richText = undefined;
    if (next.crop) next.crop = normalizeCrop(next.crop);
    if (next.adjustments) next.adjustments = normalizeAdjustments(next.adjustments);

    // Phase 11 — clear (never guess-fix) any malformed brand-link ref;
    // the item's own literal fields already hold its current appearance
    // (see brandLinks.js), so clearing the pointer is a fully safe repair.
    const isWellFormedRef = (ref, idField) => ref == null || (typeof ref === "object" && typeof ref.brandKitId === "string" && typeof ref[idField] === "string");
    if (next.colorLinks && typeof next.colorLinks === "object") {
      const cleaned = Object.fromEntries(Object.entries(next.colorLinks).filter(([, ref]) => isWellFormedRef(ref, "tokenId")));
      next.colorLinks = cleaned;
    }
    if (!isWellFormedRef(next.typographyStyleRef, "styleId")) delete next.typographyStyleRef;
    if (!isWellFormedRef(next.objectStyleRef, "styleId")) delete next.objectStyleRef;
    if (!isWellFormedRef(next.imageStyleRef, "styleId")) delete next.imageStyleRef;

    // --- Phase 12: animations — clamp every field, force the id/pageId
    // reference to match this item (animations are always item-owned, see
    // animationService.js), and substitute a safe fallback preset for any
    // id that no longer resolves (spec §64 — original id preserved). ---
    if (Array.isArray(next.animations)) {
      next.animations = next.animations
        .filter((a) => a && typeof a === "object")
        .map((a) => resolveAnimationPreset(clampAnimation({ ...a, objectId: next.id, pageId: next.pageId })));
    } else if (next.animations !== undefined) {
      next.animations = [];
    }

    // --- Phase 12: motion path — drop if geometrically unsafe, otherwise
    // clamp and force the object reference. ---
    if (next.motionPath !== undefined && next.motionPath !== null) {
      const clampedPath = clampMotionPath(next.motionPath);
      next.motionPath = clampedPath ? { ...clampedPath, objectId: next.id } : undefined;
    }

    return next;
  });

  items = repairHierarchy(items);

  // Cross-item duplicate animation IDs (spec §65 "remove duplicate
  // animation ID") — regenerate any id seen on more than one animation
  // across the whole project, after every item's own animations are
  // already clamped above.
  const seenAnimationIds = new Set();
  items = items.map((item) => {
    if (!Array.isArray(item.animations) || item.animations.length === 0) return item;
    let changed = false;
    const nextAnims = item.animations.map((a) => {
      if (seenAnimationIds.has(a.id)) {
        changed = true;
        const fresh = { ...a, id: crypto.randomUUID() };
        seenAnimationIds.add(fresh.id);
        return fresh;
      }
      seenAnimationIds.add(a.id);
      return a;
    });
    return changed ? { ...item, animations: nextAnims } : item;
  });

  const presentationSettings = data.presentationSettings != null ? clampPresentationSettings(data.presentationSettings) : undefined;

  return {
    ...data,
    pages,
    items,
    guides,
    ...(preferredUnit ? { preferredUnit } : {}),
    ...(presentationSettings ? { presentationSettings } : {}),
  };
}
