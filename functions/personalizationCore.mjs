// Client Personalization — the rules both sides share. The Cloud Functions
// (personalization.js) use this to validate what a business publishes and
// what a customer sends; the browser (src/personalization/*) uses the exact
// same applyValues() to draw the live preview, so the preview, the stored
// submission and the exported file are always built by one function.
//
// Pure ES module with no dependencies: the functions load it with a dynamic
// import(), Vite bundles it straight from here.
//
// Shapes:
//   design  { pages: [...], items: [...] }  — the editor's own page/item
//           objects, nothing else (no guides, history, project settings).
//   field   { id, itemId, type: "text"|"photo"|"color", label, instructions,
//             required, defaultValue, maxLength, minFontSize, defaultFontSize,
//             colors }
//   values  { [fieldId]: text {text, fontSize} | photo {uploadId, zoom,
//             focalX, focalY, filter?} | color {color} }

export const FIELD_TYPES = ["text", "photo", "color"];
export const MODES = ["download", "approval"];
export const EXPORT_FORMAT_OPTIONS = ["png", "jpeg", "pdf"];

// Filters a customer can put on their photo — each one is a set of the
// editor's image adjustments (src/imageEffects.js, same keys and values as
// its FILTER_PRESETS), so the preview, the stored submission and the export
// all draw it through the editor's own filter pipeline.
export const PHOTO_FILTERS = {
  grayscale: { saturation: -1 },
  warm: { warmth: 0.5, saturation: 0.15 },
  cool: { warmth: -0.5, saturation: 0.05 },
  vintage: { warmth: 0.35, saturation: -0.35, contrast: -0.1 },
  highContrast: { contrast: 0.5, saturation: 0.15 },
  soft: { contrast: -0.15, blur: 1.5 },
  sepia: { warmth: 0.7, saturation: -0.6 },
};

export const LIMITS = {
  maxFields: 30,
  labelMax: 60,
  instructionsMax: 300,
  textMaxLengthCap: 1000,
  defaultMaxLength: 80,
  minFontFloor: 4,
  maxColors: 16,
  photoZoomMax: 5,
  maxPages: 60,
  maxItems: 5000,
  templateNameMax: 80,
  businessNameMax: 80,
  noteMax: 1000,
  customerNameMax: 100,
  customerEmailMax: 200,
};

const HEX6 = /^#[0-9a-f]{6}$/;
const HEX3 = /^#[0-9a-f]{3}$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Control characters except tab/newline — never part of a real name or
// message, and some break canvas text layout.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

export function normalizeHex(value) {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (HEX6.test(v)) return v;
  if (HEX3.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return null;
}

export function isValidId(value) {
  return typeof value === "string" && ID_PATTERN.test(value);
}

export function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(/\r\n?/g, "\n").replace(CONTROL_CHARS, "");
  return maxLength ? [...cleaned].slice(0, maxLength).join("") : cleaned;
}

export function textLength(value) {
  return [...(value || "")].length;
}

export function isValidEmail(value) {
  return typeof value === "string" && value.length <= LIMITS.customerEmailMax && EMAIL_PATTERN.test(value);
}

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function fieldIdFor(type, itemId) {
  return `${type}-${itemId}`;
}

// --- which elements can carry which field ---

export function baseFontSize(item) {
  return isFiniteNumber(item.fontSize) && item.fontSize > 0 ? item.fontSize : 24;
}

export function itemPlainText(item) {
  if (Array.isArray(item.richText) && item.richText.length) {
    return item.richText
      .map((p) => (Array.isArray(p.runs) ? p.runs.map((r) => (r.break ? "\n" : r.text || "")).join("") : ""))
      .join("\n");
  }
  return String(item.text ?? "");
}

export function fieldTypeSupportsItem(type, item) {
  if (!item || typeof item !== "object") return false;
  if (type === "text") return item.type === "text" && !item.curve && !item.documentBody;
  if (type === "photo") return item.type === "image" || item.type === "frame";
  if (type === "color") {
    return (
      ["text", "shape", "icon"].includes(item.type) &&
      !item.fillGradient &&
      !item.fillImage?.assetId &&
      normalizeHex(item.fill) !== null
    );
  }
  return false;
}

