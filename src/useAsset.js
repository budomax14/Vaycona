import { useEffect, useState } from "react";
import { assetEvents, getAssetBlob, getAssetMeta, listAssetIndex } from "./assetStore";

// Reactively resolves an assetId to a same-origin blob: object URL, which
// slots directly into the existing useImageElement(src, ...) hook (blob:
// URLs don't taint canvases, so useImageElement's canvas-based flip trick
// keeps working unmodified). Revokes the object URL on unmount/assetId
// change to avoid leaking memory, and re-resolves if the asset is replaced/
// repaired elsewhere (via assetStore's tiny pub-sub).
export function useAsset(assetId) {
  const [state, setState] = useState({ status: assetId ? "loading" : "missing", objectUrl: null, meta: null });

  useEffect(() => {
    if (!assetId) {
      setState({ status: "missing", objectUrl: null, meta: null });
      return undefined;
    }
    let cancelled = false;
    let currentUrl = null;

    async function resolve() {
      setState((prev) => ({ ...prev, status: "loading" }));
      const meta = await getAssetMeta(assetId);
      if (cancelled) return;
      if (!meta) {
        setState({ status: "missing", objectUrl: null, meta: null });
        return;
      }
      const blob = await getAssetBlob(assetId);
      if (cancelled) return;
      if (!blob) {
        setState({ status: "missing", objectUrl: null, meta });
        return;
      }
      currentUrl = URL.createObjectURL(blob);
      setState({ status: "ready", objectUrl: currentUrl, meta });
    }

    resolve();
    const unsubscribe = assetEvents.subscribe(assetId, resolve);

    return () => {
      cancelled = true;
      unsubscribe();
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [assetId]);

  return state;
}

// Reactively reads the synchronous localStorage asset index (name/mime/
// dimensions/tiny thumbnail/status per asset) — backs the Uploads panel's
// grid, which needs the whole list rather than one asset at a time. Reads
// straight from the fast localStorage mirror rather than IndexedDB, so the
// panel renders instantly without an async round-trip per row.
export function useAssetList() {
  const [index, setIndex] = useState(() => listAssetIndex());

  useEffect(() => {
    const refresh = () => setIndex(listAssetIndex());
    const unsubscribe = assetEvents.subscribeAll(refresh);
    return unsubscribe;
  }, []);

  return index;
}
