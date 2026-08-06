// Default/original page size (also the starter page used before any
// workspace state has been persisted).
export const CANVAS_WIDTH = 900;
export const CANVAS_HEIGHT = 620;

// Konva's own render resolution is pinned at pageWidth/Height * this cap,
// completely decoupled from zoom level (zoom is a CSS transform on top of
// this fixed-resolution render) — bounds canvas memory/redraw cost so it
// never scales with zoom, while staying crisp at typical zoom levels.
export const RENDER_SCALE_CAP = 2;

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 8;
export const ZOOM_STEP = 1.05;
export const BUTTON_ZOOM_STEP = 1.2;
export const ZOOM_PRESETS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 4, 8];

export const WORKSPACE_PAGE_GAP = 60;
export const WORKSPACE_FIT_PADDING = 48;

// Ruler strip thickness (editor chrome, not project content) — shared by
// Ruler.jsx (canvas sizing) and Workspace.jsx (gutter/corner sizing) so the
// two always agree on layout.
export const RULER_THICKNESS = 24;

export const UPLOADS_STORAGE_KEY = "personal-canva-uploads-v1";
export const WORKSPACE_STORAGE_KEY = "personal-canva-workspace-v1";
export const RECENT_COLORS_KEY = "personal-canva-recent-colors-v1";
export const RECENT_COLORS_MAX = 10;

export const SNAP_THRESHOLD_SCREEN_PX = 6;

// Working area rendered around the page on every edge (content px) — lets
// objects be dragged/placed exactly where the user puts them, including
// partially or fully off the page, and still stay visible (like Canva/
// Figma's pasteboard) instead of vanishing the instant they cross the page
// edge. Purely an editing-surface convenience: exports/thumbnails still
// crop to the page rect exactly (see captureStagePng, offscreenRenderer.jsx).
export const PASTEBOARD_MARGIN_PX = 240;

export const GRID_SIZE_DEFAULT = 20;
export const MARGIN_INSET_DEFAULT = 40;
export const BLEED_SIZE_DEFAULT = 20;

// Phase 10 — precision layout tools (rulers/guides/grids/snapping). App-
// level (not project) preferences; see precisionPreferences.js.
export const PRECISION_PREFS_STORAGE_KEY = "personal-canva-precision-prefs-v1";

// personal-canva-project-v1 (the pre-Phase-7D single-page "Save"/"Load"
// key) is retired as of Phase 7D — superseded by the centralized autosave
// workspace record plus proper multi-page project export/import.

// Bumped whenever the shape of the persisted workspace record changes in a
// way that needs a migration on load (Phase 7B+). Independent of any
// npm/app version — this only tracks the DATA shape.
export const PROJECT_SCHEMA_VERSION = 1;

// Debounce for the centralized autosave service (Phase 7B) — long enough
// that a burst of committed history entries (e.g. several quick edits)
// collapses into one write, short enough that "Saved" reliably shows up
// within about a second of the user pausing.
export const AUTOSAVE_DEBOUNCE_MS = 600;

// Phase 6 — local asset storage. Binary image data lives in IndexedDB
// (see assetStore.js); this localStorage key holds only a small synchronous
// index (name/mime/dimensions/tiny thumbnail/status) so the Uploads panel
// and Layers previews can render instantly on boot without waiting on an
// async IndexedDB read.
export const ASSET_DB_NAME = "personal-canva-assets-v1";
export const ASSET_DB_STORE = "assets";
export const ASSET_INDEX_STORAGE_KEY = "personal-canva-asset-index-v1";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB
export const MAX_IMAGE_DIMENSION = 8000; // px, per side — guards against pathological canvas sizes
export const ASSET_THUMB_SIZE = 240; // px, longest side of a generated thumbnail
export const ACCEPTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Phase 7D — editable project file (import/export). Separate from
// PROJECT_SCHEMA_VERSION: this tracks the ARCHIVE structure (manifest.json
// + project.json + assets/), not the project data shape inside it.
export const PACKAGE_FORMAT_VERSION = 1;
export const PROJECT_FILE_EXTENSION = ".canvasproject";

