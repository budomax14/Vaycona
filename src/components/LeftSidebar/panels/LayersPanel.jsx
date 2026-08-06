import React, { useMemo, useRef, useState } from "react";
import { ChevronsDown, ChevronsUp, Layers, Search } from "lucide-react";
import { buildLayerTree } from "../../../hierarchy";
import LayerRow, { layerLabel } from "./LayerRow";
import LayerContextMenu from "../../LayerContextMenu";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "text", label: "Text" },
  { key: "shape", label: "Shapes" },
  { key: "line", label: "Lines" },
  { key: "icon", label: "Icons" },
  { key: "frame", label: "Frames" },
  { key: "group", label: "Groups" },
  { key: "locked", label: "Locked" },
  { key: "hidden", label: "Hidden" },
];

function matchesFilter(item, filter) {
  if (filter === "all") return true;
  if (filter === "locked") return !!item.locked;
  if (filter === "hidden") return !!item.hidden;
  return item.type === filter;
}

function matchesSearch(item, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  if ((item.name || "").toLowerCase().includes(q)) return true;
  if ((item.type || "").toLowerCase().includes(q)) return true;
  if (item.type === "text" && (item.text || "").toLowerCase().includes(q)) return true;
  if (item.type === "icon" && (item.iconName || "").toLowerCase().includes(q)) return true;
  if (item.shapeKind && item.shapeKind.toLowerCase().includes(q)) return true;
  if (item.lineKind && item.lineKind.toLowerCase().includes(q)) return true;
  if (item.frameKind && item.frameKind.toLowerCase().includes(q)) return true;
  return false;
}

// Marks which nodes should be visible (self or a descendant matches) and
// which groups need to be force-expanded to reveal a matching descendant
// — without touching the user's own persisted expand/collapse state.
function filterTree(tree, predicate) {
  const visibleIds = new Set();
  const forceExpandIds = new Set();
  function visit(nodes) {
    let anyMatch = false;
    nodes.forEach(({ item, children }) => {
      const selfMatches = predicate(item);
      const childMatches = visit(children);
      if (selfMatches || childMatches) {
        visibleIds.add(item.id);
        anyMatch = true;
        if (childMatches) forceExpandIds.add(item.id);
      }
    });
    return anyMatch;
  }
  visit(tree);
  return { visibleIds, forceExpandIds };
}

function flattenVisible(tree, depth, expandedIds, forceExpandIds, visibleIds, isFiltering, out) {
  tree.forEach((node) => {
    if (isFiltering && !visibleIds.has(node.item.id)) return;
    const forced = isFiltering && forceExpandIds.has(node.item.id);
    out.push({ node, depth, forced });
    const isExpanded = expandedIds.has(node.item.id) || forced;
    if (node.item.type === "group" && isExpanded) {
      flattenVisible(node.children, depth + 1, expandedIds, forceExpandIds, visibleIds, isFiltering, out);
    }
  });
  return out;
}

function collectAllGroupIds(tree, out = []) {
  tree.forEach(({ item, children }) => {
    if (item.type === "group") out.push(item.id);
    collectAllGroupIds(children, out);
  });
  return out;
}

