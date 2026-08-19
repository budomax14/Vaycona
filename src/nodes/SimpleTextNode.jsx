import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { Group, Rect, Shape, Text } from "react-konva";
import { getTextEffectProps } from "../textEffects";
import { resolveGradientKonvaProps } from "../gradientFill";
import { resolveImageFillKonvaProps } from "../imageFill";
import { borderDashProps } from "../borderStyles";
import { useAsset } from "../useAsset";
import { useImageElement } from "../useImageElement";
import { resolveText3D, getText3DSteps, getText3DBevelRim } from "../text3D";
import { useText3DCache } from "../useText3DCache";

function buildFontStyle(item) {
  const parts = [];
  if (item.italic) parts.push("italic");
  if (item.fontWeight === "bold") parts.push("bold");
  return parts.length ? parts.join(" ") : "normal";
}

function textTransformContent(item) {
  const text = item.text || "";
  if (item.textTransform === "uppercase") return text.toUpperCase();
  if (item.textTransform === "lowercase") return text.toLowerCase();
  if (item.textTransform === "capitalize") return text.replace(/\b\w/g, (ch) => ch.toUpperCase());
  return text;
}

// Fast path for the overwhelming majority of text objects: one uniform
// style for the whole string, rendered via a single native Konva `Text`
// node exactly as Phase 2/3 already did. Only objects with real per-run
// formatting pay for the manual layout in RichTextNode.jsx.
export default function SimpleTextNode({ item, commonProps }) {
  const { ref, x, y, width, height, rotation, opacity, draggable, dragBoundFunc, ...handlers } = commonProps;
  const background = item.background;
  const border = item.border;
  // Gradient text color (TextColorPanel.jsx's Gradient tab) — same
  // resolved-descriptor approach ShapeNode.jsx uses for gradient fills;
  // `fill` stays as the literal fallback whenever no gradient is set.
  const gradient = resolveGradientKonvaProps(item);

  // Image Fill (TextColorPanel.jsx's Image tab) — resolved to Konva's own
  // native fillPatternImage/fillPattern* attrs (see imageFill.js's header
  // comment for why this needs no manual glyph masking), so it wins over
  // gradient exactly like gradient already wins over the plain fill color.
  // useImageElement is called with no flipX/flipY: flip is expressed as a
  // negative pattern scale (imageFill.js's computePatternMatrix) instead of
  // a pre-flipped source image, since the pattern needs the raw decoded
  // image either way.
  const { objectUrl: fillImageUrl } = useAsset(item.fillImage?.assetId);
  const { image: fillImageEl, naturalWidth: fillImageNaturalWidth, naturalHeight: fillImageNaturalHeight } = useImageElement(fillImageUrl);
  const imageFill = resolveImageFillKonvaProps(item, fillImageEl, fillImageNaturalWidth, fillImageNaturalHeight);

  const shouldClip = item.autoSize === "fixed" && (item.overflow || "clip") === "clip";

  // Konva does its own wrapping/measurement for this fast path (unlike
  // RichTextNode, which measures via layoutRichText before drawing), so
  // overflow can only be known after Konva lays the text out — read the
  // wrapped line count off the underlying Text node post-render. Only
  // relevant for fixed-size boxes (the minority case — see textStyles.js
  // defaults), so this never runs for the common auto-height/auto-width path.
  const textNodeRef = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const fontSize = item.fontSize || 42;
  const lineHeight = item.lineHeight || 1;
  const padding = item.padding ?? 4;

  // Text Effects → 3D. Extrusion is drawn by a second, non-listening Shape
  // behind the real front-face Text (never separate Konva nodes offset via
  // their own x/y — see text3D.js's header comment for why that's what
  // keeps the Transformer's selection box pinned to the item's real
  // width/height regardless of depth). SimpleTextNode's front face is a
  // native Konva `Text` (not a custom sceneFunc like Rich/CurvedTextNode),
  // so wrapping is delegated to a detached, unrendered Konva.Text
  // "measurer" sharing the exact same text-affecting props — reusing
  // Konva's own wrap algorithm exactly rather than reimplementing it here.
  const text3D = resolveText3D(item);
  const text3DSteps = useMemo(() => getText3DSteps(text3D), [JSON.stringify(text3D)]);
  const bevelRim = useMemo(() => getText3DBevelRim(text3D), [JSON.stringify(text3D)]);
  const text3DContent = textTransformContent(item);
  const measurer = useMemo(() => {
    if (!text3D.enabled || (text3DSteps.length === 0 && !bevelRim)) return null;
    return new Konva.Text({
      text: text3DContent,
      width,
      height,
      fontSize,
      fontFamily: item.fontFamily || "Arial",
      fontStyle: buildFontStyle(item),
      letterSpacing: item.letterSpacing || 0,
      lineHeight,
      align: item.align || "left",
      verticalAlign: item.verticalAlign || "middle",
      wrap: item.autoSize === "auto-width" ? "none" : "word",
      padding,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text3D.enabled, text3DSteps.length, !!bevelRim, text3DContent, width, height, fontSize, item.fontFamily, item.fontWeight, item.italic, item.letterSpacing, lineHeight, item.align, item.verticalAlign, item.autoSize, padding]);

  const text3DCacheKey = JSON.stringify([
    text3DContent, item.fontFamily, fontSize, item.fontWeight, item.italic, item.letterSpacing, lineHeight,
    item.align, item.verticalAlign, item.fill, item.fillGradient, item.fillImage, background, border,
  ]);
  useText3DCache(ref, text3D, width, height, text3DCacheKey);

  useLayoutEffect(() => {
    if (item.autoSize !== "fixed") {
      setIsOverflowing(false);
      return;
    }
    const node = textNodeRef.current;
    const lineCount = node?.textArr?.length || 0;
    const naturalHeight = fontSize * lineCount * lineHeight + padding * 2;
    setIsOverflowing(naturalHeight > height);
  }, [item.autoSize, item.text, item.textTransform, fontSize, lineHeight, padding, width, height, item.align, item.letterSpacing, item.fontFamily, item.fontWeight, item.italic]);

  return (
    <Group
      ref={ref}
      x={x}
      y={y}
      width={width}
      height={height}
      rotation={rotation}
      opacity={opacity}
      draggable={draggable}
      dragBoundFunc={dragBoundFunc}
      clipFunc={shouldClip ? (ctx) => ctx.rect(0, 0, width, height) : undefined}
      {...handlers}
    >
      {background?.enabled && (
        <Rect
          width={width}
          height={height}
          fill={background.color || "#ffffff"}
          opacity={background.opacity ?? 1}
          cornerRadius={background.cornerRadius || 0}
        />
      )}
      {border?.enabled && (
        <Rect
          width={width}
          height={height}
          stroke={border.color || "#111827"}
          strokeWidth={border.width ?? 1}
          {...borderDashProps(border.style, border.width)}
          cornerRadius={background?.cornerRadius || 0}
        />
      )}
      {/* Flip applied on an inner Group, not the outer ref'd one — handleTransformEnd
          (App.jsx) reads the outer node's own scaleX/scaleY to compute resize, so
          reusing that for flip (like useImageElement.js explicitly avoids doing)
          would conflate flip with resize. */}
      <Group scaleX={item.flipX ? -1 : 1} scaleY={item.flipY ? -1 : 1} x={item.flipX ? width : 0} y={item.flipY ? height : 0}>
        {measurer && (
          <Shape
            listening={false}
            width={width}
            height={height}
            sceneFunc={(ctx) => {
              if (!measurer.text()) return;
              const pad = measurer.padding();
              const fSize = measurer.fontSize();
              const lineHeightPx = measurer.lineHeight() * fSize;
              const lines = measurer.textArr;
              const textAlign = measurer.align();
              const vAlign = measurer.verticalAlign();
              const ls = measurer.letterSpacing();
              const totalW = measurer.getWidth();
              let alignY = 0;
              if (vAlign === "middle") alignY = (height - lines.length * lineHeightPx - pad * 2) / 2;
              else if (vAlign === "bottom") alignY = height - lines.length * lineHeightPx - pad * 2;
              ctx.font = `${buildFontStyle(item)} ${fSize}px ${item.fontFamily || "Arial"}`;
              ctx.textBaseline = "middle";
              ctx.textAlign = "left";

              const paintLines = (dx, dy, color, scale) => {
                ctx.save();
                ctx.translate(dx, dy);
                if (scale !== 1) {
                  ctx.translate(width / 2, height / 2);
                  ctx.scale(scale, scale);
                  ctx.translate(-width / 2, -height / 2);
                }
                ctx.translate(pad, alignY + pad);
                ctx.fillStyle = color;
                let y = lineHeightPx / 2;
                lines.forEach((line) => {
                  let lineX = 0;
                  if (textAlign === "right") lineX = totalW - line.width - pad * 2;
                  else if (textAlign === "center") lineX = (totalW - line.width - pad * 2) / 2;
                  let cursor = lineX;
                  for (const ch of line.text) {
                    ctx.fillText(ch, cursor, y);
                    cursor += ctx.measureText(ch).width + ls;
                  }
                  y += lineHeightPx;
                });
                ctx.restore();
              };

              text3DSteps.forEach((step) => paintLines(step.dx, step.dy, step.color, step.scale));
              if (bevelRim) {
                paintLines(bevelRim.shadow.dx, bevelRim.shadow.dy, bevelRim.shadow.color, 1);
                paintLines(bevelRim.highlight.dx, bevelRim.highlight.dy, bevelRim.highlight.color, 1);
              }
            }}
          />
        )}
        <Text
          ref={textNodeRef}
          text={textTransformContent(item)}
          width={width}
          height={height}
          fontSize={fontSize}
          fontFamily={item.fontFamily || "Arial"}
          fontStyle={buildFontStyle(item)}
          textDecoration={[item.underline && "underline", item.strikethrough && "line-through"].filter(Boolean).join(" ")}
          letterSpacing={item.letterSpacing || 0}
          lineHeight={lineHeight}
          fill={imageFill || gradient ? undefined : item.fill || "#111827"}
          {...(imageFill || gradient)}
          align={item.align || "left"}
          verticalAlign={item.verticalAlign || "middle"}
          wrap={item.autoSize === "auto-width" ? "none" : "word"}
          padding={padding}
          {...getTextEffectProps(item)}
        />
      </Group>
      {isOverflowing && (item.overflow || "clip") !== "shrink" && (
        <Rect x={width - 14} y={height - 14} width={10} height={10} fill="#f59e0b" cornerRadius={2} listening={false} />
      )}
    </Group>
  );
}
