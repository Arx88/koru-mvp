/**
 * Fase 4.9 — Utilidades vectoriales centralizadas.
 *
 * Antes cosineSimilarity estaba duplicada en semanticRouter.ts y brain.ts
 * con implementaciones ligeramente distintas. Ahora viven acá.
 */

/**
 * Similitud coseno entre dos vectores.
 * Devuelve -1..1 donde 1 = idéntico, 0 = ortogonal, -1 = opuesto.
 * Usa Math.min para soportar vectores de distinta dimensión sin NaN.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let index = 0; index < length; index += 1) {
    dot += a[index] * b[index];
    aNorm += a[index] * a[index];
    bNorm += b[index] * b[index];
  }
  if (aNorm === 0 || bNorm === 0) return 0;
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}
