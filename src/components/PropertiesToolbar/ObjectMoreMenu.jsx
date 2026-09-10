import React, { useRef, useState } from "react";
import { FlipHorizontal, FlipVertical, MoreHorizontal, RotateCcw, RotateCw } from "lucide-react";
import { IconButton, IconToggleButton } from "./toolbarUi";
import ResponsiveSheet from "../ResponsiveSheet/ResponsiveSheet";
import ObjectTransformFields from "./ObjectTransformFields";
import AnimateMenuItem from "./AnimateMenuItem";
import { useLanguage } from "../../languageContext";
import { TOOLBAR_MENU_STRINGS } from "../../i18n/toolbarMenus";

function Section({ title, children }) {
  return (
    <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{title}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

// Shared "More" button for object types without their own More menu
// (Shape/Icon/Frame, and Image with showTransform) — collapses the former
// standalone Arrange (ObjectTransformFields) and Transform (flip/rotate)
// buttons into one popover, same pattern as TextMoreMenu.
export default function ObjectMoreMenu({
  showTransform,
  animationPanelOpen,
  onToggleAnimationPanel,
  hasAnimations,
  ...transformFieldsProps
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const { item, onChange } = transformFieldsProps;
  const { language } = useLanguage();
  const t = TOOLBAR_MENU_STRINGS[language].objectMore;

  return (
    <div className="relative shrink-0" data-text-toolbar-safe>
      <div ref={anchorRef} className="inline-flex">
        <IconButton icon={MoreHorizontal} label={t.more} onClick={() => setOpen((v) => !v)} active={open} />
      </div>
      <ResponsiveSheet isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <div className="flex w-96 flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-lg" data-text-toolbar-safe>
          {onToggleAnimationPanel && (
            <AnimateMenuItem
              animationPanelOpen={animationPanelOpen}
              onToggleAnimationPanel={() => {
                setOpen(false);
                onToggleAnimationPanel();
              }}
              hasAnimations={hasAnimations}
            />
          )}

          <Section title={t.arrange}>
            <ObjectTransformFields {...transformFieldsProps} />
          </Section>

          {showTransform && (
            <Section title={t.transform}>
              <IconToggleButton
                icon={FlipHorizontal}
                active={!!item.flipX}
                onClick={() => onChange({ flipX: !item.flipX })}
                title={t.flipHorizontal}
              />
              <IconToggleButton
                icon={FlipVertical}
                active={!!item.flipY}
                onClick={() => onChange({ flipY: !item.flipY })}
                title={t.flipVertical}
              />
              <IconButton
                icon={RotateCcw}
                onClick={() => onChange({ rotation: (((item.rotation || 0) - 90) % 360 + 360) % 360 })}
                title={t.rotateLeft90}
                aria-label={t.rotateLeft90Degrees}
              />
              <IconButton
                icon={RotateCw}
                onClick={() => onChange({ rotation: (((item.rotation || 0) + 90) % 360 + 360) % 360 })}
                title={t.rotateRight90}
                aria-label={t.rotateRight90Degrees}
              />
            </Section>
          )}
        </div>
      </ResponsiveSheet>
    </div>
  );
}
