// Phase 12 — pure presentation-navigation helpers (spec §48-52). The
// stateful orchestration (which playbackService engine is currently
// running, when to start a transition) lives in the PresentationMode
// component itself since it's UI-lifecycle state, not frame math — but
// every actual TIME/INDEX calculation is centralized here so the component
// never derives "what page comes next" or "how long is this page" ad hoc.

import { DEFAULT_PAGE_DURATION_MS } from "./animationSchema";

export function getPageDuration(page) {
  return Number.isFinite(page?.duration) ? page.duration : DEFAULT_PAGE_DURATION_MS;
}

export function getOutgoingTransition(page) {
  return page?.transition || { type: "none", duration: 500, direction: null, easing: "easeOut" };
}

// Returns the next page index, or null when there is no next page and the
// presentation should simply stop (loopMode "none").
export function nextPageIndex(pageCount, currentIndex, loopMode) {
  const next = currentIndex + 1;
  if (next < pageCount) return next;
  if (loopMode === "presentation") return 0;
  return null;
}

export function prevPageIndex(pageCount, currentIndex, loopMode) {
  const prev = currentIndex - 1;
  if (prev >= 0) return prev;
  if (loopMode === "presentation") return pageCount - 1;
  return currentIndex;
}

export function clampPageIndex(pageCount, index) {
  return Math.min(pageCount - 1, Math.max(0, index));
}
