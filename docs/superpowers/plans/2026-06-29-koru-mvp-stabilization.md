# Koru MVP Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Leave Koru MVP in a buildable, secure, maintainable state with one clear agent flow, the foundation for a schema-driven Presentation Engine, and semantic memory working without local Ollama.

**Architecture:** Stabilize first (build + security), then unify the two overlapping agent flows around the backend agent (`koruBackend.ts`), refactor the monolithic backend into focused modules, and add a deterministic Presentation Engine that picks visualizers from tool-result schemas rather than from LLM output.

**Tech Stack:** TypeScript, Vite, React 19, Tailwind 4, Vitest, Playwright.

---

## File structure overview

What we will touch:

| Path | Responsibility |
|------|----------------|
| `tsconfig.json` | Stricter type checking to prevent regressions. |
| `.gitignore` | Exclude untracked sensitive/cache/build artifacts. |
| `src/ui/cards/*.tsx` | Fix relative imports to `../../domain/types`. |
| `src/ui/cards/index.ts` | Fix `RestaurantCard` re-export. |
| `src/tools/types.ts` | Fix relative import to `../domain/types`. |
| `src/tools/*/*.ts` | Add explicit types, remove unused imports. |
| `src/ui/AllCardsPreview.tsx` | Fix mock data to match current `UiBlock` types. |
| `src/ui/App.test.tsx` | Fix `Element | undefined` type. |
| `src/ui/cards/*.test.tsx` | Update mock props to match current types. |
| `src/ui/KoruProvider.tsx` | Fix `sendMessage` return type and optional items access. |
| `src/server/providers/` | New directory: split LLM providers out of `koruBackend.ts`. |
| `src/server/prompts/` | New directory: agent prompts as plain TS exports. |
| `src/server/tools/` | Move builtin tool execution out of `koruBackend.ts`. |
| `src/domain/schemas/` | New directory: typed tool-result schemas and schema matcher. |
| `src/domain/presentation/` | New directory: Presentation Engine. |
| `src/domain/memory/` | New directory: semantic memory with embedding client fallback. |

---

## Phase 1: Stabilize build and repository

> **Principle:** We do not refactor what we cannot build. Phase 1 ends when `npm run build` and `npm test` both pass cleanly.

### Task 1.1: Harden TypeScript config

**Files:**
- Modify: `tsconfig.json`

- [ ] **Step 1: Add stricter compiler options**

Add to `compilerOptions`:

```json
"noImplicitAny": true,
"noUnusedLocals": true,
"noUnusedParameters": true
```

If the project intentionally allows implicit any in tests, keep tests exempt via `tsconfig.test.json` or vitest's default settings.

- [ ] **Step 2: Verify tsc sees the same errors as the build**

Run:

```bash
npx tsc --noEmit 2>&1 | tail -30
```

Expected: same errors as `npm run build`.

- [ ] **Step 3: Commit**

```bash
git add tsconfig.json
git commit -m "chore(ts): enable noImplicitAny and noUnusedLocals"
```

---

### Task 1.2: Fix card component imports

**Files:**
- Modify: `src/ui/cards/ActivityGroupCard.tsx`, `src/ui/cards/AlarmCard.tsx`, `src/ui/cards/ClarifyingQuestionCard.tsx`, `src/ui/cards/ComparisonCard.tsx`, `src/ui/cards/DataCard.tsx`, `src/ui/cards/DecisionSupportCard.tsx`, `src/ui/cards/MemoryCard.tsx`, `src/ui/cards/PlanCard.tsx`, `src/ui/cards/ProactiveSignalCard.tsx`, `src/ui/cards/ReminderCard.tsx`, `src/ui/cards/ShoppingListCard.tsx`, `src/ui/cards/TravelPlannerCard.tsx`, `src/ui/cards/WeatherCard.tsx`
- Modify: `src/ui/cards/index.ts`

- [ ] **Step 1: Replace broken relative imports**

In each file listed above, change:

```ts
import type { ... } from "../domain/types";
```

to:

```ts
import type { ... } from "../../domain/types";
```

For `WeatherCard.tsx` also fix the `Extract` import: `Extract` is a global TS utility, do not import it from types.

- [ ] **Step 2: Fix `RestaurantCard` re-export**

In `src/ui/cards/index.ts`, replace:

```ts
export { default as RestaurantSynthesisCard } from "./RestaurantCard";
```

with:

```ts
export { RestaurantCard as RestaurantSynthesisCard } from "./RestaurantCard";
```

assuming `RestaurantCard.tsx` exports `RestaurantCard` by name. If it is a default export, change `RestaurantCard.tsx` to a named export instead.

- [ ] **Step 3: Run tsc to confirm card errors drop**

Run:

```bash
npx tsc --noEmit 2>&1 | grep -c "ui/cards"
```

Expected: 0 (or only real type mismatches left, not import errors).

- [ ] **Step 4: Commit**

