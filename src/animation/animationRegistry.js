// Phase 12 — centralized animation-preset registry (spec §6). Every preset
// definition lives here ONCE; nothing about "what Fade In does" is
// duplicated in a component. Project data only ever stores a `presetId`
// (a string) resolved against this table at runtime — the table itself may
// safely contain functions (it's trusted source code, not imported project
// data; see animationSchema.js's sanitizeCustomParams for the boundary that
// actually matters: untrusted project JSON never contains code).
//
// Every transform preset's `compute(progress, ctx)` follows ONE shared
// convention regardless of stage: progress=0 is the preset's "extreme /
// offset" state, progress=1 is "identity / at rest" (see
// animationService.js for how entrance vs exit derive opposite-direction
// progress from the same preset, and how emphasis/motion presets differ).
// Returned delta fields are partial — omitted fields mean "no change" and
// are filled in by animationService's IDENTITY_DELTA merge.

const ALL_TYPES = ["text", "shape", "line", "icon", "image", "frame", "group"];
const NO_LINE = ALL_TYPES.filter((t) => t !== "line");

export const INTENSITY_FACTORS = { subtle: 0.5, medium: 1, strong: 1.8 };

function resolveNum(overrideVal, base, intensityFactor) {
  return overrideVal != null ? overrideVal : base * intensityFactor;
}

// --- shared TRANSFORM kind functions (entrance <-> exit symmetric) ---

const KINDS = {
  fade: (progress, ctx) => ({
    opacityFactor: lerpClamped(ctx.opacityFrom ?? 0, ctx.opacityTo ?? 1, progress),
  }),
  rise: (progress, ctx) => ({
    dy: lerpClamped(resolveNum(ctx.distance, 60, ctx.intensityFactor), 0, progress),
    opacityFactor: lerpClamped(0, 1, progress),
  }),
  drop: (progress, ctx) => ({
    dy: lerpClamped(-resolveNum(ctx.distance, 60, ctx.intensityFactor), 0, progress),
    opacityFactor: lerpClamped(0, 1, progress),
  }),
  slide: (progress, ctx) => {
    const dist = resolveNum(ctx.distance, 120, ctx.intensityFactor);
    const dir = ctx.direction || "right";
    if (dir === "left") return { dx: lerpClamped(dist, 0, progress) };
    if (dir === "right") return { dx: lerpClamped(-dist, 0, progress) };
    if (dir === "up") return { dy: lerpClamped(dist, 0, progress) };
    return { dy: lerpClamped(-dist, 0, progress) };
  },
  zoom: (progress, ctx) => ({
    scale: lerpClamped(resolveNum(ctx.scaleAmount, 0.35, ctx.intensityFactor), 1, progress),
    opacityFactor: lerpClamped(0, 1, progress),
  }),
  shrink: (progress, ctx) => ({
    scale: lerpClamped(resolveNum(ctx.scaleAmount, 0.4, ctx.intensityFactor), 1, progress),
  }),
  wipe: (progress, ctx) => ({
    scale: lerpClamped(0.001, 1, Math.min(1, progress * 1.15)),
    opacityFactor: progress > 0.02 ? 1 : 0,
  }),
  drift: (progress, ctx) => {
    const dist = resolveNum(ctx.distance, 40, ctx.intensityFactor);
    return {
      dx: lerpClamped(dist * 0.6, 0, progress),
      dy: lerpClamped(dist, 0, progress),
      opacityFactor: lerpClamped(0, 1, progress),
    };
  },
  rotateIn: (progress, ctx) => ({
    drotation: lerpClamped(resolveNum(ctx.rotationAmount, 45, ctx.intensityFactor) * (ctx.direction === "counterclockwise" ? -1 : 1), 0, progress),
    opacityFactor: lerpClamped(0, 1, progress),
  }),
  breatheIn: (progress, ctx) => ({
    scale: lerpClamped(resolveNum(ctx.scaleAmount, 0.85, ctx.intensityFactor), 1, progress),
    opacityFactor: lerpClamped(0, 1, progress),
  }),
};

function lerpClamped(a, b, t) {
  const ct = Math.min(1, Math.max(0, t));
  return a + (b - a) * ct;
}

