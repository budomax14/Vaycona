// Every garment the "Preview" dialog can show a design on. Adding a new
// product (e.g. pants) only ever means dropping its photos into
// public/preview/ and adding an entry here — PreviewDialog.jsx and
// garmentRender.js stay generic.
//
// Each view's `image` is a cutout with real transparency (the garment on a
// transparent background), and each placement's `box` is the print area as
// fractions of that image, [x0, y0, x1, y1]. A view with several
// placements shows the "Whole front / Top left" style picker; a view with
// one placement uses it silently as the design's starting position.

const FRONT_PLACEMENTS = (full, topLeft) => [
  { id: "full", box: full },
  { id: "topLeft", box: topLeft },
];

export const PREVIEW_PRODUCTS = [
  {
    id: "tshirt",
    views: [
      {
        id: "front",
        image: "/preview/tshirt-front.png",
        placements: FRONT_PLACEMENTS([0.27, 0.2, 0.73, 0.78], [0.27, 0.2, 0.45, 0.34]),
      },
      { id: "back", image: "/preview/tshirt-back.png", placements: [{ id: "full", box: [0.28, 0.16, 0.72, 0.75] }] },
      { id: "side", image: "/preview/tshirt-side.png", placements: [{ id: "sleeve", box: [0.42, 0.28, 0.76, 0.55] }] },
    ],
  },
  {
    id: "sweatshirt",
    views: [
      {
        id: "front",
        image: "/preview/sweatshirt-front.png",
        placements: FRONT_PLACEMENTS([0.31, 0.22, 0.69, 0.8], [0.31, 0.22, 0.47, 0.36]),
      },
      { id: "back", image: "/preview/sweatshirt-back.png", placements: [{ id: "full", box: [0.27, 0.16, 0.73, 0.8] }] },
      { id: "side", image: "/preview/sweatshirt-side.png", placements: [{ id: "sleeve", box: [0.33, 0.28, 0.68, 0.55] }] },
    ],
  },
  {
    id: "hoodie",
    views: [
      {
        id: "front",
        image: "/preview/hoodie-front.png",
        placements: FRONT_PLACEMENTS([0.3, 0.3, 0.7, 0.56], [0.3, 0.3, 0.46, 0.42]),
      },
      { id: "back", image: "/preview/hoodie-back.png", placements: [{ id: "full", box: [0.28, 0.35, 0.72, 0.78] }] },
    ],
  },
  {
    id: "dressShirt",
    views: [{ id: "front", image: "/preview/dress-shirt-front.png", placements: [{ id: "pocket", box: [0.6, 0.31, 0.75, 0.45] }] }],
  },
  {
    id: "sweatpants",
    views: [
      { id: "front", image: "/preview/sweatpants-front.png", placements: [{ id: "leg", box: [0.1, 0.25, 0.42, 0.42] }] },
      { id: "back", image: "/preview/sweatpants-back.png", placements: [{ id: "hip", box: [0.3, 0.16, 0.72, 0.34] }] },
    ],
  },
  {
    id: "apron",
    views: [{ id: "front", image: "/preview/apron.png", placements: [{ id: "bib", box: [0.25, 0.28, 0.75, 0.6] }] }],
  },
  {
    id: "hat",
    views: [{ id: "front", image: "/preview/hat-front.png", placements: [{ id: "panel", box: [0.27, 0.14, 0.73, 0.5] }] }],
  },
  {
    id: "mug",
    views: [{ id: "front", image: "/preview/mug-front.png", placements: [{ id: "side", box: [0.12, 0.2, 0.58, 0.8] }] }],
  },
];

export const PREVIEW_COLORS = [
  "#ffffff",
  "#d9c8a9",
  "#8a8d91",
  "#111111",
  "#1f2a44",
  "#2f5bd2",
  "#7cc4f2",
  "#2e7d4f",
  "#6b7a3a",
  "#f5c518",
  "#f28c28",
  "#d32f2f",
  "#7b1e3a",
  "#f4a6c0",
  "#6a3fa0",
];

export function findPreviewProduct(productId) {
  return PREVIEW_PRODUCTS.find((product) => product.id === productId) || PREVIEW_PRODUCTS[0];
}

export function findPreviewView(product, viewId) {
  return product.views.find((view) => view.id === viewId) || product.views[0];
}
