// Lets the web app know it's running inside the desktop shell (see
// src/platform.js). Keep this tiny — the editor should behave like the
// website unless a feature genuinely needs a desktop-specific path.
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("vayconaDesktop", { platform: process.platform });
