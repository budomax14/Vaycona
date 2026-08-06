// Phase 12 — page transitions (spec §32-35). Transition data lives on the
// OUTGOING page (`page.transition`, see animationSchema.js's
// clampTransition) — a single, consistently-used storage location (spec
// §33's "choose one approach"). Transition RENDERING never touches page
// objects — it only computes extra opacity/offset/scale props layered on
// top of the two pages' own (already-animated) render output, exactly like
// animationService.js layers deltas on top of base geometry.

const TRANSITION_PRESETS = {
  none: { label: "None" },
  fade: { label: "Fade" },
  dissolve: { label: "Dissolve" },
  slideLeft: { label: "Slide left" },
  slideRight: { label: "Slide right" },
  slideUp: { label: "Slide up" },
  slideDown: { label: "Slide down" },
  push: { label: "Push" },
  wipe: { label: "Wipe" },
  zoom: { label: "Zoom" },
};

export function getTransitionPresetLabel(type) {
  return TRANSITION_PRESETS[type]?.label || "None";
}

export const TRANSITION_TYPE_LIST = Object.keys(TRANSITION_PRESETS);

// progress: 0 = fully on outgoing page, 1 = fully on incoming page.
// pageSize: {width, height} — both pages share the same canvas viewport.
// Returns { outgoing: {opacity,x,y,scaleX,scaleY}, incoming: {...} } —
// deltas to layer on top of each page's own rendered content.
export function computeTransitionFrame(transition, progress, pageSize) {
  const t = Math.min(1, Math.max(0, progress));
  const { width, height } = pageSize;
  const identity = { opacity: 1, x: 0, y: 0, scaleX: 1, scaleY: 1 };

  switch (transition?.type) {
    case "fade":
    case "dissolve":
      return {
        outgoing: { ...identity, opacity: 1 - t },
        incoming: { ...identity, opacity: t },
      };
    case "slideLeft":
      return {
        outgoing: { ...identity, x: -width * t },
        incoming: { ...identity, x: width * (1 - t) },
      };
    case "slideRight":
      return {
        outgoing: { ...identity, x: width * t },
        incoming: { ...identity, x: -width * (1 - t) },
      };
    case "slideUp":
      return {
        outgoing: { ...identity, y: -height * t },
        incoming: { ...identity, y: height * (1 - t) },
      };
    case "slideDown":
      return {
        outgoing: { ...identity, y: height * t },
        incoming: { ...identity, y: -height * (1 - t) },
      };
    case "push":
      // Same as slideLeft but both pages move in lockstep with no gap —
      // visually distinct in a full compositor; here it's the same offset
      // math as slideLeft, kept as its own named preset for the UI/spec.
      return {
        outgoing: { ...identity, x: -width * t },
        incoming: { ...identity, x: width * (1 - t) },
      };
    case "wipe":
      // Approximated as a fast dissolve with a harder edge (no true clip
      // mask across two independent stages this phase) — documented
      // limitation, see completion report.
      return {
        outgoing: { ...identity, opacity: t < 0.5 ? 1 : 0 },
        incoming: { ...identity, opacity: t < 0.5 ? 0 : 1 },
      };
    case "zoom":
      return {
        outgoing: { ...identity, opacity: 1 - t, scaleX: 1 + t * 0.3, scaleY: 1 + t * 0.3 },
        incoming: { ...identity, opacity: t, scaleX: 1.3 - t * 0.3, scaleY: 1.3 - t * 0.3 },
      };
    case "none":
    default:
      return { outgoing: { ...identity, opacity: t < 1 ? 1 : 0 }, incoming: { ...identity, opacity: t >= 1 ? 1 : 0 } };
  }
}