// Untrusted-archive safety limits (spec §18) — generous for a personal,
// browser-based editor, but bounded so a hostile/corrupt file can't
// allocate unbounded memory before any content is even validated.
export const IMPORT_MAX_PACKAGE_BYTES = 300 * 1024 * 1024; // 300MB compressed
export const IMPORT_MAX_UNCOMPRESSED_BYTES = 800 * 1024 * 1024; // 800MB total extracted
export const IMPORT_MAX_ENTRY_COUNT = 2000;
export const IMPORT_MAX_PROJECT_JSON_BYTES = 50 * 1024 * 1024; // 50MB of pure project JSON
export const IMPORT_MAX_MANIFEST_JSON_BYTES = 2 * 1024 * 1024;
export const IMPORT_MAX_ASSET_BYTES = MAX_UPLOAD_BYTES; // one consistent per-asset ceiling
export const IMPORT_MAX_PAGE_COUNT = 200;
export const IMPORT_MAX_OBJECT_COUNT = 20000;
export const IMPORT_MAX_GROUP_DEPTH = 30;
// A single entry that claims to inflate more than this multiple of its
// compressed size is treated as a likely archive bomb and rejected.
export const IMPORT_MAX_COMPRESSION_RATIO = 200;

// Template Management Admin — local-only passcode gate (no server, no real
// user accounts; see adminAuth.js) plus the per-template draft-autosave key
// prefix used ONLY by the admin template editor, kept entirely separate
// from WORKSPACE_STORAGE_KEY so editing a template can never touch the
// user's live personal project.
export const ADMIN_PASSCODE_HASH_KEY = "personal-canva-admin-passcode-v1";
export const ADMIN_UNLOCKED_KEY = "personal-canva-admin-unlocked-v1";
export const ADMIN_TEMPLATE_DRAFT_STORAGE_KEY_PREFIX = "personal-canva-admin-template-draft-v1";
export const ADMIN_CUSTOM_CATEGORIES_KEY = "personal-canva-admin-custom-categories-v1";

// Phase 11 — Brand Kit / design tokens. Mirrors the existing per-feature
// IndexedDB database convention (one small DB per concern) rather than a
// single shared "everything" database.
export const BRAND_DB_NAME = "personal-canva-brandkits-v1";
export const BRAND_STORE = "brandKits";
export const BRAND_KIT_FORMAT_VERSION = 1;
export const ACTIVE_BRAND_KIT_KEY = "personal-canva-active-brandkit-v1";
export const RECENT_BRAND_RESOURCES_KEY = "personal-canva-recent-brand-resources-v1";
export const MAX_RECENT_BRAND_RESOURCES = 20;

export const MAX_BRAND_KIT_NAME_LENGTH = 80;
export const MAX_BRAND_KIT_DESCRIPTION_LENGTH = 500;
export const MAX_BRAND_TOKEN_NAME_LENGTH = 60;
export const MAX_BRAND_TAG_LENGTH = 30;

export const BRAND_PACKAGE_FORMAT_VERSION = 1;
export const BRAND_PACKAGE_FILE_EXTENSION = ".brandkit";
// Reuses the same untrusted-archive safety posture as project packages
// (Phase 7D) — see projectPackage.js — scaled down since brand packages are
// much smaller (tokens + a handful of logo/graphic images).
export const BRAND_IMPORT_MAX_PACKAGE_BYTES = 100 * 1024 * 1024;
export const BRAND_IMPORT_MAX_UNCOMPRESSED_BYTES = 250 * 1024 * 1024;
export const BRAND_IMPORT_MAX_ENTRY_COUNT = 500;
export const BRAND_IMPORT_MAX_JSON_BYTES = 10 * 1024 * 1024;
export const BRAND_IMPORT_MAX_ASSET_BYTES = MAX_UPLOAD_BYTES;
export const BRAND_IMPORT_MAX_COMPRESSION_RATIO = 200;

// Safe SVG upload limits (logos/graphics/icons) — separate from raster
// ACCEPTED_IMAGE_MIME_TYPES since SVG needs its own sanitization pass
// (see svgSafety.js) rather than the checksum/decode pipeline in
// assetStore.js, which only understands raster formats.
export const ACCEPTED_LOGO_MIME_TYPES = [...ACCEPTED_IMAGE_MIME_TYPES, "image/svg+xml"];
export const MAX_SVG_BYTES = 2 * 1024 * 1024;
