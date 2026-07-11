import { Moon } from "lucide-react";
import { useKoru } from "./KoruProvider";
import { cn } from "../lib/utils";

export function PermissionsScreen() {
  const { permissions, togglePermission, ephemeral, setEphemeral } = useKoru();

  return (
    <div className="flex h-full flex-col px-6 pb-4 pt-8">
      <header className="animate-rise">
        <h1 className="font-serif text-2xl text-bark">Permisos</h1>
        <p className="mt-1 text-sm text-earth">
          Un contrato de confianza. Tú decides qué puede hacer Koru.
        </p>
      </header>

      <ul className="mt-6 flex flex-col gap-3">
        {permissions.map((perm) => (
          <li key={perm.id} className="flex items-center gap-4 rounded-xl border border-sand bg-card p-4">
            <div className="flex-1">
              <p className="text-[15px] font-medium text-bark">{perm.title}</p>
              <p className="mt-0.5 text-sm leading-snug text-earth">{perm.description}</p>
            </div>
            <Toggle
              checked={perm.enabled}
              onChange={() => togglePermission(perm.id)}
              label={perm.title}
            />
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center gap-4 rounded-xl border border-blush bg-blush/20 p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blush/50 text-[#8a635c]">
          <Moon className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <p className="text-[15px] font-medium text-bark">Modo efímero</p>
          <p className="mt-0.5 text-sm leading-snug text-earth">
            Conversaciones sin memoria persistente.
          </p>
        </div>
        <Toggle checked={ephemeral} onChange={() => setEphemeral(!ephemeral)} label="Modo efímero" />
      </div>

      <p className="mt-auto pt-6 text-center text-xs leading-relaxed text-stone">
        Koru no se alimenta de secretos; crece con confianza.
      </p>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors cursor-pointer",
        checked ? "bg-forest" : "bg-sand",
      )}
    >
      <span
        className={cn(
          "absolute top-1 h-5 w-5 rounded-full bg-cream shadow-sm transition-transform",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}