export default function LayersPanel({
  items,
  activePageId,
  pages,
  selectedIds,
  onSetSelectedIds,
  onRename,
  onToggleHidden,
  onToggleLocked,
  onReorder,
  onGroup,
  onUngroup,
  onDuplicate,
  onDelete,
  onCopy,
  onCut,
  onReorderAction,
  onMoveToPage,
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [renamingId, setRenamingId] = useState(null);
  const [contextMenuFor, setContextMenuFor] = useState(null); // { id, x, y }
  const [dragState, setDragState] = useState(null); // { draggedIds, overId, position }
  const lastClickedRef = useRef(null);
  const listRef = useRef(null);

  const itemsById = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);
  const tree = useMemo(() => buildLayerTree(items, activePageId), [items, activePageId]);

  const isFiltering = query.trim().length > 0 || filter !== "all";
  const { visibleIds, forceExpandIds } = useMemo(() => {
    if (!isFiltering) return { visibleIds: new Set(), forceExpandIds: new Set() };
    return filterTree(tree, (item) => matchesFilter(item, filter) && matchesSearch(item, query.trim()));
  }, [tree, filter, query, isFiltering]);

  const rows = useMemo(
    () => flattenVisible(tree, 0, expandedIds, forceExpandIds, visibleIds, isFiltering, []),
    [tree, expandedIds, forceExpandIds, visibleIds, isFiltering]
  );

  function toggleExpand(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpandedIds(new Set(collectAllGroupIds(tree)));
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  function handleRowSelect(id, event) {
    const ctrlKey = event.metaKey || event.ctrlKey;
    const shiftKey = event.shiftKey;
    if (shiftKey && lastClickedRef.current) {
      const ids = rows.map((r) => r.node.item.id);
      const a = ids.indexOf(lastClickedRef.current);
      const b = ids.indexOf(id);
      if (a !== -1 && b !== -1) {
        const [start, end] = a < b ? [a, b] : [b, a];
        onSetSelectedIds(ids.slice(start, end + 1));
        return;
      }
    }
    if (ctrlKey) {
      onSetSelectedIds(
        selectedIds.includes(id) ? selectedIds.filter((sid) => sid !== id) : [...selectedIds, id]
      );
      lastClickedRef.current = id;
      return;
    }
    onSetSelectedIds([id]);
    lastClickedRef.current = id;
  }

  // --- Drag and drop reorder ---
  function handleDragHandleDown(event, id) {
    const draggedIds = selectedIds.includes(id) ? selectedIds : [id];
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
    setDragState({ draggedIds, overId: null, position: null });
  }

  function handleRowDragOver(event, id) {
    event.preventDefault();
    if (!dragState || dragState.draggedIds.includes(id)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / rect.height;
    const targetItem = itemsById.get(id);
    let position;
    if (ratio < 0.3) position = "before";
    else if (ratio > 0.7) position = "after";
    else position = targetItem?.type === "group" ? "inside" : "after";
    setDragState((prev) => ({ ...prev, overId: id, position }));
  }

  function handleRowDragLeave() {
    // handled implicitly by the next dragover/drop; no-op keeps this cheap
  }

  function handleRowDrop(event, id) {
    event.preventDefault();
    if (!dragState || dragState.draggedIds.includes(id)) {
      setDragState(null);
      return;
    }
    onReorder(dragState.draggedIds, id, dragState.position || "after");
    setDragState(null);
  }

  // --- Keyboard navigation ---
  function handleListKeyDown(event) {
    if (renamingId) return;
    const ids = rows.map((r) => r.node.item.id);
    if (ids.length === 0) return;
    const focusedId = selectedIds[selectedIds.length - 1] ?? ids[0];
    const idx = ids.indexOf(focusedId);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = ids[Math.min(ids.length - 1, Math.max(0, idx) + 1)];
      onSetSelectedIds([next]);
      lastClickedRef.current = next;
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const prevId = ids[Math.max(0, (idx === -1 ? 0 : idx) - 1)];
      onSetSelectedIds([prevId]);
      lastClickedRef.current = prevId;
    } else if (event.key === "ArrowRight") {
      const item = itemsById.get(focusedId);
      if (item?.type === "group" && !expandedIds.has(item.id)) {
        event.preventDefault();
        toggleExpand(item.id);
      }
    } else if (event.key === "ArrowLeft") {
      const item = itemsById.get(focusedId);
      if (item?.type === "group" && expandedIds.has(item.id)) {
        event.preventDefault();
        toggleExpand(item.id);
      } else if (item?.parentId) {
        event.preventDefault();
        onSetSelectedIds([item.parentId]);
        lastClickedRef.current = item.parentId;
      }
    } else if (event.key === "F2") {
      event.preventDefault();
      setRenamingId(focusedId);
    } else if ((event.key === "Delete" || event.key === "Backspace") && selectedIds.length > 0) {
      event.preventDefault();
      onDelete();
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      onSetSelectedIds(ids);
    }
  }

  function handleContextMenuAction(action, payload) {
    const id = contextMenuFor.id;
    if (!selectedIds.includes(id)) onSetSelectedIds([id]);
    switch (action) {
      case "rename":
        setRenamingId(id);
        break;
      case "duplicate":
        onDuplicate();
        break;
      case "copy":
        onCopy();
        break;
      case "cut":
        onCut();
        break;
      case "delete":
        onDelete();
        break;
      case "toggle-lock":
        onToggleLocked(id);
        break;
      case "toggle-hidden":
        onToggleHidden(id);
        break;
      case "group":
        onGroup();
        break;
      case "ungroup":
        onUngroup();
        break;
      case "forward":
        onReorderAction("forward");
        break;
      case "backward":
        onReorderAction("backward");
        break;
      case "front":
        onReorderAction("front");
        break;
      case "back":
        onReorderAction("back");
        break;
      case "select-children": {
        const children = items.filter((it) => it.parentId === id).map((it) => it.id);
        if (children.length) onSetSelectedIds(children);
        break;
      }
      case "move-to-page":
        onMoveToPage(id, payload);
        break;
      default:
        break;
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
          <Layers size={15} /> Layers
        </h3>
        <span className="text-[11px] font-medium text-gray-400">
          {selectedIds.length > 0 ? `${selectedIds.length} selected` : `${rows.length} shown`}
        </span>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search layers"
          aria-label="Search layers"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-7 pr-2 text-xs text-gray-700 outline-none focus:border-amber-400 focus:bg-white"
        />
      </div>

      <div className="flex items-center gap-1 overflow-x-auto">
        <select
          className="h-7 shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-1.5 text-[11px] text-gray-700 outline-none focus:border-amber-400"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          aria-label="Filter layers"
        >
          {FILTERS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
        <button
          className="ml-auto flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] text-gray-500 hover:bg-gray-100"
          onClick={expandAll}
          title="Expand all groups"
        >
          <ChevronsDown size={13} /> Expand all
        </button>
        <button
          className="flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] text-gray-500 hover:bg-gray-100"
          onClick={collapseAll}
          title="Collapse all groups"
        >
          <ChevronsUp size={13} /> Collapse all
        </button>
      </div>

      <div
        ref={listRef}
        role="tree"
        aria-label="Layers"
        tabIndex={0}
        onKeyDown={handleListKeyDown}
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto outline-none"
      >
        {rows.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-gray-400">
            {isFiltering ? "No layers match your search." : "No objects on this page yet."}
          </p>
        )}
        {rows.map(({ node, depth, forced }) => (
          <LayerRow
            key={node.item.id}
            node={node}
            depth={depth}
            itemsById={itemsById}
            isSelected={selectedIds.includes(node.item.id)}
            isExpanded={expandedIds.has(node.item.id)}
            forceExpanded={forced}
            isDragOver={dragState?.overId === node.item.id}
            dropPosition={dragState?.position}
            isRenaming={renamingId === node.item.id}
            onToggleExpand={toggleExpand}
            onSelect={handleRowSelect}
            onStartRename={() => setRenamingId(node.item.id)}
            onCommitRename={(name) => {
              onRename(node.item.id, name);
              setRenamingId(null);
            }}
            onCancelRename={() => setRenamingId(null)}
            onToggleHidden={onToggleHidden}
            onToggleLocked={onToggleLocked}
            onContextMenu={(id, event) => setContextMenuFor({ id, x: event.clientX, y: event.clientY })}
            onDragHandleDown={handleDragHandleDown}
            onRowDragOver={handleRowDragOver}
            onRowDrop={handleRowDrop}
            onRowDragLeave={handleRowDragLeave}
          />
        ))}
      </div>

      {contextMenuFor && (
        <LayerContextMenu
          item={itemsById.get(contextMenuFor.id)}
          pages={pages}
          activePageId={activePageId}
          position={{ x: contextMenuFor.x, y: contextMenuFor.y }}
          onClose={() => setContextMenuFor(null)}
          onAction={handleContextMenuAction}
        />
      )}
    </div>
  );
}

export { layerLabel };
