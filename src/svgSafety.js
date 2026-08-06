// Phase 11 — SVG logo/graphic safety (spec §30/§71/§94). Applies to the ONE
// non-raster upload path this app has (brand logos/graphics can be SVG;
// assetStore.js's ACCEPTED_IMAGE_MIME_TYPES never included SVG at all, on
// purpose — see its Phase 6 notes). Everything here runs on the raw text
// content, never via innerHTML/dangerouslySetInnerHTML, and never executes
// the SVG — this is a static text scan + a sanitizing re-serialization via
// DOMParser's XML mode (parses, never runs, script content).

const DISALLOWED_TAGS = ["script", "foreignobject", "iframe", "embed", "object", "audio", "video", "link"];
// Any attribute starting with "on" (onclick, onload, onerror, ...) is an
// event handler; href/xlink:href pointing at "javascript:" or "data:" with
// an executable MIME is the other common SVG-based injection vector.
const EVENT_ATTR_RE = /^on/i;
const DANGEROUS_HREF_RE = /^\s*(javascript|data:text\/html|vbscript):/i;

export function validateSvgSafety(svgText) {
  const reasons = [];
  if (typeof svgText !== "string" || !svgText.trim()) {
    return { safe: false, reasons: ["Empty or unreadable SVG content."] };
  }
  if (svgText.length > 2 * 1024 * 1024) {
    return { safe: false, reasons: ["SVG file is too large."] };
  }

  let doc;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(svgText, "image/svg+xml");
    if (doc.querySelector("parsererror")) reasons.push("SVG could not be parsed.");
  } catch {
    return { safe: false, reasons: ["SVG could not be parsed."] };
  }
  if (reasons.length) return { safe: false, reasons };

  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== "svg") {
    return { safe: false, reasons: ["File does not contain a valid <svg> root element."] };
  }

  const allElements = doc.querySelectorAll("*");
  allElements.forEach((el) => {
    const tag = el.nodeName.toLowerCase();
    if (DISALLOWED_TAGS.includes(tag)) reasons.push(`Disallowed element: <${tag}>.`);
    for (const attr of Array.from(el.attributes)) {
      if (EVENT_ATTR_RE.test(attr.name)) reasons.push(`Disallowed event handler attribute: ${attr.name}.`);
      if ((attr.name === "href" || attr.name === "xlink:href") && DANGEROUS_HREF_RE.test(attr.value)) {
        reasons.push("Disallowed executable reference in href.");
      }
    }
  });

  return { safe: reasons.length === 0, reasons };
}

// Strips disallowed tags/attributes rather than only rejecting outright —
// used so a mostly-safe SVG (e.g. one with a stray onmouseover from an
// export tool) can still be salvaged; callers still surface `reasons` as
// warnings even when sanitization succeeds.
export function sanitizeSvg(svgText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  if (doc.querySelector("parsererror")) return null;
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== "svg") return null;

  doc.querySelectorAll(DISALLOWED_TAGS.join(",")).forEach((el) => el.remove());
  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const isEvent = EVENT_ATTR_RE.test(attr.name);
      const isDangerousHref = (attr.name === "href" || attr.name === "xlink:href") && DANGEROUS_HREF_RE.test(attr.value);
      if (isEvent || isDangerousHref) el.removeAttribute(attr.name);
    }
  });

  return new XMLSerializer().serializeToString(doc);
}

// Rasterizes a (already-sanitized) SVG to a PNG blob — used when inserting
// a brand SVG logo onto the canvas (spec §32) so the resulting object can
// go through this app's existing raster image pipeline (assetStore.js,
// crop, filters, export) unchanged rather than needing a whole second
// vector-object renderer built for this phase. The sanitized SVG text
// itself is still preserved on the brand-kit logo resource (see
// brandKitService.createLogoResource) for future re-export/re-insert.
export function rasterizeSvgToPngBlob(svgText, targetWidth, targetHeight) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(targetWidth));
      canvas.height = Math.max(1, Math.round(targetHeight));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((pngBlob) => (pngBlob ? resolve(pngBlob) : reject(new Error("Could not rasterize SVG."))), "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load SVG for rasterization."));
    };
    img.src = url;
  });
}

export function extractSvgDimensions(svgText) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const root = doc.documentElement;
    if (!root) return { width: null, height: null };
    const widthAttr = parseFloat(root.getAttribute("width"));
    const heightAttr = parseFloat(root.getAttribute("height"));
    if (Number.isFinite(widthAttr) && Number.isFinite(heightAttr)) return { width: widthAttr, height: heightAttr };
    const viewBox = root.getAttribute("viewBox");
    if (viewBox) {
      const parts = viewBox.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts.every(Number.isFinite)) return { width: parts[2], height: parts[3] };
    }
    return { width: null, height: null };
  } catch {
    return { width: null, height: null };
  }
}
