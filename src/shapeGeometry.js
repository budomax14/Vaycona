// One sceneFunc per shape kind, all sharing signature
// (context, shapeNode, item) and reading shapeNode.width()/height() so
// resize/rotate/Transformer behave identically to any other Konva shape —
// no per-kind resize logic anywhere in this file.
//
// Each sceneFunc below delegates its path-building to a sibling `buildXPath`
// function (beginPath...closePath only, no fill/stroke). This is what lets
// FrameNode/ImageNode reuse the exact same geometry for a Konva `clipFunc`
// (frameKinds.js's `clipPath` entries call these directly) WITHOUT going
// through `context.fillStrokeShape(shapeNode)` — that call is a real Konva
// Context method that inspects many properties on the shape argument
// (fillEnabled, hasFill, attrs.fillAfterStrokeEnabled, etc.), so it cannot
// be satisfied by a lightweight stand-in object; a clipFunc must only ever
// build the path and let Konva apply ctx.clip() itself afterward.

export function buildRectPath(context, w, h, cornerRadius = 0) {
  const r = Math.min(cornerRadius, w / 2, h / 2);
  context.beginPath();
  if (r <= 0) {
    context.rect(0, 0, w, h);
  } else {
    context.moveTo(r, 0);
    context.lineTo(w - r, 0);
    context.arcTo(w, 0, w, r, r);
    context.lineTo(w, h - r);
    context.arcTo(w, h, w - r, h, r);
    context.lineTo(r, h);
    context.arcTo(0, h, 0, h - r, r);
    context.lineTo(0, r);
    context.arcTo(0, 0, r, 0, r);
  }
  context.closePath();
}

export function rectSceneFunc(context, shapeNode, item) {
  buildRectPath(context, shapeNode.width(), shapeNode.height(), item.cornerRadius ?? 0);
  context.fillStrokeShape(shapeNode);
}

export function buildEllipsePath(context, w, h) {
  const width = Math.max(w, 0.001);
  const height = Math.max(h, 0.001);
  context.beginPath();
  context.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  context.closePath();
}

export function ellipseSceneFunc(context, shapeNode) {
  buildEllipsePath(context, shapeNode.width(), shapeNode.height());
  context.fillStrokeShape(shapeNode);
}

// Shared by triangle/diamond/pentagon/hexagon (and any future polygon) —
// independent rx/ry (not one shared radius) so a non-square bounding box
// stretches the polygon correctly instead of forcing a circular layout.
export function buildRegularPolygonPath(context, w, h, sides, rotationOffsetDeg = -90) {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;
  context.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (rotationOffsetDeg + (360 / sides) * i) * (Math.PI / 180);
    const x = cx + rx * Math.cos(angle);
    const y = cy + ry * Math.sin(angle);
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

export function regularPolygonSceneFunc(context, shapeNode, sides, rotationOffsetDeg = -90) {
  buildRegularPolygonPath(context, shapeNode.width(), shapeNode.height(), sides, rotationOffsetDeg);
  context.fillStrokeShape(shapeNode);
}

// General point-count + inset-ratio star. points/innerRadiusRatio already
// live in the item's data (see shapeKinds.js defaults) so a future
// point-count/inset control needs no data-model change, only a new
// toolbar control reading/writing these same fields.
export function buildStarPath(context, w, h, points = 5, innerRatio = 0.5) {
  const cx = w / 2;
  const cy = h / 2;
  const outerRx = w / 2;
  const outerRy = h / 2;
  const innerRx = outerRx * innerRatio;
  const innerRy = outerRy * innerRatio;
  const step = Math.PI / points;
  context.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = -Math.PI / 2 + i * step;
    const rx = i % 2 === 0 ? outerRx : innerRx;
    const ry = i % 2 === 0 ? outerRy : innerRy;
    const x = cx + rx * Math.cos(angle);
    const y = cy + ry * Math.sin(angle);
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

export function starSceneFunc(context, shapeNode, item) {
  buildStarPath(context, shapeNode.width(), shapeNode.height(), item.points ?? 5, item.innerRadiusRatio ?? 0.5);
  context.fillStrokeShape(shapeNode);
}

// Rounded-rect body (reserving the bottom ~18% for the tail) + a
// protruding triangular tail, one continuous path so the stroke has no
// internal seam.
export function speechBubbleSceneFunc(context, shapeNode) {
  const w = shapeNode.width();
  const h = shapeNode.height();
  const r = Math.min(12, w / 2, h * 0.6);
  const bodyH = h * 0.82;
  const tailW = w * 0.14;
  const tailX = w * 0.22;
  context.beginPath();
  context.moveTo(r, 0);
  context.lineTo(w - r, 0);
  context.arcTo(w, 0, w, r, r);
  context.lineTo(w, bodyH - r);
  context.arcTo(w, bodyH, w - r, bodyH, r);
  context.lineTo(tailX + tailW, bodyH);
  context.lineTo(tailX + tailW / 2, h);
  context.lineTo(tailX, bodyH);
  context.lineTo(r, bodyH);
  context.arcTo(0, bodyH, 0, bodyH - r, r);
  context.lineTo(0, r);
  context.arcTo(0, 0, r, 0, r);
  context.closePath();
  context.fillStrokeShape(shapeNode);
}

// Classic parametric heart curve, sampled once at module load and linearly
// remapped into the current [0,w] x [0,h] box every render — robust at any
// aspect ratio, no hand-tuned bezier control points.
function sampleHeart(steps = 48) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push([x, y]);
  }
  return pts;
}
const HEART_RAW = sampleHeart();
const HEART_MINX = Math.min(...HEART_RAW.map((p) => p[0]));
const HEART_MAXX = Math.max(...HEART_RAW.map((p) => p[0]));
const HEART_MINY = Math.min(...HEART_RAW.map((p) => p[1]));
const HEART_MAXY = Math.max(...HEART_RAW.map((p) => p[1]));

