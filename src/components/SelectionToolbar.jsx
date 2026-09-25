import React from "react";
import { ArrowDown, ArrowUp, ClipboardCopy, ClipboardPaste, Copy, ImagePlus, Lock, MoreHorizontal, MoreVertical, Trash2, Unlock } from "lucide-react";
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
// Large enough to clear the Transformer's rotate handle — both this GAP and
// App.jsx's `rotateAnchorOffset` live in the same raw Konva-unit space
// (neither is scale-compensated), so they shrink/grow together at every
// zoom level rather than drifting apart the way they would if only one of
// the two were zoom-invariant.
const GAP = 56;

// Phone: the toolbar lives inside the canvas frame, which is CSS-scaled far
// below 1:1 (see App.jsx's displayScale), so it's counter-scaled back to
// real on-screen pixels and sized/positioned in those. The phone rotate
// handle sits 30 on-screen px above the selection (App.jsx), so the gap
// clears it with room for a fingertip.
const PHONE_TOOLBAR_HEIGHT = 52;
const PHONE_BUTTON_WIDTH = 44;
const PHONE_GAP = 50;
const PHONE_EDGE_MARGIN = 8;

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

  // On a narrow phone the toolbar can be wider than the available frame —
  // it never shrinks its icons to fit (see the component below) — so clamp
  // against whichever is smaller and let the toolbar scroll horizontally
  // instead of clipping against the frame edge or running off-screen.
  const effectiveWidth = Math.min(TOOLBAR_WIDTH, Math.max(0, frameSize.width - 16));
  const centerX = (topLeft.x + bottomRight.x) / 2;
  const left = Math.max(effectiveWidth / 2, Math.min(frameSize.width - effectiveWidth / 2, centerX));

  return { left, top: clampedTop, maxWidth: effectiveWidth };
}

// Same idea as above, but every size is in on-screen px and converted into
// frame units via `phoneScale`. The toolbar may overhang the page frame
// (the page is inset from the screen edges on a phone), so it's only kept
// centred on the selection, and flips below when there's no room above.
function getPhoneToolbarPos(selectionBoundsContent, viewport, frameSize, phoneScale, buttonCount) {
  const k = 1 / phoneScale;
  const toolbarWidth = (buttonCount * PHONE_BUTTON_WIDTH + 12) * k;
  const toolbarHeight = PHONE_TOOLBAR_HEIGHT * k;
  const gap = PHONE_GAP * k;
  const topLeft = contentToScreen({ x: selectionBoundsContent.left, y: selectionBoundsContent.top }, viewport);
  const bottomRight = contentToScreen({ x: selectionBoundsContent.right, y: selectionBoundsContent.bottom }, viewport);

  const desiredTop = topLeft.y - toolbarHeight - gap;
  const flipBelow = desiredTop < -toolbarHeight;
  const top = flipBelow ? bottomRight.y + gap : desiredTop;

  const centerX = (topLeft.x + bottomRight.x) / 2;
  const margin = PHONE_EDGE_MARGIN * k;
  const minLeft = Math.min(frameSize.width / 2, toolbarWidth / 2 - margin);
  const maxLeft = Math.max(frameSize.width / 2, frameSize.width - toolbarWidth / 2 + margin);
  const left = Math.max(minLeft, Math.min(maxLeft, centerX));
  return { left, top };
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
  // Phone-only: the canvas frame's CSS scale (App.jsx's displayScale).
  // When set, renders the compact finger-sized phone pill instead.
  phoneScale = null,
}) {
  const { language } = useLanguage();
  const t = TOOLBAR_MENU_STRINGS[language].selectionToolbar;

  if (!selectionBoundsContent) return null;

  if (phoneScale) {
    // Bring forward/backward live in the "more" menu on phone so the pill
    // stays narrow enough to sit over the selection without scrolling.
    const phoneButtons = [
      onOpenShapeFill && { key: "fill", icon: ImagePlus, title: t.shapeFill, onClick: onOpenShapeFill },
      { key: "copy", icon: ClipboardCopy, title: t.copy, onClick: onCopy },
      onPaste && { key: "paste", icon: ClipboardPaste, title: t.paste, onClick: onPaste },
      { key: "duplicate", icon: Copy, title: t.duplicate, onClick: onDuplicate },
      { key: "lock", icon: isLocked ? Lock : Unlock, title: isLocked ? t.unlock : t.lock, onClick: onToggleLock },
      { key: "delete", icon: Trash2, title: t.delete, onClick: onDelete, danger: true },
      onOpenContextMenu && { key: "more", icon: MoreHorizontal, title: t.moreOptions, onClick: onOpenContextMenu },
    ].filter(Boolean);
    const pos = getPhoneToolbarPos(selectionBoundsContent, viewport, frameSize, phoneScale, phoneButtons.length);
    return (
      <div
        className="phone-selection-toolbar phone-pop-enter pointer-events-auto absolute z-10 flex items-center rounded-full border border-gray-200/80 bg-white/95 px-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.14)] backdrop-blur"
        style={{
          left: pos.left,
          top: pos.top,
          height: PHONE_TOOLBAR_HEIGHT,
          // Right-to-left: centre on `left` at natural size, then scale up
          // from the top-left so it renders at 1:1 on screen.
          transform: `scale(${1 / phoneScale}) translateX(-50%)`,
          transformOrigin: "0 0",
        }}
      >
        {phoneButtons.map(({ key, icon: Icon, title, onClick, danger }) => (
          <button
            key={key}
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-100 active:scale-90 ${
              danger ? "text-red-500 active:bg-red-50" : "text-gray-700 active:bg-gray-100"
            }`}
            onClick={onClick}
            title={title}
            aria-label={title}
          >
            <Icon size={21} strokeWidth={1.9} />
          </button>
        ))}
      </div>
    );
  }

  const { left, top, maxWidth } = getSelectionToolbarPos(selectionBoundsContent, viewport, frameSize);
  const iconSize = 24;
  const buttonPad = "p-2.5";
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
