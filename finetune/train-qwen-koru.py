"""
Fine-tuning de Qwen3.6-27B para Koru con Unsloth + LoRA.

Uso:
  cd /mnt/d/ZomboidServer/koru-mvp
  source .venv/bin/activate
  python finetune/train-qwen-koru.py

Requisitos:
  pip install unsloth transformers datasets trl peft accelerate bitsandbytes
"""
import os
import json
import sys
import logging

# ─────────────────────────────────────────────────────────────
# Cache en disco D (no C)
# ─────────────────────────────────────────────────────────────
HF_CACHE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".hf-cache")
os.environ["HF_HOME"] = HF_CACHE
os.environ["HF_HUB_CACHE"] = HF_CACHE
os.environ["TRANSFORMERS_CACHE"] = HF_CACHE
os.makedirs(HF_CACHE, exist_ok=True)

from unsloth import FastLanguageModel, is_bfloat16_supported
from unsloth.chat_templates import get_chat_template
from trl import SFTTrainer, SFTConfig
import torch

# ─────────────────────────────────────────────────────────────
# Logging a archivo en D
# ─────────────────────────────────────────────────────────────
LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "train.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Configuración
# ─────────────────────────────────────────────────────────────
MODEL_NAME = os.getenv("KORU_BASE_MODEL", "unsloth/gemma-4-12b")
MAX_SEQ_LENGTH = int(os.getenv("KORU_MAX_SEQ", "4096"))
DATASET_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "koru-dataset-v1.jsonl")
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "outputs", "koru-qwen-27b")
ADAPTER_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "adapters", "koru-qwen-27b")
MERGED_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "merged", "koru-qwen-27b-f16")

LORA_R = 64
LORA_ALPHA = 128
LORA_DROPOUT = 0.0
BATCH_SIZE = 1
GRAD_ACCUM = 4
MAX_STEPS = int(os.getenv("KORU_MAX_STEPS", "500"))
LEARNING_RATE = 2e-4
WARMUP_STEPS = 20

# ─────────────────────────────────────────────────────────────
# 1. Cargar modelo y tokenizer
# ─────────────────────────────────────────────────────────────
log.info(f"Cargando modelo base: {MODEL_NAME}")
log.info(f"Cache HF: {HF_CACHE}")
log.info(f"VRAM disponible: {torch.cuda.mem_get_info()[0] / 1e9:.1f} GB / {torch.cuda.mem_get_info()[1] / 1e9:.1f} GB")

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=MODEL_NAME,
    max_seq_length=MAX_SEQ_LENGTH,
    load_in_4bit=True,
    dtype=None,
)

# Configurar chat template de Qwen
tokenizer = get_chat_template(
    tokenizer,
    chat_template="qwen-2.5",
)

model = FastLanguageModel.get_peft_model(
    model,
    r=LORA_R,
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
    lora_alpha=LORA_ALPHA,
    lora_dropout=LORA_DROPOUT,
    bias="none",
    use_gradient_checkpointing="unsloth",
    random_state=3407,
    max_seq_length=MAX_SEQ_LENGTH,
)

# ─────────────────────────────────────────────────────────────
# 2. Cargar dataset
# ─────────────────────────────────────────────────────────────
# Cargar dataset
import datasets
datasets.disable_caching()

with open(DATASET_PATH, "r", encoding="utf-8") as f:
    raw_messages = []
    for line in f:
        line = line.strip()
        if not line:
            continue
        data = json.loads(line)
        raw_messages.append(data["messages"])

log.info(f"Dataset cargado: {len(raw_messages)} ejemplos")

# Aplicar chat template manualmente
texts = []
for msgs in raw_messages:
    text = tokenizer.apply_chat_template(
        msgs,
        tokenize=False,
        add_generation_prompt=False,
    )
    texts.append(text)

dataset = datasets.Dataset.from_dict({"text": texts})
log.info(f"Dataset formateado. Ejemplo 0 longitud: {len(dataset[0]['text'])} chars")

# ─────────────────────────────────────────────────────────────
# 3. Entrenar
# ─────────────────────────────────────────────────────────────
trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=dataset,
    args=SFTConfig(
        output_dir=OUTPUT_DIR,
        max_seq_length=MAX_SEQ_LENGTH,
        per_device_train_batch_size=BATCH_SIZE,
        gradient_accumulation_steps=GRAD_ACCUM,
        warmup_steps=WARMUP_STEPS,
        max_steps=MAX_STEPS,
        learning_rate=LEARNING_RATE,
        logging_steps=10,
        save_steps=100,
        save_total_limit=3,
        optim="adamw_8bit",
        weight_decay=0.01,
        lr_scheduler_type="cosine",
        seed=3407,
        bf16=is_bfloat16_supported(),
        fp16=not is_bfloat16_supported(),
        report_to="none",
    ),
)

log.info("Iniciando entrenamiento...")
trainer.train()
log.info("Entrenamiento completado.")

# ─────────────────────────────────────────────────────────────
# 4. Guardar adapter
# ─────────────────────────────────────────────────────────────
os.makedirs(ADAPTER_DIR, exist_ok=True)
model.save_pretrained(ADAPTER_DIR)
tokenizer.save_pretrained(ADAPTER_DIR)
log.info(f"Adapter guardado en {ADAPTER_DIR}")

# ─────────────────────────────────────────────────────────────
# 5. Mergear a fp16 (para GGUF)
# ─────────────────────────────────────────────────────────────
os.makedirs(MERGED_DIR, exist_ok=True)
log.info(f"Mergeando adapter con base en {MERGED_DIR}...")
model.save_pretrained_merged(MERGED_DIR, tokenizer, save_method="merged_16bit")
log.info(f"Modelo mergeado guardado en {MERGED_DIR}")
log.info("Listo. Ejecutá finetune/export-to-ollama.sh para crear el modelo Ollama.")
