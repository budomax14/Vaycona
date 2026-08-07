import React, { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import App from "./App";
import { useHashRoute, navigateTo } from "./adminRoute";
import { useAuth } from "./authContext";
import {
  getTemplateById,
  createTemplate,
  updateTemplateSettings,
  publishTemplate,
  unpublishTemplate,
  templatePublishBlockedReason,
} from "./templateService";
import AdminDashboard from "./components/Admin/AdminDashboard";
import AdminTemplateFormDialog from "./components/Admin/AdminTemplateFormDialog";

// Owns everything under the #/admin* hash routes: the dashboard, the
// "create new template" flow, and the template editor (a real <App/>
// instance running in editorMode="template" — see App.jsx). Mounted by
// AppRoot.jsx as a sibling of the normal <App/> instance, never both at
// once, so there's exactly one editor mounted (and therefore one
// autosave/history/etc. instance) at any time.
//
// Access is gated by Firebase Auth identity (authContext.jsx's isAdmin —
// the logged-in account's email matching ADMIN_EMAIL), the same login form
// every user goes through. There is no separate admin passcode anymore.
export default function AdminApp() {
  const route = useHashRoute();
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <div className="desktop-only-shell flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50 p-4 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600">
          <ShieldAlert size={22} />
        </div>
        <h1 className="text-lg font-semibold text-gray-900">Admin access only</h1>
        <p className="max-w-sm text-sm text-gray-500">Your account isn't authorized to manage templates.</p>
        <button
          className="mt-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          onClick={() => navigateTo("")}
        >
          Back to editor
        </button>
      </div>
    );
  }

  if (route.page === "admin-new") {
    return <AdminCreateTemplateScreen />;
  }
  if (route.page === "admin-edit" && route.templateId) {
    return <AdminTemplateEditorRoute templateId={route.templateId} />;
  }
  return (
    <AdminDashboard
      onCreateNew={() => navigateTo("#/admin/new")}
      onEditTemplate={(id) => navigateTo(`#/admin/templates/${id}`)}
      onExitAdmin={() => navigateTo("")}
    />
  );
}

function AdminCreateTemplateScreen() {
  async function handleCreate({ name, description, category, tags, width, height, background, tier }) {
    const pageId = crypto.randomUUID();
    const data = {
      pages: [{ id: pageId, name: "Page 1", width, height, background }],
      activePageId: pageId,
      scale: 1,
      items: [],
      guides: [],
      snapToGuides: true,
    };
    const template = await createTemplate({
      kind: "project",
      name,
      description,
      category,
      tags,
      data,
      assetIds: [],
      pageCount: 1,
      objectCount: 0,
      groupCount: 0,
      pageWidth: width,
      pageHeight: height,
      thumbnail: null,
      status: "draft",
      createdBy: "admin",
      tier,
    });
    navigateTo(`#/admin/templates/${template.id}`);
  }

  return (
    <div className="desktop-only-shell min-h-screen bg-gray-50">
      <AdminTemplateFormDialog
        isOpen
        mode="create"
        initialValues={null}
        onClose={() => navigateTo("#/admin")}
        onSubmit={handleCreate}
      />
    </div>
  );
}

function AdminTemplateEditorRoute({ templateId }) {
  const [template, setTemplate] = useState(undefined); // undefined = loading, null = not found
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toast, setToast] = useState(null);

  async function refresh() {
    const found = await getTemplateById(templateId);
    setTemplate(found || null);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  }

  if (template === undefined) {
    return <div className="desktop-only-shell flex min-h-screen items-center justify-center text-sm text-gray-400">Loading template…</div>;
  }
  if (template === null) {
    return (
      <div className="desktop-only-shell flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-gray-500">
        <p>This template couldn't be found — it may have been deleted.</p>
        <button className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700" onClick={() => navigateTo("#/admin")}>
          Back to dashboard
        </button>
      </div>
    );
  }
  return (
    <>
      <App
        key={templateId}
        editorMode="template"
        templateSession={{
          templateId,
          initialData: template.data,
          templateName: template.name,
          builtIn: template.builtIn,
          onNameChange: async (name) => {
            await updateTemplateSettings(templateId, { name });
          },
          onSaveDraft: () => showToast("Draft saved."),
          onPublish: (result) => {
            if (result?.ok) {
              showToast(template.builtIn ? "Saved." : "Published — now visible in the template gallery.");
              navigateTo("#/admin");
            } else {
              showToast(result?.error || "Could not publish this template.");
            }
          },
          onCancel: () => navigateTo("#/admin"),
          onOpenSettings: () => setIsSettingsOpen(true),
        }}
      />

      <AdminTemplateSettingsOverlay
        isOpen={isSettingsOpen}
        templateId={templateId}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={async (patch) => {
          await refresh();
          setIsSettingsOpen(false);
          showToast(patch.publishChanged ? patch.publishMessage : "Settings saved.");
        }}
      />

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}

// Fetches the latest template record itself (rather than trusting a
// possibly-stale prop) each time it opens, so the settings dialog always
// reflects what's actually persisted, including background/thumbnail set
// moments earlier by the editor's own Save Draft.
function AdminTemplateSettingsOverlay({ isOpen, templateId, onClose, onSaved }) {
  const [record, setRecord] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    getTemplateById(templateId).then(setRecord);
  }, [isOpen, templateId]);

  if (!isOpen || !record) return null;

  const initialValues = {
    name: record.name,
    description: record.description,
    category: record.category,
    tags: record.tags,
    background: record.data?.pages?.[0]?.background || "#ffffff",
    thumbnail: record.thumbnail,
    status: record.status || "draft",
    tier: record.tier || "free",
  };

  async function handleSubmit({ name, description, category, tags, background, thumbnail, status, tier }) {
    await updateTemplateSettings(templateId, { name, description, category, tags, background, thumbnail, tier });
    let publishChanged = false;
    let publishMessage = "Settings saved.";
    if (status !== (record.status || "draft") && record.builtIn) {
      publishChanged = true;
      publishMessage = "Built-in templates are always published and can't be unpublished.";
    } else if (status !== (record.status || "draft")) {
      if (status === "published") {
        const result = await publishTemplate(templateId);
        publishChanged = true;
        publishMessage = result.ok ? "Published — now visible in the template gallery." : result.error;
      } else {
        await unpublishTemplate(templateId);
        publishChanged = true;
        publishMessage = "Unpublished — removed from the gallery, not deleted.";
      }
    }
    onSaved({ publishChanged, publishMessage });
  }

  return (
    <AdminTemplateFormDialog
      isOpen
      mode="edit"
      initialValues={initialValues}
      publishBlockedReason={templatePublishBlockedReason(record)}
      onClose={onClose}
      onSubmit={handleSubmit}
    />
  );
}