export function buildHeartPath(context, w, h) {
  context.beginPath();
  HEART_RAW.forEach(([rx, ry], i) => {
    const x = ((rx - HEART_MINX) / (HEART_MAXX - HEART_MINX)) * w;
    const y = ((ry - HEART_MINY) / (HEART_MAXY - HEART_MINY)) * h;
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
}

export function heartSceneFunc(context, shapeNode) {
  buildHeartPath(context, shapeNode.width(), shapeNode.height());
  context.fillStrokeShape(shapeNode);
}

// Rounded-bottom rectangle with a semicircular top — used by the "arch"
// frame shape (frameKinds.js). Path-only builder since frames only ever
// need this for clipping, never for a standalone fill/stroke shape.
export function buildArchPath(context, w, h) {
  const archHeight = Math.min(w / 2, h * 0.6);
  context.beginPath();
  context.moveTo(0, h);
  context.lineTo(0, archHeight);
  context.arc(w / 2, archHeight, w / 2, Math.PI, 0, false);
  context.lineTo(w, h);
  context.closePath();
}

export function crossSceneFunc(context, shapeNode, item) {
  const w = shapeNode.width();
  const h = shapeNode.height();
  const armRatio = item.armRatio ?? 0.35;
  const aw = w * armRatio;
  const ah = h * armRatio;
  const x0 = (w - aw) / 2;
  const x1 = x0 + aw;
  const y0 = (h - ah) / 2;
  const y1 = y0 + ah;
  const pts = [
    [x0, 0], [x1, 0], [x1, y0], [w, y0], [w, y1], [x1, y1],
    [x1, h], [x0, h], [x0, y1], [0, y1], [0, y0], [x0, y0],
  ];
  context.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
  context.closePath();
  context.fillStrokeShape(shapeNode);
}

// Simplest reasonable "ribbon/notch" interpretation: rounded plate with a
// small inward V-notch cut into the bottom edge.
export function badgeSceneFunc(context, shapeNode) {
  const w = shapeNode.width();
  const h = shapeNode.height();
  const r = Math.min(10, w / 2, h / 2);
  const notchW = w * 0.28;
  const notchDepth = h * 0.14;
  const cx = w / 2;
  context.beginPath();
  context.moveTo(r, 0);
  context.lineTo(w - r, 0);
  context.arcTo(w, 0, w, r, r);
  context.lineTo(w, h - r);
  context.arcTo(w, h, w - r, h, r);
  context.lineTo(cx + notchW / 2, h);
  context.lineTo(cx, h - notchDepth);
  context.lineTo(cx - notchW / 2, h);
  context.lineTo(r, h);
  context.arcTo(0, h, 0, h - r, r);
  context.lineTo(0, r);
  context.arcTo(0, 0, r, 0, r);
  context.closePath();
  context.fillStrokeShape(shapeNode);
}

// Hollow center via Konva's native even-odd fillRule (set on the <Shape>
// itself, see ShapeNode.jsx) — no manual canvas punch-hole workaround.
export function ringSceneFunc(context, shapeNode, item) {
  const w = shapeNode.width();
  const h = shapeNode.height();
  const innerRatio = item.innerRadiusRatio ?? 0.5;
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const irx = rx * innerRatio;
  const iry = ry * innerRatio;
  context.beginPath();
  context.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  context.moveTo(cx + irx, cy);
  context.ellipse(cx, cy, irx, iry, 0, 0, Math.PI * 2);
  context.closePath();
  context.fillStrokeShape(shapeNode);
}
