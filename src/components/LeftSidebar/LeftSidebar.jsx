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
  Paintbrush,
  Palette,
  Sparkles,
  Sticker,
  Table2,
  Type,
  Upload,
  X,
} from "lucide-react";
import { useLanguage } from "../../languageContext";
import { PANEL_STRINGS } from "../../i18n/panels";
import { MOBILE_STRINGS } from "../../i18n/mobile";
import MobileSheet from "../Mobile/MobileSheet";

// `label` here stays the fixed English identifier used by other modules
// (e.g. App.jsx passes SECTIONS.find(...).label straight into
// ComingSoonPanel's title) that aren't part of this sidebar's i18n pass.
// The rendered rail below looks up the translated text itself via
// `t.sections[section.key]` instead of reading `section.label` directly.
export const SECTIONS = [
  { key: "illustrations", label: "Illustrations", icon: Images },
  { key: "text", label: "Text", icon: Type },
  { key: "elements", label: "Elements", icon: Blocks },
  { key: "icons", label: "Icons", icon: Sticker },
  { key: "brush", label: "Brush", icon: Paintbrush },
  { key: "uploads", label: "Uploads", icon: Upload },
  { key: "design", label: "Design", icon: LayoutDashboard },
  { key: "photos", label: "Photos", icon: Camera },
  { key: "chart", label: "Chart", icon: BarChart3 },
  { key: "table", label: "Table", icon: Table2 },
  { key: "layers", label: "Layers", icon: LayersIcon },
  { key: "pages", label: "Pages", icon: Files },
  { key: "brand", label: "Brand Assets", icon: Sparkles },
  { key: "projects", label: "Projects", icon: Folder },
  { key: "apps", label: "Apps", icon: AppWindow },
];

// Phone layout: the rail is replaced by an "Add" launcher (a grid of these
// sections) opened from the bottom bar. Layers and Pages have their own
// bottom-bar buttons, so they aren't repeated in the launcher.
export const MOBILE_ADD_KEY = "mobile-add";
const MOBILE_OWN_BUTTON_KEYS = ["layers", "pages"];
export const MOBILE_ADD_SECTIONS = SECTIONS.filter((section) => !MOBILE_OWN_BUTTON_KEYS.includes(section.key));

// tier "tablet": the content panel becomes a floating overlay (anchored
// past the icon rail) with a click-to-dismiss backdrop instead of a normal
// flex sibling, so opening it never squeezes the canvas workspace.
// tier "mobile": same overlay technique, but full-bleed from the left edge
// (covers the icon rail too) since a phone-width screen can't fit a
// permanent 64px rail *and* a useful panel at the same time. The icon rail
// itself hides while a panel is open on mobile and reappears once closed.
export default function LeftSidebar({ activeSection, onSectionChange, tier = "desktop", children }) {
  const { language } = useLanguage();
  const t = PANEL_STRINGS[language].sidebar;
  const activeLabel = t.sections[activeSection];
  const isCompact = tier !== "desktop";
  const isMobile = tier === "mobile";
  const railHiddenForPanel = isMobile && Boolean(activeSection);

  // Phones get no permanent rail and no side overlay: every section opens as
  // a bottom sheet (see MobileSheet), reached from the bottom bar's buttons.
  if (isMobile) {
    const isLauncher = activeSection === MOBILE_ADD_KEY;
    const cameFromLauncher = Boolean(activeSection) && !isLauncher && !MOBILE_OWN_BUTTON_KEYS.includes(activeSection);
    return (
      <MobileSheet
        isOpen={Boolean(activeSection)}
        onClose={() => onSectionChange(null)}
        title={isLauncher ? MOBILE_STRINGS[language].addSheetTitle : activeLabel}
        onBack={cameFromLauncher ? () => onSectionChange(MOBILE_ADD_KEY) : undefined}
        aboveBar
        modal={false}
      >
        {isLauncher ? (
          <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4">
            {MOBILE_ADD_SECTIONS.map((section) => {
              const Icon = section.icon;
              const label = t.sections[section.key];
              return (
                <button
                  key={section.key}
                  className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-1 py-2 text-[11px] font-medium text-gray-600 active:bg-amber-50 active:text-amber-700"
                  onClick={() => onSectionChange(section.key)}
                >
                  <Icon size={22} />
                  <span className="max-w-full truncate leading-none">{label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          children
        )}
      </MobileSheet>
    );
  }

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
          const label = t.sections[section.key];
          return (
            <button
              key={section.key}
              className={`toolbar-hit-target flex w-14 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-amber-500 ${
                active ? "bg-amber-50 text-amber-700" : "text-gray-500 hover:bg-gray-50"
              }`}
              onClick={() => onSectionChange(active ? null : section.key)}
              title={label}
              aria-label={label}
              aria-pressed={active}
            >
              <Icon size={19} />
              <span className="leading-none">{label.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>

      {activeSection && isCompact && (
        <button
          className="fixed inset-0 z-30 bg-black/20 transition-opacity"
          aria-label={t.closePanel}
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
              aria-label={t.closeSectionPanel(activeLabel)}
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
