// Connected-component analysis over a binary foreground mask, noise
// filtering, proximity-based merging (so a logo's separate color pieces, an
// "i"'s dot+stem, or sparkles around a design stay one region), and a
// best-effort contour trace for the hover outline.

// 8-connected flood fill with an explicit stack (no recursion — avoids blowing
// the call stack on a large solid region). Returns per-pixel `labels` (-1 =
// background) plus each component's bbox/area; the mask BITS themselves are
// re-derived from `labels` on demand (see buildRegionMask below) rather than
// duplicated into a second per-component array.
export function findConnectedComponents(mask, width, height) {
  const labels = new Int32Array(width * height).fill(-1);
  const components = [];
  const stack = new Int32Array(width * height);
  let nextId = 0;

  for (let start = 0; start < mask.length; start++) {
    if (mask[start] === 0 || labels[start] !== -1) continue;
    const id = nextId++;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let area = 0;
    let stackPtr = 0;
    stack[stackPtr++] = start;
    labels[start] = id;
    while (stackPtr > 0) {
      const idx = stack[--stackPtr];
      const x = idx % width;
      const y = (idx / width) | 0;
      area++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nIdx = ny * width + nx;
          if (mask[nIdx] === 1 && labels[nIdx] === -1) {
            labels[nIdx] = id;
            stack[stackPtr++] = nIdx;
          }
        }
      }
    }
    components.push({ id, minX, minY, maxX, maxY, area });
  }
  return { labels, components };
}

// Thresholds are FRACTIONS of the processing image's area/shorter side, so
// they scale correctly no matter what resolution detection ran at (spec:
// "do not hardcode thresholds that only work at one image resolution").
export function filterNoiseComponents(components, { minAreaFraction = 0.00025, minDimFraction = 0.012 } = {}, width, height) {
  const totalArea = Math.max(1, width * height);
  const shorterSide = Math.max(1, Math.min(width, height));
  const minArea = Math.max(4, totalArea * minAreaFraction);
  const minDim = Math.max(2, shorterSide * minDimFraction);
  return components.filter((c) => {
    const w = c.maxX - c.minX + 1;
    const h = c.maxY - c.minY + 1;
    return c.area >= minArea && w >= minDim && h >= minDim;
  });
}

// Expands each component's bbox by a gap derived from the image diagonal
// (scaled by `mergeAmount`, 0..1) and unions any whose expanded bboxes
// overlap, iterated to a fixed point via union-find so A-B-C chains merge
// into one group even if A and C don't directly overlap.
export function mergeNearbyComponents(components, mergeAmount = 0.5, width, height) {
  if (components.length === 0) return [];
  if (components.length === 1) {
    const c = components[0];
    return [{ id: `merged-${c.id}`, minX: c.minX, minY: c.minY, maxX: c.maxX, maxY: c.maxY, area: c.area, memberIds: [c.id] }];
  }

  const diagonal = Math.hypot(width, height);
  const amount = Math.max(0, Math.min(1, mergeAmount));
  const gap = Math.max(2, diagonal * 0.015 * (0.3 + amount * 1.6));

  const n = components.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  function find(i) {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }
  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  const boxes = components.map((c) => ({ minX: c.minX - gap, minY: c.minY - gap, maxX: c.maxX + gap, maxY: c.maxY + gap }));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY) union(i, j);
    }
  }

  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(i);
  }

  return Array.from(groups.values()).map((indices) => {
    const members = indices.map((i) => components[i]);
    const minX = Math.min(...members.map((m) => m.minX));
    const minY = Math.min(...members.map((m) => m.minY));
    const maxX = Math.max(...members.map((m) => m.maxX));
    const maxY = Math.max(...members.map((m) => m.maxY));
    const area = members.reduce((sum, m) => sum + m.area, 0);
    return { id: `merged-${minX}-${minY}-${maxX}-${maxY}-${members.length}`, minX, minY, maxX, maxY, area, memberIds: members.map((m) => m.id) };
  });
}

// Builds a compact local bitmap (bboxW x bboxH) for one merged group,
// reading straight off the shared `labels` array — this is what preserves
// holes (a ring/donut/letter's interior background pixels are simply never
// set, since they were never part of any member component).
export function buildRegionMask(labels, width, group) {
  const bboxW = group.maxX - group.minX + 1;
  const bboxH = group.maxY - group.minY + 1;
  const memberSet = new Set(group.memberIds);
  const localMask = new Uint8Array(bboxW * bboxH);
  for (let y = group.minY; y <= group.maxY; y++) {
    for (let x = group.minX; x <= group.maxX; x++) {
      const lbl = labels[y * width + x];
      if (lbl !== -1 && memberSet.has(lbl)) localMask[(y - group.minY) * bboxW + (x - group.minX)] = 1;
    }
  }
  return { width: bboxW, height: bboxH, data: localMask };
}

// Moore-neighbor boundary tracing over a region's own local mask, decimated
// to a handful of points — a best-effort "clean selection boundary" outline
// for the hover highlight. Returns null on a degenerate/failed trace; the
// caller falls back to a plain bbox rect (never a hard failure).
export function traceRegionOutline(localMask) {
  const { width: w, height: h, data } = localMask;
  const isFg = (x, y) => x >= 0 && x < w && y >= 0 && y < h && data[y * w + x] === 1;

  let startIdx = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i] === 1) {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) return null;
  const startX = startIdx % w;
  const startY = (startIdx / w) | 0;

  // Clockwise 8-neighbor offsets starting due west, standard Moore tracing.
  const dirs = [
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
  ];

  const points = [];
  let cx = startX;
  let cy = startY;
  let searchFrom = 0;
  const maxSteps = w * h * 4 + 16;
  let steps = 0;

  do {
    points.push([cx, cy]);
    let moved = false;
    for (let k = 0; k < 8; k++) {
      const dirIdx = (searchFrom + k) % 8;
      const [dx, dy] = dirs[dirIdx];
      if (isFg(cx + dx, cy + dy)) {
        cx += dx;
        cy += dy;
        searchFrom = (dirIdx + 5) % 8; // resume scanning just behind the direction we arrived from
        moved = true;
        break;
      }
    }
    if (!moved) break;
    steps++;
  } while (steps < maxSteps && (cx !== startX || cy !== startY));

  if (points.length < 3) return null;
  return decimatePolygon(points, Math.max(1, Math.min(w, h) * 0.02));
}

function decimatePolygon(points, minDist) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [px, py] = out[out.length - 1];
    const [x, y] = points[i];
    if (Math.hypot(x - px, y - py) >= minDist) out.push([x, y]);
  }
  return out;
}
