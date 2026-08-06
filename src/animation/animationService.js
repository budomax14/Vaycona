// Phase 12 — the ONE place animation frames are calculated (spec rule 6:
// "UI components must not calculate animation frames independently").
// Everything here is a pure function of (items, time) — no React, no
// mutation of the durable `items`/`pages` arrays passed in. App.jsx calls
// `computeAnimatedItems` once per rendered frame during preview/playback/
// presentation/animated-export and feeds the RESULT (a plain items array
// with x/y/rotation/scaleX/scaleY/opacity/__animatedCrop overridden) into
// the exact same DesignNode-based renderer used for normal editing — see
// transformCompose.js's header comment for the exact math/order.

import { getAncestorChain } from "../hierarchy";
import { applyEasing } from "./easing";
import {
  ANIMATION_STAGES,
  clampAnimation,
  createAnimationDefaults,
  animationEndTime,
} from "./animationSchema";
import {
  getPreset,
  computeTransformKind,
  computeEmphasisKind,
  computeMotionKind,
  INTENSITY_FACTORS,
} from "./animationRegistry";
import { IDENTITY_DELTA, mergeDeltas, composeRenderState, itemCenter } from "./transformCompose";
import { evaluateMotionPath } from "./motionPath";
import { normalizeCrop } from "../imageCrop";

// --- apply / remove (pure item-array editing helpers; App.jsx wraps the
// result in commit() for history/autosave — spec §17/§18) ---

// Entrance/exit allow at most one active assignment each (deterministic
// composition — spec §9); emphasis/motion may have several (e.g. pulse +
// spin together), each with a stable id.
export function applyAnimationToItem(item, { stage, presetId, pageId, overrides = {} }) {
  const preset = getPreset(presetId);
  const existing = item.animations || [];
  const next =
    stage === "entrance" || stage === "exit"
      ? existing.filter((a) => a.stage !== stage)
      : existing.slice();
  const created = clampAnimation({
    ...createAnimationDefaults({
      objectId: item.id,
      pageId,
      stage,
      presetId,
      category: preset?.category || stage,
      defaultDuration: preset?.defaultDuration,
      defaultEasing: preset?.defaultEasing,
    }),
    direction: preset?.defaultDirection ?? null,
    ...overrides,
  });
  next.push(created);
  return { ...item, animations: next };
}

export function removeAnimationById(item, animationId) {
  return { ...item, animations: (item.animations || []).filter((a) => a.id !== animationId) };
}

export function removeStageAnimations(item, stage) {
  return { ...item, animations: (item.animations || []).filter((a) => a.stage !== stage) };
}

export function removeAllAnimations(item) {
  if (!item.animations?.length && !item.motionPath) return item;
  const { motionPath, ...rest } = item;
  return { ...rest, animations: [] };
}

export function updateAnimation(item, animationId, changes) {
  return {
    ...item,
    animations: (item.animations || []).map((a) => (a.id === animationId ? clampAnimation({ ...a, ...changes }) : a)),
  };
}

// --- per-object delta at time t ---

function intensityFactorOf(anim) {
  return INTENSITY_FACTORS[anim.intensity] ?? 1;
}

function buildCtx(anim, extra = {}) {
  return {
    distance: anim.distance,
    rotationAmount: anim.rotationAmount,
    scaleAmount: anim.scaleAmount,
    opacityFrom: anim.opacityFrom,
    opacityTo: anim.opacityTo,
    direction: anim.direction,
    intensityFactor: intensityFactorOf(anim),
    ...extra,
  };
}

// Reduced motion (spec §53): entrance/exit substitute the preset's
// registered fallback (normally "fade"); emphasis/motion with no fallback
// are simply skipped (object stays in its rest state) rather than forced
// into a jarring instant snap.
function effectivePresetId(anim, reducedMotion) {
  if (!reducedMotion) return anim.presetId;
  const preset = getPreset(anim.presetId);
  return preset?.reducedMotionFallback || anim.presetId;
}

