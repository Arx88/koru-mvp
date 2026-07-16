import { useState, lazy, Suspense } from "react";
import { KoruProvider, useKoru } from "./KoruProvider";
import { MemoryScreen } from "./MemoryScreen";
import { PermissionsScreen } from "./PermissionsScreen";
import { HistoryScreen } from "./HistoryScreen";
import { TalkOverlay } from "./TalkOverlay";

// 🔴 Code-splitting: las pantallas "pesadas" se cargan vía React.lazy para
// que Vite las separe en chunks independientes y no entren al bundle
// inicial. Cada una requiere default export en su file (agregado abajo del
// named export existente para no romper tests / otros importers).
//   - HomeScreen: ~1100 líneas, widgets de hidratación/clima/nudges.
//   - SettingsScreen: ~1700 líneas, 8 secciones colapsables + formularios.
// Las demás (CreateScreen, CollectionsScreen, PlanRoadmapScreen) no se
// renderizan en App.tsx — se lazy-cargan en su caller real
// (TalkOverlay / KoruUnifiedCard / PlanHeroCard).
const HomeScreen = lazy(() => import("./HomeScreen"));
const SettingsScreen = lazy(() => import("./SettingsScreen"));

// Skeleton reutilizado como fallback de Suspense para todas las lazy screens.
// `.koru-skeleton` ya existe en style.css (shimmer lila).
function ScreenSkeleton() {
  return <div className="koru-skeleton" style={{ height: 200 }} />;
}

type Screen = "chat" | "hoy" | "memoria" | "permisos" | "historial" | "configuracion";

function KoruApp() {
  const {
    onboarded,
    completeOnboarding,
    state,
    dismissNudge,
    updateUserProfile,
    updatePreferences,
    setLanguage,
    updateHeartbeat,
    setEphemeral,
    setWorldSignals,
    togglePermission,
    forgetMemory,
    exportData,
    deleteAllData,
    // 🔴 TIER S: reducers wired a widgets del HomeScreen.
    logWellbeing,
    logHabit,
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
        onboarding={!onboarded}
        onOnboardingComplete={completeOnboarding}
      />
    );
  }

  // Pantallas del wheel — con back button para volver al chat
  return (
    <main className="flex min-h-dvh justify-center bg-background">
      <div className="flex min-h-dvh w-full max-w-md flex-col bg-background">
        <div className="flex-1 overflow-y-auto">
          {/* Back button flotante para volver al chat
              (oculto en "hoy": el HomeScreen es un full-takeover con su propio header) */}
          {screen !== "hoy" && (
            <button
              type="button"
              onClick={() => setScreen("chat")}
              aria-label="Volver al chat"
              className="fixed top-4 left-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-white/22 backdrop-blur-md text-white shadow-lg transition-transform active:scale-95"
              style={{ background: "rgba(131, 99, 249, 0.9)" }}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          {screen === "hoy" && (
            <Suspense fallback={<ScreenSkeleton />}>
              <HomeScreen
                state={state}
                onNavigate={(s) => setScreen(s as Screen)}
                onCreate={() => setScreen("chat")}
                onSearch={() => setScreen("chat")}
                onTalk={() => setScreen("chat")}
                onDismissNudge={dismissNudge}
                // 🔴 TIER S: wiring de reducers a widgets del HomeScreen.
                // - onLogWater → logWellbeing("water", ml, "ml") en KoruProvider.
                // - onLogHabit → logHabit(habitId, 1) en KoruProvider.
                // - onRefreshWeather → updateWeatherCache con el cache actual
                //   pero fetchedAt = ahora (mark-as-fresh). El fetch real del
                //   dato viene del agente via chat; acá sólo tocamos el cache
                //   para que el botón haga algo visible.
                onLogWater={(ml) => logWellbeing("water", ml, "ml")}
                onLogHabit={(habitId) => logHabit(habitId, 1)}
                onRefreshWeather={() => {
                  if (state.weatherCache) {
                    updateWeatherCache({
                      ...state.weatherCache,
                      fetchedAt: new Date().toISOString(),
                    });
                  }
                }}
              />
            </Suspense>
          )}
          {screen === "memoria" && <MemoryScreen />}
          {screen === "permisos" && <PermissionsScreen />}
          {screen === "historial" && <HistoryScreen />}
          {screen === "configuracion" && (
            <Suspense fallback={<ScreenSkeleton />}>
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
                onExportData={() => exportData()}
                onDeleteAllData={() => deleteAllData()}
                // 🔴 TIER S: wiring de addPerson — SettingsScreen lo invoca desde
                // el sub-form "Personas" bajo Perfil.
                onAddPerson={(name, relationship, birthday) => addPerson(name, relationship, birthday)}
                onClose={() => setScreen("chat")}
              />
            </Suspense>
          )}
        </div>
      </div>
    </main>
  );
}

export function App() {
  return (
    <KoruProvider>
      <KoruApp />
    </KoruProvider>
  );
}
