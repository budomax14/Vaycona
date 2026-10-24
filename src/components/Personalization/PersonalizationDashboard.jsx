import React, { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Inbox,
  Loader2,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  UserPen,
  X,
} from "lucide-react";
import { db } from "../../firebase";
import { pzApi, errorCode, personalizationLinkUrl } from "../../personalization/api";
import { loadSessionAssets } from "../../personalization/sessionAssets";
import { loadDesignFonts } from "../../personalization/textFit";
import { exportPersonalizedDesign } from "../../personalization/exportDesign";
import { useLanguage } from "../../languageContext";
import { PERSONALIZATION_STRINGS } from "../../i18n/personalization";

const STATUS_FILTERS = ["all", "pending", "changes_requested", "approved"];

function formatDate(ts, language) {
  if (!ts) return "";
  return new Date(ts).toLocaleString(language === "fr" ? "fr-FR" : undefined, { dateStyle: "medium", timeStyle: "short" });
}

// The Business dashboard's personalization section: every published
// template with its link controls, and every customer submission with
// approve / request-changes / download. Reads come straight from Firestore
// (rules: owner-only); every change goes through the Cloud Functions,
// which re-check the Business plan.
export default function PersonalizationDashboard({ isOpen, onClose, uid, isBusiness, onOpenPricing }) {
  const { language } = useLanguage();
  const t = PERSONALIZATION_STRINGS[language].dashboard;
  const [tab, setTab] = useState("submissions");
  const [templates, setTemplates] = useState(null);
  const [submissions, setSubmissions] = useState(null);
  const [filter, setFilter] = useState("pending");
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(event) {
      if (event.key === "Escape" && !event.target.closest?.("input,textarea")) onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !uid) return undefined;
    const onError = () => setLoadError("load_failed");
    const unsubTemplates = onSnapshot(
      query(collection(db, "personalizationTemplates"), where("ownerUid", "==", uid), orderBy("updatedAt", "desc"), limit(100)),
      (snap) => setTemplates(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      onError
    );
    const unsubSubmissions = onSnapshot(
      query(collection(db, "personalizationSubmissions"), where("ownerUid", "==", uid), orderBy("submittedAt", "desc"), limit(200)),
      (snap) => setSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      onError
    );
    return () => {
      unsubTemplates();
      unsubSubmissions();
    };
  }, [isOpen, uid]);

  const pendingCount = useMemo(() => (submissions || []).filter((s) => s.status === "pending").length, [submissions]);
  const shownSubmissions = useMemo(() => (submissions || []).filter((s) => filter === "all" || s.status === filter), [submissions, filter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-50" role="dialog" aria-modal="true" aria-labelledby="pz-dashboard-title">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 px-4 pb-3 pt-[calc(0.75rem+var(--safe-top))] backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <UserPen size={18} className="text-amber-600" />
            <h1 id="pz-dashboard-title" className="text-base font-semibold text-gray-900">{t.title}</h1>
          </div>
          <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label={t.close}>
            <X size={18} />
          </button>
        </div>
        <div className="mx-auto mt-3 flex max-w-5xl gap-1" role="tablist">
          {["submissions", "templates"].map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === key ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}
              onClick={() => setTab(key)}
            >
              {key === "submissions" ? t.submissionsTab(pendingCount) : t.templatesTab}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 pb-[calc(2rem+var(--safe-bottom))] pt-4 sm:px-6">
        {!isBusiness && (
          <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">{t.inactiveTitle}</p>
              <p className="mt-0.5 text-amber-800">{t.inactiveBody}</p>
              {onOpenPricing && (
                <button className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700" onClick={onOpenPricing}>
                  {t.upgrade}
                </button>
              )}
            </div>
          </div>
        )}
        {loadError && <p className="text-sm text-red-600">{t.loadFailed}</p>}

        {tab === "templates" ? (
          templates === null ? (
            <Spinner />
          ) : templates.length === 0 ? (
            <Empty icon={UserPen} title={t.noTemplatesTitle} body={t.noTemplatesBody} />
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <TemplateCard key={template.id} template={template} isBusiness={isBusiness} language={language} t={t} />
              ))}
            </div>
          )
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((key) => (
                <button
                  key={key}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${filter === key ? "bg-amber-600 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"}`}
                  onClick={() => setFilter(key)}
                >
                  {t.filters[key]}
                </button>
              ))}
            </div>
            {submissions === null ? (
              <Spinner />
            ) : shownSubmissions.length === 0 ? (
              <Empty icon={Inbox} title={t.noSubmissionsTitle} body={t.noSubmissionsBody} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {shownSubmissions.map((submission) => (
                  <SubmissionCard key={submission.id} submission={submission} isBusiness={isBusiness} language={language} t={t} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-16 text-gray-400">
      <Loader2 size={22} className="animate-spin" />
    </div>
  );
}

function Empty({ icon: Icon, title, body }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <Icon size={28} className="text-gray-300" />
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <p className="max-w-sm text-sm text-gray-500">{body}</p>
    </div>
  );
}

function linkState(template) {
  if (template.linkStatus === "active" && template.linkExpiresAt && Date.now() > template.linkExpiresAt) return "expired";
  return template.linkStatus || "active";
}

function TemplateCard({ template, isBusiness, language, t }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const state = linkState(template);
  const tone = { active: "bg-green-50 text-green-700", paused: "bg-amber-50 text-amber-700", revoked: "bg-red-50 text-red-700", expired: "bg-gray-100 text-gray-600" }[state];
  const url = template.linkToken ? personalizationLinkUrl(template.linkToken) : null;

  async function run(kind, fn) {
    setError(null);
    setBusy(kind);
    try {
      await fn();
    } catch (err) {
      setError(errorCode(err));
    } finally {
      setBusy(null);
      setConfirmRevoke(false);
    }
  }

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-gray-900">{template.name}</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {t.templateMeta(template.currentVersionNumber, t.modeNames[template.mode], template.fieldCount)} · {t.updated(formatDate(template.updatedAt, language))}
          </p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{t.linkStatus[state]}</span>
      </div>
      {state !== "revoked" && url && (
        <div className="mt-3 flex flex-wrap gap-2">
          <ActionButton
            icon={copied ? Check : Copy}
            label={copied ? t.copied : t.copyLink}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              } catch {
                // clipboard blocked
              }
            }}
          />
          <ActionButton icon={ExternalLink} label={t.preview} onClick={() => window.open(`${url}?preview=1`, "_blank", "noopener")} />
          {isBusiness &&
            (template.linkStatus === "paused" ? (
              <ActionButton icon={PlayCircle} label={t.resume} busy={busy === "active"} onClick={() => run("active", () => pzApi.setLinkStatus({ templateId: template.id, status: "active" }))} />
            ) : (
              <ActionButton icon={PauseCircle} label={t.pause} busy={busy === "paused"} onClick={() => run("paused", () => pzApi.setLinkStatus({ templateId: template.id, status: "paused" }))} />
            ))}
          {isBusiness && <ActionButton icon={Ban} label={t.revoke} danger onClick={() => setConfirmRevoke(true)} />}
        </div>
      )}
      {state === "revoked" && <p className="mt-2 text-xs text-gray-500">{t.revokedHint}</p>}
      {confirmRevoke && (
        <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-800">
          <p>{t.revokeConfirm}</p>
          <div className="mt-2 flex gap-2">
            <button className="rounded-md bg-red-600 px-2.5 py-1 font-semibold text-white" onClick={() => run("revoked", () => pzApi.setLinkStatus({ templateId: template.id, status: "revoked" }))}>
              {busy === "revoked" ? <Loader2 size={12} className="animate-spin" /> : t.revoke}
            </button>
            <button className="rounded-md px-2.5 py-1 hover:bg-red-100" onClick={() => setConfirmRevoke(false)}>{t.cancel}</button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{t.errors[error] || t.errors.generic}</p>}
    </article>
  );
}

function ActionButton({ icon: Icon, label, onClick, busy, danger, primary, disabled }) {
  const tone = primary
    ? "border-amber-600 bg-amber-600 text-white hover:bg-amber-700"
    : danger
      ? "border-red-200 text-red-700 hover:bg-red-50"
      : "border-gray-200 text-gray-700 hover:bg-gray-50";
  return (
    <button className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium disabled:opacity-50 ${tone}`} onClick={onClick} disabled={busy || disabled}>
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
      {label}
    </button>
  );
}

