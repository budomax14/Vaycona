import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ImagePlus,
  Loader2,
  Lock,
  MessageSquare,
  PauseCircle,
  RefreshCw,
  Send,
} from "lucide-react";
import { applyValues, collectAssetIds, computeCoverCrop, defaultValueFor, textLength, uploadAssetId, isValidEmail, PHOTO_FILTERS } from "../../../functions/personalizationCore.mjs";
import { pzApi, errorCode, blobToBase64, personalizationSessionUrl, parsePersonalizationHash } from "../../personalization/api";
import { loadSessionAssets, preparePhoto, registerLocalPhoto } from "../../personalization/sessionAssets";
import { getAssetBlob } from "../../assetStore";
import { adjustmentsToCssFilter } from "../../imageEffects";
import { fitText, loadDesignFonts } from "../../personalization/textFit";
import { exportPersonalizedDesign } from "../../personalization/exportDesign";
import { renderPageToCanvas } from "../../export/offscreenRenderer";
import { useLanguage } from "../../languageContext";
import { PERSONALIZATION_STRINGS } from "../../i18n/personalization";
import DesignPreview from "./DesignPreview";

const SESSION_STORAGE_PREFIX = "vaycona-pz-session:";
const SAVE_DELAY_MS = 800;
const FORMAT_LABELS = { png: "PNG", jpeg: "JPG", pdf: "PDF" };

// Remembering the session key on this device is only a convenience for
// refreshes/return visits — the key itself (a server-verified secret) is
// what grants access, and it's also in the page's own URL.
function rememberSession(linkToken, sessionKey) {
  try {
    if (sessionKey) localStorage.setItem(SESSION_STORAGE_PREFIX + linkToken, sessionKey);
    else localStorage.removeItem(SESSION_STORAGE_PREFIX + linkToken);
  } catch {
    // storage blocked — the URL still carries the session
  }
}

function recalledSession(linkToken) {
  try {
    return localStorage.getItem(SESSION_STORAGE_PREFIX + linkToken);
  } catch {
    return null;
  }
}

function uploadAssetsFor(uploads) {
  const out = {};
  Object.entries(uploads || {}).forEach(([id, u]) => {
    out[id] = { assetId: uploadAssetId(id), width: u.width, height: u.height };
  });
  return out;
}

