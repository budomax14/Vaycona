import React, { useMemo, useRef, useState } from "react";
import { Play, Pause, Square, X, ZoomIn, ZoomOut, Lock, EyeOff } from "lucide-react";
import { buildTimelineTracks, collectSnapTargets, snapTime, msToPx, pxToMs, fitPxPerSecond } from "../../animation/timelineService";
import { DEFAULT_PAGE_DURATION_MS, MIN_ANIMATION_DURATION_MS } from "../../animation/animationSchema";
import { getPreset } from "../../animation/animationRegistry";

const STAGE_COLORS = {
  entrance: "bg-emerald-400 border-emerald-600",
  emphasis: "bg-amber-400 border-amber-600",
  exit: "bg-rose-400 border-rose-600",
  motion: "bg-sky-400 border-sky-600",
};

function formatTime(ms) {
  const s = ms / 1000;
  return `${s.toFixed(1)}s`;
}

// Phase 12 — page-local timeline (spec §36-42). Pure presentational
// component: every time/snap/order calculation comes from
// animation/timelineService.js; this only translates pixels<->ms and wires
// pointer/keyboard events to App.jsx's commit-backed handlers.
export default function Timeline({
  items,
  page,
  selectedIds,
  onSelectIds,
  timeMs,
  isPlaying,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onUpdateAnimation,
  onRemoveClip,
  onDuplicateClip,
  onClose,
  onFitDuration,
  onClearPage,
}) {
  const containerRef = useRef(null);
  const trackAreaRef = useRef(null);
  const [pxPerSecond, setPxPerSecond] = useState(80);
  const [selectedClip, setSelectedClip] = useState(null); // { itemId, animationId }
  const dragRef = useRef(null);

  const pageDuration = page?.duration || DEFAULT_PAGE_DURATION_MS;
  const tracks = useMemo(() => buildTimelineTracks(items, page?.id), [items, page?.id]);

  function handleRulerClick(e) {
    const rect = trackAreaRef.current.getBoundingClientRect();
    const ms = Math.max(0, Math.min(pageDuration, pxToMs(e.clientX - rect.left, pxPerSecond)));
    onSeek(ms);
  }

  function beginDrag(e, track, clip, mode) {
    e.stopPropagation();
    e.preventDefault();
    setSelectedClip({ itemId: track.itemId, animationId: clip.id });
    onSelectIds([track.itemId]);
    const startClientX = e.clientX;
    const startTime = clip.startTime;
    const startDuration = clip.duration;
    dragRef.current = { track, clip, mode, startClientX, startTime, startDuration };

    function handleMove(ev) {
      const d = dragRef.current;
      if (!d) return;
      const deltaMs = pxToMs(ev.clientX - d.startClientX, pxPerSecond);
      const targets = collectSnapTargets(tracks, { excludeAnimationId: d.clip.id, pageDurationMs: pageDuration, playheadMs: timeMs });
      if (d.mode === "move") {
        const raw = Math.max(0, d.startTime + deltaMs);
        const snapped = snapTime(raw, targets, pxToMs(8, pxPerSecond));
        onUpdateAnimation(d.track.itemId, d.clip.id, { startTime: Math.min(snapped, pageDuration - d.startDuration) });
      } else if (d.mode === "resize-end") {
        const raw = d.startTime + d.startDuration + deltaMs;
        const snapped = snapTime(raw, targets, pxToMs(8, pxPerSecond));
        onUpdateAnimation(d.track.itemId, d.clip.id, { duration: Math.max(MIN_ANIMATION_DURATION_MS, snapped - d.startTime) });
      } else if (d.mode === "resize-start") {
        const raw = d.startTime + deltaMs;
        const snapped = snapTime(raw, targets, pxToMs(8, pxPerSecond));
        const clampedStart = Math.max(0, Math.min(snapped, d.startTime + d.startDuration - MIN_ANIMATION_DURATION_MS));
        onUpdateAnimation(d.track.itemId, d.clip.id, { startTime: clampedStart, duration: d.startTime + d.startDuration - clampedStart });
      }
    }
    function handleUp() {
      dragRef.current = null;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  // Scoped keyboard handling (spec §42) — attached to this component's own
  // container via React's onKeyDown, so it only fires while focus is
  // somewhere inside the timeline, and never fights the app's global
  // shortcut hook (see useKeyboardShortcuts.js — untouched by this file).
  function handleKeyDown(e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      isPlaying ? onPause() : onPlay();
    } else if (e.key === "Home") {
      e.stopPropagation();
      onSeek(0);
    } else if (e.key === "End") {
      e.stopPropagation();
      onSeek(pageDuration);
    } else if (e.key === "ArrowLeft") {
      e.stopPropagation();
      onSeek(Math.max(0, timeMs - (e.shiftKey ? 1000 : 100)));
    } else if (e.key === "ArrowRight") {
      e.stopPropagation();
      onSeek(Math.min(pageDuration, timeMs + (e.shiftKey ? 1000 : 100)));
    } else if (e.key === "Delete" || e.key === "Backspace") {
      if (selectedClip) {
        e.stopPropagation();
        onRemoveClip(selectedClip.itemId, selectedClip.animationId);
        setSelectedClip(null);
      }
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setSelectedClip(null);
    }
  }

  const totalWidth = Math.max(400, msToPx(pageDuration, pxPerSecond));

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label="Animation timeline"
      className="flex h-56 shrink-0 flex-col border-t border-gray-200 bg-white outline-none"
    >
      <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-1.5">
        <button onClick={isPlaying ? onPause : onPlay} className="rounded bg-gray-900 p-1.5 text-white" aria-label={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <button onClick={onStop} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Stop">
          <Square size={13} />
        </button>
        <span className="text-xs tabular-nums text-gray-600">{formatTime(timeMs)} / {formatTime(pageDuration)}</span>
        <div className="ml-2 flex items-center gap-1">
          <button onClick={() => setPxPerSecond((v) => Math.max(10, v / 1.4))} className="rounded p-1 text-gray-400 hover:bg-gray-100" aria-label="Zoom out timeline">
            <ZoomOut size={13} />
          </button>
          <button onClick={() => setPxPerSecond((v) => Math.min(500, v * 1.4))} className="rounded p-1 text-gray-400 hover:bg-gray-100" aria-label="Zoom in timeline">
            <ZoomIn size={13} />
          </button>
          <button
            onClick={() => setPxPerSecond(fitPxPerSecond(pageDuration, trackAreaRef.current?.clientWidth || 600))}
            className="rounded px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100"
          >
            Fit
          </button>
        </div>
        <button onClick={onFitDuration} className="rounded px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100">
          Fit page to content
        </button>
        <button onClick={onClearPage} className="rounded px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100">
          Clear page
        </button>
        <button onClick={onClose} className="ml-auto rounded p-1.5 text-gray-400 hover:bg-gray-100" aria-label="Close timeline">
          <X size={14} />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-36 shrink-0 overflow-y-auto border-r border-gray-200">
          <div className="h-6 border-b border-gray-100" />
          {tracks.map((track) => (
            <div
              key={track.itemId}
              className={`flex h-8 items-center gap-1 border-b border-gray-100 px-2 text-xs ${selectedIds.includes(track.itemId) ? "bg-amber-50" : ""}`}
              style={{ paddingLeft: 8 + track.depth * 10 }}
              onClick={() => onSelectIds([track.itemId])}
            >
              <span className="truncate text-gray-700">{track.name}</span>
              {track.locked && <Lock size={10} className="ml-auto shrink-0 text-gray-400" />}
              {track.hidden && <EyeOff size={10} className="shrink-0 text-gray-400" />}
            </div>
          ))}
          {tracks.length === 0 && <div className="p-3 text-[11px] text-gray-400">No objects on this page yet.</div>}
        </div>

        <div ref={trackAreaRef} className="relative flex-1 overflow-x-auto overflow-y-auto" onClick={() => setSelectedClip(null)}>
          <div style={{ width: totalWidth }} className="relative">
            <div className="sticky top-0 z-10 h-6 cursor-pointer border-b border-gray-100 bg-white" onClick={handleRulerClick}>
              {Array.from({ length: Math.ceil(pageDuration / 500) + 1 }).map((_, i) => {
                const ms = i * 500;
                const isSecond = ms % 1000 === 0;
                return (
                  <div key={ms} className="absolute top-0 flex h-full flex-col items-start" style={{ left: msToPx(ms, pxPerSecond) }}>
                    <div className={`w-px ${isSecond ? "h-3 bg-gray-400" : "h-1.5 bg-gray-300"}`} />
                    {isSecond && <span className="text-[9px] text-gray-400">{ms / 1000}s</span>}
                  </div>
                );
              })}
            </div>

            {tracks.map((track) => (
              <div key={track.itemId} className="relative h-8 border-b border-gray-100">
                {track.clips.map((clip) => {
                  const preset = getPreset(clip.presetId);
                  const left = msToPx(clip.startTime + clip.delay, pxPerSecond);
                  const width = Math.max(6, msToPx(clip.duration, pxPerSecond));
                  const isSelected = selectedClip?.animationId === clip.id;
                  return (
                    <div
                      key={clip.id}
                      onPointerDown={(e) => beginDrag(e, track, clip, "move")}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClip({ itemId: track.itemId, animationId: clip.id });
                      }}
                      onDoubleClick={() => onDuplicateClip(track.itemId, clip.id)}
                      title={`${preset?.name || clip.presetId} (${clip.stage})`}
                      className={`absolute top-1 flex h-6 cursor-grab items-center rounded border px-1 text-[10px] text-white ${STAGE_COLORS[clip.stage] || "bg-gray-400 border-gray-600"} ${
                        isSelected ? "ring-2 ring-offset-1 ring-amber-500" : ""
                      }`}
                      style={{ left, width }}
                    >
                      <span
                        className="absolute -left-0.5 top-0 h-full w-1.5 cursor-ew-resize"
                        onPointerDown={(e) => beginDrag(e, track, clip, "resize-start")}
                      />
                      <span className="truncate">{preset?.name || clip.presetId}</span>
                      <span
                        className="absolute -right-0.5 top-0 h-full w-1.5 cursor-ew-resize"
                        onPointerDown={(e) => beginDrag(e, track, clip, "resize-end")}
                      />
                    </div>
                  );
                })}
              </div>
            ))}

            <div
              className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-red-500"
              style={{ left: msToPx(Math.min(timeMs, pageDuration), pxPerSecond) }}
            >
              <div className="h-2 w-2 -translate-x-1/2 bg-red-500" style={{ clipPath: "polygon(50% 100%, 0 0, 100% 0)" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
