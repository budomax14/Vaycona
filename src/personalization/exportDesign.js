// Exports a personalized design through Vaycona's normal export pipeline
// (export/exportService.js) — same renderer, same limits, same file names —
// for a customer's authorized download or the business's copy of a
// submission. No project package is embedded in PDFs: the editable source
// of a business's template must never ride along with a customer's file.
import { prepareExportRequest, runExport, downloadExportResult } from "../export/exportService";
import { DEFAULT_PRINT_SCALE } from "../export/exportConstants";

export async function exportPersonalizedDesign(design, format, filenameBase, { onProgress } = {}) {
  const context = { pages: design.pages, activePageId: design.pages[0]?.id, projectName: filenameBase };
  const raw = { format, pageSelection: "all", scale: DEFAULT_PRINT_SCALE, filenameBase, jpegQuality: "high", pdfMode: "standard" };
  // Large pages at 2× can exceed the per-page pixel budget (notably on
  // iPhone/iPad) — fall back to 1× rather than failing the download.
  let { request, errors } = prepareExportRequest(raw, context);
  if (errors.length) ({ request, errors } = prepareExportRequest({ ...raw, scale: 1 }, context));
  if (errors.length) throw new Error(errors[0]);
  const result = await runExport(request, { pages: design.pages, items: design.items, projectName: filenameBase }, { onProgress });
  await downloadExportResult(result.blob, result.filename);
  return result;
}