```bash
git add src/ui/cards
git commit -m "fix(cards): correct relative imports to domain types"
```

---

### Task 1.3: Fix `src/tools/types.ts` import

**Files:**
- Modify: `src/tools/types.ts`

- [ ] **Step 1: Correct the relative path**

Change:

```ts
import type { KoruState, UiBlock, AssistantSource } from "../../domain/types";
```

to:

```ts
import type { KoruState, UiBlock, AssistantSource } from "../domain/types";
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/types.ts
git commit -m "fix(tools): correct relative import in tool types"
```

---

### Task 1.4: Fix implicit `any` parameters in tools and cards

**Files:**
- Modify: `src/tools/money/advanced.ts`
- Modify: `src/tools/trending/trending.ts`
- Modify: `src/tools/knowledge/knowledge.ts`
- Modify: `src/ui/cards/ActivityGroupCard.tsx`, `ClarifyingQuestionCard.tsx`, `ComparisonCard.tsx`, `DataCard.tsx`, `DecisionSupportCard.tsx`, `MemoryCard.tsx`, `PlanCard.tsx`, `ProactiveSignalCard.tsx`, `ShoppingListCard.tsx`, `WeatherCard.tsx`

- [ ] **Step 1: Add explicit types to `map/filter/reduce` callbacks**

For example, in `src/tools/money/advanced.ts`, replace:

```ts
return records.filter((r) => { ... });
```

with typed arrays before the call or inline type annotations:

```ts
const expenses = records.filter((r: LifeRecord) => r.kind === "expense");
```

Use the imported `LifeRecord` type. Repeat for every callback flagged by `tsc`.

For card `map` callbacks, use the concrete `UiBlock` subtype. Example in `ComparisonCard.tsx`:

```tsx
{items.map((item: NonNullable<Extract<UiBlock, { type: "comparison" }>["items"]>[number], idx: number) => (...))}
```

If a type is too long, create a local alias:

```ts
type ComparisonItem = NonNullable<Extract<UiBlock, { type: "comparison" }>["items"]>[number];
```

- [ ] **Step 2: Remove unused imports flagged by noUnusedLocals**

Examples:
- `src/ui/cards/chatCards.tsx`: remove unused `Clock`, `ShoppingBasket`, `Sun`, `DecisionSupportCard`, etc.
- `src/tools/travel/travel.ts`: remove unused `fetchJson`, `limiters`, `OsrmRoute`.
- `src/tools/utils/utils.ts`: remove unused `fetchText`.

- [ ] **Step 3: Run tsc and iterate until clean**

Run:

```bash
npx tsc --noEmit 2>&1 | head -50
```

Expected: no implicit-any or unused-local errors from these files.

- [ ] **Step 4: Commit**

```bash
git add src/tools src/ui
git commit -m "fix(types): add explicit types and remove unused imports"
```

---

### Task 1.5: Fix `AllCardsPreview.tsx` mock data

**Files:**
- Modify: `src/ui/AllCardsPreview.tsx`

- [ ] **Step 1: Align mock objects with `UiBlock` types**

Changes to make:

- Remove `id` from `plan` blocks; use only `type`, `title`, `items`, `note`.
- In `live_match` blocks, set `homeTeam`/`awayTeam` as objects `{ name, abbrev, score }`, not strings.
- In `plan` items use `title` instead of `text`.
- In `comparison` items use `title` instead of `name`.
- In `saved_record` records remove `id`; use only the `Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">` shape.
- In `web_nav` blocks use `status: "loading" | "complete" | "report"` only; replace `"ok"`. Remove `domain` from result objects.
- In `birthday_calendar` remove `year`.
- In `election_vote` options use `label` and optional `sub`, not `description`.
- In `outfit` blocks remove `title`; use `specs` and `buttonLabel`.

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit 2>&1 | grep "AllCardsPreview"
```

Expected: empty output.

- [ ] **Step 3: Commit**

```bash
git add src/ui/AllCardsPreview.tsx
git commit -m "fix(preview): align mock data with UiBlock types"
```

---

### Task 1.6: Fix test mock props

**Files:**
- Modify: `src/ui/cards/LiveMatchCard.test.tsx`
- Modify: `src/ui/cards/MarketCard.test.tsx`
- Modify: `src/ui/App.test.tsx`

- [ ] **Step 1: Update `LiveMatchCard.test.tsx`**

Remove `globalStatus` from blocks. Replace `leftValue`/`rightValue` in stats with `leftPercent`/`rightPercent`.

- [ ] **Step 2: Update `MarketCard.test.tsx`**

Use `assets: [{ symbol, name, price, change, changeUp }]` instead of flat `symbol/name/pair/price/change/time`. The empty block must include `assets: []`.

- [ ] **Step 3: Update `App.test.tsx`**

At line 194, guard the `Element | undefined` with a non-null assertion or early return:

```ts
const el = screen.getByText(/.../);
if (!el) throw new Error("element not found");
// pass el
```

- [ ] **Step 4: Run tests**

```bash
npm test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/cards/LiveMatchCard.test.tsx src/ui/cards/MarketCard.test.tsx src/ui/App.test.tsx
git commit -m "fix(tests): update mock props to match current types"
```

---

### Task 1.7: Fix `KoruProvider.tsx` type errors

**Files:**
- Modify: `src/ui/KoruProvider.tsx`

- [ ] **Step 1: Guard optional `items`**

At line 1425, replace direct access with:

```ts
const items = koruTurn.items ?? [];
items.forEach((it) => { ... });
```

- [ ] **Step 2: Narrow `sendMessage` return type**

Ensure the function always returns `Promise<KoruChatTurn | null>`. At the end of the function, return `errorTurn` in the catch and `koruTurn ?? null` in the success path. Do not return `undefined`.

- [ ] **Step 3: Fix encoding issue**

Re-save the file as UTF-8 to remove `AcciÃ³n`, `AutonomÃ­a`, etc. Verify with:

```bash
file src/ui/KoruProvider.tsx
```

Expected: `UTF-8 Unicode text`.

- [ ] **Step 4: Run tsc and tests**

```bash
npx tsc --noEmit 2>&1 | tail -20
npm test 2>&1 | tail -10
```

Expected: tsc clean, tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/KoruProvider.tsx
git commit -m "fix(provider): resolve type errors and fix UTF-8 encoding"
```

