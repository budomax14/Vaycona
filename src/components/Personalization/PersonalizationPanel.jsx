import React, { useEffect, useMemo, useRef, useState } from "react";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import {
  AlertCircle,
  Ban,
  Check,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  LayoutDashboard,
  Link2,
  Loader2,
  Lock,
  Palette,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Sparkles,
  Type,
  UserPen,
  X,
} from "lucide-react";
import { db } from "../../firebase";
import {
  EXPORT_FORMAT_OPTIONS,
  LIMITS,
  baseFontSize,
  fieldsFromItems,
  itemPlainText,
  normalizeHex,
  supportedFieldTypes,
  validateFieldDefinitions,
} from "../../../functions/personalizationCore.mjs";
import { pzApi, errorCode, personalizationLinkUrl } from "../../personalization/api";
import { publishPersonalization } from "../../personalization/publish";
import { fitText } from "../../personalization/textFit";
import { useLanguage } from "../../languageContext";
import { PERSONALIZATION_STRINGS } from "../../i18n/personalization";

const TYPE_ICONS = { text: Type, photo: ImageIcon, color: Palette };
const FORMAT_LABELS = { png: "PNG", jpeg: "JPG", pdf: "PDF" };
const EXPIRY_CHOICES = [0, 7, 30, 90, 365];

function defaultFieldFor(type, item, t) {
  if (type === "text") {
    const base = baseFontSize(item);
    return { type, label: t.defaultLabels.text, instructions: "", required: true, maxLength: Math.max(LIMITS.defaultMaxLength, itemPlainText(item).length), minFontSize: Math.max(LIMITS.minFontFloor, Math.round(base * 0.6)), defaultValue: itemPlainText(item) };
  }
  if (type === "photo") return { type, label: t.defaultLabels.photo, instructions: "", required: true };
  const fill = normalizeHex(item.fill) || "#111827";
  return { type, label: t.defaultLabels.color, instructions: "", required: false, colors: [fill], defaultValue: fill };
}

