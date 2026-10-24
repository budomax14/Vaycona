// Client Personalization (Business plan) — every read/write a business or a
// customer makes goes through here. Firestore/Storage rules deny clients
// direct access to everything a customer touches (sessions, uploads,
// published designs); a business can only READ its own templates and
// submissions there. So these handlers are the one place that decides:
//   - who may publish/manage (signed-in owner with a live Business plan),
//   - what a link holder may see (one published version, nothing else),
//   - what a customer may change (only approved fields, validated against
//     the published field definitions — never the design itself),
//   - when a design may be exported (download mode, or once approved).
//
// Data:
//   personalizationTemplates/{templateId}            owner-readable
//     versions/{versionId}                           owner-readable, immutable
//   personalizationLinks/{sha256(linkToken)}         server only
//   personalizationSessions/{sessionId}              server only
//   personalizationSubmissions/{sessionId}           owner-readable
//   personalizationRateLimits/{sha256(key)}          server only
// Storage:
//   personalizationStaging/{uid}/{stagingId}/...     owner upload, read by publish
//   personalization/{templateId}/versions/{versionId}/design.json   server only
//   personalization/{templateId}/versions/{versionId}/assets/{n}    download-token URL
//   personalization/{templateId}/sessions/{sessionId}/...            download-token URL
//
// Handlers are plain functions over injected { db, bucket, now } so they're
// testable without a Firebase project (see test/personalization.test.mjs);
// the onCall/onSchedule wiring is at the bottom.

const crypto = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");

// Mirrors src/constants.js's ADMIN_EMAIL — the admin account counts as the
// top tier everywhere (see src/subscriptionContext.jsx).
const ADMIN_EMAIL = "budomax1995@gmail.com";
// Mirrors src/subscriptionContext.jsx: a paid plan whose payment is failing
// is locked out of editing, so it's locked out of this too.
const PAYMENT_FAILING_STATUSES = new Set(["past_due", "unpaid", "incomplete", "incomplete_expired"]);