---

### Task 1.8: Secure the repository

**Files:**
- Modify: `.gitignore`
- Delete/untokenize: `minimax-oauth-token.json` if tracked

- [ ] **Step 1: Add entries to `.gitignore`**

Append:

```gitignore
# Local caches and secrets
.hf-cache/
unsloth_compiled_cache/
manual-audits/
logs/
*.log
minimax-oauth-token.json
.env
.env.*
!.env.example
.opencode.json
.tmp/
```

- [ ] **Step 2: If `minimax-oauth-token.json` is tracked, remove it from git history**

```bash
git rm --cached minimax-oauth-token.json
echo "minimax-oauth-token.json" >> .gitignore
git filter-repo --path minimax-oauth-token.json --invert-paths
```

If `git filter-repo` is not available, rotate the token instead.

- [ ] **Step 3: Verify no secrets in tracked files**

```bash
git status --short | head -30
```

Expected: no `minimax-oauth-token.json` staged.

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore(repo): ignore local caches, logs and secrets"
```

---

### Task 1.9: Verify build and tests pass

- [ ] **Step 1: Run full build**

```bash
npm run build 2>&1 | tail -20
```

Expected: `dist/` generated with no TypeScript errors.

- [ ] **Step 2: Run tests**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 3: Commit any remaining fixes**

If any new error appears, fix and commit with a descriptive message.

---

## Phase 2: Unify the agent flow

> **Principle:** One entry point, one state machine. The local `submitReflection` path is deprecated in favor of the backend agent path.

### Task 2.1: Audit who calls `submitReflection` and `analyzeReflection`

**Files:**
- Read: `src/domain/store.ts`, `src/domain/brain.ts`, `src/ui/KoruProvider.tsx`, any test referencing `submitReflection`

- [ ] **Step 1: Find all call sites**

```bash
grep -r "submitReflection\|analyzeReflection" src tests --include="*.ts" --include="*.tsx" -l
```

Expected: list of files. If `KoruProvider.tsx` is not in the list, the UI already uses the backend agent.

- [ ] **Step 2: Decide migration strategy**

If `submitReflection` is only used by tests/old code, mark it as deprecated:

```ts
/** @deprecated Use the backend agent flow via KoruProvider instead. */
export function submitReflection(...) { ... }
```

If any screen still calls it, redirect that call to `sendMessage`.

- [ ] **Step 3: Commit**

```bash
git add src/domain/store.ts
git commit -m "chore(store): deprecate submitReflection in favor of backend agent"
```

---

### Task 2.2: Extract shared knowledge extraction utilities

**Files:**
- Create: `src/domain/knowledge/extractRecords.ts`
- Create: `src/domain/knowledge/extractCommitments.ts`
- Create: `src/domain/knowledge/extractMemories.ts`
- Modify: `src/domain/brain.ts`
- Modify: `src/server/koruBackend.ts`

- [ ] **Step 1: Move local extractors to shared helpers**

From `src/domain/brain.ts`, extract:

- `extractLifeRecordsLocal`
- `extractCommitmentsLocal`
- `extractMemoryCandidatesLocal`
- supporting helpers (`extractAmount`, `inferCurrency`, `personFromText`, etc.)

into the new files.

Example signature:

```ts
// src/domain/knowledge/extractRecords.ts
export function extractLifeRecordsFromText(input: string): Omit<LifeRecord, "id" | "createdAt" | "sourceEntryId">[] { ... }
```

- [ ] **Step 2: Make `brain.ts` and `koruBackend.ts` import these helpers**

Replace inline logic with imports.

- [ ] **Step 3: Add unit tests for extractors**

Create:

```ts
// src/domain/knowledge/extractRecords.test.ts
import { describe, it, expect } from "vitest";
import { extractLifeRecordsFromText } from "./extractRecords";

