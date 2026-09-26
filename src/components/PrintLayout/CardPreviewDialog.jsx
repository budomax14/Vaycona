import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BookOpen, ChevronLeft, ChevronRight, Download, Loader2, X } from "lucide-react";
import { useLanguage } from "../../languageContext";
import { PRINT_STRINGS } from "../../i18n/print";
import { useReducedMotion } from "../../useReducedMotion";
import { buildPrintPlan } from "../../print/printPlan";
import { loadImage } from "../../print/panelPreviews";
import { GREETING_CARD_MOCKUP_VARIANTS } from "../../mockup/greetingCardMockup";
import SheetPreview from "./SheetPreview";
import { usePanelImages } from "./usePanelImages";

const VIEWS = ["front", "open", "back", "sheet", "mockup"];

function Face({ image, flipped, style }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden bg-white"
      style={{
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: flipped ? "rotateY(180deg)" : undefined,
        boxShadow: "0 1px 2px rgba(0,0,0,0.12), 0 12px 30px rgba(0,0,0,0.18)",
        ...style,
      }}
    >
      {image ? <img src={image.url} alt="" className="h-full w-full object-fill" draggable={false} /> : <div className="h-full w-full animate-pulse bg-gray-100" />}
    </div>
  );
}

// A folded card built from two CSS-3D leaves hinged at the spine:
//   cover leaf: Front on its face, Inside Left on its reverse — swings open
//   base leaf:  Inside Right on its face, Back on its reverse — stays put
// Turning the whole card over shows the Back. Preview only: this never
// touches the panels or the print output.
function FoldedCard({ card, images, view, size, reducedMotion }) {
  const img = (panel) => (card.panels[panel] ? images[card.panels[panel].id] : null);
  const isOpen = view === "open";
  const turned = view === "back";
  const transition = reducedMotion ? "none" : "transform 900ms cubic-bezier(0.4, 0.1, 0.2, 1)";
  return (
    <div className="flex items-center justify-center" style={{ perspective: 2000, height: size.height + 40, width: "100%" }}>
      <div
        className="relative"
        style={{
          width: size.width,
          height: size.height,
          transformStyle: "preserve-3d",
          transition,
          transform: `translateX(${isOpen ? size.width / 2 : 0}px) rotateX(3deg) rotateY(${turned ? 180 : isOpen ? 0 : -12}deg)`,
        }}
      >
        <div className="absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
          <Face image={img("insideRight")} />
          <Face image={img("back")} flipped />
        </div>
        <div
          className="absolute inset-0"
          style={{
            transformStyle: "preserve-3d",
            transformOrigin: "left center",
            transition,
            transform: `rotateY(${isOpen ? -180 : 0}deg) translateZ(1px)`,
          }}
        >
          <Face image={img("front")} />
          <Face image={img("insideLeft")} flipped />
        </div>
      </div>
    </div>
  );
}

function useCardSize(card, isOpen) {
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    if (!isOpen) return undefined;
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isOpen]);
  const front = card?.panels.front;
  const aspect = front ? front.width / front.height : 0.65;
  // Sized so the OPEN card (two panels wide) still fits, so switching
  // views never resizes the card.
  const maxWidthForOpen = Math.min(900, viewport.w - 64) / 2;
  const height = Math.max(160, Math.min(440, viewport.h * 0.5, maxWidthForOpen / aspect));
  return { width: Math.round(height * aspect), height: Math.round(height) };
}

