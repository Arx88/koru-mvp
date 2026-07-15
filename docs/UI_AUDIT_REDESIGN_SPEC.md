# Koru Card System — Visual Audit + Redesign Spec

**Author:** UI Lead audit
**Scope:** `presentation.ts`, `KoruUnifiedCard.tsx`, `KoruDetailScreen.tsx`, `style.css` (`.koru-dsec-*`, `.koru-plan-hero`, `.koru-magical-card`, `.koru-comparison-*`, `.koru-roadmap`, `.koru-module-*`)
**Verdict:** Architecture is healthy (single source of truth, typed `DetailSection` union, portal pattern is correct). The visual layer has drifted. Eight categories of drift documented below, with concrete CSS values and a pitch component.

---

## 0. TL;DR — what's broken

| # | Symptom | Root cause |
|---|---|---|
| 1 | Icons show as tofu (□) in **detail screen, sports card** | `icon: "sports"` on `presentation.ts:1423` and `:1433` is **not a Material Symbols name**. Fix to `"sports_soccer"`. Also `index.html:20` ships Material Symbols without `&display=block` so first-paint on slow networks = tofu. |
| 2 | Hero title (`#382b8c`) ≠ detail title (`#8127cf`) ≠ CTA (`#8363f9`) | Three different "Koru purples" across the same flow. |
| 3 | Section subtitles show mixed case ("Lo esencial") **next to** UPPERCASE ("LO ESENCIAL") | 17 sites pass uppercase, 2 pass mixed case; `.koru-module-kicker` has no `text-transform`. |
| 4 | Magical-cards feel "spaced out" | `padding: 24px` on the card **+** `gap: 24px` between cards **+** `padding-bottom: 48px` on modules **+** `padding-top: 16px` on actions = **64 px** of whitespace between last row and the action bar. |
| 5 | Formations look bad | Lineups render as a flat `rows` list. There's no pitch, no formation geometry. |
| 6 | Stats feel repetitive | Every stat = identical row, identical bar. No grouping, no disclosure, no visual hierarchy. |
| 7 | No entrance / fill / pulse animation | The only motion is `.koru-comparison-fill { transition: width .4s ease }` and `koru-fade-in` on collections. Cards just *appear*. |
| 8 | Empty data = blank space | No empty state in `KoruUnifiedCard` (no metrics → row vanishes) or `KoruDetailScreen` (no sections → modules div is empty). |

---

## 1. Icon system — root cause of the tofu

### 1a. The invalid-name bug (HIGH, 1-line fix)

`presentation.ts:1423` and `:1433`:
```ts
icon: "sports",  // ❌ NOT a Material Symbols ligature
```
Material Symbols has **no** `sports` glyph. Every other sports block in the file correctly uses `"sports_soccer"` (lines 1070, 1095). The browser renders the ligature fallback → tofu.

**Fix:**
```ts
// presentation.ts:1423
icon: "sports_soccer",
// presentation.ts:1433
icon: "sports_soccer",
```

### 1b. Font loading (MEDIUM)

`index.html:20`:
```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" media="print" onload="this.media='all'" />
```
Two problems:
1. **No `&display=block`** → Google defaults variable-axis Material Symbols to `swap` in some regions, which means visible tofu for ~200–500 ms before the font swaps in.
2. **The `media="print" onload="..."` lazy-load trick** is missing on this line (it IS present on line 19 for the text fonts). So Material Symbols is render-blocking — which means the WHOLE first paint waits for a ~140 KB variable font.

**Fix (apply both):**
```html
<link rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
      media="print" onload="this.media='all'" />
```
`display=block` gives 3 s of invisible-then-swap (no tofu). Lazy-load moves it off the critical path.

### 1c. `createPortal(document.body)` — verified safe

The `.material-symbols-outlined` rule (`style.css:2058–2073`) is a global class selector, so it applies regardless of where the node lives in the DOM. I checked: there is no `#root`-scoped font-family override that would shadow it. The portal is **not** the cause of the tofu — names + load strategy are.

### 1d. Other icon names — all valid

I grepped every `icon: "..."` literal. The only invalid one is `"sports"`. Everything else (`sports_score`, `crisis_alert`, `device_thermostat`, `featured_seasonal_and_gifts`, `currency_bitcoin`, `currency_exchange`, `how_to_vote`, `psychology_alt`, `checklist_rtl`, `auto_stories`, `local_fire_department`, `picture_as_pdf`, `bookmark_added`, etc.) resolves. **One** semantic nit: `"crisis_alert"` (line 1031) for "Tiros" is a warning triangle, semantically wrong. Use `"sports_score"` for shots or `"target"` / `"crisis_alert"` only for fouls.

