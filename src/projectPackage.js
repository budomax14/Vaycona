// Editable project file import/export (Phase 7D). Builds/reads a
// `.canvasproject` archive (a ZIP: manifest.json + project.json +
// assets/<id>.<ext>) around the SAME durable workspace shape autosave/
// recovery already use — this is not a second competing document format.
//
// Export: pure packaging of already-validated live state. Never mints new
// object/page/group/asset IDs.
// Import: treats the archive as untrusted. Validates structure/size before
// touching any content, reuses the app's own validateItem/
// migrateFlatGroupsToGroupObjects/repairHierarchy pipeline (via the
// `normalizeParsedWorkspace` callback passed in) for the project data
// itself, and only ever writes assets to IndexedDB via assetStore.js.

import JSZip from "jszip";
import {
  PACKAGE_FORMAT_VERSION,
  PROJECT_FILE_EXTENSION,
  PROJECT_SCHEMA_VERSION,
  IMPORT_MAX_PACKAGE_BYTES,
  IMPORT_MAX_UNCOMPRESSED_BYTES,
  IMPORT_MAX_ENTRY_COUNT,
  IMPORT_MAX_PROJECT_JSON_BYTES,
  IMPORT_MAX_MANIFEST_JSON_BYTES,
  IMPORT_MAX_ASSET_BYTES,
  IMPORT_MAX_PAGE_COUNT,
  IMPORT_MAX_OBJECT_COUNT,
  IMPORT_MAX_GROUP_DEPTH,
  IMPORT_MAX_COMPRESSION_RATIO,
  ACCEPTED_IMAGE_MIME_TYPES,
} from "./constants";
import { getAssetBlob, getAssetMeta, putAssetWithId, computeChecksum } from "./assetStore";
import { validateHierarchy, repairHierarchy } from "./hierarchy";
import { isValidRichText } from "./richText";

const MIME_TO_EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

// --- filename ---

