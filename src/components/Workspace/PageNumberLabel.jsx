import React from "react";
import { Text } from "react-konva";
import { pageNumberPlacement, PAGE_NUMBER_FONT_SIZE } from "../../pageNumbering";

// Plain, non-interactive number — never a real item (no id, not in
// `items`, not selectable/draggable/exportable-as-an-object) — so it can
// never be individually deleted/moved and always tracks the page's current
// position automatically, including after reordering.
export default function PageNumberLabel({ page, pageNumber, position }) {
  const { x, y, width, align } = pageNumberPlacement(position, page.width, page.height);
  return (
    <Text
      x={x}
      y={y}
      width={width}
      align={align}
      text={String(pageNumber)}
      fontSize={PAGE_NUMBER_FONT_SIZE}
      fontFamily="Arial"
      fill="#6b7280"
      listening={false}
    />
  );
}
