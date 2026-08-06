// Phase 11 — pure "apply a brand resource onto an item/page" functions.
// Shared by direct per-object apply actions (ColorField/ObjectStylePicker/
// TypographyPicker/ImageStylePicker/BackgroundsPanel) AND theme application
// (themeApply.js), so there is exactly one implementation of what "apply
// typography style X" actually does to an object. Every function returns a
// NEW item/page (never mutates), consistent with App.jsx's commit()
// contract — callers are responsible for the actual history/autosave
// transaction.
//
// See brandLinks.js for the fallback-value design note: every function
// here writes the fully RESOLVED literal value onto the object's normal
// field, plus a small `*Ref` pointer used only for link-state UI and
// find-usage/update-linked — never a pointer-only/render-time-resolve
// scheme.

import { setColorLink, detachColorLink, setStyleRef, clearStyleRef, REF_KEYS } from "./brandLinks";
import { resolveColor, resolveTypography, resolveGradient } from "./brandKitService";
import { getFontEntry } from "./fontLibrary";

export function applyColorToken(item, fieldPath, brandKitId, token) {
  return setColorLink(item, fieldPath, { brandKitId, tokenId: token.id }, token.hex);
}

export function detachColor(item, fieldPath) {
  return detachColorLink(item, fieldPath);
}

export function applyTypographyStyle(item, kit, styleId) {
  const resolved = resolveTypography(kit, styleId);
  if (!resolved) return item;
  const next = {
    ...item,
    fontFamily: resolved.fontFamilyName,
    fontSize: resolved.fontSize,
    fontWeight: resolved.fontWeight,
    italic: resolved.fontStyle === "italic",
    align: resolved.align || item.align,
    lineHeight: resolved.lineHeight,
    letterSpacing: resolved.letterSpacing,
    textTransform: resolved.textTransform || "none",
    paragraphSpacing: resolved.paragraphSpacing ?? item.paragraphSpacing,
  };
  if (resolved.fill) Object.assign(next, applyColorToken(next, "fill", kit.id, { id: resolved.colorId, hex: resolved.fill }));
  return setStyleRef(next, REF_KEYS.typography, { brandKitId: kit.id, styleId });
}

export function detachTypographyStyle(item) {
  return clearStyleRef(item, REF_KEYS.typography);
}

// Builds a typography token definition FROM a text item's current values
// (spec §24/§25 "create new style from selected text") — tries to match an
// existing brand font token by family name first; falls back to a literal
// fontFamilyFallback (spec §67) when nothing matches, rather than silently
// picking an unrelated font.
export function typographyTokenFromItem(item, kit) {
  const matchedFont = kit.fonts.find((f) => f.family === item.fontFamily);
  const matchedColor = kit.colors.find((c) => c.hex.toLowerCase() === (item.fill || "").toLowerCase());
  return {
    fontId: matchedFont?.id || null,
    fontFamilyFallback: item.fontFamily || "Arial",
    fontSize: item.fontSize || 16,
    fontWeight: item.fontWeight || "normal",
    fontStyle: item.italic ? "italic" : "normal",
    lineHeight: item.lineHeight ?? 1.3,
    letterSpacing: item.letterSpacing ?? 0,
    textTransform: item.textTransform || "none",
    colorId: matchedColor?.id || null,
    align: item.align || "left",
    paragraphSpacing: item.paragraphSpacing ?? 0,
  };
}

const OBJECT_STYLE_FIELDS_BY_TYPE = {
  shape: ["fill", "stroke", "strokeWidth", "cornerRadius", "opacity", "shadow", "shadowBlur"],
  line: ["stroke", "strokeWidth", "opacity"],
  icon: ["fill", "opacity"],
  frame: ["cornerRadius", "opacity"],
};

export function applyObjectStyle(item, kit, styleId) {
  const style = kit.objectStyles.find((s) => s.id === styleId);
  if (!style) return item;
  const allowedFields = OBJECT_STYLE_FIELDS_BY_TYPE[item.type] || [];
  let next = { ...item };
  const props = style.props || {};

  if (allowedFields.includes("fill") && props.fillColorId) {
    const color = resolveColor(kit, props.fillColorId);
    if (color) next = applyColorToken(next, "fill", kit.id, color);
  } else if (allowedFields.includes("fill") && props.fill) {
    next.fill = props.fill;
  }
  if (allowedFields.includes("stroke") && props.strokeColorId) {
    const color = resolveColor(kit, props.strokeColorId);
    if (color) next = applyColorToken(next, "stroke", kit.id, color);
  } else if (allowedFields.includes("stroke") && props.stroke) {
    next.stroke = props.stroke;
  }
  if (allowedFields.includes("strokeWidth") && props.strokeWidth != null) next.strokeWidth = props.strokeWidth;
  if (allowedFields.includes("cornerRadius") && props.cornerRadius != null) next.cornerRadius = props.cornerRadius;
  if (allowedFields.includes("opacity") && props.opacity != null) next.opacity = props.opacity;
  if (allowedFields.includes("shadow") && props.shadow != null) next.shadow = !!props.shadow.enabled;
  if (allowedFields.includes("shadowBlur") && props.shadow?.blur != null) next.shadowBlur = props.shadow.blur;

  return setStyleRef(next, REF_KEYS.objectStyle, { brandKitId: kit.id, styleId });
}

export function detachObjectStyle(item) {
  return clearStyleRef(item, REF_KEYS.objectStyle);
}

export function objectStylePropsFromItem(item) {
  return {
    fill: item.fill ?? null,
    stroke: item.stroke && item.stroke !== "transparent" ? item.stroke : null,
    strokeWidth: item.strokeWidth ?? null,
    cornerRadius: item.cornerRadius ?? null,
    opacity: item.opacity ?? null,
    shadow: item.shadow ? { enabled: true, blur: item.shadowBlur ?? 12 } : null,
  };
}

export function applyImageStyle(item, kit, styleId) {
  const style = kit.imageStyles.find((s) => s.id === styleId);
  if (!style) return item;
  const next = {
    ...item,
    adjustments: style.adjustments ? { ...item.adjustments, ...style.adjustments } : item.adjustments,
    cornerRadius: style.cornerRadius != null ? style.cornerRadius : item.cornerRadius,
    opacity: style.opacity != null ? style.opacity : item.opacity,
  };
  return setStyleRef(next, REF_KEYS.imageStyle, { brandKitId: kit.id, styleId });
}

export function detachImageStyle(item) {
  return clearStyleRef(item, REF_KEYS.imageStyle);
}

export function imageStylePropsFromItem(item) {
  return { adjustments: item.adjustments || {}, cornerRadius: item.cornerRadius ?? null, opacity: item.opacity ?? null };
}

export function applyBackgroundStyle(page, kit, styleId) {
  const style = kit.backgroundStyles.find((s) => s.id === styleId);
  if (!style) return page;
  let color = null;
  if (style.kind === "gradient") {
    const gradient = resolveGradient(kit, style.gradientId);
    color = gradient?.stops?.[0]?.color || style.color || page.background;
  } else {
    color = resolveColor(kit, style.colorId)?.hex || style.color || page.background;
  }
  return { ...page, background: color, backgroundStyleRef: { brandKitId: kit.id, styleId } };
}

export function detachBackgroundStyle(page) {
  if (!page.backgroundStyleRef) return page;
  const next = { ...page };
  delete next.backgroundStyleRef;
  return next;
}

export function isFontKnown(family) {
  return !!getFontEntry(family);
}
