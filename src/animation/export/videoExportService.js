// Phase 12 — local WebM video export (spec §71/§72) via MediaRecorder +
// a controlled canvas.captureStream(fps) — one of the spec's explicitly
// approved local encoder strategies. No WebCodecs dependency (not
// universally available), no server. MP4 is NOT claimed/attempted here —
// see spec §71 "do not claim universal MP4 support" — the preflight module
// steers unsupported browsers toward GIF instead.

import { renderFrame } from "./animatedFrameRenderer";
import { ExportCancelledError } from "../../export/offscreenRenderer";

const CANDIDATE_MIME_TYPES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

export function pickSupportedVideoMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  return CANDIDATE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported?.(type)) || null;
}

export function isVideoExportSupported() {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    !!HTMLCanvasElement.prototype.captureStream &&
    !!pickSupportedVideoMimeType()
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// `schedule`: frameTimeline.js output. `fps`: output frame rate — also
// controls how long each rendered frame is held on the capture canvas
// (1000/fps ms), so the recorded duration matches the intended timing.
// `bitsPerSecond`: optional quality knob passed straight to MediaRecorder.
export async function exportVideo({ schedule, renderContext, fps, bitsPerSecond, onProgress, signal }) {
  const mimeType = pickSupportedVideoMimeType();
  if (!mimeType) throw new Error("This browser doesn't support local WebM video encoding.");

  const { outputSize } = renderContext;
  const captureCanvas = document.createElement("canvas");
  captureCanvas.width = outputSize.width;
  captureCanvas.height = outputSize.height;
  const ctx = captureCanvas.getContext("2d");

  const stream = captureCanvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType, ...(bitsPerSecond ? { videoBitsPerSecond: bitsPerSecond } : {}) });
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const stopped = new Promise((resolve, reject) => {
    recorder.onstop = resolve;
    recorder.onerror = (e) => reject(e.error || new Error("Video encoder failed."));
  });

  let cleanedUp = false;
  function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;
    stream.getTracks().forEach((track) => track.stop());
  }

  try {
    recorder.start();
    const frameIntervalMs = 1000 / fps;
    for (let i = 0; i < schedule.length; i++) {
      if (signal?.aborted) throw new ExportCancelledError();
      // eslint-disable-next-line no-await-in-loop
      const frameCanvas = await renderFrame(schedule[i], { ...renderContext, signal });
      ctx.clearRect(0, 0, outputSize.width, outputSize.height);
      ctx.drawImage(frameCanvas, 0, 0);
      onProgress?.({ frameIndex: i + 1, frameCount: schedule.length });
      // eslint-disable-next-line no-await-in-loop
      await delay(frameIntervalMs);
    }
    // Hold the last frame for one more interval so the recorder captures it
    // before stopping.
    await delay(frameIntervalMs);
    recorder.stop();
    await stopped;
    cleanup();
    return new Blob(chunks, { type: mimeType.split(";")[0] });
  } catch (err) {
    try {
      if (recorder.state !== "inactive") recorder.stop();
    } catch {
      // best-effort — encoder may already be in a broken state
    }
    cleanup();
    throw err;
  }
}
