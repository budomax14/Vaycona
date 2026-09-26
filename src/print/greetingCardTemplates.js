// Built-in Greeting Card templates — one complete half-fold card (all four
// panels) per subcategory. Same rules as builtinTemplates.js: only real,
// fully editable objects (text/shape/icon via objectRegistry defaults), no
// flattened images, deterministic ids that idRemap.js replaces on use.
// Designed on US Letter panels (5.5 × 8.5 in = 528 × 816 px); App.jsx
// re-fits a card to A4 on use when that's the user's paper size.

import { getDefaultProps } from "../objectRegistry";
import { findIconByName } from "../iconCatalog";
import { createCardPages } from "./cardProject";

const W = 528;
const H = 816;

function base(id, pageId, x, y, width, height, extra = {}) {
  return { id, pageId, parentId: null, x, y, width, height, rotation: 0, opacity: 1, locked: false, hidden: false, createdAt: 0, updatedAt: 0, ...extra };
}

function makeBuilders(prefix) {
  let n = 0;
  const id = () => `builtin-${prefix}-${++n}`;
  return {
    text: (pageId, x, y, width, height, content, overrides = {}) => ({
      ...base(id(), pageId, x, y, width, height),
      type: "text",
      ...getDefaultProps("text"),
      text: content,
      align: "center",
      ...overrides,
    }),
    shape: (pageId, x, y, width, height, shapeKind, overrides = {}) => ({
      ...base(id(), pageId, x, y, width, height),
      type: "shape",
      shapeKind,
      ...getDefaultProps("shape", shapeKind),
      ...overrides,
    }),
    icon: (pageId, x, y, size, iconName, overrides = {}) => {
      const resolved = findIconByName(iconName) ? iconName : "Star";
      return { ...base(id(), pageId, x, y, size, size), type: "icon", iconName: resolved, ...getDefaultProps("icon", resolved), ...overrides };
    },
  };
}

// `build(pageIds, b)` returns the items for all four panels.
function greetingCard({ key, name, subcategory, tags, backgrounds, build }) {
  const pages = createCardPages({
    settings: { paperSize: "letter", category: subcategory },
    idFor: (panel) => `builtin-${key}-${panel}`,
    panelData: Object.fromEntries(Object.entries(backgrounds).map(([panel, background]) => [panel, { background }])),
  });
  const ids = Object.fromEntries(pages.map((p) => [p.printLayout.panel, p.id]));
  const items = build(ids, makeBuilders(key));
  return {
    builtInKey: `greeting-card-${key}`,
    name,
    category: "greeting-cards",
    subcategory,
    tags: ["greeting card", "card", "print", ...tags],
    data: { pages, activePageId: ids.front, scale: 1, items, guides: [], snapToGuides: true },
  };
}