// One entry's contribution to an item's total delta at absolute page-time
// `t` (ms). Returns IDENTITY_DELTA when the entry isn't currently active.
function evaluateSingleAnimation(anim, t, { reducedMotion } = {}) {
  if (!anim.enabled) return IDENTITY_DELTA;
  const activeStart = anim.startTime + anim.delay;
  const repeat = Math.max(1, anim.repeatCount || 1);
  const oneCycle = Math.max(1, anim.duration);
  const activeEnd = activeStart + oneCycle * repeat;

  // Unknown/unimported preset ids are expected to already have been
  // substituted with a safe fallback at load time (projectValidator.js's
  // repair pass, spec §64) — here we just decline to render anything for a
  // still-unresolvable id rather than guessing.
  const resolvedPresetId = effectivePresetId(anim, reducedMotion);
  const resolvedPreset = getPreset(resolvedPresetId) || getPreset(anim.presetId);
  if (!resolvedPreset) return IDENTITY_DELTA;

  if (reducedMotion && !resolvedPreset.reducedMotionFallback && (anim.stage === "emphasis" || anim.stage === "motion")) {
    return IDENTITY_DELTA;
  }

  if (t < activeStart) {
    // Not started yet: entrance objects stay in their fully-hidden state
    // (progress 0) so they don't "pop in" one frame early; exit/emphasis/
    // motion objects simply haven't begun, i.e. identity.
    if (anim.stage === "entrance") {
      const ctx = buildCtx(anim);
      return toDelta(computeTransformKind(resolvedPreset.kind, 0, ctx));
    }
    return IDENTITY_DELTA;
  }

  if (t >= activeEnd) {
    if (anim.stage === "entrance") return IDENTITY_DELTA; // finished -> rest state
    if (anim.stage === "exit") {
      const ctx = buildCtx(anim);
      const holdDelta = toDelta(computeTransformKind(resolvedPreset.kind, 0, ctx));
      return anim.exitBehavior === "holdLastFrame" ? holdDelta : { ...holdDelta, opacityFactor: 0 };
    }
    if (anim.stage === "emphasis" && anim.loopBehavior === "loop") {
      // repeatCount exhausted but "loop" behavior keeps cycling indefinitely.
    } else if (anim.stage === "motion" && anim.loopBehavior === "loop") {
      // same — falls through to the cyclic evaluation below.
    } else {
      return IDENTITY_DELTA;
    }
  }

  const elapsed = t - activeStart;
  const cycleIndex = Math.floor(elapsed / oneCycle);
  let localT = (elapsed % oneCycle) / oneCycle;
  if (anim.loopBehavior === "pingpong" && cycleIndex % 2 === 1) localT = 1 - localT;
  const eased = applyEasing(anim.easing, localT);
  const ctx = buildCtx(anim);

  if (anim.stage === "entrance") return toDelta(computeTransformKind(resolvedPreset.kind, eased, ctx));
  if (anim.stage === "exit") return toDelta(computeTransformKind(resolvedPreset.kind, 1 - eased, ctx));
  if (anim.stage === "emphasis") return toDelta(computeEmphasisKind(resolvedPreset.kind, localT, ctx));
  if (anim.stage === "motion") {
    if (resolvedPreset.kind === "customMotionPath") return IDENTITY_DELTA; // handled separately (needs item base + path)
    return toDelta(computeMotionKind(resolvedPreset.kind, localT, ctx));
  }
  return IDENTITY_DELTA;
}

function toDelta(partial) {
  return {
    dx: partial.dx || 0,
    dy: partial.dy || 0,
    drotation: partial.drotation || 0,
    scale: partial.scale ?? 1,
    opacityFactor: partial.opacityFactor ?? 1,
  };
}

