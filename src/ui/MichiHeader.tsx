/**
 * MichiHeader — Header de identidad + nivel (porte del diseño v7 aprobado)
 *
 * 🐱 Michi (antes Koru) · avatar del gato 3D naranja con anillo + dot verde,
 * nombre con sparkle, subtítulo, pill de NIVEL violeta con estrella dorada,
 * barra de XP con relleno oro y botón burger celeste.
 *
 * Los datos de nivel/XP son estáticos por ahora (la capa de gamificación
 * todavía no existe en el backend): Nivel 7 · 320/500 XP (64%).
 */

export function MichiHeader({ subtitle = "Siempre aquí para ti", onMenu }: { subtitle?: string; onMenu?: () => void }) {
  return (
    <header className="michi-hdr">
      <div className="michi-catwrap">
        <img className="michi-catav" src="/stitch/michi-avatar.png" alt="Michi" />
        <span className="michi-dot" />
      </div>

      <div className="michi-id">
        <h2>
          Michi
          <svg className="michi-spark" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 1.6c.86 5.5 4.9 9.54 10.4 10.4-5.5.86-9.54 4.9-10.4 10.4-.86-5.5-4.9-9.54-10.4-10.4C7.1 11.14 11.14 7.1 12 1.6Z" />
          </svg>
        </h2>
        <p>{subtitle}</p>
      </div>

      <div className="michi-lvl">
        <div className="michi-lvl-pill">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#FFD95A" aria-hidden="true">
            <path d="M12 1.7l3.1 6.7 7.3.8-5.4 5 1.4 7.2L12 17.9 5.6 21.4 7 14.2 1.6 9.2l7.3-.8L12 1.7z" />
          </svg>
          <span>Nivel 7</span>
        </div>
        <div className="michi-xpbar" role="progressbar" aria-label="320 de 500 XP" aria-valuenow={320} aria-valuemin={0} aria-valuemax={500}>
          <i style={{ width: "64%" }} />
        </div>
        <div className="michi-xptxt">320 / 500 XP</div>
      </div>

      {/* 🐱 v7.5 — burger cableado: abre el wheel radial (Ajustes/Memoria/…).
          Antes era un botón muerto — parte de la auditoría de settings. */}
      <button type="button" className="michi-mbtn" aria-label="Menú" onClick={onMenu}>
        <svg width="16" height="11" viewBox="0 0 17 12" aria-hidden="true">
          <rect x="0" y="0" width="17" height="2.2" rx="1.1" fill="#fff" />
          <rect x="0" y="4.9" width="17" height="2.2" rx="1.1" fill="#fff" />
          <rect x="0" y="9.8" width="17" height="2.2" rx="1.1" fill="#fff" />
        </svg>
      </button>
    </header>
  );
}
