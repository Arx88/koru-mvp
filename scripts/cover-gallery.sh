#!/bin/bash
# cover-gallery.sh — cobertura EN VIVO de todas las cards de la galería
# (lectura.html): abre cada card, espera render, captura @2x, verifica
# cero errores de consola, vuelve a la lista. Reporte final por card.
set -u
BASE="http://127.0.0.1:3000/lectura.html"
OUT="/home/z/my-project/download/koru-gallery"
mkdir -p "$OUT"

# labels de las 40 cards (en orden del CARDS array)
LABELS=(
  "Clima Madrid" "Tu día" "Qué me pongo" "Clásico en vivo" "Noticias"
  "Parrillas" "Receta carbonara" "Película de hoy" "Lectura de noche" "Alarma gym 7:00"
  "Checklist notebook" "Morning brief" "Vitamina D" "Acciones NASDAQ" "Portfolio cripto"
  "Dólar oficial" "Gastos de agosto" "Cinta de datos" "Cómo llegar" "Ruta en vivo"
  "Tablero de salidas" "Envío de Maru" "Cumples de septiembre" "Aviso cumple de Juan" "Cumple de Juan"
  "Duelo de in-ear" "Cafetera Evo" "iPhone 16" "Madrid 3 días" "Ya quedó en tu agenda"
  "Bóveda de recuerdos" "Lo nuevo que te guardé" "Lectura pendiente" "Anotame esto" "Archivos del chat"
  "Así está la cuenta" "Tu lente de análisis" "Juega Boca" "El clásico en números" "Informe solar"
)

agent-browser open "$BASE" >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2
agent-browser errors --clear >/dev/null 2>&1

declare -a RESULTS=()
SLUG="cover"
N=0
for label in "${LABELS[@]}"; do
  N=$((N+1))
  slug=$(echo "$label" | tr '[:upper:] ' '[:lower:]_' | sed 's/[^a-z0-9_]//g')
  shot="$OUT/${N}-${slug}.png"
  # click en la entry (por texto del label)
  if agent-browser find text "$label" click >/dev/null 2>&1; then
    sleep 1.6
    agent-browser screenshot "$shot" >/dev/null 2>&1
    # ¿panel abierto? (lcr-panel = interior lectura)
    panel=$(agent-browser eval "document.querySelector('.lcr-panel') ? document.querySelector('.lcr-panel').id : 'NO_PANEL'" 2>/dev/null | tail -1)
    # errores de consola acumulados
    errs=$(agent-browser errors 2>/dev/null | grep -c "error" || true)
    RESULTS+=("$N|$label|$panel|$errs|$shot")
    # volver a la galería
    agent-browser eval "document.querySelector('.lcr-back, [aria-label*=Volver], button[class*=back]')?.click(); window.scrollTo(0,0); 'back'" >/dev/null 2>&1
    sleep 0.5
  else
    RESULTS+=("$N|$label|CLICK_FAIL|0|-")
  fi
done

echo "==================== COBERTURA GALERÍA ($N cards) ===================="
OK=0; FAIL=0
for r in "${RESULTS[@]}"; do
  IFS='|' read -r n label panel errs shot <<< "$r"
  if [[ "$panel" != "NO_PANEL" && "$panel" != "CLICK_FAIL" && "$errs" == "0" ]]; then
    echo "✓ #$n $label → $panel (0 errores)"
    OK=$((OK+1))
  else
    echo "✗ #$n $label → $panel (errores: $errs)"
    FAIL=$((FAIL+1))
  fi
done
echo "=================================================="
echo "OK: $OK / $N — FALLAS: $FAIL"
