// Minimal hash-based route parser for the admin section. This app has no
// router dependency and doesn't need one for a single extra screen — this
// is ~30 lines, not a second routing system. Recognized routes:
//   #/admin                    -> admin dashboard
//   #/admin/new                -> create-template form
//   #/admin/templates/:id      -> template editor (edit an existing template)
// Anything else (including the empty hash) is the normal editor.

import { useEffect, useState } from "react";

export function parseAdminRoute(hash) {
  const raw = (hash || "").replace(/^#/, "");
  const parts = raw.split("/").filter(Boolean); // "admin/templates/abc" -> ["admin","templates","abc"]

  if (parts[0] !== "admin") return { page: "editor" };
  if (parts.length === 1) return { page: "admin-dashboard" };
  if (parts[1] === "new") return { page: "admin-new" };
  if (parts[1] === "templates" && parts[2]) return { page: "admin-edit", templateId: parts[2] };
  return { page: "admin-dashboard" };
}

export function navigateTo(hash) {
  window.location.hash = hash;
}

export function useHashRoute() {
  const [route, setRoute] = useState(() => parseAdminRoute(window.location.hash));

  useEffect(() => {
    function handleHashChange() {
      setRoute(parseAdminRoute(window.location.hash));
    }
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return route;
}
