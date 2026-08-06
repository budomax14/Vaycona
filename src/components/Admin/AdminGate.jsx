import React, { useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { hasAdminPasscode, setAdminPasscode, verifyAdminPasscode } from "../../adminAuth";

// Gate in front of every #/admin* route. First run: set a local passcode.
// After that: enter it. Not a real auth system — see adminAuth.js — just a
// deliberate wall so the admin dashboard isn't one accidental click away
// from the normal editor.
export default function AdminGate({ onUnlocked, onExit }) {
  const isFirstRun = !hasAdminPasscode();
  const [code, setCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (isFirstRun) {
      if (code.trim() !== confirmCode.trim()) {
        setError("Passcodes don't match.");
        return;
      }
      setBusy(true);
      const result = await setAdminPasscode(code);
      setBusy(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onUnlocked();
      return;
    }

    setBusy(true);
    const ok = await verifyAdminPasscode(code);
    setBusy(false);
    if (!ok) {
      setError("Incorrect passcode.");
      return;
    }
    onUnlocked();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <ShieldCheck size={22} />
          </div>
          <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onExit} aria-label="Back to editor">
            <X size={16} />
          </button>
        </div>

        <h1 className="text-lg font-semibold text-gray-900">
          {isFirstRun ? "Set an admin passcode" : "Template Admin"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isFirstRun
            ? "This protects the template management page on this device. There are no user accounts in this app — anyone with this passcode can manage templates here."
            : "Enter your passcode to manage templates."}
        </p>

        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">Passcode</span>
            <input
              autoFocus
              type="password"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          {isFirstRun && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">Confirm passcode</span>
              <input
                type="password"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                value={confirmCode}
                onChange={(event) => setConfirmCode(event.target.value)}
              />
            </label>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy || !code.trim() || (isFirstRun && !confirmCode.trim())}
            className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:pointer-events-none disabled:opacity-40"
          >
            {isFirstRun ? "Set passcode & continue" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
