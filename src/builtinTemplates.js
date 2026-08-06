// Small, hand-built starter template collection (Phase 8 spec §6) — a
// deliberately short, high-quality set, not hundreds of generated ones.
// Uses only existing supported object types (text/shape/icon) built
// through the same objectRegistry.js defaultProps every live object uses,
// so these are exactly as "real" as anything a user creates by hand —
// fully editable, never flattened images. No frames/images here (a
// built-in with no real uploaded asset would just show a missing-asset
// placeholder, which is more confusing than useful for a starter design).

import { getDefaultProps } from "./objectRegistry";
import { findIconByName } from "./iconCatalog";
import { STARTER_PACK_TEMPLATES } from "./starterPackTemplates";

function page(id, name, width, height, background = "#ffffff") {
  return { id, name, width, height, background };
}

function baseFields(id, pageId, x, y, width, height, extra = {}) {
  return {
    id,
    pageId,
    parentId: null,
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  };
}

function text(id, pageId, x, y, width, height, content, overrides = {}) {
  return {
    ...baseFields(id, pageId, x, y, width, height),
    type: "text",
    ...getDefaultProps("text"),
    text: content,
    ...overrides,
  };
}

function shape(id, pageId, x, y, width, height, shapeKind, overrides = {}) {
  return {
    ...baseFields(id, pageId, x, y, width, height),
    type: "shape",
    shapeKind,
    ...getDefaultProps("shape", shapeKind),
    ...overrides,
  };
}

function icon(id, pageId, x, y, size, iconName, overrides = {}) {
  const resolved = findIconByName(iconName) ? iconName : "Star";
  return {
    ...baseFields(id, pageId, x, y, size, size),
    type: "icon",
    iconName: resolved,
    ...getDefaultProps("icon", resolved),
    ...overrides,
  };
}

function uid(seed) {
  // Deterministic, readable ids for static template data — remapped to
  // real crypto.randomUUID()s the moment a project/duplicate is created
  // from any of these (see idRemap.js), so uniqueness only matters within
  // one template's own data, not globally.
  return `builtin-${seed}`;
}

function blankDesign() {
  const pageId = uid("blank-page1");
  return {
    pages: [page(pageId, "Page 1", 1080, 1080, "#ffffff")],
    activePageId: pageId,
    scale: 1,
    items: [],
    guides: [],
    snapToGuides: true,
  };
}

function instagramPost() {
  const pageId = uid("igpost-page1");
  return {
    pages: [page(pageId, "Page 1", 1080, 1080, "#fef3c7")],
    activePageId: pageId,
    scale: 1,
    items: [
      shape(uid("igpost-bg"), pageId, 80, 80, 920, 920, "rectangle", { fill: "#f59e0b", opacity: 0.15 }),
      text(uid("igpost-title"), pageId, 140, 420, 800, 140, "Your Big Announcement", {
        fontSize: 72,
        fontWeight: "bold",
        align: "center",
        fill: "#78350f",
      }),
      text(uid("igpost-sub"), pageId, 140, 580, 800, 60, "A short line of supporting detail goes here", {
        fontSize: 28,
        align: "center",
        fill: "#92400e",
      }),
    ],
    guides: [],
    snapToGuides: true,
  };
}

function instagramStory() {
  const pageId = uid("igstory-page1");
  return {
    pages: [page(pageId, "Page 1", 1080, 1920, "#111827")],
    activePageId: pageId,
    scale: 1,
    items: [
      shape(uid("igstory-bar"), pageId, 0, 860, 1080, 200, "rectangle", { fill: "#8b5cf6" }),
      text(uid("igstory-title"), pageId, 90, 880, 900, 160, "Swipe up to learn more", {
        fontSize: 56,
        fontWeight: "bold",
        align: "center",
        fill: "#ffffff",
      }),
    ],
    guides: [],
    snapToGuides: true,
  };
}

function facebookPost() {
  const pageId = uid("fbpost-page1");
  return {
    pages: [page(pageId, "Page 1", 1200, 630, "#e0f2fe")],
    activePageId: pageId,
    scale: 1,
    items: [
      text(uid("fbpost-title"), pageId, 80, 220, 1040, 120, "Join us this weekend", {
        fontSize: 60,
        fontWeight: "bold",
        align: "left",
        fill: "#0c4a6e",
      }),
      text(uid("fbpost-sub"), pageId, 80, 340, 900, 60, "Details and RSVP link here", {
        fontSize: 26,
        fill: "#0369a1",
      }),
      icon(uid("fbpost-icon"), pageId, 1020, 80, 100, "Star", { fill: "#0284c7" }),
    ],
    guides: [],
    snapToGuides: true,
  };
}

function flyer() {
  const pageId = uid("flyer-page1");
  return {
    pages: [page(pageId, "Page 1", 1275, 1650, "#ffffff")],
    activePageId: pageId,
    scale: 1,
    items: [
      shape(uid("flyer-header"), pageId, 0, 0, 1275, 360, "rectangle", { fill: "#111827" }),
      text(uid("flyer-title"), pageId, 100, 130, 1075, 120, "EVENT TITLE", {
        fontSize: 64,
        fontWeight: "bold",
        align: "center",
        fill: "#ffffff",
      }),
      text(uid("flyer-date"), pageId, 100, 440, 1075, 60, "Saturday, June 14 · 7:00 PM", {
        fontSize: 30,
        align: "center",
        fill: "#374151",
      }),
      text(uid("flyer-body"), pageId, 140, 560, 995, 400, "Add your event details, location, and any other information your guests need to know.", {
        fontSize: 24,
        align: "center",
        fill: "#4b5563",
      }),
    ],
    guides: [],
    snapToGuides: true,
  };
}

