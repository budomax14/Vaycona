// Static, local vector icon catalog — each entry's `node` array is the same
// [tag, attrs] tuple geometry lucide-react ships internally (confirmed by
// reading its source), extracted once so this app has zero runtime
// dependency on lucide-react's internal module layout. IconNode.jsx maps
// each tuple straight to a native Konva primitive (Path/Circle/Rect/Line) —
// these are real vector objects, never rasterized images.
//
// Native size for every icon is the standard Lucide 24x24 viewBox;
// IconNode scales that box to the item's stored width/height.
export const ICON_NATIVE_SIZE = 24;

export const ICON_CATALOG = [
  // Basic
  {
    name: "Home",
    category: "Basic",
    tags: ["house", "home"],
    node: [
      ["path", { d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" }],
      ["path", { d: "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" }],
    ],
  },
  {
    name: "Star",
    category: "Basic",
    tags: ["favorite", "rating"],
    node: [
      ["path", { d: "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" }],
    ],
  },
  {
    name: "Heart",
    category: "Basic",
    tags: ["love", "like", "favorite"],
    node: [
      ["path", { d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" }],
    ],
  },
  {
    name: "Check",
    category: "Basic",
    tags: ["done", "confirm", "tick"],
    node: [["path", { d: "M20 6 9 17l-5-5" }]],
  },
  {
    name: "X",
    category: "Basic",
    tags: ["close", "cancel", "delete"],
    node: [
      ["path", { d: "M18 6 6 18" }],
      ["path", { d: "m6 6 12 12" }],
    ],
  },
  {
    name: "Plus",
    category: "Basic",
    tags: ["add", "new"],
    node: [
      ["path", { d: "M5 12h14" }],
      ["path", { d: "M12 5v14" }],
    ],
  },
  {
    name: "Search",
    category: "Basic",
    tags: ["find", "magnifier", "look up"],
    node: [
      ["circle", { cx: 11, cy: 11, r: 8 }],
      ["path", { d: "m21 21-4.3-4.3" }],
    ],
  },

  // Communication
  {
    name: "Mail",
    category: "Communication",
    tags: ["email", "envelope", "message"],
    node: [
      ["rect", { x: 2, y: 4, width: 20, height: 16, rx: 2 }],
      ["path", { d: "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" }],
    ],
  },
  {
    name: "MessageCircle",
    category: "Communication",
    tags: ["chat", "comment", "bubble"],
    node: [["path", { d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z" }]],
  },
  {
    name: "Phone",
    category: "Communication",
    tags: ["call", "telephone", "contact"],
    node: [
      ["path", { d: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" }],
    ],
  },
  {
    name: "Send",
    category: "Communication",
    tags: ["message", "submit", "paper plane"],
    node: [
      ["path", { d: "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" }],
      ["path", { d: "m21.854 2.147-10.94 10.939" }],
    ],
  },

  // Social
  {
    name: "Share2",
    category: "Social",
    tags: ["share", "network", "connect"],
    node: [
      ["circle", { cx: 18, cy: 5, r: 3 }],
      ["circle", { cx: 6, cy: 12, r: 3 }],
      ["circle", { cx: 18, cy: 19, r: 3 }],
      ["line", { x1: 8.59, y1: 13.51, x2: 15.42, y2: 17.49 }],
      ["line", { x1: 15.41, y1: 6.51, x2: 8.59, y2: 10.49 }],
    ],
  },
  {
    name: "ThumbsUp",
    category: "Social",
    tags: ["like", "approve"],
    node: [
      ["path", { d: "M7 10v12" }],
      ["path", { d: "M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" }],
    ],
  },
  {
    name: "Bell",
    category: "Social",
    tags: ["notification", "alert", "reminder"],
    node: [
      ["path", { d: "M10.268 21a2 2 0 0 0 3.464 0" }],
      ["path", { d: "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" }],
    ],
  },
  {
    name: "Users",
    category: "Social",
    tags: ["people", "group", "community"],
    node: [
      ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }],
      ["circle", { cx: 9, cy: 7, r: 4 }],
      ["path", { d: "M22 21v-2a4 4 0 0 0-3-3.87" }],
      ["path", { d: "M16 3.13a4 4 0 0 1 0 7.75" }],
    ],
  },

  // Business
  {
    name: "Briefcase",
    category: "Business",
    tags: ["work", "job", "bag"],
    node: [
      ["path", { d: "M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" }],
      ["rect", { x: 2, y: 6, width: 20, height: 14, rx: 2 }],
    ],
  },
  {
    name: "TrendingUp",
    category: "Business",
    tags: ["growth", "chart", "increase"],
    node: [
      ["polyline", { points: [22, 7, 13.5, 15.5, 8.5, 10.5, 2, 17] }],
      ["polyline", { points: [16, 7, 22, 7, 22, 13] }],
    ],
  },
  {
    name: "ChartColumn",
    category: "Business",
    tags: ["bar chart", "analytics", "stats"],
    node: [
      ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16" }],
      ["path", { d: "M18 17V9" }],
      ["path", { d: "M13 17V5" }],
      ["path", { d: "M8 17v-3" }],
    ],
  },
  {
    name: "DollarSign",
    category: "Business",
    tags: ["money", "price", "currency"],
    node: [
      ["line", { x1: 12, y1: 2, x2: 12, y2: 22 }],
      ["path", { d: "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" }],
    ],
  },

  // Navigation
  {
    name: "ArrowRight",
    category: "Navigation",
    tags: ["next", "forward"],
    node: [
      ["path", { d: "M5 12h14" }],
      ["path", { d: "m12 5 7 7-7 7" }],
    ],
  },
  {
    name: "ArrowLeft",
    category: "Navigation",
    tags: ["previous", "back"],
    node: [
      ["path", { d: "m12 19-7-7 7-7" }],
      ["path", { d: "M19 12H5" }],
    ],
  },
  {
    name: "MapPin",
    category: "Navigation",
    tags: ["location", "place", "marker"],
    node: [
      ["path", { d: "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" }],
      ["circle", { cx: 12, cy: 10, r: 3 }],
    ],
  },
  {
    name: "Compass",
    category: "Navigation",
    tags: ["direction", "explore"],
    node: [
      ["path", { d: "m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" }],
      ["circle", { cx: 12, cy: 12, r: 10 }],
    ],
  },
  {
    name: "ChevronRight",
    category: "Navigation",
    tags: ["expand", "arrow", "next"],
    node: [["path", { d: "m9 18 6-6-6-6" }]],
  },

  // Media
  {
    name: "Play",
    category: "Media",
    tags: ["video", "start", "triangle"],
    node: [["polygon", { points: [6, 3, 20, 12, 6, 21, 6, 3] }]],
  },
  {
    name: "Pause",
    category: "Media",
    tags: ["video", "stop"],
    node: [
      ["rect", { x: 14, y: 4, width: 4, height: 16, rx: 1 }],
      ["rect", { x: 6, y: 4, width: 4, height: 16, rx: 1 }],
    ],
  },
  {
    name: "Camera",
    category: "Media",
    tags: ["photo", "picture"],
    node: [
      ["path", { d: "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" }],
      ["circle", { cx: 12, cy: 13, r: 3 }],
    ],
  },
  {
    name: "Music",
    category: "Media",
    tags: ["song", "audio", "note"],
    node: [
      ["path", { d: "M9 18V5l12-2v13" }],
      ["circle", { cx: 6, cy: 18, r: 3 }],
      ["circle", { cx: 18, cy: 16, r: 3 }],
    ],
  },
  {
    name: "Image",
    category: "Media",
    tags: ["photo", "picture", "gallery"],
    node: [
      ["rect", { x: 3, y: 3, width: 18, height: 18, rx: 2, ry: 2 }],
      ["circle", { cx: 9, cy: 9, r: 2 }],
      ["path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" }],
    ],
  },

  // Shopping
  {
    name: "ShoppingCart",
    category: "Shopping",
    tags: ["cart", "buy", "checkout"],
    node: [
      ["circle", { cx: 8, cy: 21, r: 1 }],
      ["circle", { cx: 19, cy: 21, r: 1 }],
      ["path", { d: "M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" }],
    ],
  },
  {
    name: "ShoppingBag",
    category: "Shopping",
    tags: ["bag", "buy", "purchase"],
    node: [
      ["path", { d: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" }],
      ["path", { d: "M3 6h18" }],
      ["path", { d: "M16 10a4 4 0 0 1-8 0" }],
    ],
  },
  {
    name: "Tag",
    category: "Shopping",
    tags: ["price", "label", "sale"],
    node: [
      ["path", { d: "M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" }],
      ["circle", { cx: 7.5, cy: 7.5, r: 0.5, fill: "currentColor" }],
    ],
  },
  {
    name: "CreditCard",
    category: "Shopping",
    tags: ["payment", "card", "checkout"],
    node: [
      ["rect", { x: 2, y: 5, width: 20, height: 14, rx: 2 }],
      ["line", { x1: 2, y1: 10, x2: 22, y2: 10 }],
    ],
  },
  {
    name: "Gift",
    category: "Shopping",
    tags: ["present", "box", "birthday"],
    node: [
      ["rect", { x: 3, y: 8, width: 18, height: 4, rx: 1 }],
      ["path", { d: "M12 8v13" }],
      ["path", { d: "M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" }],
      ["path", { d: "M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" }],
    ],
  },

  // People
  {
    name: "User",
    category: "People",
    tags: ["person", "profile", "account"],
    node: [
      ["path", { d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" }],
      ["circle", { cx: 12, cy: 7, r: 4 }],
    ],
  },
  {
    name: "CircleUser",
    category: "People",
    tags: ["profile", "account", "avatar"],
    node: [
      ["circle", { cx: 12, cy: 12, r: 10 }],
      ["circle", { cx: 12, cy: 10, r: 3 }],
      ["path", { d: "M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" }],
    ],
  },
  {
    name: "Smile",
    category: "People",
    tags: ["happy", "emoji", "face"],
    node: [
      ["circle", { cx: 12, cy: 12, r: 10 }],
      ["path", { d: "M8 14s1.5 2 4 2 4-2 4-2" }],
      ["line", { x1: 9, y1: 9, x2: 9.01, y2: 9 }],
      ["line", { x1: 15, y1: 9, x2: 15.01, y2: 9 }],
    ],
  },

  // Weather
  {
    name: "Sun",
    category: "Weather",
    tags: ["sunny", "clear", "day"],
    node: [
      ["circle", { cx: 12, cy: 12, r: 4 }],
      ["path", { d: "M12 2v2" }],
      ["path", { d: "M12 20v2" }],
      ["path", { d: "m4.93 4.93 1.41 1.41" }],
      ["path", { d: "m17.66 17.66 1.41 1.41" }],
      ["path", { d: "M2 12h2" }],
      ["path", { d: "M20 12h2" }],
      ["path", { d: "m6.34 17.66-1.41 1.41" }],
      ["path", { d: "m19.07 4.93-1.41 1.41" }],
    ],
  },
  {
    name: "Cloud",
    category: "Weather",
    tags: ["overcast", "sky"],
    node: [["path", { d: "M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" }]],
  },
  {
    name: "CloudRain",
    category: "Weather",
    tags: ["rain", "storm"],
    node: [
      ["path", { d: "M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" }],
      ["path", { d: "M16 14v6" }],
      ["path", { d: "M8 14v6" }],
      ["path", { d: "M12 16v6" }],
    ],
  },
  {
    name: "Umbrella",
    category: "Weather",
    tags: ["rain", "protection"],
    node: [
      ["path", { d: "M22 12a10.06 10.06 1 0 0-20 0Z" }],
      ["path", { d: "M12 12v8a2 2 0 0 0 4 0" }],
      ["path", { d: "M12 2v1" }],
    ],
  },
  {
    name: "Snowflake",
    category: "Weather",
    tags: ["snow", "winter", "cold"],
    node: [
      ["line", { x1: 2, y1: 12, x2: 22, y2: 12 }],
      ["line", { x1: 12, y1: 2, x2: 12, y2: 22 }],
      ["path", { d: "m20 16-4-4 4-4" }],
      ["path", { d: "m4 8 4 4-4 4" }],
      ["path", { d: "m16 4-4 4-4-4" }],
      ["path", { d: "m8 20 4-4 4 4" }],
    ],
  },

  // Symbols
  {
    name: "CircleAlert",
    category: "Symbols",
    tags: ["warning", "alert", "error"],
    node: [
      ["circle", { cx: 12, cy: 12, r: 10 }],
      ["line", { x1: 12, y1: 8, x2: 12, y2: 12 }],
      ["line", { x1: 12, y1: 16, x2: 12.01, y2: 16 }],
    ],
  },
  {
    name: "Info",
    category: "Symbols",
    tags: ["information", "help"],
    node: [
      ["circle", { cx: 12, cy: 12, r: 10 }],
      ["path", { d: "M12 16v-4" }],
      ["path", { d: "M12 8h.01" }],
    ],
  },
  {
    name: "CircleHelp",
    category: "Symbols",
    tags: ["question", "help", "faq"],
    node: [
      ["circle", { cx: 12, cy: 12, r: 10 }],
      ["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }],
      ["path", { d: "M12 17h.01" }],
    ],
  },
  {
    name: "Lock",
    category: "Symbols",
    tags: ["security", "private", "locked"],
    node: [
      ["rect", { x: 3, y: 11, width: 18, height: 11, rx: 2, ry: 2 }],
      ["path", { d: "M7 11V7a5 5 0 0 1 10 0v4" }],
    ],
  },
  {
    name: "Flag",
    category: "Symbols",
    tags: ["marker", "report", "banner"],
    node: [
      ["path", { d: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" }],
      ["line", { x1: 4, y1: 22, x2: 4, y2: 15 }],
    ],
  },
  {
    name: "Award",
    category: "Symbols",
    tags: ["badge", "medal", "achievement"],
    node: [
      ["path", { d: "m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526" }],
      ["circle", { cx: 12, cy: 8, r: 6 }],
    ],
  },
];

export const ICON_CATEGORIES = Array.from(new Set(ICON_CATALOG.map((icon) => icon.category)));

export function findIconByName(name) {
  return ICON_CATALOG.find((icon) => icon.name === name) || null;
}

export function searchIcons(query) {
  const q = query.trim().toLowerCase();
  if (!q) return ICON_CATALOG;
  return ICON_CATALOG.filter(
    (icon) =>
      icon.name.toLowerCase().includes(q) ||
      icon.category.toLowerCase().includes(q) ||
      icon.tags.some((tag) => tag.includes(q))
  );
}