// --- EMPHASIS presets: compute(cyclePhase 0..1, ctx) -> delta, called once
// per loop cycle by animationService (which handles repeatCount/loop). ---

const EMPHASIS_KINDS = {
  pulse: (phase, ctx) => ({ scale: 1 + Math.sin(phase * Math.PI * 2) * 0.08 * ctx.intensityFactor }),
  breathe: (phase, ctx) => ({ scale: 1 + Math.sin(phase * Math.PI * 2) * 0.06 * ctx.intensityFactor }),
  bounce: (phase, ctx) => ({ dy: -Math.abs(Math.sin(phase * Math.PI)) * 18 * ctx.intensityFactor }),
  shake: (phase, ctx) => ({ dx: Math.sin(phase * Math.PI * 2 * 5) * 8 * ctx.intensityFactor }),
  wiggle: (phase, ctx) => ({ drotation: Math.sin(phase * Math.PI * 2 * 3) * 6 * ctx.intensityFactor }),
  flicker: (phase, ctx) => ({ opacityFactor: 0.5 + Math.abs(Math.sin(phase * Math.PI * 2 * 6)) * 0.5 }),
  tada: (phase, ctx) => ({
    scale: 1 + Math.sin(phase * Math.PI * 2) * 0.1 * ctx.intensityFactor,
    drotation: Math.sin(phase * Math.PI * 2 * 4) * 4 * ctx.intensityFactor,
  }),
  swing: (phase, ctx) => ({ drotation: Math.sin(phase * Math.PI * 2) * 12 * ctx.intensityFactor }),
  spin: (phase) => ({ drotation: phase * 360 }),
  glow: (phase, ctx) => ({ opacityFactor: 0.75 + Math.sin(phase * Math.PI * 2) * 0.25 * ctx.intensityFactor }),
  colorPulse: (phase, ctx) => ({ opacityFactor: 0.85 + Math.sin(phase * Math.PI * 2) * 0.15 * ctx.intensityFactor }),
};

// --- MOTION presets: compute(progress 0..1 across duration*repeat, ctx) ->
// {dx,dy,drotation?} absolute page-space displacement from the item's own
// base position. ---

const MOTION_KINDS = {
  moveX: (progress, ctx) => ({ dx: lerpClamped(0, resolveNum(ctx.distance, 150, ctx.intensityFactor) * (ctx.direction === "left" ? -1 : 1), progress) }),
  moveY: (progress, ctx) => ({ dy: lerpClamped(0, resolveNum(ctx.distance, 150, ctx.intensityFactor) * (ctx.direction === "up" ? -1 : 1), progress) }),
  pan: (progress, ctx) => ({ dx: lerpClamped(0, resolveNum(ctx.distance, 80, ctx.intensityFactor) * (ctx.direction === "left" ? -1 : 1), progress) }),
  drift: (progress, ctx) => ({
    dx: Math.sin(progress * Math.PI * 2) * resolveNum(ctx.distance, 20, ctx.intensityFactor),
    dy: Math.cos(progress * Math.PI * 2) * resolveNum(ctx.distance, 12, ctx.intensityFactor) * 0.5,
  }),
  float: (progress, ctx) => ({ dy: Math.sin(progress * Math.PI * 2) * resolveNum(ctx.distance, 14, ctx.intensityFactor) }),
  orbit: (progress, ctx) => {
    const r = resolveNum(ctx.distance, 80, ctx.intensityFactor);
    const dir = ctx.direction === "counterclockwise" ? -1 : 1;
    const a = progress * Math.PI * 2 * dir;
    return { dx: Math.cos(a) * r - r, dy: Math.sin(a) * r };
  },
};

// --- registry entries ---

function transformPreset(id, name, category, kind, opts = {}) {
  return {
    id,
    name,
    category, // "entrance" | "exit" | "emphasis" | "motion"
    description: opts.description || name,
    defaultDuration: opts.defaultDuration ?? (category === "emphasis" ? 900 : 500),
    defaultEasing: opts.defaultEasing ?? (category === "entrance" ? "easeOut" : category === "exit" ? "easeIn" : "easeInOut"),
    supportedTypes: opts.supportedTypes || NO_LINE.concat(category === "motion" ? [] : ["line"]),
    directions: opts.directions || null,
    defaultDirection: opts.defaultDirection ?? null,
    paramSchema: opts.paramSchema || ["duration", "delay", "easing", "intensity"],
    supportsEntrance: category === "entrance",
    supportsExit: category === "exit",
    supportsLoop: category === "emphasis" || category === "motion",
    supportsGroups: true,
    safeForExport: opts.safeForExport !== false,
    reducedMotionFallback: opts.reducedMotionFallback ?? (category === "emphasis" || category === "motion" ? null : "fade"),
    intense: !!opts.intense,
    kind,
  };
}

