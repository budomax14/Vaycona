import {
  buildArchPath,
  buildEllipsePath,
  buildHeartPath,
  buildRectPath,
  buildRegularPolygonPath,
  buildStarPath,
  ellipseSceneFunc,
  heartSceneFunc,
  rectSceneFunc,
  regularPolygonSceneFunc,
  starSceneFunc,
} from "./shapeGeometry";

// Frames can now hold real image content (Phase 6). Outline geometry is
// still entirely reused from shapeGeometry.js: `sceneFunc` draws the
// placeholder/missing-asset outline (fill+stroke, same as any shape), and
// `clipPath` — a path-only sibling function, never calling
// context.fillStrokeShape — is what FrameNode.jsx uses as the real Konva
// `clipFunc` to clip image content to the frame's shape. These must stay
// as two separate functions (not one adapted into the other): Konva's
// `context.fillStrokeShape(shapeNode)` is a real API that inspects many
// properties on the shape argument, so a clipFunc can only ever build the
// path and let Konva apply ctx.clip() itself afterward.
// "Portrait"/"Landscape" from the spec are aspect-ratio presets, not
// distinct shapes — already covered by resizing a rectangle frame.
export const FRAME_KINDS = {
  rectangle: {
    label: "Rectangle Frame",
    sceneFunc: rectSceneFunc,
    clipPath: (ctx, w, h, item) => buildRectPath(ctx, w, h, item.cornerRadius ?? 0),
  },
  roundedRectangle: {
    label: "Rounded Frame",
    sceneFunc: rectSceneFunc,
    clipPath: (ctx, w, h, item) => buildRectPath(ctx, w, h, item.cornerRadius ?? 0),
    extraDefaults: { cornerRadius: 20 },
  },
  square: {
    label: "Square Frame",
    sceneFunc: rectSceneFunc,
    clipPath: (ctx, w, h, item) => buildRectPath(ctx, w, h, item.cornerRadius ?? 0),
  },
  circle: {
    label: "Circle Frame",
    sceneFunc: ellipseSceneFunc,
    clipPath: (ctx, w, h) => buildEllipsePath(ctx, w, h),
  },
  ellipse: {
    label: "Ellipse Frame",
    sceneFunc: ellipseSceneFunc,
    clipPath: (ctx, w, h) => buildEllipsePath(ctx, w, h),
  },
  oval: {
    label: "Oval Frame",
    sceneFunc: ellipseSceneFunc,
    clipPath: (ctx, w, h) => buildEllipsePath(ctx, w, h),
  },
  hexagon: {
    label: "Hexagon Frame",
    sceneFunc: (ctx, node) => regularPolygonSceneFunc(ctx, node, 6),
    clipPath: (ctx, w, h) => buildRegularPolygonPath(ctx, w, h, 6),
  },
  star: {
    label: "Star Frame",
    sceneFunc: starSceneFunc,
    clipPath: (ctx, w, h, item) => buildStarPath(ctx, w, h, item.points ?? 5, item.innerRadiusRatio ?? 0.5),
  },
  heart: {
    label: "Heart Frame",
    sceneFunc: heartSceneFunc,
    clipPath: (ctx, w, h) => buildHeartPath(ctx, w, h),
  },
  arch: {
    label: "Arch Frame",
    sceneFunc: (ctx, node) => {
      buildArchPath(ctx, node.width(), node.height());
      ctx.fillStrokeShape(node);
    },
    clipPath: (ctx, w, h) => buildArchPath(ctx, w, h),
  },
  // A plain rectangle outline whose CONTENT area is inset further from the
  // frame's own bounds (extra margin at the bottom, like a real Polaroid's
  // caption strip) — FrameNode.jsx reads `contentInset` when laying out the
  // image, while the outline/clip both stay a plain rectangle.
  polaroid: {
    label: "Polaroid Frame",
    sceneFunc: rectSceneFunc,
    clipPath: (ctx, w, h, item) => buildRectPath(ctx, w, h, item.cornerRadius ?? 0),
    contentInset: { top: 0.06, right: 0.06, bottom: 0.22, left: 0.06 },
  },
};

export const FRAME_KIND_ORDER = Object.keys(FRAME_KINDS);
