import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import App from "./App";
import AdminApp from "./AdminApp";
import EditorErrorBoundary from "./components/EditorErrorBoundary";
import { readSavedRecord } from "./autosaveService";
import { getNewestValidSnapshot, requestSkipRecoveryOnNextLoad, requestForceRecoveryOnNextLoad } from "./recoveryService";
import { WORKSPACE_STORAGE_KEY } from "./constants";
import { BrandKitProvider } from "./brandKitContext";
import { useHashRoute } from "./adminRoute";
import { AuthProvider, useAuth } from "./authContext";
import { ThemeProvider } from "./themeContext";
import { LanguageProvider } from "./languageContext";
import LoginPage from "./components/Auth/LoginPage";

// Wraps the editor in a top-level error boundary (Phase 7C). Kept as its
// own component (rather than folded into App) specifically so it still
// works when App itself is what crashed — it independently checks for a
// saved record and a newer recovery snapshot rather than reading App's
// (possibly-broken) internal state.
export default function AppRoot() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

// Real per-user login (Firebase Auth) in front of the entire app — both the
// normal editor and the admin section, which is gated by identity
// (authContext.jsx's isAdmin) rather than a second, separate wall.
function Gate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const [recoveryInfo, setRecoveryInfo] = useState({ lastSavedAt: null, hasNewerRecovery: false });
  const route = useHashRoute();

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const saved = readSavedRecord(WORKSPACE_STORAGE_KEY);
      const snapshot = await getNewestValidSnapshot();
      if (cancelled) return;
      setRecoveryInfo({
        lastSavedAt: saved?.updatedAt || null,
        hasNewerRecovery: !!snapshot && (!saved || snapshot.createdAt > (saved.updatedAt || 0)),
      });
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  // Template Management Admin (#/admin*) is a fully separate tree from the
  // normal workspace editor — same BrandKitProvider (App, used internally
  // for template editing, depends on it) and the same crash boundary
  // pattern, but deliberately WITHOUT the workspace recovery props above:
  // those point at WORKSPACE_STORAGE_KEY, which has nothing to do with
  // whatever template an admin might be editing.
  if (route.page !== "editor") {
    return (
      <EditorErrorBoundary>
        <BrandKitProvider>
          <AdminApp />
        </BrandKitProvider>
      </EditorErrorBoundary>
    );
  }

  return (
    <EditorErrorBoundary
      lastSavedAt={recoveryInfo.lastSavedAt}
      hasNewerRecovery={recoveryInfo.hasNewerRecovery}
      onOpenSaved={() => {
        requestSkipRecoveryOnNextLoad();
        window.location.reload();
      }}
      onRecoverLatest={
        recoveryInfo.hasNewerRecovery
          ? () => {
              requestForceRecoveryOnNextLoad();
              window.location.reload();
            }
          : undefined
      }
    >
      <BrandKitProvider>
        <App />
      </BrandKitProvider>
    </EditorErrorBoundary>
  );
}
