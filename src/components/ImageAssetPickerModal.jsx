import React, { useRef, useState } from "react";
import { AlertCircle, ImagePlus, Loader2 } from "lucide-react";
import BrandModal from "./BrandKit/BrandModal";
import { useAssetList } from "../useAsset";
import { putAsset } from "../assetStore";

// "Open the existing media/image picker" for Image Fill — reuses the same
// underlying asset list/upload plumbing UploadsPanel.jsx already uses
// (useAssetList/putAsset), just presented as a modal (BrandModal.jsx, the
// app's existing generic dialog shell) instead of a permanent sidebar
// panel, since picking an image for a specific fill is a one-off action
// rather than a persistent browsing surface.
export default function ImageAssetPickerModal({ isOpen, onClose, onPick }) {
  const fileInputRef = useRef(null);
  const assetIndex = useAssetList();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const assets = Object.entries(assetIndex)
    .map(([id, meta]) => ({ id, ...meta }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  async function handleFile(file) {
    setIsUploading(true);
    setUploadError(null);
    const result = await putAsset(file);
    setIsUploading(false);
    if (!result.id) {
      setUploadError(result.errorMessage || "Upload failed.");
      return;
    }
    onPick(result.id);
  }

  return (
    <BrandModal isOpen={isOpen} onClose={onClose} title="Choose an image" subtitle="Upload a new image or pick one from your uploads" width="max-w-md">
      <button
        type="button"
        className="mb-3 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-6 text-sm font-medium text-gray-600 transition-colors hover:border-amber-400 hover:text-amber-700 disabled:pointer-events-none disabled:opacity-60"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
        <span>{isUploading ? "Uploading…" : "Upload image"}</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleFile(file);
          event.target.value = "";
        }}
      />

      {uploadError && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 px-2.5 py-2 text-xs text-red-600">
          <AlertCircle size={14} className="shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {assets.length === 0 ? (
        <p className="text-xs text-gray-400">Uploaded images will appear here for reuse.</p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              className="relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-50 hover:border-amber-400 disabled:pointer-events-none disabled:opacity-50"
              onClick={() => onPick(asset.id)}
              disabled={asset.status !== "ready"}
              title={asset.name || "Uploaded image"}
              aria-label={`Use ${asset.name || "uploaded image"}`}
            >
              {asset.thumbDataUrl ? (
                <img src={asset.thumbDataUrl} alt={asset.name || ""} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-gray-300">
                  <ImagePlus size={16} />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </BrandModal>
  );
}
