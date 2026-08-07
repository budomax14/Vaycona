import React from "react";
import { Sparkles } from "lucide-react";

// Shared "Animate" row used inside every selection's single More menu
// (ObjectMoreMenu, TextMoreMenu, SelectionMoreMenu) — kept as one component
// so the entry point for the centralized animation UI (see App.jsx's
// animationPanelOpen) looks and behaves identically no matter which menu
// it's rendered from.
export default function AnimateMenuItem({ animationPanelOpen, onToggleAnimationPanel, hasAnimations }) {
  return (
    <button
      type="button"
      onClick={onToggleAnimationPanel}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium ${
        animationPanelOpen
          ? "bg-amber-50 text-amber-700"
          : hasAnimations
            ? "text-amber-600 hover:bg-amber-50"
            : "text-gray-700 hover:bg-amber-50 hover:text-amber-700"
      }`}
      aria-pressed={animationPanelOpen}
    >
      <Sparkles size={15} />
      Animate
    </button>
  );
}
