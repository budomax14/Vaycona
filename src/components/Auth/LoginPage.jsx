import React, { useState } from "react";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "../../authContext";

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
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function LoginPage() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const isSignUp = mode === "signup";

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
    <div
      className="flex min-h-screen items-center justify-center bg-slate-50 bg-cover bg-center p-4"
      style={{ backgroundImage: "url(/bckground.PNG)" }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-xl backdrop-blur-md">
        <div className="mb-4 flex items-center gap-2.5">
          <img src="/logo.png" alt="Vaycona" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
          <span className="text-sm font-semibold text-slate-100">Vaycona</span>
        </div>

        <h1 className="text-lg font-semibold text-white">
          {isSignUp ? "Create an account" : "Log in"}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {isSignUp ? "Sign up to start designing." : "Welcome back — sign in to continue."}
        </p>

        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
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
      </div>
    </div>
  );
}
