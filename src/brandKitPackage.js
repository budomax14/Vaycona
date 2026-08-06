// Phase 11 — portable brand-kit package (spec §70/§71/§72). A `.brandkit`
// ZIP: manifest.json + brand.json + assets/<assetId>.<ext> for any
// raster logo/graphic the kit references (SVG resources embed their
// sanitized text directly in brand.json — no separate asset entry needed).
// Mirrors projectPackage.js's untrusted-archive posture (path safety,
// entry/size/compression-ratio limits) at a smaller scale, per phase rules
// ("reuse Phase 7D archive protections; do not build a second unsafe ZIP
// parser").

import JSZip from "jszip";
import {
  BRAND_PACKAGE_FORMAT_VERSION,
  BRAND_PACKAGE_FILE_EXTENSION,
  BRAND_KIT_FORMAT_VERSION,
  BRAND_IMPORT_MAX_PACKAGE_BYTES,
  BRAND_IMPORT_MAX_UNCOMPRESSED_BYTES,
  BRAND_IMPORT_MAX_ENTRY_COUNT,
  BRAND_IMPORT_MAX_JSON_BYTES,
  BRAND_IMPORT_MAX_ASSET_BYTES,
  BRAND_IMPORT_MAX_COMPRESSION_RATIO,
  ACCEPTED_IMAGE_MIME_TYPES,
} from "./constants";
import { getAssetBlob, getAssetMeta, putAssetWithId, computeChecksum } from "./assetStore";
import { validateBrandKit } from "./brandKitValidator";
import { BRAND_RESOURCE_COLLECTIONS } from "./brandKitService";

const MIME_TO_EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

export function sanitizeBrandKitFilename(name) {
  const base = (name || "").trim().replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
  return `${(base || "Brand Kit").slice(0, 80)}${BRAND_PACKAGE_FILE_EXTENSION}`;
}

function collectAssetIds(kit) {
  const ids = new Set();
  (kit.logos || []).forEach((l) => l.assetId && ids.add(l.assetId));
  (kit.graphics || []).forEach((g) => g.assetId && ids.add(g.assetId));
  (kit.icons || []).forEach((i) => i.assetId && ids.add(i.assetId));
  return [...ids];
}

export async function exportBrandKitPackage(kit) {
  const zip = new JSZip();
  const assetIds = collectAssetIds(kit);
  const assetsFolder = zip.folder("assets");
  const assetMappings = [];

  for (const assetId of assetIds) {
    const [meta, blob] = await Promise.all([getAssetMeta(assetId), getAssetBlob(assetId)]);
    if (!meta || !blob) continue;
    const ext = MIME_TO_EXT[meta.mimeType] || "bin";
    const archiveFilename = `${assetId}.${ext}`;
    assetsFolder.file(archiveFilename, blob);
    assetMappings.push({ assetId, archiveFilename: `assets/${archiveFilename}`, mimeType: meta.mimeType, size: meta.size, checksum: meta.checksum || null });
  }

  zip.file("brand.json", JSON.stringify(kit));

  const manifest = {
    brandPackageFormatVersion: BRAND_PACKAGE_FORMAT_VERSION,
    brandKitFormatVersion: BRAND_KIT_FORMAT_VERSION,
    brandKitId: kit.id,
    brandKitName: kit.name,
    exportedAt: Date.now(),
    resourceCounts: Object.fromEntries(BRAND_RESOURCE_COLLECTIONS.map((key) => [key, (kit[key] || []).length])),
    assets: assetMappings,
  };
  zip.file("manifest.json", JSON.stringify(manifest));

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  return { blob, filename: sanitizeBrandKitFilename(kit.name), manifest };
}

function isPathSafe(path) {
  if (!path || path.includes("\0")) return false;
  if (path.startsWith("/") || /^[a-zA-Z]:/.test(path)) return false;
  if (path.split(/[/\\]/).includes("..")) return false;
  return true;
}

export const BRAND_IMPORT_ERROR = Object.freeze({
  TOO_LARGE: "too-large",
  BAD_ARCHIVE: "bad-archive",
  UNSAFE_ENTRY: "unsafe-entry",
  TOO_MANY_ENTRIES: "too-many-entries",
  COMPRESSION_BOMB: "compression-bomb",
  MISSING_MANIFEST: "missing-manifest",
  MISSING_BRAND_JSON: "missing-brand-json",
  MALFORMED_JSON: "malformed-json",
  UNSUPPORTED_FORMAT: "unsupported-format",
  INVALID_STRUCTURE: "invalid-structure",
});

