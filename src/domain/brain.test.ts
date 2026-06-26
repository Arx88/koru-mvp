import { describe, expect, it, vi } from "vitest";
import { analyzeReflection } from "./brain";
import {
  approveAndExecuteAction,
  confirmMemory,
  createInitialState,
  loadState,
  selectRelevantMemories,
  setActionPreparationEnabled,
  setDurableMemoryEnabled,
  setHeartbeatEnabled,
  submitReflection,
  toggleEphemeralMode,
} from "./store";
import type { MemoryFact } from "./types";
import { buildHeartbeatNudges } from "./heartbeat";

vi.mock("./freellmapi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./freellmapi")>();
  return {
    ...actual,
    preferredBrainProvider: () => "local",
    runOpenModelChat: () => Promise.reject(new Error("mocked")),
    runFreeLlmChat: () => Promise.reject(new Error("mocked")),
  };
});

describe("Koru Brain", () => {
  it("answers a plain greeting as chat, without turning it into emotional closure or work", async () => {
    const state = { ...createInitialState(), userName: "Alex" };
    const analysis = await analyzeReflection("Hola Koru", state);

    expect(analysis.response).toMatch(/Hola, Alex/i);
    expect(analysis.response.toLowerCase()).toContain("pendientes");
    expect(analysis.response.toLowerCase()).not.toContain("gracias por contarmelo");
    expect(analysis.response.toLowerCase()).not.toContain("no hace falta convertirlo en tarea");
    expect(analysis.response.toLowerCase()).not.toContain("lo dejamos asi");
    expect(analysis.actionProposals).toHaveLength(0);
    expect(analysis.memoryCandidates).toHaveLength(0);
    expect(analysis.commitments).toHaveLength(0);
    expect(analysis.provider).toBe("local");
  });

  it.skip("treats greeting plus weather as one mixed intent", async () => {
    const state = { ...createInitialState(), userName: "Alex" };
    const analysis = await analyzeReflection("Hola Koru, que clima hace?", state);
    const question = analysis.actionProposals.find((action) => action.kind === "clarifying_question");

    expect(analysis.response).toMatch(/Hola, Alex/i);
    expect(analysis.response.toLowerCase()).toContain("ciudad");
    expect(question?.payload.questions?.join(" ").toLowerCase()).toContain("ciudad");
    expect(analysis.actionProposals.some((action) => action.kind === "morning_brief")).toBe(false);
  });

  it.skip("uses a confirmed location memory for greeting plus weather", async () => {
    const now = new Date().toISOString();
    const state = {
      ...createInitialState(),
      memories: [{
        id: "mem_location",
        kind: "profile" as const,
        text: "Vivo en Madrid.",
        confidence: 0.95,
        sensitivity: "normal" as const,
        status: "confirmed" as const,
        createdAt: now,
        confirmedAt: now,
        sourceEntryId: "test",
        useForSuggestions: true,
      }],
    };

    const analysis = await analyzeReflection("Hola Koru, dime el clima", state);
    const weather = analysis.actionProposals.find((action) => action.kind === "web_research");

    expect(weather?.payload.webMode).toBe("weather");
    expect(weather?.payload.searchQueries?.join(" ").toLowerCase()).toContain("madrid");
    expect(analysis.response.toLowerCase()).toContain("lo miro");
  });

  it("extracts ordinary commitments and memory candidates from a realistic day", async () => {
    const state = createInitialState();
    const analysis = await analyzeReflection(
      "Hoy tuve reunion con Ana. Me preocupa llegar tarde manana y necesito mandar el presupuesto.",
      state,
    );

    expect(analysis.memoryCandidates.length).toBeGreaterThan(0);
    expect(analysis.commitments.length).toBeGreaterThanOrEqual(1);
    expect(analysis.actionProposals.length).toBeGreaterThanOrEqual(1);
    expect(analysis.response.toLowerCase()).toMatch(/puedo|apruebas|paso/);
    expect(analysis.response.toLowerCase()).not.toContain("te extrane");
    expect(analysis.response.toLowerCase()).not.toContain("separe hechos");
    expect(analysis.provider).toBe("local");
  });

  it("does not save memory candidates in ephemeral mode", async () => {
    const state = toggleEphemeralMode(createInitialState());
    const analysis = await analyzeReflection(
      "Estoy agotado y no quiero guardar esto como algo permanente. Solo necesito ordenar el dia.",
      state,
    );

    expect(analysis.memoryCandidates).toHaveLength(0);
    expect(analysis.energyAwarded).toBeGreaterThan(0);
    expect(analysis.actionProposals.length).toBeGreaterThanOrEqual(1);
  });

  it("grows by confirmed memory, not just raw disclosure", async () => {
    const first = (
      await submitReflection(
      createInitialState(),
      "Trabajo en un local. Hoy falto stock de cafe y necesito llamar al proveedor manana.",
      )
    ).state;
    const candidate = first.memories.find((memory: MemoryFact) => memory.status === "candidate");

    expect(candidate).toBeTruthy();
    const confirmed = confirmMemory(first, candidate!.id);
    expect(confirmed.trustedEnergy).toBeGreaterThan(first.trustedEnergy);
    expect(["seed", "sprout", "roots"]).toContain(confirmed.stage);
  });

  it("uses confirmed memory as active context", async () => {
    const first = (
      await submitReflection(createInitialState(), "Trabajo en un local y siempre me preocupa el stock de cafe.")
    ).state;
    const candidate = first.memories.find((memory: MemoryFact) => memory.status === "candidate");
    const confirmed = confirmMemory(first, candidate!.id);
    const analysis = await analyzeReflection("Hoy otra vez falto cafe y tengo que llamar al proveedor.", confirmed);

    expect(analysis.activeMemoryIds).toContain(candidate!.id);
    expect(analysis.response.toLowerCase()).toContain("ate cabos");
  });

  it("plans from accumulated open commitments when the user asks what to do today", async () => {
    const withPending = (
      await submitReflection(
        createInitialState(),
        "Tengo que mandar el presupuesto hoy y necesito llamar al proveedor manana.",
      )
    ).state;

    const analysis = await analyzeReflection("No se que hacer hoy, que tengo pendiente?", withPending);
    const dayPlan = analysis.actionProposals.find((action) => action.kind === "day_plan");
    const planTitles = dayPlan?.payload.planItems?.map((item) => item.title.toLowerCase()).join(" / ") ?? "";

    expect(dayPlan).toBeTruthy();
    expect(planTitles).toContain("presupuesto");
    expect(planTitles).toContain("proveedor");
    expect(dayPlan?.payload.contextReview?.some((item) => item.source === "commitment")).toBe(true);
  });

  it("asks for context instead of inventing a day plan when there is nothing saved", async () => {
    const state = createInitialState();
    const analysis = await analyzeReflection("No se que hacer, no tengo nada claro hoy.", state);
    const dayPlan = analysis.actionProposals.find((action) => action.kind === "day_plan");
    const question = analysis.actionProposals.find((action) => action.kind === "clarifying_question");

    expect(dayPlan).toBeFalsy();
    expect(question).toBeTruthy();
    expect(question?.payload.questions?.join(" ").toLowerCase()).toMatch(/pendiente|rondando|urgente/);
  });

  it.each([
    "No se que hacer hoy.",
    "Tengo muchas cosas en la cabeza y no se por donde empezar.",
    "No tengo nada claro hoy.",
  ])("asks instead of planning when the user gives no actionable context: %s", async (input) => {
    const analysis = await analyzeReflection(input, createInitialState());
    const planItems = analysis.actionProposals.flatMap((action) => action.payload.planItems ?? []);

    expect(analysis.actionProposals.some((action) => action.kind === "clarifying_question")).toBe(true);
    expect(analysis.actionProposals.some((action) => action.kind === "day_plan")).toBe(false);
    expect(planItems.some((item) => /no se|no tengo|nada claro|muchas cosas/i.test(item.title))).toBe(false);
  });

  it("does not create a multi-step plan for a one-step reminder", async () => {
    const analysis = await analyzeReflection("Recordame comprar leche hoy.", createInitialState());

    expect(analysis.commitments.some((commitment) => commitment.title.toLowerCase().includes("leche"))).toBe(true);
    expect(analysis.actionProposals.some((action) => action.kind === "day_plan")).toBe(false);
    expect(analysis.actionProposals.some((action) => action.kind === "reminder" || action.kind === "restock_note")).toBe(true);
  });

  it("understands natural shopping reminders without exact keyword dependence", async () => {
    const result = await submitReflection(createInitialState(), "Acordame que tengo que comprar huevos.");
    const shopping = result.state.records.find((record) => record.kind === "shopping_item");
    const commitment = result.state.commitments.find((item) => item.title.toLowerCase().includes("huevos"));
    const restock = result.state.actions.find((action) => action.kind === "restock_note");

    expect(commitment).toBeTruthy();
    expect(commitment?.title.toLowerCase()).toContain("comprar huevos");
    expect(shopping?.domain).toBe("home");
    expect(shopping?.value?.toLowerCase()).toContain("huevos");
    expect(restock?.payload.note?.toLowerCase()).toContain("huevos");
    expect(result.state.records.some((record) => record.kind === "meal_inventory" && /huevos/i.test(record.title))).toBe(false);
  });

  it("does not generate hardcoded Koru files when the requested document lacks required context", async () => {
    const analysis = await analyzeReflection("Preparame un CV.", createInitialState());
    const files = analysis.actionProposals.flatMap((action) => action.payload.files ?? []);
    const question = analysis.actionProposals.find((action) => action.kind === "clarifying_question");

    expect(files.some((file) => file.name === "Propuesta_Koru.md")).toBe(false);
    expect(question).toBeTruthy();
    expect(question?.payload.questions?.join(" ").toLowerCase()).toMatch(/experiencia|perfil|cv|formato/);
  });

  it("creates document names from the actual request and context, not from a fixed Koru bundle", async () => {
    const withContext = (
      await submitReflection(
        createInitialState(),
        "Estoy construyendo Koru como asistente personal con memoria, planes utiles y acciones locales.",
      )
    ).state;
    const analysis = await analyzeReflection("Preparame un resumen ejecutivo del avance para mi socia.", withContext);
    const fileAction = analysis.actionProposals.find((action) => action.kind === "file_bundle");
    const files = fileAction?.payload.files ?? [];

    expect(fileAction).toBeTruthy();
    expect(files).toHaveLength(1);
    expect(files[0].name).toMatch(/Resumen_ejecutivo/i);
    expect(files[0].name).not.toBe("Propuesta_Koru.md");
    expect(files[0].content?.toLowerCase()).toContain("socia");
  });

  it("uses document-specific structure instead of one generic template", async () => {
    const withContext = (
      await submitReflection(
        createInitialState(),
        "Koru ya guarda pendientes, pregunta cuando falta contexto y prepara planes con acciones reales.",
      )
    ).state;
    const analysis = await analyzeReflection("Preparame un resumen ejecutivo del avance para presentar.", withContext);
    const file = analysis.actionProposals.find((action) => action.kind === "file_bundle")?.payload.files?.[0];
    const content = file?.content?.toLowerCase() ?? "";

    expect(content).toContain("## estado actual");
    expect(content).toContain("## riesgos y pendientes");
    expect(content).toContain("## próximo paso recomendado");
    expect(content).not.toContain("## borrador\neste documento queda como primera versión editable");
  });

  it("turns a complex multi-part project into a plan made from the user's own tasks", async () => {
    const analysis = await analyzeReflection(
      "Tengo que lanzar Koru, hablar con mi socio, preparar una demo y comparar proveedores.",
      createInitialState(),
    );
    const dayPlan = analysis.actionProposals.find((action) => action.kind === "day_plan");
    const titles = dayPlan?.payload.planItems?.map((item) => item.title.toLowerCase()).join(" / ") ?? "";

    expect(dayPlan).toBeTruthy();
    expect(titles).toContain("lanzar koru");
    expect(titles).toContain("socio");
    expect(titles).toContain("demo");
    expect(titles).toContain("proveedores");
  });

  it("adapts day plan duration to low-energy context", async () => {
    const analysis = await analyzeReflection(
      "Estoy agotado. Tengo que mandar presupuesto hoy, llamar al proveedor y preparar una demo.",
      createInitialState(),
    );
    const dayPlan = analysis.actionProposals.find((action) => action.kind === "day_plan");
    const first = dayPlan?.payload.planItems?.[0];

    expect(dayPlan).toBeTruthy();
    expect(first?.durationMinutes).toBeLessThanOrEqual(25);
    expect(first?.mode).toBe("recovery");
  });

  it("prepares honest research briefs without pretending it fetched web results", async () => {
    const analysis = await analyzeReflection("Buscame cafeteras con buena relacion precio entrega manana.", createInitialState());
    const research = analysis.actionProposals.find((action) => action.kind === "web_research");

    expect(research).toBeTruthy();
    expect(research?.payload.searchQueries?.join(" ").toLowerCase()).toContain("cafeteras");
    expect(research?.payload.sources ?? []).toHaveLength(0);
    expect(research?.payload.externalStatus).toBe("pending");
    expect(research?.body.toLowerCase()).toContain("no marco esto como comparativa");
  });

  it("treats news as web navigation with recency criteria and no fake sources", async () => {
    const analysis = await analyzeReflection("Dame noticias relevantes de IA para mi trabajo hoy.", createInitialState());
    const research = analysis.actionProposals.find((action) => action.kind === "web_research");

    expect(research).toBeTruthy();
    expect(research?.title.toLowerCase()).toContain("noticias");
    expect(research?.payload.researchCriteria?.join(" ").toLowerCase()).toContain("fecha");
    expect(research?.payload.sources ?? []).toHaveLength(0);
  });

  it("asks only for location on simple weather requests without turning it into a morning brief", async () => {
    const analysis = await analyzeReflection("Que clima hace?", createInitialState());
    const question = analysis.actionProposals.find((action) => action.kind === "clarifying_question");

    expect(question).toBeTruthy();
    expect(question?.payload.questions?.join(" ").toLowerCase()).toContain("ciudad");
    expect(analysis.actionProposals.some((action) => action.kind === "morning_brief")).toBe(false);
    expect(analysis.actionProposals.some((action) => action.kind === "web_research")).toBe(false);
  });

  it("creates a weather web action when the location is present", async () => {
    const analysis = await analyzeReflection("Consultar clima real en Madrid", createInitialState());
    const research = analysis.actionProposals.find((action) => action.kind === "web_research");

    expect(research).toBeTruthy();
    expect(research?.payload.webMode).toBe("weather");
    expect(research?.payload.searchQueries?.join(" ").toLowerCase()).toContain("madrid");
  });

  it("turns world-signal requests into a dedicated proactive radar action", async () => {
    const analysis = await analyzeReflection("El mundo esta hablando de esto en IA, te enteraste?", createInitialState());
    const world = analysis.actionProposals.find((action) => action.kind === "world_signal");

    expect(world).toBeTruthy();
    expect(world?.payload.webMode).toBe("world");
    expect(world?.payload.searchQueries?.length).toBeGreaterThan(1);
    expect(world?.payload.sources ?? []).toHaveLength(0);
  });

  it("turns deep research into several complementary web queries", async () => {
    const analysis = await analyzeReflection("Haceme deep research sobre asistentes personales con memoria local.", createInitialState());
    const research = analysis.actionProposals.find((action) => action.kind === "web_research");

    expect(research).toBeTruthy();
    expect(research?.payload.searchQueries?.length).toBeGreaterThan(1);
    expect(research?.payload.researchCriteria?.join(" ").toLowerCase()).toContain("contraste");
  });

  it("does not turn one-off tasks into durable memories or duplicate open commitments", async () => {
    const first = (
      await submitReflection(createInitialState(), "Tengo que mandar el presupuesto hoy.")
    ).state;
    const second = (
      await submitReflection(first, "Tengo que mandar el presupuesto hoy.")
    ).state;

    const openBudgetCommitments = second.commitments.filter(
      (commitment) => commitment.status === "open" && commitment.title.toLowerCase().includes("presupuesto"),
    );
    const budgetMemories = second.memories.filter((memory) => memory.text.toLowerCase().includes("presupuesto"));

    expect(openBudgetCommitments).toHaveLength(1);
    expect(budgetMemories).toHaveLength(0);
  });

  it("deduplicates semantic commitment variants and keeps the strongest due hint", async () => {
    const first = (
      await submitReflection(createInitialState(), "Necesito llamar al proveedor.")
    ).state;
    const second = (
      await submitReflection(first, "Tengo que llamar al proveedor mañana por reposición de leche.")
    ).state;

    const providerCommitments = second.commitments.filter(
      (commitment) => commitment.status === "open" && commitment.title.toLowerCase().includes("proveedor"),
    );

    expect(providerCommitments).toHaveLength(1);
    expect(providerCommitments[0].dueHint).toBe("mañana");
  });

  it("understands accented Spanish for commitments, planning and research", async () => {
    const withPending = (
      await submitReflection(
        createInitialState(),
        "Mañana tengo reunión con Ana y necesito llegar preparado.",
      )
    ).state;
    const analysis = await analyzeReflection("No sé qué hacer hoy, ¿qué tengo pendiente?", withPending);
    const dayPlan = analysis.actionProposals.find((action) => action.kind === "day_plan");

    expect(withPending.commitments.some((commitment) => commitment.dueHint === "mañana")).toBe(true);
    expect(dayPlan?.payload.contextReview?.some((item) => item.source === "commitment")).toBe(true);
    expect(dayPlan?.payload.planItems?.some((item) => item.title.toLowerCase().includes("reunión"))).toBe(true);
  });

  it("executes an approved assistant action with an auditable result", async () => {
    const first = (
      await submitReflection(
        createInitialState(),
        "Hoy falto stock de cafe y necesito mandar mensaje al proveedor manana.",
      )
    ).state;
    const action = first.actions.find((item) => item.kind === "draft_message");

    expect(action).toBeTruthy();
    expect(action!.status).toBe("proposed");

    const executed = approveAndExecuteAction(first, action!.id);
    const updated = executed.actions.find((item) => item.id === action!.id);

    expect(updated?.status).toBe("executed");
    expect(updated?.result?.toLowerCase()).toContain("borrador listo");
    expect(executed.nudges[0]?.body.toLowerCase()).toContain("borrador listo");
  });

  it("turns an approved day plan into operational follow-up commitments", async () => {
    const first = (
      await submitReflection(
        createInitialState(),
        "Tengo que lanzar Koru, hablar con mi socio, preparar una demo y comparar proveedores.",
      )
    ).state;
    const plan = first.actions.find((item) => item.kind === "day_plan");

    expect(plan).toBeTruthy();

    const executed = approveAndExecuteAction(first, plan!.id);
    const openTitles = executed.commitments
      .filter((commitment) => commitment.status === "open")
      .map((commitment) => commitment.title.toLowerCase())
      .join(" / ");

    expect(executed.actions.find((item) => item.id === plan!.id)?.status).toBe("executed");
    expect(openTitles).toContain("lanzar koru");
    expect(openTitles).toContain("demo");
  });

  it("does not mark a commitment done just because a draft was prepared", async () => {
    const first = (
      await submitReflection(
        createInitialState(),
        "Necesito mandar mensaje al proveedor manana por reposicion de leche.",
      )
    ).state;
    const action = first.actions.find((item) => item.kind === "draft_message");
    const commitment = first.commitments.find((item) => item.title.toLowerCase().includes("proveedor"));

    expect(action).toBeTruthy();
    expect(commitment?.status).toBe("open");

    const executed = approveAndExecuteAction(first, action!.id);
    const updatedCommitment = executed.commitments.find((item) => item.id === commitment!.id);

    expect(updatedCommitment?.status).toBe("open");
  });

  it("captures expenses as records and summarizes spending later", async () => {
    let state = (await submitReflection(createInitialState(), "Anota gasto de 12 euros en supermercado.")).state;
    const capturedExpenseAction = state.actions.find((action) => action.kind === "structured_note");

    expect(capturedExpenseAction?.payload.uiBlock?.type).toBe("saved_record");
    expect(capturedExpenseAction?.payload.records).toHaveLength(1);
    expect(capturedExpenseAction?.payload.records?.[0]?.kind).toBe("expense");

    state = (await submitReflection(state, "Pague 8 euros de farmacia hoy.")).state;

    const expenses = state.records.filter((record) => record.kind === "expense");
    expect(expenses).toHaveLength(2);
    expect(expenses[0].amount).toBe(8);
    expect(expenses.every((record) => record.domain === "money")).toBe(true);
    expect(state.records.some((record) => record.kind === "shopping_item")).toBe(false);
    expect(state.actions.some((action) => action.payload.webMode === "shopping")).toBe(false);

    const analysis = await analyzeReflection("Cuanto gaste esta semana?", state);
    const summary = analysis.actionProposals.find((action) => action.kind === "money_summary");

    expect(summary).toBeTruthy();
    expect(summary?.payload.totalAmount).toBe(20);
    expect(summary?.payload.summaryItems?.some((item) => item.value.includes("20"))).toBe(true);
  });

  it("uses saved meal inventory when asked what is available at home", async () => {
    const state = (await submitReflection(createInitialState(), "Tengo arroz, pollo y huevos en casa.")).state;
    const inventory = state.records.find((record) => record.kind === "meal_inventory");

    expect(inventory?.domain).toBe("home");
    expect(inventory?.value?.toLowerCase()).toContain("arroz");

    const analysis = await analyzeReflection("Que tengo para comer en casa?", state);
    const brief = analysis.actionProposals.find((action) => action.kind === "morning_brief");

    expect(brief).toBeTruthy();
    expect(brief?.payload.summaryItems?.map((item) => item.value).join(" ").toLowerCase()).toContain("pollo");
    expect(brief?.payload.recommendation?.toLowerCase()).toContain("no invento");

    const afterQuestion = (await submitReflection(state, "Que tengo para comer en casa?")).state;
    const inventoryRecords = afterQuestion.records.filter((record) => record.kind === "meal_inventory");
    expect(inventoryRecords).toHaveLength(1);
    expect(afterQuestion.records.some((record) => /que tengo para comer/i.test(record.title))).toBe(false);
  });

  it("keeps medication in health records and brings it into a morning brief", async () => {
    const state = (await submitReflection(createInitialState(), "Recordame tomar el medicamento manana por la manana.")).state;
    const medication = state.records.find((record) => record.kind === "medication");

    expect(medication?.domain).toBe("health");
    expect(medication?.dueHint).toBe("mañana");

    const analysis = await analyzeReflection("Manana dame mi brief con medicamento y pendientes.", state);
    const brief = analysis.actionProposals.find((action) => action.kind === "morning_brief");

    expect(brief).toBeTruthy();
    expect(brief?.payload.summaryItems?.some((item) => /salud/i.test(item.label))).toBe(true);
    expect(brief?.payload.summaryItems?.map((item) => item.value).join(" ").toLowerCase()).toContain("medicamento");
  });

  it("prepares a meeting brief from saved notes and open follow-ups", async () => {
    const state = (
      await submitReflection(
        createInitialState(),
        "Manana tengo reunion con Ana. Necesito hablar del presupuesto y tomar notas para seguimiento.",
      )
    ).state;

    expect(state.records.some((record) => record.kind === "meeting_note")).toBe(true);

    const analysis = await analyzeReflection("Prepara mi reunion con Ana.", state);
    const meeting = analysis.actionProposals.find((action) => action.kind === "meeting_brief");

    expect(meeting).toBeTruthy();
    expect(meeting?.payload.summaryItems?.map((item) => item.value).join(" ").toLowerCase()).toContain("ana");
    expect(meeting?.payload.planItems?.length).toBeGreaterThan(0);
  });

  it("supports purchase decisions using recent expenses without pretending certainty", async () => {
    let state = (await submitReflection(createInitialState(), "Gaste 120 euros en supermercado esta semana.")).state;
    state = (await submitReflection(state, "Pague 80 euros de factura.")).state;

    const analysis = await analyzeReflection("Puedo permitirme comprar esto de 180 euros?", state);
    const decision = analysis.actionProposals.find((action) => action.kind === "decision_support");

    expect(decision).toBeTruthy();
    expect(decision?.payload.totalAmount).toBe(180);
    expect(decision?.payload.summaryItems?.map((item) => item.value).join(" ")).toContain("200");
    expect(decision?.payload.recommendation?.toLowerCase()).toMatch(/esperaria|confirmaria|presupuesto/);
    expect(analysis.actionProposals.some((action) => action.kind === "restock_note")).toBe(false);
    expect(analysis.actionProposals.some((action) => action.payload.webMode === "shopping")).toBe(false);
  });

  it("does not persist memories, records, commitments or nudges in ephemeral mode", async () => {
    const state = toggleEphemeralMode(createInitialState());
    const result = await submitReflection(
      state,
      "Gaste 20 euros en farmacia, tomo medicacion por la manana y recordame pagar la factura manana.",
    );

    expect(result.state.memories).toHaveLength(0);
    expect(result.state.records).toHaveLength(0);
    expect(result.state.commitments).toHaveLength(0);
    expect(result.state.nudges).toHaveLength(0);
    expect(result.state.entries).toHaveLength(0);
    expect(result.state.actions.some((action) => action.kind === "structured_note")).toBe(false);

    const persisted = loadState();
    expect(persisted.entries).toHaveLength(0);
    expect(persisted.records).toHaveLength(0);
    expect(persisted.commitments).toHaveLength(0);
    expect(persisted.actions).toHaveLength(0);
    expect(JSON.stringify(persisted).toLowerCase()).not.toContain("farmacia");
  });

  it("honors durable memory and action preparation permissions", async () => {
    const noMemory = setDurableMemoryEnabled(createInitialState(), false);
    const memoryResult = await submitReflection(
      noMemory,
      "Trabajo en un local y siempre me preocupa el stock de cafe.",
    );

    expect(memoryResult.state.memories).toHaveLength(0);
    expect(memoryResult.state.records).toHaveLength(0);
    expect(memoryResult.state.entries).toHaveLength(0);

    const noActions = setActionPreparationEnabled(createInitialState(), false);
    const actionResult = await submitReflection(
      noActions,
      "Tengo que lanzar Koru, hablar con mi socio, preparar una demo y comparar proveedores.",
    );

    expect(actionResult.state.actions).toHaveLength(0);
    expect(actionResult.state.commitments.length).toBeGreaterThan(0);
  });

  it("honors check-in permission for heartbeat nudges", async () => {
    let state = (await submitReflection(createInitialState(), "Recordame pagar la factura hoy.")).state;
    state = setHeartbeatEnabled(state, false);

    const nudges = buildHeartbeatNudges(state, new Date());

    expect(nudges).toHaveLength(0);
  });

  it("survives a 30-day simulated user journey as a useful adaptive companion", async () => {
    const days = [
      "Trabajo en un local y quiero que Koru me ayude a reducir carga mental.",
      "Siempre me cuesta arrancar cuando tengo muchas cosas abiertas.",
      "Tengo que mandar el presupuesto hoy y llamar al proveedor manana.",
      "No se que hacer hoy, que tengo pendiente?",
      "Buscame opciones de cafetera nueva con entrega manana.",
      "Preparame archivos del proyecto Koru para revisar con una socia.",
      "Estoy agotado y no se por donde empezar.",
      "Hoy falto stock de cafe y necesito mandar mensaje al proveedor manana.",
      "No tengo nada claro para hacer, intenta ayudarme igual.",
      "Quiero estudiar IA pero me cuesta sostenerlo todos los dias.",
      "Manana tengo reunion con Ana y necesito llegar preparado.",
      "Armame un plan de hoy con lo importante.",
      "Necesito escribir un borrador corto para el cliente.",
      "Investiga fuentes sobre asistentes personales con memoria local.",
      "Hoy quiero ordenar el local y cerrar pendientes chicos.",
      "No se por donde empezar con el proyecto Koru.",
      "Tengo que revisar precios y comparar opciones antes de comprar.",
      "Preparame un resumen ejecutivo del avance.",
      "Estoy tranquilo, quiero dejar algo listo para manana.",
      "Que tengo pendiente y que puedo soltar?",
      "Siempre prefiero que me des un primer paso chico.",
      "Tengo que llamar al proveedor manana por reposicion de leche.",
      "No se que hacer hoy.",
      "Preparame documentos para explicar Koru sin humo.",
      "Buscame comparativas para herramientas de research.",
      "Estoy con muchas cosas en la cabeza.",
      "Quiero mejorar mi rutina de cierre del dia.",
      "Necesito mandar presupuesto hoy.",
      "Que podria hacer si ya no hay nada urgente?",
      "Hagamos un cierre de mes: que aprendiste de mi forma de trabajar?",
    ];
    let state = createInitialState();

    for (const input of days) {
      const result = await submitReflection(state, input);
      state = result.state;
      expect(result.response.toLowerCase()).not.toContain("no pude conectar");
      expect(result.response.toLowerCase()).not.toContain("separe hechos");

      const candidate = state.memories.find((memory) => memory.status === "candidate" && memory.confidence >= 0.7);
      if (candidate) state = confirmMemory(state, candidate.id);

      const action = state.actions.find((item) =>
        item.status === "proposed" && ["day_plan", "draft_message", "file_bundle", "web_research"].includes(item.kind),
      );
      if (action) state = approveAndExecuteAction(state, action.id);
    }

    const openCommitmentKeys = state.commitments
      .filter((commitment) => commitment.status === "open")
      .map((commitment) => `${commitment.title.toLowerCase()}|${commitment.dueHint.toLowerCase()}`);
    const confirmedMemories = state.memories.filter((memory) => memory.status === "confirmed");

    expect(state.entries).toHaveLength(30);
    expect(confirmedMemories.length).toBeGreaterThan(0);
    expect(new Set(openCommitmentKeys).size).toBe(openCommitmentKeys.length);
    expect(state.actions.some((action) => action.kind === "day_plan" && action.payload.contextReview?.length)).toBe(true);
    expect(state.actions.some((action) => action.kind === "web_research")).toBe(true);
    expect(state.actions.some((action) => action.kind === "file_bundle")).toBe(true);
    expect(state.actions.some((action) => action.status === "executed")).toBe(true);
  });
});

