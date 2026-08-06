import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  FileInput,
  Group as GroupIcon,
  Lock,
  Pencil,
  Scissors,
  SendToBack,
  ArrowUpToLine,
  Trash2,
  Ungroup as UngroupIcon,
  Unlock,
  MousePointerClick,
} from "lucide-react";

// Reuses the same .context-menu / .context-menu-divider CSS already used
// by the canvas right-click menu (ContextMenu.jsx) for visual consistency,
// but adds explicit viewport clamping (required for a Layers-panel menu
// that can open anywhere in a scrollable list, unlike the canvas menu
// which only ever opens inside the workspace).
export default function LayerContextMenu({ item, pages, activePageId, position, onClose, onAction }) {
  const menuRef = useRef(null);
  const [clampedPos, setClampedPos] = useState(position);
  const [movePageOpen, setMovePageOpen] = useState(false);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 8;
    const maxY = window.innerHeight - rect.height - 8;
    setClampedPos({ x: Math.max(8, Math.min(position.x, maxX)), y: Math.max(8, Math.min(position.y, maxY)) });
  }, [position, movePageOpen]);

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

  function run(action, payload) {
    onAction(action, payload);
    onClose();
  }

  const isGroup = item.type === "group";
  const otherPages = pages.filter((p) => p.id !== activePageId);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      role="menu"
      aria-label={`${item.name || item.type} actions`}
      style={{ left: clampedPos.x, top: clampedPos.y }}
    >
      <button role="menuitem" onClick={() => run("rename")}>
        <Pencil size={15} /> Rename
      </button>
      <button role="menuitem" onClick={() => run("duplicate")}>
        <Copy size={15} /> Duplicate
      </button>
      <button role="menuitem" onClick={() => run("copy")}>
        <Copy size={15} /> Copy
      </button>
      <button role="menuitem" onClick={() => run("cut")}>
        <Scissors size={15} /> Cut
      </button>
      <div className="context-menu-divider" />
      <button role="menuitem" onClick={() => run("front")}>
        <ArrowUpToLine size={15} /> Bring to front
      </button>
      <button role="menuitem" onClick={() => run("forward")}>
        <ChevronUp size={15} /> Bring forward
      </button>
      <button role="menuitem" onClick={() => run("backward")}>
        <ChevronDown size={15} /> Send backward
      </button>
      <button role="menuitem" onClick={() => run("back")}>
        <SendToBack size={15} /> Send to back
      </button>
      <div className="context-menu-divider" />
      <button role="menuitem" onClick={() => run("toggle-lock")}>
        {item.locked ? <Unlock size={15} /> : <Lock size={15} />} {item.locked ? "Unlock" : "Lock"}
      </button>
      <button role="menuitem" onClick={() => run("toggle-hidden")}>
        {item.hidden ? <Eye size={15} /> : <EyeOff size={15} />} {item.hidden ? "Show" : "Hide"}
      </button>
      <div className="context-menu-divider" />
      {isGroup ? (
        <button role="menuitem" onClick={() => run("ungroup")}>
          <UngroupIcon size={15} /> Ungroup
        </button>
      ) : (
        <button role="menuitem" onClick={() => run("group")}>
          <GroupIcon size={15} /> Group
        </button>
      )}
      {isGroup && (
        <button role="menuitem" onClick={() => run("select-children")}>
          <MousePointerClick size={15} /> Select children
        </button>
      )}
      {otherPages.length > 0 && (
        <>
          <div className="context-menu-divider" />
          <button role="menuitem" onClick={() => setMovePageOpen((v) => !v)}>
            <FileInput size={15} /> Move to page {movePageOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          {movePageOpen &&
            otherPages.map((page, index) => (
              <button key={page.id} role="menuitem" className="pl-6" onClick={() => run("move-to-page", page.id)}>
                {page.name || `Page ${index + 1}`}
              </button>
            ))}
        </>
      )}
      <div className="context-menu-divider" />
      <button role="menuitem" className="danger" onClick={() => run("delete")}>
        <Trash2 size={15} /> Delete
      </button>
    </div>
  );
}
