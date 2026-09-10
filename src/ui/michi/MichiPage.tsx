import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { art, MichiCat, useMichiLandscape } from "./v8Shared";

/** Shared scenery for secondary screens, including the portalled editor. */
export function MichiPageBackdrop() {
  const { activeArt } = useMichiLandscape();
  return <div className="mx-page-backdrop" aria-hidden="true" style={{ backgroundImage: `url(${art(activeArt)})` }} />;
}

export function MichiPage({ children, onBack }: { children: ReactNode; onBack: () => void }) {
  return (
    <section className="mx-page-shell">
      <MichiPageBackdrop />
      <div className="mx-page-frame">
        <nav className="mx-page-nav" aria-label="Navegación de la página">
          <button type="button" onClick={onBack} aria-label="Volver al chat"><ArrowLeft size={20} /></button>
          <span>Michi <span className="mx-page-nav-caption">Tu pequeño mundo</span></span>
          <MichiCat size={44} />
        </nav>
        {children}
      </div>
    </section>
  );
}
