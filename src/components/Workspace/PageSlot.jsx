import React from "react";
import InactivePagePreview from "./InactivePagePreview";

export default function PageSlot({ page, pageIndex, isActive, scale, items, onActivate, children }) {
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
    </div>
  );
}