---

## 2. Color system — three purples, two greens, no tokens

### 2a. The `Accent` palette today (`presentation.ts:99–111`)

| key | `color` | `soft` |
|---|---|---|
| `violet` | `#8363f9` | `rgba(131,99,249,0.12)` |
| `primary` | `#4648d4` | `rgba(70,72,212,0.10)` |
| `purple` | `#8127cf` | `rgba(129,39,207,0.12)` |
| `emerald` | `#059669` | `rgba(16,185,129,0.12)` |
| `amber` | `#d97706` | `rgba(217,119,6,0.12)` |
| `blue` | `#2563eb` | `rgba(37,99,235,0.12)` |
| `sky` | `#0284c7` | `rgba(2,132,199,0.12)` |
| `rose` | `#e11d48` | `rgba(225,29,72,0.12)` |
| `pink` | `#ec4899` | `rgba(236,72,153,0.12)` |
| `indigo` | `#4f46e5` | `rgba(79,70,229,0.10)` |
| `red` | `#dc2626` | `rgba(220,38,38,0.12)` |

**Problems:**
- `violet` / `primary` / `purple` / `indigo` are four different blues/purples within ~30° of hue. Users cannot tell them apart. Pick **two**: `violet` (Koru brand) + `indigo` (cool secondary).
- `soft` opacities are inconsistent: most are `0.12`, but `primary` and `indigo` are `0.10`. Normalize to `0.10` everywhere — `0.12` reads as a tint, `0.10` reads as a wash.

### 2b. Hardcoded colors in CSS that should be tokens

| Selector | Current | Issue |
|---|---|---|
| `.koru-plan-hero-title` `:2211` | `color: #382b8c` | A fifth "title purple" not in the `A` palette |
| `.koru-plan-hero-desc` `:2221` | `color: #382b8c` | Same |
| `.koru-roadmap-title` `:2408` | `color: #8127cf` | `A.purple` — different from hero title |
| `.koru-unified-art-value` `:2840` | `color: #382b8c` | Yet again `#382b8c` |
| `.koru-unified-metric-value` `:2878` | `color: #382b8c` | Same |
| `.koru-dsec-row-with-bar .koru-dsec-row-title` `:4655` | `color: #5a6b62` | Greenish-gray, not in palette |
| `.koru-dsec-action-pdf` `:4562` | `color: #2d6a4f` | A second "green" different from `A.emerald (#059669)` |
| `.koru-comparison-bar` JSX `KoruDetailScreen.tsx:23–24` | `homeColor || "#2d6a4f"`, `awayColor || "#8363f9"` | Fallbacks diverge from `A.emerald` / `A.purple` |
| `.koru-roadmap` `:2322` | `background: #cbdbf5` | Light **blue** frame around a **lilac** screen — visible on desktop >430 px |
| `.koru-source-domain` `:3116` | `color: #8f88b5` | One-off mauve |
| `.koru-dsec-tile-value` `:2944` | `color: #382b8c` | The ghost purple strikes again |

### 2c. Proposed token layer (add to `:root` in `style.css`)

```css
:root {
  /* Brand */
  --koru-violet:    #8363f9;   /* brand primary  — CTA, kicker, save */
  --koru-violet-2:  #6d4ee8;   /* hover/active   */
  --koru-ink:       #0b1c30;   /* primary text */
  --koru-ink-2:     #382b8c;   /* DEPRECATED — replace all uses with --koru-violet-deep */
  --koru-violet-deep: #523a9e; /* deep title color (was #382b8c) */
  --koru-muted:     #464554;   /* secondary text */
  --koru-muted-2:   #767586;   /* tertiary text, meta */
  --koru-line:      rgba(11,28,48,0.08);

  /* Semantic accents (mirror A.* in TS) */
  --k-emerald: #059669; --k-emerald-soft: rgba(5,150,105,0.10);
  --k-amber:   #d97706; --k-amber-soft:   rgba(217,119,6,0.10);
  --k-rose:    #e11d48; --k-rose-soft:    rgba(225,29,72,0.10);
  --k-sky:     #0284c7; --k-sky-soft:     rgba(2,132,199,0.10);
  --k-pink:    #ec4899; --k-pink-soft:    rgba(236,72,153,0.10);
  --k-red:     #dc2626; --k-red-soft:     rgba(220,38,38,0.10);
  /* DROP --koru-purple #8127cf; collapse into --koru-violet */

  /* Surfaces */
  --surface-card:    #ffffff;
  --surface-card-2:  rgba(255,255,255,0.70);
  --surface-glass:   rgba(255,255,255,0.40);
  --surface-hero-bg: linear-gradient(180deg,#ffffff 0%,#f3f0f8 100%);
  --surface-roadmap: linear-gradient(180deg,#f0dbff 0%,#f8f9ff 100%);
  --frame-roadmap:   #e9def8;   /* was #cbdbf5 — keep lilac family */

  /* Radii */
  --r-xs: 8px;  --r-sm: 12px; --r-md: 16px; --r-lg: 24px; --r-xl: 32px; --r-pill: 999px;

  /* Shadows */
  --sh-card:  0 8px 32px rgba(18,10,50,0.08);
  --sh-card-2: 0 4px 14px rgba(0,0,0,0.04);
  --sh-float: 0 16px 30px rgba(70,72,212,0.18);
  --sh-cta:   0 6px 16px rgba(131,99,249,0.28);

  /* Type scale (see §3) */
  --fs-11: 11px; --fs-12: 12px; --fs-13: 13px; --fs-14: 14px;
  --fs-16: 16px; --fs-20: 20px; --fs-22: 22px; --fs-28: 28px; --fs-36: 36px;
}
```

