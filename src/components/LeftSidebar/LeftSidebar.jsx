import React from "react";
import {
  AppWindow,
  BarChart3,
  Blocks,
  Camera,
  Files,
  Folder,
  Images,
  Layers as LayersIcon,
  LayoutDashboard,
  LayoutTemplate,
  Palette,
  Sparkles,
  Sticker,
  Table2,
  Type,
  Upload,
  X,
} from "lucide-react";

export const SECTIONS = [
  { key: "templates", label: "Templates", icon: LayoutTemplate },
  { key: "design", label: "Design", icon: LayoutDashboard },
  { key: "elements", label: "Elements", icon: Blocks },
  { key: "text", label: "Text", icon: Type },
  { key: "uploads", label: "Uploads", icon: Upload },
  { key: "photos", label: "Photos", icon: Camera },
  { key: "chart", label: "Chart", icon: BarChart3 },
  { key: "table", label: "Table", icon: Table2 },
  { key: "icons", label: "Icons", icon: Sticker },
  { key: "illustrations", label: "Illustrations", icon: Images },
  { key: "layers", label: "Layers", icon: LayersIcon },
  { key: "pages", label: "Pages", icon: Files },
  { key: "brand", label: "Brand Assets", icon: Sparkles },
  { key: "projects", label: "Projects", icon: Folder },
  { key: "apps", label: "Apps", icon: AppWindow },
];

// tier "tablet": the content panel becomes a floating overlay (anchored
// past the icon rail) with a click-to-dismiss backdrop instead of a normal
// flex sibling, so opening it never squeezes the canvas workspace.
// tier "mobile": same overlay technique, but full-bleed from the left edge
// (covers the icon rail too) since a phone-width screen can't fit a
// permanent 64px rail *and* a useful panel at the same time. The icon rail
// itself hides while a panel is open on mobile and reappears once closed.
export default function LeftSidebar({ activeSection, onSectionChange, tier = "desktop", children }) {
  const activeLabel = SECTIONS.find((section) => section.key === activeSection)?.label;
  const isCompact = tier !== "desktop";
  const isMobile = tier === "mobile";
  const railHiddenForPanel = isMobile && Boolean(activeSection);

  return (
    <div className="relative flex h-full shrink-0">
      <div
        className={`flex w-16 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-gray-200 bg-white py-3 ${
          railHiddenForPanel ? "hidden" : ""
        }`}
      >
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const active = activeSection === section.key;
          return (
            <button
              key={section.key}
              className={`toolbar-hit-target flex w-14 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-amber-500 ${
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
            isMobile
              ? "fixed left-0 top-32 bottom-9 z-40 flex w-full max-w-[85vw] flex-col overflow-y-auto border-r border-gray-200 bg-white p-4 pb-[max(1rem,var(--safe-bottom))] shadow-2xl transition-transform"
              : isCompact
                ? "fixed left-16 top-32 bottom-9 z-40 flex w-72 flex-col overflow-y-auto border-r border-gray-200 bg-white p-4 shadow-2xl transition-transform"
                : "flex w-72 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white p-4 transition-[width]"
          }
        >
          {isCompact && (
            <button
              className="toolbar-hit-target absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
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
