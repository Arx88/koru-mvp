import { useState } from "react";
import { KoruProvider, useKoru } from "./KoruProvider";
import { HomeScreen } from "./HomeScreen";
import { MemoryScreen } from "./MemoryScreen";
import { PermissionsScreen } from "./PermissionsScreen";
import { HistoryScreen } from "./HistoryScreen";
import { SettingsScreen } from "./SettingsScreen";
import { TalkOverlay } from "./TalkOverlay";

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
              onExportData={() => exportData()}
              onDeleteAllData={() => deleteAllData()}
              onClose={() => setScreen("chat")}
            />
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
