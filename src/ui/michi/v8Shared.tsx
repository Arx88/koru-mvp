/**
 * v8Shared — piezas compartidas del design system del usuario
 * (porte 1:1 de koru-proyecto-completo.zip, frontend/src/components/koru).
 *
 * 🐱 Fuente de verdad visual definitiva: su proyecto.
 * - BubbleShapes: los 4 clipPaths Bézier de burbujas/composer (sus paths exactos)
 * - MICHI_AVATARS: 28 avatares desbloqueables por nivel
 * - MICHI_SCENERY: 5 paisajes (Amanecer/Día/Atardecer/Crepúsculo/Noche)
 * - useMichiLandscape: auto por franja horaria + override persistido
 * - useMichiUserAvatar: 15 retratos del usuario, con elección compartida y persistida
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { MICHI_AVATAR_SRC, PERSONAL_AVATARS, migratePersonalAvatar } from "./avatarCatalog";
import { useMichiProgress } from "./useMichiProgress";
export { MICHI_AVATARS, MICHI_AVATAR_SRC, MICHI_AVATAR_BANNER } from "./avatarCatalog";

/* ---------- Arte del usuario ---------- */
export const art = (n: number) => `/assets/art-${String(n).padStart(2, "0")}.webp`;
export const MICHI_CAT_AVATAR = art(19);
export const DEFAULT_USER_AVATAR = PERSONAL_AVATARS[0].src;

/* ---------- Definiciones de formas (sus clipPaths exactos) ---------- */
export function BubbleShapes() {
  return (
    <svg width="0" height="0" className="mx-shape-defs" aria-hidden="true">
      <defs>
        <clipPath id="bubble-michi" clipPathUnits="objectBoundingBox">
          <path d="M .074,.038 C .032,.007 .006,.035 .018,.099 C .022,.137 .040,.165 .041,.23 L .04,.715 C .036,.914 .072,.973 .168,.98 C .37,.974 .58,.996 .81,.978 C .944,.975 .987,.924 .985,.735 L .987,.288 C .984,.065 .956,.018 .825,.025 C .588,.024 .406,.004 .177,.023 C .125,.023 .099,.023 .074,.038 Z" />
        </clipPath>
        <clipPath id="bubble-michi-soft" clipPathUnits="objectBoundingBox">
          <path d="M .137,.025 C .05,.023 .024,.075 .022,.248 C .016,.435 .023,.662 .022,.742 C .02,.943 .062,.977 .161,.98 C .339,.993 .646,.981 .827,.967 C .952,.963 .985,.871 .985,.692 L .98,.28 C .978,.089 .939,.033 .838,.026 C .624,.007 .342,.008 .137,.025 Z" />
        </clipPath>
        <clipPath id="bubble-user" clipPathUnits="objectBoundingBox">
          <path d="M .156,.033 C .052,.028 .026,.103 .022,.327 C .01,.58 .025,.772 .069,.875 C .1,.948 .143,.951 .249,.953 L .813,.964 C .89,.97 .934,.943 .956,.9 C .97,.927 .994,.938 .998,.915 C .967,.868 .961,.803 .962,.734 C .982,.457 .969,.313 .958,.208 C .941,.05 .889,.034 .794,.043 C .602,.041 .395,.006 .156,.033 Z" />
        </clipPath>
        <clipPath id="composer-shape" clipPathUnits="objectBoundingBox">
          <path d="M .015,.198 C .047,.012 .078,.029 .13,.056 C .33,.185 .587,.003 .786,.069 C .87,.089 .903,-.025 .951,.025 C .994,.075 .998,.318 .997,.56 L .98,.898 C .977,.944 .957,.891 .934,.942 C .773,.942 .664,.901 .527,.978 C .423,.874 .305,.948 .204,.929 C .126,.979 .063,.995 .05,.898 C .009,.958 .041,.843 .017,.79 C .003,.739 -.006,.457 .015,.198 Z" />
        </clipPath>
      </defs>
    </svg>
  );
}

