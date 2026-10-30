import React from "react";
import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";
import "./index.css";

if (typeof navigator !== "undefined" && /Mac|iPhone|iPod|iPad/.test(navigator.userAgent)) {
  document.documentElement.classList.add("platform-mac");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

requestAnimationFrame(() => {
  invoke("show_main_window").catch(() => {});
});
