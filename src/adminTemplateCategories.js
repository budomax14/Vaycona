// Extensible category list for the admin template dashboard. Starts from
// the app's single existing category source (TEMPLATE_CATEGORIES in
// templateService.js — the same list TemplateBrowser.jsx's filter chips
// already use) plus a few categories from the admin spec that weren't
// already covered, and lets an admin add more later. Custom categories are
// small JSON in localStorage, matching every other lightweight-preference
// key in this app (see constants.js).

import { ADMIN_CUSTOM_CATEGORIES_KEY } from "./constants";
import { TEMPLATE_CATEGORIES } from "./templateService";

// Not already covered by TEMPLATE_CATEGORIES (Wedding/Birthday Invitations
// -> "invitations", Business Cards -> "business", Flyers -> "marketing" or
// "print", Social Media Posts -> "social", Posters -> "print", Book Covers
// -> "books" all already exist).
const SEED_EXTRA_CATEGORIES = [
  { key: "certificates", label: "Certificates" },
  { key: "menus", label: "Menus" },
  { key: "custom", label: "Custom" },
];

function readCustomCategories() {
  try {
    const raw = localStorage.getItem(ADMIN_CUSTOM_CATEGORIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCustomCategories(list) {
  try {
    localStorage.setItem(ADMIN_CUSTOM_CATEGORIES_KEY, JSON.stringify(list));
  } catch {
    // Best-effort — a failed write just means the new category doesn't
    // persist across reloads; it still works for the current session's form.
  }
}

function slugify(label) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function listAllCategories() {
  const seen = new Set();
  const all = [...TEMPLATE_CATEGORIES, ...SEED_EXTRA_CATEGORIES, ...readCustomCategories()];
  return all.filter((c) => {
    if (seen.has(c.key)) return false;
    seen.add(c.key);
    return true;
  });
}

// Returns the new category's key, or the existing one's key if a category
// with the same slug already exists (no duplicates).
export function addCustomCategory(label) {
  const trimmed = (label || "").trim().slice(0, 40);
  if (!trimmed) return null;
  const key = slugify(trimmed);
  if (!key) return null;
  const existing = listAllCategories().find((c) => c.key === key);
  if (existing) return existing.key;
  const custom = readCustomCategories();
  custom.push({ key, label: trimmed });
  writeCustomCategories(custom);
  return key;
}
