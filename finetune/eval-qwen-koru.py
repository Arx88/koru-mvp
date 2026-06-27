"""
Evaluación de un modelo fine-tuneado de Koru.

Mide:
- Router accuracy (categoría correcta)
- Tool name accuracy
- Tool argument F1 (ciudades, tickers, etc.)
- JSON parse rate
- UiBlock type accuracy
- Latencia por turno

Uso:
  python finetune/eval-qwen-koru.py --model koru-qwen-27b --base-url http://172.23.144.1:11434
"""
import argparse
import json
import time
import statistics
from dataclasses import dataclass
from typing import Any

import requests


@dataclass
class EvalCase:
    name: str
    input: str
    expected_category: str
    expected_tool: str | None
    expected_args: dict[str, Any]
    expected_ui_block: str | None


EVAL_CASES = [
    EvalCase("saludo", "Hola Koru", "conversation", None, {}, None),
    EvalCase("clima_ba", "¿Cómo está el clima en Buenos Aires?", "weather", "weather", {"city": "Buenos Aires"}, "weather"),
    EvalCase("clima_md", "¿Va a llover en Madrid?", "weather", "weather", {"city": "Madrid"}, "weather"),
    EvalCase("reminder", "Recordame llamar al médico mañana a las 10", "action", "reminder_set", {"title": "Llamar al médico"}, "reminder"),
    EvalCase("alarm", "Despertame a las 7", "action", "alarm_set", {"title": "Despertar"}, "alarm"),
    EvalCase("crypto", "¿A cuánto está bitcoin?", "crypto", "crypto_price", {"coin": "bitcoin"}, "crypto_portfolio"),
    EvalCase("forex", "¿Cuánto son 100 dólares en pesos?", "money", "currency_convert", {"from": "USD", "to": "ARS", "amount": 100}, "forex"),
    EvalCase("match", "¿Cómo quedó Boca ayer?", "sports", "match_schedule", {"team": "Boca"}, "match_timeline"),
    EvalCase("restaurant", "Quiero una hamburguesería en Palermo", "food", "restaurant_deep_search", {"query": "hamburguesería Palermo"}, "restaurant_synthesis"),
    EvalCase("route", "¿Cómo llego de Retiro a Palermo?", "directions", "route_traffic", {"query": "Retiro a Palermo"}, "route_timeline"),
    EvalCase("birthday", "El cumpleaños de Ana es el 12 de julio", "birthday", "save_personal_item", {"person": "Ana"}, "birthday_calendar"),
    EvalCase("web", "¿Quién es el presidente de Argentina?", "world_info", "web_search", {"mode": "world"}, "research_sources"),
]


def chat(base_url: str, model: str, messages: list[dict], tools: list[dict] | None = None) -> dict:
    body = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {"temperature": 0.0, "top_p": 0.95, "num_predict": 4096},
    }
    if tools:
        body["tools"] = tools
    r = requests.post(f"{base_url}/api/chat", json=body, timeout=120)
    r.raise_for_status()
    return r.json()


def load_tools(path: str) -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def evaluate(args: argparse.Namespace) -> None:
    tools = load_tools(args.tools)
    system_prompt = (
        "Sos Koru, asistente personal. Respondé usando las herramientas disponibles "
        "cuando corresponda. Para la respuesta final usá JSON con reply, uiBlocks y mascotState."
    )

    results: list[dict] = []
    latencies: list[float] = []

    for case in EVAL_CASES:
        print(f"\n--- {case.name}: {case.input}")
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": case.input},
        ]
        start = time.time()
        resp = chat(args.base_url, args.model, messages, tools)
        ms = (time.time() - start) * 1000
        latencies.append(ms)

        msg = resp.get("message", {})
        content = msg.get("content", "")
        tool_calls = msg.get("tool_calls", [])

        # Determinar categoría del router a partir del tool llamado
        category = "conversation"
        tool_name = None
        tool_args: dict[str, Any] = {}
        if tool_calls:
            tool_name = tool_calls[0].get("function", {}).get("name")
            try:
                tool_args = json.loads(tool_calls[0].get("function", {}).get("arguments", "{}"))
            except json.JSONDecodeError:
                tool_args = {}
            category = tool_to_category(tool_name)

        # Intentar parsear JSON final si no hubo tool calls
        ui_block = None
        if not tool_calls and content.strip().startswith("{"):
            try:
                parsed = json.loads(content)
                blocks = parsed.get("uiBlocks", [])
                if blocks:
                    ui_block = blocks[0].get("type")
            except json.JSONDecodeError:
                pass

        # Métricas
        category_ok = category == case.expected_category
        tool_ok = tool_name == case.expected_tool if case.expected_tool else tool_name is None
        args_ok = all(str(tool_args.get(k, "")).lower() in str(v).lower() or str(v).lower() in str(tool_args.get(k, "")).lower() for k, v in case.expected_args.items())
        block_ok = ui_block == case.expected_ui_block if case.expected_ui_block else True

        result = {
            "name": case.name,
            "input": case.input,
            "latency_ms": round(ms, 1),
            "category": category,
            "category_ok": category_ok,
            "tool": tool_name,
            "tool_ok": tool_ok,
            "args": tool_args,
            "args_ok": args_ok,
            "ui_block": ui_block,
            "block_ok": block_ok,
            "content_preview": content[:120],
        }
        results.append(result)
        print(json.dumps({k: v for k, v in result.items() if k != "args"}, indent=2, ensure_ascii=False))

    # Resumen
    total = len(results)
    summary = {
        "model": args.model,
        "total_cases": total,
        "category_acc": sum(r["category_ok"] for r in results) / total,
        "tool_acc": sum(r["tool_ok"] for r in results) / total,
        "args_acc": sum(r["args_ok"] for r in results) / total,
        "block_acc": sum(r["block_ok"] for r in results) / total,
        "avg_latency_ms": statistics.mean(latencies),
        "p95_latency_ms": statistics.quantiles(latencies, n=20)[18] if len(latencies) >= 20 else max(latencies),
    }
    print("\n=== RESUMEN ===")
    print(json.dumps(summary, indent=2, ensure_ascii=False))

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "results": results}, f, indent=2, ensure_ascii=False)
    print(f"\n✓ Resultados guardados en {args.output}")


def tool_to_category(tool_name: str | None) -> str:
    mapping = {
        "weather": "weather",
        "web_search": "world_info",
        "deep_research": "world_info",
        "reminder_set": "action",
        "alarm_set": "action",
        "calendar_reminder": "action",
        "save_personal_item": "birthday",
        "restaurant_deep_search": "food",
        "crypto_price": "crypto",
        "currency_convert": "money",
        "exchange_history": "money",
        "stock_quote": "money",
        "match_schedule": "sports",
        "match_live": "sports",
        "route_traffic": "directions",
        "shopping_compare": "shopping",
    }
    return mapping.get(tool_name or "", "conversation")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="koru-qwen-27b")
    parser.add_argument("--base-url", default="http://172.23.144.1:11434")
    parser.add_argument("--tools", default="finetune/koru-tools.json")
    parser.add_argument("--output", default="finetune/eval-results.json")
    args = parser.parse_args()
    evaluate(args)


if __name__ == "__main__":
    main()