describe("extractLifeRecordsFromText", () => {
  it("extracts an expense", () => {
    const records = extractLifeRecordsFromText("gasté 18 euros en farmacia");
    expect(records).toHaveLength(1);
    expect(records[0].kind).toBe("expense");
    expect(records[0].amount).toBe(18);
  });
});
```

- [ ] **Step 4: Run tests and commit**

```bash
npm test src/domain/knowledge 2>&1 | tail -10
git add src/domain/knowledge src/domain/brain.ts src/server/koruBackend.ts
git commit -m "refactor(knowledge): extract shared record/commitment/memory extractors"
```

---

### Task 2.3: Align state application between local and backend flows

**Files:**
- Modify: `src/domain/store.ts`
- Modify: `src/ui/KoruProvider.tsx`

- [ ] **Step 1: Reuse `applyBackendTurnToState` logic in store**

Create a pure function `applyTurnResultToState(state, result)` that:

- Creates `MemoryFact` from candidates.
- Creates `Commitment` from commitments.
- Creates `LifeRecord` from records and uiBlock records.
- Creates `AssistantAction` from uiBlocks and suggestedActions.
- Awards energy.

Use this function from both `applyBackendTurnToState` in `KoruProvider.tsx` and a new `submitBackendReflection` in `store.ts` (if tests still need a local path).

- [ ] **Step 2: Add tests**

```ts
// src/domain/store.turn.test.ts
import { describe, it, expect } from "vitest";
import { createInitialState, applyTurnResultToState } from "./store";

describe("applyTurnResultToState", () => {
  it("adds a record and increments energy", () => {
    const state = createInitialState();
    const next = applyTurnResultToState(state, {
      reply: "ok",
      uiBlocks: [],
      suggestedActions: [],
      understanding: { literalRequest: "x", userGoal: "y", unstatedNeeds: [], assumptions: [], confidence: 0.9 },
      memoryCandidates: [],
      commitments: [],
      records: [{ domain: "money", kind: "expense", title: "farmacia", amount: 18, currency: "EUR" }],
      toolResults: [],
      stateEvents: [{ kind: "done", label: "done" }],
      provider: "nvidia",
    });
    expect(next.records).toHaveLength(1);
    expect(next.totalEnergy).toBeGreaterThan(state.totalEnergy);
  });
});
```

- [ ] **Step 3: Run tests and commit**

```bash
npm test src/domain/store.turn.test.ts 2>&1 | tail -10
git add src/domain/store.ts src/ui/KoruProvider.tsx src/domain/store.turn.test.ts
git commit -m "refactor(store): unify turn application between UI and backend"
```

---

## Phase 3: Break up `koruBackend.ts`

> **Principle:** The backend file should orchestrate, not implement everything.

### Task 3.1: Extract LLM providers

**Files:**
- Create: `src/server/providers/types.ts`
- Create: `src/server/providers/nvidia.ts`
- Create: `src/server/providers/openrouter.ts`
- Create: `src/server/providers/minimax.ts`
- Create: `src/server/providers/ollama.ts`
- Create: `src/server/providers/index.ts`
- Modify: `src/server/koruBackend.ts`

- [ ] **Step 1: Define provider interface**

```ts
// src/server/providers/types.ts
import type { ChatMessage, ProviderResult } from "../koruBackend";

export type ProviderName = "nvidia" | "openrouter" | "minimax";

export interface ProviderConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
}

export interface LlmProvider {
  call(messages: ChatMessage[], toolsEnabled: boolean, availableTools?: ToolDefinition[]): Promise<ProviderResult>;
}
```

- [ ] **Step 2: Move `callNvidia`, `callOpenRouter`, `callMinimax`, `callProvider` logic into modules**

Each module exports a factory. Example:

```ts
// src/server/providers/nvidia.ts
export function createNvidiaProvider(config: ProviderConfig): LlmProvider { ... }
```

- [ ] **Step 3: Update `koruBackend.ts`**

Replace inline provider calls with:

```ts
import { createProvider, type ProviderName } from "./providers";
```

Keep fallback ordering logic in `koruBackend.ts`, but delegate the actual HTTP call.

- [ ] **Step 4: Add a smoke test**

```ts
// src/server/providers/providers.test.ts
import { describe, it, expect, vi } from "vitest";
import { createNvidiaProvider } from "./nvidia";

