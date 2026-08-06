// Phase 12 — basic motion-path geometry (spec §27/§28/§29). Deliberately
// small: straight lines, quadratic-curved segments, and simple multi-point
// polylines — not a full vector-path editor. Points are page-relative
// (same coordinate space as item x/y — spec §29). Data validation/clamping
// lives in animationSchema.js; this module only evaluates geometry.

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function quadPoint(p0, c, p1, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x,
    y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y,
  };
}

// Per-segment arclength approximation (12 samples/segment is plenty for a
// path this simple) so that motion along a curved segment moves at a
// roughly constant visual speed rather than speeding up/slowing down with
// the raw parametric t.
function segmentLength(p0, c, p1) {
  const samples = 12;
  let len = 0;
  let prev = p0;
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const pt = c ? quadPoint(p0, c, p1, t) : { x: lerp(p0.x, p1.x, t), y: lerp(p0.y, p1.y, t) };
    len += Math.hypot(pt.x - prev.x, pt.y - prev.y);
    prev = pt;
  }
  return len;
}

function buildSegments(path) {
  const points = path.points;
  const segments = [];
  const count = path.closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) {
    const p0 = points[i];
    const p1 = points[(i + 1) % points.length];
    const c = path.controlPoints?.[i] || null;
    segments.push({ p0, p1, c, length: segmentLength(p0, c, p1) });
  }
  return segments;
}

// Position (+ tangent angle in degrees, for orient-to-path) at normalized
// path progress s (0..1), honoring startOffset/endOffset/reverse.
export function evaluateMotionPath(path, s) {
  const segments = buildSegments(path);
  const totalLength = segments.reduce((sum, seg) => sum + seg.length, 0) || 1;
  const start = Math.min(path.startOffset ?? 0, path.endOffset ?? 1);
  const end = Math.max(path.startOffset ?? 0, path.endOffset ?? 1);
  let effectiveS = start + (end - start) * Math.min(1, Math.max(0, s));
  if (path.reverse) effectiveS = 1 - effectiveS;

  let targetLength = effectiveS * totalLength;
  let seg = segments[0];
  let segT = 0;
  for (const s2 of segments) {
    if (targetLength <= s2.length || s2 === segments[segments.length - 1]) {
      seg = s2;
      segT = s2.length > 0 ? Math.min(1, targetLength / s2.length) : 0;
      break;
    }
    targetLength -= s2.length;
  }
  if (!seg) return { x: path.points[0]?.x ?? 0, y: path.points[0]?.y ?? 0, angle: 0 };

  const point = seg.c ? quadPoint(seg.p0, seg.c, seg.p1, segT) : { x: lerp(seg.p0.x, seg.p1.x, segT), y: lerp(seg.p0.y, seg.p1.y, segT) };

  // Tangent via a tiny forward finite difference along the same segment.
  const dt = 0.01;
  const aheadT = Math.min(1, segT + dt);
  const ahead = seg.c ? quadPoint(seg.p0, seg.c, seg.p1, aheadT) : { x: lerp(seg.p0.x, seg.p1.x, aheadT), y: lerp(seg.p0.y, seg.p1.y, aheadT) };
  const angle = (Math.atan2(ahead.y - point.y, ahead.x - point.x) * 180) / Math.PI;

  return { x: point.x, y: point.y, angle };
}

export function motionPathStartPoint(path) {
  return evaluateMotionPath(path, 0);
}
