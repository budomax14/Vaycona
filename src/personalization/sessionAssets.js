// Loads the images a personalization page needs (the published template's
// pictures, the customer's photos) into assetStore.js's in-memory registry,
// so the normal DesignNode renderers and the export pipeline find them by
// asset id exactly as they would in the editor — without ever writing them
// into this browser's asset library.
import { hasMemoryAsset, registerMemoryAsset } from "../assetStore";

async function imageSize(blob) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close?.();
      return size;
    } catch {
      // fall through to <img> (e.g. SVG in some browsers)
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// `assets`: { [assetId]: url }. Resolves to the ids that failed to load
// (they render as the usual "missing image" placeholder).
export async function loadSessionAssets(assets) {
  const failed = [];
  await Promise.all(
    Object.entries(assets || {}).map(async ([id, url]) => {
      if (hasMemoryAsset(id)) return;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(String(response.status));
        const blob = await response.blob();
        registerMemoryAsset(id, blob, await imageSize(blob).catch(() => ({})));
      } catch {
        failed.push(id);
      }
    })
  );
  return failed;
}

export function registerLocalPhoto(assetId, blob, size) {
  registerMemoryAsset(assetId, blob, size);
}

const MAX_PHOTO_SIDE = 3000;
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;

// Customer photos are normalized here before upload: decoded (which also
// applies camera EXIF rotation), scaled to at most MAX_PHOTO_SIDE, and
// re-encoded as JPEG — small enough to upload quickly on a phone, and a
// format the server can verify. Throws { code } on anything unusable.
export async function preparePhoto(file) {
  if (!file || !/^image\//.test(file.type || "image/")) throw Object.assign(new Error("type"), { code: "file_type" });
  if (file.size > MAX_SOURCE_BYTES) throw Object.assign(new Error("size"), { code: "file_too_large" });
  let source;
  try {
    source = typeof createImageBitmap === "function" ? await createImageBitmap(file, { imageOrientation: "from-image" }) : null;
  } catch {
    source = null;
  }
  let objectUrl = null;
  if (!source) {
    objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.src = objectUrl;
    try {
      await img.decode();
    } catch {
      URL.revokeObjectURL(objectUrl);
      throw Object.assign(new Error("decode"), { code: "file_type" });
    }
    source = img;
  }
  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close?.();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) throw Object.assign(new Error("encode"), { code: "file_type" });
  return { blob, width: Math.round(width * scale), height: Math.round(height * scale) };
}
