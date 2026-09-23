import React from "react";
import { ArrowDown, ArrowUp, ClipboardCopy, ClipboardPaste, Copy, ImagePlus, Lock, MoreVertical, Trash2, Unlock } from "lucide-react";
import { contentToScreen } from "../viewport";
import { useLanguage } from "../languageContext";
import { TOOLBAR_MENU_STRINGS } from "../i18n/toolbarMenus";

// Bumped from 328 to fit the new Copy/Paste buttons (see App.jsx's
// onCopy/onPaste props below) — the only deliberate desktop-visual change
// in the mobile-responsiveness pass, needed because Copy/Paste previously
// had no on-screen button anywhere (only reachable via the right-click
// menu, which doesn't work via long-press on touch — see useLongPress.js).
// Bumped again for the touch-only "more options" button (onOpenContextMenu)
// that opens the full ContextMenu — the sole way to reach it on touch now
// that DesignNode.jsx no longer has a double-tap gesture for it.
const TOOLBAR_WIDTH = 418 + 48;
const TOOLBAR_HEIGHT = 50;
// Phone ("large") buttons are bigger touch targets — see the `large` prop
// below — so the estimated footprint used for positioning/clamping grows
// with them.
const TOOLBAR_WIDTH_LARGE = 560;
const TOOLBAR_HEIGHT_LARGE = 64;
// Large enough to clear the Transformer's rotate handle — both this GAP and
// App.jsx's `rotateAnchorOffset` live in the same raw Konva-unit space
// (neither is scale-compensated), so they shrink/grow together at every
// zoom level rather than drifting apart the way they would if only one of
// the two were zoom-invariant.
const GAP = 56;

function getSelectionToolbarPos(selectionBoundsContent, viewport, frameSize, large) {
  const toolbarWidth = large ? TOOLBAR_WIDTH_LARGE : TOOLBAR_WIDTH;
  const toolbarHeight = large ? TOOLBAR_HEIGHT_LARGE : TOOLBAR_HEIGHT;
  const topLeft = contentToScreen({ x: selectionBoundsContent.left, y: selectionBoundsContent.top }, viewport);
  const bottomRight = contentToScreen(
    { x: selectionBoundsContent.right, y: selectionBoundsContent.bottom },
    viewport
  );

  const desiredTop = topLeft.y - toolbarHeight - GAP;
  const flipBelow = desiredTop < 0;
  const top = flipBelow ? bottomRight.y + GAP : desiredTop;
  const clampedTop = Math.max(0, Math.min(frameSize.height - toolbarHeight, top));

  // On a narrow phone the toolbar can be wider than the available frame —
  // it never shrinks its icons to fit (see the component below) — so clamp
  // against whichever is smaller and let the toolbar scroll horizontally
  // instead of clipping against the frame edge or running off-screen.
  const effectiveWidth = Math.min(toolbarWidth, Math.max(0, frameSize.width - 16));
  const centerX = (topLeft.x + bottomRight.x) / 2;
  const left = Math.max(effectiveWidth / 2, Math.min(frameSize.width - effectiveWidth / 2, centerX));

  return { left, top: clampedTop, maxWidth: effectiveWidth };
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
  onOpenContextMenu,
  // Phone-only: buttons closer in size to MobileBottomBar's, since the
  // regular desktop size (below) reads as noticeably smaller/harder to tap
  // next to that bar's icons.
  large = false,
}) {
  const { language } = useLanguage();
  const t = TOOLBAR_MENU_STRINGS[language].selectionToolbar;

  if (!selectionBoundsContent) return null;
  const { left, top, maxWidth } = getSelectionToolbarPos(selectionBoundsContent, viewport, frameSize, large);
  const iconSize = large ? 30 : 24;
  const buttonPad = large ? "p-3.5" : "p-2.5";
  const buttonClass = `rounded-lg ${buttonPad} text-gray-500 hover:bg-gray-100`;

  return (
    <div
      className="pointer-events-auto absolute z-10 flex -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg"
      style={{ left, top, maxWidth }}
    >
      {onOpenShapeFill && (
        <button className={buttonClass} onClick={onOpenShapeFill} title={t.shapeFill}>
          <ImagePlus size={iconSize} />
        </button>
      )}
      <button className={buttonClass} onClick={onCopy} title={t.copy}>
        <ClipboardCopy size={iconSize} />
      </button>
      {onPaste && (
        <button className={buttonClass} onClick={onPaste} title={t.paste}>
          <ClipboardPaste size={iconSize} />
        </button>
      )}
      <button className={buttonClass} onClick={onDuplicate} title={t.duplicate}>
        <Copy size={iconSize} />
      </button>
      <button className={buttonClass} onClick={onForward} title={t.bringForward}>
        <ArrowUp size={iconSize} />
      </button>
      <button className={buttonClass} onClick={onBackward} title={t.sendBackward}>
        <ArrowDown size={iconSize} />
      </button>
      <button className={buttonClass} onClick={onToggleLock} title={isLocked ? t.unlock : t.lock}>
        {isLocked ? <Lock size={iconSize} /> : <Unlock size={iconSize} />}
      </button>
      <button className={`rounded-lg ${buttonPad} text-red-500 hover:bg-red-50`} onClick={onDelete} title={t.delete}>
        <Trash2 size={iconSize} />
      </button>
      {onOpenContextMenu && (
        <button className={buttonClass} onClick={onOpenContextMenu} title={t.moreOptions}>
          <MoreVertical size={iconSize} />
        </button>
      )}
    </div>
  );
}
