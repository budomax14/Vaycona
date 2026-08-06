// Adapter for the bundled "Personal Canva Starter Template Pack" (see
// personal_canva_template_starter_pack/EDITOR_INTEGRATION_PROMPT.txt) —
// converts one `generic-design-template-v1` template JSON into this
// editor's own project/page/item data shape (the same shape
// buildCurrentProjectData()/loadWorkspaceDataIntoEditor() and
// builtinTemplates.js's hand-built templates use). Pure and
// side-effect-free so it can run against any parsed template object,
// independent of how that object was loaded (import.meta.glob in
// starterPackTemplates.js, or a unit test).

import { getDefaultProps } from "./objectRegistry";

// Only "text" and "shape" (kind "rectangle") appear anywhere in the pack
// (verified against all 50 template files) — an element outside that is
// skipped rather than guessed at.
function convertElement(element, pageId, idPrefix) {
  const base = {
    id: `${idPrefix}-${element.id}`,
    pageId,
    parentId: null,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation ?? 0,
    opacity: element.opacity ?? 1,
    locked: !!element.locked,
    hidden: element.visible === false,
    createdAt: 0,
    updatedAt: 0,
  };

  if (element.type === "text") {
    return {
      ...base,
      type: "text",
      ...getDefaultProps("text"),
      text: element.text ?? "",
      fontFamily: element.fontFamily || "Arial",
      fontSize: element.fontSize || 24,
      fontWeight: element.fontWeight || "normal",
      fill: element.color || "#111827",
      align: element.textAlign || "left",
    };
  }

  if (element.type === "shape" && element.shape === "rectangle") {
    return {
      ...base,
      type: "shape",
      shapeKind: "rectangle",
      ...getDefaultProps("shape", "rectangle"),
      fill: element.fill || "#8b5cf6",
      stroke: element.stroke || "transparent",
      strokeWidth: element.strokeWidth || 0,
      cornerRadius: element.cornerRadius || 0,
    };
  }

  return null;
}

// `idPrefix` keeps every id (page + item) namespaced to one template so
// ids stay unique within the converted project — actual global uniqueness
// only matters once cloneWorkspaceDataWithNewIds() remaps everything at
// use time (see idRemap.js), same as builtinTemplates.js's `builtin-*` ids.
export function convertGenericTemplateToProjectData(template, idPrefix = `starter-${template.slug || template.id}`) {
  const pages = (template.pages || []).map((p) => ({
    id: `${idPrefix}-${p.id}`,
    name: p.name || "Page 1",
    width: template.canvas?.width ?? p.width ?? 1080,
    height: template.canvas?.height ?? p.height ?? 1080,
    background: template.canvas?.background ?? p.background ?? "#ffffff",
  }));

  const items = [];
  (template.pages || []).forEach((p, index) => {
    const pageId = pages[index].id;
    (p.elements || []).forEach((element) => {
      const item = convertElement(element, pageId, idPrefix);
      if (item) items.push(item);
    });
  });

  return {
    pages,
    activePageId: pages[0]?.id ?? null,
    scale: 1,
    items,
    guides: [],
    snapToGuides: true,
  };
}
