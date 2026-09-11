import { describe, it, expect } from "vitest";
import {
  ProviderConfigError,
  classifyProviderStatus,
  describeProviderFailures,
  isProviderConfigError,
  providerErrorDetail,
} from "./types";
import { providerResultIsValid, isRateLimitError } from "./index";

describe("classifyProviderStatus", () => {
  it("trata 401/403 como credencial, no como saturación", () => {
    expect(classifyProviderStatus(401)).toBe("auth");
    expect(classifyProviderStatus(403)).toBe("auth");
  });

  it("trata 404/410 como modelo inexistente o retirado", () => {
    expect(classifyProviderStatus(404)).toBe("model");
    expect(classifyProviderStatus(410)).toBe("model");
  });

  it("trata 429 y 5xx como transitorios (esos sí se reintentan)", () => {
    expect(classifyProviderStatus(429)).toBe("transient");
    expect(classifyProviderStatus(500)).toBe("transient");
    expect(classifyProviderStatus(503)).toBe("transient");
  });

  it("trata 400/422 como pedido mal armado", () => {
    expect(classifyProviderStatus(400)).toBe("request");
    expect(classifyProviderStatus(422)).toBe("request");
  });
});

describe("ProviderConfigError", () => {
  it("guarda status y kind, y el mensaje incluye el detalle del proveedor", () => {
    const err = new ProviderConfigError("NVIDIA", 410, "has reached its end of life on 2026-08-25");
    expect(err.name).toBe("ProviderConfigError");
    expect(err.status).toBe(410);
    expect(err.kind).toBe("model");
    expect(err.message).toContain("410");
    expect(err.message).toContain("end of life");
  });

  it("no se confunde con un error transitorio", () => {
    expect(isProviderConfigError(new ProviderConfigError("NVIDIA", 403))).toBe(true);
    expect(isProviderConfigError(new Error("429 too many requests"))).toBe(false);
    expect(isProviderConfigError(undefined)).toBe(false);
  });

  it("un 403 es auth y un 400 cae en request (nunca transient)", () => {
    expect(new ProviderConfigError("OpenRouter x", 403).kind).toBe("auth");
    expect(new ProviderConfigError("OpenRouter x", 400).kind).toBe("request");
  });
});

describe("providerErrorDetail", () => {
  it("saca el mensaje de las formas que usan NVIDIA/OpenRouter", () => {
    expect(providerErrorDetail({ error: { message: "model not found" } })).toBe("model not found");
    expect(providerErrorDetail({ error: { detail: "unauthorized" } })).toBe("unauthorized");
    expect(providerErrorDetail({ detail: "gone" })).toBe("gone");
    expect(providerErrorDetail({ message: "bad request" })).toBe("bad request");
    expect(providerErrorDetail({ error: "plain string" })).toBe("plain string");
  });

  it("devuelve undefined cuando no hay nada legible", () => {
    expect(providerErrorDetail({})).toBeUndefined();
    expect(providerErrorDetail(null)).toBeUndefined();
    expect(providerErrorDetail(undefined)).toBeUndefined();
  });
});

describe("describeProviderFailures", () => {
  it("conserva la causa de cada candidato en vez del AggregateError", () => {
    const failures = describeProviderFailures([
      new ProviderConfigError("OpenRouter a/1", 403, "invalid key"),
      new Error("429 too many requests"),
    ]);
    expect(failures.message).toContain("403");
    expect(failures.message).toContain("429");
    expect(failures.configErrors).toHaveLength(1);
    expect(failures.allRateLimited).toBe(false);
  });

  it("detecta cuando TODOS los candidatos fallaron por cuota", () => {
    const failures = describeProviderFailures([new Error("429 a"), new Error("rate limit b")]);
    expect(failures.allRateLimited).toBe(true);
    expect(failures.configErrors).toHaveLength(0);
  });

  it("el resumen de cuota se detecta como rate limit y no llega como contenido", () => {
    const failures = describeProviderFailures([new Error("429 a"), new Error("429 b")]);
    const err = new Error(`OpenRouter agotó la cuota en los 2 candidatos: ${failures.message}`);
    err.name = "RateLimitError";
    expect(isRateLimitError(err)).toBe(true);
    // El literal del AggregateError estaba en la blacklist: ya no debería producirse.
    expect(providerResultIsValid({ provider: "openrouter", message: { content: failures.message } })).toBe(true);
    expect(providerResultIsValid({ provider: "openrouter", message: { content: "All promises were rejected" } })).toBe(false);
  });
});
