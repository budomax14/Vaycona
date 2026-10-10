// Where the editor is running: the website, the desktop app (electron/,
// which exposes `window.vayconaDesktop` from its preload), or the iOS /
// Android app (Capacitor). The editor behaves like the website everywhere
// except the few things a native shell can't do the browser way — file
// downloads, the share sheet, and popup-based sign-in.
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export const isDesktopApp = typeof window !== "undefined" && !!window.vayconaDesktop;
export const isMobileApp = Capacitor.isNativePlatform();
export const isNativeApp = isDesktopApp || isMobileApp;

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Writes the files to the app's cache and opens the OS share sheet —
// on iOS/Android that's where "Save to Files", AirPrint, Photos, Mail etc.
// live. Rejects with an AbortError when the user dismisses the sheet, the
// same as the Web Share API, so callers' existing cancel handling applies.
async function shareFilesNatively(files, title) {
  const uris = [];
  for (const file of files) {
    const name = file.name || "Vaycona file";
    const { uri } = await Filesystem.writeFile({
      path: `shared/${Date.now()}-${name}`,
      data: await blobToBase64(file),
      directory: Directory.Cache,
      recursive: true,
    });
    uris.push(uri);
  }
  try {
    await Share.share({ title, dialogTitle: title, files: uris });
  } catch (err) {
    if (/cancel/i.test(err?.message || "")) throw new DOMException("Share canceled", "AbortError");
    throw err;
  }
}

// Opens a web page outside the app: a new tab on the website, the default
// browser in the desktop app (electron/main.cjs denies the popup and hands it
// to the OS), and Safari / the system browser in the mobile apps, where
// Capacitor sends navigations to other sites out of the WebView.
export function openExternalUrl(url) {
  if (isMobileApp) window.location.href = url;
  else window.open(url, "_blank", "noopener");
}

// Saves a generated file (export, project package, brand kit, …). The
// website and desktop app use a normal download (Electron shows a Save
// dialog for it); the mobile apps hand it to the share sheet, since a
// WebView has no downloads folder.
export function saveBlob(blob, filename) {
  if (isMobileApp) {
    const file = new File([blob], filename, { type: blob.type });
    return shareFilesNatively([file], filename).catch((err) => {
      if (err?.name !== "AbortError") throw err;
    });
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Released once the download has had a moment to start.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// The mobile WebViews either lack the Web Share API or can't share files
// with it, so route navigator.share/canShare through the native share sheet.
// This keeps App.jsx's share/print flows (which already go through the
// share sheet on iOS) working unchanged in the apps.
export function installNativeShare() {
  if (!isMobileApp) return;
  navigator.canShare = (data) => !!data;
  navigator.share = async (data = {}) => {
    if (data.files?.length) return shareFilesNatively(data.files, data.title);
    try {
      await Share.share({ title: data.title, text: data.text, url: data.url, dialogTitle: data.title });
    } catch (err) {
      if (/cancel/i.test(err?.message || "")) throw new DOMException("Share canceled", "AbortError");
      throw err;
    }
  };
}

// iOS zooms the whole page in whenever a text field under 16px gets focus,
// leaving the layout cut off at the side. The apps lock page zoom instead —
// the editor canvas has its own pinch-zoom, so nothing is lost.
export function lockNativePageZoom() {
  if (!isMobileApp) return;
  document
    .querySelector('meta[name="viewport"]')
    ?.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover");
}
