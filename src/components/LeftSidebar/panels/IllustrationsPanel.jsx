import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Download,
  Heart,
  Loader2,
  Plus,
  RefreshCw,
  Wand2,
} from "lucide-react";
import {
  ASPECT_RATIOS,
  ILLUSTRATION_STYLES,
  MAX_ILLUSTRATION_COUNT,
  illustrationGallery,
  requestIllustrations,
} from "../../../aiIllustrationService";
import { useAsset } from "../../../useAsset";
import { getAssetBlob } from "../../../assetStore";

// Converts a generated image (currently always a data: URI — see
// functions/providers/openai.js) into a File so it can go through the same
// asset pipeline every uploaded/pasted/background-removed image already
// uses (putAsset -> assetId -> addImageItem). Registering the asset
// immediately (rather than only when the user clicks "Add to Canvas") is
// what lets a generated illustration be dragged onto the canvas the same
// way an Uploads panel thumbnail is — the existing canvas drop handler
// already knows how to resolve an assetId dropped via
// "application/x-upload-asset-id", so illustrations get drag-to-canvas for
// free with no changes to App.jsx's drop handling.
async function dataUrlToFile(url, name) {
  const blob = await (await fetch(url)).blob();
  return new File([blob], `${name}.png`, { type: blob.type || "image/png" });
}

function slugFromPrompt(prompt) {
  return prompt.trim().slice(0, 60).replace(/\s+/g, " ") || "AI illustration";
}

function IllustrationCard({ entry, onAddToCanvas, onDownload, onRegenerate, onFavorite, generationInFlight }) {
  const { status, objectUrl } = useAsset(entry.assetId);
  const ready = status === "ready" && !entry.regenerating;

  return (
    <div className="group relative flex flex-col gap-1.5">
      <button
        type="button"
        className="relative aspect-square w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50 hover:border-amber-400"
        draggable={ready}
        onDragStart={(event) => {
          event.dataTransfer.setData("application/x-upload-asset-id", entry.assetId);
        }}
        onClick={() => ready && onAddToCanvas(entry)}
        title={ready ? "Click to add, or drag onto the canvas" : "Loading…"}
        aria-label={`Add "${entry.prompt}" illustration to the page`}
      >
        {objectUrl ? (
          <img src={objectUrl} alt={entry.prompt} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <Loader2 size={18} className="animate-spin" />
          </div>
        )}
        {entry.regenerating && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/80">
            <Loader2 size={18} className="animate-spin text-amber-600" />
          </span>
        )}
        <button
          type="button"
          className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 shadow ${
            entry.favorite ? "text-red-500" : "text-gray-400 opacity-0 group-hover:opacity-100"
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onFavorite(entry);
          }}
          aria-label={entry.favorite ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={entry.favorite}
        >
          <Heart size={11} fill={entry.favorite ? "currentColor" : "none"} />
        </button>
      </button>
      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-1 rounded-md border border-gray-200 py-1 text-[10px] font-medium text-gray-600 hover:border-amber-400 hover:text-amber-700 disabled:opacity-50"
          onClick={() => onAddToCanvas(entry)}
          disabled={!ready}
          title="Add to canvas"
        >
          <Plus size={11} /> Add
        </button>
        <button
          type="button"
          className="flex items-center justify-center rounded-md border border-gray-200 p-1 text-gray-500 hover:border-amber-400 hover:text-amber-700 disabled:opacity-50"
          onClick={() => onDownload(entry)}
          disabled={!ready}
          title="Download"
          aria-label="Download illustration"
        >
          <Download size={12} />
        </button>
        <button
          type="button"
          className="flex items-center justify-center rounded-md border border-gray-200 p-1 text-gray-500 hover:border-amber-400 hover:text-amber-700 disabled:opacity-50"
          onClick={() => onRegenerate(entry)}
          disabled={generationInFlight || entry.regenerating}
          title="Regenerate"
          aria-label="Regenerate illustration"
        >
          <RefreshCw size={12} className={entry.regenerating ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );
}

