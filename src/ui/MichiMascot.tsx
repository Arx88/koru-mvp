/**
 * MichiMascot — la mascota de Michi 🐱 (gato 3D naranja, diseño v7)
 *
 * Reemplaza al fantasma blanco de Koru en el onboarding. Mantiene la API
 * de KoruMascot (state/size/className) para que el swap sea transparente:
 * cualquier estado se resuelve al gato (los estados de ánimo llegarán con
 * los renders dedicados); la presentación es un círculo flotante con anillo
 * blanco, glow cálido y destellos — el "mini-mundo" del header v7.
 */

const SIZES = { sm: 56, md: 96, lg: 112, xl: 132 } as const;

export function MichiMascot({
  state = "idle",
  size = "lg",
  className,
}: {
  state?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const px = SIZES[size];

  return (
    <div
      className={`relative flex items-center justify-center ${className ?? ""}`}
      style={{ width: px * 1.5, height: px * 1.5 }}
      aria-hidden="true"
    >
      {/* glow cálido detrás del gato */}
      <div
        className="absolute rounded-full"
        style={{
          width: px * 1.28,
          height: px * 1.28,
          background:
            "radial-gradient(circle, rgba(253,197,51,.4) 0%, rgba(109,82,248,.18) 55%, transparent 72%)",
          filter: "blur(2px)",
        }}
      />
      {/* destellos */}
      <svg
        className="absolute"
        style={{ top: px * 0.04, right: px * 0.06, width: px * 0.22, height: px * 0.22 }}
        viewBox="0 0 24 24"
        fill="#FDC533"
      >
        <path d="M12 1.6c.86 5.5 4.9 9.54 10.4 10.4-5.5.86-9.54 4.9-10.4 10.4-.86-5.5-4.9-9.54-10.4-10.4C7.1 11.14 11.14 7.1 12 1.6Z" />
      </svg>
      <svg
        className="absolute"
        style={{ bottom: px * 0.1, left: px * 0.02, width: px * 0.14, height: px * 0.14, opacity: 0.9 }}
        viewBox="0 0 24 24"
        fill="#FFD95A"
      >
        <path d="M12 1.6c.86 5.5 4.9 9.54 10.4 10.4-5.5.86-9.54 4.9-10.4 10.4-.86-5.5-4.9-9.54-10.4-10.4C7.1 11.14 11.14 7.1 12 1.6Z" />
      </svg>
      {/* el gato, flotando */}
      <div className="michi-mascot-float relative" style={{ width: px, height: px }}>
        <img
          src="/stitch/michi-avatar.png"
          alt="Michi, tu asistente"
          width={px}
          height={px}
          style={{ width: px, height: px }}
          className="select-none object-cover rounded-full michi-mascot-ring"
        />
      </div>
    </div>
  );
}
