// TEMPORARY diagnostics for the phone "elements invisible" investigation.
// Off by default. Enable with `?canvasDebug=1` in the URL (or
// localStorage.setItem("vaycona-canvas-debug", "1")). When enabled it logs
// the viewport/stage/element numbers to the console AND mirrors them into an
// on-screen panel, because an iPhone has no easy console — open the same
// saved project on desktop and on the phone and compare the two dumps.
// Remove this file and its call site in App.jsx once the issue is closed.

const STORAGE_KEY = "vaycona-canvas-debug";
const PANEL_ID = "vaycona-canvas-debug-panel";

export function isCanvasDebugEnabled() {
  try {
    if (new URLSearchParams(window.location.search).has("canvasDebug")) return true;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function round(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 1000) / 1000 : value;
}

function showPanel(text) {
  let panel = document.getElementById(PANEL_ID);
  if (!panel) {
    panel = document.createElement("pre");
    panel.id = PANEL_ID;
    panel.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;max-height:40vh;overflow:auto;margin:0;padding:6px;z-index:2147483647;" +
      "background:rgba(0,0,0,.85);color:#7CFC98;font:10px/1.3 ui-monospace,Menlo,monospace;white-space:pre-wrap;pointer-events:auto;";
    panel.addEventListener("dblclick", () => panel.remove());
    document.body.appendChild(panel);
  }
  panel.textContent = text;
}

// `elements` are the stored document items; their numbers are read as-is so
// the dump proves they were never rewritten into screen space.
export function logCanvasDebug({ reason, page, container, displayScale, stage, frame, pixelRatio, elements, nodes, assetIndex }) {
  if (!isCanvasDebugEnabled()) return;
  const rect = container?.getBoundingClientRect?.();
  const summary = {
    reason,
    documentWidth: page?.width,
    documentHeight: page?.height,
    containerWidth: container?.clientWidth,
    containerHeight: container?.clientHeight,
    containerRect: rect ? `${round(rect.width)}x${round(rect.height)}` : null,
    displayScale: round(displayScale),
    "stage.scaleX": round(stage?.scaleX()),
    "stage.scaleY": round(stage?.scaleY()),
    "stage.x": round(stage?.x()),
    "stage.y": round(stage?.y()),
    "stage.width": round(stage?.width()),
    "stage.height": round(stage?.height()),
    frameCssTransform: frame?.style?.transform,
    devicePixelRatio: window.devicePixelRatio,
    konvaPixelRatio: round(pixelRatio),
    sceneBackingPixels: stage?.getLayers?.()[0] ? `${stage.getLayers()[0].getCanvas()._canvas.width}x${stage.getLayers()[0].getCanvas()._canvas.height}` : null,
    innerSize: `${window.innerWidth}x${window.innerHeight}`,
  };
  const rows = (elements || []).map((item) => {
    const node = nodes?.get?.(item.id);
    const row = {
      id: item.id,
      type: item.type,
      x: round(item.x),
      y: round(item.y),
      width: round(item.width),
      height: round(item.height),
      scaleX: round(item.scaleX ?? node?.scaleX?.() ?? 1),
      scaleY: round(item.scaleY ?? node?.scaleY?.() ?? 1),
      visible: item.hidden ? false : node ? node.isVisible() : true,
      opacity: round(item.opacity ?? node?.opacity?.() ?? 1),
    };
    // For images/frames: whether this browser's local asset index (the
    // synchronous localStorage mirror of IndexedDB — see assetStore.js)
    // actually has a record for item.assetId, and what its last known
    // status was. A missing-image icon with `asset: "NOT IN LOCAL INDEX"`
    // here means resolution never even got a local/cloud record to work
    // with; `asset: "status=..."` with an errorMessage points at exactly
    // where putAsset/attachCloudSync failed for it.
    const assetId = item.assetId || item.contentAssetId;
    if (assetId) {
      const entry = assetIndex?.[assetId];
      row.asset = entry ? `status=${entry.status}${entry.errorMessage ? ` (${entry.errorMessage})` : ""}${entry.cloudUrl ? " cloudUrl✓" : " cloudUrl✗"}` : "NOT IN LOCAL INDEX";
    }
    return row;
  });
  console.log("[canvasDebug]", summary);
  console.table(rows);
  showPanel(`[canvasDebug] ${reason}\n${JSON.stringify(summary, null, 1)}\n${rows.map((row) => JSON.stringify(row)).join("\n")}`);
}
