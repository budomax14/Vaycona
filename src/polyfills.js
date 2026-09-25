// crypto.randomUUID only exists in secure contexts (https/localhost) and
// Safari 15.4+. Opening the dev server from a phone over the LAN (plain
// http) or an older iPhone would otherwise throw as soon as App.jsx loads
// (it calls randomUUID at module level) — a blank screen. getRandomValues
// is available everywhere.
if (typeof crypto !== "undefined" && typeof crypto.randomUUID !== "function" && typeof crypto.getRandomValues === "function") {
  crypto.randomUUID = function randomUUID() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
}
