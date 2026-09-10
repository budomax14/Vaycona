import React, { useState } from "react";
import { useLanguage } from "../languageContext";
import { STATUS_BAR_STRINGS } from "../i18n/statusBarAndMenus";

const MAX_GRID_ROWS = 8;
const MAX_GRID_COLS = 10;

// Hover-to-choose row/column grid, matching the classic Word/PowerPoint
// "Insert Table" affordance (spec §1). Deliberately capped well below
// MAX_TABLE_DIM — this is a quick-pick UI, not the way to reach a large
// table (that's what the numeric "Custom" fields are for).
export default function TableGridPicker({ onPick }) {
  const { language } = useLanguage();
  const t = STATUS_BAR_STRINGS[language].tableGridPicker;
  const [hover, setHover] = useState({ rows: 0, cols: 0 });

  return (
    <div>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${MAX_GRID_COLS}, 1fr)` }}
        onMouseLeave={() => setHover({ rows: 0, cols: 0 })}
      >
        {Array.from({ length: MAX_GRID_ROWS }).map((_, r) =>
          Array.from({ length: MAX_GRID_COLS }).map((__, c) => {
            const active = r < hover.rows && c < hover.cols;
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                className={`h-4 w-4 rounded-sm border ${active ? "border-amber-500 bg-amber-400" : "border-gray-200 bg-gray-50"}`}
                onMouseEnter={() => setHover({ rows: r + 1, cols: c + 1 })}
                onClick={() => onPick(r + 1, c + 1)}
                aria-label={t.cellAriaLabel(r + 1, c + 1)}
              />
            );
          })
        )}
      </div>
      <div className="mt-1.5 text-center text-xs text-gray-500">
        {hover.rows > 0 ? t.sizeLabel(hover.rows, hover.cols) : t.hoverToChoose}
      </div>
    </div>
  );
}