export function supportedFieldTypes(item) {
  return FIELD_TYPES.filter((type) => fieldTypeSupportsItem(type, item));
}

// --- design snapshot ---

// Keeps only what's needed to render: pages + items. Anything else in the
// editor's workspace (guides, history, settings, project ids) never leaves
// the business's browser.
export function sanitizeDesign(raw) {
  const errors = [];
  if (!raw || typeof raw !== "object") return { design: null, errors: ["design_missing"] };
  const pages = Array.isArray(raw.pages) ? raw.pages : [];
  const items = Array.isArray(raw.items) ? raw.items : [];
  if (pages.length === 0) errors.push("design_no_pages");
  if (pages.length > LIMITS.maxPages) errors.push("design_too_many_pages");
  if (items.length > LIMITS.maxItems) errors.push("design_too_many_items");
  const pageIds = new Set();
  for (const page of pages) {
    if (!page || typeof page.id !== "string" || !isFiniteNumber(page.width) || !isFiniteNumber(page.height) || page.width <= 0 || page.height <= 0) {
      errors.push("design_bad_page");
      break;
    }
    pageIds.add(page.id);
  }
  const itemIds = new Set();
  for (const item of items) {
    if (!item || typeof item.id !== "string" || typeof item.type !== "string" || !pageIds.has(item.pageId) || itemIds.has(item.id)) {
      errors.push("design_bad_item");
      break;
    }
    itemIds.add(item.id);
  }
  if (errors.length) return { design: null, errors };
  // The field settings ride along on the editor's items (see
  // fieldsFromItems) but are delivered to customers separately, already
  // sanitized — the snapshot itself doesn't carry them.
  const cleanItems = items.map(({ personalizationFields, ...rest }) => rest);
  return { design: JSON.parse(JSON.stringify({ pages, items: cleanItems })), errors };
}

// The editor stores each element's field settings on the element itself
// (item.personalizationFields: [{ type, label, ... }]) so they save, undo
// and travel with the project like any other property. This flattens them
// into the field list a version is published with.
export function fieldsFromItems(items) {
  const fields = [];
  for (const item of items || []) {
    if (!Array.isArray(item.personalizationFields)) continue;
    for (const raw of item.personalizationFields) fields.push({ ...raw, itemId: item.id });
  }
  return fields;
}

export function collectAssetIds(items) {
  const set = new Set();
  for (const item of items) {
    if (item.assetId) set.add(item.assetId);
    if (item.contentAssetId) set.add(item.contentAssetId);
    if (item.fillImage?.assetId) set.add(item.fillImage.assetId);
  }
  return [...set];
}

// Same three reference fields projectPackage.js's applyAssetRemap covers.
export function remapAssetIds(items, remap) {
  return items.map((item) => {
    let next = item;
    if (item.assetId && remap[item.assetId]) next = { ...next, assetId: remap[item.assetId] };
    if (item.contentAssetId && remap[item.contentAssetId]) next = { ...next, contentAssetId: remap[item.contentAssetId] };
    if (item.fillImage?.assetId && remap[item.fillImage.assetId]) {
      next = { ...next, fillImage: { ...item.fillImage, assetId: remap[item.fillImage.assetId] } };
    }
    return next;
  });
}

// --- field definitions (what the business configures) ---

