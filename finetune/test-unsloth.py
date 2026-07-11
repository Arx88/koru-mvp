#!/usr/bin/env python3
"""
Test rápido para verificar que Unsloth carga un modelo correctamente.
"""
import torch
from unsloth import FastLanguageModel

print("CUDA disponible:", torch.cuda.is_available())
if torch.cuda.is_available():
    print("GPU:", torch.cuda.get_device_name(0))
    print("VRAM:", torch.cuda.get_device_properties(0).total_memory / 1e9, "GB")

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/Llama-3.1-8B-Instruct",
    max_seq_length=8192,
    load_in_4bit=True,
    dtype=torch.bfloat16,
    device_map="auto",
)

print("Modelo cargado:", model.config.model_type)
print("Capas:", len(list(model.modules())))
