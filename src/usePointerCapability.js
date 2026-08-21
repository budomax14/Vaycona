import { useEffect, useState } from "react";

// Physical input capability, independent of viewport width — a touch laptop
// at a wide viewport should still get finger-sized handles/targets, and a
// narrow desktop browser window (e.g. devtools open) should not. Drives
// touch-target sizing (Phase 4) and Transformer handle hit-area sizing
// (Phase 5), never editor layout tier (see useBreakpoint.js for that).
function readCapability() {
  if (typeof window === "undefined") {
    return { hasTouch: false, hasCoarsePointer: false, hasFinePointer: true };
  }
  const hasCoarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const hasFinePointer = window.matchMedia?.("(pointer: fine)").matches ?? true;
  const hasTouch = hasCoarsePointer || "ontouchstart" in window || navigator.maxTouchPoints > 0;
  return { hasTouch, hasCoarsePointer, hasFinePointer };
}

export function usePointerCapability() {
  const [capability, setCapability] = useState(readCapability);

  useEffect(() => {
    const mql = window.matchMedia("(pointer: coarse)");
    function handleChange() {
      setCapability(readCapability());
    }
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  return capability;
}
