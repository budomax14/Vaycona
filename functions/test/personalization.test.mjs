// Client Personalization — core rules + Cloud Function handlers, run
// against in-memory Firestore/Storage fakes: `npm test` in functions/.
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { FakeDb, FakeBucket } from "./fakeFirebase.mjs";
import * as core from "../personalizationCore.mjs";

const require = createRequire(import.meta.url);
const { createHandlers, hasBusinessEntitlement, readImageInfo } = require("../personalization.js");

// 1×1 PNG and a tiny JPEG header with an SOF0 segment (2×3 px).
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const JPEG_2x3 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x03, 0x00, 0x02, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9]);

function sampleDesign() {
  return {
    pages: [{ id: "page1", name: "Page 1", width: 600, height: 400, background: "#ffffff" }],
    items: [
      {
        id: "title",
        pageId: "page1",
        type: "text",
        x: 20,
        y: 20,
        width: 300,
        height: 50,
        text: "Happy Birthday",
        fontSize: 40,
        fontFamily: "Arial",
        fill: "#111827",
        personalizationFields: [{ type: "text", label: "Name", required: true, maxLength: 20, minFontSize: 20 }],
      },
      {
        id: "photo",
        pageId: "page1",
        type: "frame",
        frameKind: "circle",
        x: 350,
        y: 50,
        width: 200,
        height: 200,
        contentAssetId: "asset-a",
        crop: { fit: "fill", focalX: 0.5, focalY: 0.5, zoom: 1 },
        personalizationFields: [{ type: "photo", label: "Your photo", required: true }],
      },
      {
        id: "badge",
        pageId: "page1",
        type: "shape",
        shapeKind: "rectangle",
        x: 20,
        y: 300,
        width: 100,
        height: 60,
        fill: "#ff0000",
        personalizationFields: [{ type: "color", label: "Badge color", colors: ["#ff0000", "#00ff00"] }],
      },
      { id: "logo", pageId: "page1", type: "image", x: 500, y: 320, width: 80, height: 60, assetId: "asset-logo" },
      { id: "locked-text", pageId: "page1", type: "text", x: 20, y: 200, width: 300, height: 40, text: "Locked", fontSize: 24, fill: "#000000" },
    ],
  };
}

const FIELD_TEXT = "text-title";
const FIELD_PHOTO = "photo-photo";
const FIELD_COLOR = "color-badge";

// --- core ---