// Real AI Illustration generation panel, opened by the existing
// "Illustrations" sidebar button (no new nav/buttons — see
// LeftSidebar.jsx's SECTIONS list and App.jsx's activeSidebarSection
// wiring). Talks only to this app's own backend via aiIllustrationService
// (never to an AI provider directly); results are registered into the
// normal local asset library as they arrive so "Add to Canvas" and
// drag-to-canvas both reuse the exact same asset pipeline as Uploads.
export default function IllustrationsPanel({ onRegisterAsset, onAddToCanvas, onStatus }) {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState(ILLUSTRATION_STYLES[0].key);
  const [aspectRatio, setAspectRatio] = useState(ASPECT_RATIOS[0].key);
  const [count, setCount] = useState(1);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [extraDetails, setExtraDetails] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [gallery, setGallery] = useState(() => illustrationGallery.getAll());

  const abortRef = useRef(null);
  const elapsedTimerRef = useRef(null);

  useEffect(() => illustrationGallery.subscribe(setGallery), []);

  useEffect(() => {
    if (!isGenerating) {
      window.clearInterval(elapsedTimerRef.current);
      setElapsed(0);
      return undefined;
    }
    const start = Date.now();
    elapsedTimerRef.current = window.setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 500);
    return () => window.clearInterval(elapsedTimerRef.current);
  }, [isGenerating]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function runGeneration({ promptText, styleKey, aspectKey, imageCount, replaceEntryId }) {
    if (isGenerating) return; // prevent duplicate concurrent requests
    const trimmed = promptText.trim();
    if (!trimmed) {
      setError("Please describe the illustration you want to create.");
      return;
    }

    setError(null);
    setIsGenerating(true);
    if (replaceEntryId) illustrationGallery.update(replaceEntryId, { regenerating: true });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const images = await requestIllustrations({
        prompt: trimmed,
        style: styleKey,
        aspectRatio: aspectKey,
        count: imageCount,
        advanced: extraDetails.trim() ? { extraDetails: extraDetails.trim() } : undefined,
        signal: controller.signal,
      });

      const name = slugFromPrompt(trimmed);
      const registered = await Promise.all(
        images.map(async (image) => {
          const file = await dataUrlToFile(image.url, name);
          return onRegisterAsset(file, { name, sourceType: "ai-illustration" });
        })
      );

      const now = Date.now();
      const newEntries = registered
        .filter((result) => result?.id)
        .map((result) => ({
          id: crypto.randomUUID(),
          assetId: result.id,
          prompt: trimmed,
          style: styleKey,
          aspectRatio: aspectKey,
          favorite: false,
          regenerating: false,
          createdAt: now,
        }));

      if (newEntries.length === 0) {
        throw new Error("The generated illustrations could not be saved to your library.");
      }

      if (replaceEntryId && newEntries.length === 1) {
        illustrationGallery.replace(replaceEntryId, newEntries[0]);
      } else {
        illustrationGallery.addMany(newEntries);
      }
      onStatus?.(`Generated ${newEntries.length} illustration${newEntries.length > 1 ? "s" : ""}.`);
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Something went wrong generating your illustration.");
        if (replaceEntryId) illustrationGallery.update(replaceEntryId, { regenerating: false });
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }

  function handleGenerate() {
    runGeneration({ promptText: prompt, styleKey: style, aspectKey: aspectRatio, imageCount: count });
  }

  function handleRegenerate(entry) {
    runGeneration({
      promptText: entry.prompt,
      styleKey: entry.style,
      aspectKey: entry.aspectRatio,
      imageCount: 1,
      replaceEntryId: entry.id,
    });
  }

  function handleFavorite(entry) {
    illustrationGallery.update(entry.id, { favorite: !entry.favorite });
  }

  async function handleDownload(entry) {
    const blob = await getAssetBlob(entry.assetId);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugFromPrompt(entry.prompt)}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleAddToCanvas(entry) {
    onAddToCanvas(entry.assetId);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-800">AI Illustrations</h3>

      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Describe the illustration you want to create..."
        rows={3}
        aria-label="Illustration prompt"
        className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-700 outline-none focus:border-amber-400 focus:bg-white"
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Style</span>
        <div className="grid grid-cols-2 gap-1.5">
          {ILLUSTRATION_STYLES.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`rounded-lg border py-1.5 text-xs font-medium transition-colors ${
                style === opt.key
                  ? "border-amber-400 bg-amber-50 text-amber-700"
                  : "border-gray-200 text-gray-600 hover:border-amber-300 hover:bg-amber-50/50"
              }`}
              onClick={() => setStyle(opt.key)}
              aria-pressed={style === opt.key}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Aspect ratio</span>
        <div className="grid grid-cols-3 gap-1.5">
          {ASPECT_RATIOS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`flex flex-col items-center rounded-lg border py-1.5 text-xs font-medium transition-colors ${
                aspectRatio === opt.key
                  ? "border-amber-400 bg-amber-50 text-amber-700"
                  : "border-gray-200 text-gray-600 hover:border-amber-300 hover:bg-amber-50/50"
              }`}
              onClick={() => setAspectRatio(opt.key)}
              aria-pressed={aspectRatio === opt.key}
            >
              <span>{opt.label}</span>
              <span className="text-[10px] font-normal text-gray-400">{opt.ratio}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Number of images</span>
        <div className="grid grid-cols-4 gap-1.5">
          {Array.from({ length: MAX_ILLUSTRATION_COUNT }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className={`rounded-lg border py-1.5 text-xs font-medium transition-colors ${
                count === n
                  ? "border-amber-400 bg-amber-50 text-amber-700"
                  : "border-gray-200 text-gray-600 hover:border-amber-300 hover:bg-amber-50/50"
              }`}
              onClick={() => setCount(n)}
              aria-pressed={count === n}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
          onClick={() => setAdvancedOpen((v) => !v)}
          aria-expanded={advancedOpen}
        >
          {advancedOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          Advanced settings
        </button>
        {advancedOpen && (
          <textarea
            value={extraDetails}
            onChange={(event) => setExtraDetails(event.target.value)}
            placeholder="Additional details (lighting, color palette, composition...)"
            rows={2}
            aria-label="Additional prompt details"
            className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700 outline-none focus:border-amber-400 focus:bg-white"
          />
        )}
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={isGenerating || !prompt.trim()}
        className="flex items-center justify-center gap-2 rounded-lg bg-amber-500 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isGenerating ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Generating… {elapsed}s
          </>
        ) : (
          <>
            <Wand2 size={15} />
            Generate
          </>
        )}
      </button>
      {isGenerating && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full w-1/3 animate-[ai-progress_1.2s_ease-in-out_infinite] rounded-full bg-amber-400" />
        </div>
      )}

      {error && (
        <div className="flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-xs text-red-600">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {gallery.length === 0 ? (
        <p className="text-xs text-gray-400">Your generated illustrations will appear here.</p>
      ) : (
        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto pb-2">
          {gallery.map((entry) => (
            <IllustrationCard
              key={entry.id}
              entry={entry}
              onAddToCanvas={handleAddToCanvas}
              onDownload={handleDownload}
              onRegenerate={handleRegenerate}
              onFavorite={handleFavorite}
              generationInFlight={isGenerating}
            />
          ))}
        </div>
      )}
    </div>
  );
}
