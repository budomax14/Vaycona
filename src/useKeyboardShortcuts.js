import { useEffect } from "react";

export function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

const ARROW_DELTAS = {
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
};

export function useKeyboardShortcuts({
  onUndo,
  onRedo,
  onSaveNow,
  onCopy,
  onPaste,
  onCut,
  onDuplicate,
  onDelete,
  onSelectAll,
  onDeselect,
  onGroup,
  onUngroup,
  onNudge,
  onExitTextEdit,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  onExitGroupEntry,
  onCancelCrop,
  onToggleRulers,
  onToggleGuidesVisible,
  onDeleteSelectedGuide,
  onPrint,
}) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        // Cropping is the most deeply "nested" mode — check it first, ahead
        // of text-edit-exit/group-exit, so Escape always cancels an
        // in-progress crop before falling back to any other Escape meaning.
        if (onCancelCrop?.()) return;
        // Escape while inline-editing text exits edit mode (keeping the
        // object selected) rather than clearing the whole selection —
        // a contenteditable region is a typing target too, but this one
        // case needs different behavior than the generic isTypingTarget
        // gate below, so it's special-cased ahead of it.
        if (document.activeElement?.isContentEditable && onExitTextEdit) {
          onExitTextEdit();
          return;
        }
        // Escape backs out of a drilled-into group one level at a time
        // before falling back to clearing the whole selection (matches
        // "Escape returns to the parent group selection").
        if (onExitGroupEntry?.()) return;
        onDeselect?.();
        return;
      }

      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      // Undo/redo are checked ahead of the generic isTypingTarget gate
      // below so they still fire while the inline rich-text overlay (a
      // contentEditable, and so a "typing target" itself) has focus —
      // undo() / redo() flush any pending typing into its own entry first
      // (see App.jsx) so this follows the text-history rules (spec §5/§11)
      // rather than coalescing with in-progress typing. Real form fields
      // (rename inputs, the project-name field, etc.) are excluded here so
      // Cmd+Z there does the native field's own undo instead of destroying
      // input, per spec §11.
      if (mod && (key === "z" || key === "y")) {
        const el = document.activeElement;
        const isNativeFormField = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
        if (isNativeFormField) return;
        event.preventDefault();
        if (key === "z" && event.shiftKey) onRedo?.();
        else if (key === "z") onUndo?.();
        else onRedo?.(); // Ctrl+Y
        return;
      }

      // Save is checked ahead of the isTypingTarget gate too — Cmd/Ctrl+S
      // never types a character, so intercepting it while a form field or
      // the text overlay has focus can't destroy input (spec §14), and
      // doing so is what stops the browser's own "Save Page" dialog from
      // popping up while the editor is focused (spec §14).
      if (mod && key === "s") {
        event.preventDefault();
        onSaveNow?.();
        return;
      }

      // Print is intercepted the same way Save is above — Ctrl/Cmd+P
      // never types a character, and left alone the browser would print
      // the raw app chrome instead of the design, so this replaces that
      // with the same PDF pipeline "Print…" in the File menu uses.
      if (mod && key === "p") {
        event.preventDefault();
        onPrint?.();
        return;
      }

      // Guides toggle is checked ahead of isTypingTarget — like Undo/Save
      // above, Cmd/Ctrl+; never types a character, so it should work even
      // while a text field or the rich-text overlay has focus.
      if (mod && event.key === ";") {
        event.preventDefault();
        onToggleGuidesVisible?.();
        return;
      }
      // Shift+R (unlike the combos above) DOES type a character — a
      // capital "R" — so unlike Save/Undo/guides-toggle it must respect
      // isTypingTarget, otherwise every capital R typed into a text object
      // or any input field gets swallowed as "toggle rulers" instead of
      // being typed.
      if (!isTypingTarget(document.activeElement) && event.shiftKey && key === "r" && !mod) {
        event.preventDefault();
        onToggleRulers?.();
        return;
      }

      if (isTypingTarget(document.activeElement)) return;

      if (ARROW_DELTAS[event.key]) {
        event.preventDefault();
        // Precedence matches spec §55: Shift (large) is checked before Alt
        // (fine) — Shift is the far more common modifier and this avoids
        // ambiguity if both happen to be held.
        const size = event.shiftKey ? "large" : event.altKey ? "fine" : "standard";
        const { dx, dy } = ARROW_DELTAS[event.key];
        onNudge?.(dx, dy, size);
      } else if (key === "delete" && onDeleteSelectedGuide?.()) {
        // A selected guide (Guide Manager or ruler-click) takes Delete
        // before it falls through to "delete selected objects" below.
      } else if (mod && key === "g" && event.shiftKey) {
        event.preventDefault();
        onUngroup?.();
      } else if (mod && key === "g") {
        event.preventDefault();
        onGroup?.();
      } else if (mod && key === "d") {
        event.preventDefault();
        onDuplicate?.();
      } else if (mod && key === "x") {
        onCut?.();
      } else if (mod && key === "c") {
        onCopy?.();
      } else if (mod && key === "v") {
        onPaste?.();
      } else if (mod && key === "a") {
        event.preventDefault();
        onSelectAll?.();
      } else if (mod && key === "]" && event.shiftKey) {
        event.preventDefault();
        onBringToFront?.();
      } else if (mod && key === "]") {
        event.preventDefault();
        onBringForward?.();
      } else if (mod && key === "[" && event.shiftKey) {
        event.preventDefault();
        onSendToBack?.();
      } else if (mod && key === "[") {
        event.preventDefault();
        onSendBackward?.();
      } else if (key === "delete" || key === "backspace") {
        onDelete?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onUndo,
    onRedo,
    onSaveNow,
    onCopy,
    onPaste,
    onCut,
    onDuplicate,
    onDelete,
    onSelectAll,
    onDeselect,
    onGroup,
    onUngroup,
    onNudge,
    onExitTextEdit,
    onBringForward,
    onSendBackward,
    onBringToFront,
    onSendToBack,
    onExitGroupEntry,
    onCancelCrop,
    onToggleRulers,
    onToggleGuidesVisible,
    onDeleteSelectedGuide,
    onPrint,
  ]);
}
