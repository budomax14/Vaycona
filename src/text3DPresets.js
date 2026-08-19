import { defaultText3D } from "./text3D";

// Spec §12 — each preset just populates the normal text3D fields; applying
// one is identical to a user setting those same controls by hand, so the
// result stays fully editable afterward (no separate "preset mode").
export const TEXT3D_PRESETS = [
  {
    key: "block",
    label: "Block",
    values: { depth: 24, direction: "bottom-right", angle: 45, extrusionColor: "#4B5563", shading: "solid", bevel: 2, perspective: 0, highlight: 0 },
  },
  {
    key: "retro",
    label: "Retro",
    values: { depth: 18, direction: "bottom-right", angle: 45, extrusionColor: "#7A1F1F", shading: "light-to-dark", bevel: 2, perspective: 0, highlight: 10, lightDirection: "top-left" },
  },
  {
    key: "comic",
    label: "Comic",
    values: { depth: 22, direction: "bottom-right", angle: 45, extrusionColor: "#111827", shading: "solid", bevel: 4, perspective: 0, highlight: 20, lightDirection: "top-left" },
  },
  {
    key: "soft-3d",
    label: "Soft 3D",
    values: { depth: 8, direction: "bottom-right", angle: 45, extrusionColor: "#9CA3AF", shading: "light-to-dark", bevel: 1, perspective: 0, highlight: 15, lightDirection: "top-left" },
  },
  {
    key: "chrome",
    label: "Chrome",
    values: { depth: 14, direction: "down", angle: 90, extrusionColor: "#6B7280", shading: "dark-to-light", bevel: 3, perspective: 0, highlight: 40, lightDirection: "top" },
  },
  {
    key: "neon-depth",
    label: "Neon Depth",
    values: { depth: 12, direction: "bottom-right", angle: 45, extrusionColor: "#1E1B4B", shading: "solid", bevel: 0, perspective: 0, highlight: 30, lightDirection: "top-left" },
  },
  {
    key: "deep",
    label: "Deep",
    values: { depth: 70, direction: "bottom-right", angle: 45, extrusionColor: "#1F2937", shading: "light-to-dark", bevel: 2, perspective: 20, highlight: 0, lightDirection: "top-left" },
  },
];

export function applyText3DPreset(currentText3D, preset) {
  return { ...defaultText3D(), ...currentText3D, ...preset.values, enabled: true };
}
