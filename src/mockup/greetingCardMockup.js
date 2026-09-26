// Composites a half-fold greeting card's panels onto photos of blank
// folded cards — same warp/lighting engine as businessCardMockup.js (see
// perspectiveWarp.js). Unlike the single-page mockups in mockupRegistry.js
// this needs all four panels, so it's driven by CardPreviewDialog.jsx
// rather than the generic MockupPreviewDialog.
//
// Quads were measured the same way as the other mockups: flood-fill each
// blank paper face, fit a line to each edge by scanning perpendicular to
// it for the paper/background brightness step, intersect adjacent edges —
// then checked against zoomed crops of every corner. Order is always
// [top-left, top-right, bottom-right, bottom-left] of the panel as
// designed (upright).

import { compositeMockup } from "./perspectiveWarp";

// Saved as plain RGB: the source render carried a junk, everywhere-partial
// alpha channel that turned its gray studio backdrop black once composited.
const STUDIO_IMAGE_URL = "/greeting-card-mockup-studio.png";
const STUDIO = {
  front: [
    { x: 126.5, y: 58 },
    { x: 555, y: 47 },
    { x: 544.3, y: 557.7 },
    { x: 133.8, y: 582.1 },
  ],
  insideLeft: [
    { x: 697.5, y: 45.5 },
    { x: 1090.7, y: 71 },
    { x: 1090.6, y: 550.1 },
    { x: 697.5, y: 570.6 },
  ],
  insideRight: [
    { x: 1090.4, y: 72.3 },
    { x: 1481.6, y: 40.3 },
    { x: 1481.7, y: 583.9 },
    { x: 1090.4, y: 551.5 },
  ],
  back: [
    { x: 367, y: 657.1 },
    { x: 551.9, y: 635.8 },
    { x: 549.9, y: 898.4 },
    { x: 368.9, y: 936.6 },
  ],
  // The card lying almost closed; its fold runs along the quad's left edge.
  folded: [
    { x: 906.3, y: 632.5 },
    { x: 1194.1, y: 666.6 },
    { x: 1124.4, y: 906.5 },
    { x: 802.1, y: 841.1 },
  ],
};

const SCENE_IMAGE_URL = "/greeting-card-mockup-scene.png";
const SCENE = {
  front: [
    { x: 183.4, y: 255.6 },
    { x: 592.3, y: 232 },
    { x: 636.8, y: 768.4 },
    { x: 224.3, y: 822.1 },
  ],
  insideLeft: [
    { x: 682, y: 279 },
    { x: 1051.6, y: 303.7 },
    { x: 1048.5, y: 729.1 },
    { x: 674.1, y: 757.6 },
  ],
  insideRight: [
    { x: 1051.6, y: 303.8 },
    { x: 1416.7, y: 268.9 },
    { x: 1416.4, y: 776.2 },
    { x: 1048.5, y: 728.2 },
  ],
};

// The real width/height of each photographed open card's inside faces.
// These AI-staged cards are squarer than a 5.5 × 8.5 panel (0.647), so
// warping an inside panel straight onto its face stretched the design
// sideways by up to ~45%. Estimated from each quad's perspective
// (rectangle-from-homography at a ~50mm-equivalent focal length); both
// halves of one open card share a value.
const INSIDE_FACE_ASPECT = { scene: 0.95, studio: 0.83 };

// Places a panel on a face-shaped canvas at its true proportions (never
// stretched), centered, with the leftover margin filled in the panel's own
// background colour — so a design reads as a card with slightly roomier
// margins rather than squashed artwork.
function fitPanelToFace(panel, faceAspect, background) {
  if (!panel) return null;
  const pw = panel.naturalWidth || panel.width;
  const ph = panel.naturalHeight || panel.height;
  const panelAspect = pw / ph;
  const height = ph;
  const width = Math.round(height * Math.max(faceAspect, 0.01));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(width, 1);
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = background || "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Skip the panel image's outermost pixel: the downscaled preview render
  // leaves a partly transparent last row/column that JPEG turns into a dark
  // hairline, which would otherwise show at the edge of the design.
  const inset = 1;
  const src = [inset, inset, pw - inset * 2, ph - inset * 2];
  if (faceAspect >= panelAspect) {
    const drawW = Math.round(height * panelAspect);
    ctx.drawImage(panel, ...src, Math.round((canvas.width - drawW) / 2), 0, drawW, height);
  } else {
    const drawH = Math.round(canvas.width / panelAspect);
    ctx.drawImage(panel, ...src, 0, Math.round((height - drawH) / 2), canvas.width, drawH);
  }
  return canvas;
}

// Inside panels only: fitted to the face's true proportions and warped in
// true perspective (the open card's angled faces were what showed the
// distortion).
function insideSlot(quad, panel, aspect, background) {
  return { quad, canvas: fitPanelToFace(panel, aspect, background), projective: true };
}

// `panels`: { front, insideLeft, insideRight, back } — each an image or
// canvas of the flat panel. `backgrounds`: the same keys → each panel
// page's background colour (fills the face around the fitted panel).
export const GREETING_CARD_MOCKUP_VARIANTS = [
  {
    id: "scene",
    generate: (panels, backgrounds) =>
      compositeMockup({
        imageUrl: SCENE_IMAGE_URL,
        slots: [
          { quad: SCENE.front, canvas: panels.front },
          insideSlot(SCENE.insideLeft, panels.insideLeft, INSIDE_FACE_ASPECT.scene, backgrounds?.insideLeft),
          insideSlot(SCENE.insideRight, panels.insideRight, INSIDE_FACE_ASPECT.scene, backgrounds?.insideRight),
        ],
      }),
  },
  {
    id: "studio",
    generate: (panels, backgrounds) =>
      compositeMockup({
        imageUrl: STUDIO_IMAGE_URL,
        slots: [
          { quad: STUDIO.front, canvas: panels.front },
          insideSlot(STUDIO.insideLeft, panels.insideLeft, INSIDE_FACE_ASPECT.studio, backgrounds?.insideLeft),
          insideSlot(STUDIO.insideRight, panels.insideRight, INSIDE_FACE_ASPECT.studio, backgrounds?.insideRight),
          { quad: STUDIO.back, canvas: panels.back },
          { quad: STUDIO.folded, canvas: panels.front },
        ],
      }),
  },
];
