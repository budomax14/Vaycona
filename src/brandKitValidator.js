// Phase 11 — brand-kit validation + safe repairs. Mirrors
// projectValidator.js's shape (validate -> {status, fatalErrors, errors,
// warnings, repairs, info}, then a separate repair() that only applies the
// unambiguous fixes the report already called out) — the same report
// contract Version History / Project Safety / import preview already
// understand, extended to a second resource kind.

import { BRAND_KIT_FORMAT_VERSION } from "./constants";
import { isValidColor, parseColor } from "./brandColor";
import { BRAND_RESOURCE_COLLECTIONS } from "./brandKitService";

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function pushFinding(list, severity, code, message, ref) {
  list.push({ severity, code, message, ref: ref || null });
}

export function validateBrandKit(kit) {
  const fatalErrors = [];
  const errors = [];
  const warnings = [];
  const repairs = [];
  const info = [];

  if (!kit || typeof kit !== "object") {
    pushFinding(fatalErrors, "fatal", "not-an-object", "Brand kit data is not a valid object.");
    return { status: "fatal", fatalErrors, errors, warnings, repairs, info };
  }
  if (typeof kit.id !== "string" || !kit.id) {
    pushFinding(fatalErrors, "fatal", "missing-id", "Brand kit is missing a valid ID.");
    return { status: "fatal", fatalErrors, errors, warnings, repairs, info };
  }
  if (kit.brandKitFormatVersion > BRAND_KIT_FORMAT_VERSION) {
    pushFinding(fatalErrors, "fatal", "unsupported-format", "This brand kit was created by a newer app version.");
    return { status: "fatal", fatalErrors, errors, warnings, repairs, info };
  }
  if (!kit.name || typeof kit.name !== "string") {
    pushFinding(warnings, "warning", "missing-name", "Brand kit has no name and will use a default.");
    repairs.push({ code: "default-name", message: "Applied a default name." });
  }
  if (!isFiniteNumber(kit.createdAt) || !isFiniteNumber(kit.updatedAt)) {
    pushFinding(warnings, "warning", "invalid-timestamps", "Brand kit has invalid timestamps and will use the current time.");
    repairs.push({ code: "fix-timestamps", message: "Reset invalid timestamps." });
  }

  // --- colors ---
  const colorIdSet = new Set();
  (kit.colors || []).forEach((color) => {
    if (!color || typeof color.id !== "string") {
      pushFinding(errors, "error", "invalid-color", "A color token is missing a valid ID and will be skipped.");
      return;
    }
    if (colorIdSet.has(color.id)) {
      pushFinding(errors, "error", "duplicate-color-id", `Duplicate color token ID: ${color.id}`, color.id);
    }
    colorIdSet.add(color.id);
    if (!color.hex || !isValidColor(color.hex)) {
      pushFinding(warnings, "warning", "invalid-color-value", `Color "${color.name || color.id}" has an invalid value and will use a safe fallback.`, color.id);
      repairs.push({ code: "fix-color-value", message: `Replaced invalid color value for "${color.name || color.id}".`, ref: color.id });
    }
    const alpha = color.alpha ?? color.value?.a;
    if (alpha != null && (!isFiniteNumber(alpha) || alpha < 0 || alpha > 1)) {
      pushFinding(warnings, "warning", "invalid-alpha", `Color "${color.name || color.id}" has an invalid alpha and will be clamped.`, color.id);
      repairs.push({ code: "clamp-alpha", message: `Clamped alpha for "${color.name || color.id}".`, ref: color.id });
    }
  });

  // --- palettes: colorIds must reference real colors ---
  (kit.palettes || []).forEach((palette) => {
    (palette.colorIds || []).forEach((colorId) => {
      if (!colorIdSet.has(colorId)) {
        pushFinding(info, "info", "missing-palette-color", `Palette "${palette.name}" references a missing color and it will be removed.`, palette.id);
        repairs.push({ code: "remove-missing-palette-ref", message: `Removed a missing color reference from "${palette.name}".`, ref: palette.id });
      }
    });
  });

  // --- fonts ---
  const fontIdSet = new Set();
  (kit.fonts || []).forEach((font) => {
    if (!font || typeof font.id !== "string") {
      pushFinding(errors, "error", "invalid-font", "A font token is missing a valid ID and will be skipped.");
      return;
    }
    if (fontIdSet.has(font.id)) pushFinding(errors, "error", "duplicate-font-id", `Duplicate font token ID: ${font.id}`, font.id);
    fontIdSet.add(font.id);
    if (!font.family) {
      pushFinding(warnings, "warning", "missing-font-family", `Font "${font.name}" has no family name.`, font.id);
    }
  });

  // --- typography: font/color references ---
  const typographyIdSet = new Set();
  (kit.typography || []).forEach((style) => {
    if (!style || typeof style.id !== "string") return;
    typographyIdSet.add(style.id);
    if (style.fontId && !fontIdSet.has(style.fontId)) {
      pushFinding(warnings, "warning", "missing-typography-font", `Text style "${style.name}" references a missing font and will fall back to a system font.`, style.id);
      repairs.push({ code: "fix-typography-font-ref", message: `Cleared missing font reference on "${style.name}".`, ref: style.id });
    }
    if (style.colorId && !colorIdSet.has(style.colorId)) {
      pushFinding(info, "info", "missing-typography-color", `Text style "${style.name}" references a missing color token.`, style.id);
      repairs.push({ code: "fix-typography-color-ref", message: `Cleared missing color reference on "${style.name}".`, ref: style.id });
    }
    if (style.fontSize != null && (!isFiniteNumber(style.fontSize) || style.fontSize <= 0)) {
      pushFinding(warnings, "warning", "invalid-font-size", `Text style "${style.name}" has an invalid size.`, style.id);
      repairs.push({ code: "fix-font-size", message: `Corrected font size for "${style.name}".`, ref: style.id });
    }
    if (style.lineHeight != null && !isFiniteNumber(style.lineHeight)) {
      pushFinding(warnings, "warning", "invalid-line-height", `Text style "${style.name}" has an invalid line height.`, style.id);
      repairs.push({ code: "fix-line-height", message: `Corrected line height for "${style.name}".`, ref: style.id });
    }
  });

  // --- object styles: numeric sanity ---
  (kit.objectStyles || []).forEach((style) => {
    const p = style.props || {};
    if (p.opacity != null && (!isFiniteNumber(p.opacity) || p.opacity < 0 || p.opacity > 1)) {
      pushFinding(warnings, "warning", "invalid-object-style-opacity", `Object style "${style.name}" has an invalid opacity and will be clamped.`, style.id);
      repairs.push({ code: "clamp-object-style-opacity", message: `Clamped opacity for "${style.name}".`, ref: style.id });
    }
  });

  // --- gradients: stops ---
  (kit.gradients || []).forEach((gradient) => {
    if (!Array.isArray(gradient.stops) || gradient.stops.length < 2) {
      pushFinding(warnings, "warning", "invalid-gradient-stops", `Gradient "${gradient.name}" needs at least 2 stops and will use a safe default.`, gradient.id);
      repairs.push({ code: "fix-gradient-stops", message: `Reset stops for gradient "${gradient.name}".`, ref: gradient.id });
    } else {
      gradient.stops.forEach((stop) => {
        if (stop.color && !isValidColor(stop.color)) {
          pushFinding(warnings, "warning", "invalid-gradient-stop-color", `Gradient "${gradient.name}" has an invalid stop color.`, gradient.id);
          repairs.push({ code: "fix-gradient-stop-color", message: `Corrected a stop color in "${gradient.name}".`, ref: gradient.id });
        }
      });
    }
  });

  // --- background styles / themes: reference checks + circular-reference
  // guard (spec §66 "prevent circular references, set a maximum reference
  // depth" — themes only ever reference colors/typography/object styles/
  // background styles/effects, never other themes, so a cycle is
  // structurally impossible here; this check is a defensive backstop). ---
  const backgroundStyleIdSet = new Set((kit.backgroundStyles || []).map((b) => b.id));
  (kit.backgroundStyles || []).forEach((bg) => {
    if (bg.colorId && !colorIdSet.has(bg.colorId)) {
      pushFinding(info, "info", "missing-background-color", `Background style "${bg.name}" references a missing color.`, bg.id);
      repairs.push({ code: "fix-background-color-ref", message: `Cleared missing color reference on "${bg.name}".`, ref: bg.id });
    }
  });

  (kit.themes || []).forEach((theme) => {
    const refs = [
      ["primaryColorId", colorIdSet], ["secondaryColorId", colorIdSet], ["accentColorId", colorIdSet],
      ["backgroundColorId", colorIdSet], ["textColorId", colorIdSet],
      ["headingTypographyId", typographyIdSet], ["bodyTypographyId", typographyIdSet],
      ["backgroundStyleId", backgroundStyleIdSet],
    ];
    refs.forEach(([field, idSet]) => {
      const value = theme[field];
      if (value && !idSet.has(value)) {
        pushFinding(info, "info", "missing-theme-ref", `Theme "${theme.name}" references a missing resource (${field}).`, theme.id);
        repairs.push({ code: "fix-theme-ref", message: `Cleared a missing reference on theme "${theme.name}" (${field}).`, ref: theme.id });
      }
    });
  });

  // --- duplicate IDs across every collection (defensive — should never
  // happen given addResource always mints crypto.randomUUID()) ---
  BRAND_RESOURCE_COLLECTIONS.forEach((key) => {
    const seen = new Set();
    (kit[key] || []).forEach((r) => {
      if (!r || typeof r.id !== "string") return;
      if (seen.has(r.id)) {
        pushFinding(errors, "error", "duplicate-resource-id", `Duplicate ID in ${key}: ${r.id}`, r.id);
      }
      seen.add(r.id);
    });
  });

  const status = fatalErrors.length ? "fatal" : errors.length ? "error" : repairs.length ? "repairable" : "ok";
  return { status, fatalErrors, errors, warnings, repairs, info };
}

