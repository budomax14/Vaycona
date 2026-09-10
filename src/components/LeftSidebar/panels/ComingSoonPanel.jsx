import React from "react";
import { useLanguage } from "../../../languageContext";
import { PANEL_STRINGS } from "../../../i18n/panels";

export default function ComingSoonPanel({ title }) {
  const { language } = useLanguage();
  const t = PANEL_STRINGS[language].comingSoon;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
        {t.comingSoon}
      </div>
    </div>
  );
}
