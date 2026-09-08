/**
 * Fecha LOCAL en formato ISO YYYY-MM-DD.
 *
 * 🔴 FIX (2026-09-09): `new Date().toISOString()` devuelve la fecha en UTC.
 * Para usuarios al oeste de UTC (toda Latinoamérica: UTC-3 a UTC-8) después
 * de las ~21:00 locales el reloj UTC ya cambió de día → el dashboard mostraba
 * los eventos de MAÑANA como "hoy", los hábitos de hoy desaparecían y las
 * rachas/logs se guardaban con fecha equivocada.
 *
 * Regla del proyecto: TODA comparación de "hoy"/"mañana" sobre datos del
 * usuario usa esta función. `toISOString()` queda reservado para timestamps
 * absolutos (momento exacto de un evento).
 */

export function localDateISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Suma (o resta) días a una fecha "YYYY-MM-DD" usando aritmética LOCAL.
 * `new Date("2026-09-09")` parsea como UTC-medianoche; si después se
 * re-serializa con toISOString() desde una zona negativa se corrompe el día.
 */
export function shiftDateISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + days);
  return localDateISO(dt);
}