// Editor side panel: mark elements "Customer can edit", configure each
// field, set the template's mode/formats, publish versions and manage the
// link. Field settings are stored on the elements themselves
// (item.personalizationFields) through `onUpdateItemFields`, so they save,
// undo and travel with the project like any other property.
export default function PersonalizationPanel({
  isOpen,
  onClose,
  uid,
  isBusiness,
  businessBlockedReason, // "upgrade" | "payment" | "guest"
  onOpenPricing,
  items,
  pages,
  selectedIds,
  projectKey,
  projectName,
  onUpdateItemFields,
  onSelectItem,
  onOpenDashboard,
}) {
  const { language } = useLanguage();
  const t = PERSONALIZATION_STRINGS[language].panel;
  const [template, setTemplate] = useState(null);
  const [settings, setSettings] = useState(null);
  const [publishing, setPublishing] = useState(null);
  const [publishError, setPublishError] = useState(null);
  const [linkBusy, setLinkBusy] = useState(null);
  const [linkError, setLinkError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(event) {
      if (event.key === "Escape" && !event.target.closest?.("input,textarea,select")) onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // The template this project was published as (one per project).
  useEffect(() => {
    if (!isOpen || !uid || !isBusiness || !projectKey) return undefined;
    const q = query(collection(db, "personalizationTemplates"), where("ownerUid", "==", uid), where("projectKey", "==", projectKey), limit(1));
    return onSnapshot(
      q,
      (snap) => setTemplate(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }),
      () => setTemplate(null)
    );
  }, [isOpen, uid, isBusiness, projectKey]);

  useEffect(() => {
    if (!isOpen) return;
    setSettings((prev) =>
      prev && prev.projectKey === projectKey
        ? prev
        : {
            projectKey,
            name: template?.name || projectName || "",
            businessName: template?.businessName || "",
            mode: template?.mode || "approval",
            formats: template?.formats || ["png", "pdf"],
            linkExpiresInDays: template?.linkExpiresInDays || 0,
          }
    );
  }, [isOpen, projectKey, projectName, template]);

  const fieldList = useMemo(() => fieldsFromItems(items), [items]);
  const fieldCheck = useMemo(() => validateFieldDefinitions(fieldList, { pages, items }), [fieldList, pages, items]);
  const selectedItem = selectedIds.length === 1 ? items.find((it) => it.id === selectedIds[0]) : null;

  if (!isOpen) return null;

  async function handlePublish() {
    setPublishError(null);
    if (fieldCheck.errors.length) {
      setPublishError({ code: "fields_invalid", errors: fieldCheck.errors });
      return;
    }
    setPublishing({ stage: "uploading", done: 0, total: 1 });
    try {
      await publishPersonalization({ uid, projectKey, templateId: template?.id, pages, items, settings, onProgress: setPublishing });
    } catch (err) {
      setPublishError({ code: err.code === "asset_missing" ? "asset_missing" : errorCode(err), errors: err.details?.errors || [] });
    } finally {
      setPublishing(null);
    }
  }

  async function linkAction(kind, fn) {
    setLinkError(null);
    setLinkBusy(kind);
    try {
      await fn();
    } catch (err) {
      setLinkError(errorCode(err));
    } finally {
      setLinkBusy(null);
      setConfirmRevoke(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(personalizationLinkUrl(template.linkToken));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — the field is selectable
    }
  }

  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col rounded-t-2xl border-gray-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-0 sm:right-0 sm:top-0 sm:max-h-none sm:w-[380px] sm:rounded-none sm:border-l"
      aria-labelledby="pz-panel-title"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 pb-3 pt-[calc(0.75rem+var(--safe-top))] sm:pt-3">
        <div className="flex items-center gap-2">
          <UserPen size={18} className="text-amber-600" />
          <h2 id="pz-panel-title" className="text-sm font-semibold text-gray-900">{t.title}</h2>
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">{t.businessBadge}</span>
        </div>
        <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label={t.close}>
          <X size={18} />
        </button>
      </div>

      {!isBusiness ? (
        <LockedState t={t} reason={businessBlockedReason} onOpenPricing={onOpenPricing} />
      ) : (
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 pb-[max(1rem,var(--safe-bottom))]">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t.selectedElement}</h3>
            {!selectedItem ? (
              <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">{selectedIds.length > 1 ? t.selectOne : t.selectHint}</p>
            ) : supportedFieldTypes(selectedItem).length === 0 ? (
              <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">{t.unsupported}</p>
            ) : (
              <div className="space-y-3">
                {supportedFieldTypes(selectedItem).map((type) => (
                  <FieldToggle
                    key={`${selectedItem.id}-${type}`}
                    item={selectedItem}
                    type={type}
                    t={t}
                    onChange={(nextFields) => onUpdateItemFields(selectedItem.id, nextFields)}
                    errors={fieldCheck.errors.filter((e) => e.fieldId === `${type}-${selectedItem.id}`)}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t.fieldsHeading(fieldList.length)}</h3>
            {fieldList.length === 0 ? (
              <p className="text-sm text-gray-500">{t.noFields}</p>
            ) : (
              <ul className="space-y-1">
                {fieldList.map((field) => {
                  const Icon = TYPE_ICONS[field.type];
                  const item = items.find((it) => it.id === field.itemId);
                  const pageIndex = pages.findIndex((p) => p.id === item?.pageId);
                  const hasError = fieldCheck.errors.some((e) => e.fieldId === `${field.type}-${field.itemId}`);
                  return (
                    <li key={`${field.type}-${field.itemId}`}>
                      <button
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-gray-50 ${selectedItem?.id === field.itemId ? "bg-amber-50" : ""}`}
                        onClick={() => onSelectItem(field.itemId)}
                      >
                        <Icon size={14} className="shrink-0 text-gray-400" />
                        <span className="min-w-0 flex-1 truncate text-gray-800">{field.label || t.untitledField}</span>
                        {pages.length > 1 && <span className="shrink-0 text-xs text-gray-400">{t.pageN(pageIndex + 1)}</span>}
                        {hasError && <AlertCircle size={14} className="shrink-0 text-red-500" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-2 flex items-start gap-1.5 text-xs text-gray-400">
              <Lock size={12} className="mt-0.5 shrink-0" /> {t.lockedNote}
            </p>
          </section>

          {settings && (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t.settingsHeading}</h3>
              <TextInput label={t.templateName} value={settings.name} maxLength={LIMITS.templateNameMax} onChange={(name) => setSettings({ ...settings, name })} />
              <TextInput label={t.businessName} hint={t.businessNameHint} value={settings.businessName} maxLength={LIMITS.businessNameMax} onChange={(businessName) => setSettings({ ...settings, businessName })} />
              <fieldset>
                <legend className="mb-1.5 text-xs font-medium text-gray-600">{t.modeLabel}</legend>
                {["download", "approval"].map((mode) => (
                  <label key={mode} className={`mb-1.5 flex cursor-pointer gap-2.5 rounded-xl border p-2.5 ${settings.mode === mode ? "border-amber-400 bg-amber-50/50" : "border-gray-200"}`}>
                    <input type="radio" name="pz-mode" className="mt-0.5 accent-amber-600" checked={settings.mode === mode} onChange={() => setSettings({ ...settings, mode })} />
                    <span>
                      <span className="block text-sm font-medium text-gray-900">{t.modes[mode].title}</span>
                      <span className="block text-xs text-gray-500">{t.modes[mode].body}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend className="mb-1.5 text-xs font-medium text-gray-600">{t.formatsLabel}</legend>
                <div className="flex gap-2">
                  {EXPORT_FORMAT_OPTIONS.map((format) => (
                    <label key={format} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm">
                      <input
                        type="checkbox"
                        className="accent-amber-600"
                        checked={settings.formats.includes(format)}
                        onChange={(event) =>
                          setSettings({ ...settings, formats: event.target.checked ? [...settings.formats, format] : settings.formats.filter((f) => f !== format) })
                        }
                      />
                      {FORMAT_LABELS[format]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">{t.expiryLabel}</span>
                <select
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400"
                  value={settings.linkExpiresInDays}
                  onChange={(event) => setSettings({ ...settings, linkExpiresInDays: Number(event.target.value) })}
                >
                  {EXPIRY_CHOICES.map((days) => (
                    <option key={days} value={days}>{t.expiry(days)}</option>
                  ))}
                </select>
              </label>
            </section>
          )}

          <section className="space-y-2">
            {publishError && <PublishError error={publishError} t={t} />}
            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              onClick={handlePublish}
              disabled={!!publishing || fieldList.length === 0 || !settings?.name?.trim() || !settings?.formats.length}
            >
              {publishing ? <Loader2 size={16} className="animate-spin" /> : template ? <RefreshCw size={16} /> : <Link2 size={16} />}
              {publishing ? t.publishingProgress(publishing) : template ? t.publishNewVersion : t.createLink}
            </button>
            <p className="text-xs leading-relaxed text-gray-400">{template ? t.versionNote(template.currentVersionNumber) : t.firstPublishNote}</p>
          </section>

          {template?.linkToken && (
            <section className="space-y-2 rounded-xl border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">{t.linkHeading}</h3>
                <LinkStatusBadge status={template.linkStatus} expired={!!template.linkExpiresAt && Date.now() > template.linkExpiresAt} t={t} />
              </div>
              {template.linkStatus !== "revoked" ? (
                <>
                  <input readOnly className="w-full truncate rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-600" value={personalizationLinkUrl(template.linkToken)} onFocus={(event) => event.target.select()} aria-label={t.linkHeading} />
                  <div className="grid grid-cols-2 gap-2">
                    <SmallButton icon={copied ? Check : Copy} label={copied ? t.copied : t.copyLink} onClick={copyLink} />
                    <SmallButton icon={ExternalLink} label={t.preview} onClick={() => window.open(`${personalizationLinkUrl(template.linkToken)}?preview=1`, "_blank", "noopener")} />
                    {template.linkStatus === "paused" ? (
                      <SmallButton icon={PlayCircle} label={t.resume} busy={linkBusy === "active"} onClick={() => linkAction("active", () => pzApi.setLinkStatus({ templateId: template.id, status: "active" }))} />
                    ) : (
                      <SmallButton icon={PauseCircle} label={t.pause} busy={linkBusy === "paused"} onClick={() => linkAction("paused", () => pzApi.setLinkStatus({ templateId: template.id, status: "paused" }))} />
                    )}
                    <SmallButton icon={Ban} label={t.revoke} danger busy={linkBusy === "revoked"} onClick={() => setConfirmRevoke(true)} />
                  </div>
                  {confirmRevoke && (
                    <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-800">
                      <p>{t.revokeConfirm}</p>
                      <div className="mt-2 flex gap-2">
                        <button className="rounded-md bg-red-600 px-2.5 py-1 font-semibold text-white" onClick={() => linkAction("revoked", () => pzApi.setLinkStatus({ templateId: template.id, status: "revoked" }))}>{t.revoke}</button>
                        <button className="rounded-md px-2.5 py-1 text-red-800 hover:bg-red-100" onClick={() => setConfirmRevoke(false)}>{t.cancel}</button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-500">{t.revokedNote}</p>
                  <SmallButton icon={Plus} label={t.newLink} busy={linkBusy === "new"} onClick={() => linkAction("new", () => pzApi.regenerateLink({ templateId: template.id }))} />
                </>
              )}
              {linkError && <p className="text-xs text-red-600">{t.errors[linkError] || t.errors.generic}</p>}
            </section>
          )}

          <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={onOpenDashboard}>
            <LayoutDashboard size={16} /> {t.openDashboard}
          </button>
        </div>
      )}
    </aside>
  );
}

function LockedState({ t, reason, onOpenPricing }) {
  return (
    <div className="flex-1 overflow-y-auto px-5 py-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
        <Lock size={22} className="text-amber-600" />
      </div>
      <h3 className="mt-3 text-base font-semibold text-gray-900">{t.locked.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{reason === "payment" ? t.locked.payment : t.locked.body}</p>
      <ul className="mx-auto mt-4 max-w-xs space-y-2 text-left text-sm text-gray-600">
        {t.locked.points.map((point) => (
          <li key={point} className="flex gap-2">
            <Sparkles size={14} className="mt-0.5 shrink-0 text-amber-600" /> {point}
          </li>
        ))}
      </ul>
      {reason !== "payment" &&
        (onOpenPricing ? (
          <button className="mt-5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700" onClick={onOpenPricing}>
            {t.locked.upgrade}
          </button>
        ) : (
          <p className="mt-5 text-xs text-gray-400">{t.locked.upgradeOnWeb}</p>
        ))}
    </div>
  );
}

function LinkStatusBadge({ status, expired, t }) {
  const key = status === "active" && expired ? "expired" : status;
  const tone = { active: "bg-green-50 text-green-700", paused: "bg-amber-50 text-amber-700", revoked: "bg-red-50 text-red-700", expired: "bg-gray-100 text-gray-600" }[key];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{t.linkStatus[key]}</span>;
}

function SmallButton({ icon: Icon, label, onClick, busy, danger }) {
  return (
    <button
      className={`flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium disabled:opacity-50 ${danger ? "border-red-200 text-red-700 hover:bg-red-50" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
      onClick={onClick}
      disabled={busy}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
      {label}
    </button>
  );
}

function PublishError({ error, t }) {
  return (
    <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-800" role="alert">
      <p className="font-semibold">{t.errors[error.code] || t.errors.generic}</p>
      {error.errors?.length > 0 && (
        <ul className="mt-1 list-disc pl-4">
          {error.errors.slice(0, 6).map((e, i) => (
            <li key={i}>{t.fieldErrors[typeof e === "string" ? e : e.code] || (typeof e === "string" ? e : e.code)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TextInput({ label, hint, value, onChange, maxLength, multiline }) {
  const Tag = multiline ? "textarea" : "input";
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <Tag
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
        value={value}
        maxLength={maxLength}
        rows={multiline ? 2 : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && <span className="mt-1 block text-xs text-gray-400">{hint}</span>}
    </label>
  );
}

// One "Customer can edit" switch (per field type the element supports)
// plus that field's settings. Edits are kept as a local draft and written
// to the element (one undo step) when typing pauses or the input blurs.
function FieldToggle({ item, type, t, onChange, errors }) {
  const fields = item.personalizationFields || [];
  const stored = fields.find((f) => f.type === type) || null;
  const [draft, setDraft] = useState(stored);
  const timer = useRef(null);
  const Icon = TYPE_ICONS[type];

  useEffect(() => {
    setDraft(stored);
    // Re-sync when the element changes or an undo/redo replaces the field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, JSON.stringify(stored)]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function write(nextField) {
    const others = (item.personalizationFields || []).filter((f) => f.type !== type);
    onChange(nextField ? [...others, nextField] : others);
  }

  function edit(patch, { immediate = false } = {}) {
    const next = { ...draft, ...patch };
    setDraft(next);
    window.clearTimeout(timer.current);
    if (immediate) write(next);
    else timer.current = window.setTimeout(() => write(next), 500);
  }

  function flush() {
    window.clearTimeout(timer.current);
    if (draft && JSON.stringify(draft) !== JSON.stringify(stored)) write(draft);
  }

  const enabled = !!stored;
  const fit = type === "text" && draft ? fitText(item, draft.defaultValue ?? itemPlainText(item), draft.minFontSize ?? 4) : null;

  return (
    <div className={`rounded-xl border p-3 ${enabled ? "border-amber-300" : "border-gray-200"}`} onBlur={flush}>
      <label className="flex cursor-pointer items-center gap-2.5">
        <Icon size={16} className="shrink-0 text-gray-500" />
        <span className="flex-1">
          <span className="block text-sm font-medium text-gray-900">{t.canEdit[type]}</span>
          <span className="block text-xs text-gray-500">{t.canEditHint[type]}</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="h-4 w-4 accent-amber-600"
          checked={enabled}
          onChange={(event) => {
            const next = event.target.checked ? defaultFieldFor(type, item, t) : null;
            setDraft(next);
            write(next);
          }}
        />
      </label>

      {enabled && draft && (
        <div className="mt-3 space-y-2.5 border-t border-gray-100 pt-3">
          <TextInput label={t.fieldLabel} value={draft.label || ""} maxLength={LIMITS.labelMax} onChange={(label) => edit({ label })} />
          <TextInput label={t.instructions} value={draft.instructions || ""} maxLength={LIMITS.instructionsMax} multiline onChange={(instructions) => edit({ instructions })} />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" className="accent-amber-600" checked={!!draft.required} onChange={(event) => edit({ required: event.target.checked }, { immediate: true })} />
            {t.required}
          </label>

          {type === "text" && (
            <>
              <TextInput label={t.defaultText} value={draft.defaultValue ?? ""} multiline onChange={(defaultValue) => edit({ defaultValue })} />
              <div className="grid grid-cols-2 gap-2">
                <NumberInput label={t.charLimit} value={draft.maxLength} min={1} max={LIMITS.textMaxLengthCap} onChange={(maxLength) => edit({ maxLength })} />
                <NumberInput label={t.minFontSize(baseFontSize(item))} value={draft.minFontSize} min={LIMITS.minFontFloor} max={baseFontSize(item)} onChange={(minFontSize) => edit({ minFontSize })} />
              </div>
              <p className="text-xs text-gray-400">{t.fitNote}</p>
              {fit && !fit.fits && <p className="text-xs text-red-600">{t.defaultDoesNotFit}</p>}
            </>
          )}

          {type === "color" && <PaletteEditor draft={draft} item={item} t={t} onChange={(patch) => edit(patch, { immediate: true })} />}

          {errors.length > 0 && (
            <ul className="space-y-0.5 text-xs text-red-600">
              {errors.map((e, i) => (
                <li key={i}>{t.fieldErrors[e.code] || e.code}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function NumberInput({ label, value, min, max, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
        value={value ?? ""}
        min={min}
        max={max}
        onChange={(event) => {
          const n = Number(event.target.value);
          if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, Math.round(n))));
        }}
      />
    </label>
  );
}

function PaletteEditor({ draft, item, t, onChange }) {
  const [adding, setAdding] = useState(normalizeHex(item.fill) || "#111827");
  const colors = draft.colors || [];
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-gray-600">{t.approvedColors}</span>
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => (
          <div key={color} className="group relative">
            <button
              className={`h-8 w-8 rounded-full border border-black/10 ${draft.defaultValue === color ? "ring-2 ring-amber-500 ring-offset-2" : ""}`}
              style={{ backgroundColor: color }}
              title={t.setDefaultColor(color)}
              aria-label={t.setDefaultColor(color)}
              onClick={() => onChange({ defaultValue: color })}
            />
            {colors.length > 1 && (
              <button
                className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-gray-900 text-white group-hover:flex"
                aria-label={t.removeColor(color)}
                onClick={() => {
                  const next = colors.filter((c) => c !== color);
                  onChange({ colors: next, defaultValue: draft.defaultValue === color ? next[0] : draft.defaultValue });
                }}
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}
      </div>
      {colors.length < LIMITS.maxColors && (
        <div className="mt-2 flex items-center gap-2">
          <input type="color" className="h-8 w-10 cursor-pointer rounded border border-gray-200 bg-white" value={adding} onChange={(event) => setAdding(event.target.value)} aria-label={t.pickColor} />
          <button
            className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => {
              const hex = normalizeHex(adding);
              if (hex && !colors.includes(hex)) onChange({ colors: [...colors, hex] });
            }}
          >
            <Plus size={12} /> {t.addColor}
          </button>
        </div>
      )}
      <p className="mt-1.5 text-xs text-gray-400">{t.paletteHint}</p>
    </div>
  );
}