### 2d. Team colors

`presentation.ts:1088–1089`:
```ts
const homeColor = b.homeColor ?? A.emerald.color;
const awayColor = b.awayColor ?? A.purple.color;
```
But `KoruDetailScreen.tsx:23–24`:
```ts
const hc = homeColor || "#2d6a4f";   // ❌ forest green, not emerald
const ac = awayColor || "#8363f9";   // ❌ violet, not purple
```
**The fallback in JSX diverges from the fallback in TS.** Either team_color is set or it isn't — and when it isn't, the user sees a third and fourth green/purple that match nothing. Fix to a single pair (emerald + violet) and pass team badges through to `ComparisonBar`.

---

## 3. Typography hierarchy — 11 sizes, no scale

### 3a. Current mess

| Element | Size | Weight | Notes |
|---|---|---|---|
| `.koru-plan-hero-kicker` | 11px | 600 | uppercase, +0.08em |
| `.koru-plan-hero-title` | 22px | 800 | -0.01em |
| `.koru-plan-hero-desc` | 13px | 400 | |
| `.koru-plan-hero-cat span` | 10px | 500 | |
| `.koru-unified-metric-label` | 10px | 700 | +0.04em |
| `.koru-unified-metric-value` | 14px | 800 | |
| `.koru-roadmap-title` | 36px | 800 | -0.025em |
| `.koru-roadmap-subtitle` | 16px | 500 | |
| `.koru-module-title` | 20px | 800 | |
| `.koru-module-kicker` | 12px | 600 | **no uppercase** |
| `.koru-dsec-text` | 13.5px | 400 | |
| `.koru-dsec-tile-label` | 11px | 600 | |
| `.koru-dsec-tile-value` | 16px | 800 | |
| `.koru-dsec-row-title` | 13.5px | 700 | |
| `.koru-dsec-row-detail` | 11.5px | 400 | |
| `.koru-dsec-row-meta` | 11px | 700 | |
| `.koru-dsec-chip-label` | 12.5px | 700 | |
| `.koru-dsec-chip-sub` | 10.5px | 500 | |
| `.koru-dsec-scard-title` | 14px | 800 | |
| `.koru-dsec-scard-detail` | 11.5px | 400 | |
| `.koru-dsec-source-title` | 12.5px | 500 | |
| `.koru-timeline-name` | 14px | 700 | |
| `.koru-timeline-meta` | 12px | 400 | |

11px, 11.5px, 12px, 12.5px, 13px, 13.5px, 14px, 16px, 20px, 22px, 36px — that's **11 distinct sizes**, two of which differ by 0.5 px (literally invisible at 1× DPR). Subtitles show as either "Lo esencial" or "LO ESENCIAL" depending on the call site.

### 3b. Consolidated scale (1.2 modular)

| Token | px | Use |
|---|---|---|
| `--fs-11` | 11 | kickers, micro-labels |
| `--fs-12` | 12 | row meta, chip sub, timeline meta |
| `--fs-13` | 13 | body text, row detail |
| `--fs-14` | 14 | row title, scard title, timeline name |
| `--fs-16` | 16 | tile value, roadmap subtitle |
| `--fs-20` | 20 | module title |
| `--fs-22` | 22 | hero title |
| `--fs-28` | 28 | roadmap title (was 36 — too big for a 430 px column) |
| `--fs-36` | 36 | reserved — splash only |

### 3c. Specific rewrites

