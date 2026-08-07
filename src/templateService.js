// Centralized local template + reusable-content service (Phase 8). One
// IndexedDB store holds three related "kinds" of reusable content —
// `project` (a full multi-page template), `page` (one reusable page), and
// `section` (a reusable object selection) — since they share almost all
// of the same metadata/retrieval/favorite/usage machinery and the spec
// explicitly asks not to build several conflicting systems. UI components
// never touch IndexedDB directly; everything goes through this module.
//
// Mirrors recoveryService.js/versionHistoryService.js's open/withStore/
// checksum conventions on purpose.

import { checksumOf } from "./autosaveService";
import { PROJECT_SCHEMA_VERSION } from "./constants";
import { BUILT_IN_TEMPLATES } from "./builtinTemplates";
import { validateProject } from "./projectValidator";
import { publishTemplateToCloud, removeTemplateFromCloud } from "./firestoreTemplates";

// Published "project" templates additionally mirror to Firestore (see
// firestoreTemplates.js) so every user's browser sees admin changes live —
// personal reusable content (page/section kinds, drafts) never does.
function isCloudSynced(template) {
  return template?.kind === "project" && !template.builtIn;
}

const TEMPLATE_DB_NAME = "personal-canva-templates-v1";
const TEMPLATE_STORE = "templates";
export const TEMPLATE_FORMAT_VERSION = 1;
export const BUILT_IN_SEED_VERSION = 2; // bumped for the personal_canva_template_starter_pack/ 50-template addition
const SEED_FLAG_KEY = "personal-canva-templates-seed-v1";
const RECENT_TEMPLATES_KEY = "personal-canva-recent-templates-v1";
export const MAX_RECENT_TEMPLATES = 15;
export const MAX_TEMPLATE_NAME_LENGTH = 80;
export const MAX_TEMPLATE_DESCRIPTION_LENGTH = 500;

// Stable internal category values + labels (spec §7) — the one place
// category filtering options come from, so the browser UI never
// hardcodes its own list.
export const TEMPLATE_CATEGORIES = [
  { key: "social", label: "Social media" },
  { key: "invitations", label: "Invitations" },
  { key: "business", label: "Business" },
  { key: "marketing", label: "Marketing" },
  { key: "print", label: "Print" },
  { key: "education", label: "Education" },
  { key: "personal", label: "Personal" },
  { key: "events", label: "Events" },
  { key: "books", label: "Books" },
  { key: "video", label: "Video thumbnails" },
  { key: "documents", label: "Documents" },
];

