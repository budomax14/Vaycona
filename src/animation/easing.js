// Phase 12 — centralized easing. Every animation stores a safe EASING ID
// (never a raw CSS/JS string) resolved here to a pure `t(0..1) -> 0..1`
// function. Keeps the transform engine (animationService.js) and the
// timeline UI reading the same finite, validated vocabulary — see spec
// §11/§89 ("do not store arbitrary CSS strings", "no JavaScript easing
// functions").

export const EASING_IDS = [
  "linear",
  "ease",
  "easeIn",
  "easeOut",
  "easeInOut",
  "back",
  "bounce",
  "elastic",
];

export const DEFAULT_EASING = "easeOut";

function clamp01(t) {
  return Math.min(1, Math.max(0, t));
}

const EASE_FNS = {
  linear: (t) => t,
  // Cubic approximations of the standard CSS timing keywords — close
  // enough visually, no cubic-bezier solver needed for a fixed, known set.
  ease: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  easeIn: (t) => t * t * t,
  easeOut: (t) => 1 - (1 - t) ** 3,
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  back: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  bounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    let x = 1 - t;
    let y;
    if (x < 1 / d1) y = n1 * x * x;
    else if (x < 2 / d1) y = n1 * (x -= 1.5 / d1) * x + 0.75;
    else if (x < 2.5 / d1) y = n1 * (x -= 2.25 / d1) * x + 0.9375;
    else y = n1 * (x -= 2.625 / d1) * x + 0.984375;
    return 1 - y;
  },
  elastic: (t) => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
};

export function isValidEasingId(id) {
  return EASING_IDS.includes(id);
}

// Safe fallback for any unknown/imported easing id (spec §64 "unsupported
// preset" pattern applied to easing too) — never throws, never evaluates
// untrusted code.
export function resolveEasingId(id) {
  return isValidEasingId(id) ? id : DEFAULT_EASING;
}

export function applyEasing(id, t) {
  const fn = EASE_FNS[resolveEasingId(id)] || EASE_FNS.linear;
  return fn(clamp01(t));
}

export const EASING_LABELS = {
  linear: "Linear",
  ease: "Ease",
  easeIn: "Ease in",
  easeOut: "Ease out",
  easeInOut: "Ease in-out",
  back: "Back",
  bounce: "Bounce",
  elastic: "Elastic",
};
