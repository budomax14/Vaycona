import React, { useEffect, useRef, useState } from "react";
import {
  AreaChart,
  Award,
  Barcode,
  BarChart3,
  BarChartHorizontal,
  Circle,
  Diamond,
  Donut,
  Hexagon,
  Heart,
  ImagePlus,
  LineChart,
  MessageSquare,
  Minus,
  MoveRight,
  MoveHorizontal,
  Pentagon,
  PieChart,
  Plus,
  QrCode,
  RectangleHorizontal,
  Star,
  Triangle,
  X,
} from "lucide-react";
import { SHAPE_KIND_ORDER } from "../../../shapeKinds";
import { LINE_KIND_ORDER, LINE_KINDS } from "../../../lineKinds";
import { FRAME_KIND_ORDER, FRAME_KINDS } from "../../../frameKinds";
import { CHART_KIND_ORDER_AVAILABLE, CHART_KINDS } from "../../../chartKinds";
import { useLanguage } from "../../../languageContext";
import { PANEL_STRINGS } from "../../../i18n/panels";

const CHART_ICONS = {
  bar: BarChart3,
  barHorizontal: BarChartHorizontal,
  line: LineChart,
  area: AreaChart,
  pie: PieChart,
  donut: Donut,
};

const SHAPE_ICONS = {
  rectangle: RectangleHorizontal,
  roundedRectangle: RectangleHorizontal,
  circle: Circle,
  ellipse: Circle,
  oval: Circle,
  triangle: Triangle,
  diamond: Diamond,
  pentagon: Pentagon,
  hexagon: Hexagon,
  star: Star,
  speechBubble: MessageSquare,
  heart: Heart,
  cross: Plus,
  badge: Award,
  ring: Donut,
};

const LINE_ICONS = {
  straight: Minus,
  dashed: MoveHorizontal,
  dotted: MoveHorizontal,
  arrow: MoveRight,
  doubleArrow: MoveRight,
};

export default function ElementsPanel({
  onAddShape,
  onAddLine,
  onAddFrame,
  onAddChart,
  onAddTable,
  onAddQrCode,
  onAddBarcode,
}) {
  const { language } = useLanguage();
  const t = PANEL_STRINGS[language].elements;
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
      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold text-gray-800">{t.title}</h3>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t.shapes}</span>
        <div className="grid grid-cols-3 gap-2">
          {SHAPE_KIND_ORDER.map((kind) => {
            const Icon = SHAPE_ICONS[kind];
            const label = t.shapeLabels[kind];
            return (
              <button
                key={kind}
                type="button"
                className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 py-4 text-gray-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
                onClick={() => onAddShape(kind)}
                title={label}
                aria-label={t.addShapeAria(label)}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t.linesAndArrows}</span>
        <div className="grid grid-cols-3 gap-2">
          {LINE_KIND_ORDER.map((kind) => {
            const Icon = LINE_ICONS[kind];
            return (
              <button
                key={kind}
                type="button"
                className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 py-4 text-gray-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
                onClick={() => onAddLine(kind)}
                title={LINE_KINDS[kind].label}
                aria-label={t.addAria(LINE_KINDS[kind].label)}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{LINE_KINDS[kind].label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t.charts}</span>
        <div className="grid grid-cols-3 gap-2">
          {CHART_KIND_ORDER_AVAILABLE.map((kind) => {
            const Icon = CHART_ICONS[kind];
            return (
              <button
                key={kind}
                type="button"
                className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 py-4 text-gray-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
                onClick={() => onAddChart(kind)}
                title={CHART_KINDS[kind].label}
                aria-label={t.addAria(CHART_KINDS[kind].label)}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{CHART_KINDS[kind].label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {onAddTable && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t.table}</span>
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
            onClick={() => onAddTable(3, 3)}
          >
            {t.addTable}
          </button>
        </div>
      )}

      {onAddQrCode && (
        <div className="flex flex-col gap-1.5">
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

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t.frames}</span>
        <div className="grid grid-cols-3 gap-2">
          {FRAME_KIND_ORDER.map((kind) => (
            <button
              key={kind}
              type="button"
              className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-4 text-gray-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
              onClick={() => onAddFrame(kind)}
              title={FRAME_KINDS[kind].label}
              aria-label={t.addAria(FRAME_KINDS[kind].label)}
            >
              <span className="text-[10px] font-medium">{FRAME_KINDS[kind].label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
