// Defensive tab/comma-delimited text -> string[][] parser, shared by
// anything that needs to read pasted spreadsheet data (Excel/Google
// Sheets/Numbers all copy tab-separated; plain CSV is comma-separated).
// Never throws — malformed input just yields null so the caller can leave
// existing data untouched rather than crashing the editor.
export function parseDelimitedText(text) {
  if (typeof text !== "string" || !text.trim()) return null;

  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => line.trim() !== "");
  if (lines.length === 0) return null;

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const rows = lines.map((line) => line.split(delimiter).map((cell) => cell.trim()));

  return rows;
}
