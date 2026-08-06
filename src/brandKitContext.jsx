import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  listBrandKitSummaries,
  getBrandKitById,
  getActiveBrandKitId,
  setActiveBrandKitId as persistActiveBrandKitId,
  brandKitEvents,
} from "./brandKitService";

const BrandKitContext = createContext(null);

// One shared, live cache of brand-kit metadata + the currently-active
// kit's full payload — spec §88 ("services are stable and not recreated
// per render"; "opening the editor does not load all brand kits" beyond
// their lightweight summaries). Every brand-aware component (sidebar
// panel, ColorField, style pickers, dialogs) reads from here instead of
// each independently hitting IndexedDB.
export function BrandKitProvider({ children }) {
  const [summaries, setSummaries] = useState([]);
  const [activeBrandKit, setActiveBrandKit] = useState(null);
  const [activeBrandKitId, setActiveBrandKitIdState] = useState(getActiveBrandKitId);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const [list, id] = [await listBrandKitSummaries(), getActiveBrandKitId()];
    setSummaries(list);
    setActiveBrandKitIdState(id);
    if (id) {
      const full = await getBrandKitById(id);
      setActiveBrandKit(full || null);
    } else {
      setActiveBrandKit(null);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
    return brandKitEvents.subscribe(refresh);
  }, [refresh]);

  const setActive = useCallback((id) => {
    persistActiveBrandKitId(id);
  }, []);

  return (
    <BrandKitContext.Provider value={{ summaries, activeBrandKit, activeBrandKitId, setActiveBrandKitId: setActive, refresh, loaded }}>
      {children}
    </BrandKitContext.Provider>
  );
}

export function useBrandKits() {
  const ctx = useContext(BrandKitContext);
  if (!ctx) throw new Error("useBrandKits must be used within a BrandKitProvider");
  return ctx;
}