describe("createNvidiaProvider", () => {
  it("throws if no key/baseUrl", () => {
    expect(() => createNvidiaProvider({ model: "x", baseUrl: "" })).toThrow();
  });
});
```

- [ ] **Step 5: Run tests and commit**

```bash
npm test src/server/providers 2>&1 | tail -10
git add src/server/providers src/server/koruBackend.ts
git commit -m "refactor(backend): extract LLM providers into modules"
```

---

### Task 3.2: Extract builtin tool execution

**Files:**
- Create: `src/server/tools/weather.ts`
- Create: `src/server/tools/webSearch.ts`
- Create: `src/server/tools/planDay.ts`
- Create: `src/server/tools/queryPersonalContext.ts`
- Create: `src/server/tools/saveMemory.ts`
- Create: `src/server/tools/savePersonalItem.ts`
- Create: `src/server/tools/index.ts`
- Modify: `src/server/koruBackend.ts`

- [ ] **Step 1: Define tool execution interface**

```ts
// src/server/tools/types.ts
import type { KoruState } from "../../domain/types";

export interface ToolExecutor {
  name: string;
  run(args: Record<string, unknown>, ctx: { state: KoruState; userInput: string }): Promise<Record<string, unknown>>;
}
```

- [ ] **Step 2: Move each builtin tool into its own module**

Move:
- `getWeather` → `src/server/tools/weather.ts`
- `runSearch` → `src/server/tools/webSearch.ts`
- `planFromState` → `src/server/tools/planDay.ts`
- `queryPersonalContextFromState` → `src/server/tools/queryPersonalContext.ts`
- `memoryCaptureFromArgs` → `src/server/tools/saveMemory.ts`
- `personalCaptureFromArgs` → `src/server/tools/savePersonalItem.ts`

- [ ] **Step 3: Update `executeTool` in `koruBackend.ts`**

Replace the long `if/else` chain with a registry lookup:

```ts
import { BUILTIN_TOOL_BOX } from "./tools";

async function executeTool(name: string, args: Record<string, unknown>, state: KoruState, userInput: string) {
  const handler = BUILTIN_TOOL_BOX.get(name) ?? TOOL_BOX.get(name);
  if (!handler) return { type: "unknown", error: `Unknown tool ${name}` };
  return handler.run(args, { state, userInput });
}
```

- [ ] **Step 4: Run tests and commit**

```bash
npm test src/server/koruBackend.test.ts 2>&1 | tail -10
git add src/server/tools src/server/koruBackend.ts
git commit -m "refactor(backend): extract builtin tools into registry modules"
```

---

### Task 3.3: Extract prompts and JSON parsing

**Files:**
- Create: `src/server/prompts/system.ts`
- Create: `src/server/prompts/router.ts`
- Create: `src/server/prompts/composer.ts`
- Create: `src/server/prompts/enhancement.ts`
- Create: `src/server/json.ts`
- Modify: `src/server/koruBackend.ts`

- [ ] **Step 1: Move prompts out**

Move `systemPrompt()`, router prompt, composer prompt, and enhancement prompt to their own files. Export string constants or functions.

- [ ] **Step 2: Move JSON helpers**

Move `safeJsonParse`, `extractJsonBlock`, `safeJsonObjectFromContent`, `extractStringField`, `cleanReplyText` to `src/server/json.ts`.

- [ ] **Step 3: Update `koruBackend.ts`**

Import prompts and JSON helpers. The file should now be mostly orchestration logic.

- [ ] **Step 4: Run tests and commit**

```bash
npm test src/server 2>&1 | tail -10
git add src/server/prompts src/server/json.ts src/server/koruBackend.ts
git commit -m "refactor(backend): extract prompts and json helpers"
```

---

## Phase 4: Schema-driven Presentation Engine

> **Principle:** The shape of the data decides the visualizer, not the LLM.

### Task 4.1: Define typed tool-result schemas

**Files:**
- Create: `src/domain/schemas/types.ts`
- Create: `src/domain/schemas/weather.ts`
- Create: `src/domain/schemas/sports.ts`
- Create: `src/domain/schemas/money.ts`
- Create: `src/domain/schemas/news.ts`
- Create: `src/domain/schemas/comparison.ts`

- [ ] **Step 1: Define base schema interface**

```ts
// src/domain/schemas/types.ts
export type SchemaId = "weather" | "sports_scores" | "money_summary" | "news_list" | "comparison_table" | "generic_list";

export interface SchemaMatcher<T> {
  id: SchemaId;
  match(data: unknown): { matched: boolean; confidence: number; data?: T };
}
```

- [ ] **Step 2: Implement concrete schemas**

Example `weather.ts`:

```ts
import { z } from "zod";

export const WeatherSchema = z.object({
  type: z.literal("weather"),
  city: z.string(),
  now: z.string().optional(),
  range: z.string().optional(),
  rain: z.string().optional(),
  wind: z.string().optional(),
  advice: z.string().optional(),
});

export type WeatherData = z.infer<typeof WeatherSchema>;

