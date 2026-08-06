// Phase 11 — document-wide "Replace Fonts" tool (spec §53/§54). Walks both
// the legacy flat `fontFamily` field AND rich-text run-level fontFamily
// overrides (see richText.js) — a text object can carry both at once, and
// a font swap that only touched the base field would silently leave old
// runs on the previous font.

import { getFontEntry } from "./fontLibrary";

function itemInScope(item, scope, pageId, pageIds) {
  if (scope === "page") return item.pageId === pageId;
  if (scope === "pages") return pageIds.has(item.pageId);
  return true; // "project"
}

function replaceRichTextFont(richText, fromFamily, toFamily) {
  if (!Array.isArray(richText)) return { richText, changedRuns: 0 };
  let changedRuns = 0;
  const next = richText.map((paragraph) => ({
    ...paragraph,
    runs: (paragraph.runs || []).map((run) => {
      if (run.break || run.fontFamily !== fromFamily) return run;
      changedRuns += 1;
      return { ...run, fontFamily: toFamily };
    }),
  }));
  return { richText: next, changedRuns };
}

// Preflight (spec §54): what WOULD change, without mutating anything.
export function planFontReplacement({ items }, { fromFamily, toFamily, scope, pageId, pageIds }) {
  const affectedItemIds = [];
  let affectedRuns = 0;

  for (const item of items) {
    if (item.type !== "text") continue;
    if (!itemInScope(item, scope, pageId, pageIds ? new Set(pageIds) : null)) continue;
    const baseMatches = item.fontFamily === fromFamily;
    const { changedRuns } = replaceRichTextFont(item.richText, fromFamily, toFamily);
    if (baseMatches || changedRuns > 0) {
      affectedItemIds.push(item.id);
      affectedRuns += changedRuns;
    }
  }

  const targetEntry = getFontEntry(toFamily);
  return {
    affectedItemIds,
    affectedItemCount: affectedItemIds.length,
    affectedRunCount: affectedRuns,
    targetFontKnown: !!targetEntry,
    targetFontCategory: targetEntry?.category || null,
  };
}

export function applyFontReplacement(items, { fromFamily, toFamily, scope, pageId, pageIds }) {
  return items.map((item) => {
    if (item.type !== "text") return item;
    if (!itemInScope(item, scope, pageId, pageIds ? new Set(pageIds) : null)) return item;
    const baseMatches = item.fontFamily === fromFamily;
    const { richText, changedRuns } = replaceRichTextFont(item.richText, fromFamily, toFamily);
    if (!baseMatches && changedRuns === 0) return item;
    return {
      ...item,
      fontFamily: baseMatches ? toFamily : item.fontFamily,
      richText: changedRuns > 0 ? richText : item.richText,
      updatedAt: Date.now(),
    };
  });
}

// Lists every distinct font family actually in use across items (base +
// rich-text runs), each with a usage count — backs "list project fonts"
// (spec §53 test 133) and flags ones this app doesn't recognize as
// "missing" (unavailable in FONT_LIBRARY, spec §21).
export function listProjectFonts(items) {
  const counts = new Map();
  const bump = (family) => family && counts.set(family, (counts.get(family) || 0) + 1);
  for (const item of items) {
    if (item.type !== "text") continue;
    bump(item.fontFamily);
    (item.richText || []).forEach((p) => (p.runs || []).forEach((r) => !r.break && bump(r.fontFamily)));
  }
  return [...counts.entries()]
    .map(([family, count]) => ({ family, count, known: !!getFontEntry(family) }))
    .sort((a, b) => b.count - a.count);
}