export const ANIMATION_PRESETS = [
  // Entrance
  transformPreset("fadeIn", "Fade in", "entrance", "fade"),
  transformPreset("riseIn", "Rise", "entrance", "rise", { paramSchema: ["duration", "delay", "easing", "intensity", "distance"] }),
  transformPreset("dropIn", "Drop", "entrance", "drop", { defaultEasing: "bounce", paramSchema: ["duration", "delay", "easing", "intensity", "distance"] }),
  transformPreset("slideInLeft", "Slide left", "entrance", "slide", { defaultDirection: "left", directions: ["left", "right", "up", "down"], paramSchema: ["duration", "delay", "easing", "intensity", "distance", "direction"] }),
  transformPreset("slideInRight", "Slide right", "entrance", "slide", { defaultDirection: "right", directions: ["left", "right", "up", "down"], paramSchema: ["duration", "delay", "easing", "intensity", "distance", "direction"] }),
  transformPreset("slideInUp", "Slide up", "entrance", "slide", { defaultDirection: "up", directions: ["left", "right", "up", "down"], paramSchema: ["duration", "delay", "easing", "intensity", "distance", "direction"] }),
  transformPreset("slideInDown", "Slide down", "entrance", "slide", { defaultDirection: "down", directions: ["left", "right", "up", "down"], paramSchema: ["duration", "delay", "easing", "intensity", "distance", "direction"] }),
  transformPreset("zoomIn", "Zoom in", "entrance", "zoom", { paramSchema: ["duration", "delay", "easing", "intensity", "scale"] }),
  transformPreset("popIn", "Pop", "entrance", "zoom", { defaultEasing: "back", paramSchema: ["duration", "delay", "easing", "intensity", "scale"] }),
  transformPreset("wipeIn", "Wipe", "entrance", "wipe"),
  transformPreset("driftIn", "Drift", "entrance", "drift", { paramSchema: ["duration", "delay", "easing", "intensity", "distance"] }),
  transformPreset("breatheIn", "Breathe in", "entrance", "breatheIn", { paramSchema: ["duration", "delay", "easing", "intensity", "scale"] }),
  transformPreset("rotateIn", "Rotate in", "entrance", "rotateIn", { directions: ["clockwise", "counterclockwise"], defaultDirection: "clockwise", paramSchema: ["duration", "delay", "easing", "intensity", "rotation", "direction"] }),

  // Exit
  transformPreset("fadeOut", "Fade out", "exit", "fade"),
  transformPreset("slideOutLeft", "Slide out left", "exit", "slide", { defaultDirection: "right", directions: ["left", "right", "up", "down"], paramSchema: ["duration", "delay", "easing", "intensity", "distance", "direction"] }),
  transformPreset("slideOutRight", "Slide out right", "exit", "slide", { defaultDirection: "left", directions: ["left", "right", "up", "down"], paramSchema: ["duration", "delay", "easing", "intensity", "distance", "direction"] }),
  transformPreset("slideOutUp", "Slide out up", "exit", "slide", { defaultDirection: "down", directions: ["left", "right", "up", "down"], paramSchema: ["duration", "delay", "easing", "intensity", "distance", "direction"] }),
  transformPreset("slideOutDown", "Slide out down", "exit", "slide", { defaultDirection: "up", directions: ["left", "right", "up", "down"], paramSchema: ["duration", "delay", "easing", "intensity", "distance", "direction"] }),
  transformPreset("zoomOut", "Zoom out", "exit", "zoom", { paramSchema: ["duration", "delay", "easing", "intensity", "scale"] }),
  transformPreset("shrinkOut", "Shrink", "exit", "shrink", { paramSchema: ["duration", "delay", "easing", "intensity", "scale"] }),
  transformPreset("dropOut", "Drop out", "exit", "drop", { paramSchema: ["duration", "delay", "easing", "intensity", "distance"] }),
  transformPreset("riseOut", "Rise out", "exit", "rise", { paramSchema: ["duration", "delay", "easing", "intensity", "distance"] }),
  transformPreset("rotateOut", "Rotate out", "exit", "rotateIn", { directions: ["clockwise", "counterclockwise"], defaultDirection: "clockwise", paramSchema: ["duration", "delay", "easing", "intensity", "rotation", "direction"] }),
  transformPreset("wipeOut", "Wipe out", "exit", "wipe"),

  // Emphasis (loopable, periodic — kind stored separately below)
  emphasisPreset("pulse", "Pulse", "pulse"),
  emphasisPreset("breathe", "Breathe", "breathe", { defaultDuration: 1600 }),
  emphasisPreset("bounce", "Bounce", "bounce"),
  emphasisPreset("shake", "Shake", "shake", { intense: true }),
  emphasisPreset("wiggle", "Wiggle", "wiggle"),
  emphasisPreset("flicker", "Flicker", "flicker", { intense: true, reducedMotionFallback: "pulse" }),
  emphasisPreset("tada", "Tada", "tada"),
  emphasisPreset("swing", "Swing", "swing"),
  emphasisPreset("spin", "Spin", "spin", { intense: true, defaultDuration: 1400 }),
  emphasisPreset("glow", "Glow", "glow", { defaultDuration: 1400 }),
  emphasisPreset("colorPulse", "Color pulse", "colorPulse", { defaultDuration: 1400, description: "Approximated as an opacity pulse — true per-color animation isn't supported for every fill type yet." }),

  // Motion
  motionPreset("moveX", "Move along X", "moveX", { directions: ["left", "right"], defaultDirection: "right" }),
  motionPreset("moveY", "Move along Y", "moveY", { directions: ["up", "down"], defaultDirection: "down" }),
  motionPreset("panMotion", "Pan", "pan", { directions: ["left", "right"], defaultDirection: "right" }),
  motionPreset("driftMotion", "Drift", "drift"),
  motionPreset("floatMotion", "Float", "float"),
  motionPreset("orbitMotion", "Orbit", "orbit", { directions: ["clockwise", "counterclockwise"], defaultDirection: "clockwise" }),
  {
    id: "customMotionPath",
    name: "Custom motion path",
    category: "motion",
    description: "Moves the object along a user-drawn path.",
    defaultDuration: 2000,
    defaultEasing: "easeInOut",
    supportedTypes: NO_LINE,
    directions: null,
    defaultDirection: null,
    paramSchema: ["duration", "delay", "easing"],
    supportsEntrance: false,
    supportsExit: false,
    supportsLoop: true,
    supportsGroups: true,
    safeForExport: true,
    reducedMotionFallback: null,
    intense: false,
    kind: "customMotionPath",
  },
];

