// AI Illustration generation client (frontend half of the Illustrations
// panel). The frontend never talks to OpenAI/Gemini/Stability/etc directly —
// it only ever calls this app's own backend endpoint below. Swapping the
// underlying AI provider is a backend-only change (see functions/providers/)
// and requires no change here or in IllustrationsPanel.jsx.
//
// Endpoint resolution: defaults to a same-origin relative path so it works
// unmodified once deployed behind Firebase Hosting's rewrite (see
// firebase.json). Override with VITE_AI_ILLUSTRATION_ENDPOINT for local dev
// against the Functions emulator (e.g. when not using the Vite proxy) or a
// different backend deployment.
const ENDPOINT = import.meta.env.VITE_AI_ILLUSTRATION_ENDPOINT || "/api/ai/illustrations/generate";

export const ILLUSTRATION_STYLES = [
  { key: "flat", label: "Flat" },
  { key: "3d", label: "3D" },
  { key: "cartoon", label: "Cartoon" },
  { key: "watercolor", label: "Watercolor" },
  { key: "sketch", label: "Sketch" },
  { key: "vector", label: "Vector" },
  { key: "minimal", label: "Minimal" },
  { key: "realistic", label: "Realistic" },
];

export const ASPECT_RATIOS = [
  { key: "square", label: "Square", ratio: "1:1" },
  { key: "portrait", label: "Portrait", ratio: "4:5" },
  { key: "landscape", label: "Landscape", ratio: "16:9" },
];

export const MAX_ILLUSTRATION_COUNT = 4;

// Requests `count` illustrations from the backend. Resolves to an array of
// { url } — url is a data: URI in this app (the backend returns base64
// image data directly, so the frontend never needs a second round trip to
// fetch pixels), but any same-origin/CORS-enabled URL works too since
// callers only ever do `fetch(url).blob()` on it.
export async function requestIllustrations({ prompt, style, aspectRatio, count, advanced, signal }) {
  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        style,
        aspectRatio,
        count: Math.min(MAX_ILLUSTRATION_COUNT, Math.max(1, Number(count) || 1)),
        ...advanced,
      }),
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new Error("Could not reach the illustration service. Check your connection and try again.");
  }

  if (!response.ok) {
    let message = `Generation failed (${response.status}).`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // non-JSON error body — keep the generic status message
    }
    throw new Error(message);
  }

  const data = await response.json();
  if (!Array.isArray(data?.images) || data.images.length === 0) {
    throw new Error("The illustration service returned no images.");
  }
  return data.images;
}

// --- In-session result cache -------------------------------------------
// Module-scoped (not component state) so results, in-flight status, and
// favorites survive the user switching to another sidebar section and back
// to Illustrations — the panel remounts each time (see LeftSidebar.jsx),
// but this store doesn't. Resets naturally on a full page reload, which is
// the "current session" boundary asked for.

const GALLERY_LIMIT = 24;

let gallery = [];
const listeners = new Set();

function notify() {
  listeners.forEach((cb) => cb(gallery));
}

export const illustrationGallery = {
  getAll() {
    return gallery;
  },
  // Newest first; capped so a long session doesn't grow this unboundedly.
  addMany(entries) {
    gallery = [...entries, ...gallery].slice(0, GALLERY_LIMIT);
    notify();
  },
  update(id, patch) {
    gallery = gallery.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry));
    notify();
  },
  // Swaps one entry for another IN PLACE (same array position) — used by
  // "Regenerate" so the replacement lands where the user was just looking
  // instead of jumping to the top of the grid.
  replace(id, nextEntry) {
    gallery = gallery.map((entry) => (entry.id === id ? nextEntry : entry));
    notify();
  },
  remove(id) {
    gallery = gallery.filter((entry) => entry.id !== id);
    notify();
  },
  subscribe(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};
