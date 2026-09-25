import React, { createContext, useContext, useEffect, useState } from "react";

// App-wide light/dark preference (distinct from the per-design "brand theme"
// concept in themeApply.js). Persisted so it carries across the Home page,
// editor, and admin — dark mode itself is implemented in index.css by
// remapping Tailwind's gray/white CSS variables under a `.dark` class on
// <html>, so most components need zero per-component dark: styling.
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("appTheme") || "light";
    } catch {
      return "light"; // storage blocked (Safari "Block all cookies")
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("appTheme", theme);
    } catch {
      // Storage full/blocked — the theme still applies for this session.
    }
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return { ...ctx, isDark: ctx.theme === "dark" };
}
