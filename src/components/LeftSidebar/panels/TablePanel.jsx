import React, { useState } from "react";
import { Table2 } from "lucide-react";
import TableGridPicker from "../../TableGridPicker";
import { MAX_TABLE_DIM } from "../../../tableUtils";

const STARTER_SIZES = [
  { rows: 2, columns: 2 },
  { rows: 3, columns: 3 },
  { rows: 4, columns: 4 },
  { rows: 5, columns: 5 },
];

export default function TablePanel({ onAddTable }) {
  const [customRows, setCustomRows] = useState("3");
  const [customCols, setCustomCols] = useState("3");

  function addCustom() {
    const rows = Math.max(1, Math.min(MAX_TABLE_DIM, parseInt(customRows, 10) || 1));
    const columns = Math.max(1, Math.min(MAX_TABLE_DIM, parseInt(customCols, 10) || 1));
    onAddTable(rows, columns);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-800">Table</h3>
        <TableGridPicker onPick={(rows, columns) => onAddTable(rows, columns)} />
      </div>

      <div>
        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Starter sizes</h4>
        <div className="grid grid-cols-4 gap-2">
          {STARTER_SIZES.map(({ rows, columns }) => (
            <button
              key={`${rows}x${columns}`}
              type="button"
              className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 py-3 text-gray-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
              onClick={() => onAddTable(rows, columns)}
              title={`${rows} × ${columns} table`}
            >
              <Table2 size={18} />
              <span className="text-[10px] font-medium">
                {rows}×{columns}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Custom table</h4>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={MAX_TABLE_DIM}
            value={customRows}
            onChange={(event) => setCustomRows(event.target.value)}
            className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            aria-label="Rows"
          />
          <span className="text-xs text-gray-400">rows ×</span>
          <input
            type="number"
            min={1}
            max={MAX_TABLE_DIM}
            value={customCols}
            onChange={(event) => setCustomCols(event.target.value)}
            className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            aria-label="Columns"
          />
          <span className="text-xs text-gray-400">cols</span>
        </div>
        <button
          type="button"
          onClick={addCustom}
          className="mt-2 w-full rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          Add table
        </button>
      </div>
    </div>
  );
}
