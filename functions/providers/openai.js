// OpenAI provider for AI illustration generation. This is the only file in
// the backend that knows anything about OpenAI's request/response shape —
// index.js and every frontend file talk to the generic { prompt, style,
// aspectRatio, count } / [{ url }] contract only. Adding Gemini/Stability/
// etc later means adding a sibling module here with the same
// generate({ prompt, style, aspectRatio, count, apiKey }) signature and
// registering it in index.js's PROVIDERS map — no other file changes.

const SIZE_BY_ASPECT = {
  square: "1024x1024",
  portrait: "1024x1536",
  landscape: "1536x1024",
};

const STYLE_DESCRIPTORS = {
  flat: "flat illustration style, clean shapes, minimal shading",
  "3d": "3D rendered illustration style, soft studio lighting",
  cartoon: "cartoon illustration style, bold outlines, playful colors",
  watercolor: "watercolor painting style, soft edges, hand-painted texture",
  sketch: "pencil sketch illustration style, hand-drawn linework",
  vector: "flat vector illustration style, crisp geometric shapes",
  minimal: "minimalist illustration style, simple shapes, generous negative space",
  realistic: "realistic digital illustration style, detailed rendering",
};

async function generate({ prompt, style, aspectRatio, count, apiKey }) {
  const styledPrompt = `${prompt}, ${STYLE_DESCRIPTORS[style] || `${style} illustration style`}`;
  const size = SIZE_BY_ASPECT[aspectRatio] || SIZE_BY_ASPECT.square;

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: styledPrompt,
      size,
      n: count,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message || `OpenAI request failed (${response.status}).`);
  }

  const data = await response.json();
  return (data.data || []).map((item) => ({ url: `data:image/png;base64,${item.b64_json}` }));
}

module.exports = { generate };
