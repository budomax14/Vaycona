// Phase 9 — a minimal Canvas-2D-context-shaped recorder that turns the
// EXISTING path-only builder functions (buildRectPath/buildEllipsePath/
// buildStarPath/... in shapeGeometry.js, and every FRAME_KINDS.clipPath)
// into an SVG path `d` string, by literally calling them with this object
// in place of a real CanvasRenderingContext2D. This is what lets SVG
// export reuse the app's one true shape-geometry implementation (spec
// rule 2/6) instead of hand-duplicating each shape's math a second time
// in SVG terms.
//
// Curves (arcTo/arc/ellipse) are flattened into short line segments rather
// than emitted as exact SVG arc commands — SVG arc-command sweep-flag
// math is easy to get subtly backwards (a rounded corner silently becomes
// a notch), while a ~1-2 degree polyline approximation is visually
// indistinguishable at any real export size and impossible to get
// geometrically inverted. This is a deliberate, documented fidelity
// trade-off, not a corner cut on unrelated behavior.

function normalizeAngleDelta(from, to) {
  // Shortest signed angular distance from `from` to `to`, in (-2π, 2π].
  let delta = to - from;
  while (delta > Math.PI * 2) delta -= Math.PI * 2;
  while (delta < -Math.PI * 2) delta += Math.PI * 2;
  return delta;
}

export function createSvgPathContext() {
  const parts = [];
  let current = null;
  let start = null;

  function emitPoint(x, y, isFirst) {
    parts.push(`${isFirst ? "M" : "L"} ${round(x)} ${round(y)}`);
    current = { x, y };
  }

  function round(n) {
    return Math.round(n * 1000) / 1000;
  }

  function sampleArc(cx, cy, rx, ry, rotation, startAngle, endAngle, segments) {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    for (let i = 0; i <= segments; i++) {
      const t = startAngle + ((endAngle - startAngle) * i) / segments;
      const ex = rx * Math.cos(t);
      const ey = ry * Math.sin(t);
      const x = cx + ex * cos - ey * sin;
      const y = cy + ex * sin + ey * cos;
      emitPoint(x, y, current === null && i === 0);
    }
  }

  return {
    beginPath() {
      parts.length = 0;
      current = null;
      start = null;
    },
    moveTo(x, y) {
      emitPoint(x, y, true);
      start = { x, y };
    },
    lineTo(x, y) {
      emitPoint(x, y, current === null);
      if (!start) start = current;
    },
    closePath() {
      if (parts.length > 0) parts.push("Z");
      if (start) current = { ...start };
    },
    rect(x, y, w, h) {
      emitPoint(x, y, current === null);
      parts.push(`L ${round(x + w)} ${round(y)}`, `L ${round(x + w)} ${round(y + h)}`, `L ${round(x)} ${round(y + h)}`, "Z");
      start = { x, y };
      current = { x, y };
    },
    // Faithful to the WHATWG arcTo tangent-circle construction (same
    // algorithm the browser itself uses for canvas arcTo), but the curved
    // portion is emitted as a short sampled polyline instead of an SVG
    // arc command — see file header.
    arcTo(x1, y1, x2, y2, radius) {
      const p0 = current || { x: x1, y: y1 };
      const v1x = p0.x - x1;
      const v1y = p0.y - y1;
      const v2x = x2 - x1;
      const v2y = y2 - y1;
      const len1 = Math.hypot(v1x, v1y);
      const len2 = Math.hypot(v2x, v2y);
      if (!radius || len1 === 0 || len2 === 0) {
        emitPoint(x1, y1, current === null);
        return;
      }
      const u1x = v1x / len1;
      const u1y = v1y / len1;
      const u2x = v2x / len2;
      const u2y = v2y / len2;
      const cross = u1x * u2y - u1y * u2x;
      const dot = Math.max(-1, Math.min(1, u1x * u2x + u1y * u2y));
      if (Math.abs(cross) < 1e-6) {
        emitPoint(x1, y1, current === null);
        return;
      }
      const angle = Math.acos(dot);
      const dist = radius / Math.tan(angle / 2);
      const t1x = x1 + u1x * dist;
      const t1y = y1 + u1y * dist;
      const t2x = x1 + u2x * dist;
      const t2y = y1 + u2y * dist;
      const bisectX = u1x + u2x;
      const bisectY = u1y + u2y;
      const bisectLen = Math.hypot(bisectX, bisectY) || 1;
      const centerDist = radius / Math.sin(angle / 2);
      const cx = x1 + (bisectX / bisectLen) * centerDist;
      const cy = y1 + (bisectY / bisectLen) * centerDist;

      emitPoint(t1x, t1y, current === null);
      const startAngle = Math.atan2(t1y - cy, t1x - cx);
      const endAngleRaw = Math.atan2(t2y - cy, t2x - cx);
      const delta = normalizeAngleDelta(startAngle, endAngleRaw);
      const shortDelta = Math.abs(delta) <= Math.PI ? delta : delta - Math.sign(delta) * Math.PI * 2;
      const segments = Math.max(2, Math.round((Math.abs(shortDelta) / (Math.PI / 2)) * 12));
      sampleArc(cx, cy, radius, radius, 0, startAngle, startAngle + shortDelta, segments);
    },
    arc(cx, cy, radius, startAngle, endAngle, anticlockwise = false) {
      let delta = endAngle - startAngle;
      if (anticlockwise) {
        while (delta > 0) delta -= Math.PI * 2;
      } else {
        while (delta < 0) delta += Math.PI * 2;
      }
      const segments = Math.max(8, Math.round((Math.abs(delta) / (Math.PI * 2)) * 90));
      sampleArc(cx, cy, radius, radius, 0, startAngle, startAngle + delta, segments);
    },
    ellipse(cx, cy, rx, ry, rotation = 0, startAngle = 0, endAngle = Math.PI * 2, anticlockwise = false) {
      let delta = endAngle - startAngle;
      if (anticlockwise) {
        while (delta > 0) delta -= Math.PI * 2;
      } else {
        while (delta < 0) delta += Math.PI * 2;
      }
      const segments = Math.max(24, Math.round((Math.abs(delta) / (Math.PI * 2)) * 96));
      sampleArc(cx, cy, rx, ry, rotation, startAngle, startAngle + delta, segments);
    },
    // Path-only builders never call this (see shapeGeometry.js's header
    // comment) — present only so an accidental call doesn't throw.
    fillStrokeShape() {},
    getPathData() {
      return parts.join(" ");
    },
  };
}
