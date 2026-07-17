# Koru Chat App — Visual Audit Report

**Query tested:** `investiga auriculares con cancelacion de ruido`
**Screenshots analyzed:** 4 timestamps + 1 reference image
**Annotated versions:** `/home/z/my-project/download/screenshots/annotated/`

---

## 1. Per-screenshot breakdown (top → bottom)

### 📸 `audit-01-2s.png` — 2 seconds after sending

| # | Element | Position | Notes |
|---|---|---|---|
| 1 | Background illustration | Top ~40% of screen | Blue→purple gradient sky, stars, floating purple islands. **Koru mascot #1** appears here, sitting on a rock holding a yellow folder, next to a brown 3-drawer filing cabinet with documents. |
| 2 | User message bubble | ~36–45% of screen height | Light gray rounded rectangle. Text: *"investiga auriculares con cancelacion de ruido"*. |
| 3 | "Working" panel | Bottom ~55% of screen, all the way to the bottom edge | White rounded panel with **no input bar visible below it**. |
| 3a | Koru avatar circle | Top-left of working panel | **Koru mascot #2** (small circular avatar with light blue border). |
| 3b | Centered mascot illustration | Middle of working panel | **Koru mascot #3** — same character sitting cross-legged holding a purple book, surrounded by decorative icons (yellow star, purple gear, lightbulb, document, plant, mug). |
| 3c | Title text | Below illustration | *"Sumergiéndome en tu búsqueda..."* |
| 3d | Subtitle | Below title | *"Buscando..."* + 🌐 globe emoji |
| 3e | Progress bar | Below subtitle | Horizontal light-purple bar |
| 3f | Status labels | Below progress bar | All 4 shown at once: *"Entendiendo tu búsqueda"*, *"Buscando en la web"*, *"Filtrando resultados"*, *"Preparando respuesta"* |
| 3g | Motivational footer | Bottom of panel | *"El camino se hace caminando."* + ✨ + ❤️ |
| — | Input bar | **MISSING** | The working panel has eaten the bottom of the screen. |

### 📸 `audit-02-5s.png` — 5 seconds after sending

Same exact layout as 2s, with two changes:

- Progress bar now appears **~80% filled**.
- Motivational footer changed to: *"Acá estamos, dale que sale."* + ❤️

All 3 Koru mascots still present. No input bar. 4 status steps still shown simultaneously.

### 📸 `audit-03-10s.png` — 10 seconds after sending

Same exact layout, with two more changes:

- Progress bar appears to have **REGRESSED to ~40% filled** (was ~80% at 5s).
- Motivational footer changed again, now: *"Tu paciencia se nota. Gracias."* + ❤️ + ✨

All 3 Koru mascots still present. No input bar. 4 status steps still shown simultaneously.

### 📸 `audit-04-20s.png` — 20 seconds after sending (after response)

