import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, Maximize2, X } from "lucide-react";
import { useLanguage } from "../languageContext";
import { BOOK_STRINGS } from "../i18n/books";
import { BOOK_TYPES, bookExampleImageUrl, bookTypeAllowsWholePage, bookTypeHasSpine, getBookType } from "../mockup/bookMockup";

// Home → Book: every book type (mockup/bookMockup.js) with its example
// photo and its trim sizes; picking a size starts a new cover project.
// Tapping an example photo opens it larger on top of the picker. After a
// size is picked, every type but the spiral ones asks for the cover layout:
// one whole page (back, spine and front side by side) or separate pages.
export default function BookTypePicker({ isOpen, onClose, onCreate }) {
  const { language } = useLanguage();
  const t = BOOK_STRINGS[language];
  const [enlargedTypeId, setEnlargedTypeId] = useState(null);
  // The size picked for a type that still needs its cover layout chosen.
  const [pendingSize, setPendingSize] = useState(null);
  // Read by the Escape handler, which stays registered for as long as the
  // picker is open (re-registering it whenever these change could miss the
  // first key press after a change).
  const enlargedTypeIdRef = useRef(null);
  enlargedTypeIdRef.current = enlargedTypeId;
  const pendingSizeRef = useRef(null);
  pendingSizeRef.current = pendingSize;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) {
      setEnlargedTypeId(null);
      setPendingSize(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    // Escape closes the enlarged image first, then the layout choice, then
    // the picker.
    const handleKey = (e) => {
      if (e.key !== "Escape") return;
      if (enlargedTypeIdRef.current) setEnlargedTypeId(null);
      else if (pendingSizeRef.current) setPendingSize(null);
      else onCloseRef.current();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  if (!isOpen) return null;
  return (
    <div className="preview-safe-pad fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-picker-title"
        className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-3.5">
          <div>
            <h2 id="book-picker-title" className="text-base font-semibold text-gray-900">
              {t.picker.title}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">{t.picker.subtitle}</p>
          </div>
          <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label={t.picker.closeAria}>
            <X size={18} />
          </button>
        </div>
        <ul className="grid auto-rows-max grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2 lg:grid-cols-3">
          {BOOK_TYPES.map((type) => {
            const name = t.types[type.id];
            return (
              <li key={type.id} className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
                <button
                  className="group relative block w-full cursor-zoom-in"
                  onClick={() => setEnlargedTypeId(type.id)}
                  aria-label={t.picker.enlargeAria(name)}
                  title={t.picker.enlargeAria(name)}
                >
                  <img src={bookExampleImageUrl(type.id)} alt={t.picker.exampleAlt(name)} className="aspect-[16/10] w-full bg-white object-contain" loading="lazy" />
                  <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow-sm ring-1 ring-gray-200 group-hover:text-amber-700">
                    <Maximize2 size={15} />
                  </span>
                </button>
                <div className="flex flex-col gap-2 border-t border-gray-100 p-3">
                  <span className="text-sm font-semibold text-gray-900">{name}</span>
                  {!bookTypeHasSpine(type) && <span className="-mt-1.5 text-[11px] text-gray-400">{t.picker.noSpine}</span>}
                  <div className="flex flex-wrap gap-1.5">
                    {type.sizes.map((trim) => (
                      <button
                        key={trim.id}
                        className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
                        onClick={() =>
                          bookTypeAllowsWholePage(type) ? setPendingSize({ typeId: type.id, sizeId: trim.id, sizeLabel: trim.label }) : onCreate(type.id, trim.id, "separate")
                        }
                        aria-label={t.picker.sizeAria(name, trim.label)}
                      >
                        {trim.label}
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {pendingSize && <LayoutChoice pending={pendingSize} t={t} onBack={() => setPendingSize(null)} onChoose={(layout) => onCreate(pendingSize.typeId, pendingSize.sizeId, layout)} />}

      {enlargedTypeId && (
        <div
          className="preview-safe-pad fixed inset-0 z-[60] flex items-center justify-center bg-black/80"
          role="presentation"
          onClick={(e) => {
            e.stopPropagation();
            setEnlargedTypeId(null);
          }}
        >
          <img
            src={bookExampleImageUrl(enlargedTypeId)}
            alt={t.picker.exampleAlt(t.types[enlargedTypeId])}
            className="max-h-full max-w-full rounded-xl bg-white object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute right-[max(1rem,var(--safe-right))] top-[max(1rem,var(--safe-top))] flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow hover:bg-white"
            onClick={(e) => {
              e.stopPropagation();
              setEnlargedTypeId(null);
            }}
            aria-label={t.picker.closeImageAria}
          >
            <X size={20} />
          </button>
        </div>
      )}
    </div>
  );
}

// Step two, after a size is picked: one whole page or separate pages, each
// shown as a small diagram of the pages it makes.
function LayoutChoice({ pending, t, onBack, onChoose }) {
  const type = getBookType(pending.typeId);
  const hasSpine = bookTypeHasSpine(type);
  const box = "flex items-center justify-center border border-gray-300 text-[9px] font-semibold text-gray-500";
  const cover = `${box} bg-white`;
  const options = [
    {
      key: "wrap",
      label: t.picker.wholePage,
      hint: t.picker.wholePageHint(hasSpine),
      diagram: (
        <div className="flex h-14">
          <div className={`${cover} w-10`}>{t.pages.back}</div>
          {hasSpine && <div className={`${box} w-3 border-x-0 bg-gray-200`} />}
          <div className={`${cover} w-10`}>{t.pages.front}</div>
        </div>
      ),
    },
    {
      key: "separate",
      label: t.picker.separatePages,
      hint: t.picker.separatePagesHint(hasSpine),
      diagram: (
        <div className="flex h-14 items-center gap-1.5">
          <div className={`${cover} h-14 w-10`}>{t.pages.front}</div>
          <div className={`${cover} h-14 w-10`}>{t.pages.back}</div>
          {hasSpine && <div className={`${box} h-3 w-14 bg-gray-200`}>{t.pages.spine}</div>}
        </div>
      ),
    },
  ];
  return (
    <div
      className="preview-safe-pad fixed inset-0 z-[55] flex items-center justify-center bg-black/40"
      role="presentation"
      onClick={(e) => {
        e.stopPropagation();
        onBack();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-layout-title"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start gap-2">
          <button className="-ml-1.5 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onBack} aria-label={t.picker.backAria}>
            <ChevronLeft size={18} />
          </button>
          <div>
            <h3 id="book-layout-title" className="text-base font-semibold text-gray-900">
              {t.picker.layoutQuestion}
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {t.types[pending.typeId]} · {pending.sizeLabel}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {options.map((option) => (
            <button
              key={option.key}
              className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 p-4 text-center transition-colors hover:border-amber-400 hover:bg-amber-50/40"
              onClick={() => onChoose(option.key)}
            >
              <div aria-hidden="true">{option.diagram}</div>
              <span className="text-sm font-semibold text-gray-900">{option.label}</span>
              <span className="text-xs text-gray-500">{option.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
