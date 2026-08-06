// Centralized font catalog. System fonts resolve instantly (already
// available in every browser, zero network/bundle cost — these are the
// same 6 fonts Phase 2/3 already offered). The curated set below adds a
// small, properly-licensed (all SIL Open Font License) selection of
// self-hosted fonts via @fontsource — bundled locally, so there is no
// runtime network request, no third-party CDN privacy/availability
// dependency, and the app keeps working fully offline. This is a curated
// set (~60 fonts across sans/serif/display/monospace/handwritten), not a
// general font browser — each family is still lazy-loaded on demand (only
// when actually selected/rendered, via loadFont() below), and only the two
// weights actually used per family are imported, not every weight the
// family ships, so adding more families here has near-zero cost for users
// who never pick them.
function systemFont(name, cssStack) {
  return { name, category: "system", cssStack, load: () => Promise.resolve() };
}

function bundledFont(name, category, cssStack, importFn) {
  let importPromise = null;
  return {
    name,
    category,
    cssStack,
    load: () => {
      if (!importPromise) importPromise = importFn();
      return importPromise.then(() => document.fonts.load(`16px "${name}"`));
    },
  };
}

export const FONT_LIBRARY = [
  systemFont("Arial", "Arial, Helvetica, sans-serif"),
  systemFont("Verdana", "Verdana, Geneva, sans-serif"),
  systemFont("Trebuchet MS", '"Trebuchet MS", sans-serif'),
  systemFont("Georgia", "Georgia, serif"),
  systemFont("Times New Roman", '"Times New Roman", Times, serif'),
  systemFont("Courier New", '"Courier New", Courier, monospace'),

  bundledFont("Inter", "sans", '"Inter", sans-serif', () =>
    Promise.all([import("@fontsource/inter/400.css"), import("@fontsource/inter/700.css")])
  ),
  bundledFont("Poppins", "sans", '"Poppins", sans-serif', () =>
    Promise.all([import("@fontsource/poppins/400.css"), import("@fontsource/poppins/700.css")])
  ),
  bundledFont("Roboto", "sans", '"Roboto", sans-serif', () =>
    Promise.all([import("@fontsource/roboto/400.css"), import("@fontsource/roboto/700.css")])
  ),
  bundledFont("Montserrat", "sans", '"Montserrat", sans-serif', () =>
    Promise.all([import("@fontsource/montserrat/400.css"), import("@fontsource/montserrat/700.css")])
  ),
  bundledFont("Lato", "sans", '"Lato", sans-serif', () =>
    Promise.all([import("@fontsource/lato/400.css"), import("@fontsource/lato/700.css")])
  ),
  bundledFont("Nunito", "sans", '"Nunito", sans-serif', () =>
    Promise.all([import("@fontsource/nunito/400.css"), import("@fontsource/nunito/700.css")])
  ),
  bundledFont("Work Sans", "sans", '"Work Sans", sans-serif', () =>
    Promise.all([import("@fontsource/work-sans/400.css"), import("@fontsource/work-sans/700.css")])
  ),
  bundledFont("Open Sans", "sans", '"Open Sans", sans-serif', () =>
    Promise.all([import("@fontsource/open-sans/400.css"), import("@fontsource/open-sans/700.css")])
  ),
  bundledFont("Raleway", "sans", '"Raleway", sans-serif', () =>
    Promise.all([import("@fontsource/raleway/400.css"), import("@fontsource/raleway/700.css")])
  ),
  bundledFont("Ubuntu", "sans", '"Ubuntu", sans-serif', () =>
    Promise.all([import("@fontsource/ubuntu/400.css"), import("@fontsource/ubuntu/700.css")])
  ),
  bundledFont("Rubik", "sans", '"Rubik", sans-serif', () =>
    Promise.all([import("@fontsource/rubik/400.css"), import("@fontsource/rubik/700.css")])
  ),
  bundledFont("Quicksand", "sans", '"Quicksand", sans-serif', () =>
    Promise.all([import("@fontsource/quicksand/400.css"), import("@fontsource/quicksand/700.css")])
  ),
  bundledFont("DM Sans", "sans", '"DM Sans", sans-serif', () =>
    Promise.all([import("@fontsource/dm-sans/400.css"), import("@fontsource/dm-sans/700.css")])
  ),
  bundledFont("Manrope", "sans", '"Manrope", sans-serif', () =>
    Promise.all([import("@fontsource/manrope/400.css"), import("@fontsource/manrope/700.css")])
  ),
  bundledFont("Karla", "sans", '"Karla", sans-serif', () =>
    Promise.all([import("@fontsource/karla/400.css"), import("@fontsource/karla/700.css")])
  ),

  bundledFont("Playfair Display", "serif", '"Playfair Display", serif', () =>
    Promise.all([import("@fontsource/playfair-display/400.css"), import("@fontsource/playfair-display/700.css")])
  ),
  bundledFont("Merriweather", "serif", '"Merriweather", serif', () =>
    Promise.all([import("@fontsource/merriweather/400.css"), import("@fontsource/merriweather/700.css")])
  ),
  bundledFont("Lora", "serif", '"Lora", serif', () =>
    Promise.all([import("@fontsource/lora/400.css"), import("@fontsource/lora/700.css")])
  ),
  bundledFont("PT Serif", "serif", '"PT Serif", serif', () =>
    Promise.all([import("@fontsource/pt-serif/400.css"), import("@fontsource/pt-serif/700.css")])
  ),
  bundledFont("Cormorant Garamond", "serif", '"Cormorant Garamond", serif', () =>
    Promise.all([import("@fontsource/cormorant-garamond/400.css"), import("@fontsource/cormorant-garamond/700.css")])
  ),
  bundledFont("Libre Baskerville", "serif", '"Libre Baskerville", serif', () =>
    Promise.all([import("@fontsource/libre-baskerville/400.css"), import("@fontsource/libre-baskerville/700.css")])
  ),
  bundledFont("Crimson Text", "serif", '"Crimson Text", serif', () =>
    Promise.all([import("@fontsource/crimson-text/400.css"), import("@fontsource/crimson-text/700.css")])
  ),
  bundledFont("EB Garamond", "serif", '"EB Garamond", serif', () =>
    Promise.all([import("@fontsource/eb-garamond/400.css"), import("@fontsource/eb-garamond/700.css")])
  ),
  bundledFont("Bitter", "serif", '"Bitter", serif', () =>
    Promise.all([import("@fontsource/bitter/400.css"), import("@fontsource/bitter/700.css")])
  ),
  bundledFont("Noto Serif", "serif", '"Noto Serif", serif', () =>
    Promise.all([import("@fontsource/noto-serif/400.css"), import("@fontsource/noto-serif/700.css")])
  ),
  // Cinzel/Marcellus/Almendra: classic engraved-capital and old-book serif
  // faces — the diploma/certificate/award-style lettering most editors
  // reach for on formal documents (Cinzel in particular is the standard
  // free substitute for Trajan, the actual diploma-title face, which isn't
  // available as a webfont).
  bundledFont("Cinzel", "serif", '"Cinzel", serif', () =>
    Promise.all([import("@fontsource/cinzel/400.css"), import("@fontsource/cinzel/700.css")])
  ),
  bundledFont("Marcellus", "serif", '"Marcellus", serif', () => import("@fontsource/marcellus/400.css")),
  bundledFont("Almendra", "serif", '"Almendra", serif', () =>
    Promise.all([import("@fontsource/almendra/400.css"), import("@fontsource/almendra/700.css")])
  ),

  bundledFont("Bebas Neue", "display", '"Bebas Neue", sans-serif', () => import("@fontsource/bebas-neue/400.css")),
  bundledFont("Oswald", "display", '"Oswald", sans-serif', () =>
    Promise.all([import("@fontsource/oswald/400.css"), import("@fontsource/oswald/700.css")])
  ),
  bundledFont("Anton", "display", '"Anton", sans-serif', () => import("@fontsource/anton/400.css")),
  bundledFont("Archivo Black", "display", '"Archivo Black", sans-serif', () => import("@fontsource/archivo-black/400.css")),
  bundledFont("Righteous", "display", '"Righteous", sans-serif', () => import("@fontsource/righteous/400.css")),
  bundledFont("Bungee", "display", '"Bungee", sans-serif', () => import("@fontsource/bungee/400.css")),
  bundledFont("Fjalla One", "display", '"Fjalla One", sans-serif', () => import("@fontsource/fjalla-one/400.css")),
  bundledFont("Alfa Slab One", "display", '"Alfa Slab One", sans-serif', () => import("@fontsource/alfa-slab-one/400.css")),
  bundledFont("Staatliches", "display", '"Staatliches", sans-serif', () => import("@fontsource/staatliches/400.css")),
  // Blackletter/old-English — the "Ye Olde" gothic lettering on
  // old-fashioned diplomas, certificates, and awards.
  bundledFont("Cinzel Decorative", "display", '"Cinzel Decorative", serif', () =>
    Promise.all([import("@fontsource/cinzel-decorative/400.css"), import("@fontsource/cinzel-decorative/700.css")])
  ),
  bundledFont("UnifrakturMaguntia", "display", '"UnifrakturMaguntia", cursive', () =>
    import("@fontsource/unifrakturmaguntia/400.css")
  ),
  bundledFont("Pirata One", "display", '"Pirata One", cursive', () => import("@fontsource/pirata-one/400.css")),
  bundledFont("IM Fell English", "display", '"IM Fell English", serif', () =>
    import("@fontsource/im-fell-english/400.css")
  ),

  bundledFont("JetBrains Mono", "monospace", '"JetBrains Mono", monospace', () =>
    import("@fontsource/jetbrains-mono/400.css")
  ),
  bundledFont("Space Mono", "monospace", '"Space Mono", monospace', () =>
    Promise.all([import("@fontsource/space-mono/400.css"), import("@fontsource/space-mono/700.css")])
  ),
  bundledFont("IBM Plex Mono", "monospace", '"IBM Plex Mono", monospace', () =>
    Promise.all([import("@fontsource/ibm-plex-mono/400.css"), import("@fontsource/ibm-plex-mono/700.css")])
  ),
  bundledFont("Source Code Pro", "monospace", '"Source Code Pro", monospace', () =>
    Promise.all([import("@fontsource/source-code-pro/400.css"), import("@fontsource/source-code-pro/700.css")])
  ),

  bundledFont("Caveat", "handwritten", '"Caveat", cursive', () =>
    Promise.all([import("@fontsource/caveat/400.css"), import("@fontsource/caveat/700.css")])
  ),
  bundledFont("Pacifico", "handwritten", '"Pacifico", cursive', () => import("@fontsource/pacifico/400.css")),
  bundledFont("Dancing Script", "handwritten", '"Dancing Script", cursive', () =>
    Promise.all([import("@fontsource/dancing-script/400.css"), import("@fontsource/dancing-script/700.css")])
  ),
  bundledFont("Shadows Into Light", "handwritten", '"Shadows Into Light", cursive', () =>
    import("@fontsource/shadows-into-light/400.css")
  ),
  bundledFont("Great Vibes", "handwritten", '"Great Vibes", cursive', () => import("@fontsource/great-vibes/400.css")),
  bundledFont("Satisfy", "handwritten", '"Satisfy", cursive', () => import("@fontsource/satisfy/400.css")),
  bundledFont("Indie Flower", "handwritten", '"Indie Flower", cursive', () => import("@fontsource/indie-flower/400.css")),
  // Formal signature scripts — the "authorized signature" line on a
  // diploma/certificate, as opposed to Caveat/Pacifico's casual handwriting.
  bundledFont("Tangerine", "handwritten", '"Tangerine", cursive', () =>
    Promise.all([import("@fontsource/tangerine/400.css"), import("@fontsource/tangerine/700.css")])
  ),
  bundledFont("Alex Brush", "handwritten", '"Alex Brush", cursive', () => import("@fontsource/alex-brush/400.css")),
  bundledFont("Petit Formal Script", "handwritten", '"Petit Formal Script", cursive', () =>
    import("@fontsource/petit-formal-script/400.css")
  ),
  bundledFont("Berkshire Swash", "handwritten", '"Berkshire Swash", cursive', () =>
    import("@fontsource/berkshire-swash/400.css")
  ),
];

export const FONT_CATEGORIES = ["system", "sans", "serif", "display", "monospace", "handwritten"];

const FONT_BY_NAME = new Map(FONT_LIBRARY.map((f) => [f.name, f]));

export function getFontEntry(name) {
  return FONT_BY_NAME.get(name);
}

export function getFontCssStack(name) {
  return FONT_BY_NAME.get(name)?.cssStack || name;
}

const resolved = new Set(FONT_LIBRARY.filter((f) => f.category === "system").map((f) => f.name));
const inFlight = new Map();

// Cached, dedup'd loader — repeatedly requesting the same font (e.g. from
// several selected objects, or a toolbar preview list) never issues more
// than one underlying import()/document.fonts.load() call.
export function loadFont(name) {
  if (resolved.has(name)) return Promise.resolve();
  if (inFlight.has(name)) return inFlight.get(name);
  const entry = FONT_BY_NAME.get(name);
  const promise = (entry ? entry.load() : Promise.resolve())
    .catch(() => {})
    .then(() => {
      resolved.add(name);
      inFlight.delete(name);
    });
  inFlight.set(name, promise);
  return promise;
}

export function isFontResolved(name) {
  return resolved.has(name);
}
