// Phase 12 — local, in-browser animated GIF export (spec §69/§70) using
// `gifenc` (a small, dependency-free, purely local encoder — no server,
// satisfies spec §72 "do not use a remote server"). Every frame is
// rendered through the shared animatedFrameRenderer.js (spec §70 "use the
// shared animation renderer").

import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { GIF_MAX_COLORS } from "../../export/exportConstants";
import { renderFrame } from "./animatedFrameRenderer";
import { ExportCancelledError } from "../../export/offscreenRenderer";

function canvasToImageData(canvas) {
  const ctx = canvas.getContext("2d");
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// `schedule`: frameTimeline.js output. `frameDelayMs`: per-frame GIF delay
// (derived from fps). `onProgress({frameIndex, frameCount})`. Returns a
// Blob (image/gif). Cooperative cancellation via AbortSignal — checked
// between every frame, matching the export pipeline's existing convention
// (offscreenRenderer.jsx's ExportCancelledError).
export async function exportGif({ schedule, renderContext, frameDelayMs, loopCount = 0, onProgress, signal }) {
  const gif = GIFEncoder();
  const { outputSize } = renderContext;

  for (let i = 0; i < schedule.length; i++) {
    if (signal?.aborted) throw new ExportCancelledError();
    // eslint-disable-next-line no-await-in-loop
    const canvas = await renderFrame(schedule[i], { ...renderContext, signal });
    const { data } = canvasToImageData(canvas);
    const palette = quantize(data, GIF_MAX_COLORS, { format: "rgb565" });
    const index = applyPalette(data, palette, "rgb565");
    gif.writeFrame(index, outputSize.width, outputSize.height, {
      palette,
      delay: frameDelayMs,
      repeat: loopCount === 0 ? 0 : loopCount === -1 ? -1 : loopCount,
      first: i === 0,
    });
    onProgress?.({ frameIndex: i + 1, frameCount: schedule.length });
    // Yield back to the main thread between frames (spec §81 — process
    // incrementally, don't freeze the tab).
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}