// Public page a customer opens from a business's personalization link
// (#/p/<linkToken>[/<sessionKey>]). No Vaycona account involved — every
// call is authorized by the link token + this session's secret key.
export default function CustomerPersonalizationPage() {
  const { language } = useLanguage();
  const t = PERSONALIZATION_STRINGS[language].customer;
  const route = useMemo(() => parsePersonalizationHash(window.location.hash) || {}, []);
  const { linkToken, preview: isOwnerPreview } = route;

  const [phase, setPhase] = useState("loading"); // loading | blocked | error | ready
  const [blockReason, setBlockReason] = useState(null);
  const [header, setHeader] = useState(null);
  const [sessionKey, setSessionKey] = useState(null);
  const [data, setData] = useState(null); // { template, design, session, access }
  const [values, setValues] = useState({});
  // Latest values for async handlers (a photo upload finishing after the
  // customer typed elsewhere must not roll that typing back).
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const [attempted, setAttempted] = useState(false);
  const [fitState, setFitState] = useState({}); // fieldId -> fits
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [step, setStep] = useState("edit"); // edit | review
  const [activeFieldId, setActiveFieldId] = useState(null);
  const [pageId, setPageId] = useState(null);
  const [uploading, setUploading] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [customer, setCustomer] = useState({ name: "", email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [exporting, setExporting] = useState(null);
  const [exportError, setExportError] = useState(null);
  const [copied, setCopied] = useState(false);
  const saveTimer = useRef(null);
  const pendingSave = useRef(null);
  const submitRequestId = useRef(null);

  const applyServerState = useCallback((next) => {
    setData((prev) => ({ ...prev, ...next, design: next.design || prev?.design }));
    setValues(next.session.values || {});
    setCustomer((prev) => ({ name: prev.name || next.session.customerName || "", email: prev.email || next.session.customerEmail || "" }));
  }, []);

  // --- boot: resume this device's session or start a new one ---
  useEffect(() => {
    let cancelled = false;
    async function load(key) {
      const result = await pzApi.getSession({ linkToken, sessionKey: key });
      await Promise.all([loadSessionAssets(result.assets), loadDesignFonts(result.design)]);
      if (cancelled) return;
      setSessionKey(key);
      rememberSession(linkToken, key);
      if (window.location.hash !== `#/p/${linkToken}/${key}`) {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#/p/${linkToken}/${key}${isOwnerPreview ? "?preview=1" : ""}`);
      }
      applyServerState(result);
      setPageId(result.design.pages[0]?.id || null);
      if (result.session.status !== "draft" && result.session.status !== "changes_requested") setStep("review");
      setPhase("ready");
    }
    async function boot() {
      if (!linkToken) {
        setPhase("error");
        setBlockReason("link_invalid");
        return;
      }
      const existing = route.sessionKey || recalledSession(linkToken);
      try {
        if (existing) {
          try {
            await load(existing);
            return;
          } catch (err) {
            if (errorCode(err) !== "session_invalid") throw err;
            rememberSession(linkToken, null);
            if (route.sessionKey) {
              setPhase("error");
              setBlockReason("session_invalid");
              return;
            }
          }
        }
        const started = await pzApi.startSession({ linkToken });
        if (cancelled) return;
        if (!started.sessionKey) {
          setHeader(started.template);
          setBlockReason(started.blocked);
          setPhase("blocked");
          return;
        }
        await load(started.sessionKey);
      } catch (err) {
        if (cancelled) return;
        setBlockReason(errorCode(err));
        setPhase("error");
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, [linkToken, route.sessionKey, isOwnerPreview, applyServerState]);

  const template = data?.template;
  const fields = template?.fields || [];
  const access = data?.access || {};
  const status = data?.session?.status;
  const baseItems = useMemo(() => new Map((data?.design?.items || []).map((it) => [it.id, it])), [data?.design]);
  const uploadAssets = useMemo(() => uploadAssetsFor(data?.session?.uploads), [data?.session?.uploads]);
  const personalized = useMemo(
    () => (data?.design ? applyValues(data.design, fields, values, { uploadAssets }) : null),
    [data?.design, fields, values, uploadAssets]
  );

  // Re-fit stored text once fonts are ready (fit results aren't persisted).
  useEffect(() => {
    if (phase !== "ready") return;
    const next = {};
    fields.forEach((field) => {
      if (field.type !== "text") return;
      const item = baseItems.get(field.itemId);
      const v = values[field.id] || defaultValueFor(field, item);
      next[field.id] = fitText(item, v.text, field.minFontSize).fits;
    });
    setFitState(next);
    // Only on load — edits update fitState as they happen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // --- autosave ---
  const flushSave = useCallback(async () => {
    const pending = pendingSave.current;
    if (!pending) return;
    pendingSave.current = null;
    setSaveState("saving");
    try {
      const result = await pzApi.saveValues({ linkToken, sessionKey, values: pending });
      setData((prev) => ({ ...prev, access: result.access, session: { ...prev.session, ...result.session, values: prev.session.values } }));
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      const code = errorCode(err);
      if (["paused", "business_inactive", "expired", "locked"].includes(code)) {
        setData((prev) => ({ ...prev, access: { ...prev.access, canEdit: false, canSubmit: false, reason: code === "locked" ? prev.access.reason : code } }));
      }
    }
  }, [linkToken, sessionKey]);

  function updateValues(next) {
    valuesRef.current = next;
    setValues(next);
    pendingSave.current = next;
    setSaveState("pending");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flushSave, SAVE_DELAY_MS);
  }

  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  function setFieldError(fieldId, code) {
    setFieldErrors((prev) => ({ ...prev, [fieldId]: code }));
  }

  // --- field editors ---
  function handleTextChange(field, text) {
    const item = baseItems.get(field.itemId);
    if (textLength(text) > field.maxLength) return;
    const { fits, fontSize } = fitText(item, text, field.minFontSize);
    setFitState((prev) => ({ ...prev, [field.id]: fits }));
    setFieldError(field.id, null);
    updateValues({ ...valuesRef.current, [field.id]: { text, fontSize } });
  }

  function handleColor(field, color) {
    updateValues({ ...valuesRef.current, [field.id]: { color } });
  }

  function handleCrop(field, patch) {
    const current = valuesRef.current[field.id];
    if (!current) return;
    updateValues({ ...valuesRef.current, [field.id]: { ...current, ...patch } });
  }

  async function handlePhoto(field, file) {
    setFieldError(field.id, null);
    setUploading((prev) => ({ ...prev, [field.id]: true }));
    try {
      const photo = await preparePhoto(file);
      const result = await pzApi.uploadPhoto({ linkToken, sessionKey, fieldId: field.id, data: await blobToBase64(photo.blob) });
      registerLocalPhoto(result.assetId, photo.blob, { width: result.width, height: result.height });
      setData((prev) => {
        const inUse = Object.values(valuesRef.current).map((v) => v?.uploadId);
        const uploads = Object.fromEntries(Object.entries(prev.session.uploads || {}).filter(([id, u]) => u.fieldId !== field.id || inUse.includes(id)));
        uploads[result.uploadId] = { width: result.width, height: result.height, fieldId: field.id };
        return { ...prev, session: { ...prev.session, uploads } };
      });
      updateValues({ ...valuesRef.current, [field.id]: { uploadId: result.uploadId, zoom: 1, focalX: 0.5, focalY: 0.5 } });
    } catch (err) {
      setFieldError(field.id, err.code || errorCode(err));
    } finally {
      setUploading((prev) => ({ ...prev, [field.id]: false }));
    }
  }

  function handleRemovePhoto(field) {
    const next = { ...valuesRef.current };
    delete next[field.id];
    updateValues(next);
  }

  // --- validation shared by Review/Submit/Download ---
  const problems = useMemo(() => {
    const out = {};
    fields.forEach((field) => {
      const v = values[field.id];
      if (field.type === "text") {
        const text = v ? v.text : field.defaultValue;
        if (field.required && !String(text || "").trim()) out[field.id] = "required";
        else if (fitState[field.id] === false) out[field.id] = "text_does_not_fit";
      } else if (field.type === "photo" && field.required && !v) {
        out[field.id] = "required";
      }
    });
    return out;
  }, [fields, values, fitState]);
  const hasProblems = Object.keys(problems).length > 0;

  function goToReview() {
    if (hasProblems) {
      setAttempted(true);
      setActiveFieldId(Object.keys(problems)[0]);
      document.getElementById(`pz-${Object.keys(problems)[0]}`)?.focus();
      return;
    }
    flushSave();
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function renderPreviewImage() {
    const page = personalized.pages[0];
    const canvas = await renderPageToCanvas({
      page,
      items: personalized.items,
      pixelScale: Math.min(1, 900 / page.width),
      backgroundFill: page.background || "#ffffff",
      availableAssetIds: new Set(collectAssetIds(personalized.items)),
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    canvas.width = 0;
    canvas.height = 0;
    return blob ? blobToBase64(blob) : null;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);
    if (!customer.name.trim() || !isValidEmail(customer.email.trim().toLowerCase())) {
      setSubmitError("customer_details");
      return;
    }
    setSubmitting(true);
    window.clearTimeout(saveTimer.current);
    pendingSave.current = null;
    if (!submitRequestId.current) submitRequestId.current = crypto.randomUUID().replace(/-/g, "");
    try {
      const previewImage = await renderPreviewImage().catch(() => null);
      const result = await pzApi.submit({
        linkToken,
        sessionKey,
        requestId: submitRequestId.current,
        values,
        customer: { name: customer.name.trim(), email: customer.email.trim() },
        preview: previewImage || undefined,
      });
      submitRequestId.current = null;
      applyServerState(result);
    } catch (err) {
      setSubmitError(errorCode(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownload(format) {
    setExportError(null);
    setExporting(format);
    try {
      await flushSave();
      const result = await pzApi.authorizeExport({ linkToken, sessionKey, format });
      await loadSessionAssets(result.assets);
      await loadDesignFonts(result.design);
      await exportPersonalizedDesign(result.design, format, result.filenameBase || template.name);
    } catch (err) {
      setExportError(errorCode(err));
    } finally {
      setExporting(null);
    }
  }

  function startRevision() {
    setStep("edit");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function copySessionLink() {
    try {
      await navigator.clipboard.writeText(personalizationSessionUrl(linkToken, sessionKey));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — the link is visible in the address bar
    }
  }

  // --- screens ---
  if (phase === "loading") {
    return (
      <Shell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-gray-500">
          <Loader2 size={24} className="animate-spin text-amber-600" />
          <p className="text-sm">{t.loading}</p>
        </div>
      </Shell>
    );
  }

  if (phase === "blocked" || phase === "error") {
    const message = t.blocked[blockReason] || t.blocked.generic;
    return (
      <Shell>
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
          {phase === "blocked" ? <PauseCircle size={32} className="text-amber-600" /> : <AlertCircle size={32} className="text-gray-400" />}
          {header?.name && <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{[header.businessName, header.name].filter(Boolean).join(" · ")}</p>}
          <h1 className="text-lg font-semibold text-gray-900">{message.title}</h1>
          <p className="text-sm leading-relaxed text-gray-500">{message.body}</p>
        </div>
      </Shell>
    );
  }

  const isApproval = template.mode === "approval";
  const reasonNotice = access.reason ? t.reason[access.reason] : null;
  const watermark = isApproval && status !== "approved" ? t.previewWatermark : null;
  const multiPage = personalized.pages.length > 1;

  return (
    <Shell>
      <header className="border-b border-gray-200 bg-white px-4 pb-3 pt-[calc(0.75rem+var(--safe-top))] sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            {template.businessName && <p className="truncate text-xs font-medium text-amber-700">{template.businessName}</p>}
            <h1 className="truncate text-base font-semibold text-gray-900 sm:text-lg">{template.name}</h1>
          </div>
          <SaveIndicator state={saveState} t={t} />
        </div>
      </header>

      {isOwnerPreview && (
        <div className="bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-800">{t.ownerPreviewBanner}</div>
      )}

      <main className="mx-auto grid max-w-6xl gap-6 px-4 pb-[calc(6rem+var(--safe-bottom))] pt-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="lg:sticky lg:top-4 lg:self-start" aria-label={t.previewLabel}>
          <DesignPreview design={personalized} pageId={pageId} highlightItemId={step === "edit" ? fields.find((f) => f.id === activeFieldId)?.itemId : null} watermark={watermark} maxHeight={560} />
          {multiPage && (
            <div className="mt-3 flex flex-wrap justify-center gap-1.5" role="tablist" aria-label={t.pagesLabel}>
              {personalized.pages.map((page, index) => (
                <button
                  key={page.id}
                  role="tab"
                  aria-selected={page.id === pageId}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${page.id === pageId ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  onClick={() => setPageId(page.id)}
                >
                  {page.name || t.pageN(index + 1)}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="min-w-0">
          {reasonNotice && (
            <div className="mb-4 flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <PauseCircle size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">{reasonNotice.title}</p>
                <p className="mt-0.5 text-amber-800">{reasonNotice.body}</p>
              </div>
            </div>
          )}

          <StatusCard status={status} note={data.session.note} isApproval={isApproval} t={t} onRevise={access.canEdit ? startRevision : null} />

          {step === "edit" && access.canEdit ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">{t.intro}</p>
              {fields.map((field) => (
                <FieldEditor
                  key={field.id}
                  field={field}
                  item={baseItems.get(field.itemId)}
                  value={values[field.id]}
                  upload={values[field.id]?.uploadId ? data.session.uploads?.[values[field.id].uploadId] : null}
                  problem={fieldErrors[field.id] || (attempted || problems[field.id] === "text_does_not_fit" ? problems[field.id] : null)}
                  uploading={!!uploading[field.id]}
                  active={activeFieldId === field.id}
                  onFocus={() => {
                    setActiveFieldId(field.id);
                    const item = baseItems.get(field.itemId);
                    if (item && item.pageId !== pageId) setPageId(item.pageId);
                  }}
                  onText={(text) => handleTextChange(field, text)}
                  onColor={(color) => handleColor(field, color)}
                  onPhoto={(file) => handlePhoto(field, file)}
                  onCrop={(patch) => handleCrop(field, patch)}
                  onRemovePhoto={() => handleRemovePhoto(field)}
                  t={t}
                />
              ))}
              {attempted && hasProblems && <p className="text-sm text-red-600">{t.fixProblems}</p>}
              <button
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                onClick={goToReview}
              >
                {t.continueToReview}
              </button>
            </div>
          ) : (
            <ReviewStep
              fields={fields}
              values={values}
              template={template}
              access={access}
              status={status}
              isApproval={isApproval}
              hasProblems={hasProblems}
              customer={customer}
              onCustomer={setCustomer}
              onSubmit={handleSubmit}
              submitting={submitting}
              submitError={submitError}
              onDownload={handleDownload}
              exporting={exporting}
              exportError={exportError}
              onBack={access.canEdit ? () => setStep("edit") : null}
              t={t}
            />
          )}

          <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-700">{t.saveLinkTitle}</p>
            <p className="mt-0.5 text-xs text-gray-500">{t.saveLinkBody}</p>
            <button className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100" onClick={copySessionLink}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t.copied : t.copyMyLink}
            </button>
          </div>
        </section>
      </main>
    </Shell>
  );
}

function Shell({ children }) {
  return <div className="min-h-screen bg-gray-50 text-gray-900">{children}</div>;
}

function SaveIndicator({ state, t }) {
  if (state === "saving" || state === "pending") {
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs text-gray-400">
        <Loader2 size={12} className="animate-spin" /> {t.saving}
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs text-gray-400">
        <Check size={12} /> {t.saved}
      </span>
    );
  }
  if (state === "error") return <span className="shrink-0 text-xs text-red-600">{t.saveFailed}</span>;
  return null;
}

function StatusCard({ status, note, isApproval, t, onRevise }) {
  if (!isApproval || status === "draft") return null;
  const config = {
    pending: { icon: Clock, tone: "border-blue-200 bg-blue-50 text-blue-900", ...t.status.pending },
    approved: { icon: CheckCircle2, tone: "border-green-200 bg-green-50 text-green-900", ...t.status.approved },
    changes_requested: { icon: MessageSquare, tone: "border-amber-200 bg-amber-50 text-amber-900", ...t.status.changes_requested },
  }[status];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <div className={`mb-4 rounded-xl border p-3 text-sm ${config.tone}`} role="status">
      <div className="flex gap-2.5">
        <Icon size={18} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">{config.title}</p>
          <p className="mt-0.5 opacity-90">{config.body}</p>
          {note && (
            <blockquote className="mt-2 whitespace-pre-wrap rounded-lg bg-white/70 p-2 text-sm">
              <span className="block text-xs font-medium opacity-70">{t.noteFromBusiness}</span>
              {note}
            </blockquote>
          )}
          {status === "changes_requested" && onRevise && (
            <button className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700" onClick={onRevise}>
              <RefreshCw size={14} /> {t.reviseDesign}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldShell({ field, problem, active, onFocus, t, children, counter }) {
  const message = problem ? t.problems[problem] || t.problems.generic : null;
  return (
    <div
      className={`rounded-xl border bg-white p-3.5 transition-colors ${problem ? "border-red-300" : active ? "border-amber-400" : "border-gray-200"}`}
      onFocusCapture={onFocus}
      onPointerDown={onFocus}
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={`pz-${field.id}`} className="text-sm font-medium text-gray-900">
          {field.label}
          {field.required ? <span className="ml-0.5 text-red-500" aria-hidden="true">*</span> : <span className="ml-1.5 text-xs font-normal text-gray-400">{t.optional}</span>}
        </label>
        {counter}
      </div>
      {field.instructions && <p className="mb-2 text-xs leading-relaxed text-gray-500">{field.instructions}</p>}
      {children}
      {message && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-red-600" role="alert">
          <AlertCircle size={14} className="mt-px shrink-0" /> {message}
        </p>
      )}
    </div>
  );
}

function FieldEditor({ field, item, value, upload, problem, uploading, active, onFocus, onText, onColor, onPhoto, onCrop, onRemovePhoto, t }) {
  const fileRef = useRef(null);
  if (field.type === "text") {
    const text = value ? value.text : field.defaultValue;
    const multiline = (item?.height || 0) > (item?.fontSize || 24) * 2.2 || text.includes("\n");
    const InputTag = multiline ? "textarea" : "input";
    return (
      <FieldShell
        field={field}
        problem={problem}
        active={active}
        onFocus={onFocus}
        t={t}
        counter={<span className={`text-xs ${textLength(text) >= field.maxLength ? "text-red-600" : "text-gray-400"}`}>{t.charCount(textLength(text), field.maxLength)}</span>}
      >
        <InputTag
          id={`pz-${field.id}`}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-base outline-none focus:border-amber-400 sm:text-sm"
          value={text}
          rows={multiline ? 3 : undefined}
          onChange={(event) => onText(event.target.value)}
          aria-invalid={!!problem}
          autoComplete="off"
        />
        {value && value.fontSize < (item?.fontSize || 24) && problem !== "text_does_not_fit" && (
          <p className="mt-1.5 text-xs text-gray-400">{t.textShrunk}</p>
        )}
      </FieldShell>
    );
  }

  if (field.type === "color") {
    const selected = value?.color || field.defaultValue;
    return (
      <FieldShell field={field} problem={problem} active={active} onFocus={onFocus} t={t}>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={field.label} id={`pz-${field.id}`}>
          {field.colors.map((color) => (
            <button
              key={color}
              role="radio"
              aria-checked={selected === color}
              aria-label={color}
              title={color}
              className={`h-10 w-10 rounded-full border border-black/10 ${selected === color ? "ring-2 ring-amber-500 ring-offset-2" : ""}`}
              style={{ backgroundColor: color }}
              onClick={() => onColor(color)}
            >
              {selected === color && <Check size={16} className="mx-auto" style={{ color: contrastColor(color) }} />}
            </button>
          ))}
        </div>
      </FieldShell>
    );
  }

  // photo
  return (
    <FieldShell field={field} problem={problem} active={active} onFocus={onFocus} t={t}>
      <input
        ref={fileRef}
        id={`pz-${field.id}`}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onPhoto(file);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
          {uploading ? t.uploading : value ? t.replacePhoto : t.uploadPhoto}
        </button>
        {value && !uploading && (
          <button className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100" onClick={onRemovePhoto}>
            {field.required ? t.removePhoto : t.useOriginalPhoto}
          </button>
        )}
      </div>
      {value && upload && item && <CropControls item={item} value={value} upload={upload} onCrop={onCrop} t={t} />}
    </FieldShell>
  );
}

function contrastColor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? "#111827" : "#ffffff";
}

// Zoom + drag-to-reposition for a replaced photo. The box keeps the shape
// the business designed (and its mask); only what shows inside it moves.
function CropControls({ item, value, upload, onCrop, t }) {
  const padRef = useRef(null);
  const drag = useRef(null);
  const aspect = (item.width || 1) / (item.height || 1);
  const crop = computeCoverCrop(upload.width, upload.height, item.width || 1, item.height || 1, value);

  function onPointerDown(event) {
    drag.current = { x: event.clientX, y: event.clientY, focalX: value.focalX, focalY: value.focalY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event) {
    if (!drag.current || !padRef.current) return;
    const rect = padRef.current.getBoundingClientRect();
    const dx = (event.clientX - drag.current.x) / rect.width;
    const dy = (event.clientY - drag.current.y) / rect.height;
    onCrop({
      focalX: Math.max(0, Math.min(1, drag.current.focalX - dx * crop.width)),
      focalY: Math.max(0, Math.min(1, drag.current.focalY - dy * crop.height)),
    });
  }
  function onPointerUp() {
    drag.current = null;
  }

  const objectUrl = useObjectUrlForAsset(uploadAssetId(value.uploadId));
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs text-gray-500">{t.dragToReposition}</p>
      <div
        ref={padRef}
        className="relative mx-auto w-full max-w-[220px] cursor-grab touch-none overflow-hidden rounded-lg bg-gray-100 ring-1 ring-black/10 active:cursor-grabbing"
        style={{
          aspectRatio: String(aspect),
          backgroundImage: objectUrl ? `url(${objectUrl})` : undefined,
          filter: PHOTO_FILTERS[value.filter] ? adjustmentsToCssFilter(PHOTO_FILTERS[value.filter]) : undefined,
          backgroundSize: `${100 / crop.width}% ${100 / crop.height}%`,
          backgroundPosition: `${crop.width < 1 ? (crop.x / (1 - crop.width)) * 100 : 0}% ${crop.height < 1 ? (crop.y / (1 - crop.height)) * 100 : 0}%`,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="img"
        aria-label={t.cropAreaLabel}
      />
      <label className="flex items-center gap-3 text-xs text-gray-600">
        <span className="w-16 shrink-0">{t.zoom}</span>
        <input type="range" min="1" max="4" step="0.05" value={value.zoom} onChange={(event) => onCrop({ zoom: Number(event.target.value) })} className="w-full accent-amber-600" />
      </label>
      <label className="flex items-center gap-3 text-xs text-gray-600">
        <span className="w-16 shrink-0">{t.horizontal}</span>
        <input type="range" min="0" max="1" step="0.01" value={value.focalX} onChange={(event) => onCrop({ focalX: Number(event.target.value) })} className="w-full accent-amber-600" />
      </label>
      <label className="flex items-center gap-3 text-xs text-gray-600">
        <span className="w-16 shrink-0">{t.vertical}</span>
        <input type="range" min="0" max="1" step="0.01" value={value.focalY} onChange={(event) => onCrop({ focalY: Number(event.target.value) })} className="w-full accent-amber-600" />
      </label>
      <PhotoFilterPicker objectUrl={objectUrl} selected={value.filter} onSelect={(filter) => onCrop({ filter })} t={t} />
    </div>
  );
}

const PHOTO_FILTER_CHOICES = [null, ...Object.keys(PHOTO_FILTERS)];

// One tap per filter; the thumbnails are a CSS approximation, the preview
// above draws the real thing.
function PhotoFilterPicker({ objectUrl, selected, onSelect, t }) {
  return (
    <div className="pt-1">
      <p className="mb-1.5 text-xs text-gray-600">{t.filter}</p>
      <div className="-m-1 flex gap-1 overflow-x-auto p-1" role="radiogroup" aria-label={t.filter}>
        {PHOTO_FILTER_CHOICES.map((key) => {
          const active = (selected || null) === key;
          return (
            <button
              key={key || "none"}
              role="radio"
              aria-checked={active}
              className={`flex shrink-0 flex-col items-center gap-1 rounded-lg p-1 ${active ? "ring-2 ring-amber-500" : "hover:bg-gray-100"}`}
              onClick={() => onSelect(key || undefined)}
            >
              {objectUrl ? (
                <img
                  src={objectUrl}
                  alt=""
                  className="h-12 w-12 rounded-md object-cover"
                  style={key ? { filter: adjustmentsToCssFilter(PHOTO_FILTERS[key]) } : undefined}
                />
              ) : (
                <div className="h-12 w-12 rounded-md bg-gray-100" />
              )}
              <span className="text-[10px] text-gray-500">{t.photoFilters[key || "none"]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function useObjectUrlForAsset(assetId) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let current = null;
    let cancelled = false;
    getAssetBlob(assetId).then((blob) => {
      if (cancelled || !blob) return;
      current = URL.createObjectURL(blob);
      setUrl(current);
    });
    return () => {
      cancelled = true;
      if (current) URL.revokeObjectURL(current);
    };
  }, [assetId]);
  return url;
}

function ReviewStep({ fields, values, template, access, status, isApproval, hasProblems, customer, onCustomer, onSubmit, submitting, submitError, onDownload, exporting, exportError, onBack, t }) {
  const showSubmitForm = isApproval && access.canSubmit && (status === "draft" || status === "changes_requested");
  const showDownloads = access.canExport;
  return (
    <div className="space-y-4">
      {onBack && (
        <button className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800" onClick={onBack}>
          <ArrowLeft size={16} /> {t.backToEdit}
        </button>
      )}
      <div className="rounded-xl border border-gray-200 bg-white p-3.5">
        <h2 className="text-sm font-semibold text-gray-900">{t.reviewTitle}</h2>
        <p className="mt-0.5 text-xs text-gray-500">{t.reviewBody}</p>
        <dl className="mt-3 divide-y divide-gray-100 text-sm">
          {fields.map((field) => {
            const v = values[field.id];
            let shown;
            if (field.type === "text") shown = (v ? v.text : field.defaultValue) || "—";
            else if (field.type === "color") shown = <span className="inline-flex items-center gap-1.5"><span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: v?.color || field.defaultValue }} />{v?.color || field.defaultValue}</span>;
            else shown = v ? t.photoAdded : t.photoOriginal;
            return (
              <div key={field.id} className="flex justify-between gap-3 py-2">
                <dt className="text-gray-500">{field.label}</dt>
                <dd className="min-w-0 truncate text-right font-medium text-gray-900">{shown}</dd>
              </div>
            );
          })}
        </dl>
      </div>

      {showSubmitForm && (
        <form className="space-y-3 rounded-xl border border-gray-200 bg-white p-3.5" onSubmit={onSubmit} noValidate>
          <h2 className="text-sm font-semibold text-gray-900">{t.submitTitle}</h2>
          <div>
            <label htmlFor="pz-customer-name" className="mb-1 block text-xs font-medium text-gray-600">{t.yourName}</label>
            <input id="pz-customer-name" autoComplete="name" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-base outline-none focus:border-amber-400 sm:text-sm" value={customer.name} maxLength={100} onChange={(event) => onCustomer({ ...customer, name: event.target.value })} />
          </div>
          <div>
            <label htmlFor="pz-customer-email" className="mb-1 block text-xs font-medium text-gray-600">{t.yourEmail}</label>
            <input id="pz-customer-email" type="email" autoComplete="email" inputMode="email" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-base outline-none focus:border-amber-400 sm:text-sm" value={customer.email} maxLength={200} onChange={(event) => onCustomer({ ...customer, email: event.target.value })} />
          </div>
          <p className="flex gap-1.5 text-xs leading-relaxed text-gray-500">
            <Lock size={13} className="mt-0.5 shrink-0" />
            {t.privacyNotice(template.businessName || t.theBusiness)}
          </p>
          {submitError && <p className="text-sm text-red-600" role="alert">{(t.problems[submitError] || t.problems.generic)}</p>}
          <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50" disabled={submitting || hasProblems}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {submitting ? t.submitting : status === "changes_requested" ? t.resubmit : t.submitForApproval}
          </button>
        </form>
      )}

      {isApproval && !showDownloads && status !== "draft" && status !== "changes_requested" && (
        <p className="flex items-center gap-1.5 text-xs text-gray-500"><Lock size={13} /> {t.downloadsAfterApproval}</p>
      )}

      {showDownloads && (
        <div className="rounded-xl border border-gray-200 bg-white p-3.5">
          <h2 className="text-sm font-semibold text-gray-900">{t.downloadTitle}</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {template.formats.map((format) => (
              <button
                key={format}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                onClick={() => onDownload(format)}
                disabled={!!exporting || hasProblems}
              >
                {exporting === format ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {FORMAT_LABELS[format]}
              </button>
            ))}
          </div>
          {exportError && <p className="mt-2 text-sm text-red-600" role="alert">{t.problems[exportError] || t.problems.generic}</p>}
        </div>
      )}
    </div>
  );
}
