import { getUnit } from "./pageSizes";

export function screenToContent({ x, y }, viewport) {
  return {
    x: (x - viewport.x) / viewport.scale,
    y: (y - viewport.y) / viewport.scale,
  };
}

export function contentToScreen({ x, y }, viewport) {
  return {
    x: x * viewport.scale + viewport.x,
    y: y * viewport.scale + viewport.y,
  };
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Picks a "nice" tick step (1/2/5 x 10^n) so ticks stay ~targetPx apart on
// screen regardless of zoom, rather than a fixed canvas-space spacing that
// would become unreadable when zoomed far in or out. Phase 10: the "nice
// number" search now runs in the DISPLAY unit's own space (not always px),
// so switching to inches/cm/mm re-derives sensible round numbers in that
// unit (e.g. 0.5in, 5mm) rather than just relabeling awkward px-derived
// values — then converts back to content px, which is all tick placement
// ever needs.
export function computeRulerSteps(scale, unitKey = "px", targetPx = 70) {
  const unit = getUnit(unitKey);
  const rawStepContentPx = targetPx / scale;
  const rawStepDisplay = unit.fromPx(rawStepContentPx);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStepDisplay || 1)));
  const residual = rawStepDisplay / magnitude;
  const niceResidual = residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1;
  const majorDisplay = niceResidual * magnitude;
  const minorDisplay = majorDisplay / (niceResidual === 5 ? 5 : niceResidual === 2 ? 2 : 10);
  return { minor: unit.toPx(minorDisplay), major: unit.toPx(majorDisplay) };
}
