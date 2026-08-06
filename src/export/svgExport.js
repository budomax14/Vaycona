// Phase 9 — single-page SVG export. Reuses the app's real geometry/data
// wherever a faithful vector translation exists (shapeGeometry.js's path
// builders via the svgPathContext shim, FRAME_KINDS clip paths, the icon
// catalog's own SVG-shaped primitives, imageEffects.js's filter
// pipeline), and rasterizes only the parts that genuinely have no safe
// vector equivalent in this app (wrapped/rich text, image pixel
// adjustments) — see file-level comments at each branch for exactly why.
//
// Every raster asset is embedded as a base64 data: URI; nothing in the
// output ever references a blob:/object URL (spec §36/§38), and every
// piece of user text/attribute content is XML-escaped (spec §38/§62) so
// the generated file can never carry a script or break out of an
// attribute.

import Konva from "konva";
import { SHAPE_KINDS } from "../shapeKinds";
import { LINE_KINDS } from "../lineKinds";
import { FRAME_KINDS } from "../frameKinds";
import { findIconByName, ICON_NATIVE_SIZE } from "../iconCatalog";
import { isEffectivelyHidden } from "../hierarchy";
import { isRichText } from "../richText";
import { computeCropLayout } from "../imageCrop";
import { buildFilterPipeline, hasAnyAdjustment } from "../imageEffects";
import { getAssetBlob, getAssetMeta } from "../assetStore";
import { createSvgPathContext } from "./svgPathContext";
import { ExportCancelledError, renderPageToCanvas } from "./offscreenRenderer";
import { borderDashProps } from "../borderStyles";

function escapeXml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

let clipIdCounter = 0;
function nextClipId() {
  clipIdCounter += 1;
  return `export-clip-${clipIdCounter}`;
}

function shapePathD(sceneFuncPathBuilder, width, height, item) {
  const ctx = createSvgPathContext();
  const fakeNode = { width: () => width, height: () => height };
  sceneFuncPathBuilder(ctx, fakeNode, item);
  return ctx.getPathData();
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read image data."));
    reader.readAsDataURL(blob);
  });
}

function loadImageElement(objectUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image."));
    img.src = objectUrl;
  });
}

// Renders one already-loaded HTMLImageElement through Konva's REAL filter
// pipeline (the exact same buildFilterPipeline used live by
// useImageFilters.js) via a tiny detached vanilla-Konva stage, then
// returns a PNG data URI. This is the one place SVG export intentionally
// rasterizes pixel adjustments — there is no safe, faithful SVG-filter
// translation of this app's specific brightness/contrast/saturation/warmth
// math, so baking it into the embedded raster (rather than approximating
// with generic SVG filter primitives that would visibly disagree with the
// editor) is the more honest choice.
function rasterizeAdjustedImage(imageEl, adjustments, drawWidth, drawHeight) {
  const stage = new Konva.Stage({ container: document.createElement("div"), width: Math.max(1, Math.round(drawWidth)), height: Math.max(1, Math.round(drawHeight)) });
  const layer = new Konva.Layer();
  stage.add(layer);
  const node = new Konva.Image({ image: imageEl, x: 0, y: 0, width: drawWidth, height: drawHeight });
  layer.add(node);
  const { filters, props } = buildFilterPipeline(adjustments);
  node.setAttrs(props);
  node.cache();
  node.filters(filters);
  layer.draw();
  const dataUrl = stage.toDataURL({ pixelRatio: 1, mimeType: "image/png" });
  stage.destroy();
  return dataUrl;
}

