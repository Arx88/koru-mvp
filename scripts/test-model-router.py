#!/usr/bin/env python3
"""
Test E2E del router de modelos NVIDIA.
Mide latencia y modelo usado para 8 situaciones distintas.
"""
import json
import time
import urllib.request
import sys

API_URL = "http://localhost:3000/api/koru/turn"
MODEL = "nvidia/nemotron-3-ultra-550b-a55b"
STATE = {
    "memories": [],
    "commitments": [],
    "records": [],
    "userName": "Test",
}

TESTS = [
    {
        "name": "1. Saludo trivial (flash)",
        "input": "hola",
        "expect_model_tier": "fast",
    },
    {
        "name": "2. Cortesía trivial (flash)",
        "input": "gracias, nos vemos",
        "expect_model_tier": "fast",
    },
    {
        "name": "3. Gasto normal (medium/ultra)",
        "input": "anota 2500 de almuerzo",
        "expect_model_tier": "medium_or_ultra",
    },
    {
        "name": "4. Clima con tool (medium/ultra)",
        "input": "que clima hace en Barcelona",
        "expect_model_tier": "medium_or_ultra",
    },
    {
        "name": "5. Lista de compras (medium/ultra)",
        "input": "necesito leche, huevos y pan",
        "expect_model_tier": "medium_or_ultra",
    },
    {
        "name": "6. Pregunta conversacional (flash/medium)",
        "input": "que hora es",
        "expect_model_tier": "fast_or_medium",
    },
    {
        "name": "7. Pregunta de conocimiento (medium/ultra)",
        "input": "quien fue Albert Einstein",
        "expect_model_tier": "medium_or_ultra",
    },
    {
        "name": "8. Cierre del día (flash)",
        "input": "anota que hoy fue un buen dia",
        "expect_model_tier": "medium_or_ultra",
    },
]

def run_test(test, history):
    payload = json.dumps({
        "input": test["input"],
        "history": history,
        "state": STATE,
        "model": MODEL,
    }).encode()

    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
    )

    start = time.time()
    try:
        resp = urllib.request.urlopen(req, timeout=120)
        elapsed = time.time() - start
        data = json.loads(resp.read().decode())

        reply = data.get("reply", "?")[:120]
        model_used = data.get("model", "?")
        provider = data.get("provider", "?")
        fallback = data.get("fallbackReason", "")
        ui_blocks = len(data.get("uiBlocks", []))
        tool_results = len(data.get("toolResults", []))

        return {
            "name": test["name"],
            "input": test["input"],
            "reply": reply,
            "model": model_used,
            "provider": provider,
            "fallback": fallback,
            "elapsed_s": round(elapsed, 1),
            "ui_blocks": ui_blocks,
            "tool_results": tool_results,
            "status": "OK" if reply and reply != "?" else "FAIL",
        }
    except Exception as e:
        elapsed = time.time() - start
        return {
            "name": test["name"],
            "input": test["input"],
            "reply": f"ERROR: {e}",
            "model": "?",
            "provider": "?",
            "fallback": "",
            "elapsed_s": round(elapsed, 1),
            "ui_blocks": 0,
            "tool_results": 0,
            "status": "FAIL",
        }

# Run all tests
history = []
results = []
for test in TESTS:
    print(f"\n{'='*60}")
    print(f"Test: {test['name']}")
    print(f"Input: \"{test['input']}\"")
    print(f"Esperando tier: {test['expect_model_tier']}")
    print(f"{'='*60}")

    result = run_test(test, history)
    results.append(result)

    print(f"Status: {result['status']}")
    print(f"Modelo: {result['model']}")
    print(f"Tiempo: {result['elapsed_s']}s")
    print(f"Reply: {result['reply']}")
    print(f"UI Blocks: {result['ui_blocks']}")
    print(f"Tool Results: {result['tool_results']}")
    if result['fallback']:
        print(f"Fallback: {result['fallback']}")

    # Add to history for context
    history.append({"role": "user", "content": test["input"]})
    history.append({"role": "assistant", "content": result["reply"]})

# Summary
print(f"\n\n{'='*80}")
print(f"RESUMEN DE LATENCIAS Y MODELOS")
print(f"{'='*80}")
print(f"{'Test':<45} {'Modelo':<40} {'Tiempo':>8} {'Status':>8}")
print(f"{'-'*45} {'-'*40} {'-'*8} {'-'*8}")
for r in results:
    print(f"{r['name']:<45} {r['model']:<40} {r['elapsed_s']:>6}s {r['status']:>8}")

# Stats
ok = sum(1 for r in results if r["status"] == "OK")
fail = sum(1 for r in results if r["status"] == "FAIL")
avg_time = sum(r["elapsed_s"] for r in results) / len(results)
fast_count = sum(1 for r in results if "flash" in r["model"] or "step" in r["model"])
ultra_count = sum(1 for r in results if "ultra" in r["model"] or "nemotron-3-ultra" in r["model"])
other_count = len(results) - fast_count - ultra_count

print(f"\n{'='*80}")
print(f"Estadísticas:")
print(f"  OK: {ok}/{len(results)}  |  FAIL: {fail}/{len(results)}")
print(f"  Tiempo promedio: {avg_time:.1f}s")
print(f"  Flash model usado: {fast_count} veces")
print(f"  Ultra model usado: {ultra_count} veces")
print(f"  Otros: {other_count} veces")
print(f"  Tiempo mínimo: {min(r['elapsed_s'] for r in results):.1f}s")
print(f"  Tiempo máximo: {max(r['elapsed_s'] for r in results):.1f}s")
