// Client Personalization — thin wrappers over the Cloud Functions in
// functions/personalization.js. Every customer-facing call carries the
// link token + session key; the server decides everything else.
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { isNativeApp } from "../platform";

function call(name, timeout) {
  const fn = httpsCallable(functions, name, timeout ? { timeout } : undefined);
  return async (data) => (await fn(data)).data;
}

export const pzApi = {
  publishVersion: call("pzPublishVersion", 300_000),
  setLinkStatus: call("pzSetLinkStatus"),
  regenerateLink: call("pzRegenerateLink"),
  updateLinkExpiry: call("pzUpdateLinkExpiry"),
  reviewSubmission: call("pzReviewSubmission"),
  getSubmissionDesign: call("pzGetSubmissionDesign"),
  startSession: call("pzStartSession"),
  getSession: call("pzGetSession"),
  saveValues: call("pzSaveValues"),
  uploadPhoto: call("pzUploadPhoto", 120_000),
  submit: call("pzSubmit", 120_000),
  authorizeExport: call("pzAuthorizeExport"),
};

// The server's own reason code (err.details.code) when there is one,
// otherwise the callable's status ("permission-denied", …).
export function errorCode(err) {
  return err?.details?.code || String(err?.code || "").replace(/^functions\//, "") || "unknown";
}

// Links always point at the website — inside the iOS/Android/desktop apps
// window.location is an app-local origin a customer couldn't open.
export function siteOrigin() {
  return isNativeApp ? "https://vaycona.com" : window.location.origin;
}

export function personalizationLinkUrl(linkToken) {
  return `${siteOrigin()}/#/p/${linkToken}`;
}

export function personalizationSessionUrl(linkToken, sessionKey) {
  return `${siteOrigin()}/#/p/${linkToken}/${sessionKey}`;
}

// "#/p/<linkToken>[/<sessionKey>][?preview=1]" → { linkToken, sessionKey, preview }
export function parsePersonalizationHash(hash) {
  const raw = (hash || "").replace(/^#/, "");
  const [path, query = ""] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "p" || !parts[1]) return null;
  return { linkToken: parts[1], sessionKey: parts[2] || null, preview: new URLSearchParams(query).has("preview") };
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
