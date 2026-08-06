// Text presets (sidebar "add new text with this style") and project text
// styles (apply to an already-placed object) share the same shape — a
// bag of the object's own whole-style fields — so one object can serve
// both purposes below.
//
// "Apply a project text style" copies these values onto the object
// (documented Phase 4 behavior — not a live link back to the style, see
// plan). This is the simpler, explicitly-permitted option; a live-link
// system would need a style-id + override-tracking model that's out of
// scope for this phase.

export const TEXT_PRESETS = [
  { key: "heading", label: "Heading", text: "Add a heading", fontSize: 40, fontWeight: "bold", align: "center", lineHeight: 1.1, letterSpacing: 0, width: 400, height: 70, autoSize: "auto-height" },
  { key: "subheading", label: "Subheading", text: "Add a subheading", fontSize: 26, fontWeight: "bold", align: "center", lineHeight: 1.15, letterSpacing: 0, width: 380, height: 55, autoSize: "auto-height" },
  { key: "body", label: "Body", text: "Add a little bit of body text", fontSize: 18, fontWeight: "normal", align: "left", lineHeight: 1.4, letterSpacing: 0, width: 320, height: 80, autoSize: "auto-height" },
  { key: "quote", label: "Quote", text: "“A quote can say it best.”", fontSize: 24, fontWeight: "normal", italic: true, align: "center", lineHeight: 1.3, letterSpacing: 0, width: 360, height: 90, autoSize: "auto-height" },
  { key: "caption", label: "Caption", text: "Add a caption", fontSize: 14, fontWeight: "normal", align: "left", lineHeight: 1.3, letterSpacing: 0.2, width: 260, height: 30, autoSize: "auto-height" },
  { key: "label", label: "Label", text: "LABEL", fontSize: 12, fontWeight: "bold", align: "left", textTransform: "uppercase", letterSpacing: 1.5, lineHeight: 1.2, width: 140, height: 24, autoSize: "auto-width" },
  { key: "buttonText", label: "Button text", text: "Click here", fontSize: 16, fontWeight: "bold", align: "center", lineHeight: 1.2, letterSpacing: 0.3, width: 160, height: 30, autoSize: "auto-width" },
  { key: "title", label: "Title", text: "Add a title", fontSize: 56, fontWeight: "bold", align: "center", lineHeight: 1.05, letterSpacing: -0.5, width: 500, height: 90, autoSize: "auto-height" },
  { key: "subtitle", label: "Subtitle", text: "Add a subtitle", fontSize: 22, fontWeight: "normal", align: "center", lineHeight: 1.2, letterSpacing: 0, width: 400, height: 45, autoSize: "auto-height" },
];

export function getPresetByKey(key) {
  return TEXT_PRESETS.find((p) => p.key === key);
}

// Basic project-level style set — same "copy values" application model.
// Users apply these to an existing selected text object via the toolbar's
// "Styles" menu; editing the style definitions themselves is out of scope
// for this phase (schema is ready for it: a flat, serializable field bag).
export const DEFAULT_PROJECT_TEXT_STYLES = [
  { key: "title", label: "Title", fontFamily: "Arial", fontSize: 56, fontWeight: "bold", align: "center", lineHeight: 1.05, letterSpacing: -0.5, fill: "#111827" },
  { key: "heading", label: "Heading", fontFamily: "Arial", fontSize: 40, fontWeight: "bold", align: "left", lineHeight: 1.1, letterSpacing: 0, fill: "#111827" },
  { key: "subheading", label: "Subheading", fontFamily: "Arial", fontSize: 26, fontWeight: "bold", align: "left", lineHeight: 1.15, letterSpacing: 0, fill: "#374151" },
  { key: "body", label: "Body", fontFamily: "Arial", fontSize: 18, fontWeight: "normal", align: "left", lineHeight: 1.4, letterSpacing: 0, fill: "#111827" },
  { key: "caption", label: "Caption", fontFamily: "Arial", fontSize: 14, fontWeight: "normal", align: "left", lineHeight: 1.3, letterSpacing: 0.2, fill: "#6b7280" },
];
