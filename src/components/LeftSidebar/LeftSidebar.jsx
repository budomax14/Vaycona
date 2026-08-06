import React from "react";
import {
  AppWindow,
  Blocks,
  Camera,
  Files,
  Folder,
  Images,
  Layers as LayersIcon,
  LayoutDashboard,
  LayoutTemplate,
  Palette,
  Shapes,
  Sparkles,
  Sticker,
  Type,
  Upload,
  X,
} from "lucide-react";

export const SECTIONS = [
  { key: "design", label: "Design", icon: LayoutDashboard },
  { key: "templates", label: "Templates", icon: LayoutTemplate },
  { key: "elements", label: "Elements", icon: Blocks },
  { key: "text", label: "Text", icon: Type },
  { key: "uploads", label: "Uploads", icon: Upload },
  { key: "photos", label: "Photos", icon: Camera },
  { key: "shapes", label: "Shapes", icon: Shapes },
  { key: "icons", label: "Icons", icon: Sticker },
  { key: "illustrations", label: "Illustrations", icon: Images },
  { key: "backgrounds", label: "Backgrounds", icon: Palette },
  { key: "layers", label: "Layers", icon: LayersIcon },
  { key: "pages", label: "Pages", icon: Files },
  { key: "brand", label: "Brand Assets", icon: Sparkles },
  { key: "projects", label: "Projects", icon: Folder },
  { key: "apps", label: "Apps", icon: AppWindow },
];

// isCompact (tablet-and-below): the content panel becomes a floating
// overlay with a click-to-dismiss backdrop instead of a normal flex
// sibling, so opening it never squeezes the canvas workspace.
export default function LeftSidebar({ activeSection, onSectionChange, isCompact, children }) {
  const activeLabel = SECTIONS.find((section) => section.key === activeSection)?.label;

  return (
    <div className="relative flex h-full shrink-0">
      <div className="flex w-16 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-gray-200 bg-white py-3">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const active = activeSection === section.key;
          return (
            <button
              key={section.key}
              className={`flex w-14 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-amber-500 ${
                active ? "bg-amber-50 text-amber-700" : "text-gray-500 hover:bg-gray-50"
              }`}
              onClick={() => onSectionChange(active ? null : section.key)}
              title={section.label}
              aria-label={section.label}
              aria-pressed={active}
            >
              <Icon size={19} />
              <span className="leading-none">{section.label.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>

      {activeSection && isCompact && (
        <button
          className="fixed inset-0 z-30 bg-black/20 transition-opacity"
          aria-label="Close panel"
          onClick={() => onSectionChange(null)}
        />
      )}

      {activeSection && (
        <div
          className={
            isCompact
              ? "fixed left-16 top-32 bottom-9 z-40 flex w-72 flex-col overflow-y-auto border-r border-gray-200 bg-white p-4 shadow-2xl transition-transform"
              : "flex w-72 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white p-4 transition-[width]"
          }
        >
          {isCompact && (
            <button
              className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
              onClick={() => onSectionChange(null)}
              aria-label={`Close ${activeLabel} panel`}
            >
              <X size={16} />
            </button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
