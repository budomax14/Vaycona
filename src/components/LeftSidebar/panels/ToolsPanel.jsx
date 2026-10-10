import React, { useEffect, useRef, useState } from "react";
import { Barcode, ImagePlus, QrCode, X } from "lucide-react";
import { useLanguage } from "../../../languageContext";
import { PANEL_STRINGS } from "../../../i18n/panels";
import ChartPanel from "./ChartPanel";
import TablePanel from "./TablePanel";

// Charts, tables, and generators that make a new image from what the user
// types (QR codes, barcodes). App.jsx owns the actual adding/rendering;
// this panel only collects the input.
export default function ToolsPanel({ onAddChart, onAddTable, onAddQrCode, onAddBarcode }) {
  const { language } = useLanguage();
  const t = PANEL_STRINGS[language].tools;
  const [qrValue, setQrValue] = useState("");
  const [qrLogoFile, setQrLogoFile] = useState(null);
  const [qrLogoPreview, setQrLogoPreview] = useState(null);
  const qrLogoInputRef = useRef(null);
  const [barcodeValue, setBarcodeValue] = useState("");

  useEffect(() => {
    if (!qrLogoFile) {
      setQrLogoPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(qrLogoFile);
    setQrLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [qrLogoFile]);

  function handleQrLogoChange(e) {
    const file = e.target.files?.[0];
    if (file) setQrLogoFile(file);
    e.target.value = "";
  }

  function handleGenerateQrCode(e) {
    e.preventDefault();
    const value = qrValue.trim();
    if (!value || !onAddQrCode) return;
    onAddQrCode(value, qrLogoFile);
    setQrValue("");
    setQrLogoFile(null);
  }

  function handleGenerateBarcode(e) {
    e.preventDefault();
    const value = barcodeValue.trim();
    if (!value || !onAddBarcode) return;
    onAddBarcode(value);
    setBarcodeValue("");
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-gray-800">{t.title}</h3>

      {onAddChart && <ChartPanel onAddChart={onAddChart} />}

      {onAddTable && (
        <div className="border-t border-gray-100 pt-4">
          <TablePanel onAddTable={onAddTable} />
        </div>
      )}

      {onAddQrCode && (
        <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-4">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t.qrCode}</span>
          <form className="flex flex-col gap-2" onSubmit={handleGenerateQrCode}>
            <input
              type="text"
              value={qrValue}
              onChange={(e) => setQrValue(e.target.value)}
              placeholder={t.qrCodePlaceholder}
              aria-label={t.qrCodePlaceholder}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-amber-400 focus:outline-none"
            />
            <div className="flex items-center gap-2">
              {qrLogoPreview ? (
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 py-1.5 pl-1.5 pr-2">
                  <img src={qrLogoPreview} alt="" className="h-6 w-6 rounded object-cover" />
                  <span className="max-w-24 truncate text-xs text-gray-600">{qrLogoFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setQrLogoFile(null)}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label={t.removeLogo}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => qrLogoInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
                >
                  <ImagePlus size={14} />
                  {t.addLogo}
                </button>
              )}
              <input
                ref={qrLogoInputRef}
                type="file"
                accept="image/*"
                onChange={handleQrLogoChange}
                className="hidden"
              />
            </div>
            <button
              type="submit"
              disabled={!qrValue.trim()}
              className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:bg-transparent disabled:hover:text-gray-600"
            >
              <QrCode size={16} />
              {t.generateQrCode}
            </button>
          </form>
        </div>
      )}

      {onAddBarcode && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t.barcode}</span>
          <form className="flex flex-col gap-2" onSubmit={handleGenerateBarcode}>
            <input
              type="text"
              value={barcodeValue}
              onChange={(e) => setBarcodeValue(e.target.value)}
              placeholder={t.barcodePlaceholder}
              aria-label={t.barcodePlaceholder}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-amber-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!barcodeValue.trim()}
              className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:bg-transparent disabled:hover:text-gray-600"
            >
              <Barcode size={16} />
              {t.generateBarcode}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
