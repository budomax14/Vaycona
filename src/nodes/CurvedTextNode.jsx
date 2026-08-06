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
            chars.forEach((ch, i) => {
              const charCenter = cursor + widths[i] / 2;
              cursor += widths[i] + letterSpacing;

              if (hasImageFill) {
                ctx.fillStyle =
                  createImageFillPattern(ctx, item, fillImageEl, fillImageNaturalWidth, fillImageNaturalHeight, totalWidth, fontSize, charCenter) || fill;
              }

              let px, py, charRotation;
              if (angleSpan <= 0.0001) {
                px = charCenter - totalWidth / 2;
                py = 0;
                charRotation = 0;
              } else {
                const theta = (charCenter - totalWidth / 2) / radius;
                px = radius * Math.sin(theta);
                py = sign * radius * (1 - Math.cos(theta));
                charRotation = sign * theta;
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
