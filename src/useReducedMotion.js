import { useCallback, useState } from "react";
import { useMediaQuery } from "./useMediaQuery";
import { loadReducedMotionOverride, saveReducedMotionOverride } from "./animation/reducedMotionPreferences";

// Combines the OS's prefers-reduced-motion signal with the user's explicit
// in-app override (spec §53) into one effective boolean, reusing the
// existing useMediaQuery hook rather than a second matchMedia listener.
export function useReducedMotion() {
  const systemPrefers = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [override, setOverrideState] = useState(loadReducedMotionOverride);

  const setOverride = useCallback((value) => {
    setOverrideState(value);
    saveReducedMotionOverride(value);
  }, []);

  const effective = override === "on" ? true : override === "off" ? false : systemPrefers;
  return { reducedMotion: effective, override, setOverride, systemPrefers };
}
