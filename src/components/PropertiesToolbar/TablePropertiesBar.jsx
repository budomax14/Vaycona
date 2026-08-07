import React, { useState } from "react";
import {
  SlidersHorizontal,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowUpToLine,
  ArrowDownToLine,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Rows3,
  Columns3,
  Combine,
  Grid2x2X,
  Trash2,
} from "lucide-react";
import { SliderField, ToolbarDivider, IconToggleButton, ColorField } from "./toolbarUi";
import FontFamilyPicker from "./FontFamilyPicker";
import ObjectMoreMenu from "./ObjectMoreMenu";
import TableStylePanel from "./TableStylePanel";

// Registry propertiesBar for type:"table". Branches into two very
// different bars depending on whether the table is merely selected (whole-
// element controls, spec §44 "table selected") or in cell-edit mode with a
// cell/range selection active (spec §44 "cells selected") — PropertiesToolbar.jsx
// threads both `onChange` (generic item-field merge) and a bundled
// `tableEdit` prop (row/col/merge/cell-style actions) exactly like it
// already bundles `brand` for color/style linking.
export default function TablePropertiesBar(props) {
  const { tableEdit } = props;
  if (tableEdit?.isEditing) return <TableCellBar {...props} />;
  return <TableWholeBar {...props} />;
}

function TableWholeBar({
  item,
  unit,
  onChange,
  onDuplicate,
  onDelete,
  onForward,
  onBackward,
  onToggleLock,
  onToggleHidden,
  animationPanelOpen,
  onToggleAnimationPanel,
  hasAnimations,
}) {
  const [isStyleOpen, setIsStyleOpen] = useState(false);
  return (
    <>
      <span className="shrink-0 text-xs font-medium text-gray-400">
        Table · {item.rows}×{item.columns}
      </span>

      <ToolbarDivider />

      <button
        type="button"
        className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${
          isStyleOpen ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
        }`}
        onClick={() => setIsStyleOpen((v) => !v)}
      >
        <SlidersHorizontal size={15} />
        Style
      </button>

      <ToolbarDivider />

      <SliderField label="Opacity" value={item.opacity ?? 1} min={0.1} max={1} onChange={(value) => onChange({ opacity: value })} />

      <ToolbarDivider />

      <ObjectMoreMenu
        item={item}
        unit={unit}
        onChange={onChange}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onForward={onForward}
        onBackward={onBackward}
        onToggleLock={onToggleLock}
        onToggleHidden={onToggleHidden}
        animationPanelOpen={animationPanelOpen}
        onToggleAnimationPanel={onToggleAnimationPanel}
        hasAnimations={hasAnimations}
      />

      <TableStylePanel isOpen={isStyleOpen} onClose={() => setIsStyleOpen(false)} item={item} onChange={onChange} />
    </>
  );
}

function TableCellBar({ item, tableEdit }) {
  const {
    style,
    hasSelection,
    canMerge,
    canUnmerge,
    onApplyCellStyle,
    onSetCellFill,
    onMerge,
    onUnmerge,
    onInsertRowAbove,
    onInsertRowBelow,
    onDeleteRow,
    onInsertColLeft,
    onInsertColRight,
    onDeleteColumn,
  } = tableEdit;

  if (!hasSelection) {
    return <span className="shrink-0 text-xs font-medium text-gray-400">Click a cell to select it</span>;
  }

  return (
    <>
      <FontFamilyPicker value={style.fontFamily || "Arial"} onChange={(fontFamily) => onApplyCellStyle({ fontFamily })} />

      <ToolbarDivider />

      <IconToggleButton icon={Bold} active={!!style.bold} title="Bold" onClick={() => onApplyCellStyle({ bold: !style.bold })} />
      <IconToggleButton icon={Italic} active={!!style.italic} title="Italic" onClick={() => onApplyCellStyle({ italic: !style.italic })} />
      <IconToggleButton
        icon={Underline}
        active={!!style.underline}
        title="Underline"
        onClick={() => onApplyCellStyle({ underline: !style.underline })}
      />

      <ToolbarDivider />

      <ColorField value={style.color || "#111827"} onChange={(color) => onApplyCellStyle({ color })} />
      <ColorField value={style.fill === "transparent" ? "#ffffff" : style.fill || "#ffffff"} onChange={onSetCellFill} />

      <ToolbarDivider />

      <IconToggleButton
        icon={AlignLeft}
        active={(style.align || "left") === "left"}
        title="Align left"
        onClick={() => onApplyCellStyle({ align: "left" })}
      />
      <IconToggleButton
        icon={AlignCenter}
        active={style.align === "center"}
        title="Align center"
        onClick={() => onApplyCellStyle({ align: "center" })}
      />
      <IconToggleButton
        icon={AlignRight}
        active={style.align === "right"}
        title="Align right"
        onClick={() => onApplyCellStyle({ align: "right" })}
      />
      <IconToggleButton
        icon={AlignVerticalJustifyStart}
        active={style.valign === "top"}
        title="Align top"
        onClick={() => onApplyCellStyle({ valign: "top" })}
      />
      <IconToggleButton
        icon={AlignVerticalJustifyCenter}
        active={(style.valign || "middle") === "middle"}
        title="Align middle"
        onClick={() => onApplyCellStyle({ valign: "middle" })}
      />
      <IconToggleButton
        icon={AlignVerticalJustifyEnd}
        active={style.valign === "bottom"}
        title="Align bottom"
        onClick={() => onApplyCellStyle({ valign: "bottom" })}
      />

      <ToolbarDivider />

      {canMerge && <IconToggleButton icon={Combine} title="Merge cells" onClick={onMerge} />}
      {canUnmerge && <IconToggleButton icon={Grid2x2X} title="Unmerge cells" onClick={onUnmerge} />}

      <ToolbarDivider />

      <IconToggleButton icon={ArrowUpToLine} title="Insert row above" onClick={onInsertRowAbove} />
      <IconToggleButton icon={ArrowDownToLine} title="Insert row below" onClick={onInsertRowBelow} />
      <IconToggleButton icon={Rows3} title="Delete row" onClick={onDeleteRow} />

      <ToolbarDivider />

      <IconToggleButton icon={Columns3} title="Insert column left" onClick={onInsertColLeft} />
      <IconToggleButton icon={Trash2} title="Delete column" onClick={onDeleteColumn} />
      <IconToggleButton icon={Columns3} title="Insert column right" onClick={onInsertColRight} />
    </>
  );
}
