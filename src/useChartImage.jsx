import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import ChartRenderer from "./components/ChartRenderer";

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

// Renders item's chart off-screen via ChartRenderer (real Recharts SVG),
// serializes the resulting <svg> to a data URI, and loads that into a
// plain HTMLImageElement — the same "off-screen render -> rasterize ->
// feed a Konva Image" shape ImageNode.jsx/useImageElement.js already use
// for uploaded photos, and the mount idiom export/offscreenRenderer.jsx
// uses for full-page export (detached, position:fixed container +
// createRoot). Because the result is a same-origin data: URI image, it
// draws cleanly into any <canvas> — including Konva's own toDataURL/
// toCanvas export path — with no CORS taint.
//
// Debounced so dragging a resize handle or typing in the data editor
// doesn't re-render+serialize+decode on every pixel/keystroke (spec §22).
export function useChartImage(item, width, height, { debounceMs = 150 } = {}) {
  const [image, setImage] = useState(null);
  const timeoutRef = useRef(null);
  const tokenRef = useRef(0);

  const w = Math.max(20, Math.round(width || 20));
  const h = Math.max(20, Math.round(height || 20));

  // Only the fields that actually affect the rendered chart — deliberately
  // excludes x/y/rotation/opacity/locked/etc, which Konva already handles
  // on the outer Group and must NOT trigger a re-rasterize.
  const depKey = JSON.stringify({
    chartKind: item.chartKind,
    title: item.title,
    data: item.data,
    series: item.series,
    settings: item.settings,
    sliceColors: item.sliceColors,
    w,
    h,
  });

  useEffect(() => {
    const token = ++tokenRef.current;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-99999px";
      container.style.top = "0";
      container.setAttribute("aria-hidden", "true");
      document.body.appendChild(container);

      let root;
      (async () => {
        try {
          root = createRoot(container);
          root.render(<ChartRenderer item={item} width={w} height={h} />);
          // Explicit width/height (no ResponsiveContainer/ResizeObserver)
          // means Recharts lays out synchronously during render, but give
          // it a couple of frames to be safe before reading the DOM.
          await nextFrame();
          await nextFrame();
          if (token !== tokenRef.current) return;

          const svgEl = container.querySelector("svg");
          if (!svgEl) return;
          svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
          const svgString = new XMLSerializer().serializeToString(svgEl);
          const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

          const img = new window.Image();
          img.onload = () => {
            if (token === tokenRef.current) setImage(img);
          };
          img.onerror = () => {
            if (token === tokenRef.current) setImage(null);
          };
          img.src = dataUri;
        } finally {
          root?.unmount();
          container.remove();
        }
      })();
    }, debounceMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // depKey is derived from exactly the values the effect body closes
    // over (item/w/h), so this correctly re-runs only when a rendered
    // field actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  useEffect(
    () => () => {
      tokenRef.current += 1;
    },
    []
  );

  return image;
}
