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
    name: "ThumbsDown",
    category: "Social",
    tags: ["dislike", "disapprove"],
    node: [
      ["path", { d: "M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z", fill: "currentColor" }],
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
  {
    name: "Refresh",
    category: "Navigation",
    tags: ["reload", "sync", "restart"],
    node: [
      ["path", { d: "M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z", fill: "currentColor" }],
    ],
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
  {
    name: "Settings",
    category: "Symbols",
    tags: ["gear", "options", "preferences"],
    node: [
      ["path", { d: "M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z", fill: "currentColor" }],
    ],
  },
  {
    name: "Trash",
    category: "Symbols",
    tags: ["delete", "remove", "bin"],
    node: [
      ["path", { d: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z", fill: "currentColor" }],
    ],
  },
  {
    name: "Eye",
    category: "Symbols",
    tags: ["view", "visibility", "preview"],
    node: [
      ["path", { d: "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z", fill: "currentColor" }],
    ],
  },

  // Technology
  {
    name: "Laptop",
    category: "Technology",
    tags: ["computer", "device"],
    node: [
      ["path", { d: "M20,18c1.1,0,2-0.9,2-2V6c0-1.1-0.9-2-2-2H4C2.9,4,2,4.9,2,6v10c0,1.1,0.9,2,2,2H0v2h24v-2H20z M4,6h16v10H4V6z", fill: "currentColor" }],
    ],
  },
  {
    name: "Smartphone",
    category: "Technology",
    tags: ["phone", "mobile", "device"],
    node: [
      ["path", { d: "M16 1H8C6.34 1 5 2.34 5 4v16c0 1.66 1.34 3 3 3h8c1.66 0 3-1.34 3-3V4c0-1.66-1.34-3-3-3zm-2 20h-4v-1h4v1zm3.25-3H6.75V4h10.5v14z", fill: "currentColor" }],
    ],
  },
  {
    name: "Wifi",
    category: "Technology",
    tags: ["network", "wireless", "internet"],
    node: [
      ["path", { d: "M24,8.98C20.93,5.9,16.69,4,12,4C7.31,4,3.07,5.9,0,8.98L12,21v0l0,0L24,8.98z M2.92,9.07C5.51,7.08,8.67,6,12,6 s6.49,1.08,9.08,3.07l-1.43,1.43C17.5,8.94,14.86,8,12,8s-5.5,0.94-7.65,2.51L2.92,9.07z", fill: "currentColor" }],
    ],
  },
  {
    name: "Globe",
    category: "Technology",
    tags: ["world", "website", "internet", "language"],
    node: [
      ["path", { d: "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z", fill: "currentColor" }],
    ],
  },
  {
    name: "Link",
    category: "Technology",
    tags: ["url", "chain", "hyperlink"],
    node: [
      ["path", { d: "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z", fill: "currentColor" }],
    ],
  },

  // Time
  {
    name: "Clock",
    category: "Time",
    tags: ["time", "hour"],
    node: [
      ["path", { d: "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z", fill: "currentColor" }],
      ["path", { d: "M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z", fill: "currentColor" }],
    ],
  },
  {
    name: "Alarm",
    category: "Time",
    tags: ["alarm clock", "reminder", "wake up"],
    node: [
      ["path", { d: "M22 5.72l-4.6-3.86-1.29 1.53 4.6 3.86L22 5.72zM7.88 3.39L6.6 1.86 2 5.71l1.29 1.53 4.59-3.85zM12.5 8H11v6l4.75 2.85.75-1.23-4-2.37V8zM12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9c4.97 0 9-4.03 9-9s-4.03-9-9-9zm0 16c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z", fill: "currentColor" }],
    ],
  },
  {
    name: "Calendar",
    category: "Time",
    tags: ["date", "schedule", "event"],
    node: [
      ["path", { d: "M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z", fill: "currentColor" }],
    ],
  },

  // Travel
  {
    name: "Car",
    category: "Travel",
    tags: ["vehicle", "drive", "transport"],
    node: [
      ["path", { d: "M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z", fill: "currentColor" }],
    ],
  },
  {
    name: "Plane",
    category: "Travel",
    tags: ["flight", "airplane", "trip"],
    node: [
      ["path", { d: "M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z", fill: "currentColor" }],
    ],
  },
  {
    name: "Hotel",
    category: "Travel",
    tags: ["bed", "lodging", "stay"],
    node: [
      ["path", { d: "M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z", fill: "currentColor" }],
    ],
  },
  {
    name: "Restaurant",
    category: "Travel",
    tags: ["food", "dining", "fork"],
    node: [
      ["path", { d: "M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z", fill: "currentColor" }],
    ],
  },
  {
    name: "Coffee",
    category: "Travel",
    tags: ["cafe", "drink", "cup"],
    node: [
      ["path", { d: "M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.9 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z", fill: "currentColor" }],
    ],
  },

  // Nature
  {
    name: "Paw",
    category: "Nature",
    tags: ["pet", "animal", "dog", "cat"],
    node: [
      ["circle", { cx: 4.5, cy: 9.5, r: 2.5, fill: "currentColor" }],
      ["circle", { cx: 9, cy: 5.5, r: 2.5, fill: "currentColor" }],
      ["circle", { cx: 15, cy: 5.5, r: 2.5, fill: "currentColor" }],
      ["circle", { cx: 19.5, cy: 9.5, r: 2.5, fill: "currentColor" }],
      ["path", { d: "M17.34 14.86c-.87-1.02-1.6-1.89-2.48-2.91-.46-.54-1.05-1.08-1.75-1.32-.11-.04-.22-.07-.33-.09-.25-.04-.52-.04-.78-.04s-.53 0-.79.05c-.11.02-.22.05-.33.09-.7.24-1.28.78-1.75 1.32-.87 1.02-1.6 1.89-2.48 2.91-1.31 1.31-2.92 2.76-2.62 4.79.29 1.02 1.02 2.03 2.33 2.32.73.15 3.06-.44 5.54-.44h.18c2.48 0 4.81.58 5.54.44 1.31-.29 2.04-1.31 2.33-2.32.31-2.04-1.3-3.49-2.61-4.8z", fill: "currentColor" }],
    ],
  },
  {
    name: "Tree",
    category: "Nature",
    tags: ["plant", "forest", "eco"],
    node: [
      ["path", { d: "M13 16.12c3.47-.41 6.17-3.36 6.17-6.95 0-3.87-3.13-7-7-7s-7 3.13-7 7c0 3.47 2.52 6.34 5.83 6.89V20H5v2h14v-2h-6v-3.88z", fill: "currentColor" }],
    ],
  },
  {
    name: "Flower",
    category: "Nature",
    tags: ["floral", "bloom", "garden"],
    node: [
      ["path", { d: "M12 22c4.97 0 9-4.03 9-9-4.97 0-9 4.03-9 9zM5.6 10.25c0 1.38 1.12 2.5 2.5 2.5.53 0 1.01-.16 1.42-.44l-.02.19c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5l-.02-.19c.4.28.89.44 1.42.44 1.38 0 2.5-1.12 2.5-2.5 0-1-.59-1.85-1.43-2.25.84-.4 1.43-1.25 1.43-2.25 0-1.38-1.12-2.5-2.5-2.5-.53 0-1.01.16-1.42.44l.02-.19C14.5 2.12 13.38 1 12 1S9.5 2.12 9.5 3.5l.02.19c-.4-.28-.89-.44-1.42-.44-1.38 0-2.5 1.12-2.5 2.5 0 1 .59 1.85 1.43 2.25-.84.4-1.43 1.25-1.43 2.25zM12 5.5c1.38 0 2.5 1.12 2.5 2.5s-1.12 2.5-2.5 2.5S9.5 9.38 9.5 8s1.12-2.5 2.5-2.5zM3 13c0 4.97 4.03 9 9 9 0-4.97-4.03-9-9-9z", fill: "currentColor" }],
    ],
  },

  // Files
  {
    name: "Folder",
    category: "Files",
    tags: ["directory", "storage"],
    node: [
      ["path", { d: "M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z", fill: "currentColor" }],
    ],
  },
  {
    name: "Save",
    category: "Files",
    tags: ["disk", "download", "floppy"],
    node: [
      ["path", { d: "M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z", fill: "currentColor" }],
    ],
  },
  {
    name: "Paperclip",
    category: "Files",
    tags: ["attach", "attachment", "clip"],
    node: [
      ["path", { d: "M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z", fill: "currentColor" }],
    ],
  },
  {
    name: "CloudUpload",
    category: "Files",
    tags: ["upload", "backup"],
    node: [
      ["path", { d: "M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z", fill: "currentColor" }],
    ],
  },
  {
    name: "CloudDownload",
    category: "Files",
    tags: ["download", "restore"],
    node: [
      ["path", { d: "M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z", fill: "currentColor" }],
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
