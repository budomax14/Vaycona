import React from "react";
import { Shape } from "react-konva";
import { SHAPE_KINDS } from "../shapeKinds";
import { resolveGradientKonvaProps } from "../gradientFill";
import { resolveImageFillKonvaProps } from "../imageFill";
import { borderDashProps } from "../borderStyles";
import { parseColor, toRgbaString } from "../brandColor";
import { useAsset } from "../useAsset";
import { useImageElement } from "../useImageElement";

// Bakes strokeOpacity into the stroke color itself: Konva's stroke/fill are
// drawn by the same sceneFunc's single context.fillStrokeShape(shapeNode)
// call, and this Konva version has no native strokeOpacity attr (unlike
// fillOpacity-via-fillPattern* which Text already gets via imageFill.js's
// pattern alpha) — so a translucent border needs an rgba stroke color
// instead of a separate Konva-level opacity.
function strokeWithOpacity(stroke, opacity) {
  if (!stroke || stroke === "transparent" || opacity >= 1) return stroke;
  const parsed = parseColor(stroke);
  if (!parsed) return stroke;
  return toRgbaString({ ...parsed, a: opacity });
}

// Renders all 14 shape kinds through one shared Konva `Shape` — geometry
// lives in shapeGeometry.js/shapeKinds.js, not here, so adding a kind never
// touches this component.
//
// Phase 11 gradient fills (spec §36/§37): every shapeGeometry.js sceneFunc
// already paints via `context.fillStrokeShape(shapeNode)`, which is Konva's
// own fill mechanism — it already understands fillLinearGradient*/
// fillRadialGradient* node attrs natively, so a gradient fill needs no
// sceneFunc changes at all, just conditionally passing those attrs instead
// of a plain `fill`. `item.fillGradient` is the fully-resolved descriptor
// (see brandKitService.js's resolveGradient, or gradientFill.js for the ad
// hoc text-color-panel path) written onto the item at apply-time — never
// re-read from the brand kit at render time (see brandLinks.js's
// fallback-value design note).
export default function ShapeNode({ item, commonProps, shadowProps }) {
  const kindDef = SHAPE_KINDS[item.shapeKind] || SHAPE_KINDS.rectangle;
  const gradient = resolveGradientKonvaProps(item);
  // Image Fill (same item.fillImage descriptor + resolver Text's
  // TextColorPanel/imageFill.js already established) — wins over gradient
  // exactly like gradient already wins over the plain fill color, same
  // precedence SimpleTextNode.jsx uses.
  const { objectUrl: fillImageUrl } = useAsset(item.fillImage?.assetId);
  const { image: fillImageEl, naturalWidth: fillImageNaturalWidth, naturalHeight: fillImageNaturalHeight } = useImageElement(fillImageUrl);
  const imageFill = resolveImageFillKonvaProps(item, fillImageEl, fillImageNaturalWidth, fillImageNaturalHeight);
  return (
    <Shape
      {...commonProps}
      fill={imageFill || gradient ? undefined : item.fill || "#8b5cf6"}
      {...(imageFill || gradient)}
      stroke={strokeWithOpacity(item.stroke || "transparent", item.strokeOpacity ?? 1)}
      strokeWidth={item.strokeWidth || 0}
      {...borderDashProps(item.strokeStyle, item.strokeWidth)}
      fillRule={kindDef.fillRule}
      sceneFunc={(context, shapeNode) => kindDef.sceneFunc(context, shapeNode, item)}
      {...shadowProps}
    />
  );
}
