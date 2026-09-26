import { useEffect, useRef, useState } from "react";
import { renderPanelImages, revokePanelImages } from "../../print/panelPreviews";

// Renders static images of a card's panels while `enabled` (a dialog is
// open), re-rendering when the panels or their content change, and frees
// every object URL when disabled/unmounted. See print/panelPreviews.js.
export function usePanelImages(card, items, enabled) {
  const [images, setImages] = useState({});
  const [status, setStatus] = useState("idle");
  const imagesRef = useRef({});

  const panelPages = card ? card.panelOrder.map((key) => card.panels[key]) : [];
  const pageKey = panelPages.map((p) => `${p.id}:${p.width}x${p.height}:${p.background}`).join("|");

  useEffect(() => {
    if (!enabled || !card) return undefined;
    const controller = new AbortController();
    let cancelled = false;
    setStatus("rendering");
    const timer = window.setTimeout(async () => {
      try {
        const next = await renderPanelImages({ pages: panelPages, items, signal: controller.signal });
        if (cancelled) {
          revokePanelImages(next);
          return;
        }
        revokePanelImages(imagesRef.current);
        imagesRef.current = next;
        setImages(next);
        setStatus("done");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }, 150);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pageKey, items]);

  useEffect(() => {
    if (enabled) return;
    revokePanelImages(imagesRef.current);
    imagesRef.current = {};
    setImages({});
    setStatus("idle");
  }, [enabled]);

  useEffect(() => () => revokePanelImages(imagesRef.current), []);

  return { images, status };
}
