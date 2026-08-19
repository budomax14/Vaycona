import React from "react";
import { Group, Rect, Shape } from "react-konva";
import { fontString } from "../richText";
import { createCanvasGradient } from "../gradientFill";
import { createImageFillPattern } from "../imageFill";
import { getTextEffectProps } from "../textEffects";
import { useFontLoader } from "../useFontLoader";
import { borderDashProps } from "../borderStyles";
import { useAsset } from "../useAsset";
import { useImageElement } from "../useImageElement";
import { resolveText3D, getText3DSteps, getText3DBevelRim } from "../text3D";
import { useText3DCache } from "../useText3DCache";

const MAX_CURVE_ANGLE = Math.PI * 1.5; // ~270° of arc at |curve| === 100

function transformedText(item) {
  const raw = (item.text || "").replace(/\n+/g, " ");
  if (item.textTransform === "uppercase") return raw.toUpperCase();
  if (item.textTransform === "lowercase") return raw.toLowerCase();
  if (item.textTransform === "capitalize") return raw.replace(/\b\w/g, (ch) => ch.toUpperCase());
  return raw;
}

// Renders text bent along a circular arc (the "Curve" slider in
// TextCurveMenu.jsx). Bypasses both SimpleTextNode's native-Konva-Text
// path and RichTextNode's per-run layout — curving needs every glyph
// placed at its own point + rotation on a circle, a layout neither of
// those models supports. Falls back to the item's own uniform base style
// (fontSize/fontFamily/bold/italic/fill) rather than per-run formatting —
// the same simplification most curve-text tools make, since per-run
// styling and arc layout don't compose cleanly. `item.text` stays an
// up-to-date plain-text mirror even for rich-formatted items (see
// richText.js's header comment), so this never reads stale content.
export default function CurvedTextNode({ item, commonProps }) {
  const { ref, x, y, width, height, rotation, opacity, draggable, dragBoundFunc, ...handlers } = commonProps;
  const fontFamily = item.fontFamily || "Arial";
  // Re-renders once the real font is available — canvas silently falls
  // back to a default font at draw time otherwise (see useFontLoader.js).
  useFontLoader(fontFamily);

  const background = item.background;
  const border = item.border;
  const effectProps = getTextEffectProps(item);
  const text = transformedText(item);
  const fontSize = item.fontSize || 24;
  const letterSpacing = item.letterSpacing || 0;
  const amount = Math.max(-100, Math.min(100, item.curve || 0));
  const fill = item.fill || "#111827";
  const run = { fontSize, fontFamily, bold: item.fontWeight === "bold", italic: !!item.italic };
  // Image Fill — same descriptor as SimpleTextNode/RichTextNode; each glyph
  // here is drawn at its own rotated position (see sceneFunc below), so the
  // pattern is re-anchored per character (imageFill.js's flowXOffset) to
  // make the image appear to bend continuously along the curve.
  const { objectUrl: fillImageUrl } = useAsset(item.fillImage?.assetId);
  const { image: fillImageEl, naturalWidth: fillImageNaturalWidth, naturalHeight: fillImageNaturalHeight } = useImageElement(fillImageUrl);

  // Text Effects → 3D — see text3D.js's header comment for why extrusion is
  // drawn inside this same sceneFunc (translated per arc-placed glyph)
  // rather than as sibling Konva nodes.
  const text3D = resolveText3D(item);
  const text3DSteps = getText3DSteps(text3D);
  const bevelRim = getText3DBevelRim(text3D);
  const text3DCacheKey = JSON.stringify([item.fillGradient, item.fillImage, background, border]);
  useText3DCache(ref, text3D, width, height, text3DCacheKey);

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
      {...handlers}
    >
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
          // here, not cosmetic — see the matching comment in RichTextNode.jsx:
          // without it, Konva's Shape.getSelfRect() defaults to 0×0 and the
          // Transformer's selection box collapses to a point whenever no
          // background/border is enabled (verified against Konva 9.3.22
          // directly). Also what keeps that box correctly pinned once 3D
          // extrusion (Text Effects → 3D) paints outside it.
          width={width}
          height={height}
          // Custom sceneFunc shapes get no hit region for free — Konva can't
          // infer one from arbitrary ctx.fillText calls scattered across an
          // arc, so without this, clicking anywhere that isn't exactly on a
          // rendered glyph's ink (most of the box, once text is bent) never
          // hits the shape at all: no select, no double-click-to-edit.
          // Filling the plain bounding rect here (Konva's standard hitFunc
          // pattern) makes the whole box clickable again, matching every
          // other text/shape node's box-shaped hit area.
          hitFunc={(ctx, shape) => {
            ctx.beginPath();
            ctx.rect(0, 0, width, height);
            ctx.closePath();
            ctx.fillStrokeShape(shape);
          }}
          sceneFunc={(ctx) => {
            if (!text) return;
            ctx.font = fontString(run);
            const chars = Array.from(text);
            const widths = chars.map((ch) => ctx.measureText(ch).width);
            const totalWidth = widths.reduce((sum, w) => sum + w, 0) + letterSpacing * Math.max(0, chars.length - 1);
            if (totalWidth <= 0) return;

            const angleSpan = (Math.abs(amount) / 100) * MAX_CURVE_ANGLE;
            const sign = amount < 0 ? -1 : 1;
            const radius = totalWidth / angleSpan;
            const centerX = width / 2;
            const centerY = height / 2;

            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const hasImageFill = !!(item.fillImage?.assetId && fillImageEl);
            if (!hasImageFill) {
              ctx.fillStyle = createCanvasGradient(ctx, item.fillGradient, width, height) || fill;
            }
            if (effectProps.stroke) {
              ctx.strokeStyle = effectProps.stroke;
              ctx.lineWidth = effectProps.strokeWidth;
            }

            let cursor = 0;
            const placements = chars.map((ch, i) => {
              const charCenter = cursor + widths[i] / 2;
              cursor += widths[i] + letterSpacing;
              if (angleSpan <= 0.0001) {
                return { charCenter, px: charCenter - totalWidth / 2, py: 0, charRotation: 0 };
              }
              const theta = (charCenter - totalWidth / 2) / radius;
              return {
                charCenter,
                px: radius * Math.sin(theta),
                py: sign * radius * (1 - Math.cos(theta)),
                charRotation: sign * theta,
              };
            });

            // 3D extrusion (Text Effects → 3D), drawn first so the real
            // front face paints on top — reuses the arc placement computed
            // above, just translated per step, never separate Konva nodes
            // (see text3D.js).
            if (text3DSteps.length || bevelRim) {
              ctx.save();
              const paintStep = (dx, dy, color, scale = 1) => {
                ctx.fillStyle = color;
                chars.forEach((ch, i) => {
                  const { px, py, charRotation } = placements[i];
                  ctx.save();
                  ctx.translate(centerX + px + dx, centerY + py + dy);
                  if (scale !== 1) ctx.scale(scale, scale);
                  ctx.rotate(charRotation);
                  ctx.fillText(ch, 0, 0);
                  ctx.restore();
                });
              };
              text3DSteps.forEach((step) => paintStep(step.dx, step.dy, step.color, step.scale));
              if (bevelRim) {
                paintStep(bevelRim.shadow.dx, bevelRim.shadow.dy, bevelRim.shadow.color);
                paintStep(bevelRim.highlight.dx, bevelRim.highlight.dy, bevelRim.highlight.color);
              }
              ctx.restore();
            }

            chars.forEach((ch, i) => {
              const { px, py, charRotation, charCenter } = placements[i];
              if (hasImageFill) {
                ctx.fillStyle =
                  createImageFillPattern(ctx, item, fillImageEl, fillImageNaturalWidth, fillImageNaturalHeight, totalWidth, fontSize, charCenter) || fill;
              }

              ctx.save();
              ctx.translate(centerX + px, centerY + py);
              ctx.rotate(charRotation);
              if (effectProps.stroke) ctx.strokeText(ch, 0, 0);
              ctx.fillText(ch, 0, 0);
              ctx.restore();
            });
          }}
        />
      </Group>
    </Group>
  );
}
