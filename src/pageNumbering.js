// Project-level "page numbers" setting (Pages panel) — one on/off + corner
// choice applied to every page automatically (the number is always just
// that page's 1-based index, never stored per-item), mirroring how
// guides/snapToGuides is threaded through App.jsx: normalizeParsedWorkspace
// defaults it on load, buildCurrentProjectData carries it into every save/
// autosave/export path, and it renders as a plain non-interactive Konva
// label — never a real selectable/editable object.

export const PAGE_NUMBER_POSITIONS = ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"];

export const DEFAULT_PAGE_NUMBERS = { enabled: false, position: "bottom-right" };

export function normalizePageNumbers(value) {
  if (!value || typeof value !== "object") return { ...DEFAULT_PAGE_NUMBERS };
  const position = PAGE_NUMBER_POSITIONS.includes(value.position) ? value.position : DEFAULT_PAGE_NUMBERS.position;
  return { enabled: !!value.enabled, position };
}

const LABEL_MARGIN = 28;
const LABEL_WIDTH = 64;
export const PAGE_NUMBER_FONT_SIZE = 15;

// Konva <Text> props (x/y/width/align) for a page-number label at `position`
// on a page of the given size — shared by the live active-page render
// (App.jsx's renderActivePage) and every inactive-page preview
// (InactivePagePreview.jsx), so the two can never disagree on placement.
export function pageNumberPlacement(position, pageWidth, pageHeight) {
  const [vSide, hSide] = (position || DEFAULT_PAGE_NUMBERS.position).split("-");
  let x;
  let align;
  if (hSide === "left") {
    x = LABEL_MARGIN;
    align = "left";
  } else if (hSide === "right") {
    x = pageWidth - LABEL_MARGIN - LABEL_WIDTH;
    align = "right";
  } else {
    x = pageWidth / 2 - LABEL_WIDTH / 2;
    align = "center";
  }
  const y = vSide === "top" ? LABEL_MARGIN : pageHeight - LABEL_MARGIN - PAGE_NUMBER_FONT_SIZE;
  return { x, y, width: LABEL_WIDTH, align };
}
