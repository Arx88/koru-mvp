import { useMemo, useState } from "react";
import { useKoru } from "./KoruProvider";
import { useHomeWidgets } from "./home/homeWidgets";
import { HomeWidgetCard } from "./home/WidgetCards";
import { CollectionsScreen } from "./CollectionsScreen";

// Koru Home — port PIXEL-PERFECT del diseño Stitch "Koru's Home".
// La cáscara (fondo difuminado, hoja redondeada, avatar flotante, header con
// botones guardar/compartir y el grid de widgets) replica 1:1 el HTML de Stitch.
// El avatar y el botón de volver abren el chat (onTalk) para mantenerlo funcional.

// Fondo "nebulosa" del diseño Stitch.
const HOME_BG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuA8V8xIagFzEoU_VdYjGvvJVn89ARgzNWSJMDO9ESjsI7KOE7o0OHEFaBpTB5bOxu6w_migKYGKnq05m6nbndB4iXKii8jJmARhLSYr53SWVpcKNP4-MCMCsUv_vVb6Nsyu9YP1MV8cDEwBlLWYoBtwDdkpKvX0ZHbdEmGWOjA-ct43ux_Sol7VNFRrDe3dt_XS905PV8LVO4OIT-PQWt6kTmneZh0l5xoofKJJZL___n7JKTFb94mw4M8H3W4I5MhoIInnc5cXDuI";

export function HomeScreen({ onTalk, onOpenMemory }: { onTalk: () => void; onOpenMemory?: () => void }) {
  const widgets = useHomeWidgets();
  const { memories, records } = useKoru();
  const [collectionsOpen, setCollectionsOpen] = useState(false);

  // Barra de conocimiento (no bloqueante): cuánto conoce Koru al usuario.
  // Nunca llega al 100% — conocer a alguien no "se termina". El gancho real
  // es VER lo que sabe (tap → pestaña Memoria), no el número.
  const knowledge = useMemo(() => {
    const facts = memories.length;
    const saved = records.length;
    const pct = Math.min(88, Math.round(18 + facts * 6 + Math.min(saved, 10) * 2));
    return { facts, saved, pct };
  }, [memories, records]);

  return (
    <div className="relative bg-[#f8f9ff]">
      <div className="khome-bg-area" style={{ backgroundImage: `url('${HOME_BG}')` }} />

      <button aria-label="Volver" className="khome-back-btn" onClick={onTalk}>
        <svg className="w-6 h-6" fill="none" stroke="#4648d4" strokeWidth={3} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="khome-content-card">
        <div className="khome-avatar" role="button" tabIndex={0} onClick={onTalk} aria-label="Hablar con Koru">
          <img alt="Koru" src="/images/koru-mascot.png" />
        </div>

        <div className="px-6 relative flex justify-between items-start mb-8">
          <button aria-label="Guardar" className="mt-2 text-[#4648d4] bg-white p-3 rounded-full shadow-sm border border-[#4648d4]/10">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="text-center pt-8 flex-1">
            <h1 className="text-3xl font-extrabold text-[#4648d4] tracking-tight mb-1">Koru`s Home</h1>
            <p className="text-sm text-[#464554] font-medium">Todo lo que Koru te preparo para hoy</p>
          </div>
          <button aria-label="Compartir" className="mt-2 text-[#4648d4] bg-white p-3 rounded-full shadow-sm border border-[#4648d4]/10">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Vínculo diario: cuánto te conoce Koru + tus colecciones, sin bloquear nada */}
        <div className="khome-bond-row">
          <button type="button" className="khome-bond-chip" onClick={onOpenMemory}>
            <span className="khome-bond-label">
              <span className="material-symbols-outlined">psychology</span>
              Koru te conoce
            </span>
            <span className="khome-bond-bar">
              <span className="khome-bond-fill" style={{ width: `${knowledge.pct}%` }} />
            </span>
            <span className="khome-bond-hint">
              {knowledge.facts > 0 ? `${knowledge.facts} ${knowledge.facts === 1 ? "recuerdo" : "recuerdos"} · ver qué sabe` : "contale algo tuyo hoy"}
            </span>
          </button>
          <button type="button" className="khome-bond-chip" onClick={() => setCollectionsOpen(true)}>
            <span className="khome-bond-label">
              <span className="material-symbols-outlined">bookmarks</span>
              Mis Colecciones
            </span>
            <span className="khome-bond-count">{knowledge.saved}</span>
            <span className="khome-bond-hint">{knowledge.saved > 0 ? "todo lo guardado, a mano" : "guardá tu primer enlace"}</span>
          </button>
        </div>

        <div className="khome-grid pb-8">
          {widgets.map((w, i) => (
            <HomeWidgetCard key={`${w.kind}-${i}`} widget={w} />
          ))}
        </div>
      </div>

      {collectionsOpen && <CollectionsScreen onClose={() => setCollectionsOpen(false)} />}
    </div>
  );
}