describe("core field + value rules", () => {
  test("only supported elements become fields; everything else stays locked", () => {
    const design = sampleDesign();
    const { fields, errors } = core.validateFieldDefinitions(core.fieldsFromItems(design.items), design);
    assert.deepEqual(errors, []);
    assert.deepEqual(fields.map((f) => f.id), [FIELD_TEXT, FIELD_PHOTO, FIELD_COLOR]);

    const bad = core.validateFieldDefinitions(
      [
        { itemId: "logo", type: "text", label: "x" },
        { itemId: "missing", type: "photo", label: "x" },
      ],
      design
    );
    assert.deepEqual(bad.errors.map((e) => e.code), ["field_item_unsupported", "field_item_missing"]);
  });

  test("values for locked elements and unapproved properties are rejected", () => {
    const design = sampleDesign();
    const { fields } = core.validateFieldDefinitions(core.fieldsFromItems(design.items), design);
    const { errors } = core.validateValues(
      fields,
      {
        "text-locked-text": { text: "hacked" },
        [FIELD_TEXT]: { text: "Sam", fontFamily: "Comic Sans" },
        [FIELD_COLOR]: { color: "#0000ff" },
      },
      { design }
    );
    assert.deepEqual(errors.map((e) => e.code).sort(), ["color_not_allowed", "unapproved_property", "unknown_field"]);
  });

  test("text limits: character limit, minimum font size, required", () => {
    const design = sampleDesign();
    const { fields } = core.validateFieldDefinitions(core.fieldsFromItems(design.items), design);
    const tooLong = core.validateValues(fields, { [FIELD_TEXT]: { text: "x".repeat(21), fontSize: 40 } }, { design });
    assert.equal(tooLong.errors[0].code, "too_long");
    const tooSmall = core.validateValues(fields, { [FIELD_TEXT]: { text: "Sam", fontSize: 12 } }, { design });
    assert.equal(tooSmall.errors[0].code, "text_does_not_fit");
    const empty = core.validateValues(fields, { [FIELD_TEXT]: { text: "  ", fontSize: 40 } }, { design, requireComplete: true });
    assert.equal(empty.errors[0].code, "required");
    const ok = core.validateValues(fields, { [FIELD_TEXT]: { text: "Sam", fontSize: 99 } }, { design });
    assert.equal(ok.values[FIELD_TEXT].fontSize, 40, "font size is capped at the designed size");
  });

  test("applyValues never touches the source design and only changes approved properties", () => {
    const design = sampleDesign();
    const before = JSON.stringify(design);
    const { fields } = core.validateFieldDefinitions(core.fieldsFromItems(design.items), design);
    const out = core.applyValues(
      design,
      fields,
      { [FIELD_TEXT]: { text: "Sam", fontSize: 30 }, [FIELD_COLOR]: { color: "#00ff00" }, [FIELD_PHOTO]: { uploadId: "u1", zoom: 2, focalX: 0.2, focalY: 0.8 } },
      { uploadAssets: { u1: { assetId: "pzu-u1", width: 1000, height: 500 } } }
    );
    assert.equal(JSON.stringify(design), before);
    const byId = Object.fromEntries(out.items.map((i) => [i.id, i]));
    assert.equal(byId.title.text, "Sam");
    assert.equal(byId.title.fontSize, 30);
    assert.equal(byId.title.richText[0].runs[0].fontFamily, "Arial");
    assert.deepEqual([byId.title.x, byId.title.y, byId.title.width, byId.title.height], [20, 20, 300, 50]);
    assert.equal(byId.badge.fill, "#00ff00");
    // Frame keeps its mask (frameKind) and geometry; only content + crop change.
    assert.equal(byId.photo.frameKind, "circle");
    assert.equal(byId.photo.contentAssetId, "pzu-u1");
    assert.deepEqual(byId.photo.crop, { fit: "fill", zoom: 2, focalX: 0.2, focalY: 0.8 });
    assert.deepEqual(byId["locked-text"], design.items[4]);
    assert.deepEqual(byId.logo, design.items[3]);
  });

  test("photo replacement in an image keeps the box and crops without distortion", () => {
    const crop = core.computeCoverCrop(1000, 500, 200, 200, { zoom: 1, focalX: 0.5, focalY: 0.5 });
    // Box is square; photo is 2:1 → the crop takes the middle half.
    assert.deepEqual(crop, { x: 0.25, y: 0, width: 0.5, height: 1 });
    const zoomed = core.computeCoverCrop(1000, 500, 200, 200, { zoom: 2, focalX: 0, focalY: 1 });
    assert.deepEqual(zoomed, { x: 0, y: 0.5, width: 0.25, height: 0.5 });
  });

  test("photo filters: only known filters are accepted and they set the photo's adjustments", () => {
    const design = sampleDesign();
    const { fields } = core.validateFieldDefinitions(core.fieldsFromItems(design.items), design);
    const uploads = { u1: { width: 1000, height: 500 } };
    const bad = core.validateValues(fields, { [FIELD_PHOTO]: { uploadId: "u1", filter: "deepfry" } }, { design, uploads });
    assert.equal(bad.errors[0].code, "invalid");
    const ok = core.validateValues(fields, { [FIELD_PHOTO]: { uploadId: "u1", filter: "sepia" } }, { design, uploads });
    assert.deepEqual(ok.errors, []);
    assert.equal(ok.values[FIELD_PHOTO].filter, "sepia");
    const none = core.validateValues(fields, { [FIELD_PHOTO]: { uploadId: "u1" } }, { design, uploads });
    assert.equal("filter" in none.values[FIELD_PHOTO], false);

    const uploadAssets = { u1: { assetId: "pzu-u1", width: 1000, height: 500 } };
    const filtered = core.applyValues(design, fields, ok.values, { uploadAssets });
    assert.deepEqual(filtered.items.find((i) => i.id === "photo").adjustments, core.PHOTO_FILTERS.sepia);
    // No filter: the box keeps whatever look the business designed.
    const styled = { ...design, items: design.items.map((i) => (i.id === "photo" ? { ...i, adjustments: { saturation: -1 } } : i)) };
    const plain = core.applyValues(styled, fields, none.values, { uploadAssets });
    assert.deepEqual(plain.items.find((i) => i.id === "photo").adjustments, { saturation: -1 });
  });

  test("image sniffing reads real dimensions and rejects non-images", () => {
    assert.deepEqual(readImageInfo(PNG_1PX), { contentType: "image/png", width: 1, height: 1 });
    assert.deepEqual(readImageInfo(JPEG_2x3), { contentType: "image/jpeg", width: 2, height: 3 });
    assert.equal(readImageInfo(Buffer.from("<svg onload=alert(1)>")), null);
  });
});

