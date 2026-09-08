/**
 * Tests de los 10 interiores Lectura nuevos — el cierre de la deuda de
 * estética: ningún block del chat debe caer al render genérico Kimi viejo.
 *
 * Cubre: registro completo (los 15 tipos), render honesto (sin datos no se
 * inventan), interacciones legítimas (toggle shopping, complete reminder,
 * answer clarifying con puente koru:chat-send).
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { lecturaInteriorFor } from "../index";
import { ReminderInterior } from "../panels/ReminderInterior";
import { ShopInterior } from "../panels/ShopInterior";
import { ReviewQuoteInterior } from "../panels/ReviewQuoteInterior";
import { TennisInterior } from "../panels/TennisInterior";
import { WebNavInterior } from "../panels/WebNavInterior";
import { SignalInterior } from "../panels/SignalInterior";
import { GenerationInterior } from "../panels/GenerationInterior";
import { ClarifyInterior } from "../panels/ClarifyInterior";
import { ActivityInterior } from "../panels/ActivityInterior";
import { UniversalInterior } from "../panels/UniversalInterior";
import type { UiBlock } from "../../../../domain/types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const nop = () => {};

describe("REGISTRY — cero VER MÁS con estética vieja", () => {
  const REGISTERED = [
    "weather",
    "plan",
    "outfit",
    "live_match",
    "news_urgent",
    "restaurant_synthesis",
    "recipe",
    "movie_review",
    "book_review",
    "alarm",
    "smart_checklist",
    "morning_brief",
    "health_reminder",
    "market",
    "crypto_portfolio",
    "forex",
    "money_summary",
    "data_ticker",
    "route_timeline",
    "route_map",
    "transport_compare",
    "delivery",
    "birthday_calendar",
    "birthday_alarm",
    "social_interaction",
    "comparison",
    "product_analysis",
    "review_score",
    "review_document",
    "election_vote",
    "election_results",
    "match_stats",
    "memory",
    "match_timeline",
    "research_sources",
    "resource_bundle",
    "saved_record",
    "travel_plan",
    "deliverable",
    "data_card",
    "reminder",
    "shopping_list",
    "review_quote",
    "tennis_match",
    "web_nav",
    "proactive_signal",
    "generation",
    "clarifying_question",
    "activity_group",
    "decision_support",
    "travel_planner",
    "wellbeing",
    "activity_tracker",
    "urgent_now",
    "exercise_plan",
  ];

  it("todos los tipos de block con detail tienen interior Lectura registrado", () => {
    for (const type of REGISTERED) {
      // El registro es por block.type — probamos con un block espía.
      const spy = { type } as UiBlock;
      expect(lecturaInteriorFor(spy), `falta interior para "${type}"`).not.toBeNull();
    }
  });
});

describe("ReminderInterior", () => {
  it("muestra hora y nota del block, sin inventar", () => {
    const block = {
      type: "reminder",
      title: "Llamar al dentista",
      dueText: "Hoy 16:00",
      note: "Confirmar el turno del viernes.",
    } as UiBlock & { dueText: string };
    render(<ReminderInterior block={block as never} onClose={nop} />);
    expect(screen.getAllByText(/Llamar al dentista/i).length).toBeGreaterThan(0);
    expect(screen.getByText("16:00", { selector: ".big" })).toBeTruthy();
    expect(screen.getByText(/Confirmar el turno/i)).toBeTruthy();
  });

  it("sin dueText no renderiza hora inventada", () => {
    const block = { type: "reminder", title: "Solo un apunte" } as never;
    render(<ReminderInterior block={block} onClose={nop} />);
    expect(screen.getByText(/Sin hora fija/i)).toBeTruthy();
  });

  it("«ya está» despacha complete y cierra", () => {
    const spy = vi.spyOn(window, "dispatchEvent");
    const close = vi.fn();
    const block = { type: "reminder", title: "X" } as never;
    render(<ReminderInterior block={block} onClose={close} />);
    fireEvent.click(screen.getByRole("button", { name: /ya está/i }));
    const evt = spy.mock.calls.at(-1)?.[0] as CustomEvent;
    expect((evt as CustomEvent).detail?.action).toBe("complete");
    expect(close).toHaveBeenCalled();
  });
});

describe("ShopInterior", () => {
  const block = {
    type: "shopping_list",
    title: "Super",
    items: ["Café", "Huevos", "Pan"],
    quantities: { Huevos: 12 },
    checked: ["Pan"],
  } as never;

  it("marca lo ya comprado y las cantidades como pastilla", () => {
    render(<ShopInterior block={block} onClose={nop} />);
    expect(screen.getByText("×12")).toBeTruthy();
    const pan = screen.getByRole("button", { name: /pan/i });
    expect(pan.className).toContain("done");
  });

  it("el toggle despacha toggle_shopping con ids sintéticos", () => {
    const spy = vi.spyOn(window, "dispatchEvent");
    render(<ShopInterior block={block} onClose={nop} />);
    fireEvent.click(screen.getByRole("button", { name: /^café/i }));
    const evt = spy.mock.calls.at(-1)?.[0] as CustomEvent;
    expect(evt.detail?.action).toBe("toggle_shopping");
    expect(String(evt.detail?.listId)).toMatch(/^shoplist_/);
    expect(evt.detail?.itemId).toBe("Café");
  });

  it("sin items → estado vacío honesto", () => {
    render(<ShopInterior block={{ type: "shopping_list", items: [] } as never} onClose={nop} />);
    expect(screen.getByText(/Lista vacía/i)).toBeTruthy();
  });
});

describe("ReviewQuoteInterior", () => {
  it("cita textual + fuente + tags", () => {
    const block = {
      type: "review_quote",
      sourceName: "Marca",
      sourceType: "Prensa deportiva",
      quote: "Pedri está jugando su mejor temporada.",
      tags: ["Barcelona", "LaLiga"],
      buttonLabel: "Leer la nota",
    } as never;
    render(<ReviewQuoteInterior block={block} onClose={nop} />);
    expect(screen.getByText(/mejor temporada/i, { selector: "blockquote" })).toBeTruthy();
    expect(screen.getAllByText("Marca").length).toBeGreaterThan(0);
    expect(screen.getByText("Barcelona", { selector: ".q-chip" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /leer la nota/i })).toBeTruthy();
  });

  it("sin quote → mensaje honesto, no cita falsa", () => {
    render(<ReviewQuoteInterior block={{ type: "review_quote", sourceName: "X" } as never} onClose={nop} />);
    expect(screen.getByText(/cita llega vacía/i)).toBeTruthy();
  });
});

describe("TennisInterior", () => {
  const block = {
    type: "tennis_match",
    status: "live",
    players: {
      home: { name: "Carlos Alcaraz", country: "ESP", rank: 1 },
      away: { name: "Jannik Sinner", country: "ITA", rank: 2 },
    },
    tournament: { name: "US Open 2026", round: "Semifinal", surface: "Pista dura", category: "Grand Slam" },
    sets: [
      { homeGames: 6, awayGames: 4, winner: "home" },
      { homeGames: 3, awayGames: 6, winner: "away" },
    ],
    currentSet: { gamesHome: 4, gamesAway: 5, server: "away" },
    currentPoint: "30-30",
    stats: { aces: { h: 8, a: 11 }, doubleFaults: { h: 2, a: 3 } },
  } as never;

  it("tanteador por sets + sets ganados + punto actual", () => {
    render(<TennisInterior block={block} onClose={nop} />);
    expect(screen.getAllByText(/Alcaraz/i).length).toBeGreaterThan(1);
    expect(screen.getByText("30-30", { selector: ".tn-point b" })).toBeTruthy();
    expect(screen.getByText(/EN VIVO/i)).toBeTruthy();
    // sets ganados 1-1 + games del set 1 (6-4)
    expect(screen.getAllByText("6", { selector: ".tn-grid-val" }).length).toBe(2);
    expect(screen.getAllByText("4", { selector: ".tn-grid-val" }).length).toBe(2);
  });

  it("sin sets no inventa games (no crashea)", () => {
    render(
      <TennisInterior
        block={{ type: "tennis_match", players: { home: { name: "A" }, away: { name: "B" } } } as never}
        onClose={nop}
      />,
    );
    expect(screen.getByText(/A – B/i)).toBeTruthy();
  });
});

describe("WebNavInterior", () => {
  it("síntesis + hallazgos + resultados linkeables", () => {
    const block = {
      type: "web_nav",
      title: "Búsqueda: cafés",
      status: "complete",
      query: "cafés madrid",
      summary: "Tres fuentes coinciden.",
      findings: ["Hola Coffee repite en las tres guías"],
      results: [
        { title: "Las 10 mejores", source: "El País", url: "https://elpais.com", type: "article", readTime: "6 min" },
      ],
    } as never;
    render(<WebNavInterior block={block} onClose={nop} />);
    expect(screen.getByText(/Tres fuentes coinciden/i)).toBeTruthy();
    expect(screen.getByText(/Hola Coffee repite/i)).toBeTruthy();
    const link = screen.getByRole("link", { name: /las 10 mejores/i });
    expect(link.getAttribute("href")).toBe("https://elpais.com");
  });

  it("resultados sin URL válida no se linkean (nada inventado)", () => {
    const block = {
      type: "web_nav",
      results: [{ title: "Rota", source: "X", url: "no-url", type: "page" }],
    } as never;
    render(<WebNavInterior block={block} onClose={nop} />);
    expect(screen.getByText(/no devolvió fuentes linkeables/i)).toBeTruthy();
  });
});

describe("SignalInterior", () => {
  it("severidad + cifras + pregunta de seguimiento", () => {
    const block = {
      type: "proactive_signal",
      category: "weather",
      severity: "useful",
      title: "Cambio de clima",
      body: "A las 17 entra un frente.",
      followUpQuestion: "¿Te muevo la caminata?",
      summaryItems: [{ label: "Prob. lluvia", value: "60%", detail: "desde las 17" }],
    } as never;
    render(<SignalInterior block={block} onClose={nop} />);
    expect(screen.getByText(/Clima · Útil/i)).toBeTruthy();
    expect(screen.getByText("60%")).toBeTruthy();
    expect(screen.getByText(/muevo la caminata/i)).toBeTruthy();
  });
});

describe("GenerationInterior", () => {
  it("prompt textual + preview + tips", () => {
    const block = {
      type: "generation",
      title: "Wallpaper",
      prompt: "amanecer minimalista",
      resultType: "text",
      preview: "Horizonte bajo con tres capas.",
      tips: ["Pedí paleta exacta"],
    } as never;
    render(<GenerationInterior block={block} onClose={nop} />);
    expect(screen.getByText(/amanecer minimalista/i)).toBeTruthy();
    expect(screen.getByText(/tres capas/i)).toBeTruthy();
    expect(screen.getByText(/paleta exacta/i)).toBeTruthy();
  });
});

describe("ClarifyInterior", () => {
  it("opciones tipeables → envían la respuesta al chat real", () => {
    const spy = vi.spyOn(window, "dispatchEvent");
    const close = vi.fn();
    const block = {
      type: "clarifying_question",
      title: "Antes de armarte el plan",
      question: "¿Tranqui o escapada?",
      options: ["Tranqui en casa", "Escapada"],
    } as never;
    render(<ClarifyInterior block={block} onClose={close} />);
    fireEvent.click(screen.getByRole("button", { name: /tranqui en casa/i }));
    const events = spy.mock.calls.map((c) => c[0] as CustomEvent);
    const send = events.find((e) => e.type === "koru:chat-send");
    expect(send?.detail?.text).toBe("Tranqui en casa");
    const answer = events.find((e) => e.type === "koru-card-action");
    expect(answer?.detail?.action).toBe("clarifying:answer");
    expect(close).toHaveBeenCalled();
  });
});

describe("ActivityInterior", () => {
  it("anillo de energía real + tiles por sección", () => {
    const block = {
      type: "activity_group",
      title: "Tu semana",
      energy: { value: 72, label: "energía" },
      sections: [
        {
          title: "Hoy",
          tone: "green",
          tiles: [{ kind: "weather", label: "Tarde", value: "26°", detail: "Parcial" }],
        },
      ],
    } as never;
    render(<ActivityInterior block={block} onClose={nop} />);
    expect(screen.getByText("72")).toBeTruthy();
    expect(screen.getByText("26°")).toBeTruthy();
    expect(screen.getByText("Hoy")).toBeTruthy();
  });
});

describe("UniversalInterior (respaldo)", () => {
  it("renderiza secciones del detail en estética Lectura", () => {
    const block = { type: "decision_support", title: "¿Renovar?" } as never;
    const detail = {
      title: "¿Renovar el alquiler?",
      subtitle: "Las opciones, con números",
      sections: [
        { kind: "rows", icon: "list", accent: { color: "#8363f9" }, title: "Opciones", rows: [{ title: "Renegociar", meta: "60%" }] },
        { kind: "text", icon: "auto_awesome", accent: { color: "#8363f9" }, title: "Mi lectura", body: "Renegociar tiene mejor número." },
      ],
    };
    render(<UniversalInterior block={block} detail={detail as never} onClose={nop} />);
    expect(screen.getByText("Renegociar", { selector: "b" })).toBeTruthy();
    expect(screen.getByText(/mejor número/i, { selector: "p" })).toBeTruthy();
    expect(screen.getByText("60%", { selector: "em" })).toBeTruthy();
  });

  it("sin detail → estado vacío honesto", () => {
    render(<UniversalInterior block={{ type: "wellbeing", title: "Bienestar" } as never} onClose={nop} />);
    expect(screen.getByText(/no trae secciones extendidas/i)).toBeTruthy();
  });
});
