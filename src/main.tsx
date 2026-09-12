import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./ui/App";
import { DevCardPreview } from "./ui/DevCardPreview";
import { migrateLocalStorageNamespace, migrateIndexedDbNamespaces } from "./domain/namespaceMigration";
import { LEGACY_DB_MIGRATION as LEGACY_STATE_DB } from "./domain/persistence";
import { LEGACY_DB_MIGRATION as LEGACY_OFFLINE_DB } from "./domain/offlineCache";
import { LEGACY_DB_MIGRATION as LEGACY_ATTACHMENTS_DB } from "./domain/attachments";
import "./koru-motion.css";
import "./style.css";
import "./style-v75-bubbles.css";
import "./michi-cards.css";
import "./michi-v8.css";
import "./michi-pages.css";
import "./michi-world.css";
import "./ui/michi/michi-memory-history.css";

const isPreview = new URLSearchParams(location.search).get("preview") === "cards";

// 🔴 Service Worker registration para notificaciones push y background sync
if ("serviceWorker" in navigator && !isPreview) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Silent fail — SW is optional, app works without it
    });
  });
}

// 🐱 Migración de namespace koru.* → michi.*: corre ANTES del primer render
// para que ningún módulo lea storage viejo. Idempotente y sin riesgo de boot
// bloqueado (el delete de DBs viejas es fire-and-forget).
async function bootstrap() {
  migrateLocalStorageNamespace();
  await migrateIndexedDbNamespaces([LEGACY_STATE_DB, LEGACY_OFFLINE_DB, LEGACY_ATTACHMENTS_DB]);
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      {isPreview ? <DevCardPreview /> : <App />}
    </React.StrictMode>,
  );
}
void bootstrap();
