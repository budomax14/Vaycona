// Each account keeps its own designs, uploads, templates, brand kits and
// recovery data on this device. The storage names those features use
// (constants.js, recoveryService.js, savedProjectsService.js,
// templateService.js, versionHistoryService.js) go through scoped(), which
// adds the signed-in account's suffix. Names are resolved once, when the
// modules load, so switching to another account reloads the page
// (enterAccountStorage) instead of re-opening every store live.
//
// Data saved before accounts were separated has no suffix. It belongs to the
// admin on any device the admin uses (unpublished template drafts live only
// there), otherwise to the first non-guest account that signs in. A guest's
// designs move with them to the account they then create.

const ACTIVE_KEY = "vaycona-storage-active-v1"; // { uid, anonymous }
const SCOPES_KEY = "vaycona-storage-scopes-v1"; // { [uid]: suffix }, "" = the unsuffixed names

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const active = readJson(ACTIVE_KEY, null);
const scopes = readJson(SCOPES_KEY, {});
const suffix = (active && scopes[active.uid]) || "";

export function scoped(name) {
  return suffix ? `${name}::${suffix}` : name;
}

function assignSuffix(user, isAdmin) {
  const uids = Object.keys(scopes);
  if (isAdmin) {
    // The admin takes the unsuffixed data back from whichever account
    // claimed it first on this device.
    for (const uid of uids) if (uid !== user.uid && scopes[uid] === "") scopes[uid] = uid;
    return "";
  }
  if (user.uid in scopes) return scopes[user.uid];
  if (user.isAnonymous) return user.uid;
  if (!uids.some((uid) => scopes[uid] === "")) return "";
  const guestSuffix = active?.anonymous ? scopes[active.uid] : null;
  if (guestSuffix && uids.filter((uid) => scopes[uid] === guestSuffix).length === 1) return guestSuffix;
  return user.uid;
}

// Call before rendering anything for a signed-in user. Returns true when the
// page is reloading into that account's storage — render nothing meanwhile.
export function enterAccountStorage(user, isAdmin) {
  scopes[user.uid] = assignSuffix(user, isAdmin);
  const saved =
    writeJson(SCOPES_KEY, scopes) && writeJson(ACTIVE_KEY, { uid: user.uid, anonymous: !!user.isAnonymous });
  // Without storage access nothing persists anyway; reloading would loop.
  if (!saved || scopes[user.uid] === suffix) return false;
  window.location.reload();
  return true;
}
