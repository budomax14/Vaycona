const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const openaiProvider = require("./providers/openai");

// Set once via: firebase functions:secrets:set OPENAI_API_KEY
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

// Swappable-provider registry (spec: "AI providers can be swapped later...
// without major UI changes"). AI_PROVIDER is a plain env var (functions
// config), defaulting to openai; switching providers is a deploy-time
// config change, not a code or frontend change.
const PROVIDERS = { openai: openaiProvider };

const MAX_COUNT = 4;

// no-op: forces a redeploy so a rotated OPENAI_API_KEY secret version is
// actually picked up — Firebase skips redeploying functions whose source
// is unchanged, even when the bound secret's value changed underneath it.

exports.generateIllustrations = onRequest(
  { secrets: [OPENAI_API_KEY], cors: true, region: "us-central1", timeoutSeconds: 120 },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed." });
      return;
    }

    const { prompt, style, aspectRatio, count, extraDetails } = req.body || {};
    if (typeof prompt !== "string" || !prompt.trim()) {
      res.status(400).json({ error: "A prompt is required." });
      return;
    }

    const providerKey = process.env.AI_PROVIDER || "openai";
    const provider = PROVIDERS[providerKey];
    if (!provider) {
      res.status(500).json({ error: `Unknown AI provider "${providerKey}".` });
      return;
    }

    const safeCount = Math.min(MAX_COUNT, Math.max(1, Number(count) || 1));

    try {
      const trimmedExtra = typeof extraDetails === "string" ? extraDetails.trim().slice(0, 500) : "";
      const fullPrompt = trimmedExtra ? `${prompt.trim()}, ${trimmedExtra}` : prompt.trim();

      const images = await provider.generate({
        prompt: fullPrompt.slice(0, 2000),
        style: typeof style === "string" ? style : "flat",
        aspectRatio: typeof aspectRatio === "string" ? aspectRatio : "square",
        count: safeCount,
        apiKey: OPENAI_API_KEY.value(),
      });
      res.status(200).json({ images });
    } catch (err) {
      logger.error("Illustration generation failed", err);
      res.status(502).json({ error: err.message || "Illustration generation failed." });
    }
  }
);
