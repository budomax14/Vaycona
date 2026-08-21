import React from "react";
import { AlertOctagon, Clipboard, RotateCw } from "lucide-react";

// Top-level render-error boundary (Phase 7C). Deliberately a class
// component — React only supports error boundaries via
// componentDidCatch/getDerivedStateFromError, no hook equivalent exists.
// On a serious render error: never leaves a blank white page, never
// touches the normal saved workspace, and offers exactly the safe
// recovery actions the spec calls for — no automatic reload loop.
export default class EditorErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Concise dev-console detail only — never the project's own content,
    // and never sent anywhere external (spec §17/§22).
    // eslint-disable-next-line no-console
    console.error("Editor render error:", error, info?.componentStack);
    // Also surfaced in the on-screen "technical details" panel (still
    // hidden behind that toggle by default) — so a real crash can be
    // reported accurately without anyone needing devtools access.
    this.setState({ componentStack: info?.componentStack });
    this.props.onError?.(error);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleCopyDetails = async () => {
    const text = [
      `${this.state.error?.name || "Error"}: ${this.state.error?.message || "Unknown error"}`,
      this.state.error?.stack || "",
      this.state.componentStack ? `Component stack:${this.state.componentStack}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API can be unavailable (permissions, insecure context) —
      // the details are already visible on-screen as a fallback.
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    const { lastSavedAt, hasNewerRecovery, onOpenSaved, onRecoverLatest } = this.props;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-100 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertOctagon size={22} />
          </div>
          <h1 className="text-lg font-semibold text-gray-900">Editor encountered a problem</h1>
          <p className="mt-1.5 text-sm text-gray-500">
            {lastSavedAt
              ? "Your last successful save is still available on your device."
              : "No successful save was found yet on this device."}
            {hasNewerRecovery && " Newer recovery data may also be available."}
          </p>

          <div className="mt-5 flex flex-col gap-2">
            <button
              autoFocus
              className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
              onClick={this.handleReload}
            >
              <span className="flex items-center justify-center gap-2">
                <RotateCw size={15} /> Reload editor
              </span>
            </button>
            {onOpenSaved && (
              <button
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={onOpenSaved}
              >
                Open last saved version
              </button>
            )}
            {hasNewerRecovery && onRecoverLatest && (
              <button
                className="rounded-lg border border-amber-200 px-4 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-50"
                onClick={onRecoverLatest}
              >
                Recover unsaved work
              </button>
            )}
          </div>

          <button
            type="button"
            className="mt-4 flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600"
            onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
            aria-expanded={this.state.showDetails}
          >
            {this.state.showDetails ? "Hide" : "Show"} technical details
          </button>
          {this.state.showDetails && (
            <div className="mt-2 rounded-lg bg-gray-50 p-3">
              <p className="break-words font-mono text-xs text-gray-600">
                {this.state.error?.name}: {this.state.error?.message}
              </p>
              {this.state.error?.stack && (
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap wrap-break-word font-mono text-[10px] leading-tight text-gray-500">
                  {this.state.error.stack}
                </pre>
              )}
              {this.state.componentStack && (
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap wrap-break-word font-mono text-[10px] leading-tight text-gray-500">
                  Component stack:{this.state.componentStack}
                </pre>
              )}
              <button
                className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-600 hover:underline"
                onClick={this.handleCopyDetails}
              >
                <Clipboard size={12} /> Copy error details
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
}
