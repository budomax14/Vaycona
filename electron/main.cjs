// Desktop shell for Vaycona (macOS / Windows / Linux). Loads the same Vite
// build the website ships, so the editor itself has no desktop-only code
// paths beyond the small `window.vayconaDesktop` bridge in preload.cjs.
//
// The built app is served from a fixed origin (APP_ORIGIN) by intercepting
// plain http requests to that host instead of loading file:// URLs:
//   - Firebase Auth only allows popups/redirects from http(s) origins, and
//     "localhost" is in every Firebase project's authorized domains.
//   - IndexedDB (local projects, assets, autosave) is keyed by origin, so a
//     fixed origin keeps users' work across launches. Never change APP_ORIGIN
//     after release or everyone's local projects disappear.
//   - Stripe checkout's success/cancel redirects land back inside the app.
// Nothing actually listens on the port, so there's no collision risk.
const { app, BrowserWindow, protocol, net, shell, session } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

const APP_HOST = "localhost:39021";
const APP_ORIGIN = `http://${APP_HOST}`;
// The website's Hosting rewrites /api/* to Cloud Functions (firebase.json);
// the desktop app forwards those same paths to the live site.
const API_ORIGIN = "https://vaycona-editor.web.app";
const DEV_URL = process.env.VAYCONA_DEV_URL; // set by `npm run desktop:dev`
const DIST_DIR = path.join(__dirname, "..", "dist");

// Google refuses OAuth sign-in from user agents that look like an embedded
// browser, so present as plain Chrome.
app.userAgentFallback = app.userAgentFallback
  .replace(/\s*Electron\/\S+/, "")
  .replace(new RegExp(`\\s*${app.getName()}\\/\\S+`, "i"), "");

if (!app.requestSingleInstanceLock()) app.quit();

function serveApp() {
  session.defaultSession.protocol.handle("http", async (request) => {
    const url = new URL(request.url);
    if (url.host !== APP_HOST) return net.fetch(request, { bypassCustomProtocolHandlers: true });

    if (url.pathname.startsWith("/api/")) {
      return net.fetch(API_ORIGIN + url.pathname + url.search, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        duplex: "half",
        bypassCustomProtocolHandlers: true,
      });
    }

    let filePath = path.normalize(path.join(DIST_DIR, decodeURIComponent(url.pathname)));
    // Unknown paths fall back to index.html (hash routing handles the rest);
    // the startsWith check also blocks ../ escapes out of dist.
    if (!filePath.startsWith(DIST_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(DIST_DIR, "index.html");
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

// Popups the app legitimately opens itself: Firebase's Google sign-in
// handler (needs window.opener to report back) and the blank window the
// print flow writes a PDF into (App.jsx / printDelivery.js).
function isInAppPopup(url) {
  if (url === "" || url === "about:blank") return true;
  const { hostname } = new URL(url);
  return hostname === "vaycona-editor.firebaseapp.com" || hostname === "accounts.google.com";
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "Vaycona",
    backgroundColor: "#111827",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
    },
  });

  win.once("ready-to-show", () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isInAppPopup(url)) {
      return { action: "allow", overrideBrowserWindowOptions: { width: 520, height: 680, autoHideMenuBar: true } };
    }
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  win.loadURL(DEV_URL || `${APP_ORIGIN}/`);
  return win;
}

app.on("second-instance", () => {
  const [win] = BrowserWindow.getAllWindows();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(() => {
  if (!DEV_URL) serveApp();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
