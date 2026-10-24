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
import { SubscriptionProvider } from "./subscriptionContext";
import { ThemeProvider } from "./themeContext";
import { LanguageProvider } from "./languageContext";
import LoginPage from "./components/Auth/LoginPage";
import LandingPage from "./components/LandingPage";
import { isMobileApp } from "./platform";
import { parsePersonalizationHash } from "./personalization/api";

// The public Client Personalization page (#/p/<linkToken>/...) is for a
// business's customers, who have no Vaycona account — it renders outside
// the login gate, auth and subscription providers entirely, and is only
// loaded when such a link is opened.
const CustomerPersonalizationPage = React.lazy(() => import("./components/Personalization/CustomerPersonalizationPage"));

// Wraps the editor in a top-level error boundary (Phase 7C). Kept as its
// own component (rather than folded into App) specifically so it still
// works when App itself is what crashed — it independently checks for a
// saved record and a newer recovery snapshot rather than reading App's
// (possibly-broken) internal state.
export default function AppRoot() {
  if (parsePersonalizationHash(window.location.hash)) {
    return (
      <ThemeProvider>
        <LanguageProvider>
          <React.Suspense
            fallback={
              <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-400">
                <Loader2 size={24} className="animate-spin" />
              </div>
            }
          >
            <CustomerPersonalizationPage />
          </React.Suspense>
        </LanguageProvider>
      </ThemeProvider>
    );
  }
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <SubscriptionProvider>
            <Gate />
          </SubscriptionProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

// Real per-user login (Firebase Auth) in front of the entire app — both the
// normal editor and the admin section, which is gated by identity
// (authContext.jsx's isAdmin) rather than a second, separate wall. Signed-out
// visitors land on LandingPage first (marketing/orientation), then move to
// LoginPage once they click "Log in" or "Get started".
function Gate() {
  const { user, loading } = useAuth();
  // The apps open straight on login: the landing page is website marketing,
  // including plan prices the stores don't allow outside in-app purchase.
  // ?signup=1 / ?login=1 open those screens directly — the apps' "Sign up
  // on vaycona.com" button links to ?signup=1 (App.jsx handleGuestSignUp).
  const [authView, setAuthView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("signup")) return { screen: "login", mode: "signup" };
    if (params.has("login") || isMobileApp) return { screen: "login", mode: "signin" };
    return { screen: "landing", mode: "signin" };
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("signup") && !url.searchParams.has("login")) return;
    url.searchParams.delete("signup");
    url.searchParams.delete("login");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (!user) {
    if (authView.screen === "login") {
      return (
        <LoginPage
          initialMode={authView.mode}
          onBack={isMobileApp ? undefined : () => setAuthView({ screen: "landing", mode: "signin" })}
        />
      );
    }
    return (
      <LandingPage
        onLogin={() => setAuthView({ screen: "login", mode: "signin" })}
        onGetStarted={() => setAuthView({ screen: "login", mode: "signup" })}
      />
    );
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
