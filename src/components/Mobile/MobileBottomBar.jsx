import React from "react";
import { Eye, Files, Layers, Plus, SlidersHorizontal } from "lucide-react";
import { useLanguage } from "../../languageContext";
import { MOBILE_STRINGS } from "../../i18n/mobile";
import { MOBILE_ADD_KEY, MOBILE_ADD_SECTIONS } from "../LeftSidebar/LeftSidebar";

// The phone layout's only persistent chrome besides the slim top bar: five
// buttons, each opening its own sheet, so nothing else has to sit on screen
// beside the canvas.
export default function MobileBottomBar({ activeSection, onSectionChange, editOpen, onToggleEdit, hasSelection, viewOpen, onToggleView }) {
  const { language } = useLanguage();
  const t = MOBILE_STRINGS[language].bottomBar;

  const addActive = activeSection === MOBILE_ADD_KEY || MOBILE_ADD_SECTIONS.some((section) => section.key === activeSection);
  const buttons = [
    { key: "add", label: t.add, icon: Plus, active: addActive, onClick: () => onSectionChange(addActive ? null : MOBILE_ADD_KEY) },
    { key: "edit", label: t.edit, icon: SlidersHorizontal, active: editOpen, dot: hasSelection, onClick: onToggleEdit },
    { key: "layers", label: t.layers, icon: Layers, active: activeSection === "layers", onClick: () => onSectionChange(activeSection === "layers" ? null : "layers") },
    { key: "pages", label: t.pages, icon: Files, active: activeSection === "pages", onClick: () => onSectionChange(activeSection === "pages" ? null : "pages") },
    { key: "view", label: t.view, icon: Eye, active: viewOpen, onClick: onToggleView },
  ];

  return (
    <nav aria-label={t.aria} className="flex h-14 shrink-0 items-stretch border-t border-gray-200 bg-white">
      {buttons.map(({ key, label, icon: Icon, active, dot, onClick }) => (
        <button
          key={key}
          className={`group relative flex min-w-0 flex-1 select-none flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors duration-150 ${
            active ? "text-amber-700" : "text-gray-500"
          }`}
          onClick={onClick}
          aria-pressed={active}
        >
          <span
            className={`flex h-7 w-12 items-center justify-center rounded-full transition-[background-color,transform] duration-150 group-active:scale-90 ${
              active ? "bg-amber-100/70" : "group-active:bg-gray-100"
            }`}
          >
            <Icon size={19} />
          </span>
          <span className="leading-none">{label}</span>
          {dot && !active && <span className="absolute right-[calc(50%-1.1rem)] top-1.5 h-2 w-2 rounded-full bg-amber-500" />}
        </button>
      ))}
    </nav>
  );
}
