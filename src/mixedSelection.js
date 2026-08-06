import { getControls } from "./objectRegistry";

export const MIXED = Symbol("mixed");

// A control's label sometimes differs from the data field it edits — only
// needed for those exceptions.
const CONTROL_FIELD_MAP = { textAlign: "align" };

// The whole mixed-selection algorithm: intersect every selected item's
// registry-declared controls() by key (this already hides controls between
// different types AND between different kinds of one type, since
// getControls() is kind-aware — a star doesn't list cornerRadius, a
// rectangle does), then for each surviving control check whether every
// selected item agrees on its backing field's value.
export function computeSelectionControls(items) {
  if (items.length === 0) return [];
  const perItemControlSets = items.map((item) => new Set(getControls(item)));
  const sharedKeys = [...perItemControlSets[0]].filter((key) =>
    perItemControlSets.every((set) => set.has(key))
  );
  return sharedKeys.map((key) => {
    const field = CONTROL_FIELD_MAP[key] ?? key;
    const first = items[0][field];
    const allSame = items.every((item) => item[field] === first);
    return { key, field, value: allSame ? first : MIXED, mixed: !allSame };
  });
}
