// Book covers (Home → Book): every book type pairs one photo of two blank
// white books (public/book-mockups/<id>.jpg — the front cover standing, the
// back cover lying or standing beside it) with one finished example photo
// (public/book-mockups/examples/<id>.jpg) shown in the picker. Same
// warp/lighting engine as the other mockups, see perspectiveWarp.js.
//
// A book project is tagged pages — `bookCover: { typeId, side }` — so
// several types can share a trim size and the preview still knows which
// photo to use. Each type offers a few trim sizes close to the proportions
// of the books in its photo. Bound books (everything but the stapled and
// spiral ones) also have a spine, `spineInches` thick (spine quads that run
// past a rounded spine's curve are trimmed back to the book by the
// backdrop mask below). Every type but the spiral ones can be laid out two
// ways: "separate" (Front cover, Back cover and — bound books — a Spine
// page, which is horizontal so its text runs along the spine) or "wrap"
// (one whole page: back | spine | front, the way printers lay out a cover;
// stapled books are back | front with a fold between). Spiral books are
// always Front cover + Back cover.
//
// Quads were measured the same way as the other mockups: fit a line to each
// cover edge by scanning perpendicular to it for the strongest brightness
// step, intersect adjacent edges — then checked by compositing a test
// pattern and looking for leftover slivers of blank cover. Order is always
// [top-left, top-right, bottom-right, bottom-left] of the cover as it reads.

import { compositeMockup } from "./perspectiveWarp";
import { createGuide } from "../precisionDefaults";

const PX_PER_IN = 96;

const size = (widthIn, heightIn, label) => ({
  id: `${widthIn}x${heightIn}`,
  label: label || `${widthIn} × ${heightIn} in`,
  width: Math.round(widthIn * PX_PER_IN),
  height: Math.round(heightIn * PX_PER_IN),
});

const q = (points) => points.map(([x, y]) => ({ x, y }));

