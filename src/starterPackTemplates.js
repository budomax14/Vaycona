// Wires the bundled "Personal Canva Starter Template Pack" (50 templates —
// see personal_canva_template_starter_pack/) into the same built-in
// template seeding pipeline builtinTemplates.js's hand-built set already
// uses (templateService.js's ensureBuiltInTemplatesSeeded). Follows
// personal_canva_template_starter_pack/EDITOR_INTEGRATION_PROMPT.txt:
// catalog.json drives the list, each templates/*.json is converted via
// starterPackAdapter, previews/*.svg are used as thumbnails only (never
// embedded in project data), and the converted data is run through the
// existing project repairer before it's ever committed to storage.

import catalog from "./personal_canva_template_starter_pack/catalog.json";
import { convertGenericTemplateToProjectData } from "./starterPackAdapter";
import { repairProject } from "./projectValidator";

// catalog.json's categories -> this app's stable TEMPLATE_CATEGORIES keys
// (templateService.js §7) so the Templates panel's existing category
// filter chips work against these without any UI changes.
const CATEGORY_MAP = {
  Wedding: "invitations",
  Events: "events",
  Business: "business",
  "Social Media": "social",
  Publishing: "books",
  Documents: "documents",
};

const templateModules = import.meta.glob("./personal_canva_template_starter_pack/templates/*.json", { eager: true });
const previewModules = import.meta.glob("./personal_canva_template_starter_pack/previews/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});

export const STARTER_PACK_TEMPLATES = catalog.templates.map((entry) => {
  const templateModule = templateModules[`./personal_canva_template_starter_pack/${entry.file}`];
  const template = templateModule?.default ?? templateModule;
  const thumbnail = previewModules[`./personal_canva_template_starter_pack/${entry.thumbnail}`] || null;
  const idPrefix = `starter-pack-${entry.slug}`;

  return {
    // Stable across app updates — this is what ensureBuiltInTemplatesSeeded()
    // uses to avoid reseeding a template that's already in IndexedDB.
    builtInKey: idPrefix,
    name: entry.name,
    category: CATEGORY_MAP[entry.category] || "personal",
    tags: template.tags || [],
    thumbnail,
    data: repairProject(convertGenericTemplateToProjectData(template, idPrefix)),
  };
});