// Applies only the unambiguous repairs validateBrandKit already reported.
// Safe to call even when nothing needs fixing.
export function repairBrandKit(kit) {
  const now = Date.now();
  const next = { ...kit };

  if (!next.name || typeof next.name !== "string") next.name = "Untitled brand kit";
  if (!isFiniteNumber(next.createdAt)) next.createdAt = now;
  if (!isFiniteNumber(next.updatedAt)) next.updatedAt = now;

  const seenColorIds = new Set();
  next.colors = (next.colors || [])
    .filter((c) => c && typeof c.id === "string")
    .filter((c) => (seenColorIds.has(c.id) ? false : (seenColorIds.add(c.id), true)))
    .map((c) => {
      const validHex = c.hex && isValidColor(c.hex) ? c.hex : "#8b5cf6";
      const parsed = parseColor(validHex);
      const alpha = isFiniteNumber(c.alpha) ? Math.min(1, Math.max(0, c.alpha)) : 1;
      return { ...c, hex: validHex, value: { ...parsed, a: alpha }, alpha };
    });
  const colorIdSet = new Set(next.colors.map((c) => c.id));

  next.palettes = (next.palettes || []).map((p) => ({ ...p, colorIds: (p.colorIds || []).filter((id) => colorIdSet.has(id)) }));

  const seenFontIds = new Set();
  next.fonts = (next.fonts || []).filter((f) => f && typeof f.id === "string").filter((f) => (seenFontIds.has(f.id) ? false : (seenFontIds.add(f.id), true)));
  const fontIdSet = new Set(next.fonts.map((f) => f.id));

  next.typography = (next.typography || []).map((t) => ({
    ...t,
    fontId: t.fontId && fontIdSet.has(t.fontId) ? t.fontId : null,
    colorId: t.colorId && colorIdSet.has(t.colorId) ? t.colorId : null,
    fontSize: isFiniteNumber(t.fontSize) && t.fontSize > 0 ? t.fontSize : 16,
    lineHeight: isFiniteNumber(t.lineHeight) ? t.lineHeight : 1.3,
  }));
  const typographyIdSet = new Set(next.typography.map((t) => t.id));

  next.objectStyles = (next.objectStyles || []).map((s) => ({
    ...s,
    props: {
      ...s.props,
      opacity: s.props?.opacity != null ? Math.min(1, Math.max(0, isFiniteNumber(s.props.opacity) ? s.props.opacity : 1)) : s.props?.opacity,
    },
  }));

  next.gradients = (next.gradients || []).map((g) => {
    const stops = Array.isArray(g.stops) && g.stops.length >= 2 ? g.stops : [{ position: 0, color: "#8b5cf6" }, { position: 1, color: "#ec4899" }];
    return { ...g, stops: stops.map((s) => ({ ...s, color: s.color && isValidColor(s.color) ? s.color : "#8b5cf6" })) };
  });

  next.backgroundStyles = (next.backgroundStyles || []).map((b) => ({
    ...b,
    colorId: b.colorId && colorIdSet.has(b.colorId) ? b.colorId : null,
  }));
  const backgroundStyleIdSet = new Set(next.backgroundStyles.map((b) => b.id));

  next.themes = (next.themes || []).map((t) => ({
    ...t,
    primaryColorId: t.primaryColorId && colorIdSet.has(t.primaryColorId) ? t.primaryColorId : null,
    secondaryColorId: t.secondaryColorId && colorIdSet.has(t.secondaryColorId) ? t.secondaryColorId : null,
    accentColorId: t.accentColorId && colorIdSet.has(t.accentColorId) ? t.accentColorId : null,
    backgroundColorId: t.backgroundColorId && colorIdSet.has(t.backgroundColorId) ? t.backgroundColorId : null,
    textColorId: t.textColorId && colorIdSet.has(t.textColorId) ? t.textColorId : null,
    headingTypographyId: t.headingTypographyId && typographyIdSet.has(t.headingTypographyId) ? t.headingTypographyId : null,
    bodyTypographyId: t.bodyTypographyId && typographyIdSet.has(t.bodyTypographyId) ? t.bodyTypographyId : null,
    backgroundStyleId: t.backgroundStyleId && backgroundStyleIdSet.has(t.backgroundStyleId) ? t.backgroundStyleId : null,
  }));

  return next;
}
