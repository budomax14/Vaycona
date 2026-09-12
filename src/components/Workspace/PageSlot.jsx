import React from "react";
import { Plus } from "lucide-react";
import InactivePagePreview from "./InactivePagePreview";
import { useLanguage } from "../../languageContext";
import { PANEL_STRINGS } from "../../i18n/panels";

export default function PageSlot({ page, pageIndex, isActive, scale, items, pageNumbers, onActivate, onAddPage, children }) {
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
          {items && (
            <InactivePagePreview
              page={page}
              items={items}
              width={page.width * scale}
              height={page.height * scale}
              pageNumber={pageIndex + 1}
              numberPosition={pageNumbers?.enabled ? pageNumbers.position : null}
            />
          )}
        </button>
      )}
      <span className="mt-2 text-xs font-medium text-gray-500">
        {pageName}
      </span>
      {onAddPage && (
        <button
          type="button"
          className="relative z-10 mt-2 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 transition-colors hover:border-amber-400 hover:text-amber-600"
          onClick={onAddPage}
          title={t.addPage}
          aria-label={t.addPageAfterAria(pageName)}
        >
          <Plus size={13} />
        </button>
      )}
    </div>
  );
}