export const BOOK_TYPES = [
  {
    id: "novel-paperback",
    sizes: [size(5, 8), size(5.5, 8.5), size(6, 9)],
    front: q([[128.1, 152.1], [657.5, 68.7], [651.5, 864], [128, 972.1]]),
    back: q([[695.2, 386], [1141.8, 298.8], [1487.5, 730.8], [926.5, 862.2]]),
    spineInches: 0.75,
    spineFront: q([[82.3, 128.6], [128.1, 152.1], [128, 972.1], [81.4, 937.3]]),
    spineBack: q([[697.1, 460.7], [695.2, 386], [926.5, 862.2], [922, 929.6]]),
  },
  {
    id: "thick-paperback",
    sizes: [size(6, 9), size(7, 10)],
    front: q([[169.7, 170.5], [706.5, 78.6], [698.1, 872.3], [177.1, 1004.1]]),
    back: q([[1041.5, 239.5], [1467.4, 325.6], [1281, 862], [754.7, 709.7]]),
    spineInches: 1.25,
    spineFront: q([[91.8, 128.3], [169.7, 170.5], [177.1, 1004.1], [98.3, 943.7]]),
    spineBack: q([[1467.4, 325.6], [1508, 350], [1300, 965], [1281, 862]]),
  },
  {
    id: "pocket-paperback",
    sizes: [size(5, 7), size(5.25, 8)],
    front: q([[186.1, 131.5], [724.5, 80.7], [718, 890], [194, 974.6]]),
    back: q([[811.9, 79.5], [1350.8, 130.6], [1342.7, 974.1], [818.6, 890.1]]),
    spineInches: 0.6,
    spineFront: q([[140, 110], [186.1, 131.5], [194, 974.6], [149.1, 939.3]]),
    spineBack: q([[1350.8, 130.6], [1397.3, 106.8], [1388.1, 944.9], [1342.7, 974.1]]),
  },
  {
    id: "slim-paperback",
    sizes: [size(7, 10), size(8, 10), size(8.5, 11)],
    front: q([[109, 49], [681.9, 117.9], [681.4, 867.4], [109, 907.6]]),
    back: q([[722.5, 336.3], [1179.6, 218.8], [1492.2, 699.5], [955.3, 853.6]]),
    spineInches: 0.3,
    spineFront: q([[80, 58.7], [109, 49], [109, 907.6], [80, 897.3]]),
    spineBack: q([[709.1, 357.8], [722.5, 336.3], [955.3, 853.6], [946.8, 890.1]]),
  },
  {
    id: "hardcover",
    sizes: [size(6, 9), size(7, 10), size(8, 10)],
    front: q([[150.1, 203.5], [673.2, 115.8], [670.3, 826.1], [143.1, 959.3]]),
    back: q([[1018.3, 284.7], [1483.5, 355.5], [1310.4, 842.1], [722.9, 714.9]]),
    spineInches: 1,
    spineFront: q([[45.7, 163.4], [150.1, 203.5], [143.1, 964], [52, 962]]),
    spineBack: q([[1483.5, 355.5], [1513, 395], [1330, 960], [1310.4, 842.1]]),
  },
  {
    id: "thick-hardcover",
    sizes: [size(6, 9), size(7, 10)],
    front: q([[218.2, 196], [705.4, 106.7], [706.1, 807], [226.7, 955.1]]),
    back: q([[1048.3, 314.1], [1513.1, 394.2], [1317.7, 792.7], [795, 683.3]]),
    spineInches: 1.6,
    spineFront: q([[50.4, 129.4], [218.2, 196], [226.7, 968], [48, 972]]),
    spineBack: q([[1017.1, 318.7], [1048.3, 314.1], [795, 683.3], [755, 692.2]]),
  },
  {
    id: "square-hardcover",
    sizes: [size(8, 8), size(8.5, 8.5), size(10, 10), size(12, 12)],
    front: q([[110.2, 93.7], [695.7, 85.3], [687.2, 642.5], [116.9, 702.1]]),
    back: q([[760, 295.6], [1243, 173.7], [1506.2, 510.7], [949.2, 676.4]]),
    spineInches: 0.5,
    spineFront: q([[81.6, 106.5], [110.2, 93.7], [116.9, 702.1], [90.2, 690.9]]),
    spineBack: q([[744.8, 313.4], [760, 295.6], [949.2, 676.4], [938.6, 709.4]]),
  },
  {
    id: "landscape-hardcover",
    sizes: [size(8.5, 8), size(9, 8)],
    front: q([[110.1, 131.8], [678.2, 53.9], [680, 625.4], [102.1, 739.5]]),
    back: q([[725.7, 326.8], [1248.5, 223.9], [1506.2, 546.6], [902.2, 674.9]]),
    spineInches: 0.45,
    spineFront: q([[45.6, 117], [110.1, 131.8], [102.1, 739.5], [47.3, 710.6]]),
    spineBack: q([[710, 340], [725.7, 326.8], [902.2, 674.9], [885, 732]]),
  },
  {
    id: "square-softcover",
    sizes: [size(7.5, 7.5), size(8, 8), size(8.5, 8.5)],
    front: q([[85.1, 121.7], [698.1, 65.6], [691.3, 652.4], [86.4, 719.7]]),
    back: q([[983.7, 152.7], [1508.8, 281.7], [1334.9, 710.4], [748.6, 536.1]]),
  },
  {
    id: "magazine",
    sizes: [size(8.5, 11), size(8.27, 11.69, "A4 · 8.27 × 11.69 in")],
    front: q([[76.1, 121.9], [666.8, 71.3], [656.3, 841.5], [83, 951.9]]),
    back: q([[992.6, 221], [1511, 338.6], [1312, 934.2], [703.6, 775.3]]),
  },
  {
    id: "catalog",
    sizes: [size(5.5, 10), size(6, 10)],
    front: q([[173.5, 17.2], [615, 63], [613.5, 909.5], [172.9, 955]]),
    back: q([[676.2, 272.4], [1069.3, 126.2], [1469.7, 685.3], [1000.2, 922.5]]),
  },
  {
    id: "spiral-landscape",
    binding: "spiral",
    sizes: [size(9, 6), size(11, 7)],
    front: q([[63.5, 291.3], [742.1, 196.5], [741.6, 655.2], [76.2, 782.4]]),
    back: q([[953.9, 393.8], [1496.9, 506.4], [1392.8, 857.4], [768.4, 648.4]]),
    // Strips along the bound edge where the coils and punched holes sit on
    // top of the cover — their dark pixels are put back over the design.
    frontCoils: q([[63.5, 291.3], [118, 284], [131, 776], [76.2, 782.4]]),
    backCoils: q([[1496.9, 506.4], [1392.8, 857.4], [1322.8, 857.4], [1426.9, 506.4]]),
  },
  {
    id: "spiral-portrait",
    binding: "spiral",
    sizes: [size(5.5, 8.5), size(5.83, 8.27, "A5 · 5.83 × 8.27 in"), size(6, 9)],
    front: q([[109.5, 91.4], [641.5, 32.3], [641.5, 874.9], [109.8, 988.2]]),
    back: q([[1013.3, 323.3], [1479.7, 403.5], [1304.1, 954.7], [717.1, 795.1]]),
    frontCoils: q([[109.5, 91.4], [180, 84], [180, 980], [109.8, 988.2]]),
    backCoils: q([[1479.7, 403.5], [1304.1, 954.7], [1229.1, 954.7], [1404.7, 403.5]]),
  },
];

