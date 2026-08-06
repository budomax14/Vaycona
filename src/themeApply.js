// Phase 11 — theme application (spec §47-50/§83). Scoped, defensible
// policy rather than aggressive guessing (spec §49 explicitly warns
// against that): a theme only ever rewrites objects/pages that are ALREADY
// linked to a resource from the SAME brand kit — that existing link IS the
// "semantic role" signal this app has, since there's no separate
// role-tagging system on canvas objects. Untagged/arbitrary objects (never
// linked to this kit) are left completely untouched, matching spec §49/
// §120's "confirm detached arbitrary colors are not replaced without
// approval".
//
// Concretely: page backgrounds in scope -> theme.backgroundStyleId;
// shape/line/icon/frame objects in scope that already carry an
// objectStyleRef from this kit -> re-applied to theme.shapeObjectStyleId;
// text objects in scope that already carry a typographyStyleRef from this
// kit -> re-applied to theme.bodyTypographyId. (Heading vs. body isn't
// auto-detected at the object level — a documented Phase 11 simplification;
// users can apply a specific heading style manually afterward.)

import { applyObjectStyle, applyTypographyStyle, applyBackgroundStyle } from "./brandApply";

function inScopeItem(item, scope, params) {
  if (scope === "project") return true;
  if (scope === "page") return item.pageId === params.pageId;
  if (scope === "pages") return params.pageIds.includes(item.pageId);
  if (scope === "selection") return params.itemIds.includes(item.id);
  return false;
}

function inScopePage(page, scope, params) {
  if (scope === "selection") return false; // object-only scope never touches page backgrounds
  if (scope === "project") return true;
  if (scope === "page") return page.id === params.pageId;
  if (scope === "pages") return params.pageIds.includes(page.id);
  return false;
}

const OBJECT_STYLE_TYPES = new Set(["shape", "line", "icon", "frame"]);

// Preview/plan: computes what WOULD change without mutating anything —
// backs both the dialog's affected-count display and the actual apply.
export function planThemeApplication(kit, theme, { items, pages }, scope, params) {
  const affectedItemIds = [];
  const affectedPageIds = [];

  for (const item of items) {
    if (!inScopeItem(item, scope, params)) continue;
    const willChangeObjectStyle = OBJECT_STYLE_TYPES.has(item.type) && item.objectStyleRef?.brandKitId === kit.id && theme.shapeObjectStyleId;
    const willChangeTypography = item.type === "text" && item.typographyStyleRef?.brandKitId === kit.id && theme.bodyTypographyId;
    if (willChangeObjectStyle || willChangeTypography) affectedItemIds.push(item.id);
  }
  for (const page of pages) {
    if (!inScopePage(page, scope, params)) continue;
    if (theme.backgroundStyleId) affectedPageIds.push(page.id);
  }

  return { affectedItemIds, affectedPageIds, affectedCount: affectedItemIds.length + affectedPageIds.length };
}

export function applyThemeToProject(kit, theme, { items, pages }, scope, params) {
  const nextItems = items.map((item) => {
    if (!inScopeItem(item, scope, params)) return item;
    let next = item;
    if (OBJECT_STYLE_TYPES.has(item.type) && item.objectStyleRef?.brandKitId === kit.id && theme.shapeObjectStyleId) {
      next = applyObjectStyle(next, kit, theme.shapeObjectStyleId);
    }
    if (item.type === "text" && item.typographyStyleRef?.brandKitId === kit.id && theme.bodyTypographyId) {
      next = applyTypographyStyle(next, kit, theme.bodyTypographyId);
    }
    return next;
  });

  const nextPages = pages.map((page) => {
    if (!inScopePage(page, scope, params)) return page;
    if (!theme.backgroundStyleId) return page;
    return applyBackgroundStyle(page, kit, theme.backgroundStyleId);
  });

  return { nextItems, nextPages };
}