export function sanitizeField(raw, item) {
  const errors = [];
  const type = raw && FIELD_TYPES.includes(raw.type) ? raw.type : null;
  if (!type) return { field: null, errors: ["field_bad_type"] };
  if (!item) return { field: null, errors: ["field_item_missing"] };
  if (!fieldTypeSupportsItem(type, item)) return { field: null, errors: ["field_item_unsupported"] };

  const label = cleanText(raw.label, LIMITS.labelMax).replace(/\n/g, " ").trim();
  if (!label) errors.push("field_label_required");
  const field = {
    id: fieldIdFor(type, item.id),
    itemId: item.id,
    type,
    label,
    instructions: cleanText(raw.instructions, LIMITS.instructionsMax).trim(),
    required: !!raw.required,
  };

  if (type === "text") {
    const base = baseFontSize(item);
    const maxLength = Number.isInteger(raw.maxLength) ? raw.maxLength : LIMITS.defaultMaxLength;
    field.maxLength = clamp(maxLength, 1, LIMITS.textMaxLengthCap);
    const minFont = isFiniteNumber(raw.minFontSize) ? raw.minFontSize : Math.max(LIMITS.minFontFloor, Math.round(base * 0.6));
    field.minFontSize = clamp(minFont, LIMITS.minFontFloor, base);
    const defaultText = typeof raw.defaultValue === "string" ? cleanText(raw.defaultValue) : itemPlainText(item);
    if (textLength(defaultText) > field.maxLength) errors.push("field_default_too_long");
    field.defaultValue = defaultText;
    const defaultFont = isFiniteNumber(raw.defaultFontSize) ? raw.defaultFontSize : base;
    field.defaultFontSize = clamp(defaultFont, field.minFontSize, base);
  } else if (type === "color") {
    const colors = [...new Set((Array.isArray(raw.colors) ? raw.colors : []).map(normalizeHex).filter(Boolean))].slice(0, LIMITS.maxColors);
    if (colors.length === 0) errors.push("field_colors_required");
    field.colors = colors;
    const def = normalizeHex(raw.defaultValue) || normalizeHex(item.fill);
    field.defaultValue = colors.includes(def) ? def : colors[0] || null;
  } else {
    // Photo: the default is always the image already in the design.
    field.defaultValue = null;
  }
  return { field, errors };
}

export function validateFieldDefinitions(rawFields, design) {
  const errors = [];
  if (!Array.isArray(rawFields)) return { fields: [], errors: [{ fieldId: null, code: "fields_not_array" }] };
  if (rawFields.length === 0) errors.push({ fieldId: null, code: "fields_empty" });
  if (rawFields.length > LIMITS.maxFields) errors.push({ fieldId: null, code: "fields_too_many" });
  const itemsById = new Map((design?.items || []).map((it) => [it.id, it]));
  const fields = [];
  const seen = new Set();
  for (const raw of rawFields.slice(0, LIMITS.maxFields)) {
    const { field, errors: fieldErrors } = sanitizeField(raw, itemsById.get(raw?.itemId));
    const fieldId = field?.id || (raw && raw.type && raw.itemId ? fieldIdFor(raw.type, raw.itemId) : null);
    fieldErrors.forEach((code) => errors.push({ fieldId, code }));
    if (!field) continue;
    if (seen.has(field.id)) {
      errors.push({ fieldId: field.id, code: "field_duplicate" });
      continue;
    }
    seen.add(field.id);
    fields.push(field);
  }
  return { fields, errors };
}

// --- customer values ---

export function defaultValueFor(field, item) {
  if (field.type === "text") return { text: field.defaultValue ?? itemPlainText(item || {}), fontSize: field.defaultFontSize ?? baseFontSize(item || {}) };
  if (field.type === "color") return { color: field.defaultValue };
  return null;
}

