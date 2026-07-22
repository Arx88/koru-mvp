/** Koru Design Principles — Kimi Tier-S audit */

export const KIMI_PILLARS = {
  calido: "Voseo rioplatense, humor tímido, cero jerga. La temperatura de una taza de café en las manos: ámbar, miel, papel.",
  magico: "Noche estrellada, islas flotantes, luciérnagas, brillo de luna. La magia es coherente: siempre la misma física de luz.",
  vivo: "Nada está quieto sin razón. Los datos laten, las hojas respiran, la mascota duerme si la abandonás 5 minutos.",
  util: "Cada card responde qué pasó y qué hago. El extendido siempre paga. La belleza jamás estorba a la función.",
  tuyo: "Memoria-jardín, modo efímero, tus colecciones. Koru es tuyo: te conoce cada día más y te lo demuestra.",
} as const;

export const KIMI_DECISIONS = {
  D1: "El molde se queda, la camisa de fuerza se va — cada dominio varía acento, arte, ritmo y momento vivo",
  D2: "Un momento vivo por card — si nada se mueve, es un documento, no un ser",
  D3: "El extendido paga el tap — todo 'ver más' entrega algo que la compacta no tiene",
  D4: "El error también es diseño — rate-limits y vacíos se convierten en estados honestos y tiernos",
  D5: "Un solo sistema de iconos, y animado — Lucide/Material con triggers hover/loop/acción",
  D6: "La noche nunca se apaga — extendidos viven en el mundo nocturno",
  D7: "La jerarquía es ley — una idea primaria por card, escala tipográfica con contraste real",
} as const;

export const KIMI_VOICE = {
  tone: "Voseo rioplatense. Frases cortas con consejo. Humor tímido. Cero jerga.",
  ctaRule: "El CTA dice qué hay del otro lado. Si no puede prometer algo concreto, la card no necesita CTA.",
  forbidden: ["Error 429", "rate limit exceeded", "Resultado de búsqueda generado", "No hay datos disponibles", "Ejecutar protocolo", "Síntesis Deep-Hungry"],
  loading: "Procesando…",
  error: "Se nubló el dato — no te muestro números viejos como si fueran de ahora",
  empty: "Todavía no sembraste nada",
  idle: "Koru se durmió un rato — despertalo con un hola",
} as const;
