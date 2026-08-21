import React from "react";
import { ArrowDown, ArrowUp, ClipboardCopy, ClipboardPaste, Copy, ImagePlus, Lock, Trash2, Unlock } from "lucide-react";
import { contentToScreen } from "../viewport";

// Bumped from 328 to fit the new Copy/Paste buttons (see App.jsx's
// onCopy/onPaste props below) — the only deliberate desktop-visual change
// in the mobile-responsiveness pass, needed because Copy/Paste previously
// had no on-screen button anywhere (only reachable via the right-click
// menu, which doesn't work via long-press on touch — see useLongPress.js).
const TOOLBAR_WIDTH = 418;
const TOOLBAR_HEIGHT = 50;
// Large enough to clear the Transformer's rotate handle — both this GAP and
// App.jsx's `rotateAnchorOffset` live in the same raw Konva-unit space
// (neither is scale-compensated), so they shrink/grow together at every
// zoom level rather than drifting apart the way they would if only one of
// the two were zoom-invariant.
const GAP = 56;

function getSelectionToolbarPos(selectionBoundsContent, viewport, frameSize) {
  const topLeft = contentToScreen({ x: selectionBoundsContent.left, y: selectionBoundsContent.top }, viewport);
  const bottomRight = contentToScreen(
    { x: selectionBoundsContent.right, y: selectionBoundsContent.bottom },
    viewport
  );

  const desiredTop = topLeft.y - TOOLBAR_HEIGHT - GAP;
  const flipBelow = desiredTop < 0;
  const top = flipBelow ? bottomRight.y + GAP : desiredTop;
  const clampedTop = Math.max(0, Math.min(frameSize.height - TOOLBAR_HEIGHT, top));

  const centerX = (topLeft.x + bottomRight.x) / 2;
  const left = Math.max(TOOLBAR_WIDTH / 2, Math.min(frameSize.width - TOOLBAR_WIDTH / 2, centerX));

  return { left, top: clampedTop };
}

export default function SelectionToolbar({
  selectionBoundsContent,
  viewport,
  frameSize,
  isLocked,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onForward,
  onBackward,
  onToggleLock,
  onOpenShapeFill,
}) {
  if (!selectionBoundsContent) return null;
  const { left, top } = getSelectionToolbarPos(selectionBoundsContent, viewport, frameSize);

  return (
    <div
      className="pointer-events-auto absolute z-10 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg"
      style={{ left, top }}
    >
      {onOpenShapeFill && (
        <button className="rounded-lg p-2.5 text-gray-500 hover:bg-gray-100" onClick={onOpenShapeFill} title="Shape fill">
          <ImagePlus size={24} />
        </button>
      )}
      <button className="rounded-lg p-2.5 text-gray-500 hover:bg-gray-100" onClick={onCopy} title="Copy (Cmd/Ctrl+C)">
        <ClipboardCopy size={24} />
      </button>
      {onPaste && (
        <button className="rounded-lg p-2.5 text-gray-500 hover:bg-gray-100" onClick={onPaste} title="Paste (Cmd/Ctrl+V)">
          <ClipboardPaste size={24} />
        </button>
      )}
      <button className="rounded-lg p-2.5 text-gray-500 hover:bg-gray-100" onClick={onDuplicate} title="Duplicate">
        <Copy size={24} />
      </button>
      <button className="rounded-lg p-2.5 text-gray-500 hover:bg-gray-100" onClick={onForward} title="Bring forward">
        <ArrowUp size={24} />
      </button>
      <button className="rounded-lg p-2.5 text-gray-500 hover:bg-gray-100" onClick={onBackward} title="Send backward">
        <ArrowDown size={24} />
      </button>
      <button
        className="rounded-lg p-2.5 text-gray-500 hover:bg-gray-100"
        onClick={onToggleLock}
        title={isLocked ? "Unlock" : "Lock"}
      >
        {isLocked ? <Lock size={24} /> : <Unlock size={24} />}
      </button>
      <button className="rounded-lg p-2.5 text-red-500 hover:bg-red-50" onClick={onDelete} title="Delete">
        <Trash2 size={24} />
      </button>
    </div>
  );
}
