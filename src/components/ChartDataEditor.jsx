import React, { useEffect } from "react";
import { Plus, Trash2, X } from "lucide-react";
import ChartRenderer from "./ChartRenderer";
import { parsePastedTable } from "../chartDataParse";
import { CHART_SERIES_PALETTE } from "../chartKinds";

// Spreadsheet-like data editor for a chart item. Styled as the same
// centered-overlay modal shell ResizeModal.jsx uses (fixed inset-0,
// click-outside-to-close, scrollable body) rather than a bespoke dialog,
// so it reads as a native Vaycona surface. Every edit calls onChange
// directly — no Save step, matching spec §4 ("must update the chart
// LIVE") and this app's existing convention of every field committing on
// its own change event (see toolbarUi.jsx's SliderField).
export default function ChartDataEditor({ isOpen, item, onClose, onChange }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const data = item.data || [];
  const series = item.series || [];

  function updateCategory(rowIndex, value) {
    onChange({ data: data.map((row, i) => (i === rowIndex ? { ...row, category: value } : row)) });
  }

  function updateValue(rowIndex, seriesKey, rawValue) {
    const num = Number(rawValue);
    const value = rawValue === "" || !Number.isFinite(num) ? 0 : num;
    onChange({ data: data.map((row, i) => (i === rowIndex ? { ...row, [seriesKey]: value } : row)) });
  }

  function addRow() {
    const newRow = { category: `Row ${data.length + 1}` };
    series.forEach((s) => {
      newRow[s.key] = 0;
    });
    onChange({ data: [...data, newRow] });
  }

  function deleteRow(rowIndex) {
    onChange({
      data: data.filter((_, i) => i !== rowIndex),
      sliceColors: (item.sliceColors || []).filter((_, i) => i !== rowIndex),
    });
  }

  function addSeries() {
    const key = `series${Date.now().toString(36)}${series.length}`;
    const newSeries = { key, name: `Series ${series.length + 1}`, color: CHART_SERIES_PALETTE[series.length % CHART_SERIES_PALETTE.length] };
    onChange({ series: [...series, newSeries], data: data.map((row) => ({ ...row, [key]: 0 })) });
  }

  function deleteSeries(seriesIndex) {
    const removedKey = series[seriesIndex].key;
    onChange({
      series: series.filter((_, i) => i !== seriesIndex),
      data: data.map((row) => {
        const next = { ...row };
        delete next[removedKey];
        return next;
      }),
    });
  }

  function renameSeries(seriesIndex, name) {
    onChange({ series: series.map((s, i) => (i === seriesIndex ? { ...s, name } : s)) });
  }

  // Only hijacks paste when the clipboard actually looks tabular (has a
  // tab or a second line) — a normal single-cell paste (e.g. pasting one
  // number into one input) is left to the browser's default behavior.
  function handlePaste(event) {
    const text = event.clipboardData?.getData("text");
    if (!text || (!text.includes("\t") && !text.includes("\n"))) return;
    const parsed = parsePastedTable(text);
    if (!parsed) return;
    event.preventDefault();
    onChange({ data: parsed.data, series: parsed.series, sliceColors: [] });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Edit chart data</h2>
          <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label="Close data editor">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5 md:flex-row">
          <div className="flex-1 space-y-3" onPaste={handlePaste}>
            <p className="text-xs text-gray-400">
              Tip: paste tabular data copied from Excel, Google Sheets, Numbers, or a CSV file directly into the table.
            </p>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border-b border-gray-200 px-2 py-2 text-left text-xs font-semibold text-gray-500">Category</th>
                    {series.map((s, i) => (
                      <th key={s.key} className="border-b border-gray-200 px-2 py-2">
                        <div className="flex items-center gap-1">
                          <input
                            className="w-full min-w-[70px] rounded-md border border-gray-200 bg-white px-1.5 py-1 text-xs font-medium text-gray-700 outline-none focus:border-amber-400"
                            value={s.name}
                            onChange={(event) => renameSeries(i, event.target.value)}
                          />
                          <button
                            type="button"
                            className="shrink-0 text-gray-300 hover:text-red-500"
                            onClick={() => deleteSeries(i)}
                            aria-label={`Delete series ${s.name}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="w-8 border-b border-gray-200" />
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      <td className="border-b border-gray-100 px-2 py-1.5">
                        <input
                          className="w-full min-w-[80px] rounded-md border border-gray-200 px-1.5 py-1 text-xs outline-none focus:border-amber-400"
                          value={row.category ?? ""}
                          onChange={(event) => updateCategory(rowIndex, event.target.value)}
                        />
                      </td>
                      {series.map((s) => (
                        <td key={s.key} className="border-b border-gray-100 px-2 py-1.5">
                          <input
                            type="number"
                            className="w-full min-w-[70px] rounded-md border border-gray-200 px-1.5 py-1 text-xs outline-none focus:border-amber-400"
                            value={row[s.key] ?? 0}
                            onChange={(event) => updateValue(rowIndex, s.key, event.target.value)}
                          />
                        </td>
                      ))}
                      <td className="border-b border-gray-100 px-1 text-center">
                        <button type="button" className="text-gray-300 hover:text-red-500" onClick={() => deleteRow(rowIndex)} aria-label="Delete row">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {data.length === 0 && (
                    <tr>
                      <td colSpan={series.length + 2} className="px-2 py-6 text-center text-xs text-gray-400">
                        No rows yet — add one below or paste data from a spreadsheet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                onClick={addRow}
              >
                <Plus size={13} /> Add row
              </button>
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                onClick={addSeries}
              >
                <Plus size={13} /> Add series
              </button>
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col items-center gap-2 md:w-72">
            <span className="self-start text-xs font-semibold uppercase tracking-wide text-gray-400">Preview</span>
            <div className="relative flex h-56 w-full items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-2">
              <ChartRenderer item={item} width={248} height={200} interactive />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
