// Axis-aligned bounds (rotation ignored) — used for marquee-select
// intersection and smart-alignment snap targets, matching how most design
// tools simplify this case for rotated items.
export function getItemBounds(item) {
  return {
    left: item.x,
    top: item.y,
    right: item.x + item.width,
    bottom: item.y + item.height,
    centerX: item.x + item.width / 2,
    centerY: item.y + item.height / 2,
    width: item.width,
    height: item.height,
  };
}

export function rectsIntersect(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function unionBounds(boundsList) {
  if (boundsList.length === 0) return null;
  const left = Math.min(...boundsList.map((b) => b.left));
  const top = Math.min(...boundsList.map((b) => b.top));
  const right = Math.max(...boundsList.map((b) => b.right));
  const bottom = Math.max(...boundsList.map((b) => b.bottom));
  return {
    left,
    top,
    right,
    bottom,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
    width: right - left,
    height: bottom - top,
  };
}