let dbPromise = null;
function openTemplateDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(TEMPLATE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TEMPLATE_STORE)) {
        const store = db.createObjectStore(TEMPLATE_STORE, { keyPath: "id" });
        store.createIndex("by_kind", "kind", { unique: false });
        store.createIndex("by_updatedAt", "updatedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function withStore(mode, fn) {
  return openTemplateDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(TEMPLATE_STORE, mode);
        const store = tx.objectStore(TEMPLATE_STORE);
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

export function isTemplateShapeValid(template) {
  if (!template || typeof template !== "object") return false;
  if (template.templateFormatVersion !== TEMPLATE_FORMAT_VERSION) return false;
  if (!template.data) return false;
  const { checksum, ...rest } = template;
  if (!checksum || checksumOf(JSON.stringify(rest)) !== checksum) return false;
  return true;
}

// A tiny, trimmed-down preview (first page + up to 15 items, only the
// fields TemplateMiniPreview.jsx actually reads) stored as a SIBLING of
// `data`, not nested inside it — so it survives listTemplateSummaries()'s
// `{ data, checksum, ...meta }` strip and the browser grid can show a real
// (not fake) preview without ever loading the full payload (spec §3/§15).
const PREVIEW_ITEM_FIELDS = [
  "id",
  "pageId",
  "type",
  "x",
  "y",
  "width",
  "height",
  "rotation",
  "opacity",
  "hidden",
  "fill",
  "text",
  "fontSize",
  "fontWeight",
  "align",
  "shapeKind",
  "cornerRadius",
];

// `data` shape differs by kind: "project" has `pages`/`items`, "page" has
// a single `page`/`items`, "section" has only `items`/`bounds` (no page at
// all — a synthetic one is derived from bounds purely for the preview's
// aspect ratio/background).
function buildPreviewSnapshot(data) {
  if (!data) return null;
  // "project" data is the only shape where multiple pages' items are ever
  // mixed in one array, so it's the only case worth filtering by pageId —
  // "page" and "section" data already contain exactly their own items.
  const isMultiPage = Array.isArray(data.pages);
  const page = data.pages?.[0] || data.page || (data.bounds ? { id: "section", width: data.bounds.width, height: data.bounds.height, background: "#ffffff" } : null);
  if (!page) return null;
  const items = (data.items || [])
    .filter((it) => !isMultiPage || it.pageId === page.id)
    .slice(0, 15)
    // pageId is force-set to the (possibly synthetic, for a section)
    // preview page's own id — TemplateMiniPreview.jsx filters items by
    // `it.pageId === page.id`, and a section's items still carry their
    // ORIGINAL real page's id, which would otherwise fail that filter.
    .map((it) => ({ ...PREVIEW_ITEM_FIELDS.reduce((acc, key) => ((acc[key] = it[key]), acc), {}), pageId: page.id }));
  return { page: { id: page.id, width: page.width, height: page.height, background: page.background || "#ffffff" }, items };
}

function normalizeTags(tags) {
  const seen = new Set();
  const out = [];
  (tags || []).forEach((tag) => {
    const clean = (tag || "").trim().toLowerCase();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  });
  return out;
}

// --- create / update ---

// `status`/`createdBy` (Template Management Admin) — every existing caller
// (handleSaveAsTemplate, the reusable-page/section flows) keeps getting an
// instantly-usable "published" template by default, exactly like before
// this feature existed; only the admin dashboard's create flow ever passes
// status:"draft".
export async function createTemplate({
  kind, // "project" | "page" | "section"
  name,
  description,
  category,
  tags,
  data,
  assetIds,
  pageCount = 1,
  objectCount = 0,
  groupCount = 0,
  pageWidth,
  pageHeight,
  thumbnail = null,
  createdFromProjectId = null,
  builtIn = false,
  protectedFlag = false,
  status = "published",
  createdBy = "user",
  tier = "free",
}) {
  const now = Date.now();
  const template = withChecksum({
    id: crypto.randomUUID(),
    kind,
    templateFormatVersion: TEMPLATE_FORMAT_VERSION,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    name: (name || "").trim().slice(0, MAX_TEMPLATE_NAME_LENGTH) || "Untitled",
    description: (description || "").trim().slice(0, MAX_TEMPLATE_DESCRIPTION_LENGTH) || null,
    category: category || "personal",
    tags: normalizeTags(tags),
    createdAt: now,
    updatedAt: now,
    createdFromProjectId,
    pageCount,
    objectCount,
    groupCount,
    assetCount: (assetIds || []).length,
    pageWidth: pageWidth ?? null,
    pageHeight: pageHeight ?? null,
    thumbnail,
    previewSnapshot: buildPreviewSnapshot(data),
    data,
    assetIds: assetIds || [],
    favorite: false,
    usageCount: 0,
    lastUsedAt: null,
    builtIn,
    protected: protectedFlag,
    validationStatus: "ok",
    status,
    publishedAt: status === "published" ? now : null,
    createdBy,
    tier,
  });
  await withStore("readwrite", (store) => store.put(template));
  return template;
}

// Metadata-only-ish update (name/description/category/tags/favorite) — spec
// §27/§49: never rewrites the full payload or touches the checksum's
// covered content beyond these fields, and never regenerates the
// thumbnail just because of this.
export async function updateTemplateMetadata(id, patch) {
  const existing = await getTemplateById(id);
  if (!existing || existing.builtIn) return null;
  const next = withChecksum({
    ...existing,
    checksum: undefined,
    name: patch.name !== undefined ? (patch.name || "").trim().slice(0, MAX_TEMPLATE_NAME_LENGTH) || existing.name : existing.name,
    description: patch.description !== undefined ? (patch.description || "").trim().slice(0, MAX_TEMPLATE_DESCRIPTION_LENGTH) || null : existing.description,
    category: patch.category ?? existing.category,
    tags: patch.tags !== undefined ? normalizeTags(patch.tags) : existing.tags,
    updatedAt: Date.now(),
  });
  await withStore("readwrite", (store) => store.put(next));
  return next;
}

// Admin "Template settings" dialog (AdminTemplateFormDialog, edit mode) —
// like updateTemplateMetadata above, but also covers the two fields that
// dialog additionally exposes: background color (folded into the page
// inside `data`, the one place background already lives — see
// builtinTemplates.js's `page()`helper) and a manually-uploaded thumbnail.
// Status is deliberately NOT handled here — publishing has its own
// validation (see publishTemplate/unpublishTemplate below) and must not be
// silently grantable through a generic metadata patch.
export async function updateTemplateSettings(id, { name, description, category, tags, background, thumbnail, tier }) {
  const existing = await getTemplateById(id);
  if (!existing) return null;
  const data =
    background !== undefined && existing.data?.pages?.length
      ? { ...existing.data, pages: existing.data.pages.map((page, i) => (i === 0 ? { ...page, background } : page)) }
      : existing.data;
  const next = withChecksum({
    ...existing,
    checksum: undefined,
    name: name !== undefined ? (name || "").trim().slice(0, MAX_TEMPLATE_NAME_LENGTH) || existing.name : existing.name,
    description: description !== undefined ? (description || "").trim().slice(0, MAX_TEMPLATE_DESCRIPTION_LENGTH) || null : existing.description,
    category: category ?? existing.category,
    tags: tags !== undefined ? normalizeTags(tags) : existing.tags,
    tier: tier ?? existing.tier ?? "free",
    data,
    previewSnapshot: data !== existing.data ? buildPreviewSnapshot(data) : existing.previewSnapshot,
    thumbnail: thumbnail !== undefined ? thumbnail : existing.thumbnail,
    updatedAt: Date.now(),
  });
  await withStore("readwrite", (store) => store.put(next));
  if (isCloudSynced(next) && next.status === "published") await publishTemplateToCloud(next);
  return next;
}

export async function setTemplateFavorite(id, favorite) {
  const existing = await getTemplateById(id);
  if (!existing) return null;
  const next = withChecksum({ ...existing, checksum: undefined, favorite: !!favorite });
  await withStore("readwrite", (store) => store.put(next));
  return next;
}

// Full payload replacement for an existing user template (spec §25) —
// keeps the same id/created metadata, bumps updatedAt, regenerates the
// checksum. Caller is responsible for creating a backup beforehand if it
// wants one (App.jsx does, via a plain getTemplateById snapshot kept in a
// ref until this resolves).
export async function updateTemplatePayload(id, { data, assetIds, pageCount, objectCount, groupCount, thumbnail, pageWidth, pageHeight }) {
  const existing = await getTemplateById(id);
  if (!existing) return null;
  const next = withChecksum({
    ...existing,
    checksum: undefined,
    data,
    previewSnapshot: buildPreviewSnapshot(data),
    assetIds: assetIds || [],
    assetCount: (assetIds || []).length,
    pageCount: pageCount ?? existing.pageCount,
    objectCount: objectCount ?? existing.objectCount,
    groupCount: groupCount ?? existing.groupCount,
    thumbnail: thumbnail ?? existing.thumbnail,
    pageWidth: pageWidth ?? data?.pages?.[0]?.width ?? existing.pageWidth,
    pageHeight: pageHeight ?? data?.pages?.[0]?.height ?? existing.pageHeight,
    updatedAt: Date.now(),
  });
  await withStore("readwrite", (store) => store.put(next));
  if (isCloudSynced(next) && next.status === "published") await publishTemplateToCloud(next);
  return next;
}

// --- publish workflow (Template Management Admin) ---

// Mirrors handleSaveAsTemplate's own validation in App.jsx: a template
// can't go live with no name, no content, or no thumbnail. Returns a
// human-readable reason so the UI can show *why* Publish is blocked rather
// than failing silently.
export function templatePublishBlockedReason(template) {
  if (!template?.name?.trim()) return "Give this template a name before publishing.";
  const report = validateProject(template.data);
  if (report.status === "fatal" || !(template.data?.items?.length > 0)) {
    return "This template's canvas is empty or invalid. Add content before publishing.";
  }
  if (!template.thumbnail) {
    return "A thumbnail couldn't be generated. Add content to the canvas or upload a cover image.";
  }
  return null;
}

// Publishing makes a template immediately visible in the end-user gallery
// (App.jsx's refreshTemplateLists() filters to status:"published" on every
// open, so there's no separate cache to invalidate). Unpublishing hides it
// from the gallery without deleting it — anyone who already used it keeps
// their own independent copy regardless (see idRemap.js's
// cloneWorkspaceDataWithNewIds, used by useTemplate()).
export async function publishTemplate(id) {
  const existing = await getTemplateById(id);
  if (!existing) return { ok: false, error: "Template not found." };
  if (existing.builtIn) return { ok: false, error: "Built-in templates are always published and can't be changed here." };
  const reason = templatePublishBlockedReason(existing);
  if (reason) return { ok: false, error: reason };
  const next = withChecksum({ ...existing, checksum: undefined, status: "published", publishedAt: Date.now() });
  await withStore("readwrite", (store) => store.put(next));
  if (isCloudSynced(next)) await publishTemplateToCloud(next);
  return { ok: true, template: next };
}

export async function unpublishTemplate(id) {
  const existing = await getTemplateById(id);
  if (!existing || existing.builtIn) return null;
  const next = withChecksum({ ...existing, checksum: undefined, status: "draft", publishedAt: null });
  await withStore("readwrite", (store) => store.put(next));
  if (isCloudSynced(next)) await removeTemplateFromCloud(id);
  return next;
}

// --- read ---

// Metadata-only listing (no `data` payload) — spec §3/§11/§52.
export async function listTemplateSummaries(kind) {
  const all = await withStore("readonly", (store) => {
    if (kind) {
      const index = store.index("by_kind");
      return requestToPromise(index.getAll(kind));
    }
    return requestToPromise(store.getAll());
  });
  const resolved = await all;
  return resolved.map(({ data, checksum, ...meta }) => meta).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getTemplateById(id) {
  if (!id) return null;
  const record = await withStore("readonly", (store) => requestToPromise(store.get(id)));
  return (await record) || null;
}

export async function deleteTemplate(id) {
  const existing = await getTemplateById(id);
  if (existing?.builtIn || existing?.protected) return false;
  await withStore("readwrite", (store) => store.delete(id));
  await removeFromRecent(id);
  if (isCloudSynced(existing) && existing.status === "published") await removeTemplateFromCloud(id);
  return true;
}

export async function duplicateTemplate(id) {
  const existing = await getTemplateById(id);
  if (!existing) return null;
  const now = Date.now();
  const duplicate = withChecksum({
    ...existing,
    checksum: undefined,
    id: crypto.randomUUID(),
    name: `${existing.name} copy`,
    builtIn: false,
    protected: false,
    favorite: false,
    usageCount: 0,
    lastUsedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  await withStore("readwrite", (store) => store.put(duplicate));
  return duplicate;
}

// --- usage tracking (spec §30/§50 — only after a successful use) ---

export async function recordTemplateUsed(id) {
  const existing = await getTemplateById(id);
  if (!existing) return;
  const next = withChecksum({
    ...existing,
    checksum: undefined,
    usageCount: (existing.usageCount || 0) + 1,
    lastUsedAt: Date.now(),
  });
  await withStore("readwrite", (store) => store.put(next));

  try {
    const raw = localStorage.getItem(RECENT_TEMPLATES_KEY);
    const recent = raw ? JSON.parse(raw) : [];
    const filtered = recent.filter((entry) => entry.id !== id);
    filtered.unshift({ id, lastUsedAt: next.lastUsedAt });
    localStorage.setItem(RECENT_TEMPLATES_KEY, JSON.stringify(filtered.slice(0, MAX_RECENT_TEMPLATES)));
  } catch {
    // Recent-list tracking is a convenience, not required for correctness.
  }
}

export function listRecentTemplateIds() {
  try {
    const raw = localStorage.getItem(RECENT_TEMPLATES_KEY);
    return raw ? JSON.parse(raw).map((entry) => entry.id) : [];
  } catch {
    return [];
  }
}

async function removeFromRecent(id) {
  try {
    const raw = localStorage.getItem(RECENT_TEMPLATES_KEY);
    if (!raw) return;
    const recent = JSON.parse(raw).filter((entry) => entry.id !== id);
    localStorage.setItem(RECENT_TEMPLATES_KEY, JSON.stringify(recent));
  } catch {
    // best-effort
  }
}

// --- built-in seeding (spec §42 — never reseeds duplicates) ---

// Module-level guard against a double-invoked caller (React 18 StrictMode
// runs mount effects twice in dev) racing the same read-then-write check
// and each independently deciding "not seeded yet" before either has
// finished — without this, both would insert the full built-in set.
let seedingPromise = null;

export function ensureBuiltInTemplatesSeeded() {
  if (!seedingPromise) seedingPromise = seedBuiltInTemplatesOnce();
  return seedingPromise;
}

async function seedBuiltInTemplatesOnce() {
  const seededVersion = Number(localStorage.getItem(SEED_FLAG_KEY) || 0);
  if (seededVersion >= BUILT_IN_SEED_VERSION) return;

  const existingBuiltIns = await listTemplateSummaries("project");
  const existingIds = new Set(existingBuiltIns.filter((t) => t.builtIn).map((t) => t.builtInKey));

  for (const seed of BUILT_IN_TEMPLATES) {
    if (existingIds.has(seed.builtInKey)) continue;
    const now = Date.now();
    const template = withChecksum({
      id: crypto.randomUUID(),
      builtInKey: seed.builtInKey,
      kind: "project",
      templateFormatVersion: TEMPLATE_FORMAT_VERSION,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      name: seed.name,
      description: seed.description || null,
      category: seed.category,
      tags: normalizeTags(seed.tags),
      createdAt: now,
      updatedAt: now,
      createdFromProjectId: null,
      pageCount: seed.data.pages.length,
      objectCount: seed.data.items.length,
      groupCount: seed.data.items.filter((it) => it.type === "group").length,
      assetCount: 0,
      pageWidth: seed.data.pages[0]?.width ?? null,
      pageHeight: seed.data.pages[0]?.height ?? null,
      thumbnail: seed.thumbnail ?? null,
      previewSnapshot: buildPreviewSnapshot(seed.data),
      data: seed.data,
      assetIds: [],
      favorite: false,
      usageCount: 0,
      lastUsedAt: null,
      builtIn: true,
      protected: true,
      validationStatus: "ok",
      status: "published",
      publishedAt: now,
      createdBy: "system",
    });
    // eslint-disable-next-line no-await-in-loop
    await withStore("readwrite", (store) => store.put(template));
  }
  localStorage.setItem(SEED_FLAG_KEY, String(BUILT_IN_SEED_VERSION));
}
