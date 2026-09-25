// Must stay the first import: ES modules evaluate imports before this
// file's own body, and App.jsx calls crypto.randomUUID at module load.
import "./polyfills";
import React from "react";
import ReactDOM from "react-dom/client";
import AppRoot from "./AppRoot";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>
);