export default function CardPreviewDialog({ isOpen, onClose, card, items }) {
  const { language } = useLanguage();
  const t = PRINT_STRINGS[language].preview;
  const { reducedMotion } = useReducedMotion();
  const [view, setView] = useState("front");
  const { images, status } = usePanelImages(card, items, isOpen);
  const plan = useMemo(() => (card ? buildPrintPlan(card) : null), [card]);
  const size = useCardSize(card, isOpen);

  const [variantIndex, setVariantIndex] = useState(0);
  const [mockup, setMockup] = useState({ status: "idle", url: null, error: null });
  const mockupUrlRef = useRef(null);

  useEffect(() => {
    if (isOpen) setView("front");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Photo mockups are composited on demand, from the same lightweight panel
  // images as everything else in this dialog.
  useEffect(() => {
    if (!isOpen || view !== "mockup" || status !== "done" || !card) return undefined;
    let cancelled = false;
    setMockup((m) => ({ ...m, status: "rendering", error: null }));
    (async () => {
      try {
        const panels = {};
        for (const key of card.panelOrder) {
          const image = images[card.panels[key].id];
          // eslint-disable-next-line no-await-in-loop
          if (image) panels[key] = await loadImage(image.url);
        }
        const backgrounds = Object.fromEntries(card.panelOrder.map((key) => [key, card.panels[key].background]));
        const canvas = await GREETING_CARD_MOCKUP_VARIANTS[variantIndex].generate(panels, backgrounds);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
        canvas.width = 0;
        canvas.height = 0;
        if (cancelled || !blob) return;
        if (mockupUrlRef.current) URL.revokeObjectURL(mockupUrlRef.current);
        mockupUrlRef.current = URL.createObjectURL(blob);
        setMockup({ status: "done", url: mockupUrlRef.current, error: null });
      } catch (err) {
        if (!cancelled) setMockup({ status: "error", url: null, error: err?.message || t.error });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, view, status, images, variantIndex]);

  useEffect(() => {
    if (isOpen) return;
    if (mockupUrlRef.current) URL.revokeObjectURL(mockupUrlRef.current);
    mockupUrlRef.current = null;
    setMockup({ status: "idle", url: null, error: null });
  }, [isOpen]);

  if (!isOpen || !card || !plan) return null;

  const viewLabels = { front: t.front, open: t.open, back: t.back, sheet: t.sheet, mockup: t.mockup };
  const variantCount = GREETING_CARD_MOCKUP_VARIANTS.length;
  const is3d = view === "front" || view === "open" || view === "back";

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-preview-title"
        className="flex h-full w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5">
          <h2 id="card-preview-title" className="text-base font-semibold text-gray-900">
            {t.title}
          </h2>
          <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label={t.closeAria}>
            <X size={18} />
          </button>
        </div>

        <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-gray-100 px-4 py-2">
          {VIEWS.map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${view === v ? "bg-amber-100 text-amber-800" : "text-gray-500 hover:bg-gray-100"}`}
              onClick={() => setView(v)}
            >
              {viewLabels[v]}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-gray-100 px-4 py-6">
          {status === "error" ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-red-600">
              <AlertTriangle size={22} />
              <span className="text-sm">{t.error}</span>
            </div>
          ) : is3d ? (
            <div className="flex flex-col items-center gap-4">
              <FoldedCard card={card} images={images} view={view} size={size} reducedMotion={reducedMotion} />
              <div className="flex flex-col items-center gap-1.5">
                {view !== "back" && (
                  <button
                    className="flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:text-amber-700"
                    onClick={() => setView(view === "open" ? "front" : "open")}
                  >
                    <BookOpen size={15} /> {view === "open" ? t.closeCard : t.openCard}
                  </button>
                )}
                <p className="text-[11px] text-gray-400">{status === "rendering" ? t.rendering : t.previewOnly}</p>
              </div>
            </div>
          ) : view === "sheet" ? (
            <div className="mx-auto max-w-2xl">
              <SheetPreview plan={plan} images={images} loading={status === "rendering"} />
            </div>
          ) : (
            <div className="relative mx-auto flex min-h-[280px] max-w-3xl items-center justify-center overflow-hidden rounded-xl bg-white">
              {(mockup.status === "rendering" || status === "rendering") && (
                <div className="flex flex-col items-center gap-2 py-16 text-gray-500">
                  <Loader2 size={22} className="animate-spin" />
                  <span className="text-sm">{t.mockupRendering}</span>
                </div>
              )}
              {mockup.status === "error" && (
                <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-red-600">
                  <AlertTriangle size={22} />
                  <span className="text-sm">{mockup.error}</span>
                </div>
              )}
              {mockup.status === "done" && mockup.url && <img src={mockup.url} alt={t.mockup} className="max-h-[60vh] w-full object-contain" />}
              {variantCount > 1 && (
                <>
                  <button
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-gray-700 shadow hover:bg-white"
                    onClick={() => setVariantIndex((i) => (i - 1 + variantCount) % variantCount)}
                    aria-label={t.previousScene}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-gray-700 shadow hover:bg-white"
                    onClick={() => setVariantIndex((i) => (i + 1) % variantCount)}
                    aria-label={t.nextScene}
                  >
                    <ChevronRight size={18} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {view === "mockup" && mockup.status === "done" && mockup.url && (
          <div className="flex justify-end border-t border-gray-200 px-5 py-3">
            <a
              href={mockup.url}
              download="greeting-card-mockup.jpg"
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
            >
              <Download size={16} /> {t.download}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
