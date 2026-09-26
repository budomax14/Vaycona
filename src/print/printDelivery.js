// Hands a freshly built print PDF to the browser's print flow. Same
// approach as App.jsx's handlePrint (see the long comment there): a real
// top-level tab opened synchronously inside the click, then navigated to
// the PDF and print()ed; on iOS, the Share Sheet (AirPrint lives there)
// since iOS has no script-triggered print dialog.

import { isIOSWebKit } from "../canvasPixelBudget";
import { downloadExportResult } from "../export/exportService";

// `makePdf`: async () => { blob, filename }. Must be called directly from
// a click handler (before any await) so the new tab isn't popup-blocked.
export async function printPdfFromClick(makePdf) {
  if (isIOSWebKit()) {
    const result = await makePdf();
    const file = new File([result.blob], result.filename, { type: "application/pdf" });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: result.filename });
      else downloadExportResult(result.blob, result.filename);
    } catch (err) {
      if (err?.name !== "AbortError") throw err;
    }
    return result;
  }

  const printWindow = window.open("", "_blank");
  let result;
  try {
    result = await makePdf();
  } catch (err) {
    printWindow?.close();
    throw err;
  }
  const url = URL.createObjectURL(result.blob);
  if (printWindow) {
    printWindow.location.href = url;
    let printed = false;
    const tryPrint = () => {
      if (printed) return;
      printed = true;
      window.setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch {
          // The PDF tab stays open with its own print button.
        }
      }, 300);
    };
    printWindow.addEventListener("load", tryPrint, { once: true });
    window.setTimeout(tryPrint, 1500);
  } else {
    downloadExportResult(result.blob, result.filename);
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  return result;
}
