import { CHART_SERIES_PALETTE } from "./chartKinds";
import { parseDelimitedText } from "./tableParse";

// Defensive TSV/CSV -> {data, series} parser for pasted spreadsheet data
// (Excel/Google Sheets/Numbers all copy tab-separated; plain CSV is
// comma-separated). Never throws — malformed input just yields null so
// the caller can leave the existing table untouched rather than crashing
// the editor (spec §5/§21).
export function parsePastedTable(text) {
  const rows = parseDelimitedText(text);
  if (!rows || rows.length < 2) return null;

  const header = rows[0];
  const seriesLabels = header.slice(1);
  if (seriesLabels.length === 0) return null;

  const series = seriesLabels.map((label, i) => ({
    key: `series${i + 1}`,
    name: label || `Series ${i + 1}`,
    color: CHART_SERIES_PALETTE[i % CHART_SERIES_PALETTE.length],
  }));

  const data = [];
  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r];
    const category = (cells[0] ?? "").trim();
    if (!category) continue;
    const row = { category };
    series.forEach((s, i) => {
      // Strips currency symbols/thousands separators (e.g. "$1,200") before
      // parsing — common when pasting formatted spreadsheet cells. Falls
      // back to 0 for anything that still isn't a real number rather than
      // NaN, which would otherwise silently break the chart render.
      const raw = (cells[i + 1] ?? "").replace(/[^0-9.\-]/g, "");
      const num = parseFloat(raw);
      row[s.key] = Number.isFinite(num) ? num : 0;
    });
    data.push(row);
  }

  if (!data.length) return null;
  return { data, series };
}
