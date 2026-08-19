import { useEffect } from "react";
import { buildFilterPipeline, hasAnyAdjustment } from "./imageEffects";
import { buildOpacityMaskFilter, hasActiveOpacityMask, IDENTITY_MASK_GEOMETRY } from "./opacityMask";

// The one place node.cache()+node.filters([...]) gets called — ImageNode.jsx,
// FrameNode.jsx and ShapeNode.jsx all call this with their own node ref, so
// filter math is never duplicated across renderers (per the Phase 6 spec's
// explicit "avoid implementing unrelated filter calculations separately in
// multiple renderers" requirement — the Fade/opacity-mask filter reuses this
// exact same pipeline rather than a separate masking mechanism).
//
// `requireImage`: ImageNode/FrameNode must wait for their async asset to
// resolve to a real Konva Image before caching (there's nothing to rasterize
// yet); ShapeNode has no such dependency (its sceneFunc draws synchronously
// from item fields), so it passes `image: true, requireImage: false`.
// `geometry`: only meaningful for opacityMask (see opacityMask.js's
// resolveMaskGeometry) — identity for a node whose own local box already IS
// the full item box (every ShapeNode call, and ImageNode/FrameNode whenever
// the crop layout isn't letterboxed).
// `cacheBounds`: explicit {x,y,width,height} passed straight to node.cache().
// Needed for ShapeNode — Konva's default cache() auto-sizes the raster via
// getClientRect(), which PADS OUT for stroke/shadow, breaking the 1:1 pixel
// <-> normalized-mask-coordinate mapping the fade filter assumes. A plain
// KonvaImage (ImageNode/FrameNode) has no stroke/shadow of its own, so its
// getClientRect already exactly matches (0,0,width,height) and no override
// is needed there.
export function useImageFilters(nodeRef, image, adjustments, opacityMask, geometry, { requireImage = true, cacheBounds } = {}) {
  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return undefined;
    if (requireImage && !image) return undefined;

    const maskActive = hasActiveOpacityMask(opacityMask);
    if (!hasAnyAdjustment(adjustments) && !maskActive) {
      node.clearCache();
      node.filters([]);
      node.getLayer()?.batchDraw();
      return undefined;
    }

    const { filters, props } = buildFilterPipeline(adjustments);
    // Appended last — see opacityMask.js's buildOpacityMaskFilter comment on
    // why the fade should taper alpha AFTER color/blur adjustments run.
    if (maskActive) filters.push(buildOpacityMaskFilter(opacityMask, geometry || IDENTITY_MASK_GEOMETRY));
    node.setAttrs(props);
    node.cache(cacheBounds || undefined);
    node.filters(filters);
    node.getLayer()?.batchDraw();

    return () => {
      // Re-run on every dependency change (image swap, adjustment edit,
      // fade edit, resize) — clear the stale cache first so a just-changed
      // node doesn't briefly show the previous cached, filtered bitmap.
      node.clearCache();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeRef, image, requireImage, JSON.stringify(adjustments), JSON.stringify(opacityMask), JSON.stringify(geometry), JSON.stringify(cacheBounds)]);
}