export function sanitizeProjectFilename(name) {
  const base = (name || "").trim().replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
  const truncated = (base || "Untitled Project").slice(0, 80);
  return `${truncated}${PROJECT_FILE_EXTENSION}`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Released once the download has had a moment to start, per spec §13.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function usedAssetIdsFromItems(items) {
  const set = new Set();
  items.forEach((item) => {
    if (item.assetId) set.add(item.assetId);
    if (item.contentAssetId) set.add(item.contentAssetId);
    if (item.fillImage?.assetId) set.add(item.fillImage.assetId);
  });
  return [...set];
}

// --- export ---

// data: {pages, activePageId, scale, items, guides, snapToGuides} — the
// same shape autosaveService already serializes. Never mutates it, never
// assigns new IDs. `onProgress(stage)` stages: preparing, validating,
// collecting-assets, packaging, finalizing.
export async function analyzeExportAssets(items) {
  const assetIds = usedAssetIdsFromItems(items);
  const available = [];
  const missing = [];
  for (const id of assetIds) {
    // Sequential, not Promise.all — bounds concurrency for large projects
    // (spec §13) and these are local IndexedDB reads, not network calls.
    const meta = await getAssetMeta(id);
    if (meta) available.push(id);
    else missing.push(id);
  }
  return { assetIds, availableAssetIds: available, missingAssetIds: missing };
}

// Cheap structural check before packaging (spec §8) — reuses the app's own
// hierarchy validator; repairs are the same safe orphan-to-top-level
// repairHierarchy already performs elsewhere, never a speculative rewrite.
export function validateProjectForExport(data) {
  const errors = [];
  const warnings = [];
  if (!data.pages?.length) errors.push("Project has no pages.");
  const ids = new Set();
  for (const item of data.items || []) {
    if (ids.has(item.id)) errors.push(`Duplicate object ID: ${item.id}`);
    ids.add(item.id);
  }
  const problems = validateHierarchy(data.items || []);
  let repairedItems = data.items;
  if (problems.missingParent.length || problems.crossPage.length || problems.cyclic.length) {
    warnings.push(`Repaired ${new Set([...problems.missingParent, ...problems.crossPage, ...problems.cyclic]).size} invalid hierarchy reference(s).`);
    repairedItems = repairHierarchy(data.items);
  }
  return { errors, warnings, data: { ...data, items: repairedItems } };
}

export async function exportProjectPackage({
  data,
  projectName,
  workspaceId,
  schemaVersion = PROJECT_SCHEMA_VERSION,
  onProgress,
}) {
  onProgress?.("preparing");
  const { errors, warnings, data: validatedData } = validateProjectForExport(data);
  if (errors.length) return { ok: false, errors, warnings };

  onProgress?.("validating");
  const { availableAssetIds, missingAssetIds } = await analyzeExportAssets(validatedData.items);

  onProgress?.("collecting-assets");
  const zip = new JSZip();
  const assetsFolder = zip.folder("assets");
  const assetMappings = [];
  for (const assetId of availableAssetIds) {
    const [meta, blob] = await Promise.all([getAssetMeta(assetId), getAssetBlob(assetId)]);
    if (!meta || !blob) continue;
    const ext = MIME_TO_EXT[meta.mimeType] || "bin";
    const archiveFilename = `${assetId}.${ext}`;
    assetsFolder.file(archiveFilename, blob);
    assetMappings.push({
      assetId,
      archiveFilename: `assets/${archiveFilename}`,
      originalFilename: meta.name,
      mimeType: meta.mimeType,
      size: meta.size,
      width: meta.width,
      height: meta.height,
      checksum: meta.checksum || null,
    });
  }

  onProgress?.("packaging");
  const projectJson = JSON.stringify({
    schemaVersion,
    workspaceId,
    updatedAt: Date.now(),
    pages: validatedData.pages,
    activePageId: validatedData.activePageId,
    scale: validatedData.scale,
    items: validatedData.items,
    guides: validatedData.guides,
    snapToGuides: validatedData.snapToGuides,
  });
  zip.file("project.json", projectJson);

  const manifest = {
    packageFormatVersion: PACKAGE_FORMAT_VERSION,
    projectSchemaVersion: schemaVersion,
    applicationVersion: null,
    projectId: workspaceId,
    projectName: projectName || "Untitled Project",
    exportedAt: Date.now(),
    pageCount: validatedData.pages.length,
    objectCount: validatedData.items.length,
    groupCount: validatedData.items.filter((it) => it.type === "group").length,
    assetCount: assetMappings.length,
    totalAssetBytes: assetMappings.reduce((sum, a) => sum + (a.size || 0), 0),
    projectMetadataFile: "project.json",
    assets: assetMappings,
    missingAssetIds,
  };
  zip.file("manifest.json", JSON.stringify(manifest));

  onProgress?.("finalizing");
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  return { ok: true, blob, manifest, warnings, filename: sanitizeProjectFilename(projectName) };
}

// --- import: stage 1 — safe archive inspection (manifest only) ---

function isPathSafe(path) {
  if (!path || path.includes("\0")) return false;
  if (path.startsWith("/") || /^[a-zA-Z]:/.test(path)) return false; // absolute (unix or windows)
  if (path.split(/[/\\]/).includes("..")) return false; // traversal, either slash style
  return true;
}

export const IMPORT_ERROR = Object.freeze({
  TOO_LARGE: "too-large",
  BAD_ARCHIVE: "bad-archive",
  UNSAFE_ENTRY: "unsafe-entry",
  TOO_MANY_ENTRIES: "too-many-entries",
  COMPRESSION_BOMB: "compression-bomb",
  MISSING_MANIFEST: "missing-manifest",
  MISSING_PROJECT: "missing-project",
  MALFORMED_JSON: "malformed-json",
  UNSUPPORTED_PACKAGE_FORMAT: "unsupported-package-format",
  UNSUPPORTED_SCHEMA: "unsupported-schema",
  INVALID_STRUCTURE: "invalid-structure",
});

function fail(code, message) {
  return { ok: false, code, message };
}

// Reads only the manifest (+ enough of project.json to validate schema),
// never extracts/decodes assets — safe to call just to show a preview
// (spec §19/§42).
export async function inspectProjectPackage(file) {
  if (!file) return fail(IMPORT_ERROR.BAD_ARCHIVE, "No file was provided.");
  if (file.size > IMPORT_MAX_PACKAGE_BYTES) {
    return fail(IMPORT_ERROR.TOO_LARGE, `This file is too large (max ${Math.round(IMPORT_MAX_PACKAGE_BYTES / 1024 / 1024)}MB).`);
  }

  let zip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    return fail(IMPORT_ERROR.BAD_ARCHIVE, "This doesn't look like a valid project file.");
  }

  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > IMPORT_MAX_ENTRY_COUNT) {
    return fail(IMPORT_ERROR.TOO_MANY_ENTRIES, "This project file contains too many files to be valid.");
  }

  let totalUncompressed = 0;
  for (const entry of entries) {
    if (!isPathSafe(entry.name)) {
      return fail(IMPORT_ERROR.UNSAFE_ENTRY, "This project file contains unsafe file paths and was rejected.");
    }
    const uncompressedSize = entry._data?.uncompressedSize ?? 0;
    const compressedSize = entry._data?.compressedSize ?? 0;
    if (compressedSize > 0 && uncompressedSize / compressedSize > IMPORT_MAX_COMPRESSION_RATIO) {
      return fail(IMPORT_ERROR.COMPRESSION_BOMB, "This project file looks corrupted or unsafe and was rejected.");
    }
    totalUncompressed += uncompressedSize;
  }
  if (totalUncompressed > IMPORT_MAX_UNCOMPRESSED_BYTES) {
    return fail(IMPORT_ERROR.TOO_LARGE, "This project file is too large once extracted.");
  }

  // Duplicate archive entries (spec §16/§17): JSZip's `files` map already
  // collapses same-named entries to the last one, so detect duplicates by
  // comparing raw entry occurrences before that collapse would hide them.
  const seenNames = new Set();
  const rawNames = [];
  zip.forEach((relativePath) => rawNames.push(relativePath));
  for (const name of rawNames) {
    if (seenNames.has(name)) return fail(IMPORT_ERROR.UNSAFE_ENTRY, "This project file contains duplicate entries and was rejected.");
    seenNames.add(name);
  }

  const manifestEntry = zip.file("manifest.json");
  const projectEntry = zip.file("project.json");
  if (!manifestEntry) return fail(IMPORT_ERROR.MISSING_MANIFEST, "This project file is missing its manifest.");
  if (!projectEntry) return fail(IMPORT_ERROR.MISSING_PROJECT, "This project file is missing its project data.");

  const manifestText = await manifestEntry.async("string");
  if (manifestText.length > IMPORT_MAX_MANIFEST_JSON_BYTES) {
    return fail(IMPORT_ERROR.TOO_LARGE, "This project file's manifest is unexpectedly large.");
  }
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch {
    return fail(IMPORT_ERROR.MALFORMED_JSON, "This project file's manifest could not be read.");
  }

  if (manifest.packageFormatVersion !== PACKAGE_FORMAT_VERSION) {
    return fail(
      IMPORT_ERROR.UNSUPPORTED_PACKAGE_FORMAT,
      manifest.packageFormatVersion > PACKAGE_FORMAT_VERSION
        ? "This project file was created by a newer version of the app. Please update the app to open it."
        : "This project file's format is no longer supported."
    );
  }
  if (typeof manifest.projectSchemaVersion !== "number" || manifest.projectSchemaVersion > PROJECT_SCHEMA_VERSION) {
    return fail(
      IMPORT_ERROR.UNSUPPORTED_SCHEMA,
      `This project was made with a newer app version (schema ${manifest.projectSchemaVersion}). This app supports up to schema ${PROJECT_SCHEMA_VERSION}.`
    );
  }

  // Enough of project.json to report accurate preview counts even if the
  // manifest under-reports them — still doesn't run full item validation.
  const projectText = await projectEntry.async("string");
  if (projectText.length > IMPORT_MAX_PROJECT_JSON_BYTES) {
    return fail(IMPORT_ERROR.TOO_LARGE, "This project's data is unexpectedly large.");
  }
  let projectJson;
  try {
    projectJson = JSON.parse(projectText);
  } catch {
    return fail(IMPORT_ERROR.MALFORMED_JSON, "This project's data could not be read.");
  }
  if (!Array.isArray(projectJson.pages) || !Array.isArray(projectJson.items)) {
    return fail(IMPORT_ERROR.INVALID_STRUCTURE, "This project's data is missing required fields.");
  }
  if (projectJson.pages.length > IMPORT_MAX_PAGE_COUNT || projectJson.items.length > IMPORT_MAX_OBJECT_COUNT) {
    return fail(IMPORT_ERROR.INVALID_STRUCTURE, "This project has more pages or objects than this app supports importing at once.");
  }

  return {
    ok: true,
    zip,
    manifest,
    projectJson,
    fileSize: file.size,
    migrationRequired: manifest.projectSchemaVersion < PROJECT_SCHEMA_VERSION,
  };
}

