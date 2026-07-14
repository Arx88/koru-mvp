import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./ui/App";
import { DevCardPreview } from "./ui/DevCardPreview";
import "./style.css";

const isPreview = new URLSearchParams(location.search).get("preview") === "cards";

// 🔴 Service Worker registration para notificaciones push y background sync
if ("serviceWorker" in navigator && !isPreview) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Silent fail — SW is optional, app works without it
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isPreview ? <DevCardPreview /> : <App />}
  </React.StrictMode>,
);
