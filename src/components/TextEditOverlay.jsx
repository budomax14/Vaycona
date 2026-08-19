import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { contentToScreen } from "../viewport";
import {
  domToRichText,
  ensureRichText,
  isRichText,
  MAX_LIST_LEVEL,
  richTextToHTML,
} from "../richText";

const TYPING_COMMIT_DEBOUNCE_MS = 1000;

function caretRangeFromClientPoint(x, y) {
  if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);
    if (!pos) return null;
    const range = document.createRange();
    range.setStart(pos.offsetNode, pos.offset);
    range.collapse(true);
    return range;
  }
  return null;
}

function getCharacterOffsets(root, range) {
  const pre = document.createRange();
  pre.selectNodeContents(root);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  pre.setEnd(range.endContainer, range.endOffset);
  const end = pre.toString().length;
  return { start, end };
}

function restoreSelectionFromOffsets(root, { start, end }) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  let remainingStart = start;
  let remainingEnd = end;
  let startNode;
  let startOffset = 0;
  let endNode;
  let endOffset = 0;
  // eslint-disable-next-line no-cond-assign
  while ((node = walker.nextNode())) {
    const len = node.textContent.length;
    if (startNode === undefined && remainingStart <= len) {
      startNode = node;
      startOffset = remainingStart;
    }
    if (remainingEnd <= len) {
      endNode = node;
      endOffset = remainingEnd;
      break;
    }
    remainingStart -= len;
    remainingEnd -= len;
  }
  if (!startNode || !endNode) return;
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function collectRunStyleAt(el) {
  const style = { bold: false, italic: false, underline: false, strikethrough: false };
  let node = el;
  while (node && node.nodeType === 1) {
    const cs = node.style;
    if (node.tagName === "B" || node.tagName === "STRONG" || parseInt(cs.fontWeight, 10) >= 600) style.bold = true;
    if (node.tagName === "I" || node.tagName === "EM" || cs.fontStyle === "italic") style.italic = true;
    if ((cs.textDecorationLine || cs.textDecoration || "").includes("underline")) style.underline = true;
    if ((cs.textDecorationLine || cs.textDecoration || "").includes("line-through")) style.strikethrough = true;
    if (cs.color && !style.color) style.color = cs.color;
    if (cs.fontFamily && !style.fontFamily) style.fontFamily = cs.fontFamily.replace(/['"]/g, "");
    if (cs.fontSize && !style.fontSize) style.fontSize = parseFloat(cs.fontSize);
    if (cs.webkitTextStrokeWidth && style.outlineWidth === undefined) style.outlineWidth = parseFloat(cs.webkitTextStrokeWidth) || 0;
    if (cs.webkitTextStrokeColor && !style.outlineColor) style.outlineColor = cs.webkitTextStrokeColor;
    node = node.parentElement;
  }
  return style;
}

function applyRunStyleToSpan(span, style, fontSizeScale) {
  const parts = [];
  if (style.bold) parts.push("font-weight:700");
  else parts.push("font-weight:400");
  if (style.italic) parts.push("font-style:italic");
  const decorations = [style.underline && "underline", style.strikethrough && "line-through"].filter(Boolean);
  parts.push(`text-decoration:${decorations.length ? decorations.join(" ") : "none"}`);
  if (style.color) parts.push(`color:${style.color}`);
  if (style.fontFamily) parts.push(`font-family:${style.fontFamily}`);
  if (style.fontSize) parts.push(`font-size:${style.fontSize * fontSizeScale}px`);
  // Always written explicitly (both branches), same as font-weight above —
  // this span carries the full current+patch style (see applyFormat), so a
  // real off-state must overwrite any stroke inherited from an ancestor span
  // rather than silently omitting the property.
  if (style.outlineWidth !== undefined) parts.push(`-webkit-text-stroke:${style.outlineWidth}px ${style.outlineColor || "#000000"}`);
  span.setAttribute("style", parts.join(";"));
}

// Positioned contenteditable overlay — see richText.js for the data model
// and DOM<->richText serialization this component drives. This component
// owns: mount/unmount HTML sync, the coordinate transform, formatting
// commands (direct Range/span manipulation, not execCommand), paste
// sanitization, and the typing-history-group debounce timer.
const TextEditOverlay = forwardRef(function TextEditOverlay(
  {
    item,
    viewport,
    liveScale,
    initialClientPoint,
    onLiveUpdate,
    onCommit,
    onRequestExit,
    onMoveLiveChange,
    onMoveCommit,
  },
  ref
) {
  const rootRef = useRef(null);
  const isComposingRef = useRef(false);
  const dirtyRef = useRef(false);
  const debounceRef = useRef(null);
  const dragRef = useRef(null);
  const fontSizeScale = viewport.scale;

  const flush = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = null;
    if (dirtyRef.current) {
      onCommit();
      dirtyRef.current = false;
    }
  }, [onCommit]);

  const scheduleFlush = useCallback(() => {
    dirtyRef.current = true;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(flush, TYPING_COMMIT_DEBOUNCE_MS);
  }, [flush]);

  const serializeAndSync = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const richText = domToRichText(root, fontSizeScale);
    onLiveUpdate(richText);
  }, [fontSizeScale, onLiveUpdate]);

  // Mount-once: build initial HTML from the committed richText and place
  // the caret. Deliberately has an empty dependency array — this must
  // never re-run while the user is typing (that's the "golden rule": the
  // live DOM is the browser's own uncontrolled state while focused).
  useEffect(() => {
    const root = rootRef.current;
    root.innerHTML = richTextToHTML(ensureRichText(item), fontSizeScale);
    root.focus();
    try {
      document.execCommand("defaultParagraphSeparator", false, "div");
    } catch {
      /* not supported everywhere; Enter still works, just may use <div> or <p> */
    }

    let range = null;
    if (initialClientPoint) {
      range = caretRangeFromClientPoint(initialClientPoint.x, initialClientPoint.y);
    }
    if (!range) {
      range = document.createRange();
      range.selectNodeContents(root);
      range.collapse(false);
    }
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    return () => flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleInput(event) {
    if (isComposingRef.current) return;
    serializeAndSync();
    const inputType = event.nativeEvent?.inputType;
    if (inputType === "insertFromPaste" || inputType === "insertFromDrop" || inputType === "deleteByCut") {
      flush();
    } else {
      scheduleFlush();
    }
  }

  function handleCompositionEnd() {
    isComposingRef.current = false;
    serializeAndSync();
    scheduleFlush();
  }

  // Deliberately ignores clipboardData's "text/html" entirely: external
  // sources (ChatGPT, web pages, Word, Docs, email) attach arbitrary CSS —
  // dark-mode backgrounds, off-brand fonts/sizes/line-heights — that has
  // caused black backgrounds and mismatched styling landing in a Vaycona
  // text element. Only the plain-text content is trusted; it's inserted at
  // the caret via insertHTML so it still inherits whatever *Vaycona* run
  // it lands in (bold/italic span, item font/size/color/alignment), never
  // formatting carried in from the clipboard. Vaycona's own object
  // copy/paste (Cmd+C/V of a whole text element, richText intact) never
  // goes through this handler — it round-trips through App.jsx's in-memory
  // clipboardRef, not the OS clipboard, so it's unaffected.
  function handlePaste(event) {
    event.preventDefault();
    const plain = event.clipboardData.getData("text/plain");
    const insertHtml = plain
      .split("\n")
      .map((line) => line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
      .join("<br>");
    document.execCommand("insertHTML", false, insertHtml);
    serializeAndSync();
    flush();
  }

  // Changes list indent depth (0..MAX_LIST_LEVEL) for the list item
  // containing the caret; a no-op outside a list item (no custom
  // paragraph-indent UI this phase, per the documented list-depth limit).
  function indent(delta) {
    const sel = window.getSelection();
    const li = sel?.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement)?.closest("li");
    if (!li) return false;
    const current = Number(li.dataset.level || 0);
    const next = Math.max(0, Math.min(MAX_LIST_LEVEL, current + delta));
    li.dataset.level = String(next);
    li.style.marginLeft = `${next * 24 * fontSizeScale}px`;
    serializeAndSync();
    flush();
    return true;
  }

  function handleKeyDown(event) {
    const mod = event.metaKey || event.ctrlKey;
    if (event.key === "Tab") {
      if (indent(event.shiftKey ? -1 : 1)) event.preventDefault();
      return;
    }
    if (mod && event.key.toLowerCase() === "b") {
      event.preventDefault();
      applyFormat("bold");
      return;
    }
    if (mod && event.key.toLowerCase() === "i") {
      event.preventDefault();
      applyFormat("italic");
      return;
    }
    if (mod && event.key.toLowerCase() === "u") {
      event.preventDefault();
      applyFormat("underline");
      return;
    }
    // Escape is handled by the global useKeyboardShortcuts hook (checks
    // document.activeElement.isContentEditable) — not duplicated here.
  }

  // --- Formatting commands: direct Range/span manipulation, see plan for
  // why execCommand is intentionally not used for these. ---
  function applyFormat(styleKey, explicitValue) {
    const root = rootRef.current;
    const sel = window.getSelection();
    if (!root || !sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return;

    const offsets = getCharacterOffsets(root, range);

    // Split boundary text nodes so the range's start/end line up exactly
    // with node edges before extracting — required for extractContents()
    // to cleanly separate "inside the selection" from "outside" it.
    if (range.startContainer.nodeType === 3) range.startContainer.splitText(range.startOffset);
    if (range.endContainer.nodeType === 3) {
      const after = range.endContainer.splitText(range.endOffset);
      range.setEnd(after.parentNode, Array.prototype.indexOf.call(after.parentNode.childNodes, after));
    }

    const frag = range.extractContents();
    const walker = document.createTreeWalker(frag, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let n;
    // eslint-disable-next-line no-cond-assign
    while ((n = walker.nextNode())) textNodes.push(n);

    textNodes.forEach((textNode) => {
      const current = collectRunStyleAt(textNode.parentElement);
      const next = { ...current };
      if (explicitValue !== undefined) {
        next[styleKey] = explicitValue;
      } else if (styleKey === "bold" || styleKey === "italic" || styleKey === "underline" || styleKey === "strikethrough") {
        next[styleKey] = !current[styleKey];
      } else {
        next[styleKey] = explicitValue;
      }
      const span = document.createElement("span");
      applyRunStyleToSpan(span, next, fontSizeScale);
      span.appendChild(textNode.cloneNode(false));
      textNode.replaceWith(span);
    });
    range.insertNode(frag);
    root.normalize();

    restoreSelectionFromOffsets(root, offsets);
    serializeAndSync();
    flush(); // formatting is always its own undo step, never coalesced with typing
    root.focus();
  }

  function toggleList(listType) {
    // v1: applies to the paragraph containing the caret/selection start —
    // wraps that paragraph's <div> into an <li> inside a fresh <ul>/<ol>,
    // or unwraps it back to a <div> if the same list type is active.
    const root = rootRef.current;
    const sel = window.getSelection();
    if (!root || !sel?.anchorNode) return;
    const container = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
    const block = container?.closest("div,li");
    if (!block) return;
    const existingList = block.closest("ol,ul");
    if (existingList && ((existingList.tagName === "OL") === (listType === "numbered"))) {
      const div = document.createElement("div");
      div.innerHTML = block.innerHTML;
      existingList.replaceWith(div);
    } else {
      const list = document.createElement(listType === "numbered" ? "ol" : "ul");
      const li = document.createElement("li");
      li.dataset.level = "0";
      li.innerHTML = (existingList || block).innerHTML;
      list.appendChild(li);
      (existingList || block).replaceWith(list);
    }
    serializeAndSync();
    flush();
    root.focus();
  }

  useImperativeHandle(ref, () => ({ applyFormat, toggleList, indent, flush }));

  // Lets the box be repositioned without leaving edit mode — dragging
  // *inside* the contentEditable would just select text (the browser's own
  // behavior, and the one thing that must keep working unchanged), so this
  // listens on a separate frame sized a few px larger than the editable
  // area instead. That frame sits BEHIND the editable in stacking order, so
  // any press that lands over the actual text/box still reaches the
  // contentEditable untouched — only presses on the thin margin ring
  // outside it (where there's nothing else to hit) reach this handler.
  // Position math mirrors onItemDragMove/dragBoundFunc's own content-space
  // conversion in App.jsx: dividing a client-pixel delta by the live zoom
  // `scale` yields content px directly, since KONVA_VIEWPORT's fixed
  // internal scale and the ancestor's CSS `scale(displayScale)` transform
  // cancel out to exactly that (see canvasFrameRef's transform in App.jsx).
  // The mousemove/mouseup pair added here is stashed on dragRef itself
  // (rather than relied on as bare function references) so both the normal
  // mouseup path and the unmount-safety effect below remove the exact same
  // listener instances — this component re-renders during the drag itself
  // (every live position update), which would otherwise leave later
  // renders' handleFrameMouseMove/Up unable to find what an earlier
  // render's mousedown actually registered.
  function handleFrameMouseDown(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    const drag = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startItemX: item.x,
      startItemY: item.y,
    };
    const onMove = (moveEvent) => {
      const dx = (moveEvent.clientX - drag.startClientX) / liveScale;
      const dy = (moveEvent.clientY - drag.startClientY) / liveScale;
      onMoveLiveChange(drag.startItemX + dx, drag.startItemY + dy);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      onMoveCommit();
    };
    drag.onMove = onMove;
    drag.onUp = onUp;
    dragRef.current = drag;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // Guards against the overlay unmounting mid-drag (e.g. Escape pressed
  // while the mouse is still down) leaving these window listeners attached.
  useEffect(() => {
    return () => {
      const drag = dragRef.current;
      if (!drag) return;
      window.removeEventListener("mousemove", drag.onMove);
      window.removeEventListener("mouseup", drag.onUp);
    };
  }, []);

  // Clicking outside both the overlay and anything marked "toolbar-safe"
  // (formatting controls, color-picker popovers) exits edit mode — the
  // toolbar marker lets users click Bold/Color/etc. without losing the
  // active edit session. Capture-phase so it sees the click before Konva
  // Stage handlers / other click-outside listeners (color popovers etc.)
  // process and potentially stop propagation.
  useEffect(() => {
    function handlePointerDown(event) {
      const target = event.target;
      if (rootRef.current?.contains(target)) return;
      if (target.closest?.("[data-text-toolbar-safe]")) return;
      onRequestExit();
    }
    window.addEventListener("mousedown", handlePointerDown, true);
    return () => window.removeEventListener("mousedown", handlePointerDown, true);
  }, [onRequestExit]);

  const overlayLeft = contentToScreen({ x: item.x, y: item.y }, viewport).x;
  const overlayTop = contentToScreen({ x: item.x, y: item.y }, viewport).y;
  const overlayWidth = item.width * viewport.scale;
  const overlayHeight = item.height * viewport.scale;
  const DRAG_MARGIN = 14; // internal (pre-displayScale) px — see handleFrameMouseDown

  return (
    <>
      {/* Move handle: a ring a few px outside the editable box itself. Sits
          in DOM order (and so stacking) behind the contentEditable below,
          so any press over the actual text/box reaches that instead —
          only the margin ring, where nothing else exists to catch the
          event, reaches this. */}
      <div
        data-text-toolbar-safe
        onMouseDown={handleFrameMouseDown}
        style={{
          position: "absolute",
          left: overlayLeft - DRAG_MARGIN,
          top: overlayTop - DRAG_MARGIN,
          width: overlayWidth + DRAG_MARGIN * 2,
          height: overlayHeight + DRAG_MARGIN * 2,
          cursor: "move",
          zIndex: 24,
        }}
      />
      <div
        ref={rootRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        data-text-toolbar-safe
        onInput={handleInput}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={handleCompositionEnd}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        className="cursor-text outline-none"
        style={{
          position: "absolute",
          left: overlayLeft,
          top: overlayTop,
          width: overlayWidth,
          minHeight: overlayHeight,
          padding: (item.padding ?? 4) * viewport.scale,
          // Keeps the same box the Transformer draws when selected-not-editing
          // (see App.jsx's Transformer, borderStroke default) visible for the
          // whole edit session — the Konva selection box itself is hidden
          // while editing (DesignNode.jsx returns null), so without this the
          // text's boundary was invisible the entire time you were typing.
          boxSizing: "border-box",
          border: "1px solid #0ea5e9",
          fontFamily: item.fontFamily || "Arial",
          fontSize: (item.fontSize || 24) * viewport.scale,
          lineHeight: item.lineHeight || 1,
          letterSpacing: (item.letterSpacing || 0) * viewport.scale,
          color: item.fill || "#111827",
          textAlign: item.align || "left",
          // Matches the Konva Text's verticalAlign (SimpleTextNode.jsx) so the
          // text doesn't jump vertically when edit mode exits and rendering
          // hands off from this top-aligned-by-default div to Konva. Curved
          // and rich-text items always render top-aligned regardless of
          // verticalAlign (CurvedTextNode/RichTextNode don't honor it), so
          // this only applies on the plain SimpleTextNode path.
          display: "flex",
          flexDirection: "column",
          justifyContent:
            item.curve || isRichText(item)
              ? "flex-start"
              : item.verticalAlign === "top"
                ? "flex-start"
                : item.verticalAlign === "bottom"
                  ? "flex-end"
                  : "center",
          // Temporarily un-rotated during edit (see plan rationale) —
          // item.rotation is re-applied once editing exits.
          transform: "none",
          transformOrigin: "0 0",
          background: item.background?.enabled ? item.background.color : "transparent",
          zIndex: 25,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      />
    </>
  );
});

export default TextEditOverlay;