/* ---------- Avatares desbloqueables (su lib/koru.js) ---------- */
/* ---------- Paisajes (su Modals.jsx scenery) ---------- */
export const MICHI_SCENERY = [
  { art: 9, name: "Amanecer" },
  { art: 17, name: "Día" },
  { art: 11, name: "Atardecer" },
  { art: 12, name: "Crepúsculo" },
  { art: 13, name: "Noche" },
] as const;

/* Auto por franja horaria (las 5 slots de v7.5 mapeadas a sus paisajes) */
function sceneryForHour(date: Date): number {
  const h = date.getHours();
  if (h < 6) return 13; // madrugada → Noche
  if (h < 8) return 9; // amanecer → Amanecer
  if (h < 17) return 17; // día → Día
  if (h < 20) return 11; // atardecer → Atardecer
  return 12; // anochecer → Crepúsculo
}

const LANDSCAPE_KEY = "michi.landscape";
const USER_AVATAR_KEY = "michi.user-avatar";

/* ---------- Hook: paisaje activo (auto por hora + override) ---------- */
export function useMichiLandscape() {
  const [override, setOverride] = useState<number | null>(() => {
    try {
      const raw = localStorage.getItem(LANDSCAPE_KEY);
      const n = raw ? Number(JSON.parse(raw)) : NaN;
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  });
  const [auto, setAuto] = useState<number>(() => sceneryForHour(new Date()));

  useEffect(() => {
    const tick = () => setAuto(sceneryForHour(new Date()));
    const id = window.setInterval(tick, 60_000);
    const now = new Date();
    const msToNextMinute = 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds());
    const alignId = window.setTimeout(tick, Math.max(1000, msToNextMinute));
    return () => {
      window.clearInterval(id);
      window.clearTimeout(alignId);
    };
  }, []);

  const chooseLandscape = (n: number | null) => {
    setOverride(n);
    try {
      if (n === null) localStorage.removeItem(LANDSCAPE_KEY);
      else localStorage.setItem(LANDSCAPE_KEY, String(n));
    } catch {
      /* storage lleno/bloqueado — la elección vive solo en memoria */
    }
  };

  const activeArt = override ?? auto;
  return { activeArt, override, auto, chooseLandscape };
}

/* ---------- Hook: avatar del usuario ---------- */
const personalListeners = new Set<() => void>();
let sessionAvatar = DEFAULT_USER_AVATAR;
function personalSnapshot() {
  try { return migratePersonalAvatar(localStorage.getItem(USER_AVATAR_KEY) || sessionAvatar); }
  catch { return sessionAvatar; }
}
function subscribePersonal(listener: () => void) {
  personalListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => { personalListeners.delete(listener); window.removeEventListener("storage", listener); };
}
export function useMichiUserAvatar() {
  const userAvatar = useSyncExternalStore(subscribePersonal, personalSnapshot, () => DEFAULT_USER_AVATAR);
  const chooseUserAvatar = (src: string) => {
    if (!PERSONAL_AVATARS.some(a => a.src === src)) return;
    sessionAvatar = src;
    try {
      localStorage.setItem(USER_AVATAR_KEY, src);
    } catch {
      /* noop */
    }
    personalListeners.forEach(listener => listener());
  };
  return { userAvatar, chooseUserAvatar };
}

/* ---------- Avatar del gato (su KoruAvatar) ---------- */
export function MichiCat({
  className = "",
  sparkle = false,
  size,
}: {
  className?: string;
  sparkle?: boolean;
  size?: number;
}) {
  const { active } = useMichiProgress();
  return (
    <span className={`mx-cat ${className}`} style={size ? { width: size, height: size } : undefined}>
      <img src={MICHI_AVATAR_SRC(active.id)} alt="Michi" draggable={false} />
      {sparkle && (
        <svg className="mx-spark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2z" />
        </svg>
      )}
    </span>
  );
}
