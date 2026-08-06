// Phase 12 — durable animation data model: safe defaults, numeric limits,
// and pure clamp/validate helpers for every animation-related record type
// (per-object animation assignments, motion paths, page duration/
// transition, presentation settings). Nothing here touches React or Konva —
// this is the schema layer animationService.js, timelineService.js,
// transitionService.js and projectValidator.js all build on, so "what a
// valid animation record looks like" is defined exactly once (spec rule 6/
// §4: "validate all numeric values", "do not use raw executable JS
// expressions in project data").

import { EASING_IDS, DEFAULT_EASING, resolveEasingId } from "./easing";

// --- safe limits (spec §12/§65) ---

export const MIN_ANIMATION_DURATION_MS = 50; // 0.05s
export const MAX_ANIMATION_DURATION_MS = 20_000; // 20s — generous, bounds runaway values
export const MAX_ANIMATION_DELAY_MS = 30_000;
export const MAX_START_TIME_MS = 600_000; // 10 minutes into a page — generous ceiling
export const MAX_REPEAT_COUNT = 50;

export const DEFAULT_PAGE_DURATION_MS = 5000;
export const MIN_PAGE_DURATION_MS = 500;
export const MAX_PAGE_DURATION_MS = 300_000; // 5 minutes

export const DEFAULT_TRANSITION_DURATION_MS = 500;
export const MIN_TRANSITION_DURATION_MS = 50;
export const MAX_TRANSITION_DURATION_MS = 5000;

export const MAX_MOTION_PATH_POINTS = 20;
export const MIN_MOTION_PATH_POINTS = 2;
export const MOTION_PATH_BOUNDS_MARGIN = 4000; // px beyond a page edge a point may safely sit

export const ANIMATION_STAGES = ["entrance", "exit", "emphasis", "motion"];
export const DIRECTIONS = [
  "left", "right", "up", "down", "inward", "outward", "clockwise", "counterclockwise",
];
export const INTENSITIES = ["subtle", "medium", "strong"];
export const LOOP_BEHAVIORS = ["none", "loop", "pingpong"];
export const TRIGGER_MODES = ["auto"]; // click/manual triggers are out of scope this phase (documented limitation)
export const EXIT_BEHAVIORS = ["remove", "holdLastFrame"];
export const TRANSITION_TYPES = [
  "none", "fade", "dissolve", "slideLeft", "slideRight", "slideUp", "slideDown", "push", "wipe", "zoom",
];
export const PRESENTATION_LOOP_MODES = ["none", "page", "presentation"];
export const PRESENTATION_NAV_MODES = ["manual", "autoplay"];
export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function safeId() {
  return crypto.randomUUID();
}

// customParams: bounded, JSON-safe key/value bag only — no functions, no
// nested objects beyond one level, string/number/boolean values only
// (spec §89 "do not accept JavaScript easing functions" generalized to
// "never accept executable content in imported/custom params").
export function sanitizeCustomParams(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  let count = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (count >= 20) break;
    if (typeof key !== "string" || key.length > 60) continue;
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "string") out[key] = value.slice(0, 200);
    else if (typeof value === "boolean") out[key] = value;
    count += 1;
  }
  return out;
}

// --- animation assignment record ---

