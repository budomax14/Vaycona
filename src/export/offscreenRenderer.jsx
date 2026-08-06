// Phase 9 — the shared render pipeline every raster exporter (PNG/JPEG/PDF
// page rasterization) goes through. Deliberately modeled on
// ThumbnailStage.jsx/PagesPanel.jsx's existing "mount an offscreen Stage,
// reuse DesignNode + the object registry, capture, unmount" pattern (spec
// rule 2: reuse the existing renderer, don't build a second one) — the only
// real differences here are: full export resolution instead of a fixed
// thumbnail box, an explicit wait for real image decode (not thumbnails'
// one-frame-and-hope), and a detached root mounted outside the App.jsx
// tree so export never touches editor state (spec §9 rendering
// independence).

import React from "react";
import { createRoot } from "react-dom/client";
import { Layer, Rect, Stage } from "react-konva";
import DesignNode from "../DesignNode";
import { isEffectivelyHidden } from "../hierarchy";
import { borderDashProps } from "../borderStyles";

const noop = () => {};

export class ExportCancelledError extends Error {
  constructor() {
    super("Export was cancelled.");
    this.name = "ExportCancelledError";
  }
}

function throwIfCancelled(signal) {
  if (signal?.aborted) throw new ExportCancelledError();
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// One Stage rendering exactly the durable content of one page — page
// background + every visible, non-group item in layer order, via the same
// DesignNode/registry renderer the live editor and ThumbnailStage both
// use. No Transformer, no selection/drag handlers, no rulers/guides/grid —
// those are editor-only overlays that were never part of this tree even on
// the live canvas (see App.jsx's renderActivePage), so excluding them here
// requires no special-casing (spec §9/§24).
function ExportPageStage({ page, items, pixelScale, backgroundFill, stageRef }) {
  const width = Math.max(1, Math.round(page.width * pixelScale));
  const height = Math.max(1, Math.round(page.height * pixelScale));
  const itemsById = new Map(items.map((it) => [it.id, it]));
  const visibleItems = items.filter((item) => item.pageId === page.id && item.type !== "group" && !isEffectivelyHidden(item, itemsById));

  return (
    <Stage ref={stageRef} width={width} height={height} scaleX={pixelScale} scaleY={pixelScale} listening={false}>
      <Layer>
        {backgroundFill && <Rect x={0} y={0} width={page.width} height={page.height} fill={backgroundFill} />}
        {visibleItems.map((item) => (
          <DesignNode
            key={item.id}
            item={item}
            isSpaceDown={false}
            isEditingText={false}
            isLocked
            onSelect={noop}
            onContextMenu={noop}
            onDragStart={noop}
            onDragMove={noop}
            onDragEnd={noop}
            onItemDblClick={noop}
            dragBoundFunc={undefined}
            registerNode={noop}
          />
        ))}
        {page.border?.enabled && (
          <Rect
            x={0}
            y={0}
            width={page.width}
            height={page.height}
            stroke={page.border.color || "#111827"}
            strokeWidth={page.border.width ?? 4}
            {...borderDashProps(page.border.style, page.border.width)}
            listening={false}
          />
        )}
      </Layer>
    </Stage>
  );
}

function countExpectedImageNodes(page, items, availableAssetIds) {
  const itemsById = new Map(items.map((it) => [it.id, it]));
  return items.filter((item) => {
    if (item.pageId !== page.id || isEffectivelyHidden(item, itemsById)) return false;
    if (item.type === "image") return !!item.assetId && availableAssetIds.has(item.assetId);
    if (item.type === "frame") return !!item.contentAssetId && availableAssetIds.has(item.contentAssetId);
    return false;
  }).length;
}

// Polls (via rAF) until every image-backed node in the stage has resolved
// its real bitmap — ImageNode/FrameNode only ever mount a real Konva
// `Image` once useAsset+useImageElement resolve to a ready image (see
// those files); until then they render an inert placeholder Shape instead.
// So "count of Image nodes >= expected" is an exact readiness signal, not
// a heuristic guess, with no changes needed to either renderer. Bounded by
// a generous timeout so one corrupt/never-resolving asset can't hang an
// entire export — the page still renders (with that item's placeholder)
// and the caller is free to note the timeout as a warning.
async function waitForImagesReady(stage, expectedCount, { timeoutMs = 8000, signal } = {}) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    throwIfCancelled(signal);
    if (stage.find("Image").length >= expectedCount) break;
    // eslint-disable-next-line no-await-in-loop
    await nextFrame();
  }
  // A couple of extra frames: useImageFilters' node.cache()+filters() call
  // runs in an effect that fires after the Image node itself has already
  // mounted, and Konva's own layer redraw is batched onto the next frame.
  await nextFrame();
  await nextFrame();
}

// Renders one page at the given pixel scale (output px per page px) into a
// detached HTMLCanvasElement. `availableAssetIds` (a Set) comes from the
// export preflight pass so this never re-derives asset availability itself.
// `backgroundFill`: a CSS color string, or null for a transparent canvas.
export async function renderPageToCanvas({ page, items, pixelScale, backgroundFill, availableAssetIds, signal }) {
  throwIfCancelled(signal);
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.setAttribute("aria-hidden", "true");
  document.body.appendChild(container);

  let root;
  let stageInstance = null;
  try {
    root = createRoot(container);
    await new Promise((resolve) => {
      root.render(
        <ExportPageStage
          page={page}
          items={items}
          pixelScale={pixelScale}
          backgroundFill={backgroundFill}
          stageRef={(node) => {
            stageInstance = node;
          }}
        />
      );
      // Mount is synchronous inside render() for a fresh root, but give it
      // one microtask/frame turn before reading stageInstance defensively.
      requestAnimationFrame(resolve);
    });
    throwIfCancelled(signal);
    if (!stageInstance) throw new Error("Export render stage failed to mount.");

    const expected = countExpectedImageNodes(page, items, availableAssetIds);
    await waitForImagesReady(stageInstance, expected, { signal });
    throwIfCancelled(signal);

    let canvas;
    try {
      canvas = stageInstance.toCanvas({ pixelRatio: 1 });
    } catch (err) {
      throw new Error(`Could not render this page (${err?.message || "canvas error"}).`);
    }
    return canvas;
  } finally {
    // Always unmount/detach even on error or cancellation — a failed
    // export must never leak an offscreen Stage/canvas (spec §44/§63).
    root?.unmount();
    container.remove();
  }
}

// Best-effort settle so a burst of consecutive page renders doesn't starve
// the main thread / keep the tab feeling frozen on very large exports.
export async function yieldToMainThread() {
  await delay(0);
}
