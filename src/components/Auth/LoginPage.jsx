import React, { useState } from "react";
import { Loader2, LogIn, UserPlus, X } from "lucide-react";
import { useAuth } from "../../authContext";
import { TERMS_AND_CONDITIONS } from "../../termsContent";

// Friendly copy for the Firebase Auth error codes users actually hit here
// (email/password only) — everything else falls back to a generic message
// rather than leaking raw Firebase error text.
function friendlyAuthError(error) {
  switch (error?.code) {
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/user-not-found":
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/popup-closed-by-user":
      return null; // user just closed the Google popup — not a real error
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function LoginPage({ onBack, initialMode = "signin" }) {
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const [mode, setMode] = useState(initialMode); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const isSignUp = mode === "signup";

  async function handleGoogleSignIn() {
    setError(null);
    setNotice(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const message = friendlyAuthError(err);
      if (message) setError(message);
    } finally {
      setGoogleBusy(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (isSignUp) {
        await signUp(email.trim(), password);
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Enter your email above first, then click \"Forgot password?\".");
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email.trim());
      setNotice("Password reset email sent — check your inbox.");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#07070d]">
      {/* Brand panel — hidden on small screens, where there's no room for
          it alongside the form (see the matching lg:flex below). */}
      <div className="relative hidden w-1/2 items-center justify-center overflow-hidden border-r border-white/5 lg:flex">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-purple-600/25 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-orange-500/15 blur-[100px]" />
        <div className="relative flex flex-col items-center px-10 text-center">
          <img src="/login-brand-composite.png" alt="" aria-hidden="true" className="w-full max-w-md" />
          <h2 className="-mt-6 text-2xl font-bold text-white">Design without limits.</h2>
          <p className="mt-2 max-w-sm text-sm text-slate-400">
            Templates, charts, AI-generated art, and a full editor — everything you need to create, in one place.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <button
            type="button"
            onClick={onBack}
            className="mb-4 flex items-center gap-2.5"
            disabled={!onBack}
          >
            <img src="/logo.png" alt="Vaycona" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
            <span className="text-sm font-semibold text-slate-100">Vaycona</span>
          </button>

          <h1 className="text-lg font-semibold text-white">
            {isSignUp ? "Create an account" : "Log in"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {isSignUp ? "Sign up to start designing." : "Welcome back — sign in to continue."}
          </p>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleBusy || busy}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
          >
            {googleBusy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                <path
                  fill="#FFC107"
                  d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C33.9 6 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
                />
                <path
                  fill="#FF3D00"
                  d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C33.9 6 29.2 4 24 4c-7.7 0-14.3 4.4-17.7 10.7z"
                />
                <path
                  fill="#4CAF50"
                  d="M24 44c5.1 0 9.8-2 13.3-5.2l-6.1-5.2C29.2 35.4 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"
                />
                <path
                  fill="#1976D2"
                  d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.1 5.2C40.5 36.4 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z"
                />
              </svg>
            )}
            Continue with Google
          </button>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-slate-500">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <form className="space-y-3" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">Email</span>
              <input
                autoFocus
                type="email"
                autoComplete="email"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">Password</span>
              <input
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
              />
            </label>

            {!isSignUp && (
              <button
                type="button"
                className="text-xs font-medium text-amber-700 hover:underline"
                onClick={handleForgotPassword}
                disabled={busy}
              >
                Forgot password?
              </button>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}
            {notice && <p className="text-xs text-emerald-600">{notice}</p>}

            <button
              type="submit"
              disabled={busy || !email.trim() || !password}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:pointer-events-none disabled:opacity-40"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : isSignUp ? (
                <UserPlus size={16} />
              ) : (
                <LogIn size={16} />
              )}
              {isSignUp ? "Sign up" : "Log in"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-400">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              className="font-medium text-amber-700 hover:underline"
              onClick={() => {
                setMode(isSignUp ? "signin" : "signup");
                setError(null);
                setNotice(null);
              }}
            >
              {isSignUp ? "Log in" : "Sign up"}
            </button>
          </p>

          <p className="mt-3 text-center text-xs text-slate-500">
            <button
              type="button"
              className="font-medium text-slate-400 hover:text-amber-700 hover:underline"
              onClick={() => setShowTerms(true)}
            >
              Terms &amp; Conditions
            </button>
          </p>
        </div>
      </div>

      {showTerms && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowTerms(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-hidden bg-[#ffffff] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h2 className="text-sm font-semibold text-black">Terms &amp; Conditions</h2>
              <button
                type="button"
                onClick={() => setShowTerms(false)}
                aria-label="Close"
                className="p-1 text-black hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto px-5 py-4 text-sm leading-relaxed text-black whitespace-pre-wrap">
              {TERMS_AND_CONDITIONS}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
