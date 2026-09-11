import type { Page } from "@playwright/test";

export async function openMorning(page: Page, { city = "Valencia", missing = false, offline = false, crowded = false }: { city?: string; missing?: boolean; offline?: boolean; crowded?: boolean } = {}) {
  await page.clock.setFixedTime(new Date("2026-09-11T07:30:00"));
  await page.addInitScript(() => { localStorage.setItem("koru.onboarded", "true"); localStorage.setItem("michi.landscape", "17"); });
  await page.route("**/api/koru/morning-brief", route => route.fulfill({ json: {
    shouldShow: true, date: "2026-09-11", brief: {
      greeting: crowded ? "Buenos días, Juan. Un nuevo día para disfrutar juntos." : "Buenos días,",
      items: crowded ? [
        { label: "Pendiente", value: "Preparar las cosas para la excursión y revisar los horarios de salida." },
        { label: "Tarea", value: "Buscar un rato para seguir con ese proyecto que te ilusiona." },
        { label: "Memoria", value: "Te gusta empezar la mañana con un paseo tranquilo." },
      ] : [],
      reflection: "Disfrutá la tranquilidad de hoy y aprovechá el buen tiempo.",
    }
  } }));
  await page.route("**/geocoding-api.open-meteo.com/**", route => offline ? route.abort() : route.fulfill({ json: { results: [{ name: "Valencia", latitude: 39.47, longitude: -0.38 }] } }));
  await page.route("**/api.open-meteo.com/**", route => route.fulfill({ json: {
    timezone: "Europe/Madrid", current: { time: "2026-09-11T07:30", temperature_2m: 23, weather_code: 0, wind_speed_10m: missing ? null : 23 },
    hourly: { time: ["2026-09-11T08:00"], temperature_2m: [23], precipitation_probability: [missing ? null : 6], uv_index: [missing ? null : 4], weathercode: [0] },
    daily: { time: ["2026-09-11"], temperature_2m_max: [29], temperature_2m_min: [21], weathercode: [0] }
  } }));
  await page.goto("/favicon.svg");
  await page.evaluate(async city => {
    const storePath = "/src/domain/store.ts", persistencePath = "/src/domain/persistence.ts";
    const { createInitialState } = await import(/* @vite-ignore */ storePath);
    const { writeLegacyState, writePersistedState } = await import(/* @vite-ignore */ persistencePath);
    const state = createInitialState(); state.heartbeat.enabled = false;
    state.trustedEnergy = 440; state.totalEnergy = 440; state.userProfile = { name: "Juan", location: city };
    writeLegacyState(state); await writePersistedState(state);
  }, city);
  await page.goto("/");
}
