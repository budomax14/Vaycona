import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { RECENT_COLORS_KEY, RECENT_COLORS_MAX } from "./constants";

function loadRecentColors() {
  try {
    const raw = localStorage.getItem(RECENT_COLORS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const RecentColorsContext = createContext({ recentColors: [], recordColor: () => {} });

// Single source of truth for the recent-colors list, following the same
// dedicated-localStorage-key pattern already used for `uploads` — a
// cross-project browser preference, not per-design state. Every ColorField
// instance (fill/stroke/background/icon/frame — see toolbarUi.jsx) reads
// this same context, so picking a color anywhere updates the recent list
// everywhere else immediately, with no prop plumbing through every
// intermediate PropertiesToolbar/Bar component.
export function RecentColorsProvider({ children }) {
  const [recentColors, setRecentColors] = useState(loadRecentColors);

  useEffect(() => {
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(recentColors));
  }, [recentColors]);

  const recordColor = useCallback((hex) => {
    if (!hex) return;
    const normalized = hex.toLowerCase();
    setRecentColors((prev) => {
      const deduped = prev.filter((c) => c.toLowerCase() !== normalized);
      return [hex, ...deduped].slice(0, RECENT_COLORS_MAX);
    });
  }, []);

  return (
    <RecentColorsContext.Provider value={{ recentColors, recordColor }}>{children}</RecentColorsContext.Provider>
  );
}

export function useRecentColors() {
  return useContext(RecentColorsContext);
}
