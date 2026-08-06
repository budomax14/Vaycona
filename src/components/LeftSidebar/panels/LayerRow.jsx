import React, { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Frame,
  Group as GroupIcon,
  Image as ImageIcon,
  Lock,
  MinusSquare,
  MoreHorizontal,
  Shapes,
  Sticker,
  Type,
  Unlock,
} from "lucide-react";
import { isEffectivelyHidden, isEffectivelyLocked } from "../../../hierarchy";
import { getDisplayName } from "../../../objectRegistry";
import { useAssetList } from "../../../useAsset";

const TYPE_ICONS = {
  text: Type,
  shape: Shapes,
  line: MinusSquare,
  icon: Sticker,
  frame: Frame,
  image: ImageIcon,
  group: GroupIcon,
};

// Distinguishes standalone image / empty frame / filled frame / missing
// asset in the Layers panel (Phase 6) — assetIndex is the same synchronous
// localStorage asset index useAssetList() reads, passed in optionally so
// callers that don't have it yet (existing StatusBar popover, before its
// own Phase 6 update) still get a sensible fallback label.
function layerLabel(item, assetIndex) {
  if (item.name) return item.name;
  if (item.type === "text") return item.text?.slice(0, 28) || "Text";
  if (item.type === "group") return "Group";
  if (item.type === "image") {
    if (!item.assetId) return "Image";
    const meta = assetIndex?.[item.assetId];
    if (!meta) return "Missing image";
    return meta.name || "Image";
  }
  if (item.type === "frame") {
    const kindLabel = getDisplayName(item);
    if (!item.contentAssetId) return kindLabel;
    const meta = assetIndex?.[item.contentAssetId];
    if (!meta) return `${kindLabel} (missing image)`;
    return `${kindLabel} — ${meta.name || "image"}`;
  }
  return getDisplayName(item);
}

function isMissingAsset(item, assetIndex) {
  if (item.type === "image" && item.assetId) return !assetIndex?.[item.assetId];
  if (item.type === "frame" && item.contentAssetId) return !assetIndex?.[item.contentAssetId];
  return false;
}

export default function LayerRow({
  node,
  depth,
  itemsById,
  isSelected,
  isExpanded,
  forceExpanded,
  isDragOver,
  dropPosition,
  isRenaming,
  onToggleExpand,
  onSelect,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onToggleHidden,
  onToggleLocked,
  onContextMenu,
  onDragHandleDown,
  onRowDragOver,
  onRowDrop,
  onRowDragLeave,
}) {
  const { item } = node;
  const assetIndex = useAssetList();
  const [draft, setDraft] = useState(layerLabel(item, assetIndex));
  const inputRef = useRef(null);
  const Icon = TYPE_ICONS[item.type] || Shapes;
  const effectivelyHidden = isEffectivelyHidden(item, itemsById);
  const effectivelyLocked = isEffectivelyLocked(item, itemsById);
  const hasChildren = node.children.length > 0;
  const expanded = forceExpanded || isExpanded;
  const missingAsset = isMissingAsset(item, assetIndex);
  const thumbAssetId = item.type === "image" ? item.assetId : item.type === "frame" ? item.contentAssetId : null;
  const thumbDataUrl = thumbAssetId ? assetIndex?.[thumbAssetId]?.thumbDataUrl : null;

  useEffect(() => {
    if (isRenaming) {
      setDraft(layerLabel(item, assetIndex));
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [isRenaming]); // eslint-disable-line react-hooks/exhaustive-deps

  function commit() {
    const trimmed = draft.trim();
    onCommitRename(trimmed || layerLabel(item, assetIndex));
  }

  return (
    <div>
      <div
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={item.type === "group" ? expanded : undefined}
        tabIndex={-1}
        data-layer-row-id={item.id}
        draggable={!isRenaming}
        onDragStart={(event) => onDragHandleDown(event, item.id)}
        onDragOver={(event) => onRowDragOver(event, item.id)}
        onDrop={(event) => onRowDrop(event, item.id)}
        onDragLeave={onRowDragLeave}
        className={`group flex items-center gap-1 rounded-lg px-1.5 py-1.5 text-xs ${
          isSelected ? "bg-amber-50 text-amber-700" : "text-gray-600 hover:bg-gray-50"
        } ${isDragOver && dropPosition === "before" ? "border-t-2 border-amber-500" : ""} ${
          isDragOver && dropPosition === "after" ? "border-b-2 border-amber-500" : ""
        } ${isDragOver && dropPosition === "inside" ? "ring-2 ring-inset ring-amber-400" : ""}`}
        style={{ paddingLeft: 6 + depth * 16 }}
        onClick={(event) => onSelect(item.id, event)}
      >
        {item.type === "group" ? (
          <button
            className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100"
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpand(item.id);
            }}
            aria-label={expanded ? "Collapse group" : "Expand group"}
            title={expanded ? "Collapse" : "Expand"}
          >
            {hasChildren ? (expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : <span className="inline-block w-[13px]" />}
          </button>
        ) : (
          <span className="inline-block w-[13px] shrink-0" />
        )}

        {thumbDataUrl ? (
          <img src={thumbDataUrl} alt="" className="h-4 w-4 shrink-0 rounded-sm object-cover" />
        ) : (
          <Icon size={13} className={`shrink-0 ${missingAsset ? "text-red-400" : "text-gray-400"}`} />
        )}

        {isRenaming ? (
          <input
            ref={inputRef}
            autoFocus
            maxLength={80}
            className="w-full min-w-0 flex-1 rounded border border-amber-300 px-1 py-0.5 text-xs"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commit();
              } else if (event.key === "Escape") {
                event.preventDefault();
                onCancelRename();
              }
            }}
          />
        ) : (
          <button
            className={`min-w-0 flex-1 truncate text-left ${missingAsset ? "text-red-500" : ""}`}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onStartRename();
            }}
            title={layerLabel(item, assetIndex)}
          >
            {layerLabel(item, assetIndex)}
          </button>
        )}

        <button
          className="shrink-0 rounded p-1 text-gray-400 opacity-0 hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100 disabled:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            onToggleHidden(item.id);
          }}
          aria-label={item.hidden ? "Show layer" : "Hide layer"}
          title={
            item.hidden
              ? "Hidden — click to show"
              : effectivelyHidden
                ? "Hidden by parent group"
                : "Hide layer"
          }
          style={{ opacity: item.hidden || effectivelyHidden ? 1 : undefined }}
        >
          {item.hidden || effectivelyHidden ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <button
          className="shrink-0 rounded p-1 text-gray-400 opacity-0 hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100 disabled:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            onToggleLocked(item.id);
          }}
          aria-label={item.locked ? "Unlock layer" : "Lock layer"}
          title={
            item.locked
              ? "Locked — click to unlock"
              : effectivelyLocked
                ? "Locked by parent group"
                : "Lock layer"
          }
          style={{ opacity: item.locked || effectivelyLocked ? 1 : undefined }}
        >
          {item.locked || effectivelyLocked ? <Lock size={13} /> : <Unlock size={13} />}
        </button>
        <button
          className="shrink-0 rounded p-1 text-gray-400 opacity-0 hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            onContextMenu(item.id, event);
          }}
          aria-label="More actions"
          title="More actions"
        >
          <MoreHorizontal size={13} />
        </button>
      </div>
    </div>
  );
}

export { layerLabel };