// Motion-path contribution — separate because it needs the item's own base
// center (path points describe absolute page-space destinations, not a
// relative offset) rather than just the preset's generic ctx.
function evaluateMotionPathDelta(item, anim, t, base) {
  const path = item.motionPath;
  if (!path || !path.points || path.points.length < 2) return IDENTITY_DELTA;
  const activeStart = anim.startTime + anim.delay;
  const repeat = Math.max(1, anim.repeatCount || 1);
  const oneCycle = Math.max(1, anim.duration);
  const activeEnd = activeStart + oneCycle * repeat;
  if (t < activeStart) return IDENTITY_DELTA;
  const clampedT = Math.min(t, anim.loopBehavior === "none" ? activeEnd : t);
  const elapsed = clampedT - activeStart;
  const cycleIndex = Math.floor(elapsed / oneCycle);
  let localT = (elapsed % oneCycle) / oneCycle;
  if (t >= activeEnd && anim.loopBehavior !== "loop" && anim.loopBehavior !== "pingpong") localT = 1;
  if (anim.loopBehavior === "pingpong" && cycleIndex % 2 === 1) localT = 1 - localT;
  const eased = applyEasing(anim.easing, localT);
  const point = evaluateMotionPath(path, eased);
  // The item's CENTER is placed directly at the path point (path points
  // are absolute page coordinates, not a relative offset) — delta is
  // expressed relative to the item's own base center per transformCompose's
  // convention.
  const center = itemCenter(base);
  const delta = { ...IDENTITY_DELTA, dx: point.x - center.x, dy: point.y - center.y };
  if (path.orientToPath) delta.drotation = point.angle - (base.rotation || 0);
  return delta;
}

// Sums every active stage on one item at time t, in the fixed order
// entrance -> motion -> emphasis -> exit (spec §9/§10: deterministic
// composition, translation/rotation add, scale/opacity multiply).
export function getItemOwnDelta(item, base, t, opts = {}) {
  const anims = item.animations || [];
  let total = IDENTITY_DELTA;
  const order = ["entrance", "motion", "emphasis", "exit"];
  for (const stage of order) {
    for (const anim of anims.filter((a) => a.stage === stage)) {
      const preset = getPreset(anim.presetId);
      const delta =
        stage === "motion" && preset?.kind === "customMotionPath"
          ? evaluateMotionPathDelta(item, anim, t, base)
          : evaluateSingleAnimation(anim, t, opts);
      total = mergeDeltas(total, delta);
    }
  }
  return total;
}

// --- ancestor-chain propagation (spec §10/§24 — see transformCompose.js
// header for the full derivation) ---

function baseCenterOf(item) {
  return itemCenter(item);
}

export function computeAncestorComposedState(itemId, itemsById, t, opts = {}) {
  const chain = getAncestorChain([...itemsById.values()], itemId); // [item, parent, ..., topmost]
  const ordered = [...chain].reverse(); // [topmost, ..., item]

  let accCenter = null;
  let accRotationDelta = 0;
  let accScale = 1;
  let accOpacity = 1;
  let prevBase = null;

  for (const id of ordered) {
    const obj = itemsById.get(id);
    if (!obj) continue;
    const base = baseCenterOf(obj);
    const ownDelta = getItemOwnDelta(obj, obj, t, opts);

    if (accCenter === null) {
      accCenter = { x: base.x + ownDelta.dx, y: base.y + ownDelta.dy };
      accRotationDelta = ownDelta.drotation;
      accScale = ownDelta.scale;
      accOpacity = ownDelta.opacityFactor;
    } else {
      const relVec = { x: base.x - prevBase.x, y: base.y - prevBase.y };
      const rad = (accRotationDelta * Math.PI) / 180;
      const rotatedScaled = {
        x: accScale * (relVec.x * Math.cos(rad) - relVec.y * Math.sin(rad)),
        y: accScale * (relVec.x * Math.sin(rad) + relVec.y * Math.cos(rad)),
      };
      const structural = { x: accCenter.x + rotatedScaled.x, y: accCenter.y + rotatedScaled.y };
      accCenter = { x: structural.x + ownDelta.dx, y: structural.y + ownDelta.dy };
      accRotationDelta += ownDelta.drotation;
      accScale *= ownDelta.scale;
      accOpacity *= ownDelta.opacityFactor;
    }
    prevBase = base;
  }

  const item = itemsById.get(itemId);
  if (!item || accCenter === null) return null;
  const totalDelta = { dx: accCenter.x - baseCenterOf(item).x, dy: accCenter.y - baseCenterOf(item).y, drotation: accRotationDelta, scale: accScale, opacityFactor: accOpacity };
  return composeRenderState(item, totalDelta);
}

