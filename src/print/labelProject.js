// The label-sheet project layer that sits around the normal editor — the
// same approach as greeting cards (cardProject.js).
//
// Each label is an ordinary Vaycona page, sized to one label, carrying a
// small `printLayout` field:
//
//   page.printLayout = {
//     productId: "label-sheet",
//     templateId: "letter-30-2625x1",   // labelTemplates.js
//     labelIndex: 0,                    // sheet position, reading order
//     settings: { mode, guides, offsetXIn, offsetYIn, quality, printOutlines },
//   }
//
// Two modes:
//   - "same": ONE label page; it prints in every position on the sheet.
//   - "individual": one page per position, each edited on its own.
//
// Because labels are pages, the page edge already clips each label's
// objects, and undo/redo, autosave, recovery, versions and packages carry
// label sheets with no changes of their own. `settings` is kept identical
// on every label page; withLabelSettings() is the only writer.
//
// Every transform below is pure and returns { pages, items } so the caller
// commits both as one undoable step.

import { getLabelTemplate, DEFAULT_LABEL_TEMPLATE_ID } from "./labelTemplates";
import { labelCount, labelSizePx } from "./labelSheet";

export const LABEL_SHEET_PRODUCT_ID = "label-sheet";
export const LABEL_MODES = ["same", "individual"];
// Printer-alignment nudge limit, either direction.
export const MAX_OFFSET_IN = 0.25;

export function defaultLabelSettings() {
  return {
    mode: "same",
    guides: { outline: true, safe: true },
    offsetXIn: 0,
    offsetYIn: 0,
    // "standard" = 300 DPI, "high" = 600 DPI (labels are small, so 600 is cheap).
    quality: "standard",
    // Thin label outlines in the PDF — only for a test print on plain paper.
    printOutlines: false,
  };
}

const clampOffset = (v) => (Number.isFinite(v) ? Math.max(-MAX_OFFSET_IN, Math.min(MAX_OFFSET_IN, v)) : 0);

export function normalizeLabelSettings(raw) {
  const d = defaultLabelSettings();
  if (!raw || typeof raw !== "object") return d;
  const guides = raw.guides && typeof raw.guides === "object" ? raw.guides : {};
  return {
    mode: LABEL_MODES.includes(raw.mode) ? raw.mode : d.mode,
    guides: { outline: guides.outline !== false, safe: guides.safe !== false },
    offsetXIn: clampOffset(raw.offsetXIn),
    offsetYIn: clampOffset(raw.offsetYIn),
    quality: raw.quality === "high" ? "high" : "standard",
    printOutlines: !!raw.printOutlines,
  };
}

export function isLabelPage(page) {
  return page?.printLayout?.productId === LABEL_SHEET_PRODUCT_ID && !!getLabelTemplate(page.printLayout.templateId);
}

export function labelPageName(index, mode) {
  return mode === "same" ? "All labels" : `Label ${index + 1}`;
}

// The sheet-level view of a project's label pages, or null for any other
// design:
//   { templateId, template, settings, mode, count, labelPages, designPage,
//     pageForSlot(i), pageIds }
// labelPages: index → page (first page per index wins, so a stray copy can
// never make a position ambiguous). In "same" mode the first label page is
// the design for every position.
export function getLabelSheetProject(pages) {
  const labelPagesList = (pages || []).filter(isLabelPage);
  if (labelPagesList.length === 0) return null;
  const first = labelPagesList[0];
  const template = getLabelTemplate(first.printLayout.templateId);
  const settings = normalizeLabelSettings(first.printLayout.settings);
  const count = labelCount(template);
  const labelPages = new Map();
  labelPagesList.forEach((page) => {
    const index = page.printLayout.labelIndex;
    if (page.printLayout.templateId !== template.id) return;
    if (Number.isInteger(index) && index >= 0 && index < count && !labelPages.has(index)) labelPages.set(index, page);
  });
  const designPage = settings.mode === "same" ? first : null;
  return {
    templateId: template.id,
    template,
    settings,
    mode: settings.mode,
    count,
    labelPages,
    designPage,
    pageForSlot: (index) => (designPage || labelPages.get(index) || null),
    pageIds: new Set(labelPagesList.filter((p) => p.printLayout.templateId === template.id).map((p) => p.id)),
  };
}

function labelPage({ template, index, settings, id, base = {}, extraPageFields = {} }) {
  const size = labelSizePx(template);
  return {
    background: "#ffffff",
    ...extraPageFields,
    ...base,
    id,
    name: labelPageName(index, settings.mode),
    width: size.width,
    height: size.height,
    printLayout: { productId: LABEL_SHEET_PRODUCT_ID, templateId: template.id, labelIndex: index, settings },
  };
}

// A new label-sheet project's pages: one design page, "same" mode.
export function createLabelSheetPages({ templateId = DEFAULT_LABEL_TEMPLATE_ID, idFor = () => crypto.randomUUID(), extraPageFields = {} } = {}) {
  const template = getLabelTemplate(templateId) || getLabelTemplate(DEFAULT_LABEL_TEMPLATE_ID);
  const settings = defaultLabelSettings();
  return [labelPage({ template, index: 0, settings, id: idFor(0), extraPageFields })];
}

// Copies of every object on `sourcePageId`, moved to `targetPageId` with
// fresh ids (group parent links remapped together, like duplicatePage).
export function cloneItemsToPage(items, sourcePageId, targetPageId, newId = () => crypto.randomUUID(), now = Date.now()) {
  const sourceItems = items.filter((it) => it.pageId === sourcePageId);
  const idMap = new Map(sourceItems.map((it) => [it.id, newId()]));
  return sourceItems.map((it) => ({
    ...it,
    id: idMap.get(it.id),
    pageId: targetPageId,
    parentId: idMap.has(it.parentId) ? idMap.get(it.parentId) : null,
    createdAt: now,
    updatedAt: now,
  }));
}

