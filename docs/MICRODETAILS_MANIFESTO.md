# MICRODETAILS MANIFESTO — Koru v2 Tier S

> "Tier S quality lives in the 100+ tiny details, not the big picture."
> A card is never done when it *works*. A card is done when it *whispers*.

This manifesto is the operating system for every pixel in a Koru card. It is
not a wish-list — it is a contract. Every value is grounded in the real tokens
already living in `src/style.css` (`--koru-purple #8363f9`, `--color-bark
#2e2650`, `--color-earth #6b5f8c`, `--color-stone #a99bbe`, `--color-cream
#f6f3fe`, `--color-sand #e4ddf7`, Plus Jakarta Sans + Bricolage Grotesque) and
the existing `koru-breathe / koru-rise / koru-shimmer / koru-dot-pulse` family.

**Ground rule before rule #1:** a card passes Tier S only when **all 110
microdetails below are true at the same time**. Ship one missing, and the card
falls back to "good enough" — the exact 6/10 the user rejected.

---

## Table of contents
1. [Visual Hierarchy Rules (20)](#1-visual-hierarchy-rules--20)
2. [Color Contrast & Harmony (20)](#2-color-contrast--harmony--20)
3. [Spacing & Alignment Microdetails (15)](#3-spacing--alignment-microdetails--15)
4. [Entrance Microdetails (15 animations)](#4-entrance-microdetails--15-animations)
5. [Hover Microdetails (10 interactions)](#5-hover-microdetails--10-interactions)
6. [Tap Microdetails (8 interactions)](#6-tap-microdetails--8-interactions)
7. [State Indicators (10 patterns)](#7-state-indicators--10-patterns)
8. [Accessibility Microdetails (12 rules)](#8-accessibility-microdetails--12-rules)

---

## 1. Visual Hierarchy Rules (20)

The hierarchy is the spine. Without it, every card reads as a flat list of
facts and the eye doesn't know where to land. These 20 rules force a single,
unambiguous reading order on every card.

**V-01 · Pick the hero before you pick the type.**
Every card has exactly ONE focal element that the eye hits within 200 ms.
Decide it first: hero number (`artValue`), hero image, or hero title. The rest
of the card is organized *around* that element, never competing with it.

**V-02 · The 1-3-1 rule.**
A card is composed of **one hero, three supporting elements, one CTA**. More
than that and the eye scatters. If you genuinely need more, split into two
cards or collapse extras into an expandable detail section.

**V-03 · Weight ladder — 800 / 700 / 600 / 500 only.**
- **800** → the hero `artValue` (36 px number) and the hero title when it is
  the focal element. Use Bricolage Grotesque for 800 — it carries weight
  better than Plus Jakarta.
- **700** → section titles (18 px) and primary CTA labels.
- **600** → tile/row titles, metric labels-bold, the "current" tab.
- **500** → body, descriptions, secondary CTA.
- **400** is forbidden on-screen — too thin for `#2e2650` on `#f6f3fe` to feel
  confident. Use 500 as your floor.

**V-04 · Three weights max on screen at once.**
If a card already shows 800 + 700 + 500, do not introduce 600. Renaming is
cheaper than visual noise. Count the rendered weights, not the designed ones.

**V-05 · Size ladder — 36 / 22 / 18 / 15 / 13 / 11 only.**
These are the six tokens from `--koru-text-2xl` down to `--koru-text-xs`. No
14 px, no 16 px, no 20 px, no 24 px. Intermediate sizes break the rhythm.

**V-06 · Four sizes max per card.**
A weather card uses 36 (temp) + 18 (city) + 13 (forecast rows) + 11 (meta).
That is four. Adding a 22 px subtitle would make it five and feel cluttered.
Pick the four that serve the 1-3-1 hero, drop the rest.

**V-07 · Letter-spacing is a function of size, not taste.**
- 36 px → `-0.025em` (tight, so big numerals feel architectural)
- 22 px → `-0.01em`
- 18 px → `-0.005em`
- 15 px → `0`
- 13 px → `+0.005em`
- 11 px UPPERCASE → `+0.08em` (tracked labels feel like labels, not shouts)

**V-08 · Line-height is also a function of size.**
- 36 px display → `1.0` (single line, no descender air)
- 22 px hero → `1.1`
- 18 px title → `1.2`
- 15 px body → `1.45`
- 13 px detail → `1.55` (multi-line meta needs air)
- 11 px label → `1.0` (single-line pills)

**V-09 · The hero gets the only 36 px on the card.**
If you have two 36 px numbers (e.g. home score + away score in
`live_match`), demote one: render the leading team at 36 and the trailing at
28, OR put both at 28 and let color + position carry the hierarchy.

**V-10 · Headings use Bricolage, body uses Plus Jakarta.**
Bricolage Grotesque (`--font-heading`) for 36/22/18. Plus Jakarta Sans
(`--font-sans`) for 15/13/11. Never mix inside a single text block, and never
use Bricolage below 18 px — its character collapses at small sizes.

**V-11 · Numbers tabular-align.**
Any numeric value that updates, compares, or sits in a column uses
`font-variant-numeric: tabular-nums`. Scores, prices, percentages, timestamps
with seconds. Without it, a 1→2 change makes the column "jump" 2 px and feels
cheap.

**V-12 · The hero is the only element that may use color.**
On a `#f6f3fe` card the hero number may take `#8363f9` (or its semantic
accent). Every other element stays in the ink ladder: bark / earth / stone.
Color is a hierarchy tool, not decoration.

**V-13 · Hierarchy by value, then by size, then by weight — in that order.**
`#2e2650` (bark) reads stronger than `#6b5f8c` (earth) reads stronger than
`#a99bbe` (stone). Before you reach for `font-weight: 700`, ask if the same
text at 500 in bark already wins. Value contrast is invisible hierarchy — the
user feels it without noticing it.

**V-14 · Truncate at 2 lines, never 3.**
Descriptions clamp to 2 lines (`-webkit-line-clamp: 2`) and end with a
respected ellipsis. A 3-line clamp looks like a paragraph and breaks the
1-3-1 rhythm. If you need the third line, expand-on-tap.

**V-15 · The CTA is the last thing the eye finds.**
CTA sits at the bottom, separated by 14 px of breathing room, and is the only
element allowed to use a solid fill or a chevron. Everything above it must
read as "context" so the CTA reads as "action".

**V-16 · One icon size per role.**
- 20 px → hero icon (next to artValue or hero title)
- 16 px → tile/row icons
- 14 px → inline icons inside text (e.g. a clock before a time)
- 12 px → meta icons (source, external link)

Mixing 18 and 20 px in the same role is the most common hierarchy leak.

**V-17 · Pills use the same height as the text they accompany.**
A pill next to 13 px body text is 22 px tall (13 + 4 + 4 + 1 border). A pill
next to 11 px meta is 18 px tall. A 24 px pill next to 13 px text floats and
looks like a button that lost its label.

**V-18 · Visual order = DOM order = screen-reader order.**
Never `order: -1` a hero to the top while leaving it last in the DOM. Tab
order, reading order, and visual order must agree. If the hero must be
visually first, it is first in the markup.

**V-19 · Section dividers are 1 px of `--color-sand`, never thicker.**
A 1 px `#e4ddf7` line with 16 px margin top and bottom separates sections.
Thicker dividers (2 px, 3 px) read as borders-as-decoration and cheapen the
card. If two sections need more separation, add whitespace, not ink.

**V-20 · 24 px is the minimum section gap.**
Between the header band and the metrics band, between metrics and the CTA
band — 24 px minimum. 16 px feels cramped, 32 px feels empty. 24 is the
number that says "these belong together but are not the same thing".

---

## 2. Color Contrast & Harmony (20)

Color is where "good" most visibly fails and Tier S most visibly wins. Koru
runs one violet (`#8363f9`) plus three semantic accents, on a cream canvas.
Anything outside that contract is noise.

**C-01 · Primary text is always `#2e2650` on `#f6f3fe`.**
Bark on cream. Contrast ratio **12.70:1 — AAA**. This is the only pair used
for titles, hero numerals, and any text the user must read to understand the
card. Never `#301c70` (too blue), never `#1a1530` (too black).

**C-02 · Secondary text is `#6b5f8c` (earth), descriptions only.**
**5.27:1 — AA** (not AAA). Use it for the one-or-two-line description under a
title. Never for the title itself, never for a number the user needs to
compare.

**C-03 · Tertiary text `#a99bbe` (stone) FAILS WCAG — do not use for text.**
Measured at **2.36:1 on cream — below even AA-large (3:1)**. This is the
single most common contrast sin in the current system. Stone may be used for
*decorative* non-text (divider tints, skeleton shimmer, icon strokes at
≥3 px) but **never for text the user reads**. For meta/timestamps, either:
- drop to earth `#6b5f8c` (5.27:1, AA) at 11 px uppercase — readable, or
- introduce a new `--koru-meta: #7566a0` token (measured **4.60:1, AA**) as
  the readable-but-soft meta shade, reserving stone for decoration only.

**C-04 · Accent `#8363f9` on `#f6f3fe` is 3.75:1 — AA-large only, NOT AA.**
This corrects a widely-repeated error in the brief (it claimed 4.5:1). At
3.75:1, `#8363f9` passes AA only for **large text** (≥18 px regular or
≥14 px bold) and for non-text (icon strokes ≥3 px, borders, indicators). It
is **illegal for body text under 18 px**. For accent *text* below 18 px, use:
- `#523a9e` (`--koru-purple-deep`) — **7.80:1, AAA** (preferred)
- `#382b8c` (`--koru-purple-dark`) — **10.13:1, AAA** (maximum)

**C-05 · Accent backgrounds are always `rgba(131,99,249,0.08–0.12)`.**
Never solid `#8363f9` as a fill behind text — it is too aggressive AND white
on `#8363f9` measures only **4.10:1 (fails AA)**. The soft tint
`rgba(131,99,249,0.10)` behind `#2e2650` text reads as "highlighted" without
screaming, and bark-on-tint measures **10.7:1, AAA**. If a solid accent fill
is unavoidable (CTA button), use `#523a9e` (white-on-fill = **8.54:1, AAA**),
never raw `#8363f9`.

**C-06 · Semantic accents are meaning-locked — and each has a *text-safe*
variant.**
- `#2d6a4f` emerald → success, positive delta, verified, "saved". **5.83:1,
  AA** — safe as text at any size.
- `#f59e0b` amber → warning, "new", attention, neutral delta. **1.96:1 on
  cream — FAIL**. Amber is icon/fill/border only; for amber *text* use
  `#b45309` (**4.58:1, AA**) or `#92400e` (**6.47:1, AA**).
- `#ef4444` rose → error, urgent, negative delta, live. **3.44:1 — AA-large
  only**. For rose *text* under 18 px (e.g. an "URGENTE" label) use
  `#c81e1e` (**5.24:1, AA**) or `#be123c` (**5.74:1, AA**).
- `#3b82f6` blue → informational link, external source.

Never use emerald for "live score" or amber for "error". Once a user learns
the language, breaking it is a lie.

**C-07 · Semantic accents appear as text or 0.10 fill, never solid.**
A "URGENTE" pill is `rgba(239,68,68,0.10)` bg + `#ef4444` text + 1 px
`rgba(239,68,68,0.25)` border. A solid red pill is a fire alarm, not a card
detail.

**C-08 · Shadow color is `rgba(18,10,50,0.08–0.18)` for elevation.**
Never `rgba(0,0,0,X)`. Black shadows read gray-on-lavender and muddy the
canvas. The 18-10-50 hue sits inside the bark family and reads as "the card
lifts off the cream" rather than "the card is dirty".

**C-09 · Accent glow shadow is `rgba(131,99,249,0.12–0.32)`.**
Reserved for the hero element of a card and the active CTA. The hero numeral
gets `0 8px 24px rgba(131,99,249,0.18)` — the same as `--koru-shadow-lg`. Do
not spread glow to every tile; it stops meaning "this is the focus".

**C-10 · The three-tier shadow ladder.**
- `--koru-shadow-sm`: `0 2px 8px rgba(0,0,0,0.06)` — but recolor to
  `rgba(18,10,50,0.06)` per C-08. Used on tiles, rows, pills at rest.
- `--koru-shadow-md`: `0 4px 16px rgba(131,99,249,0.12)` — default card.
- `--koru-shadow-lg`: `0 8px 24px rgba(131,99,249,0.18)` — card on hover,
  active sheet, hero numeral.

**C-11 · Borders come in two flavors only.**
- Soft: `1px solid rgba(131,99,249,0.12–0.25)` — feels like light, not a
  cage. Default for cards and tiles.
- Solid: `1px solid #e4ddf7` (`--color-sand`) — for dividers and inputs.
Never `#00000010`, never `#cccccc`. Those are generic-web tell.

**C-12 · Hover darkens accent by exactly 8%.**
`#8363f9` → `#7549f7` (mix toward black 8%). Or, equivalently and cheaper,
bump the background tint from `rgba(131,99,249,0.08)` to `0.14`. Pick one
strategy per component and never mix.

**C-13 · Active darkens by 12% AND scales.**
Active state = hover color × 0.88 lightness + `scale(0.97–0.98)`. The scale
is what makes it feel "pressed"; the darkening is what makes it feel
"engaged". Either alone reads as half a state.

**C-14 · Disabled is `#a99bbe` text on `rgba(46,38,80,0.04)` fill.**
Plus `cursor: not-allowed` and `pointer-events: none`. A disabled button must
look dead, not shy. Never just lower opacity to 0.5 — that reads as
"loading".

**C-15 · Focus ring is `3px solid rgba(131,99,249,0.5)` with `2px` offset.**
The offset is non-negotiable: a ring flush to the element looks like a
border. The 2 px gap is what makes it read as "focus" to a sighted user and
announces itself cleanly to a keyboard user.

**C-16 · Selected/active tab is ink + underline, not a filled pill.**
Active tab = `#2e2650` text + 700 weight + a 2 px `#8363f9` underline that
grows from 0 to 100 % width on activation (see H-08). Inactive tabs = `#6b5f8c`
500. Filled-pill tabs belong to a different design language.

**C-17 · Deltas (up/down) pair color with an arrow.**
Positive delta = emerald text + `▲` glyph. Negative = rose + `▼`. Never color
alone — colorblind users see "delta" only. The arrow is the meaning; the
color is the reinforcement.

**C-18 · The cream canvas is `#f6f3fe`, cards are `#ffffff`.**
Two surfaces, never three. A card-on-card (e.g. a tile inside a card) is
`#ffffff` with a 1 px soft border, NOT a third surface color. If you need a
third tone, use `rgba(131,99,249,0.04)` over the card — a tint, not a new
color.

**C-19 · Images are color-corrected to the palette.**
Any photo (recipe, restaurant, movie poster) gets `filter: saturate(0.92)
contrast(1.03)` and a subtle `rgba(46,38,80,0.04)` overlay at 4 % to pull it
into the lavender world. Raw stock photos look like they belong to another
app.

**C-20 · Dark mode is NOT inverted cream.**
Dark mode uses `#14102a` canvas (already in `.koru-chat-shell`) + `#f6f3fe`
text + `#8363f9` accent unchanged. Earth becomes `#a99bbe`, stone becomes
`#6b5f8c`. Accents stay the same hue — only the canvas and ink swap. The
semantic accents (emerald/amber/rose) lighten by 12 % so they read against
the dark canvas.

---

## 3. Spacing & Alignment Microdetails (15)

Spacing is the difference between a card that feels designed and a card that
feels assembled. Koru uses a 4 px base — every value below is a multiple of 4.

**S-01 · Card padding is 20–24 px.**
20 px for dense cards (live_match, stats), 24 px for editorial cards
(recipe, movie_review). Never 16 (cramped), never 28 (lost). Pick once per
card type and never mix inside the card.

**S-02 · Internal vertical rhythm is 12 / 10 / 14.**
- 12 px between the header band (title + description) and the metrics band
- 10 px between sibling metrics inside the metrics band
- 14 px between the metrics band and the CTA band
This asymmetric rhythm (12-10-14) is what makes the card feel composed rather
than gridded.

**S-03 · Tile padding is 12 px (tight) or 14 px (comfortable).**
12 px for stat tiles (3-up grids in `live_match`), 14 px for content tiles
(recipe steps). The choice is made at the card level and applied uniformly.

**S-04 · Row padding is 12 px (compact) or 14 px (spacious).**
Same rule as tiles. Compact for lists of 5+ rows, spacious for lists of 3 or
fewer. A 3-row list at 12 px looks starved; a 6-row list at 14 px looks
bloated.

**S-05 · Icons align to the text baseline, not the vertical center.**
A 16 px icon next to 15 px text is positioned so its optical center sits on
the x-height of the text, not the cap height. In practice: `margin-top: 2px`
on the icon for 15 px text, `1px` for 13 px, `0` for 11 px. Center-aligned
icons float and look detached.

**S-06 · Tile grids center-align everything.**
In a 3-up stat tile grid: icon center, value center, label center. This is
the ONE place center alignment is correct, because the grid is a decorative
pattern and center alignment makes the rhythm visible.

**S-07 · Row icons align to the start (top), not center.**
In a list row with a 2-line label (title + subtitle), the icon aligns to the
first line's optical center, not the row's vertical center. Center-aligned
icons in multi-line rows look like they're hovering.

**S-08 · Sticky elements keep 16 px from screen edges.**
Sticky headers, sticky footers, sticky CTAs — all need 16 px of horizontal
breathing room from the viewport edge. Edge-to-edge sticky elements feel like
browser chrome, not app UI.

**S-09 · Safe-area-inset-bottom on every sticky footer.**
`padding-bottom: max(16px, env(safe-area-inset-bottom))`. Without this, the
CTA on an iPhone with a home bar sits under the swipe indicator and is
untappable.

**S-10 · Negative margins are forbidden.**
They cause horizontal overflow on mobile Safari 100 % of the time. If you
need a full-bleed image inside a padded card, use a wrapper with negative
padding compensation (`padding: 0 24px` on parent, child at `margin: 0 -24px`
is the bug — instead, restructure so the image is a sibling of the padded
inner content).

**S-11 · The 8 px grid for horizontal gaps.**
Horizontal gaps between tiles, between icon and text, between pill and label:
always 8 px or a multiple. A 6 px or 10 px gap breaks the grid the eye
subconsciously tracks.

**S-12 · Pill internal padding is 4 px vertical / 8 px horizontal.**
A 11 px label pill is `padding: 4px 8px` → 19 px tall total. A 13 px label
pill is `padding: 4px 10px` → 21 px tall. The 4 px vertical is sacred — it's
what makes a pill feel like a pill and not a tag.

**S-13 · CTA full-width on mobile, auto on desktop.**
Below 480 px the CTA is `width: 100%` with 14 px tall padding. Above 480 px
it's `width: auto` with `min-width: 120px`. A full-width CTA on desktop
looks like a banner ad; an auto-width CTA on mobile looks like an afterthought.

**S-14 · List row separators are inset 56 px from the left.**
The separator between list rows starts 56 px from the left edge (to clear the
icon + gap), NOT at the card edge. Full-width separators make a list feel
like a table; inset separators make it feel like a list.

**S-15 · The card's outer radius is 20 px; inner elements step down.**
Card = 20 px (`--koru-radius-xl`). Tiles and pills inside = 12 px
(`--koru-radius-md`). Buttons = 12 px. Inputs = 8 px (`--koru-radius-sm`).
The step-down (20 → 12 → 8) is what makes nested elements feel nested rather
than colliding.

---

## 4. Entrance Microdetails (15 animations)

Entrance is the first 400 ms of a card's life. Get it wrong and the card
feels like it popped into existence; get it right and it feels like it
*arrived*. All timings assume `prefers-reduced-motion: reduce` collapses them
to `0.01s` (see A-07).

**E-01 · Card-in (the default arrival).**
`opacity: 0 → 1` + `translateY(12px → 0)` + `scale(0.97 → 1)`, `0.35s`
spring `(stiffness 280, damping 24)`. Siblings stagger by **70 ms** each.
After the 4th sibling, cap the stagger so a 10-card list doesn't take 700 ms
to fully arrive.

**E-02 · Sheet-up (bottom sheet, modal, detail screen).**
`opacity: 0 → 1` + `translateY(100% → 0)`, `0.32s` spring
`(stiffness 320, damping 30)`. Backdrop fades `0 → 1` over `0.18s` starting
**60 ms before** the sheet moves, so the world dims first and the sheet
rises into a prepared stage.

**E-03 · Section-stagger (the detail screen's bands reveal in sequence).**
Each section: `opacity 0 → 1` + `translateY(20px → 0)`, `0.5s`
`cubic-bezier(0.22, 1, 0.36, 1)` (out-expo-ish). Delay = `i × 60 ms`. Header
band first, then hero, then metrics, then CTA — the eye is led downward.

**E-04 · Count-up (the hero numeral).**
`artValue` animates `0 → target` over `600 ms` with `cubic-bezier(0.22, 1,
0.36, 1)`. Starts **120 ms after** card-in so the card has settled. For
values > 1000, count by steps of 10–50 to avoid frame-jitter. Format with
`tabular-nums` so the column doesn't twitch (see V-11).

**E-05 · Icon-pop (hero icon arrives with personality).**
Icon `scale(0.8 → 1)` + `rotate(-5deg → 0)`, `0.4s` spring
`(stiffness 300, damping 18)`. Delayed **100 ms after** card-in. The slight
counter-rotation is the difference between "icon appeared" and "icon landed".

**E-06 · Glow-breathe (the hero numeral's halo).**
A `radial-gradient` behind the hero numeral pulses `opacity 0.2 → 0.4 → 0.2`
over `4s` `ease-in-out` `infinite`. This is the *only* perpetual animation
allowed on a non-live card. It says "this is alive" without saying "look at
me".

**E-07 · Bar-pop (live_match score bars, comparison bars).**
`scaleX(0 → 1)` with `transform-origin: left`, `0.5s`
`cubic-bezier(0.22, 1, 0.36, 1)`. Home bar pops first, away bar **50 ms**
later — the asymmetry reads as "home is the subject". Bars never animate on
width (causes layout reflow).

**E-08 · CTA-shine (a light sweep across the primary CTA every 4 s).**
A `linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.4) 50%,
transparent 70%)` sweeps across the CTA over `0.8s`, repeating every `4s`.
Stops after the user has interacted with the CTA once — it's an invitation,
not a disco.

**E-09 · Image-fade-in (recipe, restaurant, movie poster).**
`opacity 0 → 1` + `blur(8px → 0)`, `0.6s` `ease-out`. The blur unsharpens
progressively so a low-res placeholder loads first and the full image "develops"
like a Polaroid. Pair with a `rgba(131,99,249,0.06)` placeholder tint so the
slot looks intentional before the image arrives.

**E-10 · Skeleton-shimmer (loading state).**
`linear-gradient(90deg, rgba(131,99,249,0.06) 0%, rgba(131,99,249,0.14) 50%,
rgba(131,99,249,0.06) 100%)` sweeps left-to-right over `1.5s` `linear`
`infinite`. Skeleton shapes match the final layout's shape (same radii, same
aspect) so there is no layout shift when content swaps in.

**E-11 · Live-dot (the "EN VIVO" pulsing dot).**
A 6 px `#ef4444` dot: `opacity 1 → 0.5` + `scale(1 → 1.3)` over `1.5s`
`ease-in-out` `infinite`. Paired with a static `#ef4444` ring at 30 %
opacity for contrast. Only ever appears on `live_match` and "recording" states.

**E-12 · Save-rise (the toast that confirms an action).**
`translateY(100% → 0)` + `opacity 0 → 1`, `0.35s` spring
`(stiffness 320, damping 26)`. Auto-dismisses after `6s` with a 2 px progress
bar at the bottom shrinking `100% → 0%` over those 6 s, so the user knows
when it'll leave.

**E-13 · Star-pop (rating stars, on render and on tap).**
`scale(0.9 ↔ 1.1)` + `rotate(-3deg ↔ 3deg)` over `2s` `ease-in-out`
`infinite`, staggered by `0.16s` per star so they shimmer like a wave. Only
the filled stars animate; empty stars are static.

**E-14 · Ring-pulse (the "listening" or "recording" halo).**
A ring `scale(1 → 1.6)` + `opacity(0.6 → 0)` over `2.4s` `ease-out`
`infinite`. Two rings offset by `1.2s` so one is always mid-rise. Already
exists in Koru as `koru-listen` — reuse it, don't reinvent.

**E-15 · Typing-bounce (the three dots in Koru's "thinking" state).**
Three 6 px dots, each `translateY(0 → -6px → 0)` over `1.4s` `ease-in-out`
`infinite`, staggered `-0.16s` between dots. Already exists in Koru as
`koru-wave` (vertical bars) — for dots, adapt the same easing. The bounce
height is exactly 6 px: 4 is invisible, 8 is comedic.

---

## 5. Hover Microdetails (10 interactions)

Hover is the conversation between the cursor and the card. On touch devices
these collapse to `:active` (see section 6). None of these fire on
`prefers-reduced-motion: reduce` (see A-07).

**H-01 · Card-lift.**
`translateY(-2px)` + shadow alpha `0.12 → 0.20`, `0.15s`
`cubic-bezier(0.4, 0, 0.2, 1)`. Two pixels is the sweet spot — one is
invisible, three feels jumpy. The shadow grows in tandem so the lift reads
as physical, not translational.

**H-02 · Tile-lift.**
`translateY(-1px)` + shadow alpha `0.05 → 0.10`, `0.18s` smooth. Half the
card's lift because a tile is half the visual weight. Tiles inside a card
should never lift more than the card itself.

**H-03 · Icon-fill.**
Material Symbols `FILL 0 → 1` + `wght 400 → 600`, `0.2s` `ease-out`. The
fill is the affordance — it says "this is the thing you can tap". Reserved
for tappable icons (bookmark, share, favorite). Non-interactive icons do
not fill on hover; that would be a lie.

**H-04 · Underline-grow.**
A 2 px `#8363f9` underline grows `width 0 → 100%` from the left, `0.25s`
`cubic-bezier(0.22, 1, 0.36, 1)`. Used on tappable text links and active
tabs. The left-origin is non-negotiable — right-origin or center-origin
reads as decoration.

**H-05 · Cursor-pointer only on tappable elements.**
`cursor: pointer` on `<a>`, `<button>`, and any `role="button"` div. On
everything else, default cursor. A `pointer` cursor on non-tappable text is
a broken promise and erodes trust in every other cursor on the page.

**H-06 · Background-shift.**
`background: rgba(131,99,249,0.08) → rgba(131,99,249,0.14)`, `0.18s` smooth.
Used on rows, tiles, and pill-buttons at rest. The 0.06 alpha delta is just
enough to register as "this is hovered" without flashing.

**H-07 · Image-zoom.**
`scale(1 → 1.05)` with `overflow: hidden` on the parent, `0.4s`
`cubic-bezier(0.4, 0, 0.2, 1)`. Five percent is the maximum — anything more
and the image visibly crops and feels broken. The parent `overflow: hidden`
is mandatory or the zoom bleeds into neighbors.

**H-08 · Chevron-rotate.**
`rotate(0 → 90deg)`, `0.2s` spring `(stiffness 300, damping 20)`. For
expandable sections and disclosure triangles. The rotation pairs with a
height animation on the expanded content — never rotate the chevron without
revealing content, that's a tease.

**H-09 · Spotlight-follow.**
A `radial-gradient` at `var(--mx, 50%) var(--my, 50%)` follows the mouse
inside the card, `opacity 0 → 0.6` on hover, `0.3s` fade. The gradient is
`rgba(131,99,249,0.10)` → transparent. Updates via `onMouseMove` setting
CSS custom properties (no React re-render). Disabled on touch.

**H-10 · Magnetic-button.**
The primary CTA translates up to `4px` toward the cursor when the cursor is
within `40px` of the button's center, `0.2s` spring
`(stiffness 400, damping 28)`. Beyond 40 px the button is at rest. The
magnetism is subtle — if the user notices it consciously, it's too strong.

---

## 6. Tap Microdetails (8 interactions)

Tap is the moment of truth — the card promised something, now it must
deliver. These 8 microdetails make the tap feel *acknowledged* the instant it
happens, before the result even loads.

**T-01 · Ripple.**
A circular `<span>` spawns at the tap point, `scale(0 → 4)` +
`opacity(0.3 → 0)`, `0.4s` spring `(stiffness 400, damping 30)`. Color is
`rgba(131,99,249,0.3)` on light, `rgba(255,255,255,0.3)` on dark. Multiple
ripples can stack; each removes itself after the animation ends.

**T-02 · Scale-down.**
`scale(1 → 0.97)`, `0.1s` `ease-out`, then `scale(0.97 → 1)` on release over
`0.15s` spring. The 0.97 is the universal "pressed" ratio — Apple, Google,
and Stripe all converge on it because 0.95 feels broken and 0.98 feels
imagined.

**T-03 · Haptic.**
`navigator.vibrate(10)` on tap, `navigator.vibrate(15)` on long-press /
destructive. Android only (iOS Safari ignores it silently). Wrap in
`if ('vibrate' in navigator)` so desktop never errors. Never vibrate more
than 20 ms — it crosses from "feedback" to "annoyance".

**T-04 · Color-flash.**
Background `rgba(131,99,249,0.08) → rgba(131,99,249,0.20) →
rgba(131,99,249,0.08)`, `0.3s` total. Pairs with T-02 to make the tap land
twice — once physically (scale), once chromatically (flash). Used on rows
and tiles that don't navigate, just toggle.

**T-05 · Bookmark-fill.**
`FILL 0 → 1` + `scale(1 → 1.2 → 1)`, `0.3s` spring
`(stiffness 400, damping 15)`. The overshoot to 1.2 is what makes it feel
like the bookmark "snapped" into place. Pairs with a 10 ms haptic. If the
item is already saved, the reverse: `FILL 1 → 0` + `scale(1 → 0.9 → 1)`.

**T-06 · Save-toast.**
`translateY(100% → 0)` at the bottom of the viewport, `0.35s` spring
`(stiffness 320, damping 26)`. Auto-dismisses after `4s`. A 2 px progress
bar at the bottom shrinks `100% → 0%` over those 4 s. Includes an "Undo"
text button at the right — tappable for the full 4 s.

**T-07 · Success-check.**
An SVG `<path>` draws `stroke-dashoffset 100% → 0%` over `0.4s`
`cubic-bezier(0.22, 1, 0.36, 1)`. The path is 24 px, stroke 2.5 px,
`#2d6a4f` (emerald). Pairs with a 0.97 scale-down on the parent button so
the check "draws itself" as the button settles.

**T-08 · Error-shake.**
`translateX(0 → -4 → 4 → -2 → 2 → 0)`, `0.4s` total with steps at
`0ms, 80ms, 160ms, 240ms, 320ms, 400ms`. Pairs with a 1 px `#ef4444` border
that fades in over `0.1s` and out over `0.6s`. Reserved for validation
failures (search with no results, offline tap). Never shake on success.

---

## 7. State Indicators (10 patterns)

A card without a state indicator is a card that lies about what it is. These
10 patterns make the card's status legible at a glance, before the user
reads a single word.

**ST-01 · Live.**
A 6 px pulsing `#ef4444` dot (E-11) + an "EN VIVO" pill: 11 px uppercase,
`+0.08em`, `rgba(239,68,68,0.10)` bg, `#c81e1e` text (**5.24:1, AA** — raw
`#ef4444` is only 3.44:1 and fails for 11 px text), 1 px
`rgba(239,68,68,0.25)` border. The pill is always at the top-right of the
card, never inline with the title.

**ST-02 · New.**
An amber "NUEVO" pill (same construction as ST-01) with `rgba(245,158,11,0.12)`
bg and `#b45309` text (**4.58:1, AA** — raw `#f59e0b` is 1.96:1 and unusable as
text). Fades out (`opacity 1 → 0` over `0.4s`) **3 s after** the card enters
the viewport. Once faded, the card is no longer "new" for that user (persist
the dismissal in `localStorage`). A pill that never dismisses is just noise.

**ST-03 · Verified.**
A 14 px emerald circle with a white check, positioned at the trailing edge
of a name (restaurant, source, person). Tooltip on hover: "Verificado". The
circle is `#2d6a4f` fill, the check is `#ffffff` 1.5 px stroke. Never use
the verified badge decoratively — it means a human checked it.

**ST-04 · Urgent.**
A rose "URGENTE" pill built like ST-01 (`#c81e1e` text, AA-safe) with a
`1.4s` pulse on the entire pill (`box-shadow 0 0 0 0 rgba(239,68,68,0.4) →
0 0 0 6px rgba(239,68,68,0)`). Used for deadlines, expiring items, overdue
tasks. Maximum ONE urgent pill per screen — more than one and urgent stops
meaning urgent.

**ST-05 · Loading.**
Two interchangeable patterns, chosen by expected duration:
- **< 1.5 s expected:** three 6 px dots bouncing (E-15) inline where the
  content will appear.
- **≥ 1.5 s expected:** a skeleton-shimmer (E-10) matching the final layout's
  shape.
Never mix in the same card, never use a spinner (spinners are 2010 and feel
like the app is struggling).

**ST-06 · Saved.**
A filled bookmark icon (`FILL 1`, `#8363f9`) at the top-right. Tapping it
triggers T-05 in reverse and removes the fill over `0.2s`. The fill color is
the accent, not emerald — emerald is reserved for "verified/success" and a
saved item is not a success, it's a state.

**ST-07 · Error.**
A 1 px `#ef4444` border on the card + an error-shake (T-08) on first
appearance + a retry button: `rgba(239,68,68,0.10)` bg, `#ef4444` text,
"Reintentar" label with a refresh icon. The retry button is the ONLY rose
element that is tappable. Error copy is 13 px earth, never red — red text
for body is alarmist.

**ST-08 · Empty.**
A `1px dashed rgba(131,99,249,0.25)` border + a 32 px outline icon +
one-line helpful copy ("No tienes elementos guardados todavía") + a
secondary CTA ("Guardar uno"). The dashed border is the empty-state
signature — solid borders read as "broken", dashed reads as "waiting for
content".

**ST-09 · Syncing.**
A 14 px rotating icon (`rotate 0 → 360deg` over `0.8s linear infinite`) +
"Sincronizando…" text in 13 px earth. The icon rotates clockwise only;
counter-clockwise reads as "undo". Stops rotating the instant sync
completes and snaps to the final state — do not fade.

**ST-10 · Offline.**
The entire card desaturated (`filter: saturate(0.4) brightness(0.95)`) + a
sticky banner at the bottom of the card: "Sin conexión" in 13 px earth, with
a 14 px cloud-off icon. Tappable elements inside the card get
`pointer-events: none` and `opacity: 0.5`. The banner uses
`rgba(131,99,249,0.08)` bg so it reads as informational, not error.

---

## 8. Accessibility Microdetails (12 rules)

Tier S is not Tier S if it excludes anyone. These 12 rules are non-negotiable
and override every aesthetic preference above when they conflict.

**A-01 · Touch targets are minimum 44 × 44 px.**
Every tappable element — icon buttons, pills, list rows, CTA — has a 44 × 44
px hit area. If the visible element is smaller (a 20 px icon), pad the
tappable parent. Use `min-height: 44px; min-width: 44px` on the interactive
element, not invisible padding spacers.

**A-02 · Focus rings are always visible, never removed.**
`outline: 3px solid rgba(131,99,249,0.5); outline-offset: 2px` on
`:focus-visible`. Never `outline: none` without a replacement. The
`:focus-visible` (not `:focus`) selector means mouse users don't see the ring
on click, but keyboard users always do.

**A-03 · `aria-label` on every icon-only button.**
`<button aria-label="Guardar"><BookmarkIcon/></button>`. The label is in the
user's language (es/en via `i18n.ts`) and describes the *action*, not the
icon: "Guardar" not "Ícono de marcador". For toggle buttons, append the
state: `aria-label="Guardar, activado"`.

**A-04 · `role="button"` + `tabIndex={0}` on tappable divs.**
If you can't use a `<button>` (rare — almost always you can), the div needs
both. Pure `<div onClick>` is invisible to keyboards and screen readers.

**A-05 · Keyboard: Enter and Space both trigger tap.**
`onKeyDown` handler: if `e.key === 'Enter' || e.key === ' '`, call the tap
handler and `e.preventDefault()` (Space scrolls by default). This is why
using a real `<button>` is easier — it's free.

**A-06 · Escape closes any overlay.**
Bottom sheets, modals, detail screens, menus — all listen for `Escape` and
close. After closing, focus returns to the element that opened the overlay
(trap and restore focus). Without focus restoration, keyboard users are
stranded at the top of the page.

**A-07 · `prefers-reduced-motion: reduce` disables ALL infinite animations.**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
Entrance animations collapse to `0.01s` (effectively instant). The ONE
exception is the loading spinner (ST-09) and the live-dot (E-11), which
*must* move to communicate state — for those, slow to `2s` but never remove.
Count-up (E-04) jumps to the final value instantly.

**A-08 · Contrast: AA (4.5:1) minimum for body, AAA (7:1) for primary.**
- Body text (`#6b5f8c` on `#f6f3fe`): **5.27:1 — AA ✓**
- Primary text (`#2e2650` on `#f6f3fe`): **12.70:1 — AAA ✓**
- Accent text (`#8363f9` on `#f6f3fe`): **3.75:1 — AA-large only, illegal
  below 18 px**. Use `#523a9e` (7.80:1, AAA) for accent text.
- Meta text (`#a99bbe` on `#f6f3fe`): **2.36:1 — FAIL, do not use for text**.
  Use `#6b5f8c` (earth) or a new `#7566a0` meta token (4.60:1, AA).
- Amber text (`#f59e0b`): **1.96:1 — FAIL**. Use `#b45309` (4.58:1, AA).
- Rose text (`#ef4444`): **3.44:1 — AA-large only**. Use `#c81e1e` (5.24:1, AA).
Verify every new color pair with a contrast checker before shipping — the
ratio you "feel" is right is wrong ~40 % of the time.

**A-09 · `alt` text on all images.**
Every `<img>` has an `alt` attribute. Decorative images (pure ornament) use
`alt=""` (empty, not omitted). Informative images use descriptive alt:
`alt="Bowl de ramen tonkotsu con huevo marinado y cebollín"`, not
`alt="comida"`. The alt is in the user's language.

**A-10 · `aria-live="polite"` for toasts, `aria-live="assertive"` for errors.**
Save-toasts (T-06) announce politely — they don't interrupt. Error toasts
(ST-07) announce assertively — they do. Never use `assertive` for success
messages; a screen reader interrupting the user to say "Guardado" is hostile.

**A-11 · `aria-expanded` on every expandable section.**
`<button aria-expanded={isOpen} aria-controls="section-id">`. The controlled
section has `id="section-id"`. Screen reader users navigate by state; without
`aria-expanded`, they can't tell if tapping will reveal or hide content.

**A-12 · Visual order = DOM order = screen-reader order.**
Never use CSS `order`, `flex-direction: row-reverse`, or absolute positioning
to reorder content visually while leaving the DOM in a different order. If
the hero must be visually first, it is first in the markup. Screen reader
users hear the DOM order; sighted users see the visual order; they must
agree or the two users experience different products.

---

## The Tier S checklist

A card is Tier S when, and only when, all 110 microdetails above are
simultaneously true. Run this checklist on every card before merge:

- [ ] **Hierarchy (20):** one hero, three supports, one CTA, ≤3 weights, ≤4
      sizes, correct letter-spacing + line-height per size.
- [ ] **Color (20):** bark/earth/stone ladder used correctly, accent at
      0.08–0.12, semantic accents meaning-locked, shadows in the 18-10-50 /
      131-99-249 family.
- [ ] **Spacing (15):** 20–24 px card padding, 12-10-14 internal rhythm,
      baseline-aligned icons, safe-area-inset on stickies, no negative
      margins.
- [ ] **Entrance (15):** card-in spring + stagger, count-up on hero, glow-
      breathe on hero only, skeleton-shimmer matches layout.
- [ ] **Hover (10):** card-lift 2 px, tile-lift 1 px, icon-fill on
      tappable icons only, spotlight + magnetic on CTAs.
- [ ] **Tap (8):** ripple from tap point, 0.97 scale, 10 ms haptic,
      success-check or error-shake on completion.
- [ ] **States (10):** live/new/verified/urgent/loading/saved/error/empty/
      syncing/offline — each has its defined pattern, no improvisation.
- [ ] **Accessibility (12):** 44 px targets, focus-visible rings, aria-labels,
      keyboard parity, reduced-motion respected, contrast AA/AAA met.

If any box is unchecked, the card is a 6/10. Fix it, then ship.

---

## Token cross-reference (grounded in `src/style.css`)

| Manifesto token | CSS variable | Value |
|---|---|---|
| Accent | `--koru-purple` | `#8363f9` |
| Accent dark | `--koru-purple-dark` | `#523a9e` |
| Accent deep (text) | `--koru-purple-deep` | `#382b8c` |
| Accent soft bg | `--koru-purple-soft` | `rgba(131,99,249,0.12)` |
| Accent border | `--koru-purple-border` | `rgba(131,99,249,0.25)` |
| Primary text | `--color-bark` | `#2e2650` |
| Secondary text | `--color-earth` | `#6b5f8c` |
| Tertiary text | `--color-stone` | `#a99bbe` |
| Canvas | `--color-cream` | `#f6f3fe` |
| Card surface | `--color-card` | `#ffffff` |
| Solid border | `--color-sand` | `#e4ddf7` |
| Emerald | `--koru-emerald` | `#2d6a4f` |
| Amber | `--koru-amber` | `#f59e0b` |
| Rose | `--koru-rose` | `#ef4444` |
| Heading font | `--font-heading` | Bricolage Grotesque |
| Body font | `--font-sans` | Plus Jakarta Sans |
| Shadow sm | `--koru-shadow-sm` | `0 2px 8px rgba(0,0,0,0.06)` → recolor to `rgba(18,10,50,0.06)` |
| Shadow md | `--koru-shadow-md` | `0 4px 16px rgba(131,99,249,0.12)` |
| Shadow lg | `--koru-shadow-lg` | `0 8px 24px rgba(131,99,249,0.18)` |
| Radius xl | `--koru-radius-xl` | `20px` |
| Radius md | `--koru-radius-md` | `12px` |
| Radius sm | `--koru-radius-sm` | `8px` |
| Existing keyframes | `koru-breathe / koru-rise / koru-shimmer / koru-dot-pulse / koru-wave / koru-listen` | reuse, do not reinvent |

---

*End of manifesto. 110 microdetails, zero optional. The gap between 6/10 and
Tier S is exactly this list, executed, with nothing skipped.*
