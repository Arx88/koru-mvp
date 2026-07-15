#!/bin/bash
# Test exhaustivo: 15 tareas diferentes desde el front
# Toma screenshots de cada una y analiza la calidad

TESTS=(
  "hola"
  "que dia es hoy?"
  "como salio hoy Argentina?"
  "que se dice de la pelicula obsesion?"
  "receta de carbonara"
  "que clima hace en Madrid?"
  "noticias de tecnologia"
  "que es la inteligencia artificial?"
  "a cuanto esta el bitcoin?"
  "que paso en el mundo hoy?"
  "informe sobre el cambio climatico"
  "que se dice de la pelicula dune?"
  "como salio España ayer?"
  "receta de tarta de manzana"
  "que es la teoria de la relatividad?"
)

for i in "${!TESTS[@]}"; do
  IDX=$((i+1))
  QUERY="${TESTS[$i]}"
  echo "=== Test $IDX: $QUERY ==="
  
  # Abrir la app fresh
  agent-browser open https://koru-mvp.onrender.com/ --timeout 30000 2>&1 | tail -1
  sleep 3
  
  # Encontrar el input
  INPUT_REF=$(agent-browser snapshot -i -c 2>&1 | grep "textbox" | head -1 | sed 's/.*\[\(@e[0-9]*\)\].*/\1/')
  if [ -z "$INPUT_REF" ]; then
    echo "  ❌ No se encontró input"
    continue
  fi
  
  # Escribir la query
  agent-browser fill $INPUT_REF "$QUERY" 2>&1 | tail -1
  sleep 1
  agent-browser press Enter 2>&1 | tail -1
  
  # Esperar respuesta (más tiempo para queries complejas)
  if echo "$QUERY" | grep -qi "informe\|noticias\|mundo\|inteligencia"; then
    sleep 30
  else
    sleep 15
  fi
  
  # Screenshot del resultado
  agent-browser screenshot "/tmp/test-front-$(printf '%02d' $IDX)-result.png" 2>&1 | tail -1
  echo "  Screenshot: /tmp/test-front-$(printf '%02d' $IDX)-result.png"
done

echo ""
echo "=== Todos los tests completados ==="
ls -la /tmp/test-front-*-result.png
