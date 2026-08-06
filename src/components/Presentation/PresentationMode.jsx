import React, { useCallback, useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Play, Pause, Maximize, Repeat } from "lucide-react";
import PresentationPageStage from "./PresentationPageStage";
import { createPlaybackEngine } from "../../animation/playbackService";
import { computeTransitionFrame } from "../../animation/transitionService";
import { getPageDuration, getOutgoingTransition, nextPageIndex, prevPageIndex, clampPageIndex } from "../../animation/presentationService";
import { useResizeObserver } from "../../useResizeObserver";

// Phase 12 — dedicated full-screen presentation mode (spec §48-52). Owns
// its OWN playback engines (one for the current page's object animations,
// one for an in-flight page transition) — never a second parallel timer
// per object; every frame still comes from animationService/
// transitionService, this component only sequences WHICH page/transition
// is currently active.
export default function PresentationMode({ pages, items, presentationSettings, reducedMotion, onUpdatePresentationSettings, initialPageId, onExit }) {
  const containerRef = useRef(null);
  const size = useResizeObserver(containerRef);
  const startIndex = Math.max(0, pages.findIndex((p) => p.id === initialPageId));

  const [pageIndex, setPageIndex] = useState(startIndex === -1 ? 0 : startIndex);
  const [phase, setPhase] = useState("page"); // "page" | "transitioning"
  const [pageTimeMs, setPageTimeMs] = useState(0);
  const [pagePlaying, setPagePlaying] = useState(false);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [pendingIndex, setPendingIndex] = useState(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [autoplay, setAutoplay] = useState(presentationSettings.navigationMode === "autoplay");
  const controlsTimerRef = useRef(null);

  const pageEngineRef = useRef(null);
  const transitionEngineRef = useRef(null);
  const touchStartRef = useRef(null);

  const page = pages[pageIndex];

  const goToIndex = useCallback(
    (targetIndex, { instant = false } = {}) => {
      if (targetIndex == null || targetIndex === pageIndex) return;
      const outgoing = pages[pageIndex];
      const transition = getOutgoingTransition(outgoing);
      pageEngineRef.current?.pause();
      if (instant || transition.type === "none") {
        setPageIndex(clampPageIndex(pages.length, targetIndex));
        setPhase("page");
        setPageTimeMs(0);
        return;
      }
      setPendingIndex(targetIndex);
      setPhase("transitioning");
      transitionEngineRef.current = createPlaybackEngine({
        duration: transition.duration,
        onTick: (t) => setTransitionProgress(t / transition.duration),
        onEnded: () => {
          setPageIndex(clampPageIndex(pages.length, targetIndex));
          setPhase("page");
          setPageTimeMs(0);
          setPendingIndex(null);
        },
      });
      transitionEngineRef.current.play();
    },
    [pageIndex, pages]
  );

  const goNext = useCallback(() => {
    const idx = nextPageIndex(pages.length, pageIndex, presentationSettings.loopMode);
    if (idx == null) {
      setPagePlaying(false);
      return;
    }
    goToIndex(idx);
  }, [pages.length, pageIndex, presentationSettings.loopMode, goToIndex]);

  const goPrev = useCallback(() => {
    goToIndex(prevPageIndex(pages.length, pageIndex, presentationSettings.loopMode));
  }, [pages.length, pageIndex, presentationSettings.loopMode, goToIndex]);

  // (Re)creates the page-local engine whenever the active page changes.
  useEffect(() => {
    if (phase !== "page" || !page) return undefined;
    const duration = getPageDuration(page);
    const engine = createPlaybackEngine({
      duration,
      onTick: (t) => setPageTimeMs(t),
      loop: presentationSettings.loopMode === "page",
      onEnded: () => {
        setPagePlaying(false);
        if (autoplay) goNext();
      },
    });
    pageEngineRef.current = engine;
    engine.play();
    setPagePlaying(true);
    return () => engine.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, phase]);

  useEffect(() => () => transitionEngineRef.current?.destroy(), []);

  function togglePlayPause() {
    if (!pageEngineRef.current) return;
    if (pagePlaying) {
      pageEngineRef.current.pause();
      setPagePlaying(false);
    } else {
      pageEngineRef.current.play();
      setPagePlaying(true);
    }
  }

  function toggleAutoplay() {
    setAutoplay((v) => !v);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else containerRef.current?.requestFullscreen?.().catch(() => {});
  }

  function revealControls() {
    setControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setControlsVisible(false), 2500);
  }

  useEffect(() => {
    revealControls();
    return () => controlsTimerRef.current && clearTimeout(controlsTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Capture-phase + stopPropagation (see Explore/architecture notes): this
  // fully seals off the underlying editor's own keyboard shortcuts while
  // presenting, without needing to touch useKeyboardShortcuts.js.
  useEffect(() => {
    function handleKeyDown(e) {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      } else if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        if (e.key === " " && phase === "page") togglePlayPause();
        else goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Home") {
        e.preventDefault();
        goToIndex(0, { instant: true });
      } else if (e.key === "End") {
        e.preventDefault();
        goToIndex(pages.length - 1, { instant: true });
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key.toLowerCase() === "p") {
        e.preventDefault();
        toggleAutoplay();
      }
      revealControls();
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pageIndex, pages.length, autoplay]);

  function handlePointerDown(e) {
    touchStartRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  }
  function handlePointerUp(e) {
    revealControls();
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dt = Date.now() - start.t;
    if (Math.abs(dx) > 60 && dt < 600) {
      dx < 0 ? goNext() : goPrev();
      return;
    }
    if (Math.abs(dx) < 8) {
      const rect = containerRef.current.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      relX > rect.width / 2 ? goNext() : goPrev();
    }
  }

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!page) return null;
  const viewportWidth = Math.max(1, (size.width || 800) - 32);
  const viewportHeight = Math.max(1, (size.height || 600) - 32);

  const pendingPage = pendingIndex != null ? pages[pendingIndex] : null;
  const transitionStyle =
    phase === "transitioning" && pendingPage
      ? computeTransitionFrame(getOutgoingTransition(page), transitionProgress, { width: viewportWidth, height: viewportHeight })
      : null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onMouseMove={revealControls}
      role="dialog"
      aria-label="Presentation mode"
      aria-modal="true"
    >
      <div className="relative flex items-center justify-center" style={{ width: viewportWidth, height: viewportHeight }}>
        <div
          className="absolute"
          style={
            transitionStyle
              ? {
                  opacity: transitionStyle.outgoing.opacity,
                  transform: `translate(${transitionStyle.outgoing.x}px, ${transitionStyle.outgoing.y}px) scale(${transitionStyle.outgoing.scaleX}, ${transitionStyle.outgoing.scaleY})`,
                }
              : undefined
          }
        >
          <PresentationPageStage page={page} items={items} timeMs={phase === "page" ? pageTimeMs : getPageDuration(page)} reducedMotion={reducedMotion} viewportWidth={viewportWidth} viewportHeight={viewportHeight} />
        </div>
        {transitionStyle && pendingPage && (
          <div
            className="absolute"
            style={{
              opacity: transitionStyle.incoming.opacity,
              transform: `translate(${transitionStyle.incoming.x}px, ${transitionStyle.incoming.y}px) scale(${transitionStyle.incoming.scaleX}, ${transitionStyle.incoming.scaleY})`,
            }}
          >
            <PresentationPageStage page={pendingPage} items={items} timeMs={0} reducedMotion={reducedMotion} viewportWidth={viewportWidth} viewportHeight={viewportHeight} />
          </div>
        )}
      </div>

      {controlsVisible && (
        <>
          <button onClick={onExit} className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Exit presentation">
            <X size={18} />
          </button>

          <button onClick={goPrev} className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Previous page">
            <ChevronLeft size={20} />
          </button>
          <button onClick={goNext} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Next page">
            <ChevronRight size={20} />
          </button>

          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-white/10 px-4 py-2 text-white backdrop-blur">
            <button onClick={togglePlayPause} aria-label={pagePlaying ? "Pause" : "Play"}>
              {pagePlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button
              onClick={toggleAutoplay}
              className={autoplay ? "text-emerald-400" : "text-white/70"}
              title="Toggle autoplay"
              aria-pressed={autoplay}
            >
              <Repeat size={16} />
            </button>
            <span className="text-xs tabular-nums">{pageIndex + 1} / {pages.length}</span>
            <button onClick={toggleFullscreen} aria-label="Toggle fullscreen">
              <Maximize size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
