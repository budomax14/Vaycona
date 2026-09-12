// Rich-text data model: an item's `richText` field is an array of
// paragraphs, each `{ runs, align, listType, listLevel }`. `runs` is a
// flat array of `{ text, bold, italic, underline, strikethrough, color,
// fontFamily, fontSize, outlineColor, outlineWidth }`, plus a special
// pseudo-run `{ break: true }` representing a Shift+Enter soft line break
// *inside* a paragraph (kept distinct from a paragraph boundary so list
// continuation / paragraph spacing aren't triggered by a soft break).
//
// outlineColor/outlineWidth are optional per-run overrides for the
// letter border (see textEffects.js's item-level `effects.outline`,
// which is what SimpleTextNode/RichTextNode fall back to when a run
// doesn't specify its own — undefined here means "no override, use the
// object's whole-text-box outline setting", exactly like a run with no
// bold/italic override reads as "not bold").
//
// Legacy flat text fields (`text`, `fontWeight`, `italic`, `underline`,
// `fill`, `fontFamily`, `fontSize`) remain the source of truth for any
// object that has never been rich-formatted; `richText` is synthesized
// from them on first read (see migrateLegacyTextToRichText) and kept as a
// plain-text mirror in `item.text` afterwards so every other part of the
// app (layer names, search, non-rich fallback) keeps working unchanged.

export const LIST_TYPES = { NONE: null, BULLET: "bullet", NUMBERED: "numbered" };
export const MAX_LIST_LEVEL = 1; // 2 levels deep (0 and 1) — documented Phase 4 limitation

export function newParagraph(overrides = {}) {
  return { runs: [], align: null, listType: null, listLevel: 0, ...overrides };
}

export function baseRunFromItem(item) {
  return {
    bold: item.fontWeight === "bold",
    italic: !!item.italic,
    underline: !!item.underline,
    strikethrough: !!item.strikethrough,
    color: item.fill || "#111827",
    fontFamily: item.fontFamily || "Arial",
    fontSize: item.fontSize || 24,
  };
}

export function migrateLegacyTextToRichText(item) {
  const base = baseRunFromItem(item);
  const lines = String(item.text ?? "").split("\n");
  return lines.map((line) => newParagraph({ align: item.align || "left", runs: [{ text: line, ...base }] }));
}

export function isValidRichText(value) {
  return (
    Array.isArray(value) &&
    value.every(
      (p) =>
        p &&
        Array.isArray(p.runs) &&
        p.runs.every((r) => r.break === true || typeof r.text === "string")
    )
  );
}

// Called from validateItem — malformed richText never breaks project
// load, it just falls back to treating item.text as plain content.
export function ensureRichText(item) {
  if (isValidRichText(item.richText)) return item.richText;
  return migrateLegacyTextToRichText(item);
}

export function plainTextOf(richText) {
  return richText
    .map((p) => p.runs.map((r) => (r.break ? "\n" : r.text)).join(""))
    .join("\n");
}

// A "rich" object is one where per-run formatting or paragraph structure
// actually diverges from the object's own uniform base style — a plain
// single-style object (the overwhelming majority) stays on the cheap
// native Konva Text path (see SimpleTextNode.jsx) even if its richText
// happens to have been synthesized from legacy fields.
export function isRichText(item) {
  const rt = item.richText;
  if (!Array.isArray(rt) || rt.length === 0) return false;
  const base = baseRunFromItem(item);
  const runs = rt.flatMap((p) => p.runs.filter((r) => !r.break));
  if (runs.length > 1 || rt.length > 1 || rt.some((p) => p.listType)) {
    const varies = runs.some(
      (r) =>
        !!r.bold !== base.bold ||
        !!r.italic !== base.italic ||
        !!r.underline !== base.underline ||
        !!r.strikethrough !== base.strikethrough ||
        (r.color || base.color) !== base.color ||
        (r.fontFamily || base.fontFamily) !== base.fontFamily ||
        (r.fontSize || base.fontSize) !== base.fontSize ||
        r.outlineColor !== undefined ||
        r.outlineWidth !== undefined
    );
    return varies || rt.some((p) => p.listType) || rt.length > 1;
  }
  return false;
}

// ---------------------------------------------------------------------
// DOM <-> richText
// ---------------------------------------------------------------------

