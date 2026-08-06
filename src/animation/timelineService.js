// Phase 12 — timeline data helpers (spec §36-42). Pure functions only; the
// Timeline React component (src/components/Timeline/Timeline.jsx) renders
// whatever this module computes and calls back into App.jsx's commit()
// wrappers for any edit — it never mutates animation data directly.

import { buildLayerTree } from "../hierarchy";
import { MIN_ANIMATION_DURATION_MS } from "./animationSchema";

// One row per object that has at least one animation OR is eligible to
// receive one, ordered to match the Layers panel (spec §38: "track order
// should normally follow layer order... reordering timeline tracks must
// not reorder layers"). Groups appear as an expandable row; their own
// clips (if the group itself carries an animation) show on the group's row.
export function buildTimelineTracks(items, pageId) {
  const tree = buildLayerTree(items, pageId);
  const rows = [];
  function walk(nodes, depth) {
    for (const { item, children } of nodes) {
      rows.push({
        itemId: item.id,
        name: itemLabel(item),
        type: item.type,
        depth,
        hidden: !!item.hidden,
        locked: !!item.locked,
        isGroup: item.type === "group",
        clips: (item.animations || []).map((a) => ({ ...a })),
      });
      if (children.length) walk(children, depth + 1);
    }
  }
  walk(tree, 0);
  return rows;
}

function itemLabel(item) {
  if (item.type === "text") return (item.text || "Text").slice(0, 24);
  if (item.type === "group") return item.name || "Group";
  return item.type.charAt(0).toUpperCase() + item.type.slice(1);
}

// --- clip editing (pure — returns updated animation fields; caller wraps
// in updateAnimation()/commit()) ---

export function moveClip(anim, newStartTime, pageDurationMs) {
  const maxStart = Math.max(0, pageDurationMs - anim.duration);
  return { startTime: Math.min(maxStart, Math.max(0, Math.round(newStartTime))) };
}

export function resizeClipStart(anim, newStartTime) {
  const end = anim.startTime + anim.delay + anim.duration;
  const clampedStart = Math.max(0, Math.min(newStartTime, end - MIN_ANIMATION_DURATION_MS));
  return { startTime: clampedStart, duration: end - clampedStart - anim.delay };
}

export function resizeClipEnd(anim, newEndTime, pageDurationMs) {
  const start = anim.startTime + anim.delay;
  const clampedEnd = Math.max(start + MIN_ANIMATION_DURATION_MS, Math.min(newEndTime, pageDurationMs));
  return { duration: clampedEnd - start };
}

// --- snapping (spec §40) ---

// Returns a sorted, deduped list of candidate snap times (ms) from every
// OTHER clip's start/end plus page bounds and the playhead.
export function collectSnapTargets(tracks, { excludeAnimationId, pageDurationMs, playheadMs } = {}) {
  const targets = new Set([0, pageDurationMs]);
  if (Number.isFinite(playheadMs)) targets.add(Math.round(playheadMs));
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (clip.id === excludeAnimationId) continue;
      targets.add(clip.startTime + clip.delay);
      targets.add(clip.startTime + clip.delay + clip.duration);
    }
  }
  // Whole/half-second gridlines up to the page duration — spec §40.
  for (let s = 0; s <= pageDurationMs; s += 500) targets.add(s);
  return [...targets].sort((a, b) => a - b);
}

export function snapTime(time, targets, thresholdMs = 80) {
  let best = time;
  let bestDist = thresholdMs;
  for (const t of targets) {
    const d = Math.abs(t - time);
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return best;
}

// --- zoom helpers (timeline zoom is independent of canvas zoom — spec §41) ---

export function msToPx(ms, pxPerSecond) {
  return (ms / 1000) * pxPerSecond;
}

export function pxToMs(px, pxPerSecond) {
  return (px / pxPerSecond) * 1000;
}

export function fitPxPerSecond(durationMs, availableWidthPx) {
  const seconds = Math.max(0.5, durationMs / 1000);
  return Math.max(20, Math.min(400, availableWidthPx / seconds));
}