function fail(code, message) {
  return { ok: false, code, message };
}

// Stage 1: safe inspection only — never writes anything.
export async function inspectBrandKitPackage(file) {
  if (!file) return fail(BRAND_IMPORT_ERROR.BAD_ARCHIVE, "No file was provided.");
  if (file.size > BRAND_IMPORT_MAX_PACKAGE_BYTES) {
    return fail(BRAND_IMPORT_ERROR.TOO_LARGE, `This file is too large (max ${Math.round(BRAND_IMPORT_MAX_PACKAGE_BYTES / 1024 / 1024)}MB).`);
  }

  let zip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    return fail(BRAND_IMPORT_ERROR.BAD_ARCHIVE, "This doesn't look like a valid brand kit file.");
  }

  const entries = Object.values(zip.files).filter((e) => !e.dir);
  if (entries.length > BRAND_IMPORT_MAX_ENTRY_COUNT) {
    return fail(BRAND_IMPORT_ERROR.TOO_MANY_ENTRIES, "This brand kit file contains too many files to be valid.");
  }

  let totalUncompressed = 0;
  for (const entry of entries) {
    if (!isPathSafe(entry.name)) return fail(BRAND_IMPORT_ERROR.UNSAFE_ENTRY, "This brand kit file contains unsafe file paths and was rejected.");
    const uncompressedSize = entry._data?.uncompressedSize ?? 0;
    const compressedSize = entry._data?.compressedSize ?? 0;
    if (compressedSize > 0 && uncompressedSize / compressedSize > BRAND_IMPORT_MAX_COMPRESSION_RATIO) {
      return fail(BRAND_IMPORT_ERROR.COMPRESSION_BOMB, "This brand kit file looks corrupted or unsafe and was rejected.");
    }
    totalUncompressed += uncompressedSize;
  }
  if (totalUncompressed > BRAND_IMPORT_MAX_UNCOMPRESSED_BYTES) {
    return fail(BRAND_IMPORT_ERROR.TOO_LARGE, "This brand kit file is too large once extracted.");
  }

  const seenNames = new Set();
  const rawNames = [];
  zip.forEach((relativePath) => rawNames.push(relativePath));
  for (const name of rawNames) {
    if (seenNames.has(name)) return fail(BRAND_IMPORT_ERROR.UNSAFE_ENTRY, "This brand kit file contains duplicate entries and was rejected.");
    seenNames.add(name);
  }

  const manifestEntry = zip.file("manifest.json");
  const brandEntry = zip.file("brand.json");
  if (!manifestEntry) return fail(BRAND_IMPORT_ERROR.MISSING_MANIFEST, "This brand kit file is missing its manifest.");
  if (!brandEntry) return fail(BRAND_IMPORT_ERROR.MISSING_BRAND_JSON, "This brand kit file is missing its brand data.");

  const manifestText = await manifestEntry.async("string");
  if (manifestText.length > BRAND_IMPORT_MAX_JSON_BYTES) return fail(BRAND_IMPORT_ERROR.TOO_LARGE, "This brand kit's manifest is unexpectedly large.");
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch {
    return fail(BRAND_IMPORT_ERROR.MALFORMED_JSON, "This brand kit's manifest could not be read.");
  }
  if (manifest.brandPackageFormatVersion > BRAND_PACKAGE_FORMAT_VERSION) {
    return fail(BRAND_IMPORT_ERROR.UNSUPPORTED_FORMAT, "This brand kit was exported by a newer app version. Please update the app to import it.");
  }

  const brandText = await brandEntry.async("string");
  if (brandText.length > BRAND_IMPORT_MAX_JSON_BYTES) return fail(BRAND_IMPORT_ERROR.TOO_LARGE, "This brand kit's data is unexpectedly large.");
  let brandJson;
  try {
    brandJson = JSON.parse(brandText);
  } catch {
    return fail(BRAND_IMPORT_ERROR.MALFORMED_JSON, "This brand kit's data could not be read.");
  }
  if (brandJson.brandKitFormatVersion > BRAND_KIT_FORMAT_VERSION) {
    return fail(BRAND_IMPORT_ERROR.UNSUPPORTED_FORMAT, "This brand kit uses a schema newer than this app supports.");
  }
  const validation = validateBrandKit(brandJson);
  if (validation.status === "fatal") {
    return fail(BRAND_IMPORT_ERROR.INVALID_STRUCTURE, "This brand kit's data is not in a usable shape.");
  }

  return { ok: true, zip, manifest, brandJson, validation, fileSize: file.size };
}