```css
.koru-roadmap-title     { font-size: var(--fs-28); letter-spacing: -0.02em; }
.koru-plan-hero-title   { font-size: var(--fs-22); }
.koru-module-title      { font-size: var(--fs-20); }
.koru-roadmap-subtitle  { font-size: var(--fs-16); }
.koru-dsec-tile-value   { font-size: var(--fs-16); }
.koru-dsec-row-title    { font-size: var(--fs-14); }   /* was 13.5 */
.koru-dsec-row-detail   { font-size: var(--fs-13); }   /* was 11.5 */
.koru-dsec-text         { font-size: var(--fs-13); }   /* was 13.5 */
.koru-dsec-chip-label   { font-size: var(--fs-13); }   /* was 12.5 */
.koru-dsec-source-title { font-size: var(--fs-13); }   /* was 12.5 */
.koru-dsec-row-meta     { font-size: var(--fs-12); }   /* was 11 */
.koru-dsec-chip-sub     { font-size: var(--fs-12); }   /* was 10.5 */

/* Single source of truth for kicker treatment */
.koru-plan-hero-kicker,
.koru-module-kicker,
.koru-roadmap-subtitle {
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
}
.koru-plan-hero-kicker { font-size: var(--fs-11); }
.koru-module-kicker    { font-size: var(--fs-11); }   /* was 12, no uppercase */
```
Also normalize at the source — `presentation.ts` should **always** pass Title Case in `subtitle`; CSS uppercases. Today 17 of 19 sites pre-upper-case the string, which is the wrong layer.

---

## 4. Spacing system — too much air in the wrong places

### 4a. The 64 px hole

Walk the vertical rhythm from the last data row to the action bar:

```
last .koru-dsec-row           padding-bottom 12 px
.koru-magical-card            padding-bottom 24 px
.koru-roadmap-modules         padding-bottom 48 px
.koru-dsec-actions            padding-top    16 px
                              ─────────────
                              = 100 px of whitespace
```
User-perceived "32 px gap between sections" is the 24 px module gap + 24 px card padding on each side = **72 px** between two pieces of content.

### 4b. Spacing scale (4 pt grid)

```css
--sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px; --sp-4: 16px;
--sp-5: 20px; --sp-6: 24px; --sp-8: 32px;
```

### 4c. Specific rewrites

```css
.koru-plan-hero            { padding: 20px 20px 16px; }          /* was 24/24/20 */
.koru-magical-card         { padding: 20px; }                    /* was 24 */
.koru-roadmap-modules      { gap: 16px; padding: 0 20px 24px; }  /* was 24 / 0 24 48 */
.koru-roadmap-header       { padding: 72px 20px 20px; }          /* was 80/24/32 */
.koru-dsec-actions         { padding: 12px 20px calc(20px + env(safe-area-inset-bottom,0px)); }
                                                                /* was 16/24/(32+safe) */
.koru-dsec-row             { padding: 10px 12px; }              /* was 12 */
.koru-dsec-tile            { padding: 12px; }                   /* unchanged */
.koru-unified-metrics      { margin: 16px 0 12px; }             /* was 20/0/16 */
```

Net effect: 3 magical-cards stack ≈ 90 px shorter. Detail screen scrolls less. Content density goes up ~12% without feeling cramped.

---

## 5. Sports card — pitch visualization

### 5a. The problem

`buildMatchDetailSections` (line 1174–1207) builds a flat `rows` list:
```ts
rows.push({ title: "Barcelona (4-3-3)", detail: "" });
for (const p of homeLineup.starters) rows.push({ title: `#${p.number} ${p.name}`, detail: p.position });
```
11 home players + 11 away players + 2 formation headers = **24 row tiles** of pure text. No visual hierarchy, no formation geometry, no "this is a back four" cue. This is the "formations look bad" complaint.

### 5b. Design — split pitch, dots by formation

Two vertical halves (home bottom half attacking up, away top half attacking down). Formation string `"4-3-3"` is parsed into rows `[4,3,3]`; each row gets N dots evenly spread across the pitch width. GK is a single dot at the goal mouth. Player number sits inside the dot; tapping a dot opens a tooltip with name + position.

A new `DetailSection.kind` is not strictly required — we can smuggle it through the existing `rows` kind with a `pitch` renderer branch in `KoruDetailScreen.tsx`, but the cleaner fix is a new `kind: "pitch"`:

```ts
// presentation.ts — add to DetailSection union
| { kind: "pitch"; icon: string; accent: Accent; title: string; subtitle?: string;
    home: { name: string; color: string; formation: string; players: { number?: string; name: string; position?: string }[] };
    away: { name: string; color: string; formation: string; players: { number?: string; name: string; position?: string }[] };
  }
