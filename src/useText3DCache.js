import { useLayoutEffect } from "react";
import { getText3DBoundsPadding } from "./text3D";

// The 3D-text sibling to useImageFilters.js's node.cache() pattern: once
// depth > 0, redrawing N stepped extrusion copies on every drag/pan/zoom
// frame is unnecessary work when nothing about the effect actually
// changed. Caching the whole ref'd Group to one bitmap makes steady-state
// redraw cost independent of step count (bounded at MAX_TEXT3D_STEPS
// anyway — see text3D.js) — this hook is what makes "large depth + large
// font + many 3D text elements + zoom/move" stay responsive.
// `cacheKey`: caller-supplied JSON string covering every prop that affects
// the rendered pixels (text content, font, fill/gradient/image, background/
// border, width/height) — mirrors useImageFilters.js's own dependency-array
// convention (JSON.stringify the things that must invalidate the cache).
export function useText3DCache(nodeRef, text3D, width, height, cacheKey) {
  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) return undefined;
    if (!text3D?.enabled || (text3D.depth ?? 0) <= 0) {
      node.clearCache();
      return undefined;
    }
    const pad = getText3DBoundsPadding(text3D);
    node.cache({
      x: -pad.left,
      y: -pad.top,
      width: Math.max(1, width + pad.left + pad.right),
      height: Math.max(1, height + pad.top + pad.bottom),
    });
    node.getLayer()?.batchDraw();
    return () => {
      node.clearCache();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeRef, width, height, JSON.stringify(text3D), cacheKey]);
}
