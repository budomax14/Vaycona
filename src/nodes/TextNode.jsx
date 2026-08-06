import React from "react";
import { isRichText } from "../richText";
import SimpleTextNode from "./SimpleTextNode";
import RichTextNode from "./RichTextNode";
import CurvedTextNode from "./CurvedTextNode";

// Dispatcher: a non-zero curve amount takes priority over everything else
// (arc placement needs its own per-glyph layout — see CurvedTextNode.jsx).
// Otherwise, the overwhelming majority of text objects have a single
// uniform style and stay on the cheap native Konva Text path
// (SimpleTextNode). Only objects with real per-run formatting or list
// structure pay for the manual layout+draw path (RichTextNode).
export default function TextNode({ item, commonProps }) {
  if (item.curve) return <CurvedTextNode item={item} commonProps={commonProps} />;
  return isRichText(item) ? (
    <RichTextNode item={item} commonProps={commonProps} />
  ) : (
    <SimpleTextNode item={item} commonProps={commonProps} />
  );
}
