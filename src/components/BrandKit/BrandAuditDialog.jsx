import React, { useMemo } from "react";
import BrandModal from "./BrandModal";
import { useBrandKits } from "../../brandKitContext";
import { runBrandAudit, summarizeAuditForDisplay } from "../../brandAudit";
import { useLanguage } from "../../languageContext";
import { MISC_STRINGS } from "../../i18n/misc";

// Read-only Brand Audit report (spec §64) — fixes are separate, explicit,
// confirmed actions (spec §65); this dialog surfaces findings and lets the
// caller decide what to apply through the normal commit()/history path.
export default function BrandAuditDialog({ isOpen, onClose, items, pages, onSelectUsages }) {
  const { activeBrandKit } = useBrandKits();
  const { language } = useLanguage();
  const t = MISC_STRINGS[language].brandAudit;
  const findings = useMemo(() => (isOpen ? runBrandAudit({ items, pages }, activeBrandKit) : null), [isOpen, items, pages, activeBrandKit]);
  const summary = findings ? summarizeAuditForDisplay(findings) : [];

  return (
    <BrandModal isOpen={isOpen} onClose={onClose} title={t.title} subtitle={t.subtitle} width="max-w-xl">
      {!activeBrandKit && <p className="mb-3 text-xs text-amber-600">{t.noActiveBrandKit}</p>}

      <div className="mb-3 grid grid-cols-2 gap-2">
        {summary.map((row) => (
          <div key={row.label} className="rounded-lg border border-gray-200 px-3 py-2">
            <p className="text-lg font-bold text-gray-900">{row.count}</p>
            <p className="text-xs text-gray-500">{row.label}</p>
          </div>
        ))}
      </div>

      {findings && (
        <div className="space-y-3 text-sm">
          {findings.missingFonts.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{t.missingFonts}</p>
              <ul className="space-y-0.5 text-xs text-gray-600">
                {findings.missingFonts.map((f) => <li key={f.fontFamily}>{f.fontFamily} {t.objectCount(f.count)}</li>)}
              </ul>
            </div>
          )}
          {findings.nonBrandColors.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{t.nonBrandColors}</p>
              <div className="flex flex-wrap gap-1.5">
                {findings.nonBrandColors.slice(0, 16).map((c) => (
                  <span key={c.hex} className="flex items-center gap-1 rounded-lg border border-gray-200 px-1.5 py-0.5 text-[11px]">
                    <span className="h-3 w-3 rounded-full border border-gray-200" style={{ backgroundColor: c.hex }} /> {c.hex}
                  </span>
                ))}
              </div>
            </div>
          )}
          {findings.contrastWarnings.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{t.lowContrastText}</p>
              <ul className="space-y-0.5 text-xs text-gray-600">
                {findings.contrastWarnings.slice(0, 10).map((w) => (
                  <li key={w.itemId} className="flex items-center justify-between">
                    <span>{t.ratioLabel(w)}</span>
                    {onSelectUsages && (
                      <button className="text-amber-600 hover:underline" onClick={() => onSelectUsages(w.pageId, [w.itemId])}>{t.select}</button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {findings.stretchedLogos.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{t.stretchedLogos}</p>
              <ul className="space-y-0.5 text-xs text-gray-600">
                {findings.stretchedLogos.map((w) => (
                  <li key={w.itemId} className="flex items-center justify-between">
                    <span>{t.expectedActualRatio(w)}</span>
                    {onSelectUsages && (
                      <button className="text-amber-600 hover:underline" onClick={() => onSelectUsages(w.pageId, [w.itemId])}>{t.select}</button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {findings.lowResolutionLogos.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{t.lowResolutionLogos}</p>
              <p className="text-xs text-gray-600">{t.lowResolutionLogosCount(findings.lowResolutionLogos.length)}</p>
            </div>
          )}
          {findings.detachedStyles.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{t.detachableBrandText}</p>
              <p className="text-xs text-gray-600">{t.detachedStylesCount(findings.detachedStyles.length)}</p>
            </div>
          )}
        </div>
      )}
    </BrandModal>
  );
}
