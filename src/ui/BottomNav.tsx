import { cn } from "../lib/utils";

export type Tab = "hoy" | "memoria" | "permisos" | "historial" | "configuracion";

// Nota de fidelidad: las pantallas Stitch no incluyen barra de navegación.
// Esta barra existe solo para alcanzar las pantallas fuera del set Stitch
// (Memoria/Permisos/Historial/Ajustes) y usa su misma paleta y tipografía
// (surface #f8f9ff, primary #4648d4, Material Symbols) para no desentonar.
const ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: "hoy", label: "Hoy", icon: "home" },
  { id: "memoria", label: "Memoria", icon: "neurology" },
  { id: "permisos", label: "Permisos", icon: "shield" },
  { id: "historial", label: "Historial", icon: "history" },
  { id: "configuracion", label: "Ajustes", icon: "settings" },
];

export function BottomNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="border-t border-[#4648d4]/10 bg-[#f8f9ff]/95 backdrop-blur-sm">
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 py-2">
        {ITEMS.map(({ id, label, icon }) => {
          const isActive = active === id;
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(id)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-2xl py-2 text-xs font-medium transition-colors cursor-pointer",
                  isActive ? "text-[#4648d4]" : "text-[#767586] hover:text-[#464554]",
                )}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 22, fontVariationSettings: isActive ? "'FILL' 1, 'wght' 500" : "'FILL' 0, 'wght' 400" }}
                >
                  {icon}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