// Label pages first, in sheet order; any other pages keep their order after.
function orderPages(pages) {
  const labels = pages.filter(isLabelPage).sort((a, b) => a.printLayout.labelIndex - b.printLayout.labelIndex);
  return [...labels, ...pages.filter((p) => !isLabelPage(p))];
}

// Page-level look a label design carries with it (background and the
// editor's own per-page settings) — everything except identity/placement.
function designFieldsOf(page) {
  // eslint-disable-next-line no-unused-vars
  const { id, name, width, height, printLayout, ...rest } = page;
  return rest;
}

export function withLabelSettings(pages, patch) {
  const sheet = getLabelSheetProject(pages);
  if (!sheet) return pages;
  const next = normalizeLabelSettings({ ...sheet.settings, ...patch, guides: { ...sheet.settings.guides, ...(patch.guides || {}) } });
  return pages.map((page) => (sheet.pageIds.has(page.id) ? { ...page, printLayout: { ...page.printLayout, settings: next } } : page));
}

// Rebuilds the label pages so every position shows `sourcePageId`'s design
// as its own page ("individual" mode). Positions that already have a page
// keep its id (so page-scoped things like guides stay put) but get the
// source's content; positions without one get a new page.
function spreadDesign(pages, items, sourcePageId, { newId, now }) {
  const sheet = getLabelSheetProject(pages);
  const source = pages.find((p) => p.id === sourcePageId);
  if (!sheet || !source || !sheet.pageIds.has(source.id)) return { pages, items };
  const settings = normalizeLabelSettings({ ...sheet.settings, mode: "individual" });
  const sourceIndex = sheet.mode === "same" ? 0 : source.printLayout.labelIndex;
  const design = designFieldsOf(source);

  const keptPages = [];
  const newPages = [];
  let nextItems = items.filter((it) => !sheet.pageIds.has(it.pageId) || it.pageId === source.id);
  for (let index = 0; index < sheet.count; index++) {
    if (index === sourceIndex) {
      keptPages.push(labelPage({ template: sheet.template, index, settings, id: source.id, base: design }));
      continue;
    }
    const id = sheet.labelPages.get(index)?.id || newId();
    newPages.push(labelPage({ template: sheet.template, index, settings, id, base: design }));
    nextItems = nextItems.concat(cloneItemsToPage(items, source.id, id, newId, now));
  }
  const others = pages.filter((p) => !sheet.pageIds.has(p.id));
  return { pages: orderPages([...keptPages, ...newPages, ...others]), items: nextItems };
}

// "Edit labels individually": every position becomes its own page, each a
// copy of the current design, so nothing changes on paper until the user
// edits one.
export function makeLabelsIndividual(pages, items, { newId = () => crypto.randomUUID(), now = Date.now() } = {}) {
  const sheet = getLabelSheetProject(pages);
  if (!sheet || sheet.mode !== "same") return { pages, items };
  return spreadDesign(pages, items, sheet.designPage.id, { newId, now });
}

// "Fill All Labels": copies `sourcePageId`'s design (objects + background)
// onto every other position, replacing what was there.
export function fillAllLabels(pages, items, sourcePageId, { newId = () => crypto.randomUUID(), now = Date.now() } = {}) {
  const sheet = getLabelSheetProject(pages);
  if (!sheet || sheet.mode !== "individual") return { pages, items };
  return spreadDesign(pages, items, sourcePageId, { newId, now });
}

// "Same design on every label": `sourcePageId` becomes the one design
// page; every other label page and its objects are removed.
export function makeLabelsSame(pages, items, sourcePageId) {
  const sheet = getLabelSheetProject(pages);
  if (!sheet || sheet.mode !== "individual") return { pages, items };
  const source = pages.find((p) => p.id === sourcePageId && sheet.pageIds.has(p.id)) || sheet.labelPages.get(0) || pages.find((p) => sheet.pageIds.has(p.id));
  const settings = normalizeLabelSettings({ ...sheet.settings, mode: "same" });
  const nextPages = pages
    .filter((p) => !sheet.pageIds.has(p.id) || p.id === source.id)
    .map((p) => (p.id === source.id ? labelPage({ template: sheet.template, index: 0, settings, id: p.id, base: designFieldsOf(p) }) : p));
  const nextItems = items.filter((it) => !sheet.pageIds.has(it.pageId) || it.pageId === source.id);
  return { pages: orderPages(nextPages), items: nextItems };
}

// "Clear All": removes every object from every label and resets their
// backgrounds to white. The pages (and the mode) stay.
export function clearAllLabels(pages, items) {
  const sheet = getLabelSheetProject(pages);
  if (!sheet) return { pages, items };
  return {
    pages: pages.map((p) => (sheet.pageIds.has(p.id) ? { ...p, background: "#ffffff" } : p)),
    items: items.filter((it) => !sheet.pageIds.has(it.pageId)),
  };
}

// Individual mode: a blank page for a position that has none (e.g. its
// page was deleted from the Pages panel).
export function addLabelPage(pages, index, { newId = () => crypto.randomUUID(), extraPageFields = {} } = {}) {
  const sheet = getLabelSheetProject(pages);
  if (!sheet || sheet.mode !== "individual" || sheet.labelPages.has(index) || index < 0 || index >= sheet.count) return { pages, page: null };
  const page = labelPage({ template: sheet.template, index, settings: sheet.settings, id: newId(), extraPageFields });
  return { pages: orderPages([...pages, page]), page };
}

export function hasLabelContent(sheet, items) {
  return !!sheet && items.some((it) => sheet.pageIds.has(it.pageId));
}
