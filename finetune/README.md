# Fine-tuning de Koru con Qwen 27B

Este directorio contiene todo lo necesario para fine-tunear un modelo Qwen 27B para que sea un mejor Koru.

## Archivos

| Archivo | Propósito |
|---|---|
| `extract-koru-schema.ts` | Extrae schemas de tools y UiBlocks del código de Koru. |
| `koru-tools.json` | Definiciones de las 121 tools disponibles para el LLM. |
| `koru-builtin-tools.json` | Tools builtin del motor (weather, reminder, etc.). |
| `koru-uiblock-types.json` | Lista de tipos de UiBlock soportados. |
| `generate-dataset.ts` | Genera el dataset de entrenamiento. |
| `koru-dataset-v1.jsonl` | Dataset final en formato JSONL. |
| `train-qwen-koru.py` | Script de entrenamiento con Unsloth + LoRA. |
| `eval-qwen-koru.py` | Script de evaluación de calidad. |
| `export-to-ollama.sh` | Exporta el modelo entrenado a GGUF y Ollama. |
| `Modelfile.koru-qwen` | Definición del modelo para Ollama. |

## Flujo de trabajo

### 1. Extraer schemas
```bash
npx tsx finetune/extract-koru-schema.ts
```

### 2. Generar/actualizar dataset
```bash
npx tsx finetune/generate-dataset.ts
```

### 3. Entrenar
```bash
# Requiere GPU con al menos 24GB VRAM para 27B Q4 + LoRA
python finetune/train-qwen-koru.py
```

### 4. Evaluar
```bash
# Primero crear el modelo en Ollama con export-to-ollama.sh
python finetune/eval-qwen-koru.py --model koru-qwen-27b --base-url http://172.23.144.1:11434
```

### 5. Exportar a Ollama
```bash
bash finetune/export-to-ollama.sh
```

## Requisitos de hardware

- **Entrenamiento Q4 LoRA 27B**: ~24GB VRAM (RTX 3090/4090 o superior).
- **Entrenamiento bf16 LoRA 27B**: ~48GB VRAM (RTX A6000, A100 40GB).
- **Inferencia Q4**: ~18GB VRAM.

## Dataset

El dataset actual tiene ejemplos sintéticos de alta calidad que cubren:
- Personalidad y conversación natural
- Memoria (guardar, buscar, usar)
- Proactividad
- Clima, recordatorios, alarmas, cumpleaños
- Restaurantes, crypto, forex, acciones
- Deportes, rutas, vuelos
- Noticias, trending, web search
- Gastos, salud, conocimiento
- Cuándo NO usar tools

Para mejorar el modelo, agregá ejemplos reales de interacciones con Koru.

## Próximos pasos

1. Acumular turnos reales de `qwen3.6:27b` funcionando bien y añadirlos al dataset.
2. Ampliar el dataset a 500-1000 ejemplos.
3. Entrenar y evaluar contra baseline.
4. Iterar según métricas.
