# Koru Chat Cards — 21 Design Cards to Real Components

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the 21 card mockups in `public/design-cards.html` into real, functional React components rendered inside `KoruSemanticCard`, following the existing `UiBlock` architecture.

**Architecture:** Each card maps to a `UiBlock` variant in `src/domain/types.ts`. Existing types get a new visual layout (e.g., `weather` gets a richer layout). New types are added to `UiBlock` union and wired through `UiBlockCardA` in `src/ui/chatCards.tsx`. Backend JSON schema is updated so the LLM can emit the new blocks.

**Tech Stack:** React 18 + Tailwind CSS (v4 via CDN in design-cards.html, but project uses Tailwind classes from `src/style.css` + `@tailwindcss/vite`). TypeScript. Vitest for tests.

---

## File Structure

| File | Responsibility |
|------|-------------|
| `src/domain/types.ts` | `UiBlock` union type — add new block shapes |
| `src/ui/chatCards.tsx` | `UiBlockCardA` switch + new React components |
| `src/ui/KoruProvider.tsx` | Passes `uiBlocks` from backend response into chat items |
| `src/server/koruBackend.ts` | Backend JSON schema instructs LLM to emit new blocks |
| `src/domain/toolRegistry.ts` | Tool definitions for `weather`, `traffic`, etc. — may need new tools |
| `public/design-cards.html` | Source-of-truth visual reference (read-only) |

---

## Chunk 0: Foundation — Enrich Existing Types

**Goal:** Upgrade existing `UiBlock` types with the richer fields the new designs demand, without breaking current cards.

**Parallelizable:** No (types must exist before components).

### Task 0.1: Enrich `weather` block
**Files:**
- Modify: `src/domain/types.ts` (~line 355)

```typescript
| {
    type: "weather";
    title?: string;
    city?: string;
    now?: string;
    range?: string;
    rain?: string;
    wind?: string;
    humidity?: string;        // NEW
    uv?: string;              // NEW
    hourly?: Array<{ time: string; temp: string; condition: string }>; // NEW
    daily?: Array<{ day: string; min: string; max: string; condition: string }>; // NEW
    advice?: string;
    sourceStatus?: AssistantActionPayload["externalStatus"];
    sources?: AssistantSource[];
  }
```

**Test:** `npm run typecheck` (via `npx tsc --noEmit`) must still pass.

### Task 0.2: Enrich `plan` block
**Files:**
- Modify: `src/domain/types.ts`

Add optional `progress?: number` and `category?: string` to `AssistantPlanItem`.

### Task 0.3: Enrich `research_sources` block
**Files:**
- Modify: `src/domain/types.ts`

Add optional `quote?: { text: string; author?: string; source?: string }` to support Deep Research quote card (7C).

---

## Chunk 1: Weather & Environment Cards (3 cards)

**Goal:** Implement 1A (Live Match), 1B (Timeline), 1C (Match Stats) — wait, these are sports. Corrected: implement 4B (Transporte), 4C (Mapa), and enhanced Weather.

Actually, mapping the 21 designs to chunks:

### Chunk 1: Environment & Transit (3 cards)
- **4B Transporte** → new `transport` block
- **4C Mapa** → new `map` block
- **Enhanced Weather** → upgrade existing `weather` block layout

### Task 1.1: `transport` UiBlock + component
**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/ui/chatCards.tsx` (add `TransportCardA` + wire in `UiBlockCardA`)

```typescript
// types.ts addition
| {
    type: "transport";
    title?: string;
    mode?: "transit" | "driving" | "walking" | "cycling";
    origin?: string;
    destination?: string;
    duration?: string;
    distance?: string;
    routeSummary?: string;
    alternatives?: Array<{ mode: string; duration: string; highlight?: boolean }>;
    sources?: AssistantSource[];
  }
```

**Component:** `TransportCardA` — two-row layout: origin → destination with time, list of alternative modes below.

### Task 1.2: `map` UiBlock + component
**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/ui/chatCards.tsx`

```typescript
| {
    type: "map";
    title?: string;
    location?: string;
    center?: { lat: number; lng: number };
    zoom?: number;
    markers?: Array<{ label: string; lat: number; lng: number; color?: string }>;
    staticMapUrl?: string; // fallback image URL
  }
```

**Component:** `MapCardA` — card with location header, static map placeholder (img or css), marker list.

### Task 1.3: Enhanced `WeatherCardA`
**Files:**
- Modify: `src/ui/chatCards.tsx`