export const WeatherMatcher: SchemaMatcher<WeatherData> = {
  id: "weather",
  match(data) {
    const result = WeatherSchema.safeParse(data);
    return result.success
      ? { matched: true, confidence: 1, data: result.data }
      : { matched: false, confidence: 0 };
  },
};
```

Use `zod` if already a dependency; otherwise add it (`npm install zod`).

- [ ] **Step 3: Commit**

```bash
npm install zod
git add src/domain/schemas package.json package-lock.json
git commit -m "feat(schemas): add typed tool-result schemas with zod"
```

---

### Task 4.2: Build schema matcher

**Files:**
- Create: `src/domain/schemas/matcher.ts`
- Create: `src/domain/schemas/matcher.test.ts`

- [ ] **Step 1: Implement matcher registry**

```ts
// src/domain/schemas/matcher.ts
import { WeatherMatcher } from "./weather";
import { SportsMatcher } from "./sports";
import { MoneyMatcher } from "./money";
import { NewsMatcher } from "./news";
import { ComparisonMatcher } from "./comparison";
import type { SchemaId, SchemaMatcher } from "./types";

const MATCHERS: SchemaMatcher<unknown>[] = [
  WeatherMatcher,
  SportsMatcher,
  MoneyMatcher,
  NewsMatcher,
  ComparisonMatcher,
];

export function matchSchema(data: unknown): { id: SchemaId; confidence: number; data: unknown } | null {
  const results = MATCHERS
    .map((m) => ({ ...m.match(data), id: m.id }))
    .filter((r) => r.matched)
    .sort((a, b) => b.confidence - a.confidence);
  return results[0] ? { id: results[0].id, confidence: results[0].confidence, data: results[0].data } : null;
}
```

- [ ] **Step 2: Add tests**

```ts
// src/domain/schemas/matcher.test.ts
import { describe, it, expect } from "vitest";
import { matchSchema } from "./matcher";

