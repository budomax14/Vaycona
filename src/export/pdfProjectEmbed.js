// Editable PDFs: every exported PDF carries the project's own
// `.canvasproject` archive as a standard PDF file attachment (an
// /EmbeddedFiles entry — PDF viewers list it under "Attachments"), so the
// PDF can be opened back in the editor and edited. Not a second document
// format: the attachment IS the same archive projectPackage.js builds and
// imports; this module only puts it into / gets it out of the PDF.

const EMBED_MARKER_KEY = "VayconaProject";
const EMBED_FILENAME = "project.canvasproject";
const MAX_PDF_BYTES = 600 * 1024 * 1024;

function bytesToBinaryString(bytes) {
  const CHUNK = 0x8000;
  const parts = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK)));
  }
  return parts.join("");
}

// Must be called before pdf.output(): it hooks jsPDF's own resource/catalog
// writing events, the same way jsPDF's addJS plugin adds its name tree.
export async function embedProjectPackageInPdf(pdf, packageBlob) {
  const data = bytesToBinaryString(new Uint8Array(await packageBlob.arrayBuffer()));
  let namesObj;

  pdf.internal.events.subscribe("postPutResources", function writeAttachment() {
    const fileObj = this.internal.newObject();
    this.internal.putStream({
      data,
      // Already DEFLATE-compressed by JSZip; stored raw so import can read
      // it back without an inflate step.
      filters: [],
      objectId: fileObj,
      additionalKeyValues: [
        { key: "Type", value: "/EmbeddedFile" },
        { key: "Subtype", value: "/application#2Fzip" },
        { key: EMBED_MARKER_KEY, value: "1" },
      ],
    });
    this.internal.out("endobj");

    const specObj = this.internal.newObject();
    this.internal.out(
      `<< /Type /Filespec /F (${EMBED_FILENAME}) /UF (${EMBED_FILENAME}) /Desc (Editable project) /AFRelationship /Source /EF << /F ${fileObj} 0 R >> >>`
    );
    this.internal.out("endobj");

    namesObj = this.internal.newObject();
    this.internal.out(`<< /Names [(${EMBED_FILENAME}) ${specObj} 0 R] >>`);
    this.internal.out("endobj");
  });

  pdf.internal.events.subscribe("putCatalog", function writeNames() {
    if (namesObj !== undefined) this.internal.out(`/Names << /EmbeddedFiles ${namesObj} 0 R >>`);
  });
}

export async function isPdfFile(file) {
  if (/\.pdf$/i.test(file?.name || "") || file?.type === "application/pdf") return true;
  try {
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    return String.fromCharCode(...head) === "%PDF-";
  } catch {
    return false;
  }
}

// Returns the embedded `.canvasproject` archive as a Blob, or null when the
// PDF has none (e.g. exported before editable PDFs existed, or re-saved by
// another app that restructured it).
export async function extractProjectPackageFromPdf(file) {
  if (!file || file.size > MAX_PDF_BYTES) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  // One char per byte, so string offsets are byte offsets.
  const text = new TextDecoder("latin1").decode(bytes);

  // Last occurrence wins, in case the PDF was incrementally updated.
  const markerIndex = text.lastIndexOf(`/${EMBED_MARKER_KEY} 1`);
  if (markerIndex === -1) return null;
  const dictStart = text.lastIndexOf("<<", markerIndex);
  const streamKeyword = text.indexOf("stream", markerIndex);
  if (dictStart === -1 || streamKeyword === -1) return null;

  const lengthMatch = /\/Length (\d+)/.exec(text.slice(dictStart, streamKeyword));
  if (!lengthMatch) return null;
  const length = Number(lengthMatch[1]);

  let dataStart = streamKeyword + "stream".length;
  if (text[dataStart] === "\r") dataStart += 1;
  if (text[dataStart] === "\n") dataStart += 1;
  if (dataStart + length > bytes.length) return null;

  const archive = bytes.subarray(dataStart, dataStart + length);
  // ZIP local file header signature "PK\x03\x04".
  if (archive[0] !== 0x50 || archive[1] !== 0x4b) return null;
  return new Blob([archive], { type: "application/zip" });
}
