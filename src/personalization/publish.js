// Publishing a personalization version from the editor: upload the design
// and exactly the images it references to this account's staging folder
// (storage.rules: Business plan only), then ask pzPublishVersion to check
// it and turn it into an immutable version. The server re-validates
// everything; nothing here is trusted.
import { ref, uploadBytes } from "firebase/storage";
import { storage } from "../firebase";
import { getAssetBlob, getAssetMeta } from "../assetStore";
import { collectAssetIds } from "../../functions/personalizationCore.mjs";
import { pzApi } from "./api";

function randomStagingId() {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function publishPersonalization({ uid, projectKey, templateId, pages, items, settings, onProgress }) {
  const stagingId = randomStagingId();
  const base = `personalizationStaging/${uid}/${stagingId}`;
  const assetIds = collectAssetIds(items);

  onProgress?.({ stage: "uploading", done: 0, total: assetIds.length + 1 });
  let done = 0;
  for (const assetId of assetIds) {
    // eslint-disable-next-line no-await-in-loop
    const [blob, meta] = await Promise.all([getAssetBlob(assetId), getAssetMeta(assetId)]);
    if (!blob) throw Object.assign(new Error("An image in this design is missing."), { code: "asset_missing" });
    // eslint-disable-next-line no-await-in-loop
    await uploadBytes(ref(storage, `${base}/assets/${assetId}`), blob, { contentType: blob.type || meta?.mimeType || "image/png" });
    done += 1;
    onProgress?.({ stage: "uploading", done, total: assetIds.length + 1 });
  }
  const design = new Blob([JSON.stringify({ pages, items })], { type: "application/json" });
  await uploadBytes(ref(storage, `${base}/design.json`), design, { contentType: "application/json" });
  onProgress?.({ stage: "publishing", done: assetIds.length + 1, total: assetIds.length + 1 });

  return pzApi.publishVersion({ stagingId, projectKey, templateId: templateId || undefined, settings });
}
