// The card-project layer that sits around the normal editor.
//
// A greeting card is an ordinary Vaycona project whose pages are the
// card's panels. Each panel page carries a small `printLayout` field:
//
//   page.printLayout = {
//     productId: "half-fold-card",   // printProducts.js
//     panel: "front",                // which panel of that product this page is
//     settings: { paperSize, category, duplex, duplexEdge, bleed, printGuides, guides },
//   }
//
// Keeping it on the pages (rather than a new project-level field) means
// every existing pipeline — undo/redo, autosave, recovery, versions,
// templates, .canvasproject packages, the phone's one-live-page rendering —
// carries cards with no changes of its own. `settings` is kept identical on
// every panel of the card; withCardSettings() is the only writer.
//
// getCardProject() assembles the document-level view the rest of the print
// system works with:
//
//   { type: "greeting-card", category, paperSize, foldType, orientation,
//     productId, settings, panels: { front: page, insideLeft: page, ... } }

import { defaultPaperSizeKey, PAPER_SIZE_KEYS } from "./paperSizes";
import { getPrintProduct, panelSizePx } from "./printProducts";

export const HALF_FOLD_CARD_ID = "half-fold-card";

export const GREETING_CARD_CATEGORIES = [
  "birthday",
  "wedding",
  "anniversary",
  "thank-you",
  "congratulations",
  "baby",
  "graduation",
  "holiday",
  "love",
  "invitations",
];

export const PANEL_DEFAULT_NAMES = {
  front: "Front Cover",
  insideLeft: "Inside Left",
  insideRight: "Inside Right",
  back: "Back Cover",
};

export function defaultCardSettings(paperSize = defaultPaperSizeKey()) {
  return {
    paperSize,
    category: "custom",
    duplex: true,
    bleed: false,
    printGuides: false,
    // The printer's two-sided setting the PDF is laid out for. "long" is
    // the default in macOS/iOS (Safari), Chrome and most drivers.
    duplexEdge: "long",
    // "standard" | "borderless" | "trim" (Cut to size) — see printPlan.js.
    edgeMode: "standard",
    guides: { fold: true, safe: true, bleed: false, trim: false },
  };
}

export function normalizeCardSettings(raw) {
  const d = defaultCardSettings("letter");
  if (!raw || typeof raw !== "object") return d;
  const guides = raw.guides && typeof raw.guides === "object" ? raw.guides : {};
  return {
    paperSize: PAPER_SIZE_KEYS.includes(raw.paperSize) ? raw.paperSize : d.paperSize,
    category: typeof raw.category === "string" ? raw.category : d.category,
    duplex: raw.duplex !== false,
    bleed: !!raw.bleed,
    printGuides: !!raw.printGuides,
    duplexEdge: raw.duplexEdge === "short" ? "short" : "long",
    edgeMode: ["borderless", "trim"].includes(raw.edgeMode) ? raw.edgeMode : "standard",
    guides: {
      fold: guides.fold !== false,
      safe: guides.safe !== false,
      bleed: !!guides.bleed,
      trim: !!guides.trim,
    },
  };
}

// First page per panel wins, so a stray copy of a panel page (e.g. an old
// duplicate) can never make the card ambiguous.
export function getCardProject(pages) {
  const panelPages = (pages || []).filter((p) => p?.printLayout && getPrintProduct(p.printLayout.productId));
  if (panelPages.length === 0) return null;
  const product = getPrintProduct(panelPages[0].printLayout.productId);
  const panels = {};
  panelPages.forEach((page) => {
    const key = page.printLayout.panel;
    if (product.panels.includes(key) && !panels[key] && page.printLayout.productId === product.id) panels[key] = page;
  });
  if (!panels[product.primaryPanel]) return null;
  const settings = normalizeCardSettings(panels[product.primaryPanel].printLayout.settings);
  return {
    type: product.type,
    productId: product.id,
    product,
    foldType: product.foldType,
    orientation: product.sheetOrientation,
    category: settings.category,
    paperSize: settings.paperSize,
    settings,
    panels,
    panelOrder: product.panels.filter((key) => panels[key]),
  };
}

export function isPanelPage(page) {
  return !!page?.printLayout && !!getPrintProduct(page.printLayout.productId);
}

// New card pages, sized for the paper. `panelData` optionally supplies
// per-panel { id, name, background } overrides (used by templates).
export function createCardPages({ productId = HALF_FOLD_CARD_ID, settings, idFor = () => crypto.randomUUID(), panelData = {}, extraPageFields = () => ({}) }) {
  const product = getPrintProduct(productId);
  const normalized = normalizeCardSettings(settings);
  const size = panelSizePx(product, normalized.paperSize);
  return product.panels.map((panel) => ({
    id: panelData[panel]?.id || idFor(panel),
    name: panelData[panel]?.name || PANEL_DEFAULT_NAMES[panel] || panel,
    width: size.width,
    height: size.height,
    background: panelData[panel]?.background || "#ffffff",
    ...extraPageFields(panel),
    printLayout: { productId: product.id, panel, settings: normalized },
  }));
}

// Returns a new pages array with the card's shared settings patched on
// every panel page (non-card pages untouched).
export function withCardSettings(pages, patch) {
  const card = getCardProject(pages);
  if (!card) return pages;
  const next = normalizeCardSettings({
    ...card.settings,
    ...patch,
    guides: { ...card.settings.guides, ...(patch.guides || {}) },
  });
  return pages.map((page) =>
    isPanelPage(page) && page.printLayout.productId === card.productId ? { ...page, printLayout: { ...page.printLayout, settings: next } } : page
  );
}

function coversPage(item, width, height) {
  return !item.parentId && item.type !== "group" && !item.rotation && item.x <= 1 && item.y <= 1 && item.x + item.width >= width - 1 && item.y + item.height >= height - 1;
}

// Re-fits a card's panels for another paper size. Letter and A4 halves
// differ by only a few percent, so content keeps its size and is simply
// re-centered on the new panel; anything that covered the whole old panel
// (a background photo/colour block) is grown proportionally so it still
// covers the whole new one. Returns { pages, items } — callers commit both
// together as one undoable step.
export function adaptCardToPaper(pages, items, paperSize) {
  const card = getCardProject(pages);
  if (!card || card.paperSize === paperSize) return { pages, items };
  const size = panelSizePx(card.product, paperSize);
  const changes = new Map();
  Object.values(card.panels).forEach((page) => {
    changes.set(page.id, { old: page, dx: (size.width - page.width) / 2, dy: (size.height - page.height) / 2 });
  });

  const nextItems = items.map((item) => {
    const change = changes.get(item.pageId);
    if (!change) return item;
    const { old, dx, dy } = change;
    if (coversPage(item, old.width, old.height) && ["shape", "image", "frame"].includes(item.type)) {
      const f = Math.max(size.width / old.width, size.height / old.height);
      const width = item.width * f;
      const height = item.height * f;
      const cx = (item.x + item.width / 2) * (size.width / old.width);
      const cy = (item.y + item.height / 2) * (size.height / old.height);
      return { ...item, x: cx - width / 2, y: cy - height / 2, width, height };
    }
    return { ...item, x: item.x + dx, y: item.y + dy };
  });

  const resized = pages.map((page) => (changes.has(page.id) ? { ...page, width: size.width, height: size.height } : page));
  return { pages: withCardSettings(resized, { paperSize }), items: nextItems };
}
