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
import { useLanguage } from "../../../languageContext";
import { PANEL_STRINGS } from "../../../i18n/panels";

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
// own Phase 6 update) still get a sensible fallback label. `t` defaults to
// the English strings so that older callers not yet updated for i18n
// (e.g. the StatusBar's LayersPopover) keep working unchanged.
function layerLabel(item, assetIndex, t = PANEL_STRINGS.en.layerRow) {
  if (item.name) return item.name;
  if (item.type === "text") return item.text?.slice(0, 28) || t.text;
  if (item.type === "group") return t.group;
  if (item.type === "image") {
    if (!item.assetId) return t.image;
    const meta = assetIndex?.[item.assetId];
    if (!meta) return t.missingImage;
    return meta.name || t.image;
  }
  if (item.type === "frame") {
    const kindLabel = getDisplayName(item);
    if (!item.contentAssetId) return kindLabel;
    const meta = assetIndex?.[item.contentAssetId];
    if (!meta) return t.missingImageSuffix(kindLabel);
    return t.withImageName(kindLabel, meta.name || t.imageLower);
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
  const { language } = useLanguage();
  const t = PANEL_STRINGS[language].layerRow;
  const [draft, setDraft] = useState(layerLabel(item, assetIndex, t));
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
      setDraft(layerLabel(item, assetIndex, t));
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [isRenaming]); // eslint-disable-line react-hooks/exhaustive-deps

  function commit() {
    const trimmed = draft.trim();
    onCommitRename(trimmed || layerLabel(item, assetIndex, t));
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
            aria-label={expanded ? t.collapseGroup : t.expandGroup}
            title={expanded ? t.collapse : t.expand}
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
            title={layerLabel(item, assetIndex, t)}
          >
            {layerLabel(item, assetIndex, t)}
          </button>
        )}

        <button
          className="shrink-0 rounded p-1 text-gray-400 opacity-0 hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100 disabled:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            onToggleHidden(item.id);
          }}
          aria-label={item.hidden ? t.showLayer : t.hideLayer}
          title={
            item.hidden
              ? t.hiddenClickToShow
              : effectivelyHidden
                ? t.hiddenByParentGroup
                : t.hideLayer
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
          aria-label={item.locked ? t.unlockLayer : t.lockLayer}
          title={
            item.locked
              ? t.lockedClickToUnlock
              : effectivelyLocked
                ? t.lockedByParentGroup
                : t.lockLayer
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
          aria-label={t.moreActions}
          title={t.moreActions}
        >
          <MoreHorizontal size={13} />
        </button>
      </div>
    </div>
  );
}

export { layerLabel };