```

### 5c. JSX (drop into `SectionBody` switch in `KoruDetailScreen.tsx`)

```tsx
// Parse "4-3-3" -> [4,3,3]. Default to [4,3,3] on parse failure.
function parseFormation(f: string): number[] {
  const parts = f.match(/\d/g);
  return parts?.map(Number) ?? [4, 3, 3];
}

// Evenly space N items across [10%, 90%] of width.
function rowX(n: number, i: number): number {
  if (n === 1) return 50;
  return 10 + (80 * i) / (n - 1);
}

function PitchHalf({ team, side }: { team: PitchTeam; side: "home" | "away" }) {
  const rows = parseFormation(team.formation);
  // GK at the goal line (y=2% for home, y=98% for away).
  // Each outfield row spaced from y=18% to y=48% (home) / 52% to 82% (away).
  const yStart = side === "home" ? 18 : 82;
  const yEnd = side === "home" ? 48 : 52;
  const yStep = rows.length > 1 ? (yEnd - yStart) / (rows.length - 1) : 0;
  const gkY = side === "home" ? 4 : 96;
  return (
    <div className="koru-pitch-half" data-side={side}>
      {rows.map((n, rIdx) =>
        Array.from({ length: n }).map((_, i) => {
          // Player index = GK(0) + previous rows + i
          const playerIdx = 1 + rows.slice(0, rIdx).reduce((a, b) => a + b, 0) + i;
          const p = team.players[playerIdx];
          if (!p) return null;
          const y = rows.length === 1 ? (yStart + yEnd) / 2 : yStart + yStep * rIdx;
          return (
            <button
              key={`${rIdx}-${i}`}
              className="koru-pitch-dot"
              style={{
                left: `${rowX(n, i)}%`,
                top: `${y}%`,
                background: team.color,
              }}
              aria-label={`${p.name}${p.position ? `, ${p.position}` : ""}`}
            >
              {p.number ?? ""}
            </button>
          );
        })
      )}
      {/* GK */}
      {team.players[0] && (
        <button
          className="koru-pitch-dot is-gk"
          style={{ left: "50%", top: `${gkY}%`, background: team.color }}
          aria-label={team.players[0].name}
        >
          {team.players[0].number ?? ""}
        </button>
      )}
    </div>
  );
}

case "pitch":
  return (
    <div className="koru-pitch">
      <div className="koru-pitch-names">
        <span style={{ color: section.away.color }}>{section.away.name} · {section.away.formation}</span>
        <span style={{ color: section.home.color }}>{section.home.name} · {section.home.formation}</span>
      </div>
      <div className="koru-pitch-field">
        <div className="koru-pitch-line" />
        <div className="koru-pitch-circle" />
        <div className="koru-pitch-box top" />
        <div className="koru-pitch-box bottom" />
        <PitchHalf team={section.away} side="away" />
        <PitchHalf team={section.home} side="home" />
      </div>
    </div>
  );