// `uploads`: { [uploadId]: { width, height } } — the photos this session
// actually uploaded. `requireComplete`: submit/export — required fields
// must be filled in. Returns { values, errors } where values only holds
// the fields the customer supplied, normalized.
export function validateValues(fields, rawValues, { design, uploads = {}, requireComplete = false } = {}) {
  const errors = [];
  const values = {};
  const input = rawValues && typeof rawValues === "object" && !Array.isArray(rawValues) ? rawValues : {};
  const byId = new Map(fields.map((f) => [f.id, f]));
  const itemsById = new Map((design?.items || []).map((it) => [it.id, it]));

  for (const key of Object.keys(input)) {
    if (!byId.has(key)) errors.push({ fieldId: key, code: "unknown_field" });
  }

  for (const field of fields) {
    const raw = input[field.id];
    const item = itemsById.get(field.itemId);
    if (raw === undefined || raw === null) {
      if (requireComplete && field.required && (field.type === "photo" || (field.type === "text" && !String(field.defaultValue || "").trim()))) {
        errors.push({ fieldId: field.id, code: "required" });
      }
      continue;
    }
    if (typeof raw !== "object" || Array.isArray(raw)) {
      errors.push({ fieldId: field.id, code: "invalid" });
      continue;
    }
    const allowedKeys = { text: ["text", "fontSize"], photo: ["uploadId", "zoom", "focalX", "focalY", "filter"], color: ["color"] }[field.type];
    if (Object.keys(raw).some((k) => !allowedKeys.includes(k))) {
      errors.push({ fieldId: field.id, code: "unapproved_property" });
      continue;
    }

    if (field.type === "text") {
      if (typeof raw.text !== "string") {
        errors.push({ fieldId: field.id, code: "invalid" });
        continue;
      }
      const text = cleanText(raw.text);
      if (textLength(text) > field.maxLength) {
        errors.push({ fieldId: field.id, code: "too_long" });
        continue;
      }
      if (requireComplete && field.required && !text.trim()) {
        errors.push({ fieldId: field.id, code: "required" });
        continue;
      }
      const base = item ? baseFontSize(item) : field.defaultFontSize;
      const fontSize = isFiniteNumber(raw.fontSize) ? raw.fontSize : base;
      if (fontSize < field.minFontSize - 0.01) {
        errors.push({ fieldId: field.id, code: "text_does_not_fit" });
        continue;
      }
      values[field.id] = { text, fontSize: clamp(Math.round(fontSize * 100) / 100, field.minFontSize, base) };
    } else if (field.type === "color") {
      const color = normalizeHex(raw.color);
      if (!color || !field.colors.includes(color)) {
        errors.push({ fieldId: field.id, code: "color_not_allowed" });
        continue;
      }
      values[field.id] = { color };
    } else if (field.type === "photo") {
      if (!isValidId(raw.uploadId) || !uploads[raw.uploadId]) {
        errors.push({ fieldId: field.id, code: "upload_missing" });
        continue;
      }
      if (raw.filter != null && !Object.prototype.hasOwnProperty.call(PHOTO_FILTERS, raw.filter)) {
        errors.push({ fieldId: field.id, code: "invalid" });
        continue;
      }
      values[field.id] = {
        uploadId: raw.uploadId,
        zoom: clamp(isFiniteNumber(raw.zoom) ? raw.zoom : 1, 1, LIMITS.photoZoomMax),
        focalX: clamp(isFiniteNumber(raw.focalX) ? raw.focalX : 0.5, 0, 1),
        focalY: clamp(isFiniteNumber(raw.focalY) ? raw.focalY : 0.5, 0, 1),
      };
      if (raw.filter != null) values[field.id].filter = raw.filter;
    }
  }
  return { values, errors };
}

// The normalized (0..1) crop rect for an `image` item showing a
// naturalW×naturalH photo in a boxW×boxH box: cover the box (no
// distortion — the box keeps the aspect the business designed), shrink by
// `zoom`, and center on the focal point as far as the photo's edges allow.
export function computeCoverCrop(naturalW, naturalH, boxW, boxH, { zoom = 1, focalX = 0.5, focalY = 0.5 } = {}) {
  if (!(naturalW > 0 && naturalH > 0 && boxW > 0 && boxH > 0)) return { x: 0, y: 0, width: 1, height: 1 };
  const boxAspect = boxW / boxH;
  const imageAspect = naturalW / naturalH;
  let width = 1;
  let height = 1;
  if (imageAspect > boxAspect) width = boxAspect / imageAspect;
  else height = imageAspect / boxAspect;
  const z = clamp(zoom, 1, LIMITS.photoZoomMax);
  width /= z;
  height /= z;
  const x = clamp(focalX - width / 2, 0, 1 - width);
  const y = clamp(focalY - height / 2, 0, 1 - height);
  return { x, y, width, height };
}

