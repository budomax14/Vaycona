import React, { createContext, useContext, useMemo } from "react";
import { collectDocumentColors } from "./styleUsage";

const DocumentColorsContext = createContext([]);

// "Document colors" (spec §12) are DERIVED from the live project, never a
// separately-persisted list — App.jsx wraps the editor with this provider
// so every ColorField instance can show what's actually in use without
// each one re-scanning `items` itself. Recomputed only when `items`
// changes (cheap: one pass over already-in-memory objects).
export function DocumentColorsProvider({ items, children }) {
  const documentColors = useMemo(() => collectDocumentColors(items).slice(0, 24), [items]);
  return <DocumentColorsContext.Provider value={documentColors}>{children}</DocumentColorsContext.Provider>;
}

export function useDocumentColors() {
  return useContext(DocumentColorsContext);
}
