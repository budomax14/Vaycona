import React, { useRef } from "react";
import { Group } from "react-konva";
import { isRichText, textStretch } from "../richText";
import SimpleTextNode from "./SimpleTextNode";
import RichTextNode from "./RichTextNode";
import CurvedTextNode from "./CurvedTextNode";

// Dispatcher: a non-zero curve amount takes priority over everything else
// (arc placement needs its own per-glyph layout — see CurvedTextNode.jsx).
// Otherwise, the overwhelming majority of text objects have a single
// uniform style and stay on the cheap native Konva Text path
// (SimpleTextNode). Only objects with real per-run formatting or list
// structure pay for the manual layout+draw path (RichTextNode).
function renderTextBody(item, commonProps) {
  if (item.curve) return <CurvedTextNode item={item} commonProps={commonProps} />;
  return isRichText(item) ? (
    <RichTextNode item={item} commonProps={commonProps} />
  ) : (
    <SimpleTextNode item={item} commonProps={commonProps} />
  );
}

export default function TextNode({ item, commonProps }) {
  const innerRef = useRef(null);
  if (!item.stretchText) return renderTextBody(item, commonProps);

  // Heading/Subheading glyph stretch (see richText.js's textStretch): the
  // outer, ref'd Group is the item's real visible box — what the
  // Transformer, selection and export read — while the text itself is laid
  // out unstretched at width/sx × height/sy and drawn through a scaled
  // inner Group. Always wrapped for stretchText items (even at 1/1) so the
  // node registered with the Transformer never changes identity mid-life.
  const { ref, id, x, y, width, height, rotation, opacity, draggable, dragBoundFunc, ...handlers } = commonProps;
  const { sx, sy } = textStretch(item);
  const natural = { ...item, width: width / sx, height: height / sy };
  return (
    <Group ref={ref} id={id} x={x} y={y} width={width} height={height} rotation={rotation} opacity={opacity} draggable={draggable} dragBoundFunc={dragBoundFunc} {...handlers}>
      <Group scaleX={sx} scaleY={sy}>
        {renderTextBody(natural, { ref: innerRef, x: 0, y: 0, width: natural.width, height: natural.height, rotation: 0, opacity: 1, draggable: false })}
      </Group>
    </Group>
  );
}
