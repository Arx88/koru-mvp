import { useSyncExternalStore } from "react";
import { useKoruOptional } from "../KoruProvider";
import { MICHI_AVATARS, progressForEnergy } from "./avatarCatalog";

export { progressForEnergy };

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