export function createAnimationDefaults({ objectId, pageId, stage, presetId, category, defaultDuration, defaultEasing }) {
  return {
    id: safeId(),
    objectId,
    pageId,
    stage,
    presetId,
    category: category || stage,
    startTime: 0,
    delay: 0,
    duration: clamp(defaultDuration, MIN_ANIMATION_DURATION_MS, MAX_ANIMATION_DURATION_MS, 500),
    easing: resolveEasingId(defaultEasing || DEFAULT_EASING),
    direction: null,
    intensity: "medium",
    distance: null,
    rotationAmount: null,
    scaleAmount: null,
    opacityFrom: null,
    opacityTo: null,
    repeatCount: 1,
    loopBehavior: "none",
    staggerGroupId: null,
    staggerIndex: 0,
    triggerMode: "auto",
    exitBehavior: "remove",
    customParams: {},
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Clamps every numeric/enum field to a safe range — used both when a user
// edits timing in the panel/timeline and when validating imported data
// (spec §65's "clamp negative start time / replace zero duration / clamp
// excessive duration / normalize repeat count").
export function clampAnimation(anim) {
  if (!anim || typeof anim !== "object") return null;
  const stage = ANIMATION_STAGES.includes(anim.stage) ? anim.stage : "entrance";
  return {
    id: typeof anim.id === "string" && anim.id ? anim.id : safeId(),
    objectId: anim.objectId,
    pageId: anim.pageId,
    stage,
    presetId: typeof anim.presetId === "string" ? anim.presetId : "fade",
    category: typeof anim.category === "string" ? anim.category : stage,
    startTime: clamp(anim.startTime, 0, MAX_START_TIME_MS, 0),
    delay: clamp(anim.delay, 0, MAX_ANIMATION_DELAY_MS, 0),
    duration: clamp(anim.duration, MIN_ANIMATION_DURATION_MS, MAX_ANIMATION_DURATION_MS, 500),
    easing: resolveEasingId(anim.easing),
    direction: DIRECTIONS.includes(anim.direction) ? anim.direction : null,
    intensity: INTENSITIES.includes(anim.intensity) ? anim.intensity : "medium",
    distance: anim.distance == null ? null : clamp(anim.distance, 0, 4000, null),
    rotationAmount: anim.rotationAmount == null ? null : clamp(anim.rotationAmount, -3600, 3600, null),
    scaleAmount: anim.scaleAmount == null ? null : clamp(anim.scaleAmount, 0.01, 20, null),
    opacityFrom: anim.opacityFrom == null ? null : clamp(anim.opacityFrom, 0, 1, null),
    opacityTo: anim.opacityTo == null ? null : clamp(anim.opacityTo, 0, 1, null),
    repeatCount: Math.round(clamp(anim.repeatCount, 1, MAX_REPEAT_COUNT, 1)),
    loopBehavior: LOOP_BEHAVIORS.includes(anim.loopBehavior) ? anim.loopBehavior : "none",
    staggerGroupId: typeof anim.staggerGroupId === "string" ? anim.staggerGroupId : null,
    staggerIndex: Number.isFinite(anim.staggerIndex) ? Math.max(0, Math.round(anim.staggerIndex)) : 0,
    triggerMode: TRIGGER_MODES.includes(anim.triggerMode) ? anim.triggerMode : "auto",
    exitBehavior: EXIT_BEHAVIORS.includes(anim.exitBehavior) ? anim.exitBehavior : "remove",
    customParams: sanitizeCustomParams(anim.customParams),
    enabled: anim.enabled !== false,
    createdAt: Number.isFinite(anim.createdAt) ? anim.createdAt : Date.now(),
    updatedAt: Date.now(),
  };
}

export function animationEndTime(anim) {
  return anim.startTime + anim.delay + anim.duration * Math.max(1, anim.repeatCount || 1);
}

// --- motion path record ---

export function clampMotionPathPoint(pt) {
  if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return null;
  return {
    x: clamp(pt.x, -MOTION_PATH_BOUNDS_MARGIN, MOTION_PATH_BOUNDS_MARGIN, 0),
    y: clamp(pt.y, -MOTION_PATH_BOUNDS_MARGIN, MOTION_PATH_BOUNDS_MARGIN, 0),
  };
}

export function createMotionPathDefaults(objectId, points) {
  return {
    id: safeId(),
    objectId,
    points: points.map(clampMotionPathPoint).filter(Boolean),
    controlPoints: points.map(() => null),
    closed: false,
    orientToPath: false,
    startOffset: 0,
    endOffset: 1,
    duration: 2000,
    easing: DEFAULT_EASING,
    reverse: false,
  };
}

// Validates + clamps a motion path; returns null if geometrically unsafe
// (too few/too many points, non-finite coordinates) — spec §28 "reject
// invalid path geometry".
export function clampMotionPath(path) {
  if (!path || typeof path !== "object" || !Array.isArray(path.points)) return null;
  const points = path.points.map(clampMotionPathPoint).filter(Boolean).slice(0, MAX_MOTION_PATH_POINTS);
  if (points.length < MIN_MOTION_PATH_POINTS) return null;
  const controlPoints = Array.isArray(path.controlPoints)
    ? points.map((_, i) => {
        const cp = path.controlPoints[i];
        return cp ? clampMotionPathPoint(cp) : null;
      })
    : points.map(() => null);
  return {
    id: typeof path.id === "string" && path.id ? path.id : safeId(),
    objectId: path.objectId,
    points,
    controlPoints,
    closed: !!path.closed,
    orientToPath: !!path.orientToPath,
    startOffset: clamp(path.startOffset, 0, 1, 0),
    endOffset: clamp(path.endOffset, 0, 1, 1),
    duration: clamp(path.duration, MIN_ANIMATION_DURATION_MS, MAX_ANIMATION_DURATION_MS, 2000),
    easing: resolveEasingId(path.easing),
    reverse: !!path.reverse,
  };
}

// --- page duration / transition ---

export function clampPageDuration(value) {
  return Math.round(clamp(value, MIN_PAGE_DURATION_MS, MAX_PAGE_DURATION_MS, DEFAULT_PAGE_DURATION_MS));
}

export function defaultTransition() {
  return { type: "none", duration: DEFAULT_TRANSITION_DURATION_MS, direction: null, easing: DEFAULT_EASING };
}

export function clampTransition(t) {
  if (!t || typeof t !== "object") return defaultTransition();
  return {
    type: TRANSITION_TYPES.includes(t.type) ? t.type : "none",
    duration: Math.round(clamp(t.duration, MIN_TRANSITION_DURATION_MS, MAX_TRANSITION_DURATION_MS, DEFAULT_TRANSITION_DURATION_MS)),
    direction: DIRECTIONS.includes(t.direction) ? t.direction : null,
    easing: resolveEasingId(t.easing),
  };
}

// --- presentation settings (project-level, durable) ---

export function defaultPresentationSettings() {
  return { autoplay: false, loopMode: "none", playbackSpeed: 1, navigationMode: "manual" };
}

export function clampPresentationSettings(p) {
  if (!p || typeof p !== "object") return defaultPresentationSettings();
  return {
    autoplay: !!p.autoplay,
    loopMode: PRESENTATION_LOOP_MODES.includes(p.loopMode) ? p.loopMode : "none",
    playbackSpeed: PLAYBACK_SPEEDS.includes(p.playbackSpeed) ? p.playbackSpeed : 1,
    navigationMode: PRESENTATION_NAV_MODES.includes(p.navigationMode) ? p.navigationMode : "manual",
  };
}

export { EASING_IDS };
