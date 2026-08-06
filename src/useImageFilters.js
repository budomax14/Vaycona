import { useEffect } from "react";
import { buildFilterPipeline, hasAnyAdjustment } from "./imageEffects";

// The one place node.cache()+node.filters([...]) gets called — ImageNode.jsx
// and FrameNode.jsx both call this with their own node ref, so filter math
// is never duplicated across renderers (per the Phase 6 spec's explicit
// "avoid implementing unrelated filter calculations separately in multiple
// renderers" requirement).
export function useImageFilters(nodeRef, image, adjustments) {
  useEffect(() => {
    const node = nodeRef.current;
    if (!node || !image) return undefined;

    if (!hasAnyAdjustment(adjustments)) {
      node.clearCache();
      node.filters([]);
      node.getLayer()?.batchDraw();
      return undefined;
    }

    const { filters, props } = buildFilterPipeline(adjustments);
    node.setAttrs(props);
    node.cache();
    node.filters(filters);
    node.getLayer()?.batchDraw();

    return () => {
      // Re-run on every dependency change (image swap, adjustment edit) —
      // clear the stale cache first so a just-replaced image doesn't
      // briefly show the previous image's cached, filtered bitmap.
      node.clearCache();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeRef, image, JSON.stringify(adjustments)]);
}