const COLLECTIONS = {
  templates: "personalizationTemplates",
  links: "personalizationLinks",
  sessions: "personalizationSessions",
  submissions: "personalizationSubmissions",
  rateLimits: "personalizationRateLimits",
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const MAX_DESIGN_BYTES = 5 * 1024 * 1024;
const MAX_TEMPLATE_ASSET_BYTES = 25 * 1024 * 1024;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_PHOTO_SIDE = 10000;
const MAX_PHOTO_PIXELS = 40_000_000;
const MAX_PREVIEW_BYTES = 1.5 * 1024 * 1024;
const MAX_UPLOADS_PER_SESSION = 20;
const DRAFT_SESSION_TTL = 30 * DAY;
const STAGING_TTL = DAY;
const LINK_EXPIRY_CHOICES = [0, 7, 30, 90, 365]; // days, 0 = never

// [limit, window] per bucket — generous for a real customer, tight enough
// that a script can't mint sessions, fill Storage or hammer exports.
const RATE_LIMITS = {
  sessionPerIp: [20, HOUR],
  sessionPerLink: [500, DAY],
  readPerIp: [600, HOUR],
  savePerSession: [600, HOUR],
  uploadPerSession: [40, DAY],
  uploadPerIp: [100, HOUR],
  submitPerSession: [10, HOUR],
  exportPerSession: [30, HOUR],
  exportPerIp: [100, HOUR],
};

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;

let corePromise = null;
function loadCore() {
  if (!corePromise) corePromise = import("./personalizationCore.mjs");
  return corePromise;
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function randomId() {
  return crypto.randomBytes(12).toString("base64url");
}

function safeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

function hasBusinessEntitlement(userData, email) {
  if ((email || "").toLowerCase() === ADMIN_EMAIL) return true;
  if (!userData || userData.tier !== "business") return false;
  return !PAYMENT_FAILING_STATUSES.has(userData.status);
}

function fail(code, message, details) {
  return new HttpsError(code, message, details);
}

function isId(value) {
  return typeof value === "string" && ID_PATTERN.test(value);
}

// "<sessionId>.<secret>" — the secret is only ever stored hashed, so a
// leaked document id (or anything read out of Firestore) can't open a
// session; the full key only exists in the customer's link.
function parseSessionKey(sessionKey) {
  if (typeof sessionKey !== "string") return null;
  const [sessionId, secret, extra] = sessionKey.split(".");
  if (extra !== undefined || !isId(sessionId) || !TOKEN_PATTERN.test(secret || "")) return null;
  return { sessionId, secret };
}

function tokenUrl(bucketName, path, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

// --- image sniffing (customer uploads are never trusted by content-type) ---

function readImageInfo(buffer) {
  if (buffer.length > 24 && buffer[0] === 0x89 && buffer.toString("ascii", 1, 4) === "PNG") {
    return { contentType: "image/png", width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    let i = 2;
    while (i + 9 < buffer.length) {
      if (buffer[i] !== 0xff) return null;
      const marker = buffer[i + 1];
      if (marker === 0xff) {
        i += 1;
        continue;
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return { contentType: "image/jpeg", height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) };
      i += 2 + buffer.readUInt16BE(i + 2);
    }
  }
  return null;
}

function decodeBase64Image(data, maxBytes) {
  if (typeof data !== "string" || data.length > Math.ceil((maxBytes * 4) / 3) + 8) {
    throw fail("invalid-argument", "That file is too large.", { code: "file_too_large" });
  }
  const buffer = Buffer.from(data, "base64");
  if (buffer.length === 0 || buffer.length > maxBytes) throw fail("invalid-argument", "That file is too large.", { code: "file_too_large" });
  const info = readImageInfo(buffer);
  if (!info) throw fail("invalid-argument", "Please upload a JPEG or PNG photo.", { code: "file_type" });
  if (!info.width || !info.height || info.width > MAX_PHOTO_SIDE || info.height > MAX_PHOTO_SIDE || info.width * info.height > MAX_PHOTO_PIXELS) {
    throw fail("invalid-argument", "That photo's dimensions are too large.", { code: "file_dimensions" });
  }
  return { buffer, ...info };
}

function clientIp(request) {
  const raw = request?.rawRequest;
  const forwarded = raw?.headers?.["x-forwarded-for"];
  return (typeof forwarded === "string" && forwarded.split(",")[0].trim()) || raw?.ip || "unknown";
}

function createHandlers({ db, bucket, now = () => Date.now() }) {
  const col = (name) => db.collection(COLLECTIONS[name]);

  async function rateLimit(bucketKey, [limit, windowMs]) {
    const ref = col("rateLimits").doc(sha256(bucketKey));
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const t = now();
      const data = snap.exists ? snap.data() : null;
      if (!data || t - data.windowStart >= windowMs) {
        tx.set(ref, { count: 1, windowStart: t, expireAt: new Date(t + windowMs * 2) });
        return;
      }
      if (data.count >= limit) {
        throw fail("resource-exhausted", "Too many requests. Please wait a little and try again.", { code: "rate_limited" });
      }
      tx.set(ref, { ...data, count: data.count + 1 });
    });
  }

  async function writeTokenFile(path, buffer, contentType) {
    const token = crypto.randomUUID();
    await bucket.file(path).save(buffer, {
      resumable: false,
      metadata: { contentType, cacheControl: "private, max-age=3600", metadata: { firebaseStorageDownloadTokens: token } },
    });
    return tokenUrl(bucket.name, path, token);
  }

  async function readJsonFile(path, maxBytes) {
    const file = bucket.file(path);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [buffer] = await file.download();
    if (buffer.length > maxBytes) throw fail("invalid-argument", "This design is too large to publish.", { code: "design_too_large" });
    try {
      return JSON.parse(buffer.toString("utf8"));
    } catch {
      throw fail("invalid-argument", "This design couldn't be read.", { code: "design_invalid" });
    }
  }

  // --- owner side ---

  async function requireBusinessOwner(request) {
    const auth = request.auth;
    if (!auth) throw fail("unauthenticated", "You must be signed in.");
    if (auth.token?.firebase?.sign_in_provider === "anonymous") {
      throw fail("permission-denied", "Create an account to use Client Personalization.", { code: "business_required" });
    }
    const snap = await db.collection("users").doc(auth.uid).get();
    if (!hasBusinessEntitlement(snap.exists ? snap.data() : null, auth.token?.email)) {
      throw fail("permission-denied", "Client Personalization is part of the Business plan.", { code: "business_required" });
    }
    return auth.uid;
  }

  async function loadOwnedTemplate(uid, templateId) {
    if (!isId(templateId)) throw fail("invalid-argument", "Unknown template.");
    const ref = col("templates").doc(templateId);
    const snap = await ref.get();
    if (!snap.exists || snap.data().ownerUid !== uid) throw fail("not-found", "Template not found.");
    return { ref, data: snap.data() };
  }

  async function createLink(templateRef, templateId, uid) {
    const linkToken = randomToken();
    const linkHash = sha256(linkToken);
    await col("links").doc(linkHash).set({ templateId, ownerUid: uid, createdAt: now() });
    await templateRef.set({ linkToken, linkHash, linkStatus: "active", linkCreatedAt: now(), updatedAt: now() }, { merge: true });
    return linkToken;
  }

  async function publishVersion(request) {
    const uid = await requireBusinessOwner(request);
    const core = await loadCore();
    const data = request.data || {};
    const { stagingId, projectKey } = data;
    if (!isId(stagingId) || !isId(projectKey)) throw fail("invalid-argument", "Invalid publish request.");
    const settings = data.settings || {};
    const mode = core.MODES.includes(settings.mode) ? settings.mode : null;
    const formats = Array.isArray(settings.formats) ? [...new Set(settings.formats.filter((f) => core.EXPORT_FORMAT_OPTIONS.includes(f)))] : [];
    const name = core.cleanText(settings.name, core.LIMITS.templateNameMax).replace(/\n/g, " ").trim();
    const businessName = core.cleanText(settings.businessName, core.LIMITS.businessNameMax).replace(/\n/g, " ").trim();
    const expiryDays = LINK_EXPIRY_CHOICES.includes(settings.linkExpiresInDays) ? settings.linkExpiresInDays : 0;
    const settingsErrors = [];
    if (!mode) settingsErrors.push("settings_mode");
    if (formats.length === 0) settingsErrors.push("settings_formats");
    if (!name) settingsErrors.push("settings_name");
    if (settingsErrors.length) throw fail("invalid-argument", "Check the template settings.", { code: "settings_invalid", errors: settingsErrors });

    const stagingPrefix = `personalizationStaging/${uid}/${stagingId}/`;
    const rawDesign = await readJsonFile(`${stagingPrefix}design.json`, MAX_DESIGN_BYTES);
    if (!rawDesign) throw fail("failed-precondition", "The design upload didn't finish. Please try again.", { code: "staging_missing" });
    const { design, errors: designErrors } = core.sanitizeDesign(rawDesign);
    if (!design) throw fail("invalid-argument", "This design couldn't be published.", { code: "design_invalid", errors: designErrors });
    const { fields, errors: fieldErrors } = core.validateFieldDefinitions(core.fieldsFromItems(rawDesign.items), design);
    if (fieldErrors.length) throw fail("invalid-argument", "Some customer fields need attention.", { code: "fields_invalid", errors: fieldErrors });

    // One template per project: re-publishing the same design adds a
    // version to it rather than creating a second link.
    let templateRef;
    let template;
    if (data.templateId) {
      ({ ref: templateRef, data: template } = await loadOwnedTemplate(uid, data.templateId));
    } else {
      const existing = await col("templates").where("ownerUid", "==", uid).where("projectKey", "==", projectKey).limit(1).get();
      if (!existing.empty) {
        templateRef = existing.docs[0].ref;
        template = existing.docs[0].data();
      } else {
        templateRef = col("templates").doc(randomId());
        template = null;
      }
    }
    const templateId = templateRef.id;
    const versionNumber = (template?.currentVersionNumber || 0) + 1;
    const versionId = `v${versionNumber}-${randomId()}`;
    const versionPrefix = `personalization/${templateId}/versions/${versionId}/`;

    // Only the assets this design references are copied out of staging —
    // nothing else from the business's library is ever reachable.
    const remap = {};
    const assets = {};
    const assetIds = core.collectAssetIds(design.items);
    for (let i = 0; i < assetIds.length; i++) {
      const assetId = assetIds[i];
      if (!isId(assetId)) throw fail("invalid-argument", "This design references an invalid image.", { code: "asset_invalid" });
      const source = bucket.file(`${stagingPrefix}assets/${assetId}`);
      // eslint-disable-next-line no-await-in-loop
      const [exists] = await source.exists();
      if (!exists) throw fail("failed-precondition", "An image in this design didn't upload. Please try again.", { code: "asset_missing", assetId });
      // eslint-disable-next-line no-await-in-loop
      const [[buffer], [meta]] = await Promise.all([source.download(), source.getMetadata()]);
      const contentType = String(meta?.contentType || "");
      if (buffer.length > MAX_TEMPLATE_ASSET_BYTES || !contentType.startsWith("image/")) {
        throw fail("invalid-argument", "An image in this design isn't supported.", { code: "asset_invalid", assetId });
      }
      const newId = `pzt-${versionId}-${i}`;
      // eslint-disable-next-line no-await-in-loop
      const url = await writeTokenFile(`${versionPrefix}assets/${i}`, buffer, contentType);
      remap[assetId] = newId;
      assets[newId] = { url };
    }
    const publishedDesign = { pages: design.pages, items: core.remapAssetIds(design.items, remap) };
    await bucket.file(`${versionPrefix}design.json`).save(Buffer.from(JSON.stringify(publishedDesign)), {
      resumable: false,
      metadata: { contentType: "application/json" },
    });

    const t = now();
    await templateRef.collection("versions").doc(versionId).set({
      ownerUid: uid,
      versionNumber,
      createdAt: t,
      name,
      businessName,
      mode,
      formats,
      fields,
      assets,
      pageCount: publishedDesign.pages.length,
      designPath: `${versionPrefix}design.json`,
    });
    await templateRef.set(
      {
        ownerUid: uid,
        projectKey,
        name,
        businessName,
        mode,
        formats,
        fieldCount: fields.length,
        currentVersionId: versionId,
        currentVersionNumber: versionNumber,
        linkExpiresAt: expiryDays ? t + expiryDays * DAY : null,
        linkExpiresInDays: expiryDays,
        createdAt: template?.createdAt || t,
        updatedAt: t,
      },
      { merge: true }
    );
    let linkToken = template?.linkToken || null;
    if (!linkToken || template.linkStatus === "revoked") linkToken = await createLink(templateRef, templateId, uid);

    await bucket.deleteFiles({ prefix: stagingPrefix }).catch(() => {});
    logger.info("personalization: published", { uid, templateId, versionId, fields: fields.length });
    return { templateId, versionId, versionNumber, linkToken };
  }

  async function setLinkStatus(request) {
    const uid = await requireBusinessOwner(request);
    const { templateId, status } = request.data || {};
    if (!["active", "paused", "revoked"].includes(status)) throw fail("invalid-argument", "Unknown link status.");
    const { ref, data } = await loadOwnedTemplate(uid, templateId);
    if (data.linkStatus === "revoked" && status !== "revoked") {
      throw fail("failed-precondition", "This link was revoked. Create a new link instead.", { code: "link_revoked" });
    }
    // The lookup doc stays (marked revoked) so an old link explains itself
    // instead of looking like a typo.
    if (status === "revoked" && data.linkHash) await col("links").doc(data.linkHash).set({ revoked: true, revokedAt: now() }, { merge: true });
    await ref.set({ linkStatus: status, updatedAt: now() }, { merge: true });
    return { templateId, linkStatus: status };
  }

  // A fresh, different token: the old link (and every session opened from
  // it) stops working.
  async function regenerateLink(request) {
    const uid = await requireBusinessOwner(request);
    const { templateId } = request.data || {};
    const { ref, data } = await loadOwnedTemplate(uid, templateId);
    if (!data.currentVersionId) throw fail("failed-precondition", "Publish the template first.");
    if (data.linkHash) await col("links").doc(data.linkHash).set({ revoked: true, revokedAt: now() }, { merge: true });
    const linkToken = await createLink(ref, templateId, uid);
    return { templateId, linkToken };
  }

  async function updateLinkExpiry(request) {
    const uid = await requireBusinessOwner(request);
    const { templateId, linkExpiresInDays } = request.data || {};
    if (!LINK_EXPIRY_CHOICES.includes(linkExpiresInDays)) throw fail("invalid-argument", "Unknown expiry.");
    const { ref } = await loadOwnedTemplate(uid, templateId);
    const t = now();
    await ref.set({ linkExpiresInDays, linkExpiresAt: linkExpiresInDays ? t + linkExpiresInDays * DAY : null, updatedAt: t }, { merge: true });
    return { templateId, linkExpiresInDays };
  }

  async function loadOwnedSubmission(uid, submissionId) {
    if (!isId(submissionId)) throw fail("invalid-argument", "Unknown submission.");
    const ref = col("submissions").doc(submissionId);
    const snap = await ref.get();
    if (!snap.exists || snap.data().ownerUid !== uid) throw fail("not-found", "Submission not found.");
    return { ref, data: snap.data() };
  }

  async function reviewSubmission(request) {
    const uid = await requireBusinessOwner(request);
    const core = await loadCore();
    const { submissionId, decision } = request.data || {};
    if (!["approve", "request_changes"].includes(decision)) throw fail("invalid-argument", "Unknown decision.");
    const note = core.cleanText(request.data?.note, core.LIMITS.noteMax).trim();
    if (decision === "request_changes" && !note) throw fail("invalid-argument", "Add a note telling the customer what to change.", { code: "note_required" });
    const { ref } = await loadOwnedSubmission(uid, submissionId);
    const sessionRef = col("sessions").doc(submissionId);
    const status = decision === "approve" ? "approved" : "changes_requested";
    return db.runTransaction(async (tx) => {
      const [subSnap, sessionSnap] = [await tx.get(ref), await tx.get(sessionRef)];
      const current = subSnap.data();
      if (current.status === status && current.note === note) return { submissionId, status };
      if (current.status !== "pending") {
        throw fail("failed-precondition", "Only submissions waiting for review can be approved or sent back.", { code: "not_pending" });
      }
      const t = now();
      tx.set(ref, { ...current, status, note, reviewedAt: t, updatedAt: t });
      if (sessionSnap.exists) tx.set(sessionRef, { ...sessionSnap.data(), status, note, updatedAt: t });
      return { submissionId, status };
    });
  }

  async function sessionAssetMap(session, version) {
    const assets = {};
    Object.entries(version.assets || {}).forEach(([id, a]) => {
      assets[id] = a.url;
    });
    const uploadAssets = {};
    Object.entries(session.uploads || {}).forEach(([uploadId, u]) => {
      const assetId = `pzu-${uploadId}`;
      assets[assetId] = u.url;
      uploadAssets[uploadId] = { assetId, width: u.width, height: u.height };
    });
    return { assets, uploadAssets };
  }

  async function loadVersion(templateId, versionId) {
    const snap = await col("templates").doc(templateId).collection("versions").doc(versionId).get();
    if (!snap.exists) return null;
    return snap.data();
  }

  async function loadDesign(version) {
    const design = await readJsonFile(version.designPath, MAX_DESIGN_BYTES * 2);
    if (!design) throw fail("not-found", "This design is no longer available.");
    return design;
  }

  // The business's own view of one customer's design, for previewing and
  // downloading it from the dashboard.
  async function getSubmissionDesign(request) {
    const uid = await requireBusinessOwner(request);
    const core = await loadCore();
    const { data: submission } = await loadOwnedSubmission(uid, request.data?.submissionId);
    const sessionSnap = await col("sessions").doc(request.data.submissionId).get();
    if (!sessionSnap.exists) throw fail("not-found", "Submission not found.");
    const session = sessionSnap.data();
    const version = await loadVersion(session.templateId, session.versionId);
    if (!version) throw fail("not-found", "This design is no longer available.");
    const { assets, uploadAssets } = await sessionAssetMap(session, version);
    const design = core.applyValues(await loadDesign(version), version.fields, submission.values || session.values || {}, { uploadAssets });
    return { design, assets, name: `${version.name} - ${submission.customerName || "Customer"}` };
  }

  // --- customer side ---

  async function resolveLink(linkToken) {
    if (typeof linkToken !== "string" || !TOKEN_PATTERN.test(linkToken)) throw fail("not-found", "This link isn't valid.", { code: "link_invalid" });
    const linkHash = sha256(linkToken);
    const linkSnap = await col("links").doc(linkHash).get();
    if (!linkSnap.exists) throw fail("not-found", "This link isn't valid.", { code: "link_invalid" });
    if (linkSnap.data().revoked) throw fail("not-found", "This link is no longer available.", { code: "link_revoked" });
    const templateSnap = await col("templates").doc(linkSnap.data().templateId).get();
    if (!templateSnap.exists) throw fail("not-found", "This link isn't valid.", { code: "link_invalid" });
    const template = templateSnap.data();
    if (template.linkHash !== linkHash || template.linkStatus === "revoked") {
      throw fail("not-found", "This link is no longer available.", { code: "link_revoked" });
    }
    const ownerSnap = await db.collection("users").doc(template.ownerUid).get();
    let ownerEmail = null;
    if (!ownerSnap.exists || ownerSnap.data().tier !== "business") ownerEmail = await lookupOwnerEmail(template.ownerUid);
    const entitled = hasBusinessEntitlement(ownerSnap.exists ? ownerSnap.data() : null, ownerEmail);
    return { linkHash, templateId: templateSnap.id, template, entitled };
  }

  // Only needed for the admin account (which has no subscription doc but
  // counts as Business) — injected so tests don't need Firebase Auth.
  let lookupOwnerEmail = async () => null;

  function linkBlockReason(template, entitled) {
    if (!entitled) return "business_inactive";
    if (template.linkStatus === "paused") return "paused";
    if (template.linkExpiresAt && now() > template.linkExpiresAt) return "expired";
    return null;
  }

  function computeAccess(template, version, session, entitled) {
    const reason = linkBlockReason(template, entitled);
    const locked = session.status === "pending" || session.status === "approved";
    const canEdit = !reason && !locked;
    return {
      reason,
      canEdit,
      canSubmit: canEdit && version.mode === "approval",
      // An approved design stays downloadable even if the link is later
      // paused or the business's plan lapses — it was already signed off.
      canExport: session.status === "approved" || (!reason && version.mode === "download"),
    };
  }

  async function openSession(data) {
    const link = await resolveLink(data?.linkToken);
    const parsed = parseSessionKey(data?.sessionKey);
    if (!parsed) throw fail("not-found", "This personalization session wasn't found.", { code: "session_invalid" });
    const ref = col("sessions").doc(parsed.sessionId);
    const snap = await ref.get();
    // Same error for "no such session" and "wrong secret" and "session
    // from another link" — nothing to probe.
    if (!snap.exists || !safeEqualHex(sha256(parsed.secret), snap.data().secretHash) || snap.data().linkHash !== link.linkHash) {
      throw fail("not-found", "This personalization session wasn't found.", { code: "session_invalid" });
    }
    const session = snap.data();
    const version = await loadVersion(link.templateId, session.versionId);
    if (!version) throw fail("not-found", "This design is no longer available.");
    return { ...link, ref, sessionId: parsed.sessionId, session, version };
  }

  function sessionView(ctx, access) {
    const { session, version, template } = ctx;
    return {
      template: { name: version.name, businessName: version.businessName, versionNumber: version.versionNumber, mode: version.mode, formats: version.formats, fields: version.fields },
      session: {
        status: session.status,
        values: session.values || {},
        note: session.note || "",
        customerName: session.customerName || "",
        customerEmail: session.customerEmail || "",
        submittedAt: session.submittedAt || null,
        revision: session.revision || 0,
        uploads: Object.fromEntries(Object.entries(session.uploads || {}).map(([id, u]) => [id, { width: u.width, height: u.height, fieldId: u.fieldId }])),
      },
      access,
      linkExpiresAt: template.linkExpiresAt || null,
    };
  }

  async function startSession(request) {
    const ip = clientIp(request);
    await rateLimit(`read:${ip}`, RATE_LIMITS.readPerIp);
    const link = await resolveLink(request.data?.linkToken);
    const reason = linkBlockReason(link.template, link.entitled);
    if (reason) {
      // Nothing is created for a paused/expired link — the customer just
      // sees why.
      return { sessionKey: null, blocked: reason, template: { name: link.template.name, businessName: link.template.businessName } };
    }
    if (!link.template.currentVersionId) throw fail("not-found", "This link isn't ready yet.", { code: "link_invalid" });
    await rateLimit(`session-ip:${ip}:${link.linkHash}`, RATE_LIMITS.sessionPerIp);
    await rateLimit(`session-link:${link.linkHash}`, RATE_LIMITS.sessionPerLink);
    const sessionId = randomId();
    const secret = randomToken();
    const t = now();
    await col("sessions").doc(sessionId).set({
      templateId: link.templateId,
      versionId: link.template.currentVersionId,
      ownerUid: link.template.ownerUid,
      linkHash: link.linkHash,
      secretHash: sha256(secret),
      status: "draft",
      values: {},
      uploads: {},
      revision: 0,
      createdAt: t,
      updatedAt: t,
      lastActiveAt: t,
      ipHash: sha256(ip),
    });
    return { sessionKey: `${sessionId}.${secret}` };
  }

  async function getSession(request) {
    await rateLimit(`read:${clientIp(request)}`, RATE_LIMITS.readPerIp);
    const ctx = await openSession(request.data);
    const access = computeAccess(ctx.template, ctx.version, ctx.session, ctx.entitled);
    const { assets } = await sessionAssetMap(ctx.session, ctx.version);
    const design = await loadDesign(ctx.version);
    await ctx.ref.update({ lastActiveAt: now() });
    return { ...sessionView(ctx, access), design, assets };
  }

  function rejectValueErrors(errors) {
    if (errors.length) throw fail("invalid-argument", "Some fields need attention.", { code: "values_invalid", errors });
  }

  async function saveValues(request) {
    const core = await loadCore();
    const ctx = await openSession(request.data);
    await rateLimit(`save:${ctx.sessionId}`, RATE_LIMITS.savePerSession);
    const access = computeAccess(ctx.template, ctx.version, ctx.session, ctx.entitled);
    if (!access.canEdit) throw fail("failed-precondition", "This design can't be edited right now.", { code: access.reason || "locked" });
    const design = await loadDesign(ctx.version);
    const { values, errors } = core.validateValues(ctx.version.fields, request.data.values, { design, uploads: ctx.session.uploads || {} });
    rejectValueErrors(errors);
    const t = now();
    await ctx.ref.update({ values, updatedAt: t, lastActiveAt: t });
    return sessionView({ ...ctx, session: { ...ctx.session, values } }, access);
  }

  async function uploadPhoto(request) {
    const ip = clientIp(request);
    const ctx = await openSession(request.data);
    const access = computeAccess(ctx.template, ctx.version, ctx.session, ctx.entitled);
    if (!access.canEdit) throw fail("failed-precondition", "This design can't be edited right now.", { code: access.reason || "locked" });
    const fieldId = request.data.fieldId;
    if (!ctx.version.fields.some((f) => f.id === fieldId && f.type === "photo")) throw fail("invalid-argument", "This field doesn't take photos.", { code: "unknown_field" });
    await rateLimit(`upload-ip:${ip}`, RATE_LIMITS.uploadPerIp);
    await rateLimit(`upload:${ctx.sessionId}`, RATE_LIMITS.uploadPerSession);
    const image = decodeBase64Image(request.data.data, MAX_PHOTO_BYTES);

    // Keep Storage bounded: a new photo for a field replaces that field's
    // earlier unused photos.
    const uploads = { ...(ctx.session.uploads || {}) };
    const inUse = new Set(Object.values(ctx.session.values || {}).map((v) => v && v.uploadId).filter(Boolean));
    for (const [id, u] of Object.entries(uploads)) {
      if (u.fieldId === fieldId && !inUse.has(id)) {
        // eslint-disable-next-line no-await-in-loop
        await bucket.file(u.path).delete().catch(() => {});
        delete uploads[id];
      }
    }
    if (Object.keys(uploads).length >= MAX_UPLOADS_PER_SESSION) throw fail("resource-exhausted", "Too many photos in this session.", { code: "too_many_uploads" });

    const uploadId = randomId();
    const path = `personalization/${ctx.templateId}/sessions/${ctx.sessionId}/uploads/${uploadId}`;
    const url = await writeTokenFile(path, image.buffer, image.contentType);
    const record = { path, url, width: image.width, height: image.height, size: image.buffer.length, contentType: image.contentType, fieldId, createdAt: now() };
    const removed = Object.keys(ctx.session.uploads || {}).filter((id) => !(id in uploads));
    // Merged inside a transaction so two photos uploaded at once (two
    // photo fields) can't drop each other.
    await db.runTransaction(async (tx) => {
      const latest = (await tx.get(ctx.ref)).data();
      const merged = { ...(latest.uploads || {}) };
      removed.forEach((id) => delete merged[id]);
      merged[uploadId] = record;
      const t = now();
      tx.update(ctx.ref, { uploads: merged, updatedAt: t, lastActiveAt: t });
    });
    return { uploadId, assetId: `pzu-${uploadId}`, url, width: image.width, height: image.height };
  }

  async function submit(request) {
    const core = await loadCore();
    const ctx = await openSession(request.data);
    const { requestId } = request.data;
    if (!isId(requestId)) throw fail("invalid-argument", "Invalid request.");
    // Safe to repeat: the same request (a retry, a double tap) returns
    // what the first one created; one session only ever has one submission.
    if (ctx.session.lastSubmitRequestId === requestId || ctx.session.status === "pending" || ctx.session.status === "approved") {
      return { ...sessionView(ctx, computeAccess(ctx.template, ctx.version, ctx.session, ctx.entitled)), duplicate: true };
    }
    if (ctx.version.mode !== "approval") throw fail("failed-precondition", "This design doesn't need approval.");
    const access = computeAccess(ctx.template, ctx.version, ctx.session, ctx.entitled);
    if (!access.canSubmit) throw fail("failed-precondition", "This design can't be submitted right now.", { code: access.reason || "locked" });
    await rateLimit(`submit:${ctx.sessionId}`, RATE_LIMITS.submitPerSession);

    const customerName = core.cleanText(request.data.customer?.name, core.LIMITS.customerNameMax).replace(/\n/g, " ").trim();
    const customerEmail = String(request.data.customer?.email || "").trim().toLowerCase();
    const customerErrors = [];
    if (!customerName) customerErrors.push({ fieldId: "customerName", code: "required" });
    if (!core.isValidEmail(customerEmail)) customerErrors.push({ fieldId: "customerEmail", code: "invalid_email" });
    const design = await loadDesign(ctx.version);
    const { values, errors } = core.validateValues(ctx.version.fields, request.data.values, { design, uploads: ctx.session.uploads || {}, requireComplete: true });
    rejectValueErrors([...customerErrors, ...errors]);

    let previewUrl = null;
    if (request.data.preview) {
      const preview = decodeBase64Image(request.data.preview, MAX_PREVIEW_BYTES);
      previewUrl = await writeTokenFile(`personalization/${ctx.templateId}/sessions/${ctx.sessionId}/preview`, preview.buffer, preview.contentType);
    }

    const subRef = col("submissions").doc(ctx.sessionId);
    return db.runTransaction(async (tx) => {
      const sessionSnap = await tx.get(ctx.ref);
      const session = sessionSnap.data();
      if (session.lastSubmitRequestId === requestId || session.status === "pending" || session.status === "approved") {
        return { ...sessionView({ ...ctx, session }, computeAccess(ctx.template, ctx.version, session, ctx.entitled)), duplicate: true };
      }
      const t = now();
      const revision = (session.revision || 0) + 1;
      const nextSession = { ...session, values, status: "pending", note: "", customerName, customerEmail, submittedAt: t, revision, lastSubmitRequestId: requestId, updatedAt: t, lastActiveAt: t };
      tx.set(ctx.ref, nextSession);
      tx.set(subRef, {
        ownerUid: ctx.template.ownerUid,
        templateId: ctx.templateId,
        templateName: ctx.version.name,
        versionId: ctx.session.versionId,
        versionNumber: ctx.version.versionNumber,
        customerName,
        customerEmail,
        values,
        status: "pending",
        note: "",
        revision,
        previewUrl,
        submittedAt: t,
        updatedAt: t,
      });
      return { ...sessionView({ ...ctx, session: nextSession }, computeAccess(ctx.template, ctx.version, nextSession, ctx.entitled)), duplicate: false };
    });
  }

  // The only way to get an export-ready design: checks the mode/approval
  // and format here, then hands back the design built from the STORED
  // values (not whatever the page currently shows).
  async function authorizeExport(request) {
    const core = await loadCore();
    const ip = clientIp(request);
    const ctx = await openSession(request.data);
    const access = computeAccess(ctx.template, ctx.version, ctx.session, ctx.entitled);
    if (!access.canExport) {
      throw fail("permission-denied", ctx.version.mode === "approval" ? "Downloads unlock once the business approves your design." : "Downloads are paused for this design.", { code: access.reason || "approval_required" });
    }
    const format = request.data.format;
    if (!ctx.version.formats.includes(format)) throw fail("permission-denied", "That format isn't available for this design.", { code: "format_not_allowed" });
    await rateLimit(`export-ip:${ip}`, RATE_LIMITS.exportPerIp);
    await rateLimit(`export:${ctx.sessionId}`, RATE_LIMITS.exportPerSession);
    const design = await loadDesign(ctx.version);
    const { assets, uploadAssets } = await sessionAssetMap(ctx.session, ctx.version);
    const { values, errors } = core.validateValues(ctx.version.fields, ctx.session.values || {}, { design, uploads: ctx.session.uploads || {}, requireComplete: true });
    rejectValueErrors(errors);
    const t = now();
    await ctx.ref.update({ exportCount: (ctx.session.exportCount || 0) + 1, lastExportAt: t, lastActiveAt: t });
    return { design: core.applyValues(design, ctx.version.fields, values, { uploadAssets }), assets, format, filenameBase: ctx.version.name };
  }

  // --- housekeeping ---

  async function cleanup() {
    const t = now();
    let sessions = 0;
    const stale = await col("sessions").where("status", "==", "draft").where("lastActiveAt", "<", t - DRAFT_SESSION_TTL).limit(200).get();
    for (const doc of stale.docs) {
      const s = doc.data();
      // eslint-disable-next-line no-await-in-loop
      await bucket.deleteFiles({ prefix: `personalization/${s.templateId}/sessions/${doc.id}/` }).catch(() => {});
      // eslint-disable-next-line no-await-in-loop
      await doc.ref.delete();
      sessions += 1;
    }
    let staging = 0;
    const [files] = await bucket.getFiles({ prefix: "personalizationStaging/" });
    for (const file of files) {
      const created = Date.parse(file.metadata?.timeCreated || "");
      if (Number.isFinite(created) && t - created > STAGING_TTL) {
        // eslint-disable-next-line no-await-in-loop
        await file.delete().catch(() => {});
        staging += 1;
      }
    }
    const limits = await col("rateLimits").where("expireAt", "<", new Date(t)).limit(500).get();
    for (const doc of limits.docs) {
      // eslint-disable-next-line no-await-in-loop
      await doc.ref.delete();
    }
    return { sessions, staging, rateLimits: limits.size };
  }

  return {
    publishVersion,
    setLinkStatus,
    regenerateLink,
    updateLinkExpiry,
    reviewSubmission,
    getSubmissionDesign,
    startSession,
    getSession,
    saveValues,
    uploadPhoto,
    submit,
    authorizeExport,
    cleanup,
    setOwnerEmailLookup: (fn) => {
      lookupOwnerEmail = fn;
    },
  };
}

// --- Firebase wiring ---

let handlers = null;
function getHandlers() {
  if (!handlers) {
    const { initializeApp, getApps } = require("firebase-admin/app");
    const { getFirestore } = require("firebase-admin/firestore");
    const { getStorage } = require("firebase-admin/storage");
    const { getAuth } = require("firebase-admin/auth");
    if (!getApps().length) initializeApp();
    handlers = createHandlers({ db: getFirestore(), bucket: getStorage().bucket() });
    handlers.setOwnerEmailLookup(async (uid) => {
      try {
        return (await getAuth().getUser(uid)).email || null;
      } catch {
        return null;
      }
    });
  }
  return handlers;
}

function callable(name, options = {}) {
  return onCall({ region: "us-central1", ...options }, async (request) => {
    try {
      return await getHandlers()[name](request);
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      logger.error(`personalization ${name} failed`, err);
      throw new HttpsError("internal", "Something went wrong. Please try again.");
    }
  });
}

exports.createHandlers = createHandlers;
exports.hasBusinessEntitlement = hasBusinessEntitlement;
exports.readImageInfo = readImageInfo;
exports.RATE_LIMITS = RATE_LIMITS;

exports.functions = {
  pzPublishVersion: callable("publishVersion", { memory: "1GiB", timeoutSeconds: 300 }),
  pzSetLinkStatus: callable("setLinkStatus"),
  pzRegenerateLink: callable("regenerateLink"),
  pzUpdateLinkExpiry: callable("updateLinkExpiry"),
  pzReviewSubmission: callable("reviewSubmission"),
  pzGetSubmissionDesign: callable("getSubmissionDesign", { memory: "512MiB" }),
  pzStartSession: callable("startSession"),
  pzGetSession: callable("getSession", { memory: "512MiB" }),
  pzSaveValues: callable("saveValues", { memory: "512MiB" }),
  pzUploadPhoto: callable("uploadPhoto", { memory: "512MiB" }),
  pzSubmit: callable("submit", { memory: "512MiB" }),
  pzAuthorizeExport: callable("authorizeExport", { memory: "512MiB" }),
  pzCleanup: onSchedule({ schedule: "every 24 hours", region: "us-central1", timeoutSeconds: 540 }, async () => {
    const result = await getHandlers().cleanup();
    logger.info("personalization cleanup", result);
  }),
};
