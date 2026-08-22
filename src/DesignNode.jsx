import React, { useEffect, useRef } from "react";
import { getRenderer } from "./objectRegistry";
import { usePointerCapability } from "./usePointerCapability";

// A second tap arriving faster than this still counts as the existing
// rapid double-tap (onDblTap below — enters text edit / drills into a
// group), left completely alone. Only a slower, more deliberate second
// tap — still within TAP_MENU_MAX_GAP_MS — opens the context menu instead.
const TAP_MENU_MIN_GAP_MS = 400;
const TAP_MENU_MAX_GAP_MS = 2000;

function DesignNode({
  item,
  isSpaceDown,
  isEditingText,
  isLocked,
  onSelect,
  onContextMenu,
  onDragStart,
  onDragMove,
  onDragEnd,
  onItemDblClick,
  dragBoundFunc,
  registerNode,
}) {
  const shapeRef = useRef(null);
  const { hasCoarsePointer } = usePointerCapability();
  const lastTapAtRef = useRef(0);

  // Touch/pen equivalent of the onContextMenu wired below — a native
  // `contextmenu` event doesn't reliably fire from any touch gesture on a
  // Konva canvas, so tapping the object twice (400ms-2s apart) is the only
  // way to reach the (right-click) context menu on a touch device. No-ops
  // on a real mouse (hasCoarsePointer gates it, a device capability, not
  // viewport width).
  function handleTap(event) {
    onSelect(item.id, { additive: false });
    if (!hasCoarsePointer) return;
    const now = Date.now();
    const gap = now - lastTapAtRef.current;
    if (gap >= TAP_MENU_MIN_GAP_MS && gap <= TAP_MENU_MAX_GAP_MS) {
      lastTapAtRef.current = 0;
      onContextMenu(item.id, { clientX: event.evt.clientX, clientY: event.evt.clientY, metaKey: false, ctrlKey: false });
    } else {
      lastTapAtRef.current = now;
    }
  }

  // isEditingText is a dependency here (not just item.id/registerNode)
  // because it gates the early return below: when it flips, the Konva node
  // this effect's own ref is attached to gets unmounted (editing) or
  // freshly remounted (done editing), and only re-running this effect picks
  // up that new shapeRef.current — refs changing on their own don't
  // re-trigger effects. Without this, registerNode kept pointing at the
  // pre-edit node forever, so the Transformer silently stopped finding it
  // on every reselect after the first edit.
  useEffect(() => {
    registerNode(item.id, shapeRef.current);
    return () => registerNode(item.id, null);
  }, [item.id, registerNode, isEditingText]);

  // While this item is being inline-edited, the contenteditable overlay
  // (TextEditOverlay.jsx) is the only visible representation of it — the
  // Konva node is skipped entirely so there's no double-image, but the
  // node must still register (as null->real once editing ends) so the
  // Transformer/registerNode bookkeeping stays consistent.
  if (isEditingText) return null;

  const commonProps = {
    ref: shapeRef,
    id: item.id,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation || 0,
    opacity: item.opacity ?? 1,
    // Phase 12: animationService.computeAnimatedItems overrides these on a
    // per-frame CLONE of the item during preview/playback/presentation/
    // animated export (see App.jsx's renderActivePage) — scaleX/scaleY
    // default to 1 for every normal (non-animated) render, so this is a
    // no-op the rest of the time.
    scaleX: item.scaleX ?? 1,
    scaleY: item.scaleY ?? 1,
    draggable: !isSpaceDown && !isLocked,
    dragBoundFunc,
    onClick: (event) =>
      onSelect(item.id, {
        additive: event.evt.shiftKey || event.evt.metaKey || event.evt.ctrlKey,
        ctrlKey: event.evt.metaKey || event.evt.ctrlKey,
      }),
    onTap: handleTap,
    onContextMenu: (event) => {
      event.evt.preventDefault();
      // Without this, Konva bubbles the event up to the Stage's own
      // onContextMenu (handleCanvasContextMenu), which fires right after
      // and overwrites the position this handler just computed with the
      // raw click point.
      event.cancelBubble = true;
      onContextMenu(item.id, event.evt);
    },
    onDragStart: () => onDragStart(item.id, shapeRef.current),
    onDragMove: () => onDragMove(item.id, shapeRef.current),
    onDragEnd: () => onDragEnd(item.id, shapeRef.current),
    // Wired for every type, not just text — a double-click first tries to
    // drill one level deeper into a group hierarchy (Phase 5 decision 6);
    // only once there's no more group to enter does App.jsx's handler fall
    // back to type-specific behavior (starting inline text edit).
    onDblClick: (event) => onItemDblClick(item.id, event.evt.clientX, event.evt.clientY),
    onDblTap: () => onItemDblClick(item.id, null, null),
  };

  const shadowProps = item.shadow
    ? {
        shadowColor: "#000000",
        shadowBlur: item.shadowBlur ?? 12,
        shadowOpacity: 0.35,
        shadowOffsetX: 0,
        shadowOffsetY: 4,
      }
    : {};

  const Renderer = getRenderer(item.type);
  if (Renderer) {
    return <Renderer item={item} commonProps={commonProps} shadowProps={shadowProps} />;
  }

  return null;
}

export default React.memo(DesignNode);