function businessCard() {
  const pageId = uid("bcard-page1");
  return {
    pages: [page(pageId, "Page 1", 336, 192, "#ffffff")],
    activePageId: pageId,
    scale: 1,
    items: [
      shape(uid("bcard-accent"), pageId, 0, 0, 16, 192, "rectangle", { fill: "#8b5cf6" }),
      text(uid("bcard-name"), pageId, 40, 60, 260, 40, "Jordan Rivera", { fontSize: 22, fontWeight: "bold", fill: "#111827" }),
      text(uid("bcard-title"), pageId, 40, 100, 260, 30, "Creative Director", { fontSize: 14, fill: "#6b7280" }),
      text(uid("bcard-contact"), pageId, 40, 140, 260, 30, "hello@example.com", { fontSize: 12, fill: "#6b7280" }),
    ],
    guides: [],
    snapToGuides: true,
  };
}

function weddingInvitation() {
  const pageId = uid("wedding-page1");
  return {
    pages: [page(pageId, "Page 1", 500, 700, "#fdf4ff")],
    activePageId: pageId,
    scale: 1,
    items: [
      text(uid("wedding-names"), pageId, 50, 220, 400, 100, "Alex & Sam", {
        fontSize: 48,
        fontFamily: "Playfair Display",
        align: "center",
        fill: "#701a75",
      }),
      text(uid("wedding-sub"), pageId, 50, 330, 400, 40, "are getting married", {
        fontSize: 20,
        align: "center",
        italic: true,
        fill: "#86198f",
      }),
      text(uid("wedding-date"), pageId, 50, 420, 400, 40, "June 14, 2026 · Napa Valley", {
        fontSize: 18,
        align: "center",
        fill: "#701a75",
      }),
    ],
    guides: [],
    snapToGuides: true,
  };
}

function presentationSlide() {
  const pageId = uid("slide-page1");
  return {
    pages: [page(pageId, "Slide 1", 1920, 1080, "#ffffff")],
    activePageId: pageId,
    scale: 1,
    items: [
      text(uid("slide-title"), pageId, 160, 380, 1600, 140, "Presentation Title", {
        fontSize: 80,
        fontWeight: "bold",
        fill: "#111827",
      }),
      text(uid("slide-sub"), pageId, 160, 540, 1200, 60, "Subtitle or presenter name", {
        fontSize: 32,
        fill: "#6b7280",
      }),
      shape(uid("slide-accent"), pageId, 160, 340, 120, 8, "rectangle", { fill: "#8b5cf6" }),
    ],
    guides: [],
    snapToGuides: true,
  };
}

function letterDocument() {
  const pageId = uid("letter-page1");
  return {
    pages: [page(pageId, "Page 1", 816, 1056, "#ffffff")],
    activePageId: pageId,
    scale: 1,
    items: [
      text(uid("letter-heading"), pageId, 80, 80, 656, 60, "Document Title", { fontSize: 32, fontWeight: "bold", fill: "#111827" }),
      text(uid("letter-body"), pageId, 80, 180, 656, 700, "Start writing here. This letter-size page is set up for standard documents, reports, and printable text.", {
        fontSize: 16,
        fill: "#374151",
        lineHeight: 1.5,
      }),
    ],
    guides: [],
    snapToGuides: true,
  };
}

// builtInKey must stay stable across app updates — it's how
// ensureBuiltInTemplatesSeeded() recognizes "already seeded" without
// re-inserting duplicates (spec §42).
export const BUILT_IN_TEMPLATES = [
  { builtInKey: "blank-square", name: "Blank design", category: "personal", tags: ["blank"], data: blankDesign() },
  { builtInKey: "instagram-post", name: "Instagram Post", category: "social", tags: ["social media", "instagram"], data: instagramPost() },
  { builtInKey: "instagram-story", name: "Instagram Story", category: "social", tags: ["social media", "instagram", "story"], data: instagramStory() },
  { builtInKey: "facebook-post", name: "Facebook Post", category: "social", tags: ["social media", "facebook"], data: facebookPost() },
  { builtInKey: "flyer", name: "Event Flyer", category: "marketing", tags: ["flyer", "event"], data: flyer() },
  { builtInKey: "business-card", name: "Business Card", category: "business", tags: ["business", "minimal"], data: businessCard() },
  { builtInKey: "wedding-invitation", name: "Wedding Invitation", category: "invitations", tags: ["wedding", "elegant"], data: weddingInvitation() },
  { builtInKey: "presentation-slide", name: "Presentation Slide", category: "documents", tags: ["presentation", "business"], data: presentationSlide() },
  { builtInKey: "letter-document", name: "Letter Document", category: "documents", tags: ["document", "print"], data: letterDocument() },
  // 50 additional starter templates from personal_canva_template_starter_pack/,
  // converted to this same builtin-seed shape by starterPackTemplates.js.
  ...STARTER_PACK_TEMPLATES,
];