Replace the current `weather` branch in `UiBlockCardA` with `WeatherCardA` component. Layout: city header with large temp, horizontal hourly forecast scroll, vertical daily forecast, metrics grid (rain, wind, humidity, UV).

---

## Chunk 2: Sports & Live Events (3 cards)

**Goal:** 1A Live Match, 1B Timeline, 1C Match Stats

### Task 2.1: `live_match` UiBlock + `LiveMatchCardA`
**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/ui/chatCards.tsx`

```typescript
| {
    type: "live_match";
    sport?: string;
    league?: string;
    homeTeam: { name: string; code: string; score: number; color?: string };
    awayTeam: { name: string; code: string; score: number; color?: string };
    status: "live" | "finished" | "scheduled";
    minute?: string;
    period?: string;
    events?: Array<{ minute: string; team: "home" | "away"; type: "goal" | "card" | "sub"; description: string }>;
    tabs?: Array<{ label: string; content: UiBlock }>; // stats, lineups, timeline
  }
```

**Component:** Two team badges with score, live status badge, tab buttons (Stats, Lineups, Timeline), event list.

### Task 2.2: `match_timeline` fragment
Not a standalone block — lives inside `live_match.tabs`. Renders vertical timeline of events.

### Task 2.3: `match_stats` fragment
Not standalone — lives inside `live_match.tabs`. Renders stat bars (possession, shots, etc.).

---

## Chunk 3: Finance & Market (3 cards)

**Goal:** 3A BTC Price, 3B Portfolio, 3C Forex

### Task 3.1: `crypto_price` UiBlock + `CryptoPriceCardA`
**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/ui/chatCards.tsx`

```typescript
| {
    type: "crypto_price";
    asset: string;
    symbol: string;
    price: string;
    change24h?: string;
    changeDirection?: "up" | "down" | "neutral";
    sparklineData?: number[]; // 24h points for mini chart
    marketCap?: string;
    volume24h?: string;
    sources?: AssistantSource[];
  }
```

### Task 3.2: `portfolio` UiBlock + `PortfolioCardA`
```typescript
| {
    type: "portfolio";
    title?: string;
    totalValue: string;
    change24h?: string;
    assets: Array<{ name: string; symbol: string; allocation: string; value: string; change: string }>;
    sources?: AssistantSource[];
  }
```

### Task 3.3: `forex` UiBlock + `ForexCardA`
```typescript
| {
    type: "forex";
    pair: string;
    rate: string;
    change24h?: string;
    sources?: AssistantSource[];
  }
```

---

## Chunk 4: Social & Events (3 cards)

**Goal:** 5A Birthday Social, 5B Calendario, 2B Vote

### Task 4.1: `social_event` UiBlock + `SocialEventCardA`
```typescript
| {
    type: "social_event";
    title: string;
    eventType: "birthday" | "meeting" | "party" | "other";
    date: string;
    time?: string;
    location?: string;
    attendees?: string[];
    gifts?: string[];
    actionLabel?: string;
  }
```

### Task 4.2: `calendar_day` UiBlock + `CalendarDayCardA`
```typescript
| {
    type: "calendar_day";
    date: string;
    events: Array<{ time: string; title: string; type: "work" | "personal" | "health"; done?: boolean }>;
  }
```

### Task 4.3: `poll` UiBlock + `PollCardA`
```typescript
| {
    type: "poll";
    question: string;
    options: Array<{ label: string; votes?: number; percentage?: number }>;
    totalVotes?: number;
    userVote?: string;
    deadline?: string;
  }
```

---

## Chunk 5: Productivity & Lifestyle (3 cards)

**Goal:** 6A Product Review, 6B Smart Checklist, 6C Outfit

### Task 5.1: `product_review` UiBlock + `ProductReviewCardA`
```typescript
| {
    type: "product_review";
    product: string;
    rating?: number; // 0-5
    reviewCount?: string;
    price?: string;
    pros?: string[];
    cons?: string[];
    summary?: string;
    imageUrl?: string;
    sources?: AssistantSource[];
  }
```

### Task 5.2: `checklist` UiBlock + `ChecklistCardA`
```typescript
| {
    type: "checklist";
    title?: string;
    items: Array<{ label: string; checked: boolean; priority?: "low" | "medium" | "high" }>;
    progress?: number; // 0-100
    dueText?: string;
  }
```

