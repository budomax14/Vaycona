import React, { useEffect, useRef } from "react";
import { FileImage, MoreHorizontal } from "lucide-react";
import ThumbnailStage from "../LeftSidebar/panels/ThumbnailStage";
import { usePageThumbnails } from "../LeftSidebar/panels/usePageThumbnails";
import { useLanguage } from "../../languageContext";
import { MOBILE_STRINGS } from "../../i18n/mobile";
import { useBreakpoint } from "../../useBreakpoint";

const THUMB_WIDTH = 72;
const THUMB_HEIGHT = 54;
const THUMB_GAP = 8;
// Room for 4 thumbnails at a time (plus the strip's padding and border);
// any more pages scroll sideways.
const STRIP_MAX_WIDTH = THUMB_WIDTH * 4 + THUMB_GAP * 3 + 16 + 2;

// A "..." button in the canvas area's bottom-right corner that toggles a
// row of small page thumbnails along the bottom of the canvas, for jumping
// between pages. Closed by default; the parent closes it (via `open`) as
// soon as the user starts editing the canvas.
export default function PageStrip({ pages, items, activePageId, onActivatePage, open, onToggle }) {
  const { language } = useLanguage();
  const t = MOBILE_STRINGS[language].pageStrip;
  // Phones start the strip at the left edge; tablet/desktop tuck it in
  // right beside the "..." button.
  const { isMobile } = useBreakpoint();
  // Thumbnails are only rendered while the strip is showing.
  const { thumbnails, renderingPageId, handleCapture } = usePageThumbnails(pages, items, { enabled: open });
  const activeRef = useRef(null);

  useEffect(() => {
    if (open) activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [open, activePageId]);

  const renderingPage = renderingPageId ? pages.find((p) => p.id === renderingPageId) : null;

  return (
    <>
      {open && (
        <div
          className={`phone-pop-enter absolute bottom-2 ${isMobile ? "left-2" : "right-14"} z-20 flex gap-2 overflow-x-auto rounded-xl border border-gray-200 bg-white/95 p-2 shadow-lg backdrop-blur`}
          // Sits beside the "..." button, never under it.
          style={{ maxWidth: `min(${STRIP_MAX_WIDTH}px, calc(100% - 4rem))` }}
          role="toolbar"
          aria-label={t.aria}
        >
          {pages.map((page, index) => {
            const isActive = page.id === activePageId;
            const url = thumbnails.get(page.id);
            return (
              <button
                key={page.id}
                ref={isActive ? activeRef : null}
                type="button"
                className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 bg-white ${
                  isActive ? "border-amber-500" : "border-gray-200"
                }`}
                style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
                onClick={() => onActivatePage(page.id)}
                aria-label={t.goTo(index + 1)}
                aria-current={isActive ? "page" : undefined}
              >
                {url ? <img src={url} alt="" className="h-full w-full object-contain" /> : <FileImage size={16} className="text-gray-300" />}
                <span className="absolute bottom-0.5 left-0.5 rounded bg-gray-900/70 px-1 text-[9px] font-semibold leading-tight text-white">{index + 1}</span>
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        className={`absolute bottom-2 right-2 z-20 flex h-10 w-10 items-center justify-center rounded-full border shadow-sm transition-colors active:scale-95 ${
          open ? "border-amber-300 bg-amber-100 text-amber-700" : "border-gray-200 bg-white/90 text-gray-700 hover:bg-white"
        }`}
        onClick={onToggle}
        aria-pressed={open}
        aria-label={open ? t.hide : t.toggle}
        title={open ? t.hide : t.toggle}
      >
        <MoreHorizontal size={20} />
      </button>

      {open && renderingPage && (
        <div style={{ position: "fixed", left: -9999, top: -9999 }} aria-hidden="true">
          <ThumbnailStage
            key={renderingPage.id}
            page={renderingPage}
            items={items}
            width={THUMB_WIDTH * 2}
            height={THUMB_HEIGHT * 2}
            onCapture={(url) => handleCapture(renderingPage.id, url)}
          />
        </div>
      )}
    </>
  );
}
