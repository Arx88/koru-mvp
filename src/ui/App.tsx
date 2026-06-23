import { useState } from "react";
import { KoruProvider, useKoru } from "./KoruProvider";
import { Onboarding } from "./Onboarding";
import { HomeScreen } from "./HomeScreen";
import { MemoryScreen } from "./MemoryScreen";
import { PermissionsScreen } from "./PermissionsScreen";
import { HistoryScreen } from "./HistoryScreen";
import { SettingsScreen } from "./SettingsScreen";
import { TalkOverlay } from "./TalkOverlay";
import { BottomNav, type Tab } from "./BottomNav";

function KoruApp() {
  const { onboarded } = useKoru();
  const [tab, setTab] = useState<Tab>("hoy");
  const [talking, setTalking] = useState(false);

  if (!onboarded) {
    return (
      <main className="min-h-dvh bg-background">
        <Onboarding />
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh justify-center bg-background">
      <div
        aria-hidden={talking ? "true" : undefined}
        className={`flex min-h-dvh w-full max-w-md flex-col bg-background ${talking ? "pointer-events-none invisible" : ""}`}
      >
        <div className="flex-1 overflow-y-auto">
          {tab === "hoy" && <HomeScreen onTalk={() => setTalking(true)} />}
          {tab === "memoria" && <MemoryScreen />}
          {tab === "permisos" && <PermissionsScreen />}
          {tab === "historial" && <HistoryScreen />}
          {tab === "configuracion" && <SettingsScreen />}
        </div>
        <BottomNav active={tab} onChange={setTab} />
      </div>

      {talking && <TalkOverlay onClose={() => setTalking(false)} />}
    </main>
  );
}

import { CardPreview } from "./CardPreview";

export function App() {
  return (
    <KoruProvider>
      <CardPreview />
      <KoruApp />
    </KoruProvider>
  );
}
