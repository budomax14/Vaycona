import { useEffect, useState } from "react";
import { isFontResolved, loadFont } from "./fontLibrary";

// Loads a font on demand (not at app startup) and reports readiness so a
// renderer can re-measure/redraw once real metrics are available — canvas
// silently falls back to a default font at draw time with no error if the
// named font isn't loaded yet, which is what causes permanent-wrong-
// metrics/invisible-text bugs if this isn't accounted for.
export function useFontLoader(fontFamily) {
  const [ready, setReady] = useState(() => isFontResolved(fontFamily));

  useEffect(() => {
    if (isFontResolved(fontFamily)) {
      setReady(true);
      return undefined;
    }
    setReady(false);
    let cancelled = false;
    loadFont(fontFamily).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [fontFamily]);

  return ready;
}

// Same as above but for a whole set of font families at once (used by
// RichTextNode, which may reference several fontFamily values across runs).
export function useFontsLoaded(fontFamilies) {
  const [readyMap, setReadyMap] = useState({});

  useEffect(() => {
    let cancelled = false;
    fontFamilies.forEach((name) => {
      if (isFontResolved(name)) {
        setReadyMap((prev) => (prev[name] ? prev : { ...prev, [name]: true }));
        return;
      }
      loadFont(name).then(() => {
        if (!cancelled) setReadyMap((prev) => ({ ...prev, [name]: true }));
      });
    });
    return () => {
      cancelled = true;
    };
  }, [fontFamilies.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  return fontFamilies.every((name) => readyMap[name] || isFontResolved(name));
}
