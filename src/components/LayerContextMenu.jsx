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
import { clampPositionToViewport } from "../clampToViewport";
import { useLanguage } from "../languageContext";
import { STATUS_BAR_STRINGS } from "../i18n/statusBarAndMenus";

// Reuses the same .context-menu / .context-menu-divider CSS already used
// by the canvas right-click menu (ContextMenu.jsx) for visual consistency,
// but adds explicit viewport clamping (required for a Layers-panel menu
// that can open anywhere in a scrollable list, unlike the canvas menu
// which only ever opens inside the workspace).
export default function LayerContextMenu({ item, pages, activePageId, position, onClose, onAction }) {
  const menuRef = useRef(null);
  const { language } = useLanguage();
  const t = STATUS_BAR_STRINGS[language].layerContextMenu;
  const [clampedPos, setClampedPos] = useState(position);
  const [movePageOpen, setMovePageOpen] = useState(false);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setClampedPos(clampPositionToViewport(position, rect));
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
      aria-label={t.actionsLabel(item.name || item.type)}
      style={{ left: clampedPos.x, top: clampedPos.y }}
    >
      <button role="menuitem" onClick={() => run("rename")}>
        <Pencil size={15} /> {t.rename}
      </button>
      <button role="menuitem" onClick={() => run("duplicate")}>
        <Copy size={15} /> {t.duplicate}
      </button>
      <button role="menuitem" onClick={() => run("copy")}>
        <Copy size={15} /> {t.copy}
      </button>
      <button role="menuitem" onClick={() => run("cut")}>
        <Scissors size={15} /> {t.cut}
      </button>
      <div className="context-menu-divider" />
      <button role="menuitem" onClick={() => run("front")}>
        <ArrowUpToLine size={15} /> {t.bringToFront}
      </button>
      <button role="menuitem" onClick={() => run("forward")}>
        <ChevronUp size={15} /> {t.bringForward}
      </button>
      <button role="menuitem" onClick={() => run("backward")}>
        <ChevronDown size={15} /> {t.sendBackward}
      </button>
      <button role="menuitem" onClick={() => run("back")}>
        <SendToBack size={15} /> {t.sendToBack}
      </button>
      <div className="context-menu-divider" />
      <button role="menuitem" onClick={() => run("toggle-lock")}>
        {item.locked ? <Unlock size={15} /> : <Lock size={15} />} {item.locked ? t.unlock : t.lock}
      </button>
      <button role="menuitem" onClick={() => run("toggle-hidden")}>
        {item.hidden ? <Eye size={15} /> : <EyeOff size={15} />} {item.hidden ? t.show : t.hide}
      </button>
      <div className="context-menu-divider" />
      {isGroup ? (
        <button role="menuitem" onClick={() => run("ungroup")}>
          <UngroupIcon size={15} /> {t.ungroup}
        </button>
      ) : (
        <button role="menuitem" onClick={() => run("group")}>
          <GroupIcon size={15} /> {t.group}
        </button>
      )}
      {isGroup && (
        <button role="menuitem" onClick={() => run("select-children")}>
          <MousePointerClick size={15} /> {t.selectChildren}
        </button>
      )}
      {otherPages.length > 0 && (
        <>
          <div className="context-menu-divider" />
          <button role="menuitem" onClick={() => setMovePageOpen((v) => !v)}>
            <FileInput size={15} /> {t.moveToPage} {movePageOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          {movePageOpen &&
            otherPages.map((page, index) => (
              <button key={page.id} role="menuitem" className="pl-6" onClick={() => run("move-to-page", page.id)}>
                {page.name || t.pageDefaultName(index + 1)}
              </button>
            ))}
        </>
      )}
      <div className="context-menu-divider" />
      <button role="menuitem" className="danger" onClick={() => run("delete")}>
        <Trash2 size={15} /> {t.delete}
      </button>
    </div>
  );
}