const RUN_STYLE_KEYS = ["bold", "italic", "underline", "strikethrough", "color", "fontFamily", "fontSize"];

function runStyleOf(item) {
  const firstRun = Array.isArray(item.richText)
    ? item.richText.flatMap((p) => (Array.isArray(p.runs) ? p.runs : [])).find((r) => r && !r.break)
    : null;
  const style = {
    bold: item.fontWeight === "bold",
    italic: !!item.italic,
    underline: !!item.underline,
    strikethrough: !!item.strikethrough,
    color: item.fill || "#111827",
    fontFamily: item.fontFamily || "Arial",
    fontSize: baseFontSize(item),
  };
  if (firstRun) RUN_STYLE_KEYS.forEach((key) => {
    if (firstRun[key] !== undefined) style[key] = firstRun[key];
  });
  return style;
}

// Replaces an item's text with `text` in ONE style (the box's first run),
// scaled to `fontSize`. Everything else about the box — position, size,
// rotation, font, effects — is untouched.
export function applyTextToItem(item, text, fontSize) {
  const style = runStyleOf(item);
  const scale = fontSize / baseFontSize(item);
  const runFont = Math.max(1, Math.round(style.fontSize * scale * 100) / 100);
  const align = (Array.isArray(item.richText) && item.richText[0]?.align) || item.align || "left";
  return {
    ...item,
    text,
    fontSize,
    richText: text.split("\n").map((line) => ({ runs: [{ ...style, fontSize: runFont, text: line }], align, listType: null, listLevel: 0 })),
  };
}

function applyColorToItem(item, color) {
  const next = { ...item, fill: color };
  if (item.type === "text" && Array.isArray(item.richText)) {
    next.richText = item.richText.map((p) => ({ ...p, runs: (p.runs || []).map((r) => (r.break ? r : { ...r, color })) }));
  }
  return next;
}

// Builds the customer's own copy of the design. Never mutates `design`.
// `uploadAssets`: { [uploadId]: { assetId, width, height } }.
export function applyValues(design, fields, values, { uploadAssets = {} } = {}) {
  const copy = JSON.parse(JSON.stringify(design));
  const index = new Map(copy.items.map((it, i) => [it.id, i]));
  // Text before color, so a color choice on a text box recolors the
  // customer's new runs too.
  const ordered = [...fields].sort((a, b) => (a.type === "color") - (b.type === "color"));
  for (const field of ordered) {
    const i = index.get(field.itemId);
    if (i === undefined) continue;
    const item = copy.items[i];
    const value = values?.[field.id];
    if (field.type === "text") {
      const v = value || defaultValueFor(field, item);
      const changed = value || v.text !== itemPlainText(item) || v.fontSize !== baseFontSize(item);
      if (changed) copy.items[i] = applyTextToItem(item, v.text, v.fontSize);
    } else if (field.type === "color") {
      const v = value || defaultValueFor(field, item);
      if (v?.color && v.color !== normalizeHex(item.fill)) copy.items[i] = applyColorToItem(item, v.color);
    } else if (field.type === "photo" && value) {
      const upload = uploadAssets[value.uploadId];
      if (!upload) continue;
      const crop = { zoom: value.zoom, focalX: value.focalX, focalY: value.focalY };
      // A chosen filter replaces whatever adjustments the business put on
      // the box; with none, the box's own look (e.g. a B&W design) stays.
      const filter = PHOTO_FILTERS[value.filter] ? { adjustments: { ...PHOTO_FILTERS[value.filter] } } : {};
      if (item.type === "frame") {
        copy.items[i] = { ...item, contentAssetId: upload.assetId, crop: { fit: "fill", ...crop }, flipX: false, flipY: false, ...filter };
      } else {
        copy.items[i] = {
          ...item,
          assetId: upload.assetId,
          crop: computeCoverCrop(upload.width, upload.height, item.width || 100, item.height || 100, crop),
          flipX: false,
          flipY: false,
          ...filter,
        };
      }
    }
  }
  return copy;
}

export function uploadAssetId(uploadId) {
  return `pzu-${uploadId}`;
}