function SubmissionCard({ submission, isBusiness, language, t }) {
  const [mode, setMode] = useState(null); // null | "changes"
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const status = submission.status;
  const statusTone = { pending: "bg-blue-50 text-blue-700", approved: "bg-green-50 text-green-700", changes_requested: "bg-amber-50 text-amber-700" }[status];
  const StatusIcon = { pending: Clock, approved: CheckCircle2, changes_requested: MessageSquare }[status] || Clock;

  async function review(decision) {
    setError(null);
    setBusy(decision);
    try {
      await pzApi.reviewSubmission({ submissionId: submission.id, decision, note: decision === "request_changes" ? note : "" });
      setMode(null);
      setNote("");
    } catch (err) {
      setError(errorCode(err));
    } finally {
      setBusy(null);
    }
  }

  async function download(format) {
    setError(null);
    setBusy(format);
    try {
      const result = await pzApi.getSubmissionDesign({ submissionId: submission.id });
      await loadSessionAssets(result.assets);
      await loadDesignFonts(result.design);
      await exportPersonalizedDesign(result.design, format, result.name);
    } catch (err) {
      setError(errorCode(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex aspect-[4/3] items-center justify-center bg-gray-100">
        {submission.previewUrl ? (
          <img src={submission.previewUrl} alt={t.previewAlt(submission.customerName)} className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <span className="text-xs text-gray-400">{t.noPreview}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{submission.customerName}</p>
            <a className="block truncate text-xs text-amber-700 hover:underline" href={`mailto:${submission.customerEmail}`}>{submission.customerEmail}</a>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone}`}>
            <StatusIcon size={11} /> {t.statusNames[status]}
          </span>
        </div>
        <p className="text-xs text-gray-500">
          {submission.templateName} · {t.versionShort(submission.versionNumber)}
          {submission.revision > 1 ? ` · ${t.revisionN(submission.revision)}` : ""}
        </p>
        <p className="text-xs text-gray-400">{t.submittedOn(formatDate(submission.submittedAt, language))}</p>
        {submission.note && status === "changes_requested" && (
          <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
            <span className="font-medium">{t.yourNote}</span> {submission.note}
          </p>
        )}

        {mode === "changes" ? (
          <div className="space-y-2">
            <label htmlFor={`note-${submission.id}`} className="block text-xs font-medium text-gray-600">{t.changesNoteLabel}</label>
            <textarea id={`note-${submission.id}`} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400" rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
            <div className="flex gap-2">
              <ActionButton icon={MessageSquare} label={t.sendChanges} primary busy={busy === "request_changes"} disabled={!note.trim()} onClick={() => review("request_changes")} />
              <ActionButton icon={X} label={t.cancel} onClick={() => setMode(null)} />
            </div>
          </div>
        ) : (
          <div className="mt-auto flex flex-wrap gap-2 pt-1">
            {isBusiness && status === "pending" && (
              <>
                <ActionButton icon={Check} label={t.approve} primary busy={busy === "approve"} onClick={() => review("approve")} />
                <ActionButton icon={MessageSquare} label={t.requestChanges} onClick={() => setMode("changes")} />
              </>
            )}
            {isBusiness && (
              <>
                <ActionButton icon={Download} label="PNG" busy={busy === "png"} onClick={() => download("png")} />
                <ActionButton icon={Download} label="PDF" busy={busy === "pdf"} onClick={() => download("pdf")} />
              </>
            )}
          </div>
        )}
        {error && <p className="text-xs text-red-600">{t.errors[error] || t.errors.generic}</p>}
      </div>
    </article>
  );
}
