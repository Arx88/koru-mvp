import { useMemo } from "react";
import { useKoru } from "../KoruProvider";

// Modelo de datos del dashboard del Home (Koru 2.0).
// La capa lee datos REALES donde existen (cumpleaños y medicación desde records,
// tareas desde priorities) y SIEMBRA el resto con un seed de demo (`isSeed: true`)
// idéntico al diseño. Cablear datos reales luego = borrar la entrada del seed y
// apuntar el selector al estado, sin tocar los componentes.

export type HomeWidget =
  | { kind: "weather"; city: string; temp: number; condition: string; hi: number; lo: number; isSeed?: boolean }
  | { kind: "next_dose"; time: string; name: string; isSeed?: boolean }
  | { kind: "screen_time"; value: string; isSeed?: boolean }
  | { kind: "now_playing"; title: string; artist: string; elapsed: string; isSeed?: boolean }
  | { kind: "birthday"; person: string; label: string; isSeed?: boolean }
  | { kind: "crypto"; symbol: string; price: string; change: string; up: boolean; isSeed?: boolean }
  | { kind: "tasks"; items: { label: string; done: boolean }[]; isSeed?: boolean }
  | { kind: "hydration"; current: number; goal: number; unit: string; isSeed?: boolean };

// Seed de demo — una sola fuente de verdad para los datos aún no cableados.
const DEMO_WIDGET_SEED: Record<string, HomeWidget> = {
  weather: { kind: "weather", city: "Buenos Aires", temp: 24, condition: "Sunny", hi: 28, lo: 16, isSeed: true },
  screen_time: { kind: "screen_time", value: "4h 12m", isSeed: true },
  now_playing: { kind: "now_playing", title: "Midnight City", artist: "M83 · Hurry Up, We're Dreaming", elapsed: "1:45", isSeed: true },
  crypto: { kind: "crypto", symbol: "Bitcoin", price: "$64,230", change: "2.4%", up: true, isSeed: true },
  hydration: { kind: "hydration", current: 1.5, goal: 2.5, unit: "L", isSeed: true },
  birthday: { kind: "birthday", person: "Mia", label: "24th", isSeed: true },
  next_dose: { kind: "next_dose", time: "2:00 PM", name: "Vitamin D & Iron", isSeed: true },
};

export function useHomeWidgets(): HomeWidget[] {
  const { records, priorities } = useKoru();

  return useMemo(() => {
    // Próxima toma: medicación real si existe, si no seed.
    const med = records.find((r) => r.kind === "medication");
    const nextDose: HomeWidget = med
      ? { kind: "next_dose", time: med.dueHint || "Hoy", name: med.title }
      : DEMO_WIDGET_SEED.next_dose;

    // Cumpleaños: record real si existe, si no seed.
    const bday = records.find((r) => r.kind === "birthday");
    const birthday: HomeWidget = bday
      ? { kind: "birthday", person: bday.person || bday.title, label: bday.value || "hoy" }
      : DEMO_WIDGET_SEED.birthday;

    // Tareas: derivadas de las prioridades reales; si no hay, seed liviano.
    const tasks: HomeWidget = priorities.length
      ? { kind: "tasks", items: priorities.slice(0, 3).map((p) => ({ label: p.label, done: p.done })) }
      : { kind: "tasks", isSeed: true, items: [
          { label: "Grocery Run", done: false },
          { label: "Call Mom @ 6pm", done: false },
        ] };

    return [
      DEMO_WIDGET_SEED.weather,
      nextDose,
      DEMO_WIDGET_SEED.screen_time,
      DEMO_WIDGET_SEED.now_playing,
      birthday,
      DEMO_WIDGET_SEED.crypto,
      tasks,
      DEMO_WIDGET_SEED.hydration,
    ];
  }, [records, priorities]);
}
