import { Suspense, lazy, useState } from "react";
import { KoruProvider, useKoru } from "./KoruProvider";
import { KoruIconSprite } from "./KoruIconSprite";
import { MichiPage } from "./michi/MichiPage";
import { MemoryScreen } from "./MemoryScreen";
import { HistoryScreen } from "./HistoryScreen";
import { TalkOverlay } from "./TalkOverlay";
import { HomeScreen } from "./HomeScreen";
import { SettingsScreen } from "./SettingsScreen";
import { MichiAvatarsScreen } from "./michi/MichiAvatars";
import { IconGallery } from "./IconGallery";
import { KoruMicrodetails } from "./cards/unified/KoruMicrodetails";
import { fetchWeatherForCity } from "../domain/weatherClient";

// 🔴 CreateScreen code-split (mismo patrón que TalkOverlay).
const LazyCreateScreen = lazy(() =>
  import("./create/CreateScreen").then((m) => ({ default: m.CreateScreen })),
);

type Screen = "chat" | "hoy" | "memoria" | "historial" | "configuracion" | "avatares";

function KoruApp() {
  // 🔴 FIX (2026-09-09): "Crear" desde el Home abre la CreateScreen REAL
  // (antes mandaba al chat — el wheel ya abría CreateScreen; dos rutas
  // distintas para el mismo concepto). Igual que TalkOverlay: overlay lazy
  // sobre cualquier pantalla.
  const [showCreate, setShowCreate] = useState(false);
  const {
    onboarded,
    completeOnboarding,
    state,
    dismissNudge,
    openCollections,
    updateUserProfile,
    updatePreferences,
    setLanguage,
    updateHeartbeat,
    setEphemeral,
    setWorldSignals,
    togglePermission,
    forgetMemory,
    editMemory,
    exportData,
    deleteAllData,
    // 🔴 TIER S: reducers wired a widgets del HomeScreen.
    logWellbeing,
    logHabit,
    pauseHabit,
    resumeHabit,
    updateWeatherCache,
    // 🔴 TIER S: addPerson — wired al sub-form "Personas" en SettingsScreen.
    addPerson,
  } = useKoru();
  const [screen, setScreen] = useState<Screen>("chat");

  // Si estamos en el chat, mostrar TalkOverlay
  if (screen === "chat") {
    return (
      <TalkOverlay
        onClose={() => setScreen("hoy")}
        onNavigate={(tab) => setScreen(tab as Screen)}
        onAvatares={() => setScreen("avatares")}
        onboarding={!onboarded}
        onOnboardingComplete={completeOnboarding}
      />
    );
  }

  // 🐱 v8 — Pantalla de avatares desbloqueables (diseño del usuario)
  if (screen === "avatares") {
    return (
      <MichiAvatarsScreen
        onBack={() => setScreen("chat")}
        onMenuAction={(action) => {
          if (action === "avatares") return;
          if (action === "hoy" || action === "memoria" || action === "historial" || action === "configuracion") {
            setScreen(action);
          } else {
            setScreen("chat");
          }
        }}
      />
    );
  }

  // Pantallas del wheel — con back button para volver al chat
  return (
    <main className="flex min-h-dvh justify-center bg-background">
      <div className="flex min-h-dvh w-full max-w-md flex-col bg-background">
        <div className="flex-1 overflow-y-auto">
          {screen === "hoy" && (
              <HomeScreen
                state={state}
                onNavigate={(s) => setScreen(s as Screen)}
                onCreate={() => setShowCreate(true)}
                onSearch={() => setScreen("chat")}
                onTalk={() => setScreen("chat")}
                onDismissNudge={dismissNudge}
                // 🔴 FIX (2026-09-10): "Guardados" → Mis Colecciones. La vista
                // vive dentro del chat overlay: abrimos colecciones y volvemos
                // al chat para montarla.
                onOpenCollections={() => { openCollections(); setScreen("chat"); }}
                // 🔴 TIER S: wiring de reducers a widgets del HomeScreen.
                // - onLogWater → logWellbeing("water", ml, "ml") en KoruProvider.
                // - onLogHabit → logHabit(habitId, 1) en KoruProvider.
                // - onRefreshWeather → updateWeatherCache con el cache actual
                //   pero fetchedAt = ahora (mark-as-fresh). El fetch real del
                //   dato viene del agente via chat; acá sólo tocamos el cache
                //   para que el botón haga algo visible.
                onLogWater={(ml) => logWellbeing("water", ml, "ml")}
                onLogHabit={(habitId) => logHabit(habitId, 1)}
                onPauseHabit={(habitId) => pauseHabit(habitId)}
                onResumeHabit={(habitId) => resumeHabit(habitId)}
                onRefreshWeather={async () => {
                  // 🔴 FIX (2026-09-09): fetch REAL. Antes este handler solo
                  // re-estampaba fetchedAt del cache existente ("dato antiguo"
                  // desaparecía pero el dato seguía siendo de hace horas) y sin
                  // cache era un no-op total. Ahora pega al endpoint
                  // /api/koru/weather (mismo pipeline del agente) y devuelve
                  // true/false para que el widget muestre error honesto.
                  const city =
                    state.weatherCache?.city?.trim() ||
                    state.userProfile?.homeCity?.trim() ||
                    state.userProfile?.location?.trim();
                  if (!city) return false;
                  const result = await fetchWeatherForCity(city);
                  if (result.ok) {
                    updateWeatherCache(result.cache);
                    return true;
                  }
                  console.warn("[weather] refresh falló:", result.error);
                  return false;
                }}
              />
          )}
          {screen === "memoria" && <MichiPage onBack={() => setScreen("chat")}><MemoryScreen /></MichiPage>}
          {screen === "historial" && <MichiPage onBack={() => setScreen("chat")}><HistoryScreen /></MichiPage>}
          {screen === "configuracion" && (
              <SettingsScreen
                state={state}
                onUpdateProfile={(profile) => updateUserProfile(profile)}
                onUpdatePreferences={(prefs) => updatePreferences(prefs)}
                onUpdateLanguage={(lang) => setLanguage(lang)}
                onUpdateHeartbeat={(patch) => updateHeartbeat(patch)}
                onToggleEphemeral={() => setEphemeral(!state.ephemeralMode)}
                onToggleDurableMemory={() => togglePermission("perm1")}
                onToggleWorldSignals={() => setWorldSignals(!state.worldSignalsEnabled)}
                onToggleActionPreparation={() => togglePermission("perm3")}
                onForgetMemory={(memoryId) => forgetMemory(memoryId)}
                onEditMemory={(memoryId, newText) => editMemory(memoryId, newText)}
                onExportData={() => exportData()}
                onDeleteAllData={() => deleteAllData()}
                // 🔴 TIER S: wiring de addPerson — SettingsScreen lo invoca desde
                // el sub-form "Personas" bajo Perfil.
                onAddPerson={(name, relationship, birthday) => addPerson(name, relationship, birthday)}
                onClose={() => setScreen("chat")}
              />
          )}
        </div>
      </div>
      {/* 🔴 FIX (2026-09-09): CreateScreen accesible desde el Home — mismo
          overlay lazy + AI-assist que usa el chat. Antes "Crear" en Home
          abría el chat (la ruta INFERIOR) cuando existe una pantalla de
          creación directa (el wheel del chat ya la abría). */}
      <Suspense fallback={null}>
        {showCreate && (
          <LazyCreateScreen
            onClose={() => setShowCreate(false)}
            onAiAssist={async (template, title) => {
              try {
                const res = await fetch("/api/koru/ai-assist", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ template, title }),
                });
                if (!res.ok) return { suggestions: [] };
                const data = await res.json();
                const suggestions = Array.isArray(data?.suggestions)
                  ? data.suggestions.filter(
                      (s: any) => s && typeof s.field === "string" && typeof s.value === "string",
                    )
                  : [];
                return { suggestions };
              } catch {
                return { suggestions: [] };
              }
            }}
          />
        )}
      </Suspense>
    </main>
  );
}

export function App() {
  // 🔴 KIMI — Hidden route: ?icons=1 → galería de iconos animados (dev/ref).
  // Se evalúa en cada render para reaccionar a cambios de URL sin reload.
  // 🔴 FIX (2026-09-09): gateada a DEV — antes cualquier usuario de producción
  // podía entrar a la galería con ?icons=1 (herramienta interna de referencia).
  const showIcons =
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("icons") === "1";
  if (showIcons) return <IconGallery />;
  return (
    <KoruProvider>
      <KoruIconSprite />
      <KoruMicrodetails />
      <KoruApp />
    </KoruProvider>
  );
}