export const bookMockupImageUrl = (typeId) => `/book-mockups/${typeId}.jpg`;
export const bookExampleImageUrl = (typeId) => `/book-mockups/examples/${typeId}.jpg`;

export function getBookType(typeId) {
  return BOOK_TYPES.find((type) => type.id === typeId) || null;
}

export function isBookCoverPage(page) {
  return Boolean(page?.bookCover && getBookType(page.bookCover.typeId));
}

export function bookTypeHasSpine(type) {
  return Boolean(type?.spineFront);
}

// Spiral books can't be printed as one wrap-around cover.
export function bookTypeAllowsWholePage(type) {
  return Boolean(type) && type.binding !== "spiral";
}

// Where the back cover, spine and front cover sit on a whole-page cover
// (page units, left to right) — for the editor's area labels.
export function bookWrapRegions(page) {
  if (page?.bookCover?.side !== "wrap") return [];
  const spineWidth = page.bookCover.spineWidth || 0;
  const coverWidth = (page.width - spineWidth) / 2;
  return [
    { key: "back", x: 0, width: coverWidth },
    ...(spineWidth > 0 ? [{ key: "spine", x: coverWidth, width: spineWidth }] : []),
    { key: "front", x: coverWidth + spineWidth, width: coverWidth },
  ];
}

// The pages (and, for the whole-page layout, the locked guides marking the
// spine or fold) of a new book project. `layout` is "separate" or "wrap";
// spiral types ignore it.
export function createBookCoverPages({ typeId, sizeId, layout = "separate", names, guideLabels, extraPageFields = {} }) {
  const type = getBookType(typeId) || BOOK_TYPES[0];
  const trim = type.sizes.find((s) => s.id === sizeId) || type.sizes[0];
  const page = (side, width) => ({
    id: crypto.randomUUID(),
    name: names[side],
    width,
    height: trim.height,
    background: "#ffffff",
    ...extraPageFields,
    bookCover: { typeId: type.id, side },
  });
  const hasSpine = bookTypeHasSpine(type);
  const spineWidth = hasSpine ? Math.round(type.spineInches * PX_PER_IN) : 0;

  if (layout === "wrap" && bookTypeAllowsWholePage(type)) {
    const wrap = page("wrap", trim.width * 2 + spineWidth);
    wrap.bookCover.spineWidth = spineWidth;
    const edges = hasSpine ? [trim.width, trim.width + spineWidth] : [trim.width];
    const guides = edges.map((pos) =>
      createGuide({ pageId: wrap.id, orientation: "vertical", pos, locked: true, label: hasSpine ? guideLabels.spine : guideLabels.fold })
    );
    return { pages: [wrap], guides };
  }
  const covers = [page("front", trim.width), page("back", trim.width)];
  if (!hasSpine) return { pages: covers, guides: [] };
  // Horizontal, so text typed on it runs along the spine; the preview turns
  // it upright (top edge toward the front cover, reading top to bottom).
  const spine = { ...page("spine", trim.height), height: spineWidth };
  return { pages: [...covers, spine], guides: [] };
}

