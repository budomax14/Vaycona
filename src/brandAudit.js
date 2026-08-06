// Phase 11 — Brand Audit (spec §64/§65). A read-only report over the
// CURRENT project compared against the active brand kit — never claims
// legal/official compliance, never modifies content on its own (fixes are
// separate, explicit, confirmed actions the caller applies via the normal
// commit()/history path).

import { getFontEntry } from "./fontLibrary";
import { evaluateContrast } from "./brandColor";
import { collectDocumentColors, collectDocumentFonts } from "./styleUsage";

function pageBackgroundFor(pageId, pages) {
  return pages.find((p) => p.id === pageId)?.background || "#ffffff";
}

export function runBrandAudit({ items, pages }, brandKit) {
  const findings = {
    fontsUsed: [],
    colorsUsed: [],
    brandTokenUsageCount: 0,
    nonBrandColors: [],
    nonBrandFonts: [],
    missingFonts: [],
    detachedStyles: [],
    logoVariantsUsed: [],
    contrastWarnings: [],
    lowResolutionLogos: [],
    stretchedLogos: [],
  };

  findings.fontsUsed = collectDocumentFonts(items);
  findings.colorsUsed = collectDocumentColors(items);

  const brandHexSet = new Set((brandKit?.colors || []).map((c) => c.hex.toLowerCase()));
  const brandFontFamilies = new Set((brandKit?.fonts || []).map((f) => f.family));

  findings.nonBrandColors = brandKit ? findings.colorsUsed.filter((c) => !brandHexSet.has(c.hex.toLowerCase())) : findings.colorsUsed;
  findings.nonBrandFonts = brandKit ? findings.fontsUsed.filter((f) => !brandFontFamilies.has(f.fontFamily)) : [];
  findings.missingFonts = findings.fontsUsed.filter((f) => !getFontEntry(f.fontFamily));

  let brandUsageCount = 0;
  for (const item of items) {
    if (item.colorLinks && Object.keys(item.colorLinks).length) brandUsageCount += Object.keys(item.colorLinks).length;
    if (item.typographyStyleRef) brandUsageCount += 1;
    if (item.objectStyleRef) brandUsageCount += 1;
    if (item.imageStyleRef) brandUsageCount += 1;
    if (item.brandAssetRef) brandUsageCount += 1;
  }
  findings.brandTokenUsageCount = brandUsageCount;

  // Detached-looking typography: a text item whose visible values match a
  // brand typography token's resolved values, but carries no link — a
  // candidate for "link matching text styles" (spec §65).
  if (brandKit) {
    for (const item of items) {
      if (item.type !== "text" || item.typographyStyleRef) continue;
      const match = brandKit.typography.find((t) => {
        const font = brandKit.fonts.find((f) => f.id === t.fontId);
        return font && font.family === item.fontFamily && t.fontSize === item.fontSize;
      });
      if (match) {
        findings.detachedStyles.push({ itemId: item.id, pageId: item.pageId, kind: "typography", matchedStyleId: match.id, matchedStyleName: match.name });
      }
    }
  }

  // Logo checks
  for (const item of items) {
    if (!item.brandAssetRef) continue;
    const logo = brandKit?.logos?.find((l) => l.id === item.brandAssetRef.resourceId);
    findings.logoVariantsUsed.push({ itemId: item.id, pageId: item.pageId, variant: logo?.variant || "unknown" });
    if (logo?.aspectRatio && item.width && item.height) {
      const currentRatio = item.width / item.height;
      const drift = Math.abs(currentRatio - logo.aspectRatio) / logo.aspectRatio;
      if (drift > 0.03) {
        findings.stretchedLogos.push({ itemId: item.id, pageId: item.pageId, expectedRatio: logo.aspectRatio, actualRatio: currentRatio });
      }
    }
    if (logo?.width && item.width && item.width > logo.width * 1.5) {
      findings.lowResolutionLogos.push({ itemId: item.id, pageId: item.pageId, sourceWidth: logo.width, displayedWidth: item.width });
    }
  }

  // Contrast: text items against their page background (a scoped,
  // practical check — not a full compositing engine across overlapping
  // shapes, spec §16/§64 both frame this as advisory).
  for (const item of items) {
    if (item.type !== "text" || !item.fill) continue;
    const bg = pageBackgroundFor(item.pageId, pages);
    const result = evaluateContrast(item.fill, bg);
    if (result && result.normalTextWarning) {
      findings.contrastWarnings.push({ itemId: item.id, pageId: item.pageId, ratio: result.ratio, background: bg, foreground: item.fill });
    }
  }

  return findings;
}

export function summarizeAuditForDisplay(findings) {
  return [
    { label: "Non-brand colors", count: findings.nonBrandColors.length },
    { label: "Non-brand fonts", count: findings.nonBrandFonts.length },
    { label: "Missing fonts", count: findings.missingFonts.length },
    { label: "Detachable brand-matching styles", count: findings.detachedStyles.length },
    { label: "Contrast warnings", count: findings.contrastWarnings.length },
    { label: "Stretched logos", count: findings.stretchedLogos.length },
    { label: "Low-resolution logos", count: findings.lowResolutionLogos.length },
  ];
}