```

### 5d. CSS

```css
.koru-pitch {
  margin-top: 4px;
  border-radius: var(--r-md);
  overflow: hidden;
  background: linear-gradient(180deg, #1f8a4c 0%, #2aa35a 50%, #1f8a4c 100%);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08), 0 4px 12px rgba(0,0,0,0.12);
}
.koru-pitch-names {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: var(--fs-12);
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #fff;
  background: rgba(0,0,0,0.25);
}
.koru-pitch-field {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;   /* portrait pitch fits 430px column */
  max-height: 460px;
}
.koru-pitch-line { /* halfway line */
  position: absolute; left: 8%; right: 8%; top: 50%;
  height: 1px; background: rgba(255,255,255,0.45);
}
.koru-pitch-circle { /* center circle */
  position: absolute; left: 50%; top: 50%;
  width: 64px; height: 64px;
  transform: translate(-50%,-50%);
  border: 1px solid rgba(255,255,255,0.45);
  border-radius: var(--r-pill);
}
.koru-pitch-box { /* penalty box, top + bottom */
  position: absolute; left: 25%; right: 25%;
  height: 12%;
  border: 1px solid rgba(255,255,255,0.45);
}
.koru-pitch-box.top    { top: 0;    border-top: none; }
.koru-pitch-box.bottom { bottom: 0; border-bottom: none; }
.koru-pitch-dot {
  position: absolute;
  width: 28px; height: 28px;
  transform: translate(-50%,-50%);
  display: grid; place-items: center;
  border-radius: var(--r-pill);
  border: 2px solid rgba(255,255,255,0.85);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease;
  z-index: 2;
}
.koru-pitch-dot:hover { transform: translate(-50%,-50%) scale(1.12); box-shadow: 0 4px 10px rgba(0,0,0,0.35); }
.koru-pitch-dot.is-gk { width: 24px; height: 24px; opacity: 0.85; }

@media (max-width: 380px) {
  .koru-pitch-dot { width: 24px; height: 24px; font-size: 10px; }
}
```

### 5e. Wire it up in `presentation.ts`

Replace the lineups block in `buildMatchDetailSections` (lines 1174–1207) with:

```ts
if (b.lineups) {
  const homeLineup = b.lineups[homeName];
  const awayLineup = b.lineups[awayName];
  if (homeLineup && awayLineup) {
    sections.push({
      kind: "pitch",
      icon: "groups",
      accent: A.emerald,
      title: "Alineaciones",
      subtitle: "Formación inicial",
      home: { name: homeName, color: homeColor, formation: homeLineup.formation ?? "4-3-3", players: homeLineup.starters ?? [] },
      away: { name: awayName, color: awayColor, formation: awayLineup.formation ?? "4-3-3", players: awayLineup.starters ?? [] },
    });
  }
}
```

---

## 6. Compact stats — fix the "repetitive" complaint

### 6a. Today's repetition

Every `detailedStats` entry renders as an identical 6 px bar with two numbers. 9 stats × 4 px row gap = a wall of identical bars. No grouping, no winner highlight, no disclosure.

### 6b. New `ComparisonBar` — taller, labeled, with leader dot

```css
.koru-comparison-bar {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--sp-2);
  margin-top: var(--sp-2);
}
.koru-comparison-value {
  font-size: var(--fs-13);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  min-width: 32px;
}
.koru-comparison-value.home { text-align: right; color: var(--bar-home, var(--k-emerald)); }
.koru-comparison-value.away { text-align: left;  color: var(--bar-away, var(--koru-violet)); }
.koru-comparison-value.is-leader { font-weight: 800; }
.koru-comparison-value.is-leader::after {
  content: ""; /* leader dot */
  display: inline-block;
  width: 6px; height: 6px;
  border-radius: var(--r-pill);
  background: currentColor;
  margin: 0 4px;
  vertical-align: middle;
}

.koru-comparison-track {
  height: 10px;                              /* was 6 — too anemic */
  border-radius: var(--r-pill);
  display: flex; overflow: hidden;
  background: var(--koru-line);
  position: relative;
}
.koru-comparison-track::after {              /* center tick */
  content: "";
  position: absolute; left: 50%; top: 0; bottom: 0;
  width: 1px;
  background: rgba(11,28,48,0.18);
}
.koru-comparison-fill {
  height: 100%;
  min-width: 4px;
  transition: width 600ms cubic-bezier(0.22, 1, 0.36, 1);
  animation: koru-bar-pop 380ms cubic-bezier(0.22,1,0.36,1) both;
}
@keyframes koru-bar-pop {
  from { transform: scaleX(0); transform-origin: left; }
  to   { transform: scaleX(1); }
}
.koru-comparison-fill.home { border-radius: var(--r-pill) 0 0 var(--r-pill); }
.koru-comparison-fill.away { border-radius: 0 var(--r-pill) var(--r-pill) 0; }
```

### 6c. Group + disclose (component sketch)

Build a `<StatGroup>` that splits stats into two clusters and shows the rest behind a "Ver más" disclosure:

```tsx
function StatGroup({ rows, homeName, awayName }: { rows: DetailRow[]; homeName: string; awayName: string }) {
  const [open, setOpen] = useState(false);
  const HEADLINE = ["Posesión", "Tiros", "Tiros al arco", "Córners"]; // surface first
  const headline = rows.filter(r => HEADLINE.includes(r.title));
  const rest     = rows.filter(r => !HEADLINE.includes(r.title));
  return (
    <div className="koru-stat-group">
      <div className="koru-stat-group-head">
        <span style={{ color: homeColor }}>{homeName.slice(0,3).toUpperCase()}</span>
        <span className="koru-stat-group-label">VS</span>
        <span style={{ color: awayColor }}>{awayName.slice(0,3).toUpperCase()}</span>
      </div>
      {headline.map((r, i) => <StatRow key={i} row={r} />)}
      {open && rest.map((r, i) => <StatRow key={`r-${i}`} row={r} />)}
      {rest.length > 0 && (
        <button className="koru-stat-disclosure" onClick={() => setOpen(o => !o)}>
          <Mat>{open ? "expand_less" : "expand_more"}</Mat>
          {open ? "Ver menos" : `Ver ${rest.length} más`}
        </button>
      )}
    </div>
  );
}
```

```css
.koru-stat-group { display: flex; flex-direction: column; gap: var(--sp-2); }
.koru-stat-group-head {
  display: flex; align-items: center; justify-content: space-between;
  font-size: var(--fs-12); font-weight: 800; letter-spacing: 0.04em;
  padding: 0 var(--sp-2);
}
.koru-stat-group-label { color: var(--koru-muted-2); font-weight: 600; }
.koru-stat-disclosure {
  align-self: center;
  display: inline-flex; align-items: center; gap: 4px;
  margin-top: var(--sp-2);
  padding: 6px 12px;
  border-radius: var(--r-pill);
  background: var(--surface-glass);
  border: 1px solid var(--koru-line);
  font-size: var(--fs-12); font-weight: 600;
  color: var(--koru-muted);
  cursor: pointer;
}
.koru-stat-disclosure .material-symbols-outlined { font-size: 16px; }
```

### 6d. Leader highlight in JSX

In `ComparisonBar`, mark the larger value:
```tsx
const homeLeads = homeValue > awayValue;
const awayLeads = awayValue > homeValue;
<span className={`koru-comparison-value home ${homeLeads ? "is-leader" : ""}`} style={{ color: hc }}>
  {isPercent ? `${Math.round(homeValue)}%` : homeValue}
