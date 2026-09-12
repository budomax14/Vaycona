// Composites a flat wedding-invitation design onto a photo of blank
// invitation cards. Same warp/lighting engine as businessCardMockup.js, see
// perspectiveWarp.js. Two photo variants exist so the user can flip between
// them in the preview dialog instead of seeing only one staged scene.

import { compositeMockup } from "./perspectiveWarp";

export const WEDDING_INVITATION_PAGE_SIZE = { width: 500, height: 700 };

export function isWeddingInvitationPage(page) {
  return !!page && page.width === WEDDING_INVITATION_PAGE_SIZE.width && page.height === WEDDING_INVITATION_PAGE_SIZE.height;
}

// Every corner quad below was measured the same way: scan perpendicular to
// each edge for the paper/background brightness transition, fit a line
// through the samples, intersect adjacent edges for the corner — then
// confirmed by rendering a solid full-bleed color into the quad and
// checking (both visually and by sampling pixels along every edge) that no
// sliver of the original blank card remains visible.

const VARIANT_1_IMAGE_URL = "/wedding-invitation-mockup.png";
const VARIANT_1_FRONT_QUAD = [
  { x: 370, y: 137 },
  { x: 859, y: 75 },
  { x: 986, y: 783 },
  { x: 469, y: 857 },
];
// The second invitation standing behind/right of the front one.
const VARIANT_1_BACK_QUAD = [
  { x: 962, y: 118 },
  { x: 1324, y: 145 },
  { x: 1300, y: 657 },
  { x: 893, y: 620 },
];

const VARIANT_2_IMAGE_URL = "/wedding-invitation-mockup-2.png";
const VARIANT_2_FRONT_QUAD = [
  { x: 375.8, y: 155.9 },
  { x: 839.4, y: 100.3 },
  { x: 949.8, y: 774.0 },
  { x: 460.5, y: 841.1 },
];
// The second invitation standing behind/right of the front one.
const VARIANT_2_BACK_QUAD = [
  { x: 944.6, y: 162.8 },
  { x: 1286.5, y: 192.7 },
  { x: 1265.0, y: 660.5 },
  { x: 895.6, y: 623.6 },
];

// `frontCanvas`/`backCanvas`: flat-rendered invitation designs (any matching
// aspect ratio works; the 500x700 page ratio is what the quads above were
// measured against). Returns a detached canvas at the mockup photo's native
// resolution.
export const WEDDING_INVITATION_MOCKUP_VARIANTS = [
  {
    id: "desk-scene-1",
    generate: ({ frontCanvas, backCanvas }) =>
      compositeMockup({
        imageUrl: VARIANT_1_IMAGE_URL,
        slots: [
          { quad: VARIANT_1_FRONT_QUAD, canvas: frontCanvas },
          { quad: VARIANT_1_BACK_QUAD, canvas: backCanvas },
        ],
      }),
  },
  {
    id: "desk-scene-2",
    generate: ({ frontCanvas, backCanvas }) =>
      compositeMockup({
        imageUrl: VARIANT_2_IMAGE_URL,
        slots: [
          { quad: VARIANT_2_FRONT_QUAD, canvas: frontCanvas },
          { quad: VARIANT_2_BACK_QUAD, canvas: backCanvas },
        ],
      }),
  },
];
