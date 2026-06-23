import { Sprout, Leaf, ShieldCheck, ScrollText, Settings } from "lucide-react";
import { cn } from "../lib/utils";

export type Tab = "hoy" | "memoria" | "permisos" | "historial" | "configuracion";

const ITEMS: { id: Tab; label: string; icon: typeof Sprout }[] = [
  { id: "hoy", label: "Hoy", icon: Sprout },
  { id: "memoria", label: "Memoria", icon: Leaf },
  { id: "permisos", label: "Permisos", icon: ShieldCheck },
  { id: "historial", label: "Historial", icon: ScrollText },
  { id: "configuracion", label: "Ajustes", icon: Settings },
];

export function BottomNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="border-t border-sand bg-cream/95 backdrop-blur-sm">
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 py-2">
        {ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(id)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-2xl py-2 text-xs font-medium transition-colors cursor-pointer",
                  isActive ? "text-forest" : "text-stone hover:text-earth",
                )}
              >
                <Icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} strokeWidth={isActive ? 2.4 : 2} />
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
