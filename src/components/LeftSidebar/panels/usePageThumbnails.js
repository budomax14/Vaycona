import { useEffect, useRef, useState } from "react";

const THUMBNAIL_DEBOUNCE_MS = 500;

// Manages a small queue of "needs a fresh thumbnail" page ids, processed
// one at a time through a single reusable offscreen Stage (mounted by the
// caller via ThumbnailStage — this hook only owns the queue/cache, not
// the rendering). Regeneration is debounced after items/pages change, not
// triggered on every pointer-move; a page not currently in view simply
// stays queued and renders lazily the next time it's actually requested.
export function usePageThumbnails(pages, items) {
  const [thumbnails, setThumbnails] = useState(() => new Map());
  const [renderingPageId, setRenderingPageId] = useState(null);
  const queueRef = useRef([]);
  const debounceRef = useRef(null);
  const pageIdsRef = useRef(pages.map((p) => p.id).join("|"));

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const currentIds = pages.map((p) => p.id);
      pageIdsRef.current = currentIds.join("|");
      currentIds.forEach((id) => {
        if (!queueRef.current.includes(id)) queueRef.current.push(id);
      });
      setRenderingPageId((current) => current ?? queueRef.current.shift() ?? null);
    }, THUMBNAIL_DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
    // Re-runs whenever items or pages change — items covers content edits,
    // pages covers background/size/add/duplicate changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, pages]);

  function handleCapture(pageId, dataUrl) {
    if (dataUrl) {
      setThumbnails((prev) => {
        const next = new Map(prev);
        next.set(pageId, dataUrl);
        return next;
      });
    }
    setRenderingPageId(queueRef.current.shift() ?? null);
  }

  return { thumbnails, renderingPageId, handleCapture };
}
