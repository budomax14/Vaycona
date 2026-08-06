// Phase 12 — deterministic frame schedule for animated export (spec §70/
// §72). Pure: turns (pages, fps) into an ordered list of frame
// descriptors, each either a plain page frame or a transition frame
// blending two pages. GIF/video export and the preview player share this
// same schedule shape so exported frames match what preview showed (spec
// §79 "export consistency").

import { getPageDuration, getOutgoingTransition } from "../presentationService";

// One page, no transitions — used for "export current page" (spec §70's
// "Current page" scope).
export function buildSinglePageFrameSchedule(page, fps) {
  const duration = getPageDuration(page);
  const frameCount = Math.max(1, Math.round((duration / 1000) * fps));
  const frames = [];
  for (let i = 0; i < frameCount; i++) {
    frames.push({ kind: "page", pageId: page.id, timeMs: Math.min(duration, (i / fps) * 1000) });
  }
  return frames;
}

// Multiple pages with transitions between each pair (spec §70's "Entire
// presentation" / "Selected pages" scope). Transition frames sit BETWEEN
// each page's own frames, at the outgoing page's own transition duration.
export function buildMultiPageFrameSchedule(pages, fps) {
  const frames = [];
  pages.forEach((page, index) => {
    frames.push(...buildSinglePageFrameSchedule(page, fps).map((f) => ({ ...f })));
    const isLast = index === pages.length - 1;
    if (isLast) return;
    const transition = getOutgoingTransition(page);
    if (transition.type === "none") return;
    const nextPage = pages[index + 1];
    const tFrameCount = Math.max(1, Math.round((transition.duration / 1000) * fps));
    for (let i = 1; i <= tFrameCount; i++) {
      frames.push({
        kind: "transition",
        fromPageId: page.id,
        toPageId: nextPage.id,
        transition,
        progress: i / tFrameCount,
      });
    }
  });
  return frames;
}

export function estimateFrameCount(pages, fps, scope) {
  const schedule = scope === "single" ? buildSinglePageFrameSchedule(pages[0], fps) : buildMultiPageFrameSchedule(pages, fps);
  return schedule.length;
}
