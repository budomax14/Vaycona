// 3D Text effect (Text Effects → 3D). Stored on `item.text3D`, the same
// nested-object-on-the-item pattern `item.effects`/`item.background`/
// `item.border` already use (see textEffects.js) — no new document item
// types, no second text-editing engine. Rendering is a stack of offset
// "extrusion" copies drawn BEHIND the real front-face text, entirely
// inside each text renderer's existing draw call (see SimpleTextNode.jsx/
// RichTextNode.jsx/CurvedTextNode.jsx) — never as separate Konva nodes
// with their own x/y, which is what keeps the Transformer's selection box
// pinned to the item's real width/height regardless of depth (Konva's
// Shape.getSelfRect() reports the node's explicit width/height attrs only,
// ignoring what a sceneFunc actually paints — the same mechanism
// RichTextNode/CurvedTextNode already rely on for their custom hitFunc).

export const MAX_TEXT3D_STEPS = 40;
// Spacing between rendered extrusion copies, in px — depth is a visual
// target, not a literal step count, so a 100px-deep effect still renders
// at most MAX_TEXT3D_STEPS copies (see getText3DSteps).
export const TEXT3D_STEP_SPACING = 2.5;

export const TEXT3D_DIRECTIONS = [
  { key: "left", label: "Left", angle: 180 },
  { key: "right", label: "Right", angle: 0 },
  { key: "up", label: "Up", angle: 270 },
  { key: "down", label: "Down", angle: 90 },
  { key: "top-left", label: "Top Left", angle: 225 },
  { key: "top-right", label: "Top Right", angle: 315 },
  { key: "bottom-left", label: "Bottom Left", angle: 135 },
  { key: "bottom-right", label: "Bottom Right", angle: 45 },
];

export const TEXT3D_SHADING_OPTIONS = [
  { key: "solid", label: "Solid" },
  { key: "light-to-dark", label: "Light → Dark" },
  { key: "dark-to-light", label: "Dark → Light" },
];

export const TEXT3D_LIGHT_DIRECTIONS = [
  { key: "top-left", label: "Top Left" },
  { key: "top", label: "Top" },
  { key: "top-right", label: "Top Right" },
  { key: "left", label: "Left" },
  { key: "right", label: "Right" },
  { key: "bottom-left", label: "Bottom Left" },
  { key: "bottom", label: "Bottom" },
  { key: "bottom-right", label: "Bottom Right" },
];

function directionAngle(key) {
  return TEXT3D_DIRECTIONS.find((d) => d.key === key)?.angle ?? 45;
}

export function defaultText3D() {
  return {
    enabled: false,
    depth: 30,
    direction: "bottom-right",
    angle: 45,
    extrusionColor: "#7A1F1F",
    shading: "solid", // "solid" | "light-to-dark" | "dark-to-light"
    bevel: 0,
    perspective: 0,
    highlight: 0,
    lightDirection: "top-left",
  };
}

