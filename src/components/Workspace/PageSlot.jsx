import React from "react";
import InactivePagePreview from "./InactivePagePreview";
import { useLanguage } from "../../languageContext";
import { PANEL_STRINGS } from "../../i18n/panels";

export default function PageSlot({ page, pageIndex, isActive, scale, items, pageNumbers, onActivate, children, previewImageUrl, staticPreviewOnly = false }) {
  const { language } = useLanguage();
  const t = PANEL_STRINGS[language].pages;
  const pageName = page.name || t.pageDefaultName(pageIndex + 1);
  return (
    <div className="flex flex-col items-center">
      {isActive ? (
        <div className="relative rounded-sm">
          {children}
        </div>
      ) : (
        <button
          className="relative cursor-pointer overflow-hidden border border-gray-300 bg-white shadow-md transition-shadow hover:shadow-lg"
          style={{ width: page.width * scale, height: page.height * scale }}
          onClick={onActivate}
          title={t.activateAria(pageName)}
          aria-label={t.activateAria(pageName)}
        >
          {previewImageUrl ? (
            // iOS-only static preview (see Workspace.jsx) — a plain <img>,
            // not a live Konva Stage/canvas, so switching between pages
            // doesn't keep every page's own GPU-backed canvas alive at
            // once. Falls back to the real live preview below until the
            // first capture for this page is ready.
            <img
              src={previewImageUrl}
              alt=""
              draggable={false}
              style={{ width: page.width * scale, height: page.height * scale, display: "block", objectFit: "contain" }}
            />
          ) : staticPreviewOnly ? null : (
            items && (
              <InactivePagePreview
                page={page}
                items={items}
                width={page.width * scale}
                height={page.height * scale}
                pageNumber={pageIndex + 1}
                numberPosition={pageNumbers?.enabled ? pageNumbers.position : null}
              />
            )
          )}
        </button>
      )}
    </div>
  );
}
