import React from "react";
import { Eye, Printer } from "lucide-react";
import { useLanguage } from "../../languageContext";
import { PRINT_STRINGS } from "../../i18n/print";
import { getPaperSize } from "../../print/paperSizes";
import { panelSizeIn } from "../../print/printProducts";

// Tiny schematic of where a panel sits on the folded card: a single card
// with its fold edge drawn heavier (front/back), or the open spread with
// one half filled (inside panels).
function PanelGlyph({ panel, active }) {
  const stroke = active ? "#b45309" : "#9ca3af";
  const fill = active ? "#fcd34d" : "#e5e7eb";
  if (panel === "insideLeft" || panel === "insideRight") {
    return (
      <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true">
        <rect x="1" y="1" width="10" height="14" fill={panel === "insideLeft" ? fill : "none"} stroke={stroke} strokeWidth="1.2" />
        <rect x="11" y="1" width="10" height="14" fill={panel === "insideRight" ? fill : "none"} stroke={stroke} strokeWidth="1.2" />
      </svg>
    );
  }
  const foldX = panel === "front" ? 4 : 14;
  return (
    <svg width="18" height="16" viewBox="0 0 18 16" aria-hidden="true">
      <rect x="4" y="1" width="10" height="14" fill={fill} stroke={stroke} strokeWidth="1.2" />
      <line x1={foldX} y1="1" x2={foldX} y2="15" stroke={stroke} strokeWidth="2.4" />
    </svg>
  );
}

// [ Front ] [ Inside Left ] [ Inside Right ] [ Back ] — switches the active
// page, which is all a panel is. Shown above the canvas only for card
// projects.
export default function CardPanelBar({ card, activePageId, onActivatePanel, onOpenPreview, onOpenPrint, compact = false }) {
  const { language } = useLanguage();
  const t = PRINT_STRINGS[language];
  const paper = getPaperSize(card.paperSize);
  const size = panelSizeIn(card.product, card.paperSize);
  const sizeLabel =
    card.paperSize === "a4"
      ? `${Math.round(size.widthIn * 254) / 10} × ${Math.round(size.heightIn * 254) / 10} mm`
      : `${Math.round(size.widthIn * 100) / 100} × ${Math.round(size.heightIn * 100) / 100} in`;

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-2 py-1.5 sm:px-3">
      <div role="tablist" aria-label={t.bar.label} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {card.product.panels.map((panel) => {
          const page = card.panels[panel];
          if (!page) return null;
          const active = page.id === activePageId;
          return (
            <button
              key={panel}
              role="tab"
              aria-selected={active}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                active ? "bg-amber-100 text-amber-800" : "text-gray-600 hover:bg-gray-100"
              }`}
              onClick={() => onActivatePanel(page.id)}
            >
              <PanelGlyph panel={panel} active={active} />
              {compact ? t.panelsShort[panel] : t.panels[panel]}
            </button>
          );
        })}
        {!compact && (
          <span className="ml-2 hidden shrink-0 text-[11px] text-gray-400 lg:inline" title={paper.dimensionsLabel}>
            {t.bar.cardSize(sizeLabel)}
          </span>
        )}
      </div>
      <button
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:border-amber-300 hover:text-amber-700"
        onClick={onOpenPreview}
        aria-label={t.bar.preview}
        title={t.bar.preview}
      >
        <Eye size={14} />
        {!compact && t.bar.preview}
      </button>
      <button
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
        onClick={onOpenPrint}
        aria-label={t.bar.print}
        title={t.bar.print}
      >
        <Printer size={14} />
        {!compact && t.bar.print}
      </button>
    </div>
  );
}