function finite(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

// Merges stored `item.text3D` over the defaults AND clamps every numeric
// field — malformed/hand-edited/older-format project data can never
// produce NaN offsets or an out-of-range step count downstream.
export function resolveText3D(item) {
  const base = defaultText3D();
  const stored = item?.text3D || {};
  return {
    ...base,
    ...stored,
    enabled: !!stored.enabled,
    depth: Math.max(0, Math.min(100, finite(stored.depth, base.depth))),
    angle: ((finite(stored.angle, directionAngle(stored.direction) || base.angle) % 360) + 360) % 360,
    bevel: Math.max(0, Math.min(20, finite(stored.bevel, base.bevel))),
    perspective: Math.max(0, Math.min(100, finite(stored.perspective, base.perspective))),
    highlight: Math.max(0, Math.min(100, finite(stored.highlight, base.highlight))),
    extrusionColor: typeof stored.extrusionColor === "string" ? stored.extrusionColor : base.extrusionColor,
    shading: TEXT3D_SHADING_OPTIONS.some((s) => s.key === stored.shading) ? stored.shading : base.shading,
    lightDirection: TEXT3D_LIGHT_DIRECTIONS.some((d) => d.key === stored.lightDirection) ? stored.lightDirection : base.lightDirection,
    direction: TEXT3D_DIRECTIONS.some((d) => d.key === stored.direction) ? stored.direction : base.direction,
  };
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function hexToRgbLocal(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return { r: 122, g: 31, b: 31 };
  const h = m[1];
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function toHexLocal({ r, g, b }) {
  const ch = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${ch(r)}${ch(g)}${ch(b)}`;
}

// amount: -1 (toward black) .. 0 (unchanged) .. 1 (toward white)
function shadeHex(hex, amount) {
  const c = hexToRgbLocal(hex);
  const t = Math.max(-1, Math.min(1, amount));
  const mix = (channel) => (t >= 0 ? channel + (255 - channel) * t : channel + channel * t);
  return toHexLocal({ r: mix(c.r), g: mix(c.g), b: mix(c.b) });
}

const LIGHT_DIRECTION_VECTORS = {
  "top-left": { x: -1, y: -1 },
  top: { x: 0, y: -1 },
  "top-right": { x: 1, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  "bottom-left": { x: -1, y: 1 },
  bottom: { x: 0, y: 1 },
  "bottom-right": { x: 1, y: 1 },
};

function normalizeVec(v) {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

// Builds every rendered extrusion copy, ordered FARTHEST-first — draw the
// array in this order so nearer copies (and finally the real front face)
// paint on top. Step count is spacing-based (not 1-per-px of depth), so a
// deep effect stays cheap to draw (see useText3DCache.js for the bitmap
// cache that makes steady-state redraw cost independent of this entirely).
export function getText3DSteps(text3D) {
  if (!text3D.enabled) return [];
  const depth = text3D.depth ?? 0;
  if (depth <= 0) return [];
  const angleRad = (text3D.angle * Math.PI) / 180;
  const dirX = Math.cos(angleRad);
  const dirY = Math.sin(angleRad);
  const stepCount = Math.max(1, Math.min(MAX_TEXT3D_STEPS, Math.round(depth / TEXT3D_STEP_SPACING)));
  const baseColor = text3D.extrusionColor;
  const highlight = clamp01((text3D.highlight ?? 0) / 100);
  const lightVec = normalizeVec(LIGHT_DIRECTION_VECTORS[text3D.lightDirection] || LIGHT_DIRECTION_VECTORS["top-left"]);
  // +1 when the extrusion direction points straight at the light (reads
  // brighter), -1 when it points straight away from it.
  const lightAlignment = -(dirX * lightVec.x + dirY * lightVec.y);
  const perspective = clamp01((text3D.perspective ?? 0) / 100);

  const steps = [];
  for (let i = stepCount; i >= 1; i--) {
    const t = i / stepCount; // 1 = farthest copy, ~0 = nearest to the front face
    const dist = t * depth;
    let shade = 0;
    if (text3D.shading === "light-to-dark") shade = -0.55 * t;
    else if (text3D.shading === "dark-to-light") shade = -0.55 * (1 - t);
    shade += highlight * lightAlignment * (1 - t) * 0.5;
    steps.push({
      dx: dirX * dist,
      dy: dirY * dist,
      color: shadeHex(baseColor, shade),
      // Lightweight perspective approximation (spec §10) — farther copies
      // shrink slightly toward the extrusion direction. Never touches the
      // front face, the item's real geometry, or hit-testing.
      scale: 1 - perspective * 0.12 * t,
    });
  }
  return steps;
}

// Bevel (spec §7) — a thin highlight/shadow rim approximating a facet
// between the front face and the extrusion. Deliberately not real
// geometry (see investigation notes); null when bevel is 0.
export function getText3DBevelRim(text3D) {
  if (!text3D.enabled) return null;
  const bevel = text3D.bevel ?? 0;
  if (bevel <= 0) return null;
  const angleRad = (text3D.angle * Math.PI) / 180;
  const dirX = Math.cos(angleRad);
  const dirY = Math.sin(angleRad);
  const px = Math.max(1, bevel / 4);
  return {
    highlight: { dx: -dirX * px, dy: -dirY * px, color: shadeHex(text3D.extrusionColor, 0.5) },
    shadow: { dx: dirX * px, dy: dirY * px, color: shadeHex(text3D.extrusionColor, -0.4) },
  };
}

// How far a fully-rendered 3D effect can paint outside the item's own
// width/height box, in local (pre-rotation) px — used only to size the
// optional bitmap cache (useText3DCache.js) generously enough that nothing
// gets clipped. Selection/snap bounds intentionally do NOT use this (see
// bounds.js) — same "visual effect can bleed past the box" convention
// item.effects.shadow already follows.
export function getText3DBoundsPadding(text3D) {
  if (!text3D.enabled || (text3D.depth ?? 0) <= 0) return { left: 0, top: 0, right: 0, bottom: 0 };
  const angleRad = (text3D.angle * Math.PI) / 180;
  const dx = Math.cos(angleRad) * text3D.depth;
  const dy = Math.sin(angleRad) * text3D.depth;
  const bevel = text3D.bevel ?? 0;
  return {
    left: Math.max(0, -dx) + bevel,
    top: Math.max(0, -dy) + bevel,
    right: Math.max(0, dx) + bevel,
    bottom: Math.max(0, dy) + bevel,
  };
}
