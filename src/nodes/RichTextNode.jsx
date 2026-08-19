import React, { useMemo } from "react";
import { Group, Rect, Shape } from "react-konva";
import { fontString, layoutRichText } from "../richText";
import { createCanvasGradient } from "../gradientFill";
import { createImageFillPattern } from "../imageFill";
import { getTextEffectProps } from "../textEffects";
import { useFontsLoaded } from "../useFontLoader";
import { borderDashProps } from "../borderStyles";
import { useAsset } from "../useAsset";
import { useImageElement } from "../useImageElement";
import { resolveText3D, getText3DSteps, getText3DBevelRim } from "../text3D";
import { useText3DCache } from "../useText3DCache";

function alignOffset(line, totalWidth, align) {
  const free = Math.max(0, totalWidth - line.width - line.indent);
  if (align === "center") return line.indent + free / 2;
  if (align === "right") return line.indent + free;
  return line.indent; // left / justify (justify falls back to left in v1 — see limitations)
}

function drawSegmentChars(ctx, text, x, y, letterSpacing) {
  let cursor = x;
  for (const ch of text) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + letterSpacing;
  }
  return cursor;
}

function strokeSegmentChars(ctx, text, x, y, letterSpacing) {
  let cursor = x;
  for (const ch of text) {
    ctx.strokeText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + letterSpacing;
  }
  return cursor;
}

// Shared by the real front face AND every 3D extrusion copy (Text Effects
// → 3D) — `fillOverride` set means "this is an extrusion/bevel pass": skip
// stroke/underline/strikethrough decoration and paint every glyph in one
// flat color instead of resolving per-run color/gradient/image-fill, since
// the extrusion always uses its own independent color (spec §5).
function paintRichTextContent(ctx, { layout, padding, totalWidthFallback, item, effectProps, imagePattern, canvasGradient, fillOverride }) {
  const letterSpacing = layout.letterSpacing;
  layout.lines.forEach((line) => {
    const baseX = padding + alignOffset(line, layout.totalWidth || totalWidthFallback, line.align);
    const baseY = padding + line.y + (line.height - line.maxFont) / 2 + line.maxFont * 0.8;

    if (line.prefix) {
      ctx.font = fontString(line.segments[0]?.run || { fontSize: line.maxFont, fontFamily: item.fontFamily });
      ctx.fillStyle = fillOverride || imagePattern || canvasGradient || line.segments[0]?.run.color || item.fill || "#111827";
      ctx.fillText(line.prefix, padding + line.indent - 18, baseY);
    }

    let cursorX = baseX;
    line.segments.forEach((seg) => {
      ctx.font = fontString(seg.run);
      ctx.fillStyle = fillOverride || imagePattern || canvasGradient || seg.run.color || item.fill || "#111827";
      if (!fillOverride) {
        // Per-run outline override (see richText.js's outlineColor/
        // outlineWidth doc comment) wins when set; otherwise falls back to
        // the whole-object Effects > Outline setting, same as before this
        // override existed.
        const runStrokeColor = seg.run.outlineColor !== undefined ? seg.run.outlineColor : effectProps.stroke;
        const runStrokeWidth = seg.run.outlineWidth !== undefined ? seg.run.outlineWidth : effectProps.strokeWidth;
        if (runStrokeColor && runStrokeWidth > 0) {
          ctx.strokeStyle = runStrokeColor;
          ctx.lineWidth = runStrokeWidth;
          strokeSegmentChars(ctx, seg.text, cursorX, baseY, letterSpacing);
        }
      }
      drawSegmentChars(ctx, seg.text, cursorX, baseY, letterSpacing);
      if (!fillOverride && (seg.run.underline || seg.run.strikethrough)) {
        const lineY = seg.run.underline ? baseY + seg.run.fontSize * 0.12 : baseY - seg.run.fontSize * 0.3;
        ctx.save();
        ctx.strokeStyle = imagePattern || canvasGradient || seg.run.color || item.fill || "#111827";
        ctx.lineWidth = Math.max(1, seg.run.fontSize * 0.06);
        ctx.beginPath();
        ctx.moveTo(cursorX, lineY);
        ctx.lineTo(cursorX + seg.width, lineY);
        ctx.stroke();
        ctx.restore();
      }
      cursorX += seg.width;
    });
  });
}

