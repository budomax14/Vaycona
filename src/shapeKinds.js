import {
  badgeSceneFunc,
  crossSceneFunc,
  ellipseSceneFunc,
  heartSceneFunc,
  regularPolygonSceneFunc,
  ringSceneFunc,
  rectSceneFunc,
  speechBubbleSceneFunc,
  starSceneFunc,
} from "./shapeGeometry";

// One entry per shape kind. `sceneFunc` is the only required field beyond
// `label` — extraDefaults/extraControls/transformsOverride are only
// present where a kind actually needs them, so most entries stay tiny.
export const SHAPE_KINDS = {
  rectangle: {
    label: "Rectangle",
    sceneFunc: rectSceneFunc,
    extraControls: ["cornerRadius"],
  },
  roundedRectangle: {
    label: "Rounded Rectangle",
    sceneFunc: rectSceneFunc,
    extraDefaults: { cornerRadius: 16 },
    extraControls: ["cornerRadius"],
  },
  circle: {
    // No lockAspectRatio override — matches the existing, already-verified
    // Phase 2 behavior: circles resize freely into ellipses by default,
    // Shift applies the same uniform aspect-lock as every other type.
    label: "Circle",
    sceneFunc: ellipseSceneFunc,
  },
  ellipse: {
    label: "Ellipse",
    sceneFunc: ellipseSceneFunc,
  },
  oval: {
    label: "Oval",
    sceneFunc: ellipseSceneFunc,
  },
  triangle: {
    label: "Triangle",
    sceneFunc: (ctx, node) => regularPolygonSceneFunc(ctx, node, 3),
  },
  diamond: {
    label: "Diamond",
    sceneFunc: (ctx, node) => regularPolygonSceneFunc(ctx, node, 4),
  },
  pentagon: {
    label: "Pentagon",
    sceneFunc: (ctx, node) => regularPolygonSceneFunc(ctx, node, 5),
  },
  hexagon: {
    label: "Hexagon",
    sceneFunc: (ctx, node) => regularPolygonSceneFunc(ctx, node, 6),
  },
  star: {
    label: "Star",
    sceneFunc: starSceneFunc,
    // points/innerRadiusRatio stored now, ready for future controls; no
    // extraControls entry yet since no UI exposes them this phase.
    extraDefaults: { points: 5, innerRadiusRatio: 0.5 },
  },
  speechBubble: {
    label: "Speech Bubble",
    sceneFunc: speechBubbleSceneFunc,
  },
  heart: {
    label: "Heart",
    sceneFunc: heartSceneFunc,
  },
  cross: {
    label: "Cross",
    sceneFunc: crossSceneFunc,
    extraDefaults: { armRatio: 0.35 },
  },
  badge: {
    label: "Badge",
    sceneFunc: badgeSceneFunc,
  },
  ring: {
    label: "Ring",
    sceneFunc: ringSceneFunc,
    extraDefaults: { innerRadiusRatio: 0.5 },
    fillRule: "evenodd",
  },
};

export const SHAPE_KIND_ORDER = Object.keys(SHAPE_KINDS);
