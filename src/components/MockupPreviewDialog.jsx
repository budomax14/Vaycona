import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Loader2, X } from "lucide-react";
import { renderPageToCanvas } from "../export/offscreenRenderer";
import { runExportPreflight, preloadExportFonts } from "../export/exportPreflight";
import { findMockupForPages } from "../mockup/mockupRegistry";
import { useLanguage } from "../languageContext";
import { DIALOG_STRINGS } from "../i18n/dialogs";

const MOCKUP_PIXEL_SCALE = 3;

export default function MockupPreviewDialog({ isOpen, onClose, pages, items }) {
  const { language } = useLanguage();
  const t = DIALOG_STRINGS[language].mockupPreviewDialog;
  const [status, setStatus] = useState("idle");
  const [imageUrl, setImageUrl] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [variantIndex, setVariantIndex] = useState(0);
  const objectUrlRef = useRef(null);

  const mockup = findMockupForPages(pages);
  const frontPage = mockup?.pages[0] || null;
  const backPage = mockup?.pages[1] || mockup?.pages[0] || null;
  const variants = mockup?.variants || [];
  const variantCount = variants.length;

  // A fresh open (or switching to a project with a different mockup type)
  // always starts back at the first staged scene.
  useEffect(() => {
    if (isOpen) setVariantIndex(0);
  }, [isOpen, frontPage?.id]);

  useEffect(() => {
    if (!isOpen || !frontPage) return undefined;
    const variant = variants[variantIndex];
    if (!variant) return undefined;
    const controller = new AbortController();
    let cancelled = false;
    setStatus("rendering");
    setErrorMessage(null);

    (async () => {
      try {
        const pageIds = [...new Set([frontPage.id, backPage.id])];
        const preflight = await runExportPreflight({ pages, items }, { pageIds, pixelScale: MOCKUP_PIXEL_SCALE });
        await preloadExportFonts(preflight.fontFamilies);

        const renderOne = (page) =>
          renderPageToCanvas({
            page,
            items,
            pixelScale: MOCKUP_PIXEL_SCALE,
            backgroundFill: page.background || "#ffffff",
            availableAssetIds: preflight.availableAssetIds,
            signal: controller.signal,
          });

        const [frontCanvas, backCanvas] = await Promise.all([renderOne(frontPage), renderOne(backPage)]);
        const mockupCanvas = await variant.generate({ frontCanvas, backCanvas });
        if (cancelled) return;

        const blob = await new Promise((resolve) => mockupCanvas.toBlob(resolve, "image/png"));
        if (cancelled || !blob) return;
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setImageUrl(url);
        setStatus("done");
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(err?.message || t.errorGeneric);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, frontPage?.id, backPage?.id, variantIndex]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    []
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const goPrev = () => setVariantIndex((i) => (i - 1 + variantCount) % variantCount);
  const goNext = () => setVariantIndex((i) => (i + 1) % variantCount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mockup-preview-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 id="mockup-preview-title" className="text-base font-semibold text-gray-900">
            {t.title}
          </h2>
          <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label={t.closeAria}>
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {!frontPage ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <AlertTriangle size={22} className="text-amber-500" />
              <p className="text-sm font-medium text-gray-900">{t.unavailableTitle}</p>
              <p className="text-sm text-gray-500">{t.unavailableDescription}</p>
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm text-gray-500">{t.description}</p>
              <div className="relative flex min-h-[280px] items-center justify-center overflow-hidden rounded-xl bg-gray-50">
                {status === "rendering" && (
                  <div className="flex flex-col items-center gap-2 py-10 text-gray-500">
                    <Loader2 size={22} className="animate-spin" />
                    <span className="text-sm">{t.rendering}</span>
                  </div>
                )}
                {status === "error" && (
                  <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-red-600">
                    <AlertTriangle size={22} />
                    <span className="text-sm">{errorMessage}</span>
                  </div>
                )}
                {status === "done" && imageUrl && <img src={imageUrl} alt={t.title} className="max-h-[60vh] w-full object-contain" />}

                {variantCount > 1 && (
                  <>
                    <button
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-gray-700 shadow hover:bg-white"
                      onClick={goPrev}
                      aria-label={t.previousStyle}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-gray-700 shadow hover:bg-white"
                      onClick={goNext}
                      aria-label={t.nextStyle}
                    >
                      <ChevronRight size={18} />
                    </button>
                    <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                      {variants.map((variant, i) => (
                        <button
                          key={variant.id}
                          className={`h-1.5 w-1.5 rounded-full ${i === variantIndex ? "bg-amber-600" : "bg-white/80"}`}
                          onClick={() => setVariantIndex(i)}
                          aria-label={t.goToStyle(i + 1)}
                          aria-current={i === variantIndex}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
              {variantCount > 1 && <p className="mt-2 text-center text-xs text-gray-400">{t.styleCounter(variantIndex + 1, variantCount)}</p>}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
          <button className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100" onClick={onClose}>
            {t.close}
          </button>
          {status === "done" && imageUrl && (
            <a
              href={imageUrl}
              download="business-card-mockup.png"
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
            >
              <Download size={16} /> {t.download}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
