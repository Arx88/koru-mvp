import { useState } from "react";
import { KoruProvider, useKoru } from "./KoruProvider";
import { KoruIconSprite } from "./KoruIconSprite";
import { MemoryScreen } from "./MemoryScreen";
import { PermissionsScreen } from "./PermissionsScreen";
import { HistoryScreen } from "./HistoryScreen";
import { TalkOverlay } from "./TalkOverlay";
import { HomeScreen } from "./HomeScreen";
import { SettingsScreen } from "./SettingsScreen";
import { IconGallery } from "./IconGallery";
import { KoruMicrodetails } from "./cards/unified/KoruMicrodetails";

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
                onPauseHabit={(habitId) => pauseHabit(habitId)}
                onResumeHabit={(habitId) => resumeHabit(habitId)}
                onRefreshWeather={() => {
                  if (state.weatherCache) {
                    updateWeatherCache({
                      ...state.weatherCache,
                      fetchedAt: new Date().toISOString(),
                    });
                  }
                }}
              />
          )}
          {screen === "memoria" && <MemoryScreen />}
          {screen === "permisos" && <PermissionsScreen />}
          {screen === "historial" && <HistoryScreen />}
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
    </main>
  );
}

export function App() {
  // 🔴 KIMI — Hidden route: ?icons=1 → galería de iconos animados (dev/ref).
  // Se evalúa en cada render para reaccionar a cambios de URL sin reload.
  const showIcons =
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