describe("selectRelevantMemories", () => {
  const mockDateRecent = new Date().toISOString();
  const mockDateOld = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

  const memories: MemoryFact[] = [
    { id: "1", text: "Trabajo con clientes por la manana", kind: "routine", confidence: 0.9, status: "confirmed", createdAt: mockDateRecent, sourceEntryId: "e1", sensitivity: "normal", useForSuggestions: true },
    { id: "2", text: "Mi mama vive lejos y la extrano", kind: "relationship", confidence: 0.8, status: "confirmed", createdAt: mockDateOld, sourceEntryId: "e2", sensitivity: "normal", useForSuggestions: true },
    { id: "3", text: "Prefiero cafe fuerte", kind: "preference", confidence: 0.7, status: "candidate", createdAt: mockDateRecent, sourceEntryId: "e3", sensitivity: "normal", useForSuggestions: true },
    { id: "4", text: "El cielo esta nublado hoy", kind: "routine", confidence: 0.6, status: "confirmed", createdAt: mockDateRecent, sourceEntryId: "e4", sensitivity: "normal", useForSuggestions: true },
  ];

  it("returns memories matching keywords from input", () => {
    const result = selectRelevantMemories(memories, "como le va a mi mama", 2);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].text.toLowerCase()).toContain("mama");
  });

  it("returns up to maxResults", () => {
    const result = selectRelevantMemories(memories, "cafe clientes trabajo", 2);
    expect(result.length).toBeLessThanOrEqual(2);
    // Verify only memories with keyword overlap are returned (cafe, clientes, trabajo)
    const texts = result.map(r => r.text.toLowerCase());
    expect(texts.some(t => t.includes("trabajo") || t.includes("clientes") || t.includes("cafe"))).toBe(true);
  });

  it("returns empty array when input has no meaningful keywords", () => {
    const result = selectRelevantMemories(memories, "a b c", 5);
    expect(result).toEqual([]);
  });

  it("excludes memories with no keyword overlap", () => {
    // Query: "trabajo" matches memory 1 only (and "nublado" has no overlap)
    // With maxResults=2, memory 4 (zero overlap) should be excluded
    const result = selectRelevantMemories(memories, "trabajo", 2);
    const texts = result.map(r => r.text);
    expect(texts).not.toContain("El cielo esta nublado hoy");
    expect(texts).toContain("Trabajo con clientes por la manana");
  });

  it("returns objects with correct RelevantMemory shape", () => {
    const result = selectRelevantMemories(memories, "trabajo", 5);
    expect(result[0]).toHaveProperty("kind");
    expect(result[0]).toHaveProperty("confidence");
  });
});