// A horizontal spine page's canvas turned 90° clockwise, so it reads top to
// bottom on the book with its top edge against the front cover. (A spine
// page that's already upright is used as is.)
function uprightSpine(canvas) {
  if (!canvas || canvas.height >= canvas.width) return canvas;
  const turned = document.createElement("canvas");
  turned.width = canvas.height;
  turned.height = canvas.width;
  const ctx = turned.getContext("2d");
  ctx.translate(turned.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(canvas, 0, 0);
  return turned;
}

const SIDE_ORDER = { wrap: 0, front: 0, back: 1, spine: 2 };

// Cuts a rendered one-page cover (back | spine | front) into its three
// parts, using the page's own spine width.
function sliceWrap(canvas, page) {
  const scale = canvas.width / page.width;
  const spineWidth = page.bookCover.spineWidth;
  const coverWidth = (page.width - spineWidth) / 2;
  const cut = (x, width) => {
    const part = document.createElement("canvas");
    part.width = Math.max(1, Math.round(width * scale));
    part.height = canvas.height;
    part.getContext("2d").drawImage(canvas, Math.round(x * scale), 0, part.width, canvas.height, 0, 0, part.width, canvas.height);
    return part;
  };
  return { backCanvas: cut(0, coverWidth), spineCanvas: cut(coverWidth, spineWidth), frontCanvas: cut(coverWidth + spineWidth, coverWidth) };
}

// Pixels darker than this inside a coil strip are the coils/holes/their
// shadows, not the plain white cover.
const COIL_MAX_LUMA = 175;
// The photos' backdrop is pure white; a spine's own lightest highlights stay
// below this.
const BACKDROP_MIN_LUMA = 252;

// One mockup-registry entry per book type: its pages are the ones tagged
// with that type, front cover first, then back, then spine (the preview
// maps pages[0]/pages[1]/pages[2] to the front/back/spine canvases). A
// one-page cover is cut into those three parts here.
export const BOOK_MOCKUP_TYPES = BOOK_TYPES.map((type) => ({
  id: `book-${type.id}`,
  isPage: (page) => page?.bookCover?.typeId === type.id,
  sortPages: (pages) => {
    const wrap = pages.find((page) => page.bookCover.side === "wrap");
    if (wrap) return [wrap];
    return [...pages].sort((a, b) => SIDE_ORDER[a.bookCover.side] - SIDE_ORDER[b.bookCover.side]);
  },
  variants: [
    {
      id: type.id,
      generate: ({ frontCanvas, backCanvas, spineCanvas, pages }) => {
        const parts = pages?.[0]?.bookCover?.side === "wrap" ? sliceWrap(frontCanvas, pages[0]) : { frontCanvas, backCanvas, spineCanvas };
        const spine = bookTypeHasSpine(type) ? uprightSpine(parts.spineCanvas) : null;
        return compositeMockup({
          imageUrl: bookMockupImageUrl(type.id),
          slots: [
            { quad: type.front, canvas: parts.frontCanvas, projective: true, keepDark: type.frontCoils && { polygon: type.frontCoils, maxLuma: COIL_MAX_LUMA } },
            { quad: type.back, canvas: parts.backCanvas, projective: true, keepDark: type.backCoils && { polygon: type.backCoils, maxLuma: COIL_MAX_LUMA } },
            spine && { quad: type.spineFront, canvas: spine, projective: true, keepBackground: { polygon: type.spineFront, minLuma: BACKDROP_MIN_LUMA } },
            spine && { quad: type.spineBack, canvas: spine, projective: true, keepBackground: { polygon: type.spineBack, minLuma: BACKDROP_MIN_LUMA } },
          ],
        });
      },
    },
  ],
}));
