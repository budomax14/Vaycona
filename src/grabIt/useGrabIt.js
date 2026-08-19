import { useCallback, useEffect, useRef, useState } from "react";
import { detectGrabRegions } from "./grabItDetection";
import { getAssetBlob } from "../assetStore";

const MAX_CACHE_ENTRIES = 12;
// Module-level (not per-hook-instance) so reopening Grab It on an unchanged
// image/settings later in the session — even after unmounting the overlay —
// reuses the last result instead of recomputing, per spec's caching
// requirement ("If the user activates Grab It again on the same unchanged
// image, reuse the cached regions").
const detectionCache = new Map();

function cacheKeyFor(item, sensitivity, mergeAmount) {
  if (!item) return null;
  return [item.assetId, JSON.stringify(item.crop || null), !!item.flipX, !!item.flipY, sensitivity, mergeAmount].join("|");
}

// Owns Grab It's detection lifecycle/cache/settings/hover state — kept
// separate from App.jsx (which only threads its return value into the
// overlay + mode toolbar) and separate from the pure grabItDetection.js
// algorithm (which knows nothing about React or caching).
export default function useGrabIt({ item, enabled }) {
  const [sensitivity, setSensitivity] = useState(0.5);
  const [mergeAmount, setMergeAmount] = useState(0.5);
  const [showAllRegions, setShowAllRegions] = useState(false);
  const [hoveredRegionId, setHoveredRegionId] = useState(null);
  const [result, setResult] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);

  const runDetection = useCallback(
    async (bypassCache) => {
      if (!item || !item.assetId) return;
      const key = cacheKeyFor(item, sensitivity, mergeAmount);
      if (!bypassCache && detectionCache.has(key)) {
        const cached = detectionCache.get(key);
        setResult(cached);
        setError(cached.error || null);
        setIsDetecting(false);
        return;
      }
      const requestId = ++requestIdRef.current;
      setIsDetecting(true);
      setError(null);
      try {
        const blob = await getAssetBlob(item.assetId);
        if (!blob) throw new Error("Original image could not be found.");
        const detection = await detectGrabRegions(
          blob,
          { flipX: item.flipX, flipY: item.flipY, crop: item.crop, itemWidth: item.width || 100, itemHeight: item.height || 100 },
          { method: "local", sensitivity, mergeAmount }
        );
        if (requestIdRef.current !== requestId) return; // superseded by a newer request
        detectionCache.set(key, detection);
        if (detectionCache.size > MAX_CACHE_ENTRIES) {
          detectionCache.delete(detectionCache.keys().next().value);
        }
        setResult(detection);
        setError(detection.error || null);
      } catch (err) {
        if (requestIdRef.current !== requestId) return;
        setResult(null);
        setError(err?.message || "Couldn't separate this image automatically. Try Fine Tune or select the area manually.");
      } finally {
        if (requestIdRef.current === requestId) setIsDetecting(false);
      }
    },
    [item, sensitivity, mergeAmount]
  );

  useEffect(() => {
    if (!enabled || !item) {
      setResult(null);
      setError(null);
      return;
    }
    runDetection(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, item?.id, item?.assetId, item?.crop, item?.flipX, item?.flipY, sensitivity, mergeAmount]);

  useEffect(() => {
    setHoveredRegionId(null);
  }, [item?.id, enabled]);

  const resetDetection = useCallback(() => runDetection(true), [runDetection]);

  return {
    regions: result?.regions || [],
    detectionMeta: result
      ? {
          visibleRect: result.visibleRect,
          naturalWidth: result.naturalWidth,
          naturalHeight: result.naturalHeight,
          processingWidth: result.processingWidth,
          processingHeight: result.processingHeight,
          backgroundMode: result.backgroundMode,
          backgroundColor: result.backgroundColor,
          sensitivity,
        }
      : null,
    isDetecting,
    error,
    hoveredRegionId,
    setHoveredRegionId,
    sensitivity,
    setSensitivity,
    mergeAmount,
    setMergeAmount,
    showAllRegions,
    setShowAllRegions,
    resetDetection,
  };
}
