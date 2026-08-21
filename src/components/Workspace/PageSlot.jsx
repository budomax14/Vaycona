import React from "react";
import { Plus } from "lucide-react";
import InactivePagePreview from "./InactivePagePreview";

export default function PageSlot({ page, pageIndex, isActive, scale, items, onActivate, onAddPage, children }) {
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
          title={`Activate ${page.name || `Page ${pageIndex + 1}`}`}
          aria-label={`Activate ${page.name || `Page ${pageIndex + 1}`}`}
        >
          {items && (
            <InactivePagePreview
              page={page}
              items={items}
              width={page.width * scale}
              height={page.height * scale}
            />
          )}
        </button>
      )}
      <span className="mt-2 text-xs font-medium text-gray-500">
        {page.name || `Page ${pageIndex + 1}`}
      </span>
      {onAddPage && (
        <button
          type="button"
          className="relative z-10 mt-2 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 transition-colors hover:border-amber-400 hover:text-amber-600"
          onClick={onAddPage}
          title="Add page"
          aria-label={`Add page after ${page.name || `Page ${pageIndex + 1}`}`}
        >
          <Plus size={13} />
        </button>
      )}
    </div>
  );
}
