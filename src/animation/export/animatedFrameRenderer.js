// Phase 12 — renders one frameTimeline.js frame descriptor to a detached
// canvas. Reuses offscreenRenderer.jsx's `renderPageToCanvas` (the exact
// same primitive PNG/JPEG/PDF export already uses — spec rule 2: reuse the
// existing renderer) for the actual page draw; this module only supplies
// the ANIMATED items array for the requested instant (via
// animationService.computeAnimatedItems) and, for a transition frame,
// composites two rendered pages together using transitionService's opacity/
// offset/scale math — never a second rendering pipeline.

import { renderPageToCanvas } from "../../export/offscreenRenderer";
import { computeAnimatedItems } from "../animationService";
import { computeTransitionFrame } from "../transitionService";

function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

async function renderPageFrame({ pages, items, pageId, timeMs, pixelScale, backgroundFill, availableAssetIds, signal, reducedMotion }) {
  const page = pages.find((p) => p.id === pageId);
  const animatedItems = computeAnimatedItems(items, pageId, timeMs, { reducedMotion });
  return renderPageToCanvas({
    page,
    items: animatedItems,
    pixelScale,
    backgroundFill: backgroundFill ?? page.background ?? "#ffffff",
    availableAssetIds,
    signal,
  });
}

// Renders a single output canvas for one frame descriptor (spec §70/§76).
// `outputSize`: {width, height} — the FIXED output dimensions every frame
// must share (transitions blend two differently-sized page canvases onto
// one canvas at this size, letterboxed/centered).
export async function renderFrame(descriptor, { pages, items, pixelScale, backgroundFill, availableAssetIds, signal, reducedMotion, outputSize }) {
  if (descriptor.kind === "page") {
    const canvas = await renderPageFrame({ pages, items, pageId: descriptor.pageId, timeMs: descriptor.timeMs, pixelScale, backgroundFill, availableAssetIds, signal, reducedMotion });
    if (canvas.width === outputSize.width && canvas.height === outputSize.height) return canvas;
    const out = makeCanvas(outputSize.width, outputSize.height);
    const ctx = out.getContext("2d");
    ctx.drawImage(canvas, (outputSize.width - canvas.width) / 2, (outputSize.height - canvas.height) / 2);
    return out;
  }

  // Transition frame: render both endpoints at their OWN resting state
  // (outgoing at its final time, incoming at time 0 — spec §33 "transition
  // rendering must not modify page objects") and composite per
  // transitionService's deterministic opacity/offset/scale.
  const fromPage = pages.find((p) => p.id === descriptor.fromPageId);
  const toPage = pages.find((p) => p.id === descriptor.toPageId);
  const [outgoingCanvas, incomingCanvas] = await Promise.all([
    renderPageFrame({ pages, items, pageId: descriptor.fromPageId, timeMs: fromPage.duration ?? 5000, pixelScale, backgroundFill, availableAssetIds, signal, reducedMotion }),
    renderPageFrame({ pages, items, pageId: descriptor.toPageId, timeMs: 0, pixelScale, backgroundFill, availableAssetIds, signal, reducedMotion }),
  ]);
  const frame = computeTransitionFrame(descriptor.transition, descriptor.progress, outputSize);
  const out = makeCanvas(outputSize.width, outputSize.height);
  const ctx = out.getContext("2d");

  function drawLayer(canvas, layer) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));
    const cx = outputSize.width / 2 + layer.x;
    const cy = outputSize.height / 2 + layer.y;
    ctx.translate(cx, cy);
    ctx.scale(layer.scaleX, layer.scaleY);
    ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    ctx.restore();
  }
  drawLayer(outgoingCanvas, frame.outgoing);
  drawLayer(incomingCanvas, frame.incoming);
  return out;
}
