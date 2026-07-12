import { useState } from "react";
import { Check, Mic, Pencil, Settings } from "lucide-react";
import { KoruMascot } from "./KoruMascot";
import { TalkOverlay } from "./TalkOverlay";
import { useKoru } from "./KoruProvider";
import { cn } from "../lib/utils";
import { SettingsScreen } from "./SettingsScreen";

type Step = "welcome" | "review" | "grown";
type OnboardingView = Step | "settings";

const PROFILE = [
  {
    id: "pr1",
    tag: "Rutina",
    prompt: "Algo de tu rutina o trabajo que quieras que recuerde",
    placeholder: "Ej: trabajo con clientes por la manana",
    status: null as boolean | null,
    draft: "",
  },
  {
    id: "pr2",
    tag: "Cuidado",
    prompt: "Algo que suele pesarte o que prefieres que tenga en cuenta",
    placeholder: "Ej: me cuesta arrancar cuando tengo muchas cosas abiertas",
    status: null as boolean | null,
    draft: "",
  },
  {
    id: "pr3",
    tag: "Objetivo",
    prompt: "Que te gustaria que Koru te ayude a conseguir",
    placeholder: "Ej: reducir carga mental y preparar mejor mis reuniones",
    status: null as boolean | null,
    draft: "",
  },
];

export function Onboarding() {
  const { completeOnboarding } = useKoru();
  const [step, setStep] = useState<OnboardingView>("welcome");
  const [name, setName] = useState("");
  const [talking, setTalking] = useState(false);
  const [items, setItems] = useState(PROFILE);

  function setStatus(id: string, ok: boolean) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: ok } : it)));
  }

  function setDraft(id: string, draft: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, draft, status: draft.trim() ? it.status : null } : it)));
  }

  const allReviewed = items.every((it) => it.status !== null || !it.draft.trim());

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6">
      {talking && <TalkOverlay onClose={() => setTalking(false)} onNavigate={() => {}} />}

      {step === "settings" && (
        <div className="flex flex-1 flex-col pt-8 animate-rise">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif text-2xl text-bark">Ajustes</h2>
            <button
              type="button"
              onClick={() => setStep("welcome")}
              className="text-sm text-earth underline underline-offset-2 hover:text-forest transition-colors cursor-pointer"
            >
              Volver
            </button>
          </div>
          <SettingsScreen />
        </div>
      )}

      {step === "welcome" && (
        <div className="relative flex flex-1 flex-col items-center justify-center text-center animate-rise">
          <div className="absolute top-4 right-4">
            <button
              type="button"
              onClick={() => setStep("settings")}
              aria-label="Ajustes"
              className="rounded-full bg-warm-white p-2 text-earth shadow-sm hover:text-forest hover:bg-cream transition-colors cursor-pointer"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
          <KoruMascot state="idle" size="xl" />
          <h1 className="mt-6 font-serif text-3xl text-bark">Soy Koru</h1>
          <p className="mt-3 max-w-xs text-pretty text-[15px] leading-relaxed text-earth">
            Un asistente que escucha, ordena y recuerda con tu permiso.
            Cuentame de ti y yo ordeno el resto.
          </p>
          <div className="mt-9 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setTalking(true)}
              className="flex w-64 items-center justify-center gap-2.5 rounded-full bg-forest py-4 font-semibold text-cream shadow-[0_4px_16px_rgba(92,122,95,0.3)] transition-transform active:scale-[0.97] cursor-pointer"
            >
              <Mic className="h-5 w-5" />
              Hablar con Koru
            </button>
            <button
              type="button"
              onClick={() => setStep("review")}
              className="text-sm text-earth underline underline-offset-2 hover:text-forest transition-colors cursor-pointer"
            >
              o escribir
            </button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="flex flex-1 flex-col justify-center py-12 animate-rise">
          <h2 className="font-serif text-2xl text-bark text-balance">Cuentame de ti</h2>
          <p className="mt-1 text-sm text-earth">
            Dime solo lo que quieras que use para ayudarte mejor. Si algo no aplica, dejalo vacio.
          </p>

          <label className="mt-5 block">
            <span className="text-xs font-semibold uppercase text-sage">Como te llamo?</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-sand bg-card px-4 py-3 text-[15px] text-bark outline-none focus:border-sage"
              placeholder="Tu nombre"
            />
          </label>

          <ul className="mt-5 flex flex-col gap-3">
            {items.map((it) => (
              <li
                key={it.id}
                className={cn(
                  "rounded-xl border bg-card p-4 transition-colors",
                  it.status === false ? "border-sand opacity-70" : it.status === true ? "border-moss" : "border-sand",
                )}
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide text-sage">{it.tag}</span>
                <p className="mt-1 text-[15px] leading-snug text-bark">{it.prompt}</p>
                <textarea
                  value={it.draft}
                  onChange={(event) => setDraft(it.id, event.target.value)}
                  placeholder={it.placeholder}
                  className="mt-3 min-h-20 w-full resize-none rounded-lg border border-sand bg-warm-white px-3 py-2 text-sm leading-relaxed text-bark outline-none transition-colors focus:border-sage"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus(it.id, true)}
                    disabled={!it.draft.trim()}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40",
                      it.status === true ? "bg-moss text-cream" : "bg-warm-white text-forest",
                    )}
                  >
                    <Check className="h-3.5 w-3.5" /> Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.map((item) => (item.id === it.id ? { ...item, draft: "", status: false } : item)))}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer",
                      it.status === false ? "bg-sand text-earth" : "bg-warm-white text-earth",
                    )}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Dejar vacio
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {!name.trim() && (
            <p className="mt-3 text-xs text-destructive">Pon tu nombre para continuar</p>
          )}

          <button
            type="button"
            onClick={() => setStep("grown")}
            disabled={!allReviewed || !name.trim()}
            className="mt-6 w-full rounded-full bg-forest py-4 font-semibold text-cream shadow-[0_4px_16px_rgba(92,122,95,0.3)] transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            Confirmar y continuar
          </button>
        </div>
      )}

      {step === "grown" && (
        <div className="flex flex-1 flex-col items-center justify-center text-center animate-rise">
          <KoruMascot state="happy" size="xl" />
          <h2 className="mt-6 font-serif text-2xl text-bark text-balance">Ya tengo una primera base real</h2>
          <p className="mt-2 max-w-xs text-pretty text-sm leading-relaxed text-earth">
            No invente un perfil: use solo lo que elegiste compartir. Puedes editarlo cuando quieras.
          </p>
          <button
            type="button"
            onClick={() => completeOnboarding(
              name,
              items.filter((item) => item.status === true).map((item) => item.draft.trim()).filter(Boolean),
            )}
            className="mt-9 w-64 rounded-full bg-forest py-4 font-semibold text-cream shadow-[0_4px_16px_rgba(92,122,95,0.3)] transition-transform active:scale-[0.97] cursor-pointer"
          >
            Entrar a mi dia
          </button>
        </div>
      )}
    </div>
  );
}