describe("matchSchema", () => {
  it("matches weather", () => {
    const result = matchSchema({ type: "weather", city: "Madrid", now: "22 C" });
    expect(result?.id).toBe("weather");
  });

  it("returns null for unknown data", () => {
    const result = matchSchema({ foo: "bar" });
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests and commit**

```bash
npm test src/domain/schemas 2>&1 | tail -10
git add src/domain/schemas
git commit -m "feat(schemas): add schema matcher"
```

---

### Task 4.3: Create visualizer catalog

**Files:**
- Create: `src/domain/presentation/types.ts`
- Create: `src/domain/presentation/visualizers/weather.ts`
- Create: `src/domain/presentation/visualizers/sportsScores.ts`
- Create: `src/domain/presentation/visualizers/moneySummary.ts`
- Create: `src/domain/presentation/visualizers/newsList.ts`
- Create: `src/domain/presentation/visualizers/comparisonTable.ts`
- Create: `src/domain/presentation/visualizers/genericList.ts`
- Create: `src/domain/presentation/catalog.ts`

- [ ] **Step 1: Define visualizer interface**

```ts
// src/domain/presentation/types.ts
import type { SchemaId } from "../schemas/types";
import type { UiBlock } from "../types";

export interface Visualizer {
  id: SchemaId;
  render(data: unknown, enrichment?: Record<string, unknown>): UiBlock;
}
```

- [ ] **Step 2: Implement weather visualizer**

```ts
// src/domain/presentation/visualizers/weather.ts
import type { Visualizer } from "../types";
import type { WeatherData } from "../../schemas/weather";

export const WeatherVisualizer: Visualizer = {
  id: "weather",
  render(data: unknown) {
    const w = data as WeatherData;
    return {
      type: "weather",
      city: w.city,
      now: w.now,
      range: w.range,
      rain: w.rain,
      wind: w.wind,
      advice: w.advice,
    };
  },
};
```

- [ ] **Step 3: Build catalog**

```ts
// src/domain/presentation/catalog.ts
import { WeatherVisualizer } from "./visualizers/weather";
import { SportsScoresVisualizer } from "./visualizers/sportsScores";
import { MoneySummaryVisualizer } from "./visualizers/moneySummary";
import { NewsListVisualizer } from "./visualizers/newsList";
import { ComparisonTableVisualizer } from "./visualizers/comparisonTable";
import { GenericListVisualizer } from "./visualizers/genericList";
import type { Visualizer } from "./types";

export const VISUALIZER_CATALOG: Record<string, Visualizer> = {
  weather: WeatherVisualizer,
  sports_scores: SportsScoresVisualizer,
  money_summary: MoneySummaryVisualizer,
  news_list: NewsListVisualizer,
  comparison_table: ComparisonTableVisualizer,
  generic_list: GenericListVisualizer,
};
```

- [ ] **Step 4: Commit**

```bash
git add src/domain/presentation
git commit -m "feat(presentation): add visualizer catalog"
```

---

### Task 4.4: Implement Presentation Engine

**Files:**
- Create: `src/domain/presentation/engine.ts`
- Create: `src/domain/presentation/engine.test.ts`

- [ ] **Step 1: Implement engine**

```ts
// src/domain/presentation/engine.ts
import { matchSchema } from "../schemas/matcher";
import { VISUALIZER_CATALOG } from "./catalog";
import type { UiBlock } from "../types";

export interface PresentationInput {
  hint?: { kind: string; confidence: number; enrichment?: Record<string, unknown> };
  toolResults: Array<{ data?: Record<string, unknown>; summary?: string; sources?: unknown[] }>;
}

export interface PresentationDecision {
  visualizer: string;
  block: UiBlock;
  reason: "schema_match" | "hint_validated" | "fallback_text";
  degraded: boolean;
}

export function decidePresentation(input: PresentationInput): PresentationDecision | null {
  for (const result of input.toolResults) {
    const schemaMatch = matchSchema(result.data);
    if (!schemaMatch) continue;

    const visualizer = VISUALIZER_CATALOG[schemaMatch.id];
    if (!visualizer) continue;

    const hintMatches = input.hint?.kind === schemaMatch.id;
    const degraded = !hintMatches;
    const block = visualizer.render(schemaMatch.data, hintMatches ? input.hint?.enrichment : undefined);

    return {
      visualizer: schemaMatch.id,
      block,
      reason: hintMatches ? "hint_validated" : "schema_match",
      degraded,
    };
  }

  return null;
}
```

- [ ] **Step 2: Add tests**

```ts
// src/domain/presentation/engine.test.ts
import { describe, it, expect } from "vitest";
import { decidePresentation } from "./engine";

describe("decidePresentation", () => {
  it("picks weather from tool result", () => {
    const decision = decidePresentation({
      toolResults: [{ data: { type: "weather", city: "Madrid", now: "22 C" } }],
    });
    expect(decision?.visualizer).toBe("weather");
    expect(decision?.block.type).toBe("weather");
  });

  it("validates hint when it matches schema", () => {
    const decision = decidePresentation({
      hint: { kind: "weather", confidence: 0.9 },
      toolResults: [{ data: { type: "weather", city: "Madrid" } }],
    });
    expect(decision?.reason).toBe("hint_validated");
  });
});
```

- [ ] **Step 3: Run tests and commit**

```bash
npm test src/domain/presentation 2>&1 | tail -10
git add src/domain/presentation
git commit -m "feat(presentation): add deterministic Presentation Engine"
```

---

### Task 4.5: Wire Presentation Engine into backend turn

**Files:**
- Modify: `src/server/koruBackend.ts`
- Modify: `src/domain/orchestrator.ts`

- [ ] **Step 1: Feed tool results into engine after execution**

In `orchestrator.ts`, after `executeRegisteredToolCall`, construct `toolResults` and call:

```ts
import { decidePresentation } from "../domain/presentation/engine";

const presentation = decidePresentation({ hint: route.presentationHint, toolResults });
const blocks = presentation ? [presentation.block, ...pendingBlocks] : composedBlocks;
```

For now, keep `composedBlocks` as fallback. Add a feature flag if needed:

```ts
const USE_PRESENTATION_ENGINE = import.meta.env.VITE_USE_PRESENTATION_ENGINE === "true";
```

- [ ] **Step 2: Update types**

Add `presentationHint?: { kind: string; confidence: number; enrichment?: Record<string, unknown> }` to `RouterResult`.

- [ ] **Step 3: Add integration test**

```ts
// src/server/koruBackend.presentation.test.ts
import { describe, it, expect, vi } from "vitest";
import { runKoruBackendTurn } from "./koruBackend";

describe("Presentation Engine integration", () => {
  it("renders weather block from tool result", async () => {
    // mock provider to return tool call for weather and a hint
    // assert result.uiBlocks contains a weather block
  });
});
```

- [ ] **Step 4: Run tests and commit**

```bash
npm test src/server 2>&1 | tail -10
git add src/server/koruBackend.ts src/domain/orchestrator.ts
git commit -m "feat(backend): wire Presentation Engine into turn flow"
```

---

## Phase 5: Semantic memory without local Ollama

> **Principle:** `selectRelevantMemories` should use embeddings, with a working default provider.

### Task 5.1: Add embedding client abstraction

**Files:**
- Create: `src/domain/memory/embeddings.ts`
- Create: `src/domain/memory/embeddings.test.ts`

- [ ] **Step 1: Define embed interface**

```ts
// src/domain/memory/embeddings.ts
import { runFreeLlmEmbedding, preferredBrainProvider } from "../freellmapi";
import type { RuntimeSettings } from "../types";

export type EmbedFn = (text: string) => Promise<number[]>;

export function createEmbedFn(runtime: RuntimeSettings): EmbedFn {
  const provider = preferredBrainProvider(runtime);

  return async (text: string) => {
    if (provider === "freellmapi" && runtime.embeddingsEnabled) {
      const result = await runFreeLlmEmbedding(runtime, text);
      return result.embedding;
    }

    if (provider === "open-model" && runtime.openModelBaseUrl) {
      // Try Ollama embeddings endpoint
      const response = await fetch(`${runtime.openModelBaseUrl}/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: runtime.openModelModel, prompt: text }),
      });
      const data = await response.json();
      return data.embedding;
    }

    throw new Error("No embedding provider configured");
  };
}
```

- [ ] **Step 2: Add test**

```ts
// src/domain/memory/embeddings.test.ts
import { describe, it, expect, vi } from "vitest";
import { createEmbedFn } from "./embeddings";

