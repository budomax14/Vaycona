// Phase 12 — the ONE playback clock (spec §43: "do not use one independent
// timer per object"). A single requestAnimationFrame loop drives every
// preview/timeline/presentation surface; each just subscribes to this
// engine's ticks rather than running its own rAF. Monotonic (performance.
// now()-based, not accumulated per-tick deltas) so seeking/pausing/resuming
// never drifts, and a hidden tab simply stops receiving rAF callbacks (the
// browser's own behavior) — on return, the per-tick delta is NOT clamped
// away here because the engine reads absolute elapsed wall time, so
// resuming from a hidden tab correctly reflects real elapsed time rather
// than jumping unpredictably.

export function createPlaybackEngine({ duration, onTick, onEnded, loop = false, speed = 1 } = {}) {
  let state = {
    duration: Math.max(1, duration || 1),
    time: 0, // ms, always within [0, duration]
    playing: false,
    speed: speed || 1,
    loop,
  };
  let rafId = null;
  let wallStartMs = 0; // performance.now() at the moment playback last (re)started
  let timeAtStart = 0; // state.time at that moment

  function now() {
    return performance.now();
  }

  function computeTime() {
    if (!state.playing) return state.time;
    const elapsed = (now() - wallStartMs) * state.speed;
    return timeAtStart + elapsed;
  }

  function tick() {
    if (!state.playing) return;
    let t = computeTime();
    if (t >= state.duration) {
      if (state.loop) {
        // Re-anchor so the loop wraps without accumulating drift.
        const overshoot = t % state.duration;
        wallStartMs = now();
        timeAtStart = 0;
        t = overshoot;
      } else {
        t = state.duration;
        state.time = t;
        state.playing = false;
        onTick?.(t);
        onEnded?.();
        rafId = null;
        return;
      }
    }
    state.time = t;
    onTick?.(t);
    rafId = requestAnimationFrame(tick);
  }

  return {
    play() {
      if (state.playing) return;
      if (state.time >= state.duration) state.time = 0;
      state.playing = true;
      wallStartMs = now();
      timeAtStart = state.time;
      rafId = requestAnimationFrame(tick);
    },
    pause() {
      if (!state.playing) return;
      state.time = computeTime();
      state.playing = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      onTick?.(state.time);
    },
    resume() {
      this.play();
    },
    stop() {
      state.playing = false;
      state.time = 0;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      onTick?.(0);
    },
    seek(ms) {
      const clamped = Math.min(state.duration, Math.max(0, ms));
      state.time = clamped;
      if (state.playing) {
        wallStartMs = now();
        timeAtStart = clamped;
      }
      onTick?.(clamped);
    },
    setSpeed(nextSpeed) {
      // Re-anchor so an in-flight play doesn't jump when speed changes.
      if (state.playing) {
        state.time = computeTime();
        wallStartMs = now();
        timeAtStart = state.time;
      }
      state.speed = nextSpeed || 1;
    },
    setLoop(nextLoop) {
      state.loop = !!nextLoop;
    },
    setDuration(nextDuration) {
      state.duration = Math.max(1, nextDuration || 1);
      state.time = Math.min(state.time, state.duration);
    },
    getTime() {
      return state.playing ? computeTime() : state.time;
    },
    isPlaying() {
      return state.playing;
    },
    destroy() {
      state.playing = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    },
  };
}
