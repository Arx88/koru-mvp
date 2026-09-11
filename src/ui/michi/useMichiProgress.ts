import { useSyncExternalStore } from "react";
import { useKoruOptional } from "../KoruProvider";
import { MICHI_AVATARS } from "./avatarCatalog";

const KEY = "michi.companion-avatar";
const listeners = new Set<() => void>();
let fallback = "playita";
function snapshot() {
  try {
    return localStorage.getItem(KEY) || fallback;
  } catch {
    return fallback;
  }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
export function progressForEnergy(energy: number) {
  const xp = Math.max(0, Math.floor(Number.isFinite(energy) ? energy : 0));
  return {
    xp,
    level: 1 + Math.floor(xp / 100),
    inLevel: xp % 100,
    remaining: 100 - (xp % 100),
  };
}
export function useMichiProgress() {
  const context = useKoruOptional();
  const progress = progressForEnergy(context?.energy ?? 0);
  const saved = useSyncExternalStore(subscribe, snapshot, () => "playita");
  const active =
    MICHI_AVATARS.find((a) => a.id === saved && a.level <= progress.level) ??
    MICHI_AVATARS[0];
  function choose(id: string) {
    if (!MICHI_AVATARS.some((a) => a.id === id && a.level <= progress.level))
      return;
    fallback = id;
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* session choice still works */
    }
    listeners.forEach((listener) => listener());
  }
  return {
    ...progress,
    active,
    choose,
    next: MICHI_AVATARS.find((a) => a.level > progress.level),
  };
}