Completely different layout — theme switches from gradient sky to **dark navy (~#1a1a2e)**.

| # | Element | Position | Notes |
|---|---|---|---|
| 1 | Top bar | Top ~6% | Dark navy with a search field showing *"Investiga auriculares c…"* (truncated). |
| 2 | User message bubble | ~7–13% | Light blue rounded rectangle with the query text. |
| 3 | Assistant text bubble | ~15–27% | White bubble with Koru avatar to the left. Text: *"Te dejé una comparativa con las mejores opciones de 2026 en la tarjeta. Hay de todo: desde los Sony WH-1000XM5 y Bose QuietComfort Ultra hasta opciones más accesibles."* |
| 3a | Koru avatar | Left of assistant bubble | Small circular avatar with white bird + blue beak. |
| 4 | Comparison card | ~28–62% | White card with title *"TU COMPARACIÓN"* (pink), subtitle *"COMPARATIVA"* (dark blue), pink scale icon. Three sub-cards inside: *Opciones (4)*, *Fuentes (6)*, *Mejor opción*. *"Ver comparación"* button with arrow at bottom. **VLM also detected what looks like a SECOND assistant bubble wrapping this card with the same text — needs code verification.** |
| 5 | Smaller card | ~63–70% | *"Ver 6 fuentes"* with green checkmark. |
| 6 | Suggestion chips | ~71–88% | *"¿Qué tal el día?"*, *"¿Cómo salió España?"*, *"Rece!"* |
| 7 | Input bar | Bottom ~91–98% | White bar with leaf/+ /pencil icons, *"Habla con Koru…"* placeholder, purple mic. |

### 📷 Reference image `pasted_image_1784151610784.png`

Different query (`"Como salio inglaterra"`), but this is the screenshot the user is complaining about.

| # | Element | Position | Notes |
|---|---|---|---|
| 1 | Background illustration | Top ~30% | Gradient sky + floating islands. **Koru mascot #1** sitting on a rock using a laptop, yellow mug beside it. |
| 2 | User message bubble | Top-right ~6–13% | *"Como salio inglaterra"* |
| 3 | **Inline assistant status bubble** | ~16–24% | White bubble with **Koru mascot #2** (avatar) on the left, text *"Buscando en la web"* + subtext *"Consultando fuentes ahora…"* |
| 4 | **Big "working" panel** | ~30–85% | Title *"Sumergiéndome en tu búsqueda…"*, subtitle *"Buscando…"*, purple progress bar showing **15%**, 3 status pills (*Entendiendo tu búsqueda* ✓ / *Buscando en la web* / *Preparando respuesta*), footer *"✨ Lo que vale no se apura. ♥"* |
| 5 | Input bar | Bottom ~88–96% | Dark purple with leaf/+ /pencil icons, *"Habla con Koru…"* placeholder, purple mic. |

---

## 2. Comparison Table

| Timestamp | Elements visible | Problems found |
|---|---|---|
| **2s** | • Background illustration with Koru mascot<br>• User bubble<br>• Big working panel containing Koru avatar + Koru illustration + title + subtitle + progress bar + 4 status steps + motivational footer | • Koru mascot appears **3 times** on screen<br>• Working panel **replaces the input bar** at the bottom (no text input possible)<br>• **All 4 status steps shown simultaneously** instead of just the active one<br>• Working panel duplicates the user's intent visually (avatar + mascot = "Koru is talking", but also "Koru is searching") |
| **5s** | Same as 2s; progress bar ~80%; motivational text now *"Acá estamos, dale que sale."* | • All 3 bugs from 2s still present<br>• Only the motivational quote and the progress bar change — no progressive UI evolution |
| **10s** | Same as 2s/5s; progress bar **regressed to ~40%**; motivational text now *"Tu paciencia se nota. Gracias."* | • All 3 bugs from 2s still present<br>• **NEW: progress bar is non-monotonic** — went 80% → 40% (broke user trust)<br>• Motivational quote changed 3 times in 10s — feels random, not tied to any actual state change |
| **20s (after response)** | • Dark navy theme (different from previous 3 screens)<br>• Top bar with search field<br>• User bubble<br>• Assistant text bubble + Koru avatar (1×)<br>• Comparison card with 3 sub-cards<br>• Smaller "Ver 6 fuentes" card<br>• Suggestion chips<br>• Input bar | • **Theme switches abruptly** from gradient-sky to dark-navy (no transition)<br>• Input bar reappears (good), but the prior 18s had no input available<br>• VLM detected a possible duplicate assistant bubble wrapping the card — needs code verification<br>• Top search bar shows truncated query *"Investiga auriculares c…"* (cosmetic) |
| **Reference (Como salio inglaterra)** | • Background illustration with Koru<br>• User bubble<br>• **Inline status bubble "Buscando en la web" + subtext "Consultando fuentes ahora…"**<br>• **Big working panel below** with same info + progress bar + 3 status pills + motivational<br>• Input bar at bottom | • **CRITICAL**: 2 representations of the same searching state stacked on top of each other (inline bubble + big panel)<br>• Koru mascot appears **2 times** (background + inline avatar)<br>• 3 status pills shown simultaneously — same multi-state problem<br>• Inline bubble + working panel both communicate "searching" → visually noisy and semantically redundant |

---

## 3. Complete list of problems found

### 🔴 Critical (the "multiple states overlap" complaint)

1. **Inline status bubble AND big working panel render simultaneously** (reference image).
   - The small inline assistant bubble says *"Buscando en la web"* + *"Consultando fuentes ahora…"*.
   - Right below it, the big working panel says *"Sumergiéndome en tu búsqueda…"* / *"Buscando…"* + a progress bar + 3 status pills.
   - Both communicate the **same** searching state. They should be ONE element, not two.

2. **All 4 status steps shown at once inside the working panel** (audits 1/2/3).
   - *Entendiendo tu búsqueda*, *Buscando en la web*, *Filtrando resultados*, *Preparando respuesta* all rendered together.
   - The user cannot tell which step is currently happening. Should reveal only the active step (or highlight just one as in-progress and the others as pending/done).

3. **Koru mascot duplicated 2–3 times per screen.**
   - Audits 1/2/3: **3× Koru** — background illustration + panel avatar + panel centered illustration.
   - Reference: **2× Koru** — background illustration + inline bubble avatar.
   - Pick ONE location for the mascot per screen state.

### 🟠 High severity

4. **Working panel replaces the input bar** (audits 1/2/3).
   - During the entire 10-second search phase, there is no input bar visible. The user cannot type a follow-up, edit, or cancel. The working panel extends to the very bottom edge.

5. **Progress bar is non-monotonic** (audit 3 vs audit 2).
   - At 5s it shows ~80%. At 10s it shows ~40%. The bar visibly went backward, which makes the loading state feel broken.

6. **Motivational footer text changes randomly between screenshots** without any apparent state change.
   - 2s: *"El camino se hace caminando."*
   - 5s: *"Acá estamos, dale que sale."*
   - 10s: *"Tu paciencia se nota. Gracias."*
   - These appear to rotate from a pool of quotes on a timer, not in response to actual search progress. Feels disjointed.

### 🟡 Medium severity

7. **Theme switches abruptly between loading and result states.**
   - Audits 1/2/3: light gradient (blue→purple) with whimsical illustration.
   - Audit 4 (result): dark navy (~#1a1a2e) background.
   - The transition is jarring — the user perceives a different app.

8. **Background Koru illustration + foreground working panel compete for attention.**
   - The decorative background scene is busy and uses 30–40% of the screen, leaving less room for the actual status info.
   - During loading, this is fine; but it never collapses or simplifies, so it always feels cluttered.

9. **Possible duplicate assistant bubble wrapping the comparison card** (audit 4).
   - VLM described two consecutive assistant bubbles with the *same* text. Needs verification in code (likely the card is being rendered inside an assistant message wrapper that already printed the text above).

### 🟢 Low severity / cosmetic

10. **Top search bar shows truncated query** *"Investiga auriculares c…"* (audit 4) — should either show full text or scroll.

11. **Status pills in reference use different icon states than audits 1/2/3** — green check, purple circle, gray — suggests an attempt to show progress, but the visual language is inconsistent between the two layouts.

12. **No traditional loading spinner** anywhere — the only motion indicator is the progress bar. The mascot illustration looks static. Consider adding a subtle animation to the mascot or progress bar to communicate liveness.

---

## 4. "What overlaps with what" — the exact overlap map

The user said: *"multiple states overlap in the same panel and it makes no sense."*

Here is exactly what overlaps with what, per screenshot:

### Reference image (the worst case — 3 overlaps in one screen)

```
┌──────────────────────────────────────────┐
│  [BACKGROUND ILLUSTRATION]                │
│   ┌─────────┐                             │
│   │ KORU #1 │  ←─── overlaps with the     │
│   │ on rock │       background scene      │
│   └─────────┘                             │
│                       ┌──────────────────┐│
│  USER BUBBLE          │ Como salio...    ││  ←── user query
│                       └──────────────────┘│
├──────────────────────────────────────────┤
│  ┌──┐ ┌─────────────────────────────────┐│
│  │K#│ │ Buscando en la web              ││  ←── OVERLAP #1
│  │2 │ │ Consultando fuentes ahora...    ││       "Searching" inline
│  └──┘ └─────────────────────────────────┘│       status bubble
├──────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐ │
│  │ Sumergiéndome en tu búsqueda...     │ │  ←── OVERLAP #2
│  │ Buscando...                         │ │       Big working panel
│  │ ▓▓▓▓░░░░░░░░░░░░ 15%                │ │       says the SAME thing
│  │                                     │ │       (also "Buscando...")
│  │ [✓Entendiendo] [●Buscando] [○Prep]  │ │  ←── OVERLAP #3
│  │                                     │ │       3 status states at once
│  │ ✨ Lo que vale no se apura. ♥        │ │
│  └─────────────────────────────────────┘ │
├──────────────────────────────────────────┤
│  [INPUT BAR — Habla con Koru...]         │
└──────────────────────────────────────────┘
```

- **OVERLAP #1**: Inline bubble *"Buscando en la web"* + subtext *"Consultando fuentes ahora…"*
- **OVERLAP #2**: Big panel below also says *"Buscando…"* + has a progress bar showing 15%. Same concept, two visualizations.
- **OVERLAP #3**: Three status pills (*Entendiendo*, *Buscando*, *Preparando*) shown together — should show only the current one.

### Audits 1/2/3 (the headphones query)

```
┌──────────────────────────────────────────┐
│  [BACKGROUND ILLUSTRATION]                │
│   ┌─────────┐  ┌──────┐                   │
│   │ KORU #1 │  │cabinet│                  │
│   └─────────┘  └──────┘                   │
├──────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐│
│  │ investiga auriculares con cancel...  ││  ←── user query bubble
│  └──────────────────────────────────────┘│
├──────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐ │
│  │ ┌──┐                                │ │  ←── OVERLAP #1
│  │ │K#│  Sumergiéndome en tu búsqueda..│ │       Koru avatar +
│  │ │2 │  Buscando... 🌐                │ │       background mascot
│  │ └──┘                                │ │       = 2× Koru so far
│  │       ┌──────────────────────┐      │ │
│  │       │   KORU #3 sitting    │      │ │  ←── OVERLAP #2
│  │       │   with book + icons  │      │ │       3rd Koru inside the
│  │       └──────────────────────┘      │ │       same panel
│  │ ▓▓▓▓▓▓▓▓░░░░░░░░░░  progress       │ │
│  │ • Entendiendo tu búsqueda           │ │  ←── OVERLAP #3
│  │ • Buscando en la web                │ │       4 status states at once
│  │ • Filtrando resultados              │ │       (none marked active)
│  │ • Preparando respuesta              │ │
│  │ ✨ El camino se hace caminando. ❤️   │ │  ←── OVERLAP #4
│  └─────────────────────────────────────┘ │  ←── panel ends at bottom edge,
├──────────────────────────────────────────┤     NO INPUT BAR below it
└──────────────────────────────────────────┘
```

- **OVERLAP #1**: Koru mascot in background illustration + Koru avatar at top of working panel = **same character twice on screen**.
- **OVERLAP #2**: A THIRD Koru (centered illustration inside the working panel) renders on top of the working panel content.
- **OVERLAP #3**: All 4 status steps rendered simultaneously — looks like the search is doing all 4 things at once.
- **OVERLAP #4**: The motivational footer changes every few seconds (3 different quotes in 10 seconds) — same UI panel, different content, no apparent cause.
- **NO INPUT BAR**: The working panel extends all the way to the bottom edge — the user is locked out of the input.

### Audit 4 (after response)

```
┌──────────────────────────────────────────┐
│  [TOP BAR — dark navy + search field]    │  ←── theme switched to dark
├──────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐│
│  │ investiga auriculares con cancel...  ││  ←── user bubble (light blue)
│  └──────────────────────────────────────┘│
│  ┌──┐ ┌─────────────────────────────────┐│
│  │K │ │ Te dejé una comparativa con las ││  ←── assistant bubble #1
│  │  │ │ mejores opciones de 2026...     ││       (text + avatar)
│  └──┘ └─────────────────────────────────┘│
│  ┌──────────────────────────────────────┐│
│  │ Te dejé una comparativa con las ...  ││  ←── POSSIBLE duplicate
│  │ ┌──────────────────────────────────┐ ││       assistant bubble #2
│  │ │ TU COMPARACIÓN                   │ ││       with same text wrapping
│  │ │ COMPARATIVA              [⚖]     │ ││       the comparison card
│  │ │ [4] Opciones  [6] Fuentes  [🏆]  │ ││       (needs code verification)
│  │ │ Ver comparación →                │ ││
│  │ └──────────────────────────────────┘ ││
│  └──────────────────────────────────────┘│
│  ┌──────────────────────────────────────┐│
│  │ ✓ Ver 6 fuentes                      ││
│  └──────────────────────────────────────┘│
│  [Suggestion chips]                      │
├──────────────────────────────────────────┤
│  [INPUT BAR — Habla con Koru...]         │  ←── input bar restored
└──────────────────────────────────────────┘
```

- **POSSIBLE OVERLAP**: Two assistant bubbles with identical text wrapping the comparison card. (VLM saw this; needs verification.)

---

## 5. Recommended next actions

1. **Pick ONE representation of the "searching" state per screen.**
   - Either keep the inline status bubble (`"Buscando en la web"`) OR keep the big working panel — not both.
   - Suggested: keep the inline bubble as the default; only show the big panel if the user explicitly expands it (tap to see details).

2. **Show only the active status step, not all 4.**
   - Replace the static list with a single dynamic label that updates as the search progresses: *"Entendiendo tu búsqueda…"* → *"Buscando en la web…"* → *"Filtrando resultados…"* → *"Preparando respuesta…"*.
   - Optionally show a small checkmark trail (✓ done / ● active / ○ pending), but never all-as-active.

3. **Render the Koru mascot only ONCE per screen.**
   - Decide: either the background illustration OR the avatar inside the working panel — not both. The third occurrence (centered illustration inside the panel) should be removed entirely.

4. **Always keep the input bar visible** at the bottom, even during loading.
   - The working panel should sit ABOVE the input bar, not replace it.

5. **Fix the progress bar to be monotonic.**
   - It should never go backward. If you don't know real progress, show an indeterminate shimmer instead of a fake percentage.

6. **Stop rotating motivational quotes every few seconds.**
   - Pick one per search session, or tie the quote to a real state change (e.g., when the search exceeds 10s, swap to a longer-wait quote).

7. **Keep the theme consistent** between loading and result states.
   - Either both gradient-sky or both dark navy. The abrupt switch is jarring.

8. **Verify in code** whether the comparison card is being wrapped in a duplicate assistant bubble (audit 4). If yes, remove the wrapper.

---

## 6. Files produced

- **Annotated screenshots** (with colored boxes highlighting each bug):
  - `/home/z/my-project/download/screenshots/annotated/audit-01-2s-ANNOTATED.png`
  - `/home/z/my-project/download/screenshots/annotated/audit-02-5s-ANNOTATED.png`
  - `/home/z/my-project/download/screenshots/annotated/audit-03-10s-ANNOTATED.png`
  - `/home/z/my-project/download/screenshots/annotated/audit-04-20s-ANNOTATED.png`
  - `/home/z/my-project/download/screenshots/annotated/reference-ANNOTATED.png`
- **Annotation script**: `/home/z/my-project/scripts/annotate_audit.py`
- **Raw VLM analyses**: `/tmp/audit1.json`, `/tmp/audit2.json`, `/tmp/audit3.json`, `/tmp/audit4.json`, `/tmp/reference.json`
