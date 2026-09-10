import React, { useRef, useState } from "react";
import { Move } from "lucide-react";
import { IconButton } from "./toolbarUi";
import { PrecisionField } from "./ObjectTransformFields";
import ToolbarPopover from "./ToolbarPopover";
import { useLanguage } from "../../languageContext";
import { TOOLBAR_MENU_STRINGS } from "../../i18n/toolbarMenus";

// Collapses the X/Y/Width/Height precision fields into one button, same
// "popover holds the group" pattern AlignMenu/DistributeMenu already
// established for this bar.
export default function PositionMenu({ bounds, unit, onTransformBounds }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const { language } = useLanguage();
  const t = TOOLBAR_MENU_STRINGS[language].position;

  return (
    <div className="relative shrink-0" data-text-toolbar-safe>
      <div ref={anchorRef} className="inline-flex">
        <IconButton icon={Move} label={t.position} onClick={() => setOpen((v) => !v)} active={open} />
      </div>
      <ToolbarPopover isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <div
          className="flex w-max items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-lg"
          data-text-toolbar-safe
        >
          <PrecisionField label={t.x} valuePx={bounds.left} unit={unit} width={56} onCommitPx={(px) => onTransformBounds({ x: px })} />
          <PrecisionField label={t.y} valuePx={bounds.top} unit={unit} width={56} onCommitPx={(px) => onTransformBounds({ y: px })} />
          <PrecisionField
            label={t.width}
            valuePx={bounds.width}
            unit={unit}
            min={1}
            width={56}
            onCommitPx={(px) => onTransformBounds({ width: Math.max(1, px) })}
          />
          <PrecisionField
            label={t.height}
            valuePx={bounds.height}
            unit={unit}
            min={1}
            width={56}
            onCommitPx={(px) => onTransformBounds({ height: Math.max(1, px) })}
          />
        </div>
      </ToolbarPopover>
    </div>
  );
}