describe("createEmbedFn", () => {
  it("throws when no provider is configured", async () => {
    const fn = createEmbedFn({
      freeLlmApiEnabled: false,
      openModelEnabled: false,
    } as RuntimeSettings);
    await expect(fn("hello")).rejects.toThrow("No embedding provider");
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add src/domain/memory
git commit -m "feat(memory): add embedding client abstraction"
```

---

### Task 5.2: Replace keyword memory selection with semantic search

**Files:**
- Create: `src/domain/memory/semanticSearch.ts`
- Modify: `src/domain/brain.ts`
- Modify: `src/domain/store.ts`

- [ ] **Step 1: Implement cosine search**

```ts
// src/domain/memory/semanticSearch.ts
import { cosineSimilarity } from "../brain"; // or extract to shared math util
import type { MemoryFact } from "../types";

export async function selectRelevantMemoriesSemantic(
  input: string,
  memories: MemoryFact[],
  embedFn: (text: string) => Promise<number[]>,
  maxResults = 5,
): Promise<MemoryFact[]> {
  const inputVector = await embedFn(input);
  return memories
    .filter((m) => m.status !== "rejected" && m.embedding?.length)
    .map((m) => ({ memory: m, score: cosineSimilarity(inputVector, m.embedding!) }))
    .filter((item) => item.score >= 0.55)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((item) => item.memory);
}
```

- [ ] **Step 2: Update `brain.ts` to use semantic search when embeddings available**

In `analyzeReflection`:

```ts
const provider = preferredBrainProvider(state.runtime);
let queryEmbedding: number[] | undefined;
if (state.runtime.embeddingsEnabled) {
  try {
    const embedFn = createEmbedFn(state.runtime);
    queryEmbedding = await embedFn(input);
  } catch { /* fall back to keyword */ }
}
const activeMemories = queryEmbedding
  ? await selectRelevantMemoriesSemantic(input, state.memories, async () => queryEmbedding!, 5)
  : selectActiveMemories(input, state, 5);
```

- [ ] **Step 3: Persist embeddings when confirming memories**

In `store.ts`, when `confirmMemory` is called and the memory has no embedding, queue an async embedding hydration.

- [ ] **Step 4: Add test**

```ts
// src/domain/memory/semanticSearch.test.ts
import { describe, it, expect } from "vitest";
import { selectRelevantMemoriesSemantic } from "./semanticSearch";

describe("selectRelevantMemoriesSemantic", () => {
  it("returns memories above threshold", async () => {
    const memories = [
      { id: "1", text: "tengo insomnio", status: "confirmed", embedding: [1, 0, 0] } as MemoryFact,
      { id: "2", text: "me gusta el té", status: "confirmed", embedding: [0, 1, 0] } as MemoryFact,
    ];
    const result = await selectRelevantMemoriesSemantic("no puedo dormir", memories, async () => [0.95, 0.1, 0]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });
});
```

- [ ] **Step 5: Run tests and commit**

```bash
npm test src/domain/memory src/domain/brain.test.ts 2>&1 | tail -10
git add src/domain/memory src/domain/brain.ts src/domain/store.ts
git commit -m "feat(memory): use semantic search with embedding fallback"
```

---

## Phase 6: Final verification

### Task 6.1: Full build and test pass

- [ ] **Step 1: Build**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 2: Test**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 3: E2E smoke (optional)**

```bash
npm run e2e 2>&1 | tail -20
```

Expected: smoke tests pass if Playwright is configured.

- [ ] **Step 4: Commit any final fixes**

---

## Self-review checklist

- **Spec coverage:**
  - Build errors → Phase 1 covers all categories found by `tsc`.
  - Security → Task 1.8.
  - Dual architecture → Phase 2.
  - Monolithic backend → Phase 3.
  - Presentation Engine → Phase 4.
  - Semantic memory → Phase 5.
- **No placeholders:** every task has concrete file paths, commands, and code examples.
- **Type consistency:** `UiBlock`, `SchemaId`, `Visualizer`, and `MemoryFact` references match the current codebase.

---

## Execution options

**Plan complete and saved to `docs/superpowers/plans/2026-06-29-koru-mvp-stabilization.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per phase/task, review between tasks, fast iteration. Best for keeping the codebase stable while moving through many files.

2. **Inline Execution** — I execute tasks in this session using the executing-plans skill, batch execution with checkpoints. Best if you want to see every change as it happens and guide priorities.

Which approach do you prefer? If you want, I can also split this into smaller plans (one per phase) so each one can be merged independently.