function computedRunStyle(el, inherited) {
  const style = { ...inherited };
  if (!el || el.nodeType !== 1) return style;
  const tag = el.tagName;
  const cs = el.style;
  if (tag === "B" || tag === "STRONG" || cs.fontWeight === "bold" || parseInt(cs.fontWeight, 10) >= 600) {
    style.bold = true;
  }
  if (tag === "I" || tag === "EM" || cs.fontStyle === "italic") style.italic = true;
  if (tag === "U") style.underline = true;
  if (tag === "S" || tag === "STRIKE") style.strikethrough = true;
  const decoration = cs.textDecorationLine || cs.textDecoration || "";
  if (decoration.includes("underline")) style.underline = true;
  if (decoration.includes("line-through")) style.strikethrough = true;
  if (cs.color) style.color = cs.color;
  if (cs.fontFamily) style.fontFamily = cs.fontFamily.replace(/['"]/g, "");
  if (cs.fontSize) style.fontSize = parseFloat(cs.fontSize);
  if (cs.webkitTextStrokeWidth) style.outlineWidth = parseFloat(cs.webkitTextStrokeWidth) || 0;
  if (cs.webkitTextStrokeColor) style.outlineColor = cs.webkitTextStrokeColor;
  return style;
}

function walkInline(node, runs, style) {
  if (node.nodeType === 3) {
    if (node.textContent) runs.push({ text: node.textContent, ...style });
    return;
  }
  if (node.nodeType !== 1) return;
  if (node.tagName === "BR") {
    runs.push({ break: true });
    return;
  }
  // Block elements (DIV/P/LI) are only treated as paragraph boundaries at
  // the root's direct children (see domToRichText's own BLOCK_TAGS check).
  // Browsers occasionally nest a block inside another block instead of the
  // flat sibling structure richTextToHTML emits (e.g. some Enter-key
  // sequences in Chrome/Safari) — without a break here, that nested block's
  // text silently glues onto whatever precedes it with no separator, which
  // then can't wrap at all once redrawn (see layoutRichText: no whitespace,
  // no wrap point), producing one unbroken run stretching off the page.
  if (BLOCK_TAGS.has(node.tagName) && runs.length > 0) {
    runs.push({ break: true });
  }
  const next = computedRunStyle(node, style);
  node.childNodes.forEach((child) => walkInline(child, runs, next));
}

const BLOCK_TAGS = new Set(["DIV", "P", "LI"]);

// Walks the contenteditable root's DOM tree into the paragraphs-of-runs
// model. Deliberately permissive about *which* tag produced a given style
// (checks tag name OR computed inline style) so it's robust to whatever
// markup shape a given browser happens to produce for the same formatting
// command — normalization happens here, not by trying to control the
// browser's own DOM output.
export function domToRichText(root, fontSizeScale = 1) {
  const paragraphs = [];
  let current = newParagraph();
  let hasContent = false;

  function flush() {
    paragraphs.push(current);
    current = newParagraph();
    hasContent = false;
  }

  function flushListItem(li) {
    if (hasContent) flush();
    current.align = li.style.textAlign || null;
    const parentList = li.closest("ol,ul");
    current.listType = parentList?.tagName === "OL" ? "numbered" : "bullet";
    current.listLevel = Math.min(MAX_LIST_LEVEL, Number(li.dataset.level || 0));
    li.childNodes.forEach((child) => walkInline(child, current.runs, {}));
    hasContent = true;
    flush();
  }

  root.childNodes.forEach((node) => {
    // toggleList (TextEditOverlay.jsx) always wraps list paragraphs in a
    // <ul>/<ol> — an <li> is never a direct child of root, so it has to be
    // descended into here; the BLOCK_TAGS branch below only ever sees UL/OL
    // itself, never LI, and so could never actually record listType.
    if (node.nodeType === 1 && (node.tagName === "UL" || node.tagName === "OL")) {
      Array.from(node.children).forEach((child) => {
        if (child.tagName === "LI") flushListItem(child);
      });
      return;
    }
    if (node.nodeType === 1 && BLOCK_TAGS.has(node.tagName)) {
      if (hasContent) flush();
      current.align = node.style.textAlign || null;
      node.childNodes.forEach((child) => walkInline(child, current.runs, {}));
      hasContent = true;
      flush();
    } else {
      walkInline(node, current.runs, {});
      hasContent = true;
    }
  });
  if (hasContent || paragraphs.length === 0) flush();

  // Chrome (and other browsers) sometimes leave a genuinely empty trailing
  // block — an empty <div><span></span></div> with no text, no <br> — as a
  // cursor-continuation artifact after a plain, unstyled run of typed text
  // (reproduced consistently typing into a tall, empty, flex-column
  // contenteditable box — see TextEditOverlay.jsx). That phantom paragraph
  // has no bearing on what the user actually wrote, but bumps `rt.length`
  // to 2+, which isRichText() below treats as "real" multi-paragraph
  // content regardless of whether styling actually varies — silently
  // routing plain text onto RichTextNode's layoutRichText measurement path
  // instead of SimpleTextNode's native Konva wrap. A run built with no
  // inline styling at all (the common case for unformatted text — see
  // walkInline's bare-text-node branch) carries no `fontSize`, which
  // produces an invalid `ctx.font` string that the canvas 2D context
  // silently ignores, measuring every character against whatever font was
  // last set on the shared measurement context instead — wildly
  // mismeasuring the real wrap width. Stripping only genuinely-empty
  // TRAILING paragraphs (keeping at least one) fixes the misclassification
  // at its source without touching real multi-paragraph content anywhere
  // else in the document.
  while (paragraphs.length > 1) {
    const last = paragraphs[paragraphs.length - 1];
    const hasRealContent = last.listType || last.runs.some((r) => r.break || (r.text && r.text.length > 0));
    if (hasRealContent) break;
    paragraphs.pop();
  }

  // Undo the screen-px convention (§ overlay coordinate formula) so stored
  // fontSize is always in page-logical-px, matching every other field.
  if (fontSizeScale !== 1) {
    paragraphs.forEach((p) =>
      p.runs.forEach((r) => {
        if (typeof r.fontSize === "number") r.fontSize = r.fontSize / fontSizeScale;
      })
    );
  }
  return paragraphs;
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function runStyleAttr(run, fontSizeScale) {
  const parts = [];
  if (run.bold) parts.push("font-weight:700");
  if (run.italic) parts.push("font-style:italic");
  const decorations = [run.underline && "underline", run.strikethrough && "line-through"].filter(Boolean);
  if (decorations.length) parts.push(`text-decoration:${decorations.join(" ")}`);
  if (run.color) parts.push(`color:${run.color}`);
  if (run.fontFamily) parts.push(`font-family:${run.fontFamily}`);
  if (run.fontSize) parts.push(`font-size:${run.fontSize * fontSizeScale}px`);
  if (run.outlineWidth !== undefined) parts.push(`-webkit-text-stroke:${run.outlineWidth}px ${run.outlineColor || "#000000"}`);
  return parts.join(";");
}

// richText -> HTML string, used only when (re)mounting the contenteditable
// overlay — never called while it has focus (see the "golden rule" in the
// plan: live DOM is never rewritten while the user is actively editing it).
// List paragraphs are grouped into a real <ul>/<ol> wrapper around their
// <li>s — the exact shape toggleList()/indent() (TextEditOverlay.jsx) build
// live in the DOM — so domToRichText's reverse walk (which reads listType
// off the enclosing <ul>/<ol>, not the <li> itself) round-trips correctly
// when a previously-listed paragraph is reopened for editing, and so
// bulleted vs numbered survives instead of only ever reading back as
// "bullet" (a bare <li> carries no such distinction on its own).
export function richTextToHTML(richText, fontSizeScale = 1) {
  let html = "";
  let openListTag = null; // "ul" | "ol" | null — the list currently being built

  function closeList() {
    if (openListTag) html += `</${openListTag}>`;
    openListTag = null;
  }

  richText.forEach((p) => {
    const inner =
      p.runs
        .map((r) => (r.break ? "<br>" : `<span style="${runStyleAttr(r, fontSizeScale)}">${escapeHtml(r.text)}</span>`))
        .join("") || "<br>";
    if (p.listType) {
      const listTag = p.listType === "numbered" ? "ol" : "ul";
      if (openListTag !== listTag) {
        closeList();
        html += `<${listTag}>`;
        openListTag = listTag;
      }
      const level = p.listLevel || 0;
      const styleAttr = ` style="margin-left:${level * 24 * fontSizeScale}px${p.align ? `;text-align:${p.align}` : ""}"`;
      html += `<li${styleAttr} data-level="${level}">${inner}</li>`;
    } else {
      closeList();
      const styleAttr = p.align ? ` style="text-align:${p.align}"` : "";
      html += `<div${styleAttr}>${inner}</div>`;
    }
  });
  closeList();
  return html;
}

// ---------------------------------------------------------------------
// Layout: shared by the Konva draw path and the auto-size measurement
// path so they can never disagree. Letter-spacing is applied per
// character (not via the still-inconsistently-supported canvas
// `letterSpacing` context property) so wrap-width math and draw
// positions always match exactly, in every browser.
// ---------------------------------------------------------------------

let measureCanvas = null;
function getMeasureContext() {
  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  return measureCanvas.getContext("2d");
}

// A run built from a plain, unstyled DOM text node (walkInline's bare-text
// branch) carries no fontSize/fontFamily at all — without a fallback here,
// the resulting string (e.g. "400 undefinedpx undefined") is invalid CSS,
// which the canvas 2D context silently ignores on assignment, leaving
// `ctx.font` at whatever a PRIOR measurement left it — wildly mismeasuring
// this run's width. Defaults match baseRunFromItem's own item-level
// fallbacks so an unstyled run measures the same size/font the object
// itself would render at.
function fontString(run) {
  const fontSize = run.fontSize || 24;
  const fontFamily = run.fontFamily || "Arial";
  return `${run.italic ? "italic " : ""}${run.bold ? "700 " : "400 "}${fontSize}px ${fontFamily}`;
}

function measureRunText(ctx, run, text, letterSpacing) {
  ctx.font = fontString(run);
  let width = 0;
  for (const ch of text) width += ctx.measureText(ch).width + letterSpacing;
  return text.length ? width - letterSpacing : 0;
}

// Mirrors SimpleTextNode.jsx/CurvedTextNode.jsx's textTransformContent —
// applied only to the text measured/drawn by layoutRichText, never to the
// stored run text itself, so toggling the case option back to "none" always
// recovers exactly what was typed.
function applyTextTransform(text, textTransform) {
  if (textTransform === "uppercase") return text.toUpperCase();
  if (textTransform === "lowercase") return text.toLowerCase();
  if (textTransform === "capitalize") return text.replace(/\b\w/g, (ch) => ch.toUpperCase());
  return text;
}

const LIST_INDENT_PER_LEVEL = 24;
const BULLET_GLYPH = "•";

function listPrefixFor(paragraph, index) {
  if (!paragraph.listType) return "";
  if (paragraph.listType === "numbered") return `${index + 1}.`;
  return BULLET_GLYPH;
}

// paragraphs: richText array. opts: { maxWidth, autoWidth, maxAutoWidth,
// lineHeight, align, letterSpacing, paragraphSpacing }. Returns { lines,
// totalWidth, totalHeight } — `lines` is consumed by the draw path, totals
// by the auto-size path.
//
// `maxAutoWidth` (only meaningful when `autoWidth` is true) caps how wide a
// line is allowed to grow before it wraps — used by measureFlexibleTextBox
// below to implement "the box keeps growing to fit what's typed, and only
// wraps once it reaches the page's right edge": lines shorter than the cap
// still shrink-to-fit (autoWidth's usual behavior, via the totalWidth calc
// below), lines that would exceed it wrap exactly like a fixed-width box.
export function layoutRichText(paragraphs, opts) {
  const { maxWidth, autoWidth, maxAutoWidth, lineHeight = 1.2, align: defaultAlign = "left", letterSpacing = 0, paragraphSpacing = 0, textTransform = "none" } = opts;
  const ctx = getMeasureContext();
  const lines = [];
  let y = 0;
  let listCounters = {};

  paragraphs.forEach((para, paraIndex) => {
    const indent = para.listType ? LIST_INDENT_PER_LEVEL * (1 + (para.listLevel || 0)) : 0;
    if (para.listType) {
      const key = para.listLevel || 0;
      listCounters[key] = (listCounters[key] || 0) + 1;
    } else {
      listCounters = {};
    }
    const prefix = para.listType ? listPrefixFor(para, (listCounters[para.listLevel || 0] || 1) - 1) : "";

    // Tokenize runs into words, splitting on whitespace but keeping the
    // owning run so mixed-style lines wrap correctly; `{break:true}`
    // pseudo-runs force an immediate line break within the paragraph.
    const tokens = [];
    para.runs.forEach((run) => {
      if (run.break) {
        tokens.push({ forceBreak: true });
        return;
      }
      run.text.split(/(\s+)/).filter(Boolean).forEach((rawText) => {
        const text = applyTextTransform(rawText, textTransform);
        tokens.push({ run, text, width: measureRunText(ctx, run, text, letterSpacing) });
      });
    });

    let line = { segments: [], width: 0, isFirst: true };
    const autoWidthCapped = autoWidth && Number.isFinite(maxAutoWidth);
    let usableWidth = autoWidth ? (autoWidthCapped ? Math.max(10, maxAutoWidth - indent) : Infinity) : Math.max(10, maxWidth - indent);

    const flushLine = (isLast) => {
      const fontSizes = line.segments.map((s) => s.run.fontSize).filter(Boolean);
      const maxFont = fontSizes.length ? Math.max(...fontSizes) : para.runs[0]?.fontSize || 16;
      const height = maxFont * lineHeight;
      lines.push({
        y,
        height,
        maxFont,
        align: para.align || defaultAlign,
        indent,
        prefix: line.isFirst ? prefix : "",
        segments: line.segments,
        width: line.width,
      });
      y += height;
      if (isLast) y += paragraphSpacing;
      line = { segments: [], width: 0, isFirst: false };
    };

    tokens.forEach((token) => {
      if (token.forceBreak) {
        flushLine(false);
        return;
      }
      if ((!autoWidth || autoWidthCapped) && line.segments.length && line.width + token.width > usableWidth) flushLine(false);
      const last = line.segments[line.segments.length - 1];
      if (last && last.run === token.run) {
        last.text += token.text;
        last.width += token.width;
      } else {
        line.segments.push({ run: token.run, text: token.text, width: token.width, x: line.width });
      }
      line.width += token.width;
    });
    flushLine(true);
  });

  const totalWidth = autoWidth
    ? Math.max(0, ...lines.map((l) => l.width + l.indent))
    : maxWidth;
  return { lines, totalWidth, totalHeight: y, letterSpacing };
}

// Auto-grow-height: the box height the wrapped `richText` needs at its own
// current width — same layoutRichText pass RichTextNode draws with, so the
// box a typing/pasting user sees can never disagree with what's measured
// here (per-run font size, so mixed rich-text sizes wrap and measure
// correctly). Width is never grown by this — callers keep the user's
// chosen `item.width` and only ever write back `height`. 20 matches the
// Transformer's own boundBoxFunc minimum (App.jsx) so a just-cleared text
// box doesn't collapse to 0.
export function measureAutoHeight(item, richText) {
  const padding = item.padding ?? 4;
  const maxWidth = Math.max(1, (item.width || 100) - padding * 2);
  const { totalHeight } = layoutRichText(richText, {
    maxWidth,
    autoWidth: false,
    lineHeight: item.lineHeight || 1,
    align: item.align || "left",
    letterSpacing: item.letterSpacing || 0,
    paragraphSpacing: item.paragraphSpacing || 0,
    textTransform: item.textTransform || "none",
  });
  return Math.max(20, totalHeight + padding * 2);
}

// The "flexible" text box measurement: the box keeps growing (or shrinking)
// its WIDTH to hug whatever's typed — never wrapping — until it would
// cross `availableWidth` (the remaining room out to the page's right edge,
// already computed by the caller as pageWidth - item.x), at which point it
// wraps exactly like a fixed-width box and grows in HEIGHT instead. Font
// size is never read or written here — only width/height ever change; the
// font-size toolbar control is the only thing that changes letter size
// (see App.jsx's applyTextFormat). 20 matches the Transformer's own
// boundBoxFunc minimum so a just-cleared text box doesn't collapse to 0.
export function measureFlexibleTextBox(item, richText, availableWidth) {
  const padding = item.padding ?? 4;
  const maxContentWidth = Math.max(20, availableWidth - padding * 2);
  const { totalWidth, totalHeight } = layoutRichText(richText, {
    maxWidth: maxContentWidth,
    autoWidth: true,
    maxAutoWidth: maxContentWidth,
    lineHeight: item.lineHeight || 1,
    align: item.align || "left",
    letterSpacing: item.letterSpacing || 0,
    paragraphSpacing: item.paragraphSpacing || 0,
    textTransform: item.textTransform || "none",
  });
  return {
    width: Math.max(20, Math.min(maxContentWidth, totalWidth) + padding * 2),
    height: Math.max(20, totalHeight + padding * 2),
  };
}

export { fontString, measureRunText, getMeasureContext, LIST_INDENT_PER_LEVEL };
