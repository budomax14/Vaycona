import { useEffect, useRef, useState } from "react";
import { renderLabelPreviewImages } from "../../print/labelPdf";

function groupItemsByPage(items, pageIds) {
  const byPage = new Map();
  items.forEach((item) => {
    if (!pageIds.has(item.pageId)) return;
    if (!byPage.has(item.pageId)) byPage.set(item.pageId, []);
    byPage.get(item.pageId).push(item);
  });
  return byPage;
}

// Items are replaced, never mutated, so "same page object + same item
// objects" means the label looks exactly as it did when last rendered.
function unchanged(rendered, page, pageItems) {
  return !!rendered && rendered.page === page && rendered.items.length === pageItems.length && rendered.items.every((it, i) => it === pageItems[i]);
}

// Static, shape-clipped images of label pages for the sheet map and the
// print preview ({ [pageId]: objectURL } as a Map), rendered through the
// same renderLabelCanvas() as the print PDF. Only labels whose page or
// objects changed are re-rendered (debounced, one at a time), so editing
// one label of thirty doesn't redraw the other twenty-nine. URLs are
// revoked when replaced, when their page goes away, and when disabled.
export function useLabelImages({ pages, items, label, enabled, pxPerInch, debounceMs = 400 }) {
  const [images, setImages] = useState(() => new Map());
  const [progress, setProgress] = useState({ rendering: false, done: 0, total: 0 });
  const imagesRef = useRef(new Map());
  const renderedRef = useRef(new Map());

  function reset() {
    imagesRef.current.forEach((url) => URL.revokeObjectURL(url));
    imagesRef.current = new Map();
    renderedRef.current = new Map();
    setImages(imagesRef.current);
    setProgress({ rendering: false, done: 0, total: 0 });
  }

  useEffect(() => {
    if (!enabled || !label) return undefined;
    const pageIds = new Set(pages.map((p) => p.id));
    // Drop images of pages that no longer exist.
    let pruned = false;
    imagesRef.current.forEach((url, id) => {
      if (pageIds.has(id)) return;
      URL.revokeObjectURL(url);
      imagesRef.current.delete(id);
      renderedRef.current.delete(id);
      pruned = true;
    });
    if (pruned) setImages(new Map(imagesRef.current));

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const byPage = groupItemsByPage(items, pageIds);
      const snapshots = new Map();
      const stale = pages.filter((page) => {
        const pageItems = byPage.get(page.id) || [];
        if (unchanged(renderedRef.current.get(page.id), page, pageItems)) return false;
        snapshots.set(page.id, { page, items: pageItems });
        return true;
      });
      if (stale.length === 0) return;
      let done = 0;
      setProgress({ rendering: true, done, total: stale.length });
      renderLabelPreviewImages({
        pages: stale,
        items,
        label,
        pxPerInch,
        signal: controller.signal,
        onImage: (pageId, url) => {
          const old = imagesRef.current.get(pageId);
          if (old) URL.revokeObjectURL(old);
          imagesRef.current.set(pageId, url);
          renderedRef.current.set(pageId, snapshots.get(pageId));
          setImages(new Map(imagesRef.current));
          done += 1;
          setProgress({ rendering: done < stale.length, done, total: stale.length });
        },
      })
        .catch(() => {})
        .finally(() => {
          if (!controller.signal.aborted) setProgress((p) => ({ ...p, rendering: false }));
        });
    }, debounceMs);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pages, items, label, pxPerInch]);

  useEffect(() => {
    if (!enabled) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => () => imagesRef.current.forEach((url) => URL.revokeObjectURL(url)), []);

  return { images, progress };
}