async function resolveEmbeddedImage(assetId, { flipX, flipY, adjustments, drawWidth, drawHeight }) {
  const blob = await getAssetBlob(assetId);
  if (!blob) return null;
  const objectUrl = URL.createObjectURL(blob);
  try {
    const imageEl = await loadImageElement(objectUrl);
    const needsAdjustments = hasAnyAdjustment(adjustments);
    if (flipX || flipY) {
      // Flip is baked in via the same canvas trick useImageElement.js uses
      // (draw with a flipped transform); adjustments (if any) are then
      // applied on top via the real Konva filter pipeline — Konva.Image
      // accepts a canvas source directly, no extra decode round-trip needed.
      const w = imageEl.naturalWidth;
      const h = imageEl.naturalHeight;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(flipX ? -1 : 1, 0, 0, flipY ? -1 : 1, flipX ? w : 0, flipY ? h : 0);
      ctx.drawImage(imageEl, 0, 0, w, h);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      return needsAdjustments ? rasterizeAdjustedImage(canvas, adjustments, w, h) : canvas.toDataURL("image/png");
    }
    if (needsAdjustments) {
      return rasterizeAdjustedImage(imageEl, adjustments, imageEl.naturalWidth, imageEl.naturalHeight);
    }
    return await blobToDataUrl(blob);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function renderIconPrimitives(icon, color) {
  return icon.node
    .map(([tag, attrs]) => {
      const isSolid = attrs.fill === "currentColor";
      const fill = isSolid ? color : "none";
      const stroke = isSolid ? "none" : color;
      const strokeAttrs = `fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
      if (tag === "path") return `<path d="${escapeXml(attrs.d)}" ${strokeAttrs} />`;
      if (tag === "circle") return `<circle cx="${attrs.cx}" cy="${attrs.cy}" r="${attrs.r}" ${strokeAttrs} />`;
      if (tag === "rect")
        return `<rect x="${attrs.x}" y="${attrs.y}" width="${attrs.width}" height="${attrs.height}" rx="${attrs.rx || attrs.ry || 0}" ${strokeAttrs} />`;
      if (tag === "line") return `<line x1="${attrs.x1}" y1="${attrs.y1}" x2="${attrs.x2}" y2="${attrs.y2}" stroke="${color}" stroke-width="2" stroke-linecap="round" />`;
      if (tag === "polyline") return `<polyline points="${attrs.points}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`;
      if (tag === "polygon") return `<polygon points="${attrs.points}" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round" />`;
      return "";
    })
    .join("");
}

function wrapItem(item, inner, { extraDefs = "" } = {}) {
  const rotation = item.rotation || 0;
  const opacity = item.opacity ?? 1;
  return `${extraDefs}<g transform="translate(${item.x} ${item.y}) rotate(${rotation})" opacity="${opacity}">${inner}</g>`;
}

function dropShadowFilter(id, { blur = 12, opacity = 0.35, dx = 0, dy = 4, color = "#000000" } = {}) {
  return `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="${dx}" dy="${dy}" stdDeviation="${blur / 2}" flood-color="${color}" flood-opacity="${opacity}" /></filter>`;
}

function renderShapeItem(item) {
  const kindDef = SHAPE_KINDS[item.shapeKind] || SHAPE_KINDS.rectangle;
  const d = shapePathD((ctx, node, it) => kindDef.sceneFunc(ctx, node, it), item.width, item.height, item);
  const fill = item.fill || "#8b5cf6";
  const stroke = item.stroke && item.stroke !== "transparent" ? item.stroke : "none";
  const strokeWidth = item.strokeWidth || 0;
  const fillRule = kindDef.fillRule === "evenodd" ? "evenodd" : "nonzero";
  const { dash, lineCap } = borderDashProps(item.strokeStyle, strokeWidth);
  const dashAttr = dash ? ` stroke-dasharray="${dash.join(",")}"` : "";
  const capAttr = lineCap ? ` stroke-linecap="${lineCap}"` : "";
  let filterAttr = "";
  let defs = "";
  if (item.shadow) {
    const id = nextClipId();
    defs = dropShadowFilter(id, { blur: item.shadowBlur ?? 12 });
    filterAttr = ` filter="url(#${id})"`;
  }
  const path = `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr}${capAttr} fill-rule="${fillRule}"${filterAttr} />`;
  return wrapItem(item, path, { extraDefs: defs });
}

function renderLineItem(item) {
  const kindDef = LINE_KINDS[item.lineKind] || LINE_KINDS.straight;
  const width = item.width || 1;
  const stroke = item.stroke || "#111827";
  const strokeWidth = item.strokeWidth || 4;
  const dashArray = kindDef.dash ? ` stroke-dasharray="${kindDef.dash.join(",")}"` : "";
  let extra = "";
  if (kindDef.element === "arrow") {
    const pointerLength = Math.max(10, strokeWidth * 2.5);
    const pointerWidth = Math.max(10, strokeWidth * 2.5);
    if (kindDef.pointerAtEnding !== false) {
      extra += `<polygon points="${width},0 ${width - pointerLength},${-pointerWidth / 2} ${width - pointerLength},${pointerWidth / 2}" fill="${stroke}" />`;
    }
    if (kindDef.pointerAtBeginning) {
      extra += `<polygon points="0,0 ${pointerLength},${-pointerWidth / 2} ${pointerLength},${pointerWidth / 2}" fill="${stroke}" />`;
    }
  }
  const line = `<line x1="0" y1="0" x2="${width}" y2="0" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round"${dashArray} />${extra}`;
  return wrapItem(item, line);
}

function renderIconItem(item) {
  const icon = findIconByName(item.iconName);
  if (!icon) return "";
  const width = item.width || 100;
  const height = item.height || 100;
  const color = item.fill || "#111827";
  const scaleX = width / ICON_NATIVE_SIZE;
  const scaleY = height / ICON_NATIVE_SIZE;
  const inner = `<g transform="scale(${scaleX} ${scaleY})">${renderIconPrimitives(icon, color)}</g>`;
  return wrapItem(item, inner);
}

// Only text that the editor itself never wraps (autoSize:"auto-width")
// stays a real <text> element — every `\n` in the source is an explicit,
// user-authored break, so reproducing it as one <tspan> per line can never
// disagree with what the editor shows (spec §12 "do not silently change
// line breaks"). Anything the editor auto-wraps, or that uses rich
// per-run formatting/effects, is rasterized instead (see rasterizeItemPng)
// rather than risk a subtly different wrap point in the exported file.
function isVectorSafeText(item) {
  return (
    item.autoSize === "auto-width" &&
    !isRichText(item) &&
    !item.effects?.shadow?.enabled &&
    !item.effects?.outline?.enabled &&
    !item.effects?.glow?.enabled &&
    !item.background?.enabled &&
    !item.border?.enabled &&
    !item.curve &&
    !item.flipX &&
    !item.flipY
  );
}

function renderVectorTextItem(item) {
  const lines = String(item.text ?? "").split("\n");
  const fontSize = item.fontSize || 42;
  const lineHeight = (item.lineHeight || 1) * fontSize;
  const weight = item.fontWeight === "bold" ? "bold" : "normal";
  const style = item.italic ? "italic" : "normal";
  const decoration = [item.underline && "underline", item.strikethrough && "line-through"].filter(Boolean).join(" ") || "none";
  const anchor = item.align === "center" ? "middle" : item.align === "right" ? "end" : "start";
  const anchorX = item.align === "center" ? item.width / 2 : item.align === "right" ? item.width : 0;
  const tspans = lines
    .map((line, i) => `<tspan x="${anchorX}" y="${fontSize * 0.85 + i * lineHeight}">${escapeXml(line)}</tspan>`)
    .join("");
  const text = `<text font-family="${escapeXml(item.fontFamily || "Arial")}" font-size="${fontSize}" font-weight="${weight}" font-style="${style}" text-decoration="${decoration}" letter-spacing="${item.letterSpacing || 0}" fill="${item.fill || "#111827"}" text-anchor="${anchor}">${tspans}</text>`;
  return wrapItem(item, text);
}

// Frame outline geometry is reused as an SVG clipPath (spec §20/§36); the
// image content itself is embedded as a raster (spec-allowed — image
// pixels were never a vector concern to begin with) positioned/scaled
// using the exact same computeCropLayout() math the live editor uses, so
// the crop/focal point/fit inside the clip always matches.
async function renderFrameItem(item, availableAssetIds) {
  const width = item.width || 100;
  const height = item.height || 100;
  const kindDef = FRAME_KINDS[item.frameKind] || FRAME_KINDS.rectangle;
  const clipId = nextClipId();
  const clipD = shapePathD((ctx, node, it) => kindDef.clipPath(ctx, node.width(), node.height(), it), width, height, item);
  const clipDef = `<clipPath id="${clipId}"><path d="${clipD}" /></clipPath>`;

  if (!item.contentAssetId || !availableAssetIds.has(item.contentAssetId)) {
    const placeholder = `<path d="${clipD}" fill="#f3f4f6" stroke="#9ca3af" stroke-width="2" stroke-dasharray="8,6" />`;
    return wrapItem(item, placeholder, { extraDefs: clipDef });
  }

  const meta = await getAssetMeta(item.contentAssetId);
  const inset = kindDef.contentInset || { top: 0, right: 0, bottom: 0, left: 0 };
  const contentX = width * inset.left;
  const contentY = height * inset.top;
  const contentWidth = Math.max(1, width * (1 - inset.left - inset.right));
  const contentHeight = Math.max(1, height * (1 - inset.top - inset.bottom));
  const layout = computeCropLayout(item.crop, meta?.width, meta?.height, contentWidth, contentHeight);
  const dataUrl = await resolveEmbeddedImage(item.contentAssetId, {
    flipX: item.flipX,
    flipY: item.flipY,
    adjustments: item.adjustments,
    drawWidth: meta?.width,
    drawHeight: meta?.height,
  });
  if (!dataUrl) return wrapItem(item, `<path d="${clipD}" fill="#fef2f2" stroke="#fca5a5" stroke-width="2" stroke-dasharray="8,6" />`, { extraDefs: clipDef });

  let imageTag;
  if (layout.mode === "contain") {
    imageTag = `<image href="${dataUrl}" x="${contentX + layout.offsetX}" y="${contentY + layout.offsetY}" width="${layout.drawWidth}" height="${layout.drawHeight}" preserveAspectRatio="none" />`;
  } else {
    // "fill"/cover crop: SVG <image> has no native crop-rect, so the
    // source is embedded at natural size inside a nested, doubly-clipped
    // group offset so only the intended crop rect shows through — the
    // same visual result as Konva's crop prop, expressed with primitives
    // SVG actually has.
    const scaleX = contentWidth / layout.cropRect.width;
    const scaleY = contentHeight / layout.cropRect.height;
    imageTag = `<g clip-path="url(#${clipId}-content)"><clipPath id="${clipId}-content"><rect x="${contentX}" y="${contentY}" width="${contentWidth}" height="${contentHeight}" /></clipPath><image href="${dataUrl}" x="${contentX - layout.cropRect.x * scaleX}" y="${contentY - layout.cropRect.y * scaleY}" width="${(meta?.width || 1) * scaleX}" height="${(meta?.height || 1) * scaleY}" preserveAspectRatio="none" /></g>`;
  }
  const inner = `<rect width="${width}" height="${height}" fill="#ffffff" clip-path="url(#${clipId})" /><g clip-path="url(#${clipId})">${imageTag}</g>`;
  return wrapItem(item, inner, { extraDefs: clipDef });
}

async function renderImageItem(item, availableAssetIds) {
  const width = item.width || 100;
  const height = item.height || 100;
  const clipId = nextClipId();
  const clipD = shapePathD((ctx, node, it) => {
    const r = Math.min(it.cornerRadius || 0, node.width() / 2, node.height() / 2);
    if (r <= 0) {
      ctx.rect(0, 0, node.width(), node.height());
    } else {
      ctx.moveTo(r, 0);
      ctx.lineTo(node.width() - r, 0);
      ctx.arcTo(node.width(), 0, node.width(), r, r);
      ctx.lineTo(node.width(), node.height() - r);
      ctx.arcTo(node.width(), node.height(), node.width() - r, node.height(), r);
      ctx.lineTo(r, node.height());
      ctx.arcTo(0, node.height(), 0, node.height() - r, r);
      ctx.lineTo(0, r);
      ctx.arcTo(0, 0, r, 0, r);
      ctx.closePath();
    }
  }, width, height, item);
  const clipDef = `<clipPath id="${clipId}"><path d="${clipD}" /></clipPath>`;

  if (!item.assetId || !availableAssetIds.has(item.assetId)) {
    return wrapItem(item, `<path d="${clipD}" fill="#fef2f2" stroke="#fca5a5" stroke-width="2" stroke-dasharray="8,6" />`, { extraDefs: clipDef });
  }
  const meta = await getAssetMeta(item.assetId);
  const layout = computeCropLayout(item.crop, meta?.width, meta?.height, width, height);
  const dataUrl = await resolveEmbeddedImage(item.assetId, {
    flipX: item.flipX,
    flipY: item.flipY,
    adjustments: item.adjustments,
    drawWidth: meta?.width,
    drawHeight: meta?.height,
  });
  if (!dataUrl) return wrapItem(item, `<path d="${clipD}" fill="#fef2f2" stroke="#fca5a5" stroke-width="2" stroke-dasharray="8,6" />`, { extraDefs: clipDef });

  let imageTag;
  if (layout.mode === "contain") {
    imageTag = `<image href="${dataUrl}" x="${layout.offsetX}" y="${layout.offsetY}" width="${layout.drawWidth}" height="${layout.drawHeight}" preserveAspectRatio="none" />`;
  } else {
    const scaleX = width / layout.cropRect.width;
    const scaleY = height / layout.cropRect.height;
    imageTag = `<image href="${dataUrl}" x="${-layout.cropRect.x * scaleX}" y="${-layout.cropRect.y * scaleY}" width="${(meta?.width || 1) * scaleX}" height="${(meta?.height || 1) * scaleY}" preserveAspectRatio="none" />`;
  }
  const inner = `<g clip-path="url(#${clipId})">${imageTag}</g>`;
  return wrapItem(item, inner, { extraDefs: clipDef });
}

// Full-fidelity fallback for anything SVG can't safely represent as a real
// vector (wrapped/rich/effect text) — rasterizes just that ONE item (not
// the whole page) by feeding it back through the shared offscreen render
// pipeline (offscreenRenderer.jsx) as a synthetic single-item "page" sized
// to the item's own local (unrotated) box. This keeps SimpleTextNode/
// RichTextNode as the one true source of how text looks — no second
// text-layout implementation — and lets the surrounding <g
// transform="translate(...) rotate(...)"> from wrapItem() supply the
// item's real rotation, so only the item's own local appearance needs to
// be rasterized.
async function rasterizeItemForSvg(item, renderScale) {
  const localItem = { ...item, x: 0, y: 0, rotation: 0, pageId: "__svg_item__" };
  const fakePage = { id: "__svg_item__", width: Math.max(1, item.width), height: Math.max(1, item.height || item.fontSize || 40) };
  const canvas = await renderPageToCanvas({
    page: fakePage,
    items: [localItem],
    pixelScale: Math.max(2, renderScale),
    backgroundFill: null,
    availableAssetIds: new Set(),
  });
  const dataUrl = canvas.toDataURL("image/png");
  canvas.width = 0;
  canvas.height = 0;
  return dataUrl;
}

async function renderTextItem(item, renderScale) {
  if (isVectorSafeText(item)) return renderVectorTextItem(item);
  const dataUrl = await rasterizeItemForSvg(item, renderScale);
  const inner = `<image href="${dataUrl}" x="0" y="0" width="${item.width}" height="${item.height}" opacity="1" />`;
  // Opacity/rotation are already applied by wrapItem's outer <g>; the
  // rasterized bitmap itself is captured at full opacity so the two never
  // compound (that would double-fade the object).
  return wrapItem({ ...item, opacity: item.opacity ?? 1 }, inner);
}

async function renderItemToSvg(item, { availableAssetIds, renderScale }) {
  if (item.type === "shape") return renderShapeItem(item);
  if (item.type === "line") return renderLineItem(item);
  if (item.type === "icon") return renderIconItem(item);
  if (item.type === "text") return renderTextItem(item, renderScale);
  if (item.type === "frame") return renderFrameItem(item, availableAssetIds);
  if (item.type === "image") return renderImageItem(item, availableAssetIds);
  return "";
}

// Builds the full standalone SVG document for exactly one page. `scale`
// controls only the document's own declared width/height (the viewBox
// stays in the page's native units, so vector content stays crisp at any
// requested output size) and the resolution used for the raster fallback
// paths above.
export async function buildSvgDocument({ page, items, availableAssetIds, backgroundFill, scale, signal }) {
  const itemsById = new Map(items.map((it) => [it.id, it]));
  const visibleItems = items.filter((item) => item.pageId === page.id && item.type !== "group" && !isEffectivelyHidden(item, itemsById));

  const pieces = [];
  for (const item of visibleItems) {
    if (signal?.aborted) throw new ExportCancelledError();
    // eslint-disable-next-line no-await-in-loop
    const fragment = await renderItemToSvg(item, { availableAssetIds, renderScale: scale });
    pieces.push(fragment);
  }

  const outputWidth = Math.round(page.width * scale);
  const outputHeight = Math.round(page.height * scale);
  const backgroundRect = backgroundFill ? `<rect x="0" y="0" width="${page.width}" height="${page.height}" fill="${backgroundFill}" />` : "";

  let borderRect = "";
  if (page.border?.enabled) {
    const borderWidth = page.border.width ?? 4;
    const { dash, lineCap } = borderDashProps(page.border.style, borderWidth);
    const dashAttr = dash ? ` stroke-dasharray="${dash.join(",")}"` : "";
    const capAttr = lineCap ? ` stroke-linecap="${lineCap}"` : "";
    borderRect = `<rect x="0" y="0" width="${page.width}" height="${page.height}" fill="none" stroke="${page.border.color || "#111827"}" stroke-width="${borderWidth}"${dashAttr}${capAttr} />`;
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${outputWidth}" height="${outputHeight}" viewBox="0 0 ${page.width} ${page.height}">`,
    `<title>${escapeXml(page.name || "Design")}</title>`,
    backgroundRect,
    ...pieces,
    borderRect,
    `</svg>`,
  ].join("");
}
