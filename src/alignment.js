import { getItemBounds, unionBounds } from "./bounds";

// edge: "left" | "center-h" | "right" | "top" | "middle-v" | "bottom"
export function alignItems(items, edge) {
  if (items.length < 2) return items;
  const group = unionBounds(items.map(getItemBounds));

  return items.map((item) => {
    switch (edge) {
      case "left":
        return { ...item, x: group.left };
      case "center-h":
        return { ...item, x: group.centerX - item.width / 2 };
      case "right":
        return { ...item, x: group.right - item.width };
      case "top":
        return { ...item, y: group.top };
      case "middle-v":
        return { ...item, y: group.centerY - item.height / 2 };
      case "bottom":
        return { ...item, y: group.bottom - item.height };
      default:
        return item;
    }
  });
}

// mode: "center-h" | "center-v" | "center-both" — relative to the page, not
// the selection's own bounds (unlike alignItems above).
export function alignToPage(items, page, mode) {
  return items.map((item) => {
    const next = { ...item };
    if (mode === "center-h" || mode === "center-both") {
      next.x = (page.width - item.width) / 2;
    }
    if (mode === "center-v" || mode === "center-both") {
      next.y = (page.height - item.height) / 2;
    }
    return next;
  });
}

// axis: "horizontal" | "vertical"
export function distributeItems(items, axis) {
  if (items.length < 3) return items;

  const key = axis === "horizontal" ? "x" : "y";
  const size = axis === "horizontal" ? "width" : "height";
  const sorted = [...items].sort((a, b) => a[key] - b[key]);

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = last[key] + last[size] - first[key];
  const totalSize = sorted.reduce((sum, item) => sum + item[size], 0);
  const gap = (span - totalSize) / (sorted.length - 1);

  let cursor = first[key];
  const positions = new Map();
  sorted.forEach((item, index) => {
    if (index === 0) {
      positions.set(item.id, first[key]);
      cursor = first[key] + item[size] + gap;
      return;
    }
    if (index === sorted.length - 1) {
      positions.set(item.id, last[key]);
      return;
    }
    positions.set(item.id, cursor);
    cursor += item[size] + gap;
  });

  return items.map((item) =>
    positions.has(item.id) ? { ...item, [key]: positions.get(item.id) } : item
  );
}

// Smart Spacing (explicit Gap control) — unlike distributeItems above,
// which derives an equal gap from the selection's own existing span, this
// takes the gap as a fixed input and repositions items to exactly that
// spacing. Anchored on the selection's current center along `axis` (not
// its first item's position) so typing a new Gap value grows/shrinks the
// row/column symmetrically instead of walking it off across the canvas.
export function distributeItemsWithGap(items, axis, gapPx) {
  if (items.length < 2) return items;
  const key = axis === "horizontal" ? "x" : "y";
  const size = axis === "horizontal" ? "width" : "height";
  const gap = Math.max(0, gapPx);
  const sorted = [...items].sort((a, b) => a[key] - b[key]);
  const totalSize = sorted.reduce((sum, item) => sum + item[size], 0);
  const span = totalSize + gap * (sorted.length - 1);

  const bounds = unionBounds(items.map(getItemBounds));
  const center = axis === "horizontal" ? bounds.centerX : bounds.centerY;

  let cursor = center - span / 2;
  const positions = new Map();
  sorted.forEach((item) => {
    positions.set(item.id, cursor);
    cursor += item[size] + gap;
  });

  return items.map((item) =>
    positions.has(item.id) ? { ...item, [key]: positions.get(item.id) } : item
  );
}

// Reads the CURRENT average gap between items along `axis` — feeds the
// Gap field's displayed value (and Lock Spacing's captured target) without
// requiring the user to have run distribute first.
export function computeCurrentGap(items, axis) {
  if (items.length < 2) return null;
  const key = axis === "horizontal" ? "x" : "y";
  const size = axis === "horizontal" ? "width" : "height";
  const sorted = [...items].sort((a, b) => a[key] - b[key]);
  let total = 0;
  for (let i = 1; i < sorted.length; i++) {
    total += sorted[i][key] - (sorted[i - 1][key] + sorted[i - 1][size]);
  }
  return total / (sorted.length - 1);
}

// Which axis a Gap control should act on by default when the user hasn't
// picked one explicitly — whichever axis the selection is actually spread
// out along (a wide-and-short arrangement is a horizontal row, etc).
export function inferDistributeAxis(items) {
  if (items.length < 2) return "horizontal";
  const bounds = unionBounds(items.map(getItemBounds));
  return bounds.width >= bounds.height ? "horizontal" : "vertical";
}