// --- import: stage 2 — full validation + asset import (only run once the
// user actually chooses Open-as-new / Replace, per spec §15) ---

function computeMaxParentDepth(items) {
  const byId = new Map(items.map((it) => [it.id, it]));
  let max = 0;
  for (const item of items) {
    let depth = 0;
    let current = item;
    const seen = new Set();
    while (current?.parentId != null && byId.has(current.parentId) && !seen.has(current.id)) {
      seen.add(current.id);
      depth += 1;
      current = byId.get(current.parentId);
    }
    max = Math.max(max, depth);
  }
  return max;
}

function finiteOr(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Defensive numeric clamping layer specific to UNTRUSTED imported data
// (spec §31) — layered on top of, not a replacement for, validateItem's
// own defaults (which don't reject Infinity/NaN, since local data is
// already trusted). Runs before normalizeParsedWorkspace.
function sanitizeImportedItemNumerics(item) {
  const next = {
    ...item,
    x: finiteOr(item.x, 0),
    y: finiteOr(item.y, 0),
    width: clamp(finiteOr(item.width, 100), 1, 20000),
    height: clamp(finiteOr(item.height, 100), 0, 20000),
    rotation: finiteOr(item.rotation, 0) % 360,
    opacity: clamp(finiteOr(item.opacity, 1), 0, 1),
  };
  if (typeof item.fontSize === "number") next.fontSize = clamp(finiteOr(item.fontSize, 16), 1, 2000);
  if (item.richText !== undefined && !isValidRichText(item.richText)) next.richText = undefined;
  return next;
}

// Full structural validation of the imported project.json (spec §8/§16).
// `normalizeParsedWorkspace` is App.jsx's own validateItem/
// migrateFlatGroupsToGroupObjects/repairHierarchy pipeline, passed in so
// this module never re-implements it.
export function validateAndRepairImportedProject(projectJson, normalizeParsedWorkspace) {
  const errors = [];
  const warnings = [];

  const idSet = new Set();
  for (const item of projectJson.items) {
    if (!item || typeof item.id !== "string") continue;
    if (idSet.has(item.id)) {
      errors.push(`Duplicate object ID in imported file: ${item.id}`);
    }
    idSet.add(item.id);
  }
  const pageIdSet = new Set();
  for (const page of projectJson.pages) {
    if (page && pageIdSet.has(page.id)) errors.push(`Duplicate page ID in imported file: ${page.id}`);
    if (page) pageIdSet.add(page.id);
  }
  if (errors.length) return { errors, warnings, data: null };

  const sanitizedItems = projectJson.items.map(sanitizeImportedItemNumerics);
  const depth = computeMaxParentDepth(sanitizedItems);
  let boundedItems = sanitizedItems;
  if (depth > IMPORT_MAX_GROUP_DEPTH) {
    warnings.push(`Some groups were nested deeper than ${IMPORT_MAX_GROUP_DEPTH} levels and were flattened for safety.`);
    // Reuse repairHierarchy's own safe orphan strategy: clamp depth by
    // cutting the parent link on anything past the limit, same
    // "orphan to top-level, never delete" guarantee it already provides.
    boundedItems = boundedItems.map((item) => {
      let d = 0;
      let current = item;
      const byId = new Map(sanitizedItems.map((it) => [it.id, it]));
      while (current?.parentId != null && byId.has(current.parentId) && d <= IMPORT_MAX_GROUP_DEPTH) {
        d += 1;
        current = byId.get(current.parentId);
      }
      return d > IMPORT_MAX_GROUP_DEPTH ? { ...item, parentId: null } : item;
    });
  }

  const normalized = normalizeParsedWorkspace({ ...projectJson, items: boundedItems });
  if (!normalized) {
    errors.push("This project's data is not in a usable shape.");
    return { errors, warnings, data: null };
  }
  const problems = validateHierarchy(normalized.items);
  if (problems.missingParent.length || problems.crossPage.length || problems.cyclic.length) {
    warnings.push("Some object relationships were repaired safely (orphaned objects moved to the top level).");
  }
  return { errors, warnings, data: normalized };
}

// Imports every referenced asset from the archive into the shared
// IndexedDB asset store, preserving original IDs unless a real collision
// (same id, different content) is detected — spec §22/§23/§24. Returns an
// assetId remap Map (usually empty) plus missing/corrupted lists.
export async function importPackageAssets(zip, manifest, { onProgress } = {}) {
  const remap = new Map();
  const missingAssetIds = [];
  const corruptedAssetIds = [];
  const assets = manifest.assets || [];

  for (let i = 0; i < assets.length; i++) {
    const entry = assets[i];
    onProgress?.(i + 1, assets.length);
    const zipEntry = zip.file(entry.archiveFilename);
    if (!zipEntry) {
      missingAssetIds.push(entry.assetId);
      continue;
    }
    if (entry.size > IMPORT_MAX_ASSET_BYTES) {
      corruptedAssetIds.push(entry.assetId);
      continue;
    }
    if (!ACCEPTED_IMAGE_MIME_TYPES.includes(entry.mimeType)) {
      // Not a supported raster type (e.g. SVG) — this app doesn't accept
      // SVG uploads at all (spec §33's "mark unsupported" path), so it's
      // simplest and safest to treat it the same as a missing asset.
      corruptedAssetIds.push(entry.assetId);
      continue;
    }

    let blob;
    try {
      blob = await zipEntry.async("blob");
    } catch {
      corruptedAssetIds.push(entry.assetId);
      continue;
    }
    const typedBlob = blob.type ? blob : new Blob([blob], { type: entry.mimeType });
    const file = new File([typedBlob], entry.originalFilename || `${entry.assetId}`, { type: entry.mimeType });

    const existing = await getAssetMeta(entry.assetId);
    if (existing) {
      const incomingChecksum = entry.checksum || (await computeChecksum(typedBlob));
      if (existing.checksum && incomingChecksum && existing.checksum === incomingChecksum) {
        continue; // same id, same content — reuse what's already stored
      }
      // Same id, different content — a real collision: give the imported
      // asset a fresh id and remap every reference to it.
      const newId = crypto.randomUUID();
      const result = await putAssetWithId(newId, file, { name: entry.originalFilename });
      if (result.id) remap.set(entry.assetId, newId);
      else corruptedAssetIds.push(entry.assetId);
      continue;
    }

    const result = await putAssetWithId(entry.assetId, file, { name: entry.originalFilename });
    if (!result.id) corruptedAssetIds.push(entry.assetId);
  }

  return { remap, missingAssetIds, corruptedAssetIds };
}

// Applies an asset-ID remap Map to every item reference — spec §22's
// "generate a complete mapping first, then update every reference
// consistently" (here the mapping is asset-only; object/page/group IDs
// from the archive are preserved as-is, see the Phase 7D completion notes
// on why full cross-project ID collision remapping doesn't apply to this
// single-workspace app).
export function applyAssetRemap(items, remap) {
  if (remap.size === 0) return items;
  return items.map((item) => {
    let next = item;
    if (item.assetId && remap.has(item.assetId)) next = { ...next, assetId: remap.get(item.assetId) };
    if (item.contentAssetId && remap.has(item.contentAssetId)) next = { ...next, contentAssetId: remap.get(item.contentAssetId) };
    if (item.fillImage?.assetId && remap.has(item.fillImage.assetId)) {
      next = { ...next, fillImage: { ...item.fillImage, assetId: remap.get(item.fillImage.assetId) } };
    }
    return next;
  });
}