// --- handlers ---

const OWNER = "owner1";
const OTHER = "other1";

function authFor(uid, email = `${uid}@example.com`) {
  return { uid, token: { email, firebase: { sign_in_provider: "password" } } };
}

function req(data, { auth = null, ip = "1.1.1.1" } = {}) {
  return { data, auth, rawRequest: { ip, headers: {} } };
}

async function expectError(promise, code, detailCode) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.code, code, `expected ${code}, got ${err.code}: ${err.message}`);
    if (detailCode) assert.equal(err.details?.code, detailCode);
    return true;
  });
}

describe("handlers", () => {
  let db;
  let bucket;
  let clock;
  let h;

  function stage(uid, stagingId, design = sampleDesign()) {
    bucket.put(`personalizationStaging/${uid}/${stagingId}/design.json`, JSON.stringify(design), "application/json");
    bucket.put(`personalizationStaging/${uid}/${stagingId}/assets/asset-a`, PNG_1PX, "image/png");
    bucket.put(`personalizationStaging/${uid}/${stagingId}/assets/asset-logo`, PNG_1PX, "image/png");
  }

  async function publish(settings = {}, { uid = OWNER, stagingId = "stage1", templateId } = {}) {
    stage(uid, stagingId);
    return h.publishVersion(
      req(
        { stagingId, projectKey: "project1", templateId, settings: { name: "Birthday card", businessName: "Acme Prints", mode: "approval", formats: ["png", "pdf"], ...settings } },
        { auth: authFor(uid) }
      )
    );
  }

  async function newSession(linkToken, ip = "2.2.2.2") {
    const { sessionKey } = await h.startSession(req({ linkToken }, { ip }));
    return sessionKey;
  }

  async function uploadPng(linkToken, sessionKey) {
    return h.uploadPhoto(req({ linkToken, sessionKey, fieldId: FIELD_PHOTO, data: PNG_1PX.toString("base64") }));
  }

  beforeEach(() => {
    db = new FakeDb();
    bucket = new FakeBucket();
    clock = { t: Date.UTC(2026, 0, 1) };
    h = createHandlers({ db, bucket, now: () => clock.t });
    db.seed(`users/${OWNER}`, { tier: "business", status: "active" });
    db.seed(`users/${OTHER}`, { tier: "business", status: "active" });
  });

  test("only an entitled Business account can publish", async () => {
    await expectError(h.publishVersion(req({ stagingId: "s", projectKey: "p" })), "unauthenticated");
    for (const [uid, userDoc] of [
      ["free1", { tier: "free" }],
      ["pro1", { tier: "pro", status: "active" }],
      ["late1", { tier: "business", status: "past_due" }],
      ["nodoc1", null],
    ]) {
      if (userDoc) db.seed(`users/${uid}`, userDoc);
      stage(uid, "s");
      await expectError(
        h.publishVersion(req({ stagingId: "s", projectKey: "p", settings: { name: "n", mode: "download", formats: ["png"] } }, { auth: authFor(uid) })),
        "permission-denied",
        "business_required"
      );
    }
    const anon = { uid: "anon", token: { firebase: { sign_in_provider: "anonymous" } } };
    await expectError(h.publishVersion(req({ stagingId: "s", projectKey: "p" }, { auth: anon })), "permission-denied");

    // The admin account has no subscription but counts as Business.
    stage("admin1", "s");
    const adminResult = await h.publishVersion(
      req({ stagingId: "s", projectKey: "p", settings: { name: "n", mode: "download", formats: ["png"] } }, { auth: authFor("admin1", "budomax1995@gmail.com") })
    );
    assert.ok(adminResult.linkToken);
    assert.equal(hasBusinessEntitlement({ tier: "business", status: "trialing" }), true);
  });

  test("publishing snapshots only the referenced assets and cleans up staging", async () => {
    bucket.put(`personalizationStaging/${OWNER}/stage1/assets/unrelated`, PNG_1PX, "image/png");
    const { templateId, versionId, linkToken } = await publish();
    assert.match(linkToken, /^[A-Za-z0-9_-]{43}$/);
    const version = db.data(`personalizationTemplates/${templateId}/versions/${versionId}`);
    assert.equal(Object.keys(version.assets).length, 2);
    assert.equal(version.fields.length, 3);
    const design = JSON.parse(bucket.files.get(version.designPath).buffer.toString());
    assert.ok(design.items.every((i) => !i.personalizationFields), "field settings aren't part of the snapshot");
    assert.ok(design.items.find((i) => i.id === "photo").contentAssetId.startsWith("pzt-"));
    assert.equal([...bucket.files.keys()].filter((p) => p.startsWith("personalizationStaging/")).length, 0);
    // The link token itself is never stored as a lookup key.
    assert.equal(db.data(`personalizationLinks/${linkToken}`), undefined);
  });

  test("management actions on someone else's template or submission are rejected", async () => {
    const { templateId, linkToken } = await publish();
    const other = { auth: authFor(OTHER) };
    await expectError(h.setLinkStatus(req({ templateId, status: "revoked" }, other)), "not-found");
    await expectError(h.regenerateLink(req({ templateId }, other)), "not-found");
    stage(OTHER, "x");
    await expectError(h.publishVersion(req({ templateId, stagingId: "x", projectKey: "p", settings: { name: "n", mode: "download", formats: ["png"] } }, other)), "not-found");

    const key = await newSession(linkToken);
    await uploadPng(linkToken, key);
    const uploads = (await h.getSession(req({ linkToken, sessionKey: key }))).session.uploads;
    await h.submit(req({ linkToken, sessionKey: key, requestId: "r1", customer: { name: "Sam", email: "sam@example.com" }, values: { [FIELD_PHOTO]: { uploadId: Object.keys(uploads)[0] } } }));
    const submissionId = key.split(".")[0];
    await expectError(h.reviewSubmission(req({ submissionId, decision: "approve" }, other)), "not-found");
    await expectError(h.getSubmissionDesign(req({ submissionId }, other)), "not-found");
    // A Pro owner (lost Business) can't manage even their own.
    db.seed(`users/${OWNER}`, { tier: "pro", status: "active" });
    await expectError(h.reviewSubmission(req({ submissionId, decision: "approve" }, { auth: authFor(OWNER) })), "permission-denied");
  });

  test("two customers get isolated sessions; a session key can't be forged", async () => {
    const { linkToken } = await publish({ mode: "download" });
    const a = await newSession(linkToken);
    const b = await newSession(linkToken);
    assert.notEqual(a, b);

    const upA = await uploadPng(linkToken, a);
    await h.saveValues(req({ linkToken, sessionKey: a, values: { [FIELD_TEXT]: { text: "Alice", fontSize: 40 }, [FIELD_PHOTO]: { uploadId: upA.uploadId } } }));
    const viewB = await h.getSession(req({ linkToken, sessionKey: b }));
    assert.deepEqual(viewB.session.values, {});
    assert.equal(Object.keys(viewB.assets).some((id) => id.startsWith("pzu-")), false, "B never sees A's photo");

    // B can't point at A's upload.
    await expectError(h.saveValues(req({ linkToken, sessionKey: b, values: { [FIELD_PHOTO]: { uploadId: upA.uploadId } } })), "invalid-argument", "values_invalid");
    // Wrong secret, swapped id, garbage — all look the same.
    const [idA] = a.split(".");
    const [, secretB] = b.split(".");
    for (const forged of [`${idA}.${secretB}`, `${idA}.${"x".repeat(43)}`, idA, "../../etc"]) {
      await expectError(h.getSession(req({ linkToken, sessionKey: forged })), "not-found", "session_invalid");
    }
    const viewA = await h.getSession(req({ linkToken, sessionKey: a }));
    assert.equal(viewA.session.values[FIELD_TEXT].text, "Alice");
  });

  test("the published template is never modified by customer sessions", async () => {
    const { templateId, versionId, linkToken } = await publish({ mode: "download" });
    const version = db.data(`personalizationTemplates/${templateId}/versions/${versionId}`);
    const designBefore = bucket.files.get(version.designPath).buffer.toString();
    const key = await newSession(linkToken);
    const up = await uploadPng(linkToken, key);
    await h.saveValues(req({ linkToken, sessionKey: key, values: { [FIELD_TEXT]: { text: "Zed", fontSize: 30 }, [FIELD_COLOR]: { color: "#00ff00" }, [FIELD_PHOTO]: { uploadId: up.uploadId } } }));
    const exported = await h.authorizeExport(req({ linkToken, sessionKey: key, format: "png" }));
    assert.equal(exported.design.items.find((i) => i.id === "title").text, "Zed");
    assert.equal(bucket.files.get(version.designPath).buffer.toString(), designBefore);
    assert.deepEqual(db.data(`personalizationTemplates/${templateId}/versions/${versionId}`), version);
  });

  test("locked elements and unapproved properties are rejected server-side", async () => {
    const { linkToken } = await publish({ mode: "download" });
    const key = await newSession(linkToken);
    await expectError(h.saveValues(req({ linkToken, sessionKey: key, values: { "text-locked-text": { text: "x" } } })), "invalid-argument", "values_invalid");
    await expectError(h.saveValues(req({ linkToken, sessionKey: key, values: { [FIELD_TEXT]: { text: "x", x: 0, rotation: 45 } } })), "invalid-argument", "values_invalid");
    await expectError(h.saveValues(req({ linkToken, sessionKey: key, values: { [FIELD_COLOR]: { color: "#123456" } } })), "invalid-argument", "values_invalid");
    // There is no endpoint that accepts a design from a customer at all —
    // a "design" key is just an unknown field.
    await expectError(h.saveValues(req({ linkToken, sessionKey: key, values: { design: { items: [] } } })), "invalid-argument");
  });

  test("approval mode: export is blocked until approved; submit is idempotent; changes can be requested", async () => {
    const { linkToken } = await publish({ mode: "approval" });
    const key = await newSession(linkToken);
    const submissionId = key.split(".")[0];
    const up = await uploadPng(linkToken, key);
    const values = { [FIELD_TEXT]: { text: "Sam", fontSize: 40 }, [FIELD_PHOTO]: { uploadId: up.uploadId } };

    await expectError(h.authorizeExport(req({ linkToken, sessionKey: key, format: "png" })), "permission-denied", "approval_required");
    await expectError(h.submit(req({ linkToken, sessionKey: key, requestId: "r1", values, customer: { name: "Sam", email: "not-an-email" } })), "invalid-argument");
    // Required photo missing.
    await expectError(h.submit(req({ linkToken, sessionKey: key, requestId: "r1", values: { [FIELD_TEXT]: values[FIELD_TEXT] }, customer: { name: "Sam", email: "sam@example.com" } })), "invalid-argument");

    const first = await h.submit(req({ linkToken, sessionKey: key, requestId: "r1", values, customer: { name: "Sam", email: "sam@example.com" }, preview: PNG_1PX.toString("base64") }));
    const again = await h.submit(req({ linkToken, sessionKey: key, requestId: "r1", values, customer: { name: "Sam", email: "sam@example.com" } }));
    const third = await h.submit(req({ linkToken, sessionKey: key, requestId: "r2", values, customer: { name: "Sam", email: "sam@example.com" } }));
    assert.equal(first.duplicate, false);
    assert.equal(again.duplicate, true);
    assert.equal(third.duplicate, true);
    assert.equal([...db.store.keys()].filter((p) => p.startsWith("personalizationSubmissions/")).length, 1);
    const sub = db.data(`personalizationSubmissions/${submissionId}`);
    assert.equal(sub.status, "pending");
    assert.equal(sub.customerEmail, "sam@example.com");
    assert.ok(sub.previewUrl.includes("token="));

    // Pending: the customer can't edit or export.
    await expectError(h.saveValues(req({ linkToken, sessionKey: key, values })), "failed-precondition");
    await expectError(h.authorizeExport(req({ linkToken, sessionKey: key, format: "png" })), "permission-denied");

    await expectError(h.reviewSubmission(req({ submissionId, decision: "request_changes", note: "" }, { auth: authFor(OWNER) })), "invalid-argument");
    await h.reviewSubmission(req({ submissionId, decision: "request_changes", note: "Please use a brighter photo." }, { auth: authFor(OWNER) }));
    const changes = await h.getSession(req({ linkToken, sessionKey: key }));
    assert.equal(changes.session.status, "changes_requested");
    assert.equal(changes.session.note, "Please use a brighter photo.");
    assert.equal(changes.access.canEdit, true);
    await expectError(h.authorizeExport(req({ linkToken, sessionKey: key, format: "png" })), "permission-denied");

    await h.saveValues(req({ linkToken, sessionKey: key, values: { ...values, [FIELD_TEXT]: { text: "Samantha", fontSize: 36 } } }));
    const resubmitted = await h.submit(req({ linkToken, sessionKey: key, requestId: "r3", values: { ...values, [FIELD_TEXT]: { text: "Samantha", fontSize: 36 } }, customer: { name: "Sam", email: "sam@example.com" } }));
    assert.equal(resubmitted.session.revision, 2);
    assert.equal(db.data(`personalizationSubmissions/${submissionId}`).status, "pending");

    await h.reviewSubmission(req({ submissionId, decision: "approve" }, { auth: authFor(OWNER) }));
    await expectError(h.authorizeExport(req({ linkToken, sessionKey: key, format: "jpeg" })), "permission-denied", "format_not_allowed");
    const exported = await h.authorizeExport(req({ linkToken, sessionKey: key, format: "png" }));
    assert.equal(exported.design.items.find((i) => i.id === "title").text, "Samantha");
    const owned = await h.getSubmissionDesign(req({ submissionId }, { auth: authFor(OWNER) }));
    assert.equal(owned.design.items.find((i) => i.id === "photo").contentAssetId, `pzu-${up.uploadId}`);
  });

  test("download mode: export allowed in enabled formats only, after required fields", async () => {
    const { linkToken } = await publish({ mode: "download", formats: ["png"] });
    const key = await newSession(linkToken);
    await expectError(h.authorizeExport(req({ linkToken, sessionKey: key, format: "png" })), "invalid-argument", "values_invalid");
    const up = await uploadPng(linkToken, key);
    await h.saveValues(req({ linkToken, sessionKey: key, values: { [FIELD_PHOTO]: { uploadId: up.uploadId } } }));
    await expectError(h.authorizeExport(req({ linkToken, sessionKey: key, format: "pdf" })), "permission-denied", "format_not_allowed");
    const ok = await h.authorizeExport(req({ linkToken, sessionKey: key, format: "png" }));
    assert.equal(ok.format, "png");
    await expectError(h.submit(req({ linkToken, sessionKey: key, requestId: "r1", values: {}, customer: { name: "a", email: "a@b.co" } })), "failed-precondition");
  });

  test("paused, revoked, regenerated and expired links", async () => {
    const { templateId, linkToken } = await publish({ mode: "download" });
    const key = await newSession(linkToken);
    const owner = { auth: authFor(OWNER) };

    await h.setLinkStatus(req({ templateId, status: "paused" }, owner));
    const blocked = await h.startSession(req({ linkToken }));
    assert.equal(blocked.sessionKey, null);
    assert.equal(blocked.blocked, "paused");
    const paused = await h.getSession(req({ linkToken, sessionKey: key }));
    assert.equal(paused.access.reason, "paused");
    assert.equal(paused.access.canEdit, false);
    await expectError(h.saveValues(req({ linkToken, sessionKey: key, values: {} })), "failed-precondition", "paused");
    await expectError(h.authorizeExport(req({ linkToken, sessionKey: key, format: "png" })), "permission-denied", "paused");

    await h.setLinkStatus(req({ templateId, status: "active" }, owner));
    assert.equal((await h.getSession(req({ linkToken, sessionKey: key }))).access.canEdit, true);

    await h.updateLinkExpiry(req({ templateId, linkExpiresInDays: 7 }, owner));
    clock.t += 8 * 24 * 60 * 60 * 1000;
    assert.equal((await h.startSession(req({ linkToken }))).blocked, "expired");
    await h.updateLinkExpiry(req({ templateId, linkExpiresInDays: 0 }, owner));

    const { linkToken: fresh } = await h.regenerateLink(req({ templateId }, owner));
    assert.notEqual(fresh, linkToken);
    await expectError(h.startSession(req({ linkToken })), "not-found", "link_revoked");
    await expectError(h.getSession(req({ linkToken, sessionKey: key })), "not-found");
    // An old session can't be replayed against the new link either.
    await expectError(h.getSession(req({ linkToken: fresh, sessionKey: key })), "not-found", "session_invalid");

    await h.setLinkStatus(req({ templateId, status: "revoked" }, owner));
    await expectError(h.startSession(req({ linkToken: fresh })), "not-found");
    await expectError(h.setLinkStatus(req({ templateId, status: "active" }, owner)), "failed-precondition", "link_revoked");
  });

  test("losing the Business plan pauses customers but keeps everything", async () => {
    const { templateId, linkToken } = await publish({ mode: "approval" });
    const key = await newSession(linkToken);
    const up = await uploadPng(linkToken, key);
    const values = { [FIELD_PHOTO]: { uploadId: up.uploadId } };
    await h.submit(req({ linkToken, sessionKey: key, requestId: "r1", values, customer: { name: "Sam", email: "sam@example.com" } }));
    await h.reviewSubmission(req({ submissionId: key.split(".")[0], decision: "approve" }, { auth: authFor(OWNER) }));
    const draftKey = await newSession(linkToken);

    db.seed(`users/${OWNER}`, { tier: "free", status: "canceled" });
    assert.equal((await h.startSession(req({ linkToken }))).blocked, "business_inactive");
    const draft = await h.getSession(req({ linkToken, sessionKey: draftKey }));
    assert.equal(draft.access.reason, "business_inactive");
    await expectError(h.saveValues(req({ linkToken, sessionKey: draftKey, values: {} })), "failed-precondition", "business_inactive");
    // Already-approved work stays downloadable, and nothing was deleted.
    assert.ok(await h.authorizeExport(req({ linkToken, sessionKey: key, format: "png" })));
    assert.ok(db.data(`personalizationTemplates/${templateId}`));
    assert.ok(db.data(`personalizationSubmissions/${key.split(".")[0]}`));

    db.seed(`users/${OWNER}`, { tier: "business", status: "active" });
    assert.equal((await h.getSession(req({ linkToken, sessionKey: draftKey }))).access.canEdit, true);
  });

  test("a new version doesn't change sessions already in progress", async () => {
    const first = await publish({ mode: "download" });
    const oldKey = await newSession(first.linkToken);
    const second = await publish({ mode: "download" }, { stagingId: "stage2", templateId: first.templateId });
    assert.equal(second.templateId, first.templateId);
    assert.equal(second.linkToken, first.linkToken, "same link, new version");
    assert.equal(second.versionNumber, 2);
    const newKey = await newSession(first.linkToken);
    assert.equal((await h.getSession(req({ linkToken: first.linkToken, sessionKey: oldKey }))).template.versionNumber, 1);
    assert.equal((await h.getSession(req({ linkToken: first.linkToken, sessionKey: newKey }))).template.versionNumber, 2);
  });

  test("uploads: type/size checks, field checks and per-field replacement", async () => {
    const { linkToken } = await publish({ mode: "download" });
    const key = await newSession(linkToken);
    await expectError(h.uploadPhoto(req({ linkToken, sessionKey: key, fieldId: FIELD_PHOTO, data: Buffer.from("GIF89a....").toString("base64") })), "invalid-argument", "file_type");
    await expectError(h.uploadPhoto(req({ linkToken, sessionKey: key, fieldId: FIELD_TEXT, data: PNG_1PX.toString("base64") })), "invalid-argument", "unknown_field");
    await expectError(h.uploadPhoto(req({ linkToken, sessionKey: key, fieldId: FIELD_PHOTO, data: "A".repeat(12 * 1024 * 1024) })), "invalid-argument", "file_too_large");
    const one = await uploadPng(linkToken, key);
    const two = await uploadPng(linkToken, key);
    const view = await h.getSession(req({ linkToken, sessionKey: key }));
    assert.deepEqual(Object.keys(view.session.uploads), [two.uploadId], "the unused earlier photo was replaced");
    assert.equal([...bucket.files.keys()].some((p) => p.endsWith(one.uploadId)), false);
  });

  test("abuse controls: session creation and exports are rate limited", async () => {
    const { linkToken } = await publish({ mode: "download", formats: ["png"] });
    for (let i = 0; i < 20; i++) await newSession(linkToken, "9.9.9.9");
    await expectError(h.startSession(req({ linkToken }, { ip: "9.9.9.9" })), "resource-exhausted");
    assert.ok(await newSession(linkToken, "8.8.8.8"), "other visitors are unaffected");

    const key = await newSession(linkToken, "7.7.7.7");
    const up = await uploadPng(linkToken, key);
    await h.saveValues(req({ linkToken, sessionKey: key, values: { [FIELD_PHOTO]: { uploadId: up.uploadId } } }));
    for (let i = 0; i < 30; i++) await h.authorizeExport(req({ linkToken, sessionKey: key, format: "png" }, { ip: `5.5.5.${i}` }));
    await expectError(h.authorizeExport(req({ linkToken, sessionKey: key, format: "png" })), "resource-exhausted");
    clock.t += 61 * 60 * 1000;
    assert.ok(await h.authorizeExport(req({ linkToken, sessionKey: key, format: "png" })));
  });

  test("cleanup removes abandoned drafts, their photos and stale staging", async () => {
    const { linkToken } = await publish({ mode: "download" });
    const stale = await newSession(linkToken);
    await uploadPng(linkToken, stale);
    bucket.put(`personalizationStaging/${OWNER}/old/design.json`, "{}", "application/json", new Date(clock.t - 2 * 24 * 3600 * 1000).toISOString());
    clock.t += 31 * 24 * 60 * 60 * 1000;
    const fresh = await newSession(linkToken, "3.3.3.3");
    const result = await h.cleanup();
    assert.equal(result.sessions, 1);
    assert.equal(result.staging, 1);
    await expectError(h.getSession(req({ linkToken, sessionKey: stale })), "not-found");
    assert.ok(await h.getSession(req({ linkToken, sessionKey: fresh })));
    assert.equal([...bucket.files.keys()].some((p) => p.includes(stale.split(".")[0])), false);
  });
});
