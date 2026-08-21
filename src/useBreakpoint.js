import { useMediaQuery } from "./useMediaQuery";

// Single source of truth for editor layout tiers, replacing the old ad-hoc
// `useMediaQuery("(max-width: 1024px)")` call. Width tiers only — device
// touch capability is a separate concern, see usePointerCapability.js.
//
// iPad landscape (1024x768) intentionally lands in "desktop" so it keeps as
// much of the full desktop layout as possible; iPad portrait (768) is the
// tablet/desktop boundary and lands in "tablet".
export function useBreakpoint() {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
  const isShort = useMediaQuery("(max-height: 500px)");
  const isDesktop = !isMobile && !isTablet;
  const tier = isMobile ? "mobile" : isTablet ? "tablet" : "desktop";

  return {
    tier,
    isMobile,
    isTablet,
    isDesktop,
    // Alias kept so existing call sites (App.jsx, LeftSidebar.jsx) that
    // already branch on "<1024px" don't need their prop contract touched.
    isCompact: isMobile || isTablet,
    isShort,
  };
}