function emphasisPreset(id, name, kind, opts = {}) {
  return {
    id,
    name,
    category: "emphasis",
    description: opts.description || name,
    defaultDuration: opts.defaultDuration ?? 900,
    defaultEasing: "easeInOut",
    supportedTypes: NO_LINE.concat("line"),
    directions: null,
    defaultDirection: null,
    paramSchema: ["duration", "delay", "easing", "intensity", "repeatCount", "loopBehavior"],
    supportsEntrance: false,
    supportsExit: false,
    supportsLoop: true,
    supportsGroups: true,
    safeForExport: true,
    reducedMotionFallback: opts.reducedMotionFallback ?? "pulse",
    intense: !!opts.intense,
    kind,
  };
}

function motionPreset(id, name, kind, opts = {}) {
  return {
    id,
    name,
    category: "motion",
    description: opts.description || name,
    defaultDuration: opts.defaultDuration ?? 2000,
    defaultEasing: "easeInOut",
    supportedTypes: NO_LINE,
    directions: opts.directions || null,
    defaultDirection: opts.defaultDirection ?? null,
    paramSchema: ["duration", "delay", "easing", "intensity", "distance", "direction", "repeatCount", "loopBehavior"],
    supportsEntrance: false,
    supportsExit: false,
    supportsLoop: true,
    supportsGroups: true,
    safeForExport: true,
    reducedMotionFallback: null,
    intense: false,
    kind,
  };
}

