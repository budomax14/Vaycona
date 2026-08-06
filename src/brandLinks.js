// Phase 11 — the link/fallback convention used everywhere a canvas object
// or page can reference a brand-kit resource.
//
// Design choice (see Phase 11 completion notes): a "linked" field is NOT a
// pointer resolved only at render time — it always ALSO carries the fully
// resolved literal value in the object's normal field (item.fill,
// item.fontFamily, page.background, ...), exactly as an unlinked/detached
// object would. The `*Ref` fields below are purely a secondary index used
// for "is this linked", "update linked usages", and "find usage" — no
// renderer (DesignNode/ShapeNode/TextNode/ImageNode/the page background
// Rect) needs to know brand kits exist at all. This is what makes fallback
// rendering (spec §67), project-package portability (spec §68), and
// version/recovery/template preservation (spec §76-80) all work for free:
// there is nothing to "resolve" when a brand kit or token goes missing,
// because the last-resolved value is already sitting in the normal field.

// --- generic dot-path get/set (only ever used for the small fixed set of
// paths below — not a general-purpose utility) ---

function getPath(obj, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function setPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  let cursor = obj;
  const rootCopy = { ...obj };
  let cursorCopy = rootCopy;
  for (const key of keys) {
    const nextCopy = { ...(cursor?.[key] || {}) };
    cursorCopy[key] = nextCopy;
    cursorCopy = nextCopy;
    cursor = cursor?.[key];
  }
  cursorCopy[last] = value;
  return rootCopy;
}

// Every color-bearing field path this app's object model actually has,
// keyed by the object `type` it applies to (or "any" for shared paths).
export const COLOR_FIELD_PATHS = {
  text: ["fill", "effects.shadow.color", "effects.glow.color", "effects.outline.color", "background.color", "border.color"],
  shape: ["fill", "stroke"],
  line: ["stroke"],
  icon: ["fill"],
  image: [],
  frame: [],
};

export function getColorLink(item, fieldPath) {
  return item?.colorLinks?.[fieldPath] || null;
}

export function setColorLink(item, fieldPath, ref /* {brandKitId, tokenId} | null */, resolvedHex) {
  let next = setPath(item, fieldPath, resolvedHex);
  const links = { ...(item.colorLinks || {}) };
  if (ref) links[fieldPath] = ref;
  else delete links[fieldPath];
  next = { ...next, colorLinks: links };
  return next;
}

export function detachColorLink(item, fieldPath) {
  if (!item.colorLinks?.[fieldPath]) return item;
  const links = { ...item.colorLinks };
  delete links[fieldPath];
  return { ...item, colorLinks: links };
}

export function readFieldValue(item, fieldPath) {
  return getPath(item, fieldPath);
}

// --- typography / object / image / background-style refs (top-level,
// single ref per object since only one style of each kind applies) ---

export function getStyleRef(item, refKey) {
  return item?.[refKey] || null;
}

export function setStyleRef(item, refKey, ref) {
  return { ...item, [refKey]: ref };
}

export function clearStyleRef(item, refKey) {
  if (!item[refKey]) return item;
  const next = { ...item };
  delete next[refKey];
  return next;
}

export const REF_KEYS = {
  typography: "typographyStyleRef",
  objectStyle: "objectStyleRef",
  imageStyle: "imageStyleRef",
  backgroundStyle: "backgroundStyleRef",
  gradient: "fillGradientRef",
  brandAsset: "brandAssetRef",
};

export function sameRef(a, b) {
  if (!a || !b) return false;
  return a.brandKitId === b.brandKitId && (a.tokenId ?? a.styleId ?? a.gradientId ?? a.resourceId) === (b.tokenId ?? b.styleId ?? b.gradientId ?? b.resourceId);
}