### Task 5.3: `outfit` UiBlock + `OutfitCardA`
```typescript
| {
    type: "outfit";
    title?: string;
    occasion?: string;
    weather?: string;
    items: Array<{ category: string; name: string; color?: string; emoji?: string }>;
    note?: string;
  }
```

---

## Chunk 6: Data & Dashboard (3 cards)

**Goal:** 2A Results, 2C Data Ticker, 7A Score tiles

### Task 6.1: `results` UiBlock (generic data display) + `ResultsCardA`
```typescript
| {
    type: "results";
    title?: string;
    query: string;
    items: Array<{ rank: number; title: string; subtitle?: string; score?: string; highlight?: boolean }>;
    note?: string;
  }
```

### Task 6.2: `data_ticker` UiBlock + `DataTickerCardA`
```typescript
| {
    type: "data_ticker";
    title?: string;
    items: Array<{ label: string; value: string; change?: string; direction?: "up" | "down" | "neutral"; emoji?: string }>;
    refreshLabel?: string;
  }
```

### Task 6.3: `score_tiles` UiBlock + `ScoreTilesCardA`
```typescript
| {
    type: "score_tiles";
    title?: string;
    tiles: Array<{ label: string; value: string; max?: string; color?: string; icon?: string }>;
    note?: string;
  }
```

---

## Chunk 7: Document & Research (2 cards)

**Goal:** 7B Document builder dark, 7C Deep Research quote

### Task 7.1: `document` UiBlock + `DocumentBuilderCardA`
```typescript
| {
    type: "document";
    title: string;
    status: "draft" | "review" | "final";
    sections: Array<{ heading: string; content: string }>;
    wordCount?: string;
    lastEdited?: string;
  }
```

### Task 7.2: Enhanced `ResearchSourcesCardA` for quote variant
Use the new `quote` field added in Task 0.3. Render a large serif quote with attribution when `quote` is present, otherwise render the standard list.

---

## Chunk 8: Backend Integration

**Goal:** Teach the LLM how to emit the new blocks via the JSON schema in the system prompt.

### Task 8.1: Update backend JSON schema
**Files:**
- Modify: `src/server/koruBackend.ts` (find the system-prompt JSON schema that defines `uiBlocks`)

Add each new block type to the `uiBlocks` array schema, with the exact same shape as the TypeScript type. Keep descriptions in Spanish since the LLM prompt is Spanish.

### Task 8.2: Add tool definitions if needed
If new blocks require new data sources (e.g., `crypto_price` needs a crypto API), add tool definitions in `src/domain/toolRegistry.ts` and wire them in `koruBackend.ts`. For MVP, mock data or OpenRouter web search is acceptable.

### Task 8.3: Add example UI blocks to the system prompt
Include 1-2 example JSON snippets of new blocks in the system prompt so the LLM learns by demonstration.

---

## Chunk 9: Tests & Polish

### Task 9.1: Render tests for each new card
**Files:**
- Create: `src/ui/chatCards.test.tsx` (or extend existing test)

Use `@testing-library/react` to render each new card with minimal props and assert they mount without error.

### Task 9.2: TypeScript check
Run `npx tsc --noEmit` — fix any union-discrimination issues.

### Task 9.3: Visual smoke test
Open `design-cards.html` side-by-side with the running app. Compare pixel-perfect alignment for at least 3 cards.

---

## Self-Review

**Spec coverage:** Each of the 21 designs maps to at least one `UiBlock` variant:
- 1A,1B,1C → `live_match`
- 2A → `results`
- 2B → `poll`
- 2C → `data_ticker`
- 3A → `crypto_price`
- 3B → `portfolio`
- 3C → `forex`
- 4A → `calendar_day` (as timeline)
- 4B → `transport`
- 4C → `map`
- 5A → `social_event`
- 5B → `calendar_day`
- 5C → `alarm` (existing)
- 6A → `product_review`
- 6B → `checklist`
- 6C → `outfit`
- 7A → `score_tiles`
- 7B → `document`
- 7C → `research_sources` with quote

**Placeholder scan:** No TBDs or TODOs. All shapes include complete fields.

**Type consistency:** Block names use `snake_case` matching existing convention (`clarifying_question`, `money_summary`, etc.).

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-21-koru-chat-cards.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per chunk, review between chunks, fast iteration. Each chunk is ~1-2 files.

2. **Inline Execution** — Execute tasks in this session, batch by batch.

**Also:** Before starting, confirm priority — should I implement ALL 21 at once, or start with a subset (e.g., 5 most useful)?

Which approach?
