import { Check, Mic } from "lucide-react";
import { KoruMascot } from "./KoruMascot";
import { STAGE_META, useKoru } from "./KoruProvider";
import { cn } from "../lib/utils";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function HomeScreen({ onTalk }: { onTalk: () => void }) {
  const { userName, stage, priorities, togglePriority, ephemeral, memories, history } = useKoru();
  const meta = STAGE_META[stage];
  const allDone = priorities.every((p) => p.done);
  const hasContext = memories.length > 0 || history.length > 0 || priorities.length > 0;
  const openCount = priorities.filter((p) => !p.done).length;

  return (
    <div className="flex h-full flex-col px-6 pb-4 pt-8">
      <header className="flex flex-col items-center text-center animate-rise">
        <KoruMascot state={allDone ? "happy" : hasContext ? "thinking" : "idle"} size="lg" />
        <p className="mt-2 text-sm font-light text-stone">
          {greeting()}, {userName || "amigo"}
        </p>
        <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-warm-white px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-moss" />
          <span className="text-xs font-medium text-earth">
            {meta.label} · {meta.meaning}
          </span>
        </div>
      </header>

      <section className="mt-8 flex-1">
        <h1 className="font-serif text-2xl leading-tight text-bark text-balance">
          {priorities.length === 0
            ? "Todavía no tengo pendientes"
            : allDone
              ? "Cuidaste todo lo de hoy"
            : hasContext
              ? "Hoy veo contexto suficiente para ayudarte"
              : "Empezamos por una charla simple"}
        </h1>
        <p className="mt-1 text-sm text-earth">
          {priorities.length === 0
            ? "Contame algo, guardá una idea o pedime que ordene el día."
            : allDone
              ? "Descansa. Mañana seguimos a tu ritmo."
            : hasContext
              ? `Tengo ${openCount} pendiente(s), ${memories.length} memoria(s) y tu historial reciente para ordenar el próximo paso.`
              : "Cuentalo como te salga. Yo busco estructura, prioridades y siguientes pasos."}
        </p>

        <ul className="mt-5 flex flex-col gap-3">
          {priorities.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => togglePriority(p.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-4 text-left transition-all cursor-pointer",
                  p.done
                    ? "border-sand opacity-60"
                    : "border-sand shadow-[0_2px_10px_rgba(92,122,95,0.06)] hover:border-sage active:scale-[0.99]",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    p.done ? "border-moss bg-moss text-cream" : "border-sage text-transparent",
                  )}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-[15px] leading-snug text-bark", p.done && "line-through text-stone")}>
                    {p.label}
                  </span>
                  {p.detail && (
                    <span className="mt-1 block text-[12px] leading-snug text-earth line-clamp-2">
                      {p.detail}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6">
        {ephemeral && (
          <p className="mb-3 text-center text-xs text-earth">
            Modo efímero activo · esta charla no se guardará
          </p>
        )}
        <button
          type="button"
          onClick={onTalk}
          className="flex w-full items-center justify-center gap-2.5 rounded-full bg-forest py-4 text-base font-semibold text-cream shadow-[0_4px_16px_rgba(92,122,95,0.3)] transition-transform active:scale-[0.97] cursor-pointer"
        >
          <Mic className="h-5 w-5" />
          Hablar con Koru
        </button>
      </div>
    </div>
  );
}
