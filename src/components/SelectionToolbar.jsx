import React from "react";
import { ClipboardCopy, ClipboardPaste, Copy, ImagePlus, Lock, MoreHorizontal, Trash2, Unlock } from "lucide-react";
import { contentToScreen } from "../viewport";
import { useLanguage } from "../languageContext";
import { TOOLBAR_MENU_STRINGS } from "../i18n/toolbarMenus";

// The same compact pill on every screen (phone, tablet, desktop). It lives
// inside the canvas frame, which is CSS-scaled below 1:1 (see App.jsx's
// displayScale), so it's counter-scaled back to real on-screen pixels and
// sized/positioned in those. The phone rotate
// handle sits 30 on-screen px above the selection (App.jsx), so the gap
// clears it with room for a fingertip.
const PHONE_TOOLBAR_HEIGHT = 52;
const PHONE_BUTTON_WIDTH = 44;
const PHONE_GAP = 50;
const PHONE_EDGE_MARGIN = 8;
const PAGE_PILL_CLEARANCE = 56;

// Every size is in on-screen px and converted into frame units via
// `displayScale`. The toolbar may overhang the page frame
// (the page is inset from the screen edges on a phone), so it's only kept
// centred on the selection, and flips below when there's no room above.
// `visible`: the part of the frame actually on screen (frame units), when
// known — the pill is pulled back inside it so a selection with no room
// above or below (e.g. a full-page shape) never pushes it out of view.
function getToolbarPos(selectionBoundsContent, viewport, frameSize, displayScale, buttonCount, visible) {
  const k = 1 / displayScale;
  const toolbarWidth = (buttonCount * PHONE_BUTTON_WIDTH + 12) * k;
  const toolbarHeight = PHONE_TOOLBAR_HEIGHT * k;
  const gap = PHONE_GAP * k;
  const topLeft = contentToScreen({ x: selectionBoundsContent.left, y: selectionBoundsContent.top }, viewport);
  const bottomRight = contentToScreen({ x: selectionBoundsContent.right, y: selectionBoundsContent.bottom }, viewport);

  const desiredTop = topLeft.y - toolbarHeight - gap;
  const flipBelow = desiredTop < -toolbarHeight;
  let top = flipBelow ? bottomRight.y + gap : desiredTop;
  if (visible) {
    const edge = PHONE_EDGE_MARGIN * k;
    // The bottom keeps clear of the floating page-name pill (Workspace.jsx).
    const bottomClearance = PAGE_PILL_CLEARANCE * k;
    top = Math.max(visible.top + edge, Math.min(visible.bottom - toolbarHeight - bottomClearance, top));
  }

  const centerX = (topLeft.x + bottomRight.x) / 2;
  const margin = PHONE_EDGE_MARGIN * k;
  const minLeft = Math.min(frameSize.width / 2, toolbarWidth / 2 - margin);
  const maxLeft = Math.max(frameSize.width / 2, frameSize.width - toolbarWidth / 2 + margin);
  const left = Math.max(minLeft, Math.min(maxLeft, centerX));
  return { left, top };
}

// The canvas area (App.jsx's .canvas-area, overflow hidden) clips the page
// frame (.canvas-frame); returns the visible slice in frame units.
function getVisibleFrameBounds(displayScale) {
  if (typeof document === "undefined") return null;
  const frame = document.querySelector(".canvas-frame");
  const area = frame?.closest(".canvas-area");
  if (!frame || !area) return null;
  const f = frame.getBoundingClientRect();
  const a = area.getBoundingClientRect();
  return { top: (a.top - f.top) / displayScale, bottom: (a.bottom - f.top) / displayScale };
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
  onToggleLock,
  onOpenShapeFill,
  onOpenContextMenu,
  // The canvas frame's CSS scale (App.jsx's displayScale).
  displayScale,
}) {
  const { language } = useLanguage();
  const t = TOOLBAR_MENU_STRINGS[language].selectionToolbar;

  if (!selectionBoundsContent) return null;

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
  const pos = getToolbarPos(selectionBoundsContent, viewport, frameSize, displayScale, phoneButtons.length, getVisibleFrameBounds(displayScale));
  return (
    <div
      className="phone-selection-toolbar phone-pop-enter pointer-events-auto absolute z-10 flex items-center rounded-full border border-gray-200/80 bg-white/95 px-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.14)] backdrop-blur"
      style={{
        left: pos.left,
        top: pos.top,
        height: PHONE_TOOLBAR_HEIGHT,
        // Right-to-left: centre on `left` at natural size, then scale up
        // from the top-left so it renders at 1:1 on screen.
        transform: `scale(${1 / displayScale}) translateX(-50%)`,
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