// Stage 2: remaps every ID in the kit to fresh ones (spec §72's default
// "import as new"), imports referenced assets preserving asset IDs unless a
// real collision is detected (same convention as projectPackage.js's
// importPackageAssets), and returns a ready-to-store brand kit record.
export async function importBrandKitAsNew(zip, brandJson, manifest) {
  const idMaps = {};
  BRAND_RESOURCE_COLLECTIONS.forEach((key) => {
    idMaps[key] = new Map((brandJson[key] || []).map((r) => [r.id, crypto.randomUUID()]));
  });
  const remap = (key, id) => (id ? idMaps[key]?.get(id) ?? id : id);

  const assetRemap = new Map();
  const missingAssetIds = [];
  for (const entry of manifest.assets || []) {
    const zipEntry = zip.file(entry.archiveFilename);
    if (!zipEntry) {
      missingAssetIds.push(entry.assetId);
      continue;
    }
    if (entry.size > BRAND_IMPORT_MAX_ASSET_BYTES || !ACCEPTED_IMAGE_MIME_TYPES.includes(entry.mimeType)) {
      missingAssetIds.push(entry.assetId);
      continue;
    }
    let blob;
    try {
      blob = await zipEntry.async("blob");
    } catch {
      missingAssetIds.push(entry.assetId);
      continue;
    }
    const typedBlob = blob.type ? blob : new Blob([blob], { type: entry.mimeType });
    const file = new File([typedBlob], `${entry.assetId}`, { type: entry.mimeType });
    const existing = await getAssetMeta(entry.assetId);
    if (existing) {
      const incomingChecksum = entry.checksum || (await computeChecksum(typedBlob));
      if (existing.checksum && incomingChecksum && existing.checksum === incomingChecksum) continue;
      const newId = crypto.randomUUID();
      const result = await putAssetWithId(newId, file, { name: entry.assetId });
      if (result.id) assetRemap.set(entry.assetId, newId);
      else missingAssetIds.push(entry.assetId);
      continue;
    }
    const result = await putAssetWithId(entry.assetId, file, { name: entry.assetId });
    if (!result.id) missingAssetIds.push(entry.assetId);
  }

  const remapAssetId = (id) => (id && assetRemap.has(id) ? assetRemap.get(id) : id);

  const now = Date.now();
  const next = { ...brandJson };
  BRAND_RESOURCE_COLLECTIONS.forEach((key) => {
    next[key] = (brandJson[key] || []).map((r) => ({ ...r, id: idMaps[key].get(r.id) }));
  });
  next.palettes = next.palettes.map((p) => ({ ...p, colorIds: (p.colorIds || []).map((id) => remap("colors", id)) }));
  next.typography = next.typography.map((t) => ({ ...t, fontId: remap("fonts", t.fontId), colorId: remap("colors", t.colorId) }));
  next.gradients = next.gradients.map((g) => ({ ...g, stops: (g.stops || []).map((s) => ({ ...s, colorId: remap("colors", s.colorId) })) }));
  next.backgroundStyles = next.backgroundStyles.map((b) => ({ ...b, colorId: remap("colors", b.colorId), gradientId: remap("gradients", b.gradientId), assetId: remapAssetId(b.assetId) }));
  next.themes = next.themes.map((t) => ({
    ...t,
    primaryColorId: remap("colors", t.primaryColorId),
    secondaryColorId: remap("colors", t.secondaryColorId),
    accentColorId: remap("colors", t.accentColorId),
    backgroundColorId: remap("colors", t.backgroundColorId),
    textColorId: remap("colors", t.textColorId),
    headingTypographyId: remap("typography", t.headingTypographyId),
    bodyTypographyId: remap("typography", t.bodyTypographyId),
    buttonObjectStyleId: remap("objectStyles", t.buttonObjectStyleId),
    shapeObjectStyleId: remap("objectStyles", t.shapeObjectStyleId),
    backgroundStyleId: remap("backgroundStyles", t.backgroundStyleId),
    effectPresetId: remap("effectPresets", t.effectPresetId),
  }));
  next.logos = next.logos.map((l) => ({ ...l, assetId: remapAssetId(l.assetId) }));
  next.graphics = next.graphics.map((g) => ({ ...g, assetId: remapAssetId(g.assetId) }));
  next.icons = next.icons.map((i) => ({ ...i, assetId: remapAssetId(i.assetId) }));

  next.id = crypto.randomUUID();
  next.createdAt = now;
  next.updatedAt = now;
  next.favorite = false;
  next.protected = false;
  next.usageCount = 0;
  next.lastUsedAt = null;

  return { kit: next, missingAssetIds };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
