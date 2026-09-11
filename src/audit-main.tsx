import { createRoot } from "react-dom/client";
import type { UiBlock } from "./domain/types";
import { KoruProvider } from "./ui/KoruProvider";
import { KoruUnifiedCard } from "./ui/cards/unified/KoruUnifiedCard";
import { AUDIT_BLOCKS, AUDIT_LIST } from "./audit-data";
import "./style.css";
import "./michi-cards.css";
import "./koru-motion.css";

// ============================================================================
// AUDIT HARNESS — renderiza UNA card por vez para captura y juicio.
//   ?mode=list                → expone window.__AUDIT__ = { types: [...] }
//   ?type=<block_type>        → renderiza la card colapsada (lista de UNA card,
//                               réplica del fondo del chat para contexto visual)
// El flujo interior se prueba TAPANDO la card (mismo path del usuario real:
// KoruUnifiedCard → open → KoruDetailScreen → lecturaInteriorFor).
// ============================================================================

const params = new URLSearchParams(location.search);
const mode = params.get("mode") ?? "card";
const type = params.get("type") ?? "weather";

if (mode === "list") {
  (window as any).__AUDIT__ = { types: AUDIT_LIST, blocks: AUDIT_BLOCKS.map(b => ({ type: b.type, source: b.source })) };
  document.body.innerHTML = `<pre>${JSON.stringify((window as any).__AUDIT__, null, 1)}</pre>`;
} else {
  const entry = AUDIT_BLOCKS.find(b => b.type === type);
  const root = document.getElementById("root")!;

  if (!entry) {
    document.body.innerHTML = `UNKNOWN TYPE: ${type}`;
  } else {
    // Réplica mínima del lienzo del chat (fondo de la app real en claro):
    // la card se monta igual que en TalkOverlay — dentro de la burbuja de Michi.
    createRoot(root).render(
      <KoruProvider>
        <div
          id="audit-stage"
          style={{
            minHeight: "100vh",
            width: "100%",
            maxWidth: 430,
            margin: "0 auto",
            padding: "18px 14px 40px",
            background: "linear-gradient(180deg, #F4EFE6 0%, #EFE9DF 100%)",
            fontFamily: "'Nunito', system-ui, sans-serif",
            boxSizing: "border-box",
          }}
        >
          <div id="audit-card" data-block-type={entry.block.type}>
            <KoruUnifiedCard block={entry.block as UiBlock} />
          </div>
        </div>
      </KoruProvider>,
    );
  }
}
