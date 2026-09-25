import React, { createContext, useContext, useEffect, useState } from "react";

// App-wide language preference (English/French), shared by the Home page
// and the editor's top nav — the two chrome surfaces every page shares.
// Deep editor panels/toolbars aren't covered yet; see STRINGS in i18n.js
// for exactly what's translated so far.
const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem("appLanguage") || "en";
    } catch {
      return "en"; // storage blocked (Safari "Block all cookies")
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("appLanguage", language);
    } catch {
      // Storage full/blocked — the language still applies for this session.
    }
  }, [language]);

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
