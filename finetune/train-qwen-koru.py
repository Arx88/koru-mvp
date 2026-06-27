"""
Fine-tuning de Qwen3-27B / qwen3.6:27b para Koru con Unsloth + LoRA.

Uso:
  cd /mnt/d/ZomboidServer/koru-mvp
  python finetune/train-qwen-koru.py

Requisitos:
  pip install unsloth transformers datasets trl peft accelerate bitsandbytes
"""
import os
import json
from unsloth import FastLanguageModel, is_bfloat16_supported
from unsloth.chat_templates import get_chat_template
from datasets import Dataset
from trl import SFTTrainer, SFTConfig
import torch

# ─────────────────────────────────────────────────────────────
# Configuración
# ─────────────────────────────────────────────────────────────
MODEL_NAME = os.getenv("KORU_BASE_MODEL", "unsloth/Qwen3-27B")  # o "qwen3.6:27b" si está en HF
MAX_SEQ_LENGTH = 8192
DATASET_PATH = "finetune/koru-dataset-v1.jsonl"
OUTPUT_DIR = "finetune/outputs/koru-qwen-27b"
LORA_R = 64
LORA_ALPHA = 128
LORA_DROPOUT = 0.0
BATCH_SIZE = 1
GRAD_ACCUM = 4
MAX_STEPS = 500
LEARNING_RATE = 2e-4
WARMUP_STEPS = 20

# ─────────────────────────────────────────────────────────────
# 1. Cargar modelo y tokenizer
# ─────────────────────────────────────────────────────────────
print(f"Cargando modelo base: {MODEL_NAME}")
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=MODEL_NAME,
    max_seq_length=MAX_SEQ_LENGTH,
    load_in_4bit=True,  # QLoRA para ahorrar VRAM; 27B Q4 ~ 18GB
    dtype=None,
    attn_implementation="flash_attention_2" if torch.cuda.is_available() else None,
)

# Configurar chat template de Qwen (Hermes-style tool use)
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
def load_dataset(path: str) -> Dataset:
    messages = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            data = json.loads(line)
            messages.append({"messages": data["messages"]})
    return Dataset.from_list(messages)

raw_dataset = load_dataset(DATASET_PATH)
print(f"Dataset cargado: {len(raw_dataset)} ejemplos")

# Aplicar chat template
# Unsloth requiere texto plano para SFT
def format_messages(example):
    text = tokenizer.apply_chat_template(
        example["messages"],
        tokenize=False,
        add_generation_prompt=False,
    )
    return {"text": text}

dataset = raw_dataset.map(format_messages, remove_columns=raw_dataset.column_names)

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

print("Iniciando entrenamiento...")
trainer.train()

# ─────────────────────────────────────────────────────────────
# 4. Guardar adapter
# ─────────────────────────────────────────────────────────────
ADAPTER_DIR = "finetune/adapters/koru-qwen-27b"
model.save_pretrained(ADAPTER_DIR)
tokenizer.save_pretrained(ADAPTER_DIR)
print(f"✓ Adapter guardado en {ADAPTER_DIR}")

# ─────────────────────────────────────────────────────────────
# 5. Mergear a fp16 (opcional, para GGUF)
# ─────────────────────────────────────────────────────────────
MERGED_DIR = "finetune/merged/koru-qwen-27b-f16"
print(f"Mergeando adapter con base en {MERGED_DIR}...")
model.save_pretrained_merged(MERGED_DIR, tokenizer, save_method="merged_16bit")
print(f"✓ Modelo mergeado guardado en {MERGED_DIR}")
