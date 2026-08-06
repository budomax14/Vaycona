// Phase 11 — centralized Brand Kit architecture. The ONE place brand-kit
// IndexedDB records are read/written; UI components never touch IndexedDB
// directly (per phase rules). Mirrors templateService.js/
// versionHistoryService.js's open/withStore/requestToPromise/withChecksum
// conventions on purpose — same architecture, new store.
//
// A brand kit record holds every reusable-style "kind" (colors, palettes,
// fonts, typography, logos/graphics/icons, object/image/background styles,
// gradients, effect presets, themes, brand rules) as small inline arrays —
// unlike assets (real binaries), these are all plain JSON, so there's no
// separate metadata-vs-payload split needed the way assetStore.js needs
// one for image blobs. Logo/graphic/icon binaries themselves are NOT
// duplicated here — they live in the existing shared assetStore.js
// IndexedDB store (raster) or are stored as sanitized SVG text on the
// resource record itself (vector); brand kit records only ever hold a
// reference (assetId) or the sanitized SVG string, never a second copy of
// pixel data.

import {
  BRAND_DB_NAME,
  BRAND_STORE,
  BRAND_KIT_FORMAT_VERSION,
  ACTIVE_BRAND_KIT_KEY,
  MAX_BRAND_KIT_NAME_LENGTH,
  MAX_BRAND_KIT_DESCRIPTION_LENGTH,
  MAX_BRAND_TOKEN_NAME_LENGTH,
  MAX_BRAND_TAG_LENGTH,
} from "./constants";
import { checksumOf } from "./autosaveService";
import { parseColor, isValidColor, detectFormat } from "./brandColor";

