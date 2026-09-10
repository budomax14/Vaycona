import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Copy,
  ClipboardPaste,
  CopyPlus,
  Trash2,
  ArrowUpToLine,
  ArrowDownToLine,
  ChevronUp,
  ChevronDown,
  Lock,
  Unlock,
  Eraser,
  Loader2,
} from "lucide-react";
import { clampPositionToViewport } from "./clampToViewport";
import { useLanguage } from "./languageContext";
import { STATUS_BAR_STRINGS } from "./i18n/statusBarAndMenus";

export default function ContextMenu({
  position,
  onClose,
  onAction,
  hasSelection,
  hasClipboard,
  isLocked,
  canRemoveBackground,
  isRemovingBackground,
}) {
  const menuRef = useRef(null);
  const { language } = useLanguage();
  const t = STATUS_BAR_STRINGS[language].contextMenu;

  const items = useMemo(
    () => [
      { key: "copy", label: t.copy, icon: Copy, needsSelection: true },
      { key: "paste", label: t.paste, icon: ClipboardPaste, needsClipboard: true },
      { key: "duplicate", label: t.duplicate, icon: CopyPlus, needsSelection: true },
      { key: "divider1" },
      { key: "bring-to-front", label: t.bringToFront, icon: ArrowUpToLine, needsSelection: true },
      { key: "bring-forward", label: t.bringForward, icon: ChevronUp, needsSelection: true },
      { key: "send-backward", label: t.sendBackward, icon: ChevronDown, needsSelection: true },
      { key: "send-to-back", label: t.sendToBack, icon: ArrowDownToLine, needsSelection: true },
      ...(canRemoveBackground
        ? [
            { key: "divider3" },
            {
              key: "remove-background",
              label: isRemovingBackground ? t.removingBackground : t.removeBackground,
              icon: isRemovingBackground ? Loader2 : Eraser,
              iconClassName: isRemovingBackground ? "animate-spin" : "",
              needsSelection: true,
              disabled: isRemovingBackground,
            },
          ]
        : []),
      { key: "divider2" },
      {
        key: "toggle-lock",
        label: isLocked ? t.unlock : t.lock,
        icon: isLocked ? Unlock : Lock,
        needsSelection: true,
      },
      { key: "delete", label: t.delete, icon: Trash2, needsSelection: true, danger: true },
    ],
    [isLocked, canRemoveBackground, isRemovingBackground, t]
  );

  useEffect(() => {
    function handleOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) onClose();
    }
    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Clamp to the viewport so a right-click near the right/bottom edge
  // doesn't render the menu partially off-screen — runs before paint so
  // there's no visible jump from the unclamped position.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const clamped = clampPositionToViewport(position, rect);
    menu.style.left = `${clamped.x}px`;
    menu.style.top = `${clamped.y}px`;
  }, [position]);

  // Portaled to document.body — this is rendered from inside the canvas's
  // own transform:scale(...) wrapper (renderActivePage's canvasFrameRef),
  // and a `transform` on an ancestor makes it the containing block for any
  // `position: fixed` descendant per the CSS spec. Without the portal, this
  // menu's "fixed" left/top were being resolved against that transformed
  // ancestor instead of the viewport — offset and rescaled by whatever the
  // current zoom happened to be, which is what read as the menu opening in
  // the wrong place instead of beside the click.
  return createPortal(
    <div ref={menuRef} className="context-menu" style={{ left: position.x, top: position.y }}>
      {items.map((item) =>
        item.key.startsWith("divider") ? (
          <div key={item.key} className="context-menu-divider" />
        ) : (
          <button
            key={item.key}
            className={item.danger ? "danger" : ""}
            disabled={
              (item.needsSelection && !hasSelection) || (item.needsClipboard && !hasClipboard) || item.disabled
            }
            onClick={() => {
              onAction(item.key);
              onClose();
            }}
          >
            <item.icon size={18} className={item.iconClassName} /> {item.label}
          </button>
        )
      )}
    </div>,
    document.body
  );
}