// Manual sceneFunc renderer for objects with real per-run formatting
// (mixed bold/italic/color/font/size, or lists). Uses the exact same
// layoutRichText() pass the auto-size measurement uses (see richText.js),
// so wrapping and sizing can never disagree with what's drawn here.
export default function RichTextNode({ item, commonProps }) {
  const { ref, x, y, width, height, rotation, opacity, draggable, dragBoundFunc, ...handlers } = commonProps;
  const richText = item.richText;
  const fontFamilies = useMemo(
    () => Array.from(new Set(richText.flatMap((p) => p.runs.filter((r) => !r.break).map((r) => r.fontFamily)))),
    [richText]
  );
  const fontsReady = useFontsLoaded(fontFamilies);

  const layout = useMemo(
    () =>
      layoutRichText(richText, {
        maxWidth: Math.max(1, width - (item.padding ?? 4) * 2),
        autoWidth: item.autoSize === "auto-width",
        lineHeight: item.lineHeight || 1.2,
        align: item.align || "left",
        letterSpacing: item.letterSpacing || 0,
        paragraphSpacing: item.paragraphSpacing || 0,
      }),
    // fontsReady is intentionally in this dependency list: canvas silently
    // falls back to a default font at draw time until the real font
    // finishes loading, which changes measured widths — this forces a
    // fresh layout pass (and therefore a redraw with correct wrapping)
    // once the font actually becomes available.
    [richText, width, item.autoSize, item.lineHeight, item.align, item.letterSpacing, item.paragraphSpacing, item.padding, fontsReady]
  );

  const padding = item.padding ?? 4;
  const background = item.background;
  const border = item.border;
  const effectProps = getTextEffectProps(item);
  const overflow = item.overflow || "clip";
  // Image Fill — same descriptor resolved by SimpleTextNode.jsx, here
  // materialized as a raw CanvasPattern (see imageFill.js) since this
  // renderer draws via ctx.fillText instead of Konva's native Text fill.
  const { objectUrl: fillImageUrl } = useAsset(item.fillImage?.assetId);
  const { image: fillImageEl, naturalWidth: fillImageNaturalWidth, naturalHeight: fillImageNaturalHeight } = useImageElement(fillImageUrl);
  const isOverflowing = item.autoSize === "fixed" && layout.totalHeight > height - padding * 2;

  // Text Effects → 3D — see text3D.js's header comment for why extrusion is
  // drawn inside this same sceneFunc (translated, not via separate Konva
  // nodes) rather than as sibling shapes: that's what keeps the
  // Transformer's selection box pinned to the item's real width/height
  // regardless of depth.
  const text3D = resolveText3D(item);
  const text3DSteps = useMemo(() => getText3DSteps(text3D), [JSON.stringify(text3D)]);
  const bevelRim = useMemo(() => getText3DBevelRim(text3D), [JSON.stringify(text3D)]);
  const text3DCacheKey = JSON.stringify([richText, item.fillGradient, item.fillImage, background, border]);
  useText3DCache(ref, text3D, width, height, text3DCacheKey);

  return (
    <Group ref={ref} x={x} y={y} width={width} height={height} rotation={rotation} opacity={opacity} draggable={draggable} dragBoundFunc={dragBoundFunc} {...handlers}>
      {background?.enabled && (
        <Rect width={width} height={height} fill={background.color || "#ffffff"} opacity={background.opacity ?? 1} cornerRadius={background.cornerRadius || 0} />
      )}
      {border?.enabled && (
        <Rect width={width} height={height} stroke={border.color || "#111827"} strokeWidth={border.width ?? 1} {...borderDashProps(border.style, border.width)} cornerRadius={background?.cornerRadius || 0} />
      )}
      {/* Flip applied on an inner Group, not the outer ref'd one — see the
          matching comment in SimpleTextNode.jsx (handleTransformEnd reads the
          outer node's own scaleX/scaleY to compute resize). */}
      <Group scaleX={item.flipX ? -1 : 1} scaleY={item.flipY ? -1 : 1} x={item.flipX ? width : 0} y={item.flipY ? height : 0}>
        <Shape
          {...effectProps}
          // Explicit width/height (matching the item's own box) is required
          // here, not cosmetic: Konva's Shape.getSelfRect() reports exactly
          // these attrs regardless of what the sceneFunc actually paints —
          // without them the node defaults to a 0×0 self-rect, which made
          // the Transformer's selection box collapse to a point for any
          // rich-formatted text with no background/border enabled (verified
          // against Konva 9.3.22 directly). Also what keeps that same box
          // correctly pinned once 3D extrusion (Text Effects → 3D) paints
          // outside it — see text3D.js's header comment.
          width={width}
          height={height}
          // Same reasoning as CurvedTextNode.jsx's hitFunc: a custom sceneFunc
          // shape gets no hit region for free, so clicking anywhere that
          // isn't exactly on rendered glyph ink (e.g. the padding, gaps
          // between words, empty trailing space) wouldn't select or
          // double-click-to-edit this object. Filling the plain bounding
          // rect restores the normal box-shaped hit area every other node
          // type gets automatically.
          hitFunc={(ctx, shape) => {
            ctx.beginPath();
            ctx.rect(0, 0, width, height);
            ctx.closePath();
            ctx.fillStrokeShape(shape);
          }}
          clipFunc={
            overflow === "clip"
              ? (ctx) => ctx.rect(0, 0, width, height)
              : undefined
          }
          sceneFunc={(ctx) => {
            // A gradient set via TextColorPanel.jsx applies to the whole
            // object, not per run, so it wins over any run-level color —
            // same "gradient replaces fill entirely" rule SimpleTextNode.jsx
            // follows for the uniform-style fast path.
            const canvasGradient = createCanvasGradient(ctx, item.fillGradient, width, height);
            // Image Fill wins over gradient, exactly like SimpleTextNode's
            // precedence — resolved once per draw, not per segment, since
            // the pattern's transform is fixed for the whole object.
            const imagePattern = createImageFillPattern(ctx, item, fillImageEl, fillImageNaturalWidth, fillImageNaturalHeight, width, height);
            const totalWidthFallback = width - padding * 2;

            // 3D extrusion (Text Effects → 3D), drawn first so the real
            // front face paints on top — pure canvas translates inside this
            // same sceneFunc, never separate Konva nodes (see text3D.js).
            text3DSteps.forEach((step) => {
              ctx.save();
              ctx.translate(step.dx, step.dy);
              if (step.scale !== 1) {
                ctx.translate(width / 2, height / 2);
                ctx.scale(step.scale, step.scale);
                ctx.translate(-width / 2, -height / 2);
              }
              paintRichTextContent(ctx, { layout, padding, totalWidthFallback, item, effectProps, fillOverride: step.color });
              ctx.restore();
            });
            if (bevelRim) {
              [bevelRim.shadow, bevelRim.highlight].forEach((rim) => {
                ctx.save();
                ctx.translate(rim.dx, rim.dy);
                paintRichTextContent(ctx, { layout, padding, totalWidthFallback, item, effectProps, fillOverride: rim.color });
                ctx.restore();
              });
            }

            paintRichTextContent(ctx, { layout, padding, totalWidthFallback, item, effectProps, imagePattern, canvasGradient });
          }}
        />
      </Group>
      {isOverflowing && overflow !== "shrink" && (
        <Rect x={width - 14} y={height - 14} width={10} height={10} fill="#f59e0b" cornerRadius={2} listening={false} />
      )}
    </Group>
  );
}
