import React, { useRef, useState } from "react";
import { Indent, List, ListOrdered, Outdent } from "lucide-react";
import { IconButton, IconToggleButton } from "./toolbarUi";
import ToolbarPopover from "./ToolbarPopover";
import { useLanguage } from "../../languageContext";
import { TEXT_PROPERTIES_STRINGS } from "../../i18n/textProperties";

// Promoted out of TextMoreMenu.jsx to a top-level toolbar control — list
// formatting is common enough to earn its own button rather than living
// inside the "More" overflow. Same onApplyListFormat contract as before
// (bullet/numbered only do something while actively inline-editing; see
// applyTextListFormat in App.jsx). Opens via ToolbarPopover (portalled) —
// PropertiesToolbar's row clips ordinary anchored dropdowns, see that
// component's comment.
export default function TextListMenu({ onApplyListFormat, activeListType }) {
  const { language } = useLanguage();
  const t = TEXT_PROPERTIES_STRINGS[language].textList;
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  return (
    <div className="relative shrink-0" data-text-toolbar-safe>
      <div ref={anchorRef} className="inline-flex">
        <IconButton icon={List} onClick={() => setOpen((v) => !v)} active={open} title={t.list} />
      </div>
      <ToolbarPopover isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <div className="flex w-max items-center gap-1 rounded-xl border border-gray-200 bg-white p-2 shadow-lg" data-text-toolbar-safe>
          <IconToggleButton icon={List} active={activeListType === "bullet"} onClick={() => onApplyListFormat("bullet")} title={t.bulletedList} />
          <IconToggleButton icon={ListOrdered} active={activeListType === "numbered"} onClick={() => onApplyListFormat("numbered")} title={t.numberedList} />
          <div className="mx-0.5 h-6 w-px bg-gray-200" />
          {/* Indent/outdent are momentary nudges, not a persistent toggle
              state, so they never show "active" — same as before. */}
          <IconToggleButton icon={Outdent} active={false} onClick={() => onApplyListFormat("outdent")} title={t.decreaseIndent} />
          <IconToggleButton icon={Indent} active={false} onClick={() => onApplyListFormat("indent")} title={t.increaseIndent} />
        </div>
      </ToolbarPopover>
    </div>
  );
}