</span>
```

---

## 7. Microinteractions — what's missing

Today: `transition: width .4s` on bars, `koru-fade-in` on CollectionsScreen, `koru-roadmap-float` on a hero illustration that's not even rendered. **That's it.**

### 7a. Card entrance (stagger)

```css
.koru-magical-card {
  animation: koru-card-in 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(var(--i, 0) * 70ms);
}
@keyframes koru-card-in {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
```
In `KoruDetailScreen.tsx` add `style={{ '--i': i } as CSSProperties}` to the `koru-magical-card` div.

### 7b. Bar fill (already proposed in §6b)

`koru-bar-pop` plays once on mount.

### 7c. Badge pop

```css
.koru-step-chip { animation: koru-pop 320ms cubic-bezier(0.34,1.56,0.64,1) both; }
@keyframes koru-pop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
```

### 7d. Live dot pulse (for `live_match`)

```css
.koru-pulse-dot {
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: var(--r-pill);
  background: var(--k-red);
  margin-right: 6px;
  vertical-align: middle;
  animation: koru-pulse 1.4s ease-in-out infinite;
}
@keyframes koru-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.5); }
  50%      { box-shadow: 0 0 0 6px rgba(220,38,38,0); }
}
```
Inject a `<span className="koru-pulse-dot" />` before the live kicker in `liveMatch` when `live` is true.

### 7e. CTA press (already there — keep)

`.koru-plan-hero-cta:active { transform: scale(0.98); }` — good. Mirror to `.koru-dsec-action-btn` (already done at line 4556).

### 7f. `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 8. Empty / broken states

### 8a. `KoruUnifiedCard` — no metrics

Today: if `hero.metrics` is empty or undefined, the metrics div is just not rendered. Card looks fine but loses rhythm. Fix: render a single full-width "no data" tile.

```tsx
{(!hero.metrics || hero.metrics.length === 0) && (
  <div className="koru-unified-empty">
    <Mat>info</Mat>
    <span>Sin datos adicionales</span>
  </div>
)}
```

```css
.koru-unified-empty {
  display: flex; align-items: center; justify-content: center;
  gap: var(--sp-2);
  margin: var(--sp-4) 0 var(--sp-3);
  padding: var(--sp-3);
  border-radius: var(--r-md);
  background: var(--surface-glass);
  border: 1px dashed var(--koru-line);
  color: var(--koru-muted-2);
  font-size: var(--fs-13); font-weight: 500;
}
.koru-unified-empty .material-symbols-outlined { font-size: 18px; }
```

### 8b. `KoruDetailScreen` — no sections

```tsx
{detail.sections.length === 0 ? (
  <div className="koru-dsec-empty">
    <div className="koru-dsec-empty-icon"><Mat>search_off</Mat></div>
    <h3>Sin contenido detallado</h3>
    <p>Esta tarjeta no tiene secciones para mostrar todavía.</p>
  </div>
) : (
  detail.sections.map(...)
)}
```

