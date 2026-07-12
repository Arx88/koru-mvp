import { useState } from "react";
import { KoruProvider, useKoru } from "./KoruProvider";
import { HomeScreen } from "./HomeScreen";
import { MemoryScreen } from "./MemoryScreen";
import { PermissionsScreen } from "./PermissionsScreen";
import { HistoryScreen } from "./HistoryScreen";
import { SettingsScreen } from "./SettingsScreen";
import { TalkOverlay } from "./TalkOverlay";
import { BottomNav, type Tab } from "./BottomNav";

function KoruApp() {
  const { onboarded, completeOnboarding } = useKoru();
  const [tab, setTab] = useState<Tab>("hoy");
  // La app SIEMPRE abre en el chat (talking = true).
  // El home screen queda como destino del wheel, no como pantalla de inicio.
  const [talking, setTalking] = useState(true);

  return (
    <main className="flex min-h-dvh justify-center bg-background">
      <div
        aria-hidden={talking ? "true" : undefined}
        className={`flex min-h-dvh w-full max-w-md flex-col bg-background ${talking ? "pointer-events-none invisible" : ""}`}
      >
        <div className="flex-1 overflow-y-auto">
          {tab === "hoy" && <HomeScreen onTalk={() => setTalking(true)} onOpenMemory={() => setTab("memoria")} />}
          {tab === "memoria" && <MemoryScreen />}
          {tab === "permisos" && <PermissionsScreen />}
          {tab === "historial" && <HistoryScreen />}
          {tab === "configuracion" && <SettingsScreen />}
        </div>
        <BottomNav active={tab} onChange={setTab} />
      </div>

      {talking && (
        <TalkOverlay
          onClose={() => setTalking(false)}
          onNavigate={(t) => { setTab(t); setTalking(false); }}
          onboarding={!onboarded}
          onOnboardingComplete={completeOnboarding}
        />
      )}
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
