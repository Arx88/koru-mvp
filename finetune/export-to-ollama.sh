#!/usr/bin/env bash
# Exporta el adapter entrenado a GGUF y crea un modelo Ollama.
# Requiere: llama.cpp (convert_hf_to_gguf.py), Ollama corriendo.

set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MERGED_DIR="${BASE_DIR}/finetune/merged/koru-qwen-27b-f16"
GGUF_DIR="${BASE_DIR}/finetune/gguf"
MODEL_NAME="${KORU_MODEL_NAME:-koru-qwen-27b}"

if [ ! -d "$MERGED_DIR" ]; then
  echo "ERROR: No existe ${MERGED_DIR}. Corré primero finetune/train-qwen-koru.py"
  exit 1
fi

mkdir -p "$GGUF_DIR"

echo "Convirtiendo a GGUF Q4_K_M..."
python3 llama.cpp/convert_hf_to_gguf.py \
  "$MERGED_DIR" \
  --outfile "$GGUF_DIR/${MODEL_NAME}.gguf" \
  --outtype Q4_K_M

echo "Creando modelo en Ollama..."
ollama create "$MODEL_NAME" -f "$BASE_DIR/finetune/Modelfile.koru-qwen"

echo "✓ Modelo disponible como: $MODEL_NAME"
echo "Probar: ollama run $MODEL_NAME"