```css
.koru-dsec-empty {
  display: flex; flex-direction: column; align-items: center;
  text-align: center;
  padding: 64px var(--sp-6);
  color: var(--koru-muted);
}
.koru-dsec-empty-icon {
  width: 64px; height: 64px;
  display: grid; place-items: center;
  border-radius: var(--r-lg);
  background: var(--koru-violet-soft, rgba(131,99,249,0.10));
  color: var(--koru-violet);
  margin-bottom: var(--sp-4);
}
.koru-dsec-empty h3 { font-size: var(--fs-16); font-weight: 800; color: var(--koru-ink); margin: 0 0 4px; }
.koru-dsec-empty p  { font-size: var(--fs-13); margin: 0; }
```

### 8c. Missing data inside a section (e.g., `lineups` undefined)

If `b.lineups` is `undefined`, no "Alineaciones" card is shown at all — the user has no idea that data *could* exist. Decide one of two policies and apply globally:
- **Hide silently** (current behavior). Cheaper, but the user can't tell "data missing" from "Koru forgot".
- **Show placeholder card** with a single line: "Alineaciones no disponibles". Recommended for high-intent sections (lineups, stats, timeline).

```tsx
// In buildMatchDetailSections — after the `if (b.lineups)` block:
else {
  sections.push({
    kind: "text",
    icon: "groups",
    accent: A.emerald,
    title: "Alineaciones",
    body: "Las alineaciones no están disponibles para este partido.",
  });
}
```

---

## 9. Top 5 highest-impact visual fixes (ranked)

| # | Fix | Files | Effort | Impact |
|---|---|---|---|---|
| **1** | Replace `icon: "sports"` → `"sports_soccer"` on `presentation.ts:1423` and `:1433`. Add `&display=block` + lazy-load `media="print" onload=...` to Material Symbols `<link>` in `index.html:20`. | `presentation.ts`, `index.html` | 5 min | Kills every tofu square in the sports flow + speeds up first paint by ~140 KB. |
| **2** | Build the **pitch visualization** (§5c–5e). Replace the flat lineups `rows` list with `kind: "pitch"` and the JSX/CSS above. | `presentation.ts`, `KoruDetailScreen.tsx`, `style.css` | 2–3 h | Directly answers "formations look bad". Converts 24 text rows into one glanceable diagram. |
| **3** | Collapse three purples → one. Replace every `#382b8c`, `#8127cf`, `#2d6a4f` literal with the new `--koru-violet-deep` / `--koru-violet` / `--k-emerald` tokens. Fix the divergent team-color fallbacks in `KoruDetailScreen.tsx:23–24` to match `presentation.ts:1088–1089`. | `style.css`, `KoruDetailScreen.tsx`, `presentation.ts` | 1 h | Unifies hero / detail / action visual identity. Removes the "off-brand" feeling. |
| **4** | Compress spacing: `padding: 24 → 20` on magical-cards and hero; `gap: 24 → 16` on `.koru-roadmap-modules`; `padding-bottom: 48 → 24` on modules; `padding-top: 16 → 12` on actions. | `style.css` | 15 min | Detail screen loses ~90 px per 3 cards, scrolls less, feels denser and more "designed". |
| **5** | Add the staggered `koru-card-in` entrance + `koru-bar-pop` fill + `koru-pulse-dot` for live matches + `prefers-reduced-motion` guard. | `style.css`, `KoruDetailScreen.tsx`, `presentation.ts` | 45 min | Turns "instant appearance" into a flow. Bars feel alive, live matches feel live. |

**Quick wins** (do these in the same PR, not ranked):
- Normalize all `section.subtitle` strings to Title Case in TS and add `text-transform: uppercase` to `.koru-module-kicker` in CSS.
- Change `.koru-roadmap` background from `#cbdbf5` to `#e9def8` (lilac family) so desktop framing doesn't clash with the lilac screen.
- Bump `.koru-comparison-track` height from `6px` → `10px` and add the center tick + leader dot.
- Add empty state to `KoruUnifiedCard` (§8a) and `KoruDetailScreen` (§8b).
- Rename `"crisis_alert"` → `"sports_score"` for Tiros (line 1031).

---

## 10. Out of scope but flagged

- The `.koru-unified-art` rule at `style.css:2818–2831` declares `width: 96px; height: 96px;` then **re-declares** `width: 120px; height: 120px;` 8 lines later. The second wins. Delete the first.
- `.koru-dsec-row-with-bar .koru-dsec-row-detail { display: none }` (line 4661) hides the textual summary whenever a bar is shown. For screen readers this is data loss — add `visually-hidden` instead of `display: none`.
- `DELIVERABLE_SECTION_ACCENTS` (line 263) cycles `[amber, primary, emerald, pink, purple]` — that's five accents per deliverable. After the palette collapse in §2c, narrow to three: `[amber, emerald, violet]`. Anything more reads as confetti.