// --- Ken Burns / image crop animation (spec §26) ---

const PAN_RANGE_BASE = 0.16;

function computeCropDeltaForItem(item, t) {
  const anims = (item.animations || []).filter((a) => a.stage === "motion" && a.enabled);
  const baseCrop = normalizeCrop(item.crop);
  for (const anim of anims) {
    const preset = getPreset(anim.presetId);
    if (!preset || !["cropZoomIn", "cropZoomOut", "cropPan"].includes(preset.kind)) continue;
    const activeStart = anim.startTime + anim.delay;
    const activeEnd = activeStart + anim.duration;
    if (t < activeStart || t > activeEnd) continue;
    const localT = Math.min(1, Math.max(0, (t - activeStart) / Math.max(1, anim.duration)));
    const eased = applyEasing(anim.easing, localT);
    const intensity = INTENSITY_FACTORS[anim.intensity] ?? 1;

    if (preset.kind === "cropZoomIn" || preset.kind === "cropZoomOut") {
      const zoomFrom = baseCrop.zoom;
      const zoomTo = baseCrop.zoom * (1 + 0.4 * intensity);
      const zoom = preset.kind === "cropZoomIn" ? lerp(zoomFrom, zoomTo, eased) : lerp(zoomTo, zoomFrom, eased);
      return { ...baseCrop, zoom };
    }
    // cropPan
    const zoom = Math.max(baseCrop.zoom, 1 + 0.15 * intensity);
    const range = PAN_RANGE_BASE * intensity;
    const axis = anim.direction === "up" || anim.direction === "down" ? "focalY" : "focalX";
    const reverse = anim.direction === "right" || anim.direction === "down";
    const from = 0.5 - range;
    const to = 0.5 + range;
    const value = reverse ? lerp(from, to, eased) : lerp(to, from, eased);
    return { ...baseCrop, zoom, [axis]: Math.min(1, Math.max(0, value)) };
  }
  return null;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// --- top-level entry point ---

// Returns a NEW array of items for `pageId`, each with x/y/rotation/
// scaleX/scaleY/opacity overridden to their animated state at `timeMs`,
// plus `__animatedCrop` set on image/frame items with an active pan/zoom
// preset. Items on other pages, and group bookkeeping items, pass through
// unchanged (DesignNode already skips rendering groups). Never mutates its
// input.
export function computeAnimatedItems(items, pageId, timeMs, { reducedMotion = false } = {}) {
  const pageItems = items.filter((it) => it.pageId === pageId);
  const itemsById = new Map(pageItems.map((it) => [it.id, it]));
  const opts = { reducedMotion };
  return items.map((item) => {
    if (item.pageId !== pageId || item.type === "group") return item;
    const state = computeAncestorComposedState(item.id, itemsById, timeMs, opts);
    if (!state) return item;
    const cropOverride = item.type === "image" || item.type === "frame" ? computeCropDeltaForItem(item, timeMs) : null;
    return {
      ...item,
      x: state.x,
      y: state.y,
      rotation: state.rotation,
      scaleX: state.scaleX,
      scaleY: state.scaleY,
      opacity: state.opacity,
      ...(cropOverride ? { __animatedCrop: cropOverride } : null),
    };
  });
}

// --- static export default frame (spec §67/§68) ---

// "Fully visible final design state" — the instant every entrance
// animation on the page has finished and no exit has yet begun. For a page
// with no animations this is exactly 0, so a non-animated project's static
// export is byte-for-byte identical to before this phase.
export function defaultStaticFrameTime(items, pageId) {
  let latestEntranceEnd = 0;
  let earliestExitStart = Infinity;
  for (const item of items) {
    if (item.pageId !== pageId) continue;
    for (const anim of item.animations || []) {
      if (!anim.enabled) continue;
      if (anim.stage === "entrance") latestEntranceEnd = Math.max(latestEntranceEnd, anim.startTime + anim.delay + anim.duration);
      if (anim.stage === "exit") earliestExitStart = Math.min(earliestExitStart, anim.startTime + anim.delay);
    }
  }
  return Math.min(latestEntranceEnd, Number.isFinite(earliestExitStart) ? earliestExitStart : Infinity);
}

// Resolves every page's items to their default static frame (spec §67-68)
// — used by the static (PNG/JPEG/PDF/SVG) export pipeline right before
// rendering. A no-op for any page with no animations.
export function resolveStaticExportItems(items, pages) {
  return pages.reduce((acc, page) => {
    const t = defaultStaticFrameTime(items, page.id);
    if (t === 0) return acc; // nothing to resolve — avoids an unnecessary full-array copy
    const resolvedForPage = computeAnimatedItems(acc, page.id, t, { reducedMotion: false });
    return resolvedForPage;
  }, items);
}

// --- auto-fit page duration (spec §31) ---

export function latestAnimationEndTime(items, pageId) {
  let max = 0;
  for (const item of items) {
    if (item.pageId !== pageId) continue;
    for (const anim of item.animations || []) {
      if (!anim.enabled) continue;
      max = Math.max(max, animationEndTime(anim));
    }
  }
  return max;
}

// --- deterministic stagger sequencing (spec §20/§21) ---

// order: array of item ids already sorted the way the caller wants
// (selection order / layer order / left-to-right / etc. — App.jsx derives
// that ordering; this function only turns an ORDER into TIMES).
export function computeStaggerStartTimes(orderedIds, { baseStartTime = 0, staggerDelayMs = 150, reverseOrder = false } = {}) {
  const ids = reverseOrder ? [...orderedIds].reverse() : orderedIds;
  const map = new Map();
  ids.forEach((id, i) => map.set(id, baseStartTime + i * staggerDelayMs));
  return map;
}

// --- conflict detection (spec §84) — returns human-readable warnings, no
// silent timing changes. ---

export function detectAnimationConflicts(item, pageDurationMs) {
  const warnings = [];
  const anims = item.animations || [];
  const entrance = anims.find((a) => a.stage === "entrance");
  const exit = anims.find((a) => a.stage === "exit");
  if (entrance && exit) {
    const entranceEnd = entrance.startTime + entrance.delay + entrance.duration;
    const exitStart = exit.startTime + exit.delay;
    if (exitStart < entranceEnd) {
      warnings.push({ code: "entrance-exit-overlap", message: "Exit begins before entrance finishes.", animationIds: [entrance.id, exit.id] });
    }
  }
  for (const anim of anims) {
    if (!anim.enabled) continue;
    const end = animationEndTime(anim);
    if (end > pageDurationMs) {
      warnings.push({ code: "exceeds-page-duration", message: "This animation extends past the page duration.", animationIds: [anim.id] });
    }
  }
  const motionAndPath = anims.filter((a) => a.stage === "motion");
  if (motionAndPath.length > 1) {
    warnings.push({ code: "multiple-motion", message: "Multiple motion animations on one object may compete.", animationIds: motionAndPath.map((a) => a.id) });
  }
  return warnings;
}

export { ANIMATION_STAGES };
