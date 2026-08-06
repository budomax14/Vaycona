// Shared gradient-fill resolver — originally lived only in ShapeNode.jsx
// (Phase 11 brand-kit gradients); extracted so SimpleTextNode.jsx can
// render the same `item.fillGradient` descriptor for text color gradients.
// Konva's `Shape`/`Text` nodes both already understand fillLinearGradient*/
// fillRadialGradient* attrs natively, so this is just resolving one small
// descriptor into those attrs — no renderer-specific logic here.
//
// `item.fillGradient` shape: { type: "linear" | "radial", angle (degrees,
// linear only), stops: [{ position: 0-1, color: hex }, ...] } — the same
// shape brandKitService.js's resolveGradient produces, so a gradient
// picked ad hoc (see TextColorPanel.jsx) and one resolved from a brand kit
// gradient token render identically.
export function resolveGradientKonvaProps(item) {
  const gradient = item.fillGradient;
  if (!gradient || !Array.isArray(gradient.stops) || gradient.stops.length < 2) return null;
  const colorStops = gradient.stops.flatMap((stop) => [stop.position, stop.color]);
  const w = item.width || 1;
  const h = item.height || 1;
  if (gradient.type === "radial") {
    return {
      fillRadialGradientStartPoint: { x: w / 2, y: h / 2 },
      fillRadialGradientStartRadius: 0,
      fillRadialGradientEndPoint: { x: w / 2, y: h / 2 },
      fillRadialGradientEndRadius: Math.max(w, h) / 2,
      fillRadialGradientColorStops: colorStops,
    };
  }
  const angle = ((gradient.angle ?? 90) * Math.PI) / 180;
  const cx = w / 2;
  const cy = h / 2;
  const len = (Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle))) / 2;
  return {
    fillLinearGradientStartPoint: { x: cx - Math.cos(angle) * len, y: cy - Math.sin(angle) * len },
    fillLinearGradientEndPoint: { x: cx + Math.cos(angle) * len, y: cy + Math.sin(angle) * len },
    fillLinearGradientColorStops: colorStops,
  };
}

// Same descriptor + geometry as resolveGradientKonvaProps above, but
// materialized as a real CanvasGradient — for the two text renderers
// (RichTextNode.jsx, CurvedTextNode.jsx) that draw via raw ctx.fillText
// instead of Konva's native fillLinearGradient*/fillRadialGradient* attrs,
// so item.fillGradient renders identically there instead of being silently
// ignored (those renderers previously only read the plain `fill` color).
export function createCanvasGradient(ctx, gradient, width, height) {
  if (!gradient || !Array.isArray(gradient.stops) || gradient.stops.length < 2) return null;
  const w = width || 1;
  const h = height || 1;
  const cx = w / 2;
  const cy = h / 2;
  let canvasGradient;
  if (gradient.type === "radial") {
    canvasGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) / 2);
  } else {
    const angle = ((gradient.angle ?? 90) * Math.PI) / 180;
    const len = (Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle))) / 2;
    canvasGradient = ctx.createLinearGradient(
      cx - Math.cos(angle) * len,
      cy - Math.sin(angle) * len,
      cx + Math.cos(angle) * len,
      cy + Math.sin(angle) * len
    );
  }
  [...gradient.stops]
    .sort((a, b) => a.position - b.position)
    .forEach((stop) => canvasGradient.addColorStop(stop.position, stop.color));
  return canvasGradient;
}

// CSS-equivalent preview string for a gradient descriptor — used by the UI
// (a small live swatch/preview bar) only, never by the Konva renderer
// above, so it can use plain CSS gradient syntax directly.
export function gradientToCss(gradient) {
  if (!gradient || !Array.isArray(gradient.stops) || gradient.stops.length < 2) return null;
  const stops = [...gradient.stops]
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${Math.round(s.position * 100)}%`)
    .join(", ");
  return gradient.type === "radial" ? `radial-gradient(circle, ${stops})` : `linear-gradient(${gradient.angle ?? 90}deg, ${stops})`;
}

export function defaultGradient() {
  return { type: "linear", angle: 90, stops: [{ position: 0, color: "#8b5cf6" }, { position: 1, color: "#ec4899" }] };
}

// A handful of curated quick-pick gradients (same taste/hue family as
// STARTER_PALETTE in toolbarUi.jsx) so the Gradient tab isn't blank on
// first open — purely presets, not a separate storage system.
export const GRADIENT_PRESETS = [
  { type: "linear", angle: 90, stops: [{ position: 0, color: "#8b5cf6" }, { position: 1, color: "#ec4899" }] },
  { type: "linear", angle: 90, stops: [{ position: 0, color: "#3b82f6" }, { position: 1, color: "#06b6d4" }] },
  { type: "linear", angle: 90, stops: [{ position: 0, color: "#f97316" }, { position: 1, color: "#eab308" }] },
  { type: "linear", angle: 90, stops: [{ position: 0, color: "#22c55e" }, { position: 1, color: "#14b8a6" }] },
  { type: "linear", angle: 90, stops: [{ position: 0, color: "#ef4444" }, { position: 1, color: "#f97316" }] },
  { type: "linear", angle: 135, stops: [{ position: 0, color: "#6366f1" }, { position: 1, color: "#a855f7" }] },
  { type: "linear", angle: 90, stops: [{ position: 0, color: "#111827" }, { position: 1, color: "#6b7280" }] },
  { type: "radial", stops: [{ position: 0, color: "#fde047" }, { position: 1, color: "#f97316" }] },
];