// --- Image/frame pan & zoom ("Ken Burns") presets — spec §26. These are
// CROP-space presets (affects the item's internal crop focal point/zoom
// interpolation, not its outer transform) so they compose safely with any
// outer entrance/exit/emphasis animation also applied to the same image.
// Restricted to image/frame — see animationService.js's computeCropDelta. ---
export const IMAGE_MOTION_PRESETS = [
  { id: "kenBurnsZoomIn", name: "Slow zoom in", category: "motion", kind: "cropZoomIn", defaultDuration: 6000, defaultEasing: "linear", supportedTypes: ["image", "frame"], paramSchema: ["duration", "delay", "easing", "intensity"], reducedMotionFallback: null, safeForExport: true, description: "Ken Burns style slow zoom into the image." },
  { id: "kenBurnsZoomOut", name: "Slow zoom out", category: "motion", kind: "cropZoomOut", defaultDuration: 6000, defaultEasing: "linear", supportedTypes: ["image", "frame"], paramSchema: ["duration", "delay", "easing", "intensity"], reducedMotionFallback: null, safeForExport: true, description: "Ken Burns style slow zoom out of the image." },
  { id: "panLeft", name: "Pan left", category: "motion", kind: "cropPan", defaultDirection: "left", directions: ["left", "right", "up", "down"], defaultDuration: 6000, defaultEasing: "linear", supportedTypes: ["image", "frame"], paramSchema: ["duration", "delay", "easing", "intensity", "direction"], reducedMotionFallback: null, safeForExport: true, description: "Slowly pans the visible crop across the image." },
  { id: "panRight", name: "Pan right", category: "motion", kind: "cropPan", defaultDirection: "right", directions: ["left", "right", "up", "down"], defaultDuration: 6000, defaultEasing: "linear", supportedTypes: ["image", "frame"], paramSchema: ["duration", "delay", "easing", "intensity", "direction"], reducedMotionFallback: null, safeForExport: true, description: "Slowly pans the visible crop across the image." },
  { id: "panUp", name: "Pan up", category: "motion", kind: "cropPan", defaultDirection: "up", directions: ["left", "right", "up", "down"], defaultDuration: 6000, defaultEasing: "linear", supportedTypes: ["image", "frame"], paramSchema: ["duration", "delay", "easing", "intensity", "direction"], reducedMotionFallback: null, safeForExport: true, description: "Slowly pans the visible crop across the image." },
  { id: "panDown", name: "Pan down", category: "motion", kind: "cropPan", defaultDirection: "down", directions: ["left", "right", "up", "down"], defaultDuration: 6000, defaultEasing: "linear", supportedTypes: ["image", "frame"], paramSchema: ["duration", "delay", "easing", "intensity", "direction"], reducedMotionFallback: null, safeForExport: true, description: "Slowly pans the visible crop across the image." },
].map((p) => ({ supportsEntrance: false, supportsExit: false, supportsLoop: false, supportsGroups: false, intense: false, ...p }));

export const ALL_PRESETS = [...ANIMATION_PRESETS, ...IMAGE_MOTION_PRESETS];
const PRESET_BY_ID = new Map(ALL_PRESETS.map((p) => [p.id, p]));

export function getPreset(presetId) {
  return PRESET_BY_ID.get(presetId) || null;
}

export function getPresetsByCategory(category) {
  return ALL_PRESETS.filter((p) => p.category === category);
}

export function isPresetSupportedForType(presetId, type) {
  const preset = getPreset(presetId);
  if (!preset) return false;
  return preset.supportedTypes.includes(type);
}

export function computeTransformKind(kindId, progress, ctx) {
  const fn = KINDS[kindId];
  return fn ? fn(progress, ctx) : {};
}

export function computeEmphasisKind(kindId, phase, ctx) {
  const fn = EMPHASIS_KINDS[kindId];
  return fn ? fn(phase, ctx) : {};
}

export function computeMotionKind(kindId, progress, ctx) {
  const fn = MOTION_KINDS[kindId];
  return fn ? fn(progress, ctx) : {};
}

export const PRESET_CATEGORIES = ["entrance", "exit", "emphasis", "motion"];
