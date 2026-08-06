import React, { useMemo, useRef, useState } from "react";
import { AlertCircle, ImagePlus, Loader2, Search, Trash2, X } from "lucide-react";
import { useAssetList } from "../../../useAsset";

const SORT_OPTIONS = [
  { key: "recent", label: "Most recent" },
  { key: "name", label: "Name (A–Z)" },
  { key: "size", label: "File size" },
];

// Real, working Uploads panel (Phase 6) — local pending-upload state tracks
// in-flight/failed attempts that never made it into the asset index (an
// upload that fails validation/decoding is never written to IndexedDB, so
// it can't be represented as an asset-index entry); everything that DID
// make it in comes from useAssetList's reactive read of the synchronous
// localStorage index (instant render, no per-thumbnail IndexedDB round-trip).
export default function UploadsPanel({ onUploadFile, onAddFromAsset, onRemoveAsset, usedAssetIds }) {
  const fileInputRef = useRef(null);
  const assetIndex = useAssetList();
  const [pending, setPending] = useState([]); // [{localId, name, status, errorMessage}]
  const [isDragOver, setIsDragOver] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);

  async function handleFiles(files) {
    for (const file of Array.from(files)) {
      const localId = crypto.randomUUID();
      setPending((prev) => [{ localId, name: file.name, status: "uploading", errorMessage: null }, ...prev]);
      const result = await onUploadFile(file);
      setPending((prev) => {
        if (result?.status === "error") {
          return prev.map((p) => (p.localId === localId ? { ...p, status: "error", errorMessage: result.errorMessage } : p));
        }
        return prev.filter((p) => p.localId !== localId);
      });
    }
  }

  function dismissPending(localId) {
    setPending((prev) => prev.filter((p) => p.localId !== localId));
  }

  function retryPending(localId) {
    dismissPending(localId);
    fileInputRef.current?.click();
  }

  const assets = useMemo(() => {
    let list = Object.entries(assetIndex).map(([id, meta]) => ({ id, ...meta }));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((a) => (a.name || "").toLowerCase().includes(q));
    }
    if (sort === "name") list = [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    else if (sort === "size") list = [...list].sort((a, b) => (b.size || 0) - (a.size || 0));
    else list = [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return list;
  }, [assetIndex, search, sort]);

  function handleRemove(assetId) {
    if (usedAssetIds?.has(assetId) && confirmRemoveId !== assetId) {
      setConfirmRemoveId(assetId);
      return;
    }
    setConfirmRemoveId(null);
    onRemoveAsset(assetId);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-800">Uploads</h3>

      <button
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 text-sm font-medium transition-colors ${
          isDragOver ? "border-amber-500 bg-amber-50 text-amber-700" : "border-gray-300 bg-gray-50 text-gray-600 hover:border-amber-400 hover:text-amber-700"
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragOver(false);
          if (event.dataTransfer.files?.length) handleFiles(event.dataTransfer.files);
        }}
        aria-label="Upload images — click to choose a file, or drag and drop here"
      >
        <ImagePlus size={20} />
        <span>Upload image</span>
        <span className="text-xs font-normal text-gray-400">or drag and drop, JPEG/PNG/WebP/GIF</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        hidden
        onChange={(event) => {
          if (event.target.files?.length) handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {pending.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {pending.map((p) => (
            <div key={p.localId} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${p.status === "error" ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-500"}`}>
              {p.status === "uploading" ? <Loader2 size={14} className="shrink-0 animate-spin" /> : <AlertCircle size={14} className="shrink-0" />}
              <span className="min-w-0 flex-1 truncate">{p.status === "error" ? p.errorMessage : `Uploading ${p.name}…`}</span>
              {p.status === "error" && (
                <>
                  <button className="shrink-0 font-semibold underline" onClick={() => retryPending(p.localId)}>
                    Retry
                  </button>
                  <button className="shrink-0" aria-label="Dismiss" onClick={() => dismissPending(p.localId)}>
                    <X size={13} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {assetIndex && Object.keys(assetIndex).length > 0 && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search uploads"
              aria-label="Search uploaded images"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-amber-400 focus:bg-white"
            />
          </div>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            aria-label="Sort uploaded images"
            className="shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-600 outline-none"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {assets.length === 0 ? (
        <p className="text-xs text-gray-400">
          {Object.keys(assetIndex).length === 0 ? "Uploaded images will appear here for reuse." : "No uploads match your search."}
        </p>
      ) : (
        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto pb-2">
          {assets.map((asset) => (
            <div key={asset.id} className="group relative">
              <button
                className="relative aspect-square w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50 hover:border-amber-400"
                draggable={asset.status === "ready"}
                onDragStart={(event) => {
                  event.dataTransfer.setData("application/x-upload-asset-id", asset.id);
                }}
                onClick={() => asset.status === "ready" && onAddFromAsset(asset.id)}
                title={asset.status === "ready" ? "Click to add, or drag onto the canvas" : asset.errorMessage || "Upload failed"}
                aria-label={asset.status === "ready" ? `Add ${asset.name || "uploaded image"} to the page` : `${asset.name || "Upload"} — ${asset.errorMessage || "error"}`}
              >
                {asset.thumbDataUrl ? (
                  <img src={asset.thumbDataUrl} alt={asset.name || "Upload"} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-300">
                    <ImagePlus size={20} />
                  </div>
                )}
                {asset.status === "error" && (
                  <span className="absolute inset-0 flex items-center justify-center bg-red-50/90">
                    <AlertCircle size={18} className="text-red-500" />
                  </span>
                )}
              </button>
              <button
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-gray-500 opacity-0 shadow group-hover:opacity-100 hover:text-red-500"
                aria-label={`Remove ${asset.name || "upload"} from library`}
                onClick={() => handleRemove(asset.id)}
              >
                <Trash2 size={11} />
              </button>
              <p className="mt-1 truncate text-[10px] text-gray-400" title={asset.name}>
                {asset.name || "Untitled"}
              </p>
              {confirmRemoveId === asset.id && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-lg bg-white/95 p-1 text-center shadow-lg">
                  <p className="text-[10px] font-medium text-gray-700">Used on canvas. Remove anyway?</p>
                  <div className="flex gap-1">
                    <button className="rounded bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white" onClick={() => handleRemove(asset.id)}>
                      Remove
                    </button>
                    <button className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600" onClick={() => setConfirmRemoveId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