// Small, quiet back-cover mark shared by every design.
function backMark(b, pageId, { iconName, color, textColor, caption = "Made with love" }) {
  return [
    b.icon(pageId, W / 2 - 18, H - 150, 36, iconName, { fill: color }),
    b.text(pageId, 64, H - 104, W - 128, 24, caption, { fontFamily: "Montserrat", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", fill: textColor }),
  ];
}

const birthday = greetingCard({
  key: "birthday-confetti",
  name: "Confetti Birthday Card",
  subcategory: "birthday",
  tags: ["birthday", "colorful", "fun"],
  backgrounds: { front: "#fff7ed", insideLeft: "#ffffff", insideRight: "#ffffff", back: "#fff7ed" },
  build: (p, b) => {
    const confetti = [
      [58, 70, 38, "#f97316"], [420, 96, 26, "#14b8a6"], [120, 200, 18, "#facc15"], [452, 250, 44, "#f43f5e"],
      [40, 560, 30, "#14b8a6"], [460, 610, 22, "#facc15"], [96, 700, 46, "#f43f5e"], [380, 720, 34, "#f97316"],
      [260, 64, 16, "#6366f1"], [300, 760, 14, "#6366f1"],
    ];
    return [
      ...confetti.map(([x, y, s, fill]) => b.shape(p.front, x, y, s, s, "circle", { fill })),
      b.shape(p.front, 200, 150, 22, 22, "star", { fill: "#facc15" }),
      b.shape(p.front, 330, 640, 26, 26, "star", { fill: "#14b8a6" }),
      b.text(p.front, 40, 290, W - 80, 100, "Happy", { fontFamily: "Pacifico", fontSize: 72, fill: "#f97316" }),
      b.text(p.front, 40, 390, W - 80, 110, "Birthday!", { fontFamily: "Fredoka", fontSize: 84, fontWeight: "bold", fill: "#0f766e" }),
      b.text(p.front, 60, 510, W - 120, 30, "LET'S CELEBRATE YOU", { fontFamily: "Montserrat", fontSize: 14, letterSpacing: 4, fill: "#9a3412" }),

      ...confetti.slice(0, 6).map(([x, y, s, fill]) => b.shape(p.insideLeft, W - x - s, H - y - s, s * 0.8, s * 0.8, "circle", { fill, opacity: 0.35 })),
      b.icon(p.insideLeft, W / 2 - 60, H / 2 - 60, 120, "Gift", { fill: "#f97316", opacity: 0.85 }),

      b.text(p.insideRight, 56, 250, W - 112, 180, "Wishing you a year full of laughter, adventure, and far too much cake.", {
        fontFamily: "Quicksand", fontSize: 26, lineHeight: 1.5, fill: "#374151",
      }),
      b.text(p.insideRight, 56, 480, W - 112, 60, "Love, Alex", { fontFamily: "Dancing Script", fontSize: 40, fill: "#0f766e" }),

      ...backMark(b, p.back, { iconName: "Gift", color: "#f97316", textColor: "#9a3412" }),
    ];
  },
});

const wedding = greetingCard({
  key: "wedding-elegant",
  name: "Elegant Wedding Card",
  subcategory: "wedding",
  tags: ["wedding", "elegant", "gold"],
  backgrounds: { front: "#fbf8f3", insideLeft: "#fbf8f3", insideRight: "#ffffff", back: "#fbf8f3" },
  build: (p, b) => [
    b.shape(p.front, 28, 28, W - 56, H - 56, "rectangle", { fill: "transparent", stroke: "#b08d57", strokeWidth: 2 }),
    b.shape(p.front, 40, 40, W - 80, H - 80, "rectangle", { fill: "transparent", stroke: "#d6c29a", strokeWidth: 1 }),
    b.shape(p.front, 196, 200, 84, 84, "ring", { fill: "#b08d57", innerRadiusRatio: 0.86 }),
    b.shape(p.front, 248, 200, 84, 84, "ring", { fill: "#c9a96e", innerRadiusRatio: 0.86 }),
    b.text(p.front, 60, 330, W - 120, 30, "MR & MRS", { fontFamily: "Cinzel", fontSize: 20, letterSpacing: 8, fill: "#8b6b3e" }),
    b.text(p.front, 50, 380, W - 100, 170, "Happily Ever After", { fontFamily: "Great Vibes", fontSize: 72, lineHeight: 1.1, fill: "#8b6b3e" }),
    b.shape(p.front, W / 2 - 40, 580, 80, 2, "rectangle", { fill: "#b08d57" }),

    b.shape(p.insideLeft, W / 2 - 110, H / 2 - 110, 220, 220, "ring", { fill: "#e7dcc6", innerRadiusRatio: 0.9 }),
    b.icon(p.insideLeft, W / 2 - 24, H / 2 - 24, 48, "Heart", { fill: "#c9a96e" }),

    b.text(p.insideRight, 60, 200, W - 120, 40, "Congratulations", { fontFamily: "Great Vibes", fontSize: 48, fill: "#8b6b3e" }),
    b.text(p.insideRight, 60, 280, W - 120, 220, "On your wedding day, may your love grow stronger with every sunrise and every shared adventure.", {
      fontFamily: "Cormorant Garamond", fontSize: 26, italic: true, lineHeight: 1.5, fill: "#44403c",
    }),
    b.text(p.insideRight, 60, 540, W - 120, 40, "With love, The Parkers", { fontFamily: "Cormorant Garamond", fontSize: 22, fill: "#8b6b3e" }),

    ...backMark(b, p.back, { iconName: "Heart", color: "#b08d57", textColor: "#8b6b3e" }),
  ],
});

const anniversary = greetingCard({
  key: "anniversary-midnight",
  name: "Midnight Anniversary Card",
  subcategory: "anniversary",
  tags: ["anniversary", "navy", "gold", "romantic"],
  backgrounds: { front: "#1e293b", insideLeft: "#1e293b", insideRight: "#ffffff", back: "#1e293b" },
  build: (p, b) => [
    b.shape(p.front, W / 2 - 150, 150, 300, 300, "circle", { fill: "#e2b857", opacity: 0.12 }),
    b.text(p.front, 40, 180, W - 80, 220, "25", { fontFamily: "Playfair Display", fontSize: 180, fontWeight: "bold", fill: "#e2b857" }),
    b.text(p.front, 40, 430, W - 80, 30, "YEARS TOGETHER", { fontFamily: "Montserrat", fontSize: 16, letterSpacing: 8, fill: "#f8fafc" }),
    b.text(p.front, 40, 490, W - 80, 90, "Happy Anniversary", { fontFamily: "Great Vibes", fontSize: 56, fill: "#e2b857" }),
    b.shape(p.front, 150, 640, 16, 16, "heart", { fill: "#e2b857" }),
    b.shape(p.front, 256, 632, 20, 20, "heart", { fill: "#e2b857" }),
    b.shape(p.front, 362, 640, 16, 16, "heart", { fill: "#e2b857" }),

    ...[[80, 120], [420, 180], [120, 620], [400, 680], [260, 90]].map(([x, y]) => b.shape(p.insideLeft, x, y, 10, 10, "star", { fill: "#e2b857", opacity: 0.8 })),
    b.text(p.insideLeft, 60, H / 2 - 60, W - 120, 120, "Here's to forever", { fontFamily: "Great Vibes", fontSize: 50, fill: "#e2b857" }),

    b.text(p.insideRight, 60, 240, W - 120, 220, "Twenty-five years of adventures, inside jokes and holding hands. I'd choose you all over again.", {
      fontFamily: "Lora", fontSize: 24, lineHeight: 1.55, fill: "#1e293b",
    }),
    b.text(p.insideRight, 60, 500, W - 120, 50, "All my love", { fontFamily: "Great Vibes", fontSize: 40, fill: "#b45309" }),

    ...backMark(b, p.back, { iconName: "Heart", color: "#e2b857", textColor: "#cbd5e1" }),
  ],
});

const thankYou = greetingCard({
  key: "thank-you-botanical",
  name: "Botanical Thank You Card",
  subcategory: "thank-you",
  tags: ["thank you", "botanical", "green", "minimal"],
  backgrounds: { front: "#eef3ec", insideLeft: "#ffffff", insideRight: "#ffffff", back: "#eef3ec" },
  build: (p, b) => [
    b.shape(p.front, 330, -40, 260, 260, "circle", { fill: "#c9dbc4" }),
    b.shape(p.front, -80, 620, 260, 260, "circle", { fill: "#c9dbc4" }),
    b.shape(p.front, 380, 60, 70, 150, "ellipse", { fill: "#6b8f63", rotation: 30 }),
    b.shape(p.front, 440, 110, 56, 120, "ellipse", { fill: "#86a97d", rotation: 60 }),
    b.shape(p.front, 70, 610, 56, 130, "ellipse", { fill: "#6b8f63", rotation: -30 }),
    b.shape(p.front, 20, 660, 50, 110, "ellipse", { fill: "#86a97d", rotation: -60 }),
    b.text(p.front, 40, 300, W - 80, 140, "Thank you", { fontFamily: "Alex Brush", fontSize: 96, fill: "#3f5e3a" }),
    b.text(p.front, 60, 450, W - 120, 30, "FROM THE BOTTOM OF OUR HEARTS", { fontFamily: "Montserrat", fontSize: 12, letterSpacing: 4, fill: "#56704f" }),

    b.icon(p.insideLeft, W / 2 - 40, H / 2 - 40, 80, "Flower", { fill: "#86a97d" }),

    b.text(p.insideRight, 60, 260, W - 120, 200, "Your kindness meant more than words can say. Thank you for being there.", {
      fontFamily: "Lora", fontSize: 24, italic: true, lineHeight: 1.55, fill: "#374151",
    }),
    b.text(p.insideRight, 60, 500, W - 120, 50, "Warmly, Sam", { fontFamily: "Alex Brush", fontSize: 40, fill: "#3f5e3a" }),

    ...backMark(b, p.back, { iconName: "Flower", color: "#6b8f63", textColor: "#56704f" }),
  ],
});

const congratulations = greetingCard({
  key: "congratulations-bold",
  name: "Bold Congratulations Card",
  subcategory: "congratulations",
  tags: ["congratulations", "bold", "celebration"],
  backgrounds: { front: "#111827", insideLeft: "#facc15", insideRight: "#ffffff", back: "#111827" },
  build: (p, b) => [
    b.shape(p.front, W / 2 - 190, 120, 380, 380, "star", { fill: "#facc15", points: 12, innerRadiusRatio: 0.78 }),
    b.text(p.front, 40, 250, W - 80, 120, "CONGRATS!", { fontFamily: "Bebas Neue", fontSize: 104, fill: "#111827" }),
    b.text(p.front, 40, 560, W - 80, 50, "You did it.", { fontFamily: "Montserrat", fontSize: 30, fontWeight: "bold", fill: "#ffffff" }),
    b.text(p.front, 40, 612, W - 80, 30, "AND WE KNEW YOU WOULD", { fontFamily: "Montserrat", fontSize: 13, letterSpacing: 4, fill: "#facc15" }),
    ...[[60, 80], [440, 90], [70, 700], [430, 690]].map(([x, y]) => b.shape(p.front, x, y, 26, 26, "star", { fill: "#f97316" })),

    b.text(p.insideLeft, 40, H / 2 - 110, W - 80, 220, "BIG\nNEWS\nDESERVES\nBIG\nCHEERS", { fontFamily: "Bebas Neue", fontSize: 52, lineHeight: 0.95, fill: "#111827" }),

    b.text(p.insideRight, 60, 260, W - 120, 200, "All that hard work paid off. So proud of you — go celebrate!", {
      fontFamily: "Poppins", fontSize: 24, lineHeight: 1.5, fill: "#111827",
    }),
    b.text(p.insideRight, 60, 490, W - 120, 40, "— Jordan", { fontFamily: "Caveat", fontSize: 38, fill: "#b45309" }),

    ...backMark(b, p.back, { iconName: "Star", color: "#facc15", textColor: "#9ca3af" }),
  ],
});

const baby = greetingCard({
  key: "baby-clouds",
  name: "Little Clouds Baby Card",
  subcategory: "baby",
  tags: ["baby", "new baby", "pastel", "shower"],
  backgrounds: { front: "#e0f2fe", insideLeft: "#ffffff", insideRight: "#ffffff", back: "#e0f2fe" },
  build: (p, b) => {
    const cloud = (pageId, x, y, s, fill = "#ffffff") => [
      b.shape(pageId, x, y + s * 0.35, s * 1.6, s * 0.65, "roundedRectangle", { fill, cornerRadius: s * 0.32 }),
      b.shape(pageId, x + s * 0.2, y + s * 0.05, s * 0.7, s * 0.7, "circle", { fill }),
      b.shape(pageId, x + s * 0.65, y - s * 0.15, s * 0.8, s * 0.8, "circle", { fill }),
    ];
    return [
      ...cloud(p.front, 60, 120, 110),
      ...cloud(p.front, 300, 220, 80),
      ...cloud(p.front, 120, 640, 90),
      b.shape(p.front, 380, 90, 60, 60, "circle", { fill: "#fde68a" }),
      ...[[90, 330], [430, 400], [250, 610], [460, 700]].map(([x, y]) => b.shape(p.front, x, y, 20, 20, "star", { fill: "#fbbf24" })),
      b.text(p.front, 40, 380, W - 80, 60, "Welcome,", { fontFamily: "Quicksand", fontSize: 40, fontWeight: "bold", fill: "#0369a1" }),
      b.text(p.front, 40, 440, W - 80, 110, "Little One", { fontFamily: "Dancing Script", fontSize: 76, fill: "#0284c7" }),

      ...cloud(p.insideLeft, 150, H / 2 - 60, 140, "#e0f2fe"),

      b.text(p.insideRight, 60, 250, W - 120, 200, "Sending all our love as you welcome your beautiful new baby into the world.", {
        fontFamily: "Quicksand", fontSize: 24, lineHeight: 1.55, fill: "#334155",
      }),
      b.text(p.insideRight, 60, 490, W - 120, 50, "Hugs, Riley & Casey", { fontFamily: "Dancing Script", fontSize: 36, fill: "#0284c7" }),

      ...backMark(b, p.back, { iconName: "Star", color: "#fbbf24", textColor: "#0369a1" }),
    ];
  },
});

const graduation = greetingCard({
  key: "graduation-classic",
  name: "Classic Graduation Card",
  subcategory: "graduation",
  tags: ["graduation", "grad", "navy", "gold"],
  backgrounds: { front: "#0f172a", insideLeft: "#ffffff", insideRight: "#ffffff", back: "#0f172a" },
  build: (p, b) => [
    b.shape(p.front, 0, 0, W, 120, "rectangle", { fill: "#1e3a8a" }),
    b.shape(p.front, 0, H - 120, W, 120, "rectangle", { fill: "#1e3a8a" }),
    b.icon(p.front, W / 2 - 60, 200, 120, "Award", { fill: "#fbbf24" }),
    b.text(p.front, 40, 360, W - 80, 40, "CLASS OF 2026", { fontFamily: "Cinzel", fontSize: 26, letterSpacing: 6, fill: "#fbbf24" }),
    b.text(p.front, 40, 420, W - 80, 170, "Congratulations, Graduate!", { fontFamily: "Playfair Display", fontSize: 50, fontWeight: "bold", lineHeight: 1.15, fill: "#ffffff" }),

    b.text(p.insideLeft, 60, H / 2 - 110, W - 120, 220, "“The future belongs to those who believe in the beauty of their dreams.”", {
      fontFamily: "Playfair Display", fontSize: 26, italic: true, lineHeight: 1.5, fill: "#1e3a8a",
    }),

    b.text(p.insideRight, 60, 250, W - 120, 200, "You worked so hard for this moment. We can't wait to see everything you do next.", {
      fontFamily: "Lora", fontSize: 24, lineHeight: 1.55, fill: "#1f2937",
    }),
    b.text(p.insideRight, 60, 490, W - 120, 50, "Proud of you — Mom & Dad", { fontFamily: "Caveat", fontSize: 34, fill: "#1e3a8a" }),

    ...backMark(b, p.back, { iconName: "Award", color: "#fbbf24", textColor: "#cbd5e1" }),
  ],
});

const holiday = greetingCard({
  key: "holiday-merry",
  name: "Merry & Bright Holiday Card",
  subcategory: "holiday",
  tags: ["holiday", "christmas", "winter", "red"],
  backgrounds: { front: "#b91c1c", insideLeft: "#fef2f2", insideRight: "#ffffff", back: "#b91c1c" },
  build: (p, b) => [
    ...[[50, 60, 40], [420, 80, 30], [220, 150, 24], [460, 300, 44], [40, 380, 28], [90, 620, 36], [400, 640, 30], [250, 720, 22]].map(([x, y, s]) =>
      b.icon(p.front, x, y, s, "Snowflake", { fill: "#fecaca", opacity: 0.8 })
    ),
    b.icon(p.front, W / 2 - 55, 200, 110, "Tree", { fill: "#ffffff" }),
    b.text(p.front, 40, 340, W - 80, 120, "Merry & Bright", { fontFamily: "Great Vibes", fontSize: 76, fill: "#ffffff" }),
    b.text(p.front, 40, 470, W - 80, 30, "SEASON'S GREETINGS", { fontFamily: "Montserrat", fontSize: 14, letterSpacing: 6, fill: "#fecaca" }),

    ...[[80, 120], [380, 200], [140, 560], [360, 640]].map(([x, y]) => b.icon(p.insideLeft, x, y, 40, "Snowflake", { fill: "#fca5a5" })),

    b.text(p.insideRight, 60, 250, W - 120, 200, "Wishing you cozy nights, warm hearts and a wonderful new year.", {
      fontFamily: "Lora", fontSize: 25, lineHeight: 1.55, fill: "#1f2937",
    }),
    b.text(p.insideRight, 60, 490, W - 120, 50, "The Garcia Family", { fontFamily: "Great Vibes", fontSize: 40, fill: "#b91c1c" }),

    ...backMark(b, p.back, { iconName: "Snowflake", color: "#ffffff", textColor: "#fecaca" }),
  ],
});

const love = greetingCard({
  key: "love-heart",
  name: "Big Heart Love Card",
  subcategory: "love",
  tags: ["love", "valentine", "romantic", "pink"],
  backgrounds: { front: "#fdf2f8", insideLeft: "#fdf2f8", insideRight: "#ffffff", back: "#fdf2f8" },
  build: (p, b) => [
    b.shape(p.front, 64, 200, 400, 360, "heart", { fill: "#ec4899" }),
    b.text(p.front, 84, 300, 360, 100, "You & Me", { fontFamily: "Pacifico", fontSize: 56, fill: "#ffffff" }),
    ...[[60, 90, 26], [430, 120, 34], [80, 650, 30], [420, 680, 22], [250, 80, 18]].map(([x, y, s]) => b.shape(p.front, x, y, s, s, "heart", { fill: "#f9a8d4" })),
    b.text(p.front, 40, 600, W - 80, 30, "ALWAYS & FOREVER", { fontFamily: "Montserrat", fontSize: 14, letterSpacing: 6, fill: "#be185d" }),

    ...[[120, 200, 60], [330, 320, 90], [160, 520, 44]].map(([x, y, s]) => b.shape(p.insideLeft, x, y, s, s, "heart", { fill: "#f9a8d4", opacity: 0.6 })),

    b.text(p.insideRight, 60, 260, W - 120, 200, "Every love song makes more sense since I met you.", {
      fontFamily: "Playfair Display", fontSize: 28, italic: true, lineHeight: 1.5, fill: "#831843",
    }),
    b.text(p.insideRight, 60, 490, W - 120, 50, "Yours, always", { fontFamily: "Pacifico", fontSize: 32, fill: "#ec4899" }),

    ...backMark(b, p.back, { iconName: "Heart", color: "#ec4899", textColor: "#be185d" }),
  ],
});

const invitation = greetingCard({
  key: "invitation-party",
  name: "Party Invitation Card",
  subcategory: "invitations",
  tags: ["invitation", "party", "event", "celebration"],
  backgrounds: { front: "#fef3c7", insideLeft: "#ffffff", insideRight: "#ffffff", back: "#fef3c7" },
  build: (p, b) => {
    const balloon = (x, y, fill) => [
      b.shape(p.front, x + 38, y + 100, 2, 150, "rectangle", { fill: "#a16207", opacity: 0.6 }),
      b.shape(p.front, x, y, 78, 100, "ellipse", { fill }),
    ];
    return [
      ...balloon(60, 70, "#f43f5e"),
      ...balloon(170, 30, "#8b5cf6"),
      ...balloon(290, 60, "#14b8a6"),
      ...balloon(390, 110, "#f97316"),
      b.text(p.front, 40, 400, W - 80, 50, "You're", { fontFamily: "Pacifico", fontSize: 44, fill: "#7c2d12" }),
      b.text(p.front, 40, 450, W - 80, 110, "INVITED", { fontFamily: "Bebas Neue", fontSize: 110, letterSpacing: 6, fill: "#b45309" }),
      b.text(p.front, 40, 580, W - 80, 30, "TO A CELEBRATION", { fontFamily: "Montserrat", fontSize: 14, letterSpacing: 6, fill: "#7c2d12" }),

      b.icon(p.insideLeft, W / 2 - 50, 240, 100, "Music", { fill: "#f59e0b" }),
      b.text(p.insideLeft, 60, 380, W - 120, 120, "Food, music & good friends", { fontFamily: "Pacifico", fontSize: 32, lineHeight: 1.3, fill: "#b45309" }),

      b.text(p.insideRight, 60, 150, W - 120, 50, "Join us for Maya's 30th", { fontFamily: "Playfair Display", fontSize: 30, fontWeight: "bold", fill: "#111827" }),
      b.shape(p.insideRight, W / 2 - 30, 220, 60, 3, "rectangle", { fill: "#f59e0b" }),
      b.text(p.insideRight, 60, 260, W - 120, 36, "SATURDAY, JUNE 14", { fontFamily: "Montserrat", fontSize: 18, fontWeight: "bold", letterSpacing: 3, fill: "#374151" }),
      b.text(p.insideRight, 60, 305, W - 120, 30, "7:00 PM", { fontFamily: "Montserrat", fontSize: 18, fill: "#374151" }),
      b.text(p.insideRight, 60, 370, W - 120, 70, "The Garden Room\n123 Main Street", { fontFamily: "Lora", fontSize: 20, lineHeight: 1.5, fill: "#374151" }),
      b.text(p.insideRight, 60, 500, W - 120, 30, "RSVP to Sam · 555-0123", { fontFamily: "Montserrat", fontSize: 14, letterSpacing: 2, fill: "#b45309" }),

      ...backMark(b, p.back, { iconName: "Music", color: "#f59e0b", textColor: "#7c2d12" }),
    ];
  },
});

export const GREETING_CARD_TEMPLATES = [birthday, wedding, anniversary, thankYou, congratulations, baby, graduation, holiday, love, invitation];
