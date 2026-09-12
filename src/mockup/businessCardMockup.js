// Composites a flat business-card design onto a photo of two blank cards on
// a desk (public/business-card-mockup.png) so the user sees something closer
// to a printed product than a flat rectangle. The actual warp/lighting engine
// lives in perspectiveWarp.js (shared with every other mockup type) — this
// file only supplies the business-card-specific page size, photo, and
// hand-measured corner quads.

import { compositeMockup } from "./perspectiveWarp";

export const BUSINESS_CARD_PAGE_SIZE = { width: 336, height: 192 };

export function isBusinessCardPage(page) {
  return !!page && page.width === BUSINESS_CARD_PAGE_SIZE.width && page.height === BUSINESS_CARD_PAGE_SIZE.height;
}

const MOCKUP_IMAGE_URL = "/business-card-mockup.png";

// Corners of each blank card's visible top face in the source photo, hand-
// measured against its actual pixel grid (1536x1024). Order is [top-left,
// top-right, bottom-right, bottom-left] of the design as it should read —
// i.e. top-left -> top-right is the card's long (3.5in) edge.
const FRONT_CARD_QUAD = [
  { x: 378, y: 397 },
  { x: 989, y: 522 },
  { x: 907, y: 907 },
  { x: 254, y: 760 },
];

// The stacked card behind/above the front one. Its near-bottom corner is
// occluded by the front card in the photo, so it's completed as a
// parallelogram from the three visible corners.
const BACK_CARD_QUAD = [
  { x: 764, y: 109 },
  { x: 1346, y: 329 },
  { x: 1184, y: 605.9 },
  { x: 562, y: 337 },
];

// `frontCanvas`/`backCanvas`: flat-rendered card designs (any matching
// aspect ratio works; 336x192 page ratio is what the quads above were
// measured against). Returns a detached canvas at the mockup photo's native
// resolution.
export const BUSINESS_CARD_MOCKUP_VARIANTS = [
  {
    id: "desk-scene-1",
    generate: ({ frontCanvas, backCanvas }) =>
      compositeMockup({
        imageUrl: MOCKUP_IMAGE_URL,
        slots: [
          { quad: FRONT_CARD_QUAD, canvas: frontCanvas },
          { quad: BACK_CARD_QUAD, canvas: backCanvas },
        ],
      }),
  },
];