let dbPromise = null;
function openBrandDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(BRAND_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BRAND_STORE)) {
        const store = db.createObjectStore(BRAND_STORE, { keyPath: "id" });
        store.createIndex("by_updatedAt", "updatedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function withStore(mode, fn) {
  return openBrandDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(BRAND_STORE, mode);
        const store = tx.objectStore(BRAND_STORE);
        const result = fn(store);
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withChecksum(record) {
  return { ...record, checksum: checksumOf(JSON.stringify(record)) };
}

export function isBrandKitShapeValid(kit) {
  if (!kit || typeof kit !== "object") return false;
  if (kit.brandKitFormatVersion !== BRAND_KIT_FORMAT_VERSION) return false;
  const { checksum, ...rest } = kit;
  if (!checksum || checksumOf(JSON.stringify(rest)) !== checksum) return false;
  return true;
}

// --- tiny pub-sub so live UI (sidebar/manager/color pickers) can react
// without polling — mirrors assetStore.js's assetEvents pattern.
const wildcardListeners = new Set();
export const brandKitEvents = {
  subscribe(cb) {
    wildcardListeners.add(cb);
    return () => wildcardListeners.delete(cb);
  },
  emit() {
    wildcardListeners.forEach((cb) => cb());
  },
};

function emitChange() {
  brandKitEvents.emit();
}

function nowStamp() {
  return Date.now();
}

function trimTo(value, max, fallback = "") {
  return (value ?? "").toString().trim().slice(0, max) || fallback;
}

function normalizeTags(tags) {
  const seen = new Set();
  const out = [];
  (tags || []).forEach((tag) => {
    const clean = trimTo(tag, MAX_BRAND_TAG_LENGTH, "").toLowerCase();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  });
  return out;
}

// --- brand kit CRUD ---

function emptyKitCollections() {
  return {
    colors: [],
    palettes: [],
    fonts: [],
    fontPairings: [],
    typography: [],
    logos: [],
    graphics: [],
    icons: [],
    objectStyles: [],
    imageStyles: [],
    gradients: [],
    backgroundStyles: [],
    effectPresets: [],
    themes: [],
  };
}

function defaultBrandRules() {
  return {
    minLogoSizePx: null,
    logoClearSpaceRatio: null,
    approvedBackgroundTypes: [],
    disallowStretch: true,
    headingFontId: null,
    bodyFontId: null,
    approvedColorIds: [],
    disallowedColorPairs: [],
  };
}

export async function createBrandKit({ name, description, protectedFlag = false } = {}) {
  const now = nowStamp();
  const kit = withChecksum({
    id: crypto.randomUUID(),
    brandKitFormatVersion: BRAND_KIT_FORMAT_VERSION,
    appVersion: "1.0.0",
    name: trimTo(name, MAX_BRAND_KIT_NAME_LENGTH, "Untitled brand kit"),
    description: description ? trimTo(description, MAX_BRAND_KIT_DESCRIPTION_LENGTH) : null,
    createdAt: now,
    updatedAt: now,
    favorite: false,
    protected: protectedFlag,
    usageCount: 0,
    lastUsedAt: null,
    ...emptyKitCollections(),
    brandRules: defaultBrandRules(),
    validationStatus: "ok",
    migrationMeta: null,
  });
  await withStore("readwrite", (store) => store.put(kit));
  emitChange();
  return kit;
}

// Metadata-only listing (spec §3/§12) — strips the token/style arrays so
// the manager's list view never pulls full payloads just to render cards.
// A summary still carries small preview-relevant counts + a few swatch
// values (cheap, already in the record) so cards can render a real color
// preview without a second full-record fetch.
export async function listBrandKitSummaries() {
  const all = await withStore("readonly", (store) => requestToPromise(store.getAll()));
  const resolved = await all;
  return resolved
    .map((kit) => {
      const {
        checksum, colors, palettes, fonts, fontPairings, typography, logos, graphics, icons,
        objectStyles, imageStyles, gradients, backgroundStyles, effectPresets, themes, brandRules,
        ...meta
      } = kit;
      return {
        ...meta,
        colorCount: colors.length,
        paletteCount: palettes.length,
        fontCount: fonts.length,
        typographyCount: typography.length,
        logoCount: logos.length,
        graphicCount: graphics.length,
        objectStyleCount: objectStyles.length,
        imageStyleCount: imageStyles.length,
        themeCount: themes.length,
        resourceCount:
          colors.length + palettes.length + fonts.length + typography.length + logos.length +
          graphics.length + icons.length + objectStyles.length + imageStyles.length +
          gradients.length + backgroundStyles.length + effectPresets.length + themes.length,
        colorPreview: colors.slice(0, 5).map((c) => c.hex),
        fontPreview: fonts.slice(0, 2).map((f) => f.name),
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getBrandKitById(id) {
  if (!id) return null;
  const record = await withStore("readonly", (store) => requestToPromise(store.get(id)));
  return (await record) || null;
}

export async function updateBrandKitMetadata(id, patch) {
  const existing = await getBrandKitById(id);
  if (!existing) return null;
  const next = withChecksum({
    ...existing,
    checksum: undefined,
    name: patch.name !== undefined ? trimTo(patch.name, MAX_BRAND_KIT_NAME_LENGTH, existing.name) : existing.name,
    description: patch.description !== undefined ? (patch.description ? trimTo(patch.description, MAX_BRAND_KIT_DESCRIPTION_LENGTH) : null) : existing.description,
    updatedAt: nowStamp(),
  });
  await withStore("readwrite", (store) => store.put(next));
  emitChange();
  return next;
}

export async function setBrandKitFavorite(id, favorite) {
  const existing = await getBrandKitById(id);
  if (!existing) return null;
  const next = withChecksum({ ...existing, checksum: undefined, favorite: !!favorite });
  await withStore("readwrite", (store) => store.put(next));
  emitChange();
  return next;
}

export async function deleteBrandKit(id) {
  const existing = await getBrandKitById(id);
  if (existing?.protected) return false;
  await withStore("readwrite", (store) => store.delete(id));
  if (getActiveBrandKitId() === id) clearActiveBrandKit();
  emitChange();
  return true;
}

export async function duplicateBrandKit(id) {
  const existing = await getBrandKitById(id);
  if (!existing) return null;
  const now = nowStamp();
  const remapIds = (list) => (list || []).map((r) => ({ ...r, id: crypto.randomUUID() }));
  // Sub-resources get fresh IDs (spec §74), but cross-references WITHIN the
  // kit (palette -> colorIds, theme -> colorIds/typographyIds, etc.) must
  // still resolve after the remap — build old-id -> new-id maps first, per
  // collection, then rewrite every reference in one pass.
  const idMaps = {};
  const collections = ["colors", "palettes", "fonts", "fontPairings", "typography", "logos", "graphics", "icons", "objectStyles", "imageStyles", "gradients", "backgroundStyles", "effectPresets", "themes"];
  const remapped = {};
  collections.forEach((key) => {
    const map = new Map();
    remapped[key] = (existing[key] || []).map((r) => {
      const newId = crypto.randomUUID();
      map.set(r.id, newId);
      return { ...r, id: newId };
    });
    idMaps[key] = map;
  });

  const remapRef = (key, refId) => (refId ? idMaps[key]?.get(refId) ?? refId : refId);
  remapped.palettes = remapped.palettes.map((p) => ({ ...p, colorIds: (p.colorIds || []).map((cid) => remapRef("colors", cid)) }));
  remapped.typography = remapped.typography.map((t) => ({ ...t, fontId: remapRef("fonts", t.fontId), colorId: remapRef("colors", t.colorId) }));
  remapped.gradients = remapped.gradients.map((g) => ({ ...g, stops: (g.stops || []).map((s) => ({ ...s, colorId: remapRef("colors", s.colorId) })) }));
  remapped.backgroundStyles = remapped.backgroundStyles.map((b) => ({ ...b, colorId: remapRef("colors", b.colorId), gradientId: remapRef("gradients", b.gradientId) }));
  remapped.themes = remapped.themes.map((t) => ({
    ...t,
    primaryColorId: remapRef("colors", t.primaryColorId),
    secondaryColorId: remapRef("colors", t.secondaryColorId),
    accentColorId: remapRef("colors", t.accentColorId),
    backgroundColorId: remapRef("colors", t.backgroundColorId),
    textColorId: remapRef("colors", t.textColorId),
    headingTypographyId: remapRef("typography", t.headingTypographyId),
    bodyTypographyId: remapRef("typography", t.bodyTypographyId),
    buttonObjectStyleId: remapRef("objectStyles", t.buttonObjectStyleId),
    shapeObjectStyleId: remapRef("objectStyles", t.shapeObjectStyleId),
    backgroundStyleId: remapRef("backgroundStyles", t.backgroundStyleId),
    effectPresetId: remapRef("effectPresets", t.effectPresetId),
  }));

  const duplicate = withChecksum({
    ...existing,
    ...remapped,
    checksum: undefined,
    id: crypto.randomUUID(),
    name: `${existing.name} copy`,
    protected: false,
    favorite: false,
    usageCount: 0,
    lastUsedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  await withStore("readwrite", (store) => store.put(duplicate));
  emitChange();
  return duplicate;
}

export async function recordBrandKitUsed(id) {
  const existing = await getBrandKitById(id);
  if (!existing) return;
  const next = withChecksum({ ...existing, checksum: undefined, usageCount: (existing.usageCount || 0) + 1, lastUsedAt: nowStamp() });
  await withStore("readwrite", (store) => store.put(next));
  emitChange();
}

// --- active brand kit (localStorage — small, synchronous, one global
// pointer; spec §5 "only one kit needs to be active by default") ---

export function getActiveBrandKitId() {
  try {
    return localStorage.getItem(ACTIVE_BRAND_KIT_KEY) || null;
  } catch {
    return null;
  }
}

export function setActiveBrandKitId(id) {
  try {
    if (id) localStorage.setItem(ACTIVE_BRAND_KIT_KEY, id);
    else localStorage.removeItem(ACTIVE_BRAND_KIT_KEY);
  } catch {
    // best-effort — active-kit pointer is a convenience, not durable state
  }
  emitChange();
}

export function clearActiveBrandKit() {
  setActiveBrandKitId(null);
}

export async function getActiveBrandKit() {
  const id = getActiveBrandKitId();
  if (!id) return null;
  const kit = await getBrandKitById(id);
  return kit || null;
}

// --- generic sub-resource CRUD (spec §2's add/duplicate/list/etc, one
// implementation shared by every collection kind rather than 14 near-
// identical modules) ---

async function mutateKit(brandKitId, mutator) {
  const existing = await getBrandKitById(brandKitId);
  if (!existing) return null;
  const next = withChecksum({ ...mutator({ ...existing }), checksum: undefined, updatedAt: nowStamp() });
  await withStore("readwrite", (store) => store.put(next));
  emitChange();
  return next;
}

export async function addResource(brandKitId, collectionKey, resource) {
  return mutateKit(brandKitId, (kit) => ({ ...kit, [collectionKey]: [...(kit[collectionKey] || []), resource] }));
}

export async function updateResource(brandKitId, collectionKey, resourceId, patch) {
  return mutateKit(brandKitId, (kit) => ({
    ...kit,
    [collectionKey]: (kit[collectionKey] || []).map((r) => (r.id === resourceId ? { ...r, ...patch, updatedAt: nowStamp() } : r)),
  }));
}

export async function deleteResource(brandKitId, collectionKey, resourceId) {
  return mutateKit(brandKitId, (kit) => ({
    ...kit,
    [collectionKey]: (kit[collectionKey] || []).filter((r) => r.id !== resourceId),
  }));
}

export async function reorderResources(brandKitId, collectionKey, orderedIds) {
  return mutateKit(brandKitId, (kit) => {
    const byId = new Map((kit[collectionKey] || []).map((r) => [r.id, r]));
    const reordered = orderedIds.map((id) => byId.get(id)).filter(Boolean);
    // Anything not present in orderedIds (shouldn't normally happen) is
    // appended rather than silently dropped.
    const remaining = (kit[collectionKey] || []).filter((r) => !orderedIds.includes(r.id));
    return { ...kit, [collectionKey]: [...reordered, ...remaining] };
  });
}

export async function duplicateResource(brandKitId, collectionKey, resourceId, nameSuffix = " copy") {
  const kit = await getBrandKitById(brandKitId);
  const source = kit?.[collectionKey]?.find((r) => r.id === resourceId);
  if (!source) return null;
  const copy = { ...source, id: crypto.randomUUID(), name: `${source.name}${nameSuffix}`, favorite: false };
  return addResource(brandKitId, collectionKey, copy);
}

export async function setResourceFavorite(brandKitId, collectionKey, resourceId, favorite) {
  return updateResource(brandKitId, collectionKey, resourceId, { favorite: !!favorite });
}

// --- typed creation helpers (validation + sane defaults per resource kind) ---

export function createColorToken({ name, value, role = "custom", description } = {}) {
  if (!isValidColor(value)) throw new Error("Invalid color value.");
  const parsed = parseColor(value);
  const format = detectFormat(value) || "hex";
  const now = nowStamp();
  return {
    id: crypto.randomUUID(),
    name: trimTo(name, MAX_BRAND_TOKEN_NAME_LENGTH, "Color"),
    value: parsed,
    hex: `#${[parsed.r, parsed.g, parsed.b].map((n) => n.toString(16).padStart(2, "0")).join("")}`,
    alpha: parsed.a,
    format,
    role,
    description: description ? trimTo(description, 200) : null,
    favorite: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function createPalette({ name, colorIds = [], description } = {}) {
  const now = nowStamp();
  return {
    id: crypto.randomUUID(),
    name: trimTo(name, MAX_BRAND_TOKEN_NAME_LENGTH, "Palette"),
    description: description ? trimTo(description, 200) : null,
    colorIds: [...colorIds],
    favorite: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function createFontToken({ name, family, cssStack, role = "custom", weights = ["400"], styles = ["normal"], sourceType = "system", fallback = "sans-serif" } = {}) {
  const now = nowStamp();
  return {
    id: crypto.randomUUID(),
    name: trimTo(name || family, MAX_BRAND_TOKEN_NAME_LENGTH, "Font"),
    family,
    cssStack: cssStack || family,
    role,
    weights,
    styles,
    sourceType, // "system" | "bundled" | "upload"
    fallback,
    status: "available",
    licenseNote: sourceType === "upload" ? "User-provided — licensing is the uploader's responsibility." : null,
    validationStatus: "ok",
    favorite: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function createTypographyToken({ name, fontId, fontFamilyFallback = "Arial", fontSize = 16, fontWeight = "normal", fontStyle = "normal", lineHeight = 1.3, letterSpacing = 0, textTransform = "none", colorId = null, align = "left", paragraphSpacing = 0, decoration = "none" } = {}) {
  const now = nowStamp();
  return {
    id: crypto.randomUUID(),
    name: trimTo(name, MAX_BRAND_TOKEN_NAME_LENGTH, "Text style"),
    fontId,
    // Fallback literal (spec §67) — used when fontId is unset/unresolved
    // (e.g. the item's own font family didn't match any brand font token
    // when the style was created from a selection) so the style still
    // renders a sensible font instead of silently defaulting to Arial.
    fontFamilyFallback,
    fontSize, fontWeight, fontStyle, lineHeight, letterSpacing, textTransform, colorId, align, paragraphSpacing, decoration,
    favorite: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function createLogoResource({ assetId, name, variant = "primary", backgroundSuitability = "light", colorMode = "full-color", fileType, width, height, transparency = false, tags = [], isSvg = false, svgContent = null }) {
  const now = nowStamp();
  return {
    id: crypto.randomUUID(),
    assetId: assetId || null,
    isSvg,
    svgContent: isSvg ? svgContent : null,
    name: trimTo(name, MAX_BRAND_TOKEN_NAME_LENGTH, "Logo"),
    variant, // primary | secondary | icon | wordmark | horizontal | vertical | light-bg | dark-bg | monochrome | custom
    backgroundSuitability, // light | dark | both
    colorMode,
    fileType,
    width: width || null,
    height: height || null,
    aspectRatio: width && height ? width / height : null,
    transparency,
    favorite: false,
    tags: normalizeTags(tags),
    createdAt: now,
    updatedAt: now,
  };
}

export function createGraphicResource({ assetId, name, category = "decorative", tags = [], isSvg = false, svgContent = null }) {
  const now = nowStamp();
  return {
    id: crypto.randomUUID(),
    assetId: assetId || null,
    isSvg,
    svgContent: isSvg ? svgContent : null,
    name: trimTo(name, MAX_BRAND_TOKEN_NAME_LENGTH, "Graphic"),
    category,
    favorite: false,
    tags: normalizeTags(tags),
    createdAt: now,
  };
}

export function createIconResource({ iconName, assetId, name, category = "custom", tags = [], colorable = true }) {
  const now = nowStamp();
  return {
    id: crypto.randomUUID(),
    iconName: iconName || null, // references the built-in iconCatalog when set
    assetId: assetId || null, // or a custom uploaded vector/raster icon
    name: trimTo(name, MAX_BRAND_TOKEN_NAME_LENGTH, "Icon"),
    category,
    colorable,
    favorite: false,
    tags: normalizeTags(tags),
    createdAt: now,
  };
}

const OBJECT_STYLE_APPLIES_TO = ["shape", "line", "icon", "frame"];
export function createObjectStyle({ name, category = "shape", appliesTo = OBJECT_STYLE_APPLIES_TO, props = {} } = {}) {
  const now = nowStamp();
  return {
    id: crypto.randomUUID(),
    name: trimTo(name, MAX_BRAND_TOKEN_NAME_LENGTH, "Object style"),
    category,
    appliesTo,
    props: {
      fill: props.fill ?? null,
      fillColorId: props.fillColorId ?? null,
      stroke: props.stroke ?? null,
      strokeColorId: props.strokeColorId ?? null,
      strokeWidth: props.strokeWidth ?? null,
      cornerRadius: props.cornerRadius ?? null,
      opacity: props.opacity ?? null,
      shadow: props.shadow ?? null,
      glow: props.glow ?? null,
      effects: props.effects ?? null,
    },
    favorite: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function createImageStyle({ name, adjustments = {}, border = null, cornerRadius = null, shadow = null, opacity = null } = {}) {
  const now = nowStamp();
  return {
    id: crypto.randomUUID(),
    name: trimTo(name, MAX_BRAND_TOKEN_NAME_LENGTH, "Image style"),
    adjustments,
    border,
    cornerRadius,
    shadow,
    opacity,
    favorite: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function createGradientToken({ name, type = "linear", angle = 90, stops = [], opacity = 1 } = {}) {
  const now = nowStamp();
  return {
    id: crypto.randomUUID(),
    name: trimTo(name, MAX_BRAND_TOKEN_NAME_LENGTH, "Gradient"),
    type, // "linear" | "radial"
    angle,
    stops: stops.map((s) => ({ color: s.color, position: Math.min(1, Math.max(0, s.position ?? 0)), colorId: s.colorId ?? null })),
    opacity,
    favorite: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function createBackgroundStyle({ name, kind = "solid", colorId = null, color = null, gradientId = null, assetId = null, opacity = 1, overlayColor = null, fit = "cover" } = {}) {
  const now = nowStamp();
  return {
    id: crypto.randomUUID(),
    name: trimTo(name, MAX_BRAND_TOKEN_NAME_LENGTH, "Background"),
    kind, // "solid" | "gradient" | "image"
    colorId,
    color,
    gradientId,
    assetId,
    opacity,
    overlayColor,
    fit,
    favorite: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function createEffectPreset({ name, shadow = null, glow = null, outline = null, blur = 0, opacity = 1, border = null } = {}) {
  const now = nowStamp();
  return {
    id: crypto.randomUUID(),
    name: trimTo(name, MAX_BRAND_TOKEN_NAME_LENGTH, "Effect"),
    shadow, glow, outline, blur, opacity, border,
    favorite: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function createTheme({ name, primaryColorId, secondaryColorId, accentColorId, backgroundColorId, textColorId, headingTypographyId, bodyTypographyId, buttonObjectStyleId, shapeObjectStyleId, backgroundStyleId, effectPresetId } = {}) {
  const now = nowStamp();
  return {
    id: crypto.randomUUID(),
    name: trimTo(name, MAX_BRAND_TOKEN_NAME_LENGTH, "Theme"),
    primaryColorId: primaryColorId ?? null,
    secondaryColorId: secondaryColorId ?? null,
    accentColorId: accentColorId ?? null,
    backgroundColorId: backgroundColorId ?? null,
    textColorId: textColorId ?? null,
    headingTypographyId: headingTypographyId ?? null,
    bodyTypographyId: bodyTypographyId ?? null,
    buttonObjectStyleId: buttonObjectStyleId ?? null,
    shapeObjectStyleId: shapeObjectStyleId ?? null,
    backgroundStyleId: backgroundStyleId ?? null,
    effectPresetId: effectPresetId ?? null,
    favorite: false,
    createdAt: now,
    updatedAt: now,
  };
}

// --- resolution helpers (token id -> concrete render-ready value) ---

export function resolveColor(kit, colorId) {
  if (!kit || !colorId) return null;
  return kit.colors.find((c) => c.id === colorId) || null;
}

export function resolveGradient(kit, gradientId) {
  if (!kit || !gradientId) return null;
  const gradient = kit.gradients.find((g) => g.id === gradientId);
  if (!gradient) return null;
  return {
    ...gradient,
    stops: gradient.stops.map((s) => ({
      position: s.position,
      color: s.colorId ? resolveColor(kit, s.colorId)?.hex || s.color : s.color,
    })),
  };
}

export function resolveTypography(kit, typographyId) {
  if (!kit || !typographyId) return null;
  const style = kit.typography.find((t) => t.id === typographyId);
  if (!style) return null;
  const font = kit.fonts.find((f) => f.id === style.fontId);
  const color = resolveColor(kit, style.colorId);
  const fallback = style.fontFamilyFallback || "Arial";
  return {
    ...style,
    fontFamily: font?.cssStack || font?.family || fallback,
    fontFamilyName: font?.family || fallback,
    fill: color?.hex || null,
  };
}

export function findBrandKitCollectionKeyForResource(kit, resourceId) {
  const collections = ["colors", "palettes", "fonts", "fontPairings", "typography", "logos", "graphics", "icons", "objectStyles", "imageStyles", "gradients", "backgroundStyles", "effectPresets", "themes"];
  for (const key of collections) {
    if ((kit[key] || []).some((r) => r.id === resourceId)) return key;
  }
  return null;
}

export const BRAND_RESOURCE_COLLECTIONS = ["colors", "palettes", "fonts", "fontPairings", "typography", "logos", "graphics", "icons", "objectStyles", "imageStyles", "gradients", "backgroundStyles", "effectPresets", "themes"];
