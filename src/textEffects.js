// Text effects (shadow/outline/glow) reuse Konva's native shadow
// mechanism — the same shadowColor/Blur/Opacity/OffsetX/Y attrs already
// used for shape drop-shadows in Phase 3 — generalized to read from
// `item.effects` instead of being shape-only. Shadow and glow share one
// underlying mechanism (a shadow with 0,0 offset and a larger blur reads
// as a glow) so only one of the two is active at a time in this phase;
// outline (stroke) is independent and can combine with either.
export function getTextEffectProps(item) {
  const effects = item.effects;
  if (!effects) return {};
  const props = {};

  if (effects.shadow?.enabled) {
    props.shadowColor = effects.shadow.color || "#000000";
    props.shadowBlur = effects.shadow.blur ?? 8;
    props.shadowOpacity = effects.shadow.opacity ?? 0.6;
    props.shadowOffsetX = effects.shadow.offsetX ?? 2;
    props.shadowOffsetY = effects.shadow.offsetY ?? 2;
  } else if (effects.glow?.enabled) {
    props.shadowColor = effects.glow.color || "#8b5cf6";
    props.shadowBlur = effects.glow.blur ?? 16;
    props.shadowOpacity = effects.glow.opacity ?? 0.85;
    props.shadowOffsetX = 0;
    props.shadowOffsetY = 0;
  }

  if (effects.outline?.enabled) {
    props.stroke = effects.outline.color || "#000000";
    props.strokeWidth = effects.outline.width ?? 1;
    props.fillAfterStrokeEnabled = true;
  }

  return props;
}

export function defaultTextEffects() {
  return {
    shadow: { enabled: false, color: "#000000", opacity: 0.6, blur: 8, offsetX: 2, offsetY: 2 },
    outline: { enabled: false, color: "#000000", width: 1 },
    glow: { enabled: false, color: "#8b5cf6", opacity: 0.85, blur: 16 },
  };
}
