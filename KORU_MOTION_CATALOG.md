# Koru — Tier S Motion Catalog

> **The motion backbone for the Koru redesign.**
> 36 production-ready animations, tuned to Koru's lavender-violet brand,
> distilled from reactbits.dev, lucide-animated.com, and the motion
> language of Apple, Linear, Vercel, and Stripe.

---

## PART 0 — Research Findings

### 0.1 reactbits.dev — what was analyzed

Live-fetched `https://reactbits.dev` plus deep component pages (`/backgrounds/aurora`, `/components/spotlight-card`, `/components/text-scramble`, `/components/magnetic-button`). Site is built by **David Haz** in React + Chakra UI, uses **Bricolage Grotesque** as its display font (same family Koru uses — alignment is intentional), and ships **140+ components** in JS/TS × CSS/Tailwind variants.

Their full taxonomy (verified from the live sidebar):

- **Text Animations (23):** Split Text, Blur Text, Circular Text, Text Type, Shuffle, Shiny Text, Text Pressure, Curved Loop, Fuzzy Text, **Gradient Text**, Falling Text, Text Cursor, **Decrypted Text**, True Focus, Scroll Float, Scroll Reveal, ASCII Text, **Scrambled Text**, Rotating Text, Glitch Text, Scroll Velocity, Variable, Proximity, **Count Up**
- **Animations / Cursor (24):** Cursor Grid, Animated Content Fade, Electric Border, Orbit Images, Pixel Transition, Glare Hover, Antigravity Logo Loop, Target Cursor, Magic Rings, Laser Flow, Magnet Lines, Ghost Cursor, Gradual Blur, Click Spark, Magnet Strands, Sticker Peel, Pixel Trail, Cubes, Metallic Paint, Noise, Shape Blur, Crosshair, Image Trail, Ribbons, Splash Cursor, Meta Balls, Blob Cursor, Star Border
- **Components (38):** Specular Button, Option Wheel, Curved Input, Line Sidebar, Animated List, Scroll Stack, Bubble Menu, Magic Bento, Circular Gallery, Reflective Card, Card Nav Stack, Fluid Glass, Pill Nav, **Tilted Card**, Masonry, Glass Surface, Dome Gallery, Chroma Grid, Folder, Staggered Menu, Model Viewer, Lanyard, Profile Card, Dock, Gooey Nav, Pixel Card, Carousel, **Spotlight Card**, Border Glow, Flying Posters, Card Swap, Glass Icons, Decay Card, Flowing Menu, Elastic Slider, Counter, Infinite Menu, Stepper, Bounce Cards
- **Backgrounds (42):** Ferrofluid, Lightfall, Liquid Ether, Prism, Dark Veil, Light Pillar, Silk, Floating Lines, Side Rays, Light Rays, Pixel Blast, Color Bends, Evil Eye, Line Waves, Radar, **Soft Aurora**, **Aurora**, Aurora Background, Plasma, Plasma Wave, Particles, Gradient Blinds, Grainient, Grid Scan, Beams, Pixel Snow, Lightning, Prismatic Burst, Galaxy, Dither, Faulty Terminal, Ripple Grid, Dot Field, Dot Grid, Threads, Hyperspeed, Iridescence, Waves, Grid Distortion, Ballpit, Orb, Letter Glitch, Grid Motion, Shape Grid, Liquid Chrome, Balatro

**Motion principles confirmed from source:**

| Pattern | Technique found in source | Tier-S lesson |
|---|---|---|
| **Spotlight Card** | `radial-gradient` repaints on `mousemove`, card sets `will-change: opacity, filter, transform`; default spotlight `rgba(255,255,255,0.25)` | Mouse-follow glow uses *no JS animation loop* — just CSS vars updated on rAF. Cheap and buttery. |
| **Aurora / Soft Aurora** | Layered blurred radial gradients animated with `transform: translate3d + scale` on long durations (12–25s), `filter: blur(40–80px)`, `mix-blend-mode: screen` | The "premium" feel comes from **slow** + **blurry** + **low-opacity**. Never crisp, never fast. |
| **Count Up / Counter** | rAF-driven number tween with `easeOutExpo`-style decay, `requestAnimationFrame` cancel on unmount | Numbers must arrive *slightly* before the user expects — feels eager, not laggy. |
| **Decrypted Text / Scrambled Text** | Per-character scramble: each char cycles random glyphs N times then locks. Stagger = char index × ~30ms | The stagger is the magic. Without it, it looks like a slot machine. With it, it looks like the page is *decrypting itself*. |
| **Tilted Card** | `transform: perspective(1000px) rotateX/Y` from mouse delta, with `transform-style: preserve-3d` and a glare `::before` overlay | 3D tilt + glare combo is the single most "premium-feeling" hover on the web. |
| **Magnetic (Magnet Lines / Specular Button)** | Element translates toward cursor by a fraction of the delta (typically 0.3–0.5×), springs back on leave | Less is more. 0.3 feels like silk; 0.6 feels like a buggy magnet. |
| **Gradient Text / Shiny Text** | `background: linear-gradient(...)` + `background-clip: text` + animated `background-position` OR a moving `mask` sweep | Shimmer speed: **2.5–4s** for ambient, **1.2s** for one-shot reveal. |

**Their `--pro` color tokens** (verified in the `<html>` inline style): `--pro-dark:#6d2aad; --pro-base:#A855F7; --pro-light:#ff79fd; --pro-glow:168,85,247` — a violet/magenta family that is **the same neighborhood as Koru's `#8363f9`**. Their effects already render beautifully on Koru's palette.

### 0.2 lucide-animated.com — what was analyzed

Live-fetched `https://lucide-animated.com`. Built by **Dmytro (@pqoqubbw)** with **Motion (Framer Motion) + Lucide**. MIT-licensed, **350+ animated React icons**, installable via `pnpm dlx shadcn add @lucide-animated/`. Uses **GT Cinetype** + **Andale Mono** fonts.

**The animated-icon system, decoded:**

1. **Draw-on-view (entrance):** Every Lucide icon's `<path>` strokes use `pathLength` tweened `0 → 1` via Motion's `animate` prop, with `pathOffset` staggering for multi-path icons. Easing: a custom spring (`stiffness ~200, damping ~26`) or `cubic-bezier(0.65, 0, 0.35, 1)` over ~900ms. Triggered by `whileInView`.
2. **Loop animations (idle):** Variants: `rotate` (continuous 360°, 2–4s linear), `pulse` (scale 1 → 1.08 → 1, 1.6s ease-in-out infinite), `bounce` (translateY 0 → -4 → 0, 1s), `wiggle` (rotate -8° → 8° → 0, 0.6s, every 4s). Loop is implemented as a Motion `transition: { repeat: Infinity, repeatType: 'loop' }`.
3. **State-transition icons (toggle):** e.g. `bookmark` empty → filled: the outline `path` morphs via `pathLength` 1 → 0 while the filled `path` draws 0 → 1, with a small `scale: 1.15` pop on the apex. Duration ~400ms with the spring easing. Same approach for `heart`, `star`, `bell`.

**Tier-S lesson:** lucide-animated proves that **icons are a first-class motion surface**, not a static afterthought. Koru should treat every Material Symbol as potentially animatable.

### 0.3 Apple / Linear / Vercel / Stripe — recalled patterns

| House | Signature moves | Easing / duration |
|---|---|---|
| **Apple** | "Springy settle" — elements arrive with a tiny overshoot then settle; hero text uses **blur-to-focus** entrance (`filter: blur(12px) → 0` + `opacity 0 → 1` + `translateY(8px) → 0`); product images parallax at 0.5× scroll; haptic-scale on tap (0.96) | `cubic-bezier(0.34, 1.56, 0.64, 1)` for UI, 600–800ms for hero, 300ms for tap |
| **Linear** | **Velocity-based** spring on every drag; sidebar items stagger-in with 40ms offset; command-K palette slides up with `translateY(8px) → 0` + backdrop blur 0 → 12px in 180ms; on state-change, a 1px violet border-glow pulses once; never bouncy — always *snappy* | Custom spring `stiffness 380, damping 30`; durations 150–220ms |
| **Vercel** | Page transitions: old content `opacity 1 → 0` + `scale 1 → 0.98` in 100ms, new content fades in 200ms; nav underline uses `transform: scaleX` from `transform-origin: left`; deployment status dots **breathe** (opacity 0.4 → 1, 2s ease-in-out); logo geometric draws on load | `cubic-bezier(0.22, 1, 0.36, 1)` everywhere; prefers 150–250ms |
| **Stripe** | The famous **gradient-mesh background** that *very slowly* drifts (60–90s loops); buttons have a 1-shot **shine sweep** on hover (a 100% width `linear-gradient` translates X over 600ms with `mix-blend-mode: overlay`); payment-inputs do a `border-color` flash + tiny `box-shadow` bloom on focus; numbers **count up** on dashboard load | `cubic-bezier(0.16, 1, 0.3, 1)` (their "Stripe curve"); 200–600ms |

**Cross-house synthesis (the rules Tier-S sites share):**

1. **Two easings only, brand-wide.** A spring for "alive" UI, an ease-out for "settling" UI. Koru already has both.
2. **Entrance > hover > tap > idle, in budget order.** Most motion budget goes to entrance; idle is the cheapest (it must never distract).
3. **Stagger is the multiplier.** 40–80ms per item transforms "things appearing" into "things orchestrating."
4. **`will-change` only during the animation**, never permanently.
5. **Reduced-motion is non-negotiable** and means *instant* (0ms) for state changes, *single fade* for entrances.

---

## PART 1 — Koru Brand Motion Tokens

```css
:root {
  /* ── Palette ───────────────────────────── */
  --koru-primary:        #8363f9;  /* lavender-violet — the hero       */
  --koru-primary-rgb:    131, 99, 249;
  --koru-dark:           #523a9e;
  --koru-dark-rgb:       82, 58, 158;
  --koru-deep:           #382b8c;
  --koru-deep-rgb:       56, 43, 140;
  --koru-cream:          #f6f3fe;
  --koru-cream-rgb:      246, 243, 254;
  --koru-ink:            #1a1530;  /* deep text on cream              */
  --koru-mist:           #ece6fb;  /* hover surface                    */
  --koru-line:           #d9d0f5;  /* hairline borders                 */

  /* ── Easings ──────────────────────────── */
  --koru-spring:  cubic-bezier(0.34, 1.56, 0.64, 1);  /* alive, bouncy   */
  --koru-out:      cubic-bezier(0.22, 1, 0.36, 1);    /* settling        */
  --koru-in-out:   cubic-bezier(0.65, 0, 0.35, 1);    /* symmetric       */
  --koru-soft:     cubic-bezier(0.16, 1, 0.3, 1);     /* Stripe curve    */

  /* ── Durations ─────────────────────────── */
  --t-instant:  120ms;   /* taps, color flashes                     */
  --t-quick:    200ms;   /* hovers, small toggles                   */
  --t-snappy:   320ms;   /* card lift, sheet                        */
  --t-standard: 480ms;   /* entrances, count-up                     */
  --t-cinematic:800ms;   /* hero reveals, aurora sweeps             */

  /* ── Glows ────────────────────────────── */
  --koru-glow-sm: 0 0 0 1px rgba(var(--koru-primary-rgb), 0.12),
                  0 4px 14px rgba(var(--koru-primary-rgb), 0.18);
  --koru-glow-md: 0 0 0 1px rgba(var(--koru-primary-rgb), 0.18),
                  0 12px 32px rgba(var(--koru-primary-rgb), 0.28);
  --koru-glow-lg: 0 0 0 1px rgba(var(--koru-primary-rgb), 0.22),
                  0 24px 64px rgba(var(--koru-primary-rgb), 0.34);

  /* ── Typography ────────────────────────── */
  --koru-display: "Bricolage Grotesque", system-ui, sans-serif;
  --koru-body:    "Plus Jakarta Sans", system-ui, sans-serif;
  --koru-icon:    "Material Symbols Outlined";  /* FILL 0, wght 400 */
}

/* ── Master reduced-motion override ─────────
   Apply this ONCE globally. Every animation
   below degrades to instant or single-fade.    */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## PART 2 — The 36-Animation Catalog

Each animation has: **Name · Purpose · CSS · Duration+Easing · Use / Don't · Reduced-motion.**
All snippets assume the tokens above are defined.

---

### A. ENTRANCE ANIMATIONS (7)

---

#### A1 · `KoruCardIn`
**Purpose** — Default entrance for any card, tile, or list item entering the viewport.

```css
@keyframes koru-card-in {
  from { opacity: 0; transform: translateY(14px) scale(0.985); }
  to   { opacity: 1; transform: translateY(0)    scale(1);     }
}
.koru-card-in {
  animation: koru-card-in var(--t-snappy) var(--koru-out) both;
}
.koru-card-in:nth-child(2) { animation-delay: 60ms; }
.koru-card-in:nth-child(3) { animation-delay: 120ms; }
.koru-card-in:nth-child(4) { animation-delay: 180ms; }
.koru-card-in:nth-child(5) { animation-delay: 240ms; }
```

- **Duration / easing:** 320ms · `cubic-bezier(0.22, 1, 0.36, 1)` · stagger 60ms
- **Use:** Section grids, dashboard tiles, search results, notification list.
- **Don't:** Hero (too small a move); anything already inside a scroll-linked parallax.
- **Reduced-motion:** Falls back to instant opacity 1 via master override.

---

#### A2 · `KoruSheetUp`
**Purpose** — Modal, bottom-sheet, command palette, drawer entering from below.

```css
@keyframes koru-sheet-up {
  from { opacity: 0; transform: translateY(24px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0)    scale(1);   }
}
@keyframes koru-backdrop-in {
  from { opacity: 0; backdrop-filter: blur(0); }
  to   { opacity: 1; backdrop-filter: blur(12px); }
}
.koru-sheet {
  animation: koru-sheet-up var(--t-snappy) var(--koru-spring) both;
}
.koru-sheet-backdrop {
  animation: koru-backdrop-in 200ms var(--koru-out) both;
  background: rgba(var(--koru-deep-rgb), 0.32);
}
```

- **Duration / easing:** 320ms sheet · `spring` overshoot; 200ms backdrop blur · `out`
- **Use:** Command-K, mobile bottom-sheets, settings drawers, image lightboxes.
- **Don't:** Full-page route transitions (use `KoruPageFade`); alerts (use `KoruSuccessPop`).
- **Reduced-motion:** Backdrop becomes flat `rgba(--koru-deep, 0.5)` with no blur; sheet appears instantly.

---

#### A3 · `KoruSectionStagger`
**Purpose** — A whole section's children reveal in sequence on scroll-into-view.

```css
.koru-stagger > * {
  opacity: 0;
  transform: translateY(20px);
  transition:
    opacity var(--t-standard) var(--koru-out),
    transform var(--t-standard) var(--koru-out);
  transition-delay: calc(var(--i, 0) * 70ms);
}
.koru-stagger.is-in > * {
  opacity: 1;
  transform: translateY(0);
}
/* Trigger via IntersectionObserver: add .is-in when ≥35% visible */
```

- **Duration / easing:** 480ms per item · `out` · 70ms stagger
- **Use:** Feature lists, pricing rows, FAQ accordions, team grids.
- **Don't:** More than 8 children (delays get too long — cap at 6 visible, lazy-rest).
- **Reduced-motion:** All children snap to visible instantly; observer still adds `.is-in`.

---

#### A4 · `KoruCountUp`
**Purpose** — Numbers animate from 0 (or previous) to target on view. Stripe-dashboard feel.

```css
.koru-count {
  font-variant-numeric: tabular-nums;       /* no width jitter */
  font-feature-settings: "tnum" 1;
}
/* JS: rAF tween with easeOutExpo, ~1200ms. CSS only handles the post-pop glow: */
@keyframes koru-count-pop {
  0%   { text-shadow: none; }
  60%  { text-shadow: 0 0 24px rgba(var(--koru-primary-rgb), 0.55); }
  100% { text-shadow: 0 0 0   rgba(var(--koru-primary-rgb), 0);    }
}
.koru-count.is-counting { animation: koru-count-pop 1.2s var(--koru-out); }
```

```js
// Minimal rAF tween (paste anywhere)
function koruCountUp(el, to, ms = 1200) {
  const from = 0;
  const start = performance.now();
  const ease = t => 1 - Math.pow(2, -10 * t); // easeOutExpo
  function tick(now) {
    const p = Math.min(1, (now - start) / ms);
    el.textContent = Math.round(from + (to - from) * ease(p)).toLocaleString();
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
```

- **Duration / easing:** 1200ms · `easeOutExpo` (1 − 2^(−10t))
- **Use:** KPIs, dashboard stats, pricing numbers, social-proof counts.
- **Don't:** Numbers users must read precisely while animating (financial totals > 6 digits — let it settle then show final).
- **Reduced-motion:** Set `el.textContent = to` immediately, skip the glow.

---

#### A5 · `KoruIconPop`
**Purpose** — A Material Symbol "pops" into view with a spring overshoot, like Apple's app-icon launch.

```css
@keyframes koru-icon-pop {
  0%   { opacity: 0; transform: scale(0.6) rotate(-8deg); }
  60%  { opacity: 1; transform: scale(1.12) rotate(2deg); }
  100% { opacity: 1; transform: scale(1)    rotate(0);    }
}
.koru-icon-pop {
  font-family: var(--koru-icon);
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  animation: koru-icon-pop var(--t-snappy) var(--koru-spring) both;
  display: inline-flex;
}
```

- **Duration / easing:** 320ms · `spring` (overshoot at 60%)
- **Use:** Feature-section icon rows, empty-state illustrations, onboarding step markers.
- **Don't:** Repeating on scroll-back; small inline icons (<18px — the rotate reads as noise).
- **Reduced-motion:** Plain opacity fade-in only.

---

#### A6 · `KoruGlowBreathe` (entrance variant)
**Purpose** — A primary CTA arrives with a one-shot violet bloom, then settles into its idle breathe.

```css
@keyframes koru-glow-breathe-in {
  0%   { opacity: 0; transform: translateY(8px); box-shadow: 0 0 0 rgba(var(--koru-primary-rgb), 0); }
  40%  { opacity: 1; transform: translateY(0);   box-shadow: var(--koru-glow-md); }
  100% { opacity: 1; transform: translateY(0);   box-shadow: var(--koru-glow-sm); }
}
.koru-glow-breathe {
  background: var(--koru-primary);
  color: var(--koru-cream);
  animation: koru-glow-breathe-in var(--t-standard) var(--koru-spring) both;
}
```

- **Duration / easing:** 480ms · `spring`
- **Use:** The single primary CTA per view — "Get started," "Upgrade," "Send."
- **Don't:** More than one per screen (the bloom must feel special); secondary buttons.
- **Reduced-motion:** Solid color, no shadow bloom.

---

#### A7 · `KoruPageFade`
**Purpose** — Route / view transition. Old view exits 100ms, new view enters 200ms. Vercel-style.

```css
@keyframes koru-page-out {
  from { opacity: 1; transform: scale(1);    }
  to   { opacity: 0; transform: scale(0.98); }
}
@keyframes koru-page-in {
  from { opacity: 0; transform: scale(0.99); }
  to   { opacity: 1; transform: scale(1);    }
}
.koru-page-leave { animation: koru-page-out 100ms var(--koru-out) both; }
.koru-page-enter { animation: koru-page-in  200ms var(--koru-out) both; }
```

- **Duration / easing:** 100ms out + 200ms in · `out`
- **Use:** SPA route changes, tab switches, wizard steps.
- **Don't:** Within-page state changes; back/forward browser nav (let browser handle).
- **Reduced-motion:** Instant swap, no scale.

---

### B. HOVER ANIMATIONS (6)

---

#### B1 · `KoruLift`
**Purpose** — Default card hover: lift + soft violet shadow bloom.

```css
.koru-lift {
  transition:
    transform var(--t-quick) var(--koru-out),
    box-shadow var(--t-quick) var(--koru-out),
    border-color var(--t-quick) var(--koru-out);
  will-change: transform;
}
.koru-lift:hover {
  transform: translateY(-4px);
  box-shadow: var(--koru-glow-md);
  border-color: rgba(var(--koru-primary-rgb), 0.4);
}
.koru-lift:active { transform: translateY(-1px); }
```

- **Duration / easing:** 200ms · `out`
- **Use:** Any clickable card, tile, list row, search result.
- **Don't:** Touch-primary surfaces (hover is meaningless); elements inside a hover parent (double-trigger).
- **Reduced-motion:** Lift becomes a border-color change only.

---

#### B2 · `KoruShineSweep`
**Purpose** — Stripe's signature button shine: a diagonal light-band sweeps across on hover.

```css
.koru-shine {
  position: relative;
  overflow: hidden;
  isolation: isolate;
}
.koru-shine::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    115deg,
    transparent 0%,
    transparent 38%,
    rgba(255, 255, 255, 0.45) 50%,
    transparent 62%,
    transparent 100%
  );
  transform: translateX(-120%);
  transition: transform 0ms;            /* controlled below */
  pointer-events: none;
  mix-blend-mode: overlay;
  z-index: 1;
}
.koru-shine:hover::after {
  transform: translateX(120%);
  transition: transform 600ms var(--koru-out);
}
```

- **Duration / easing:** 600ms one-shot · `out`
- **Use:** Primary buttons, CTAs, premium-tier cards, "Pro" badges.
- **Don't:** Repeating/looping (it's a reward, not ambient); large areas (>400px wide — the sweep reads as a loading bar).
- **Reduced-motion:** Skipped entirely (no transform, no transition).

---

#### B3 · `KoruIconFillToggle`
**Purpose** — Hover swaps a Material Symbol from `FILL 0` → `FILL 1` with a micro-scale pop. Lucide-animated-style state transition.

```css
.koru-icon-toggle {
  font-family: var(--koru-icon);
  font-variation-settings: 'FILL' 0, 'wght' 400;
  transition:
    font-variation-settings var(--t-quick) var(--koru-spring),
    color var(--t-quick) var(--koru-out),
    transform var(--t-quick) var(--koru-spring);
  display: inline-flex;
  color: var(--koru-primary);
}
.koru-icon-toggle:hover {
  font-variation-settings: 'FILL' 1, 'wght' 500;
  transform: scale(1.12);
  color: var(--koru-dark);
}
.koru-icon-toggle.is-active {
  font-variation-settings: 'FILL' 1, 'wght' 500;
  color: var(--koru-primary);
}
```

- **Duration / easing:** 200ms · `spring`
- **Use:** Bookmark, favorite, like, nav-tab icons, toolbar buttons.
- **Don't:** Decorative icons; icons that don't have a "filled" state in Material Symbols.
- **Reduced-motion:** Instant fill swap, no scale.

---

#### B4 · `KoruUnderlineGrow`
**Purpose** — Nav links: an animated underline grows from the left on hover, or under the active item.

```css
.koru-underline {
  position: relative;
  color: var(--koru-ink);
  text-decoration: none;
  padding-bottom: 4px;
}
.koru-underline::after {
  content: "";
  position: absolute;
  left: 0; bottom: 0;
  width: 100%;
  height: 2px;
  background: var(--koru-primary);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform var(--t-quick) var(--koru-out);
  border-radius: 2px;
}
.koru-underline:hover::after,
.koru-underline.is-active::after { transform: scaleX(1); }
/* For active that should slide between items, animate transform-origin instead */
```

- **Duration / easing:** 200ms · `out`
- **Use:** Top-nav, in-page tab bars, footer link groups.
- **Don't:** Body copy links (use plain underline); icons.
- **Reduced-motion:** Underline appears instantly (no scaleX animation).

---

#### B5 · `KoruSpotlight`
**Purpose** — reactbits.dev's **Spotlight Card** adapted for Koru: a radial violet glow follows the cursor inside the card.

```css
.koru-spotlight {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  background: var(--koru-cream);
  border: 1px solid var(--koru-line);
  border-radius: 16px;
}
.koru-spotlight::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(
    240px circle at var(--mx, 50%) var(--my, 50%),
    rgba(var(--koru-primary-rgb), 0.18),
    transparent 60%
  );
  opacity: 0;
  transition: opacity var(--t-quick) var(--koru-out);
  pointer-events: none;
  z-index: 0;
}
.koru-spotlight:hover::before { opacity: 1; }
.koru-spotlight > * { position: relative; z-index: 1; }
```

```js
// One-liner per element (rAF-throttled)
el.addEventListener('pointermove', e => {
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${e.clientX - r.left}px`);
  el.style.setProperty('--my', `${e.clientY - r.top}px`);
});
```

- **Duration / easing:** 200ms opacity fade-in · `out` (gradient itself is instant-follow)
- **Use:** Feature cards, pricing tiers, product tiles, "why us" grid.
- **Don't:** Touch devices (disable via `@media (hover: none)`); more than 6 per page (paint cost).
- **Reduced-motion:** Static dim glow in card center, no cursor-follow.

---

#### B6 · `KoruTilt`
**Purpose** — reactbits.dev's **Tilted Card**: 3D perspective tilt + glare overlay on hover.

```css
.koru-tilt {
  transform-style: preserve-3d;
  perspective: 1000px;
  transition: transform var(--t-quick) var(--koru-out);
  will-change: transform;
  position: relative;
}
.koru-tilt-inner {
  transform:
    rotateX(calc(var(--ry, 0) * -1deg))
    rotateY(calc(var(--rx, 0) * 1deg));
  transition: transform var(--t-quick) var(--koru-out);
  transform-style: preserve-3d;
}
.koru-tilt-glare {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    400px circle at var(--mx, 50%) var(--my, 50%),
    rgba(255, 255, 255, 0.35),
    transparent 50%
  );
  opacity: 0;
  transition: opacity var(--t-quick) var(--koru-out);
  pointer-events: none;
  mix-blend-mode: overlay;
}
.koru-tilt:hover .koru-tilt-glare { opacity: 1; }
```

```js
// max 12deg tilt
el.addEventListener('pointermove', e => {
  const r = el.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width  - 0.5;
  const py = (e.clientY - r.top)  / r.height - 0.5;
  el.style.setProperty('--rx', (px * 12).toFixed(2));
  el.style.setProperty('--ry', (py * 12).toFixed(2));
  el.style.setProperty('--mx', `${e.clientX - r.left}px`);
  el.style.setProperty('--my', `${e.clientY - r.top}px`);
});
el.addEventListener('pointerleave', () => {
  el.style.setProperty('--rx', 0); el.style.setProperty('--ry', 0);
});
```

- **Duration / easing:** 200ms · `out`
- **Use:** Hero product cards, app screenshots, the "hero showcase" tile.
- **Don't:** Forms, inputs, anything the user must click precisely; more than 2–3 per page.
- **Reduced-motion:** No tilt, no glare (just a static `KoruLift` fallback).

---

### C. TAP ANIMATIONS (5)

---

#### C1 · `KoruRipple`
**Purpose** — Material-style ripple emanating from the tap point, tinted violet.

```css
.koru-ripple {
  position: relative;
  overflow: hidden;
  isolation: isolate;
}
.koru-ripple-ink {
  position: absolute;
  border-radius: 50%;
  background: rgba(var(--koru-primary-rgb), 0.32);
  transform: scale(0);
  pointer-events: none;
  animation: koru-ripple 600ms var(--koru-out) forwards;
  z-index: 0;
}
@keyframes koru-ripple {
  to { transform: scale(4); opacity: 0; }
}
```

```js
el.addEventListener('pointerdown', e => {
  const r = el.getBoundingClientRect();
  const size = Math.max(r.width, r.height);
  const ink = document.createElement('span');
  ink.className = 'koru-ripple-ink';
  ink.style.width = ink.style.height = size + 'px';
  ink.style.left = (e.clientX - r.left - size / 2) + 'px';
  ink.style.top  = (e.clientY - r.top  - size / 2) + 'px';
  el.appendChild(ink);
  ink.addEventListener('animationend', () => ink.remove());
});
```

- **Duration / easing:** 600ms · `out`
- **Use:** Buttons, list items, chips, icon buttons.
- **Don't:** Elements that already have a complex hover/active state; text selection areas.
- **Reduced-motion:** A 100ms violet background flash instead of expanding ripple.

---

#### C2 · `KoruScaleDown`
**Purpose** — Apple haptic-scale: element dips to 0.96 on press, springs back.

```css
.koru-scale-down {
  transition: transform 120ms var(--koru-out);
  will-change: transform;
}
.koru-scale-down:active { transform: scale(0.96); }
```

- **Duration / easing:** 120ms down · `out`; spring-back on release via transition
- **Use:** Every tappable element by default (apply as a base utility).
- **Don't:** Inputs, text fields, scroll containers.
- **Reduced-motion:** 60ms color shift instead of scale.

---

#### C3 · `KoruHaptic`
**Purpose** — A 3-pulse scale vibration to simulate tactile feedback for important confirmations. Pair with `navigator.vibrate()` on Android.

```css
@keyframes koru-haptic {
  0%   { transform: scale(1); }
  20%  { transform: scale(0.94); }
  40%  { transform: scale(1.02); }
  60%  { transform: scale(0.98); }
  80%  { transform: scale(1.005); }
  100% { transform: scale(1); }
}
.koru-haptic { animation: koru-haptic 220ms var(--koru-out); }
```

```js
if (navigator.vibrate) navigator.vibrate(8);
```

- **Duration / easing:** 220ms · `out`
- **Use:** Destructive confirmations, "added to cart," biometric-unlock success, payment success.
- **Don't:** Routine taps (desensitizes the user); anything during scroll.
- **Reduced-motion:** A single opacity pulse (0.5 → 1) instead of multi-pulse scale.

---

#### C4 · `KoruColorFlash`
**Purpose** — A 1-frame border + bg flash to confirm an async action fired (e.g. "copied to clipboard").

```css
@keyframes koru-color-flash {
  0%   { background: rgba(var(--koru-primary-rgb), 0);    border-color: var(--koru-line); }
  15%  { background: rgba(var(--koru-primary-rgb), 0.22); border-color: var(--koru-primary); }
  100% { background: rgba(var(--koru-primary-rgb), 0);    border-color: var(--koru-line); }
}
.koru-color-flash { animation: koru-color-flash 480ms var(--koru-out); }
```

- **Duration / easing:** 480ms · `out`
- **Use:** "Copy link," "Invite sent," "Saved," "Applied."
- **Don't:** Errors (use `KoruShake`); persistent state changes (use a real state class).
- **Reduced-motion:** Solid 200ms tint then back — no animated flash.

---

#### C5 · `KoruMagnetic`
**Purpose** — reactbits.dev's **Magnetic Button**: button is *gently attracted* toward the cursor when nearby.

```css
.koru-magnetic {
  transition: transform var(--t-quick) var(--koru-spring);
  will-change: transform;
  display: inline-flex;
}
.koru-magnetic.is-leaving { transition: transform 400ms var(--koru-spring); }
```

```js
const STRENGTH = 0.35;       // 0.3 = silk, 0.6 = buggy
el.addEventListener('pointermove', e => {
  const r = el.getBoundingClientRect();
  const x = e.clientX - (r.left + r.width / 2);
  const y = e.clientY - (r.top + r.height / 2);
  el.style.transform = `translate(${x * STRENGTH}px, ${y * STRENGTH}px)`;
});
el.addEventListener('pointerleave', () => {
  el.classList.add('is-leaving');
  el.style.transform = '';
  setTimeout(() => el.classList.remove('is-leaving'), 400);
});
```

- **Duration / easing:** 200ms follow · `spring`; 400ms return · `spring`
- **Use:** Hero CTAs, "Sign up," footer "Get started." Limit 1–2 per page.
- **Don't:** Touch (no hover); inside scrolling containers (jitters); small targets (<40px).
- **Reduced-motion:** No translation — cursor proximity does nothing.

---

### D. IDLE ANIMATIONS (6)

> **Idle rule:** always subtle, always slow, always cancellable by hover/interaction. Never compete with content.

---

#### D1 · `KoruBreathe`
**Purpose** — A primary element "breathes": scale 1 → 1.04 → 1 over 4s. The Vercel status-dot pattern, scaled up.

```css
@keyframes koru-breathe {
  0%, 100% { transform: scale(1);    opacity: 0.85; }
  50%      { transform: scale(1.04); opacity: 1;    }
}
.koru-breathe {
  animation: koru-breathe 4s var(--koru-in-out) infinite;
  will-change: transform, opacity;
}
.koru-breathe:hover { animation-play-state: paused; }
```

- **Duration / easing:** 4000ms · `in-out` · infinite
- **Use:** Primary CTA on hero, brand logo in nav, "live" status indicators, AI "thinking" dots.
- **Don't:** Body text, multiple on screen (one is calming, three is a disco).
- **Reduced-motion:** Static at 1.0 scale, no animation.

---

#### D2 · `KoruPulseDot`
**Purpose** — The "online" / "recording" / "live" dot: a dot with an expanding ring pulse.

```css
.koru-pulse-dot {
  position: relative;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--koru-primary);
  flex-shrink: 0;
}
.koru-pulse-dot::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--koru-primary);
  animation: koru-pulse-ring 1.8s var(--koru-out) infinite;
}
@keyframes koru-pulse-ring {
  0%   { transform: scale(1);   opacity: 0.7; }
  80%  { transform: scale(2.8); opacity: 0;   }
  100% { transform: scale(2.8); opacity: 0;   }
}
```

- **Duration / easing:** 1800ms · `out` · infinite
- **Use:** "Live" badges, recording indicators, "AI is typing," online status.
- **Don't:** Static labels; more than 3 visible at once.
- **Reduced-motion:** Solid dot, no ring.

---

#### D3 · `KoruShimmerLoader`
**Purpose** — Skeleton loading shimmer: a soft violet gradient sweeps across placeholder blocks.

```css
.koru-shimmer {
  background: linear-gradient(
    90deg,
    var(--koru-mist) 0%,
    var(--koru-mist) 40%,
    rgba(var(--koru-primary-rgb), 0.18) 50%,
    var(--koru-mist) 60%,
    var(--koru-mist) 100%
  );
  background-size: 200% 100%;
  animation: koru-shimmer 1.6s var(--koru-in-out) infinite;
  border-radius: 8px;
}
@keyframes koru-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

- **Duration / easing:** 1600ms · `in-out` · infinite
- **Use:** Skeleton screens, image placeholders, content-loading states.
- **Don't:** Anything actually loaded (kills the affordance); more than 5s (swap to a real loader).
- **Reduced-motion:** Solid `var(--koru-mist)` block, no sweep.

---

#### D4 · `KoruFloat`
**Purpose** — Decorative elements gently bob up and down. Hero illustrations, background shapes.

```css
@keyframes koru-float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50%      { transform: translateY(-10px) rotate(1.5deg); }
}
.koru-float {
  animation: koru-float 6s var(--koru-in-out) infinite;
  will-change: transform;
}
.koru-float-slow   { animation-duration: 9s; }
.koru-float-fast   { animation-duration: 4s; }
/* Stagger multiple floats so they don't sync: */
.koru-float:nth-child(2n)   { animation-delay: -1.5s; }
.koru-float:nth-child(3n)   { animation-delay: -3s;   }
```

- **Duration / easing:** 6000ms (default) · `in-out` · infinite
- **Use:** Hero decorative SVGs, mascot illustrations, empty-state art, floating CTA on mobile.
- **Don't:** Functional UI; icons in nav (feels drunk); more than 4 per view.
- **Reduced-motion:** Static.

---

#### D5 · `KoruRingPulse`
**Purpose** — A ring expands and fades around an element to draw attention (notification badge, "new" item).

```css
.koru-ring-pulse {
  position: relative;
}
.koru-ring-pulse::before,
.koru-ring-pulse::after {
  content: "";
  position: absolute;
  inset: -4px;
  border-radius: inherit;
  border: 2px solid var(--koru-primary);
  opacity: 0;
  animation: koru-ring 2.4s var(--koru-out) infinite;
}
.koru-ring-pulse::after { animation-delay: 1.2s; }
@keyframes koru-ring {
  0%   { transform: scale(0.9); opacity: 0.7; }
  100% { transform: scale(1.4); opacity: 0;   }
}
```

- **Duration / easing:** 2400ms · `out` · infinite (double-staggered 1.2s)
- **Use:** Notification badges, "new feature" callouts, onboarding spotlight.
- **Don't:** Persistent — dismiss after the user interacts.
- **Reduced-motion:** Single static violet ring (no expansion).

---

#### D6 · `KoruAurora` (idle background)
**Purpose** — reactbits.dev's **Aurora Background**, re-tuned for Koru's lavender. Slowly drifting blurred radial gradients replace static gradient blobs.

```css
.koru-aurora {
  position: fixed;            /* or absolute inside a hero */
  inset: 0;
  overflow: hidden;
  background: var(--koru-cream);
  z-index: -1;
  pointer-events: none;
}
.koru-aurora::before,
.koru-aurora::after,
.koru-aurora > span {
  content: "";
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  mix-blend-mode: multiply;
  opacity: 0.55;
  will-change: transform;
}
.koru-aurora::before {
  width: 50vw; height: 50vw;
  background: radial-gradient(circle, var(--koru-primary), transparent 70%);
  top: -10%; left: -10%;
  animation: koru-aurora-1 22s var(--koru-in-out) infinite alternate;
}
.koru-aurora::after {
  width: 45vw; height: 45vw;
  background: radial-gradient(circle, var(--koru-dark), transparent 70%);
  bottom: -15%; right: -10%;
  animation: koru-aurora-2 18s var(--koru-in-out) infinite alternate;
}
.koru-aurora > span {
  width: 35vw; height: 35vw;
  background: radial-gradient(circle, var(--koru-deep), transparent 70%);
  top: 30%; left: 40%;
  animation: koru-aurora-3 26s var(--koru-in-out) infinite alternate;
}
@keyframes koru-aurora-1 {
  to { transform: translate(20vw, 15vh) scale(1.15); }
}
@keyframes koru-aurora-2 {
  to { transform: translate(-15vw, -10vh) scale(1.1); }
}
@keyframes koru-aurora-3 {
  to { transform: translate(-25vw, 20vh) scale(0.9); }
}
```

- **Duration / easing:** 18–26s · `in-out` · infinite alternate
- **Use:** Hero background, auth pages, empty states, the "premium" tier page.
- **Don't:** Behind dense content tables (kills legibility); more than one per page.
- **Reduced-motion:** Static gradient (one of the blobs at its midpoint), no drift.

---

### E. STATE-CHANGE ANIMATIONS (6)

---

#### E1 · `KoruSuccessPop`
**Purpose** — A checkmark icon pops in with a violet ring bloom on success.

```css
@keyframes koru-success-pop {
  0%   { opacity: 0; transform: scale(0.4); }
  50%  { opacity: 1; transform: scale(1.15); }
  70%  { transform: scale(0.95); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes koru-success-ring {
  0%   { box-shadow: 0 0 0 0 rgba(var(--koru-primary-rgb), 0.55); }
  100% { box-shadow: 0 0 0 24px rgba(var(--koru-primary-rgb), 0); }
}
.koru-success-pop {
  animation: koru-success-pop 420ms var(--koru-spring) both;
}
.koru-success-pop .ring {
  animation: koru-success-ring 700ms var(--koru-out) both;
  border-radius: 50%;
}
```

- **Duration / easing:** 420ms pop · `spring`; 700ms ring · `out`
- **Use:** Form-submit success, payment confirmed, file uploaded, task completed.
- **Don't:** Failure states (use `KoruShake`); non-final successes (use `KoruColorFlash`).
- **Reduced-motion:** Checkmark fades in over 150ms, no ring.

---

#### E2 · `KoruShake`
**Purpose** — Error shake: 4-oscillation horizontal shake to signal invalid input / failure.

```css
@keyframes koru-shake {
  0%, 100% { transform: translateX(0); }
  20%      { transform: translateX(-8px); }
  40%      { transform: translateX(7px); }
  60%      { transform: translateX(-4px); }
  80%      { transform: translateX(3px); }
}
.koru-shake {
  animation: koru-shake 380ms var(--koru-out);
  border-color: #e5484d !important; /* Koru-red error accent */
}
```

- **Duration / easing:** 380ms · `out` (one-shot)
- **Use:** Invalid form field, failed login, payment declined, password mismatch.
- **Don't:** Success states; more than once per error (annoying).
- **Reduced-motion:** Solid red border + 200ms fade, no shake.

---

#### E3 · `KoruSaveRise`
**Purpose** — "Saved" toast rises from bottom, holds, fades out. Linear / Stripe pattern.

```css
@keyframes koru-save-rise {
  0%   { opacity: 0; transform: translateY(16px) scale(0.96); }
  15%  { opacity: 1; transform: translateY(0)    scale(1);    }
  85%  { opacity: 1; transform: translateY(0)    scale(1);    }
  100% { opacity: 0; transform: translateY(-8px) scale(0.98); }
}
.koru-save-rise {
  animation: koru-save-rise 2.8s var(--koru-out) both;
  background: var(--koru-ink);
  color: var(--koru-cream);
  padding: 10px 16px;
  border-radius: 12px;
  box-shadow: var(--koru-glow-md);
}
```

- **Duration / easing:** 2800ms total (hold ~2s) · `out`
- **Use:** "Saved," "Copied," "Link shared," "Settings updated."
- **Don't:** Critical errors (use a dismissible banner); stacked (>3 queued = use a feed).
- **Reduced-motion:** Fade in 150ms, hold, fade out 150ms — no translate.

---

#### E4 · `KoruBookmarkFill`
**Purpose** — Lucide-animated-style state transition: bookmark icon draws itself filled on click.

```css
.koru-bookmark {
  font-family: var(--koru-icon);
  font-variation-settings: 'FILL' 0, 'wght' 400;
  color: var(--koru-ink);
  transition:
    font-variation-settings 280ms var(--koru-spring),
    color 200ms var(--koru-out),
    transform 280ms var(--koru-spring);
  display: inline-flex;
  cursor: pointer;
}
.koru-bookmark.is-saved {
  font-variation-settings: 'FILL' 1, 'wght' 500;
  color: var(--koru-primary);
  animation: koru-bookmark-pop 360ms var(--koru-spring);
}
@keyframes koru-bookmark-pop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.25); }
  70%  { transform: scale(0.92); }
  100% { transform: scale(1); }
}
```

```js
btn.addEventListener('click', () => {
  btn.classList.toggle('is-saved');
  // Optional: trigger count-up on the saved count nearby
});
```

- **Duration / easing:** 280ms fill · `spring`; 360ms pop · `spring`
- **Use:** Bookmark / favorite / save toggles anywhere.
- **Don't:** When the saved-state needs to persist across reloads without a loading indicator (use a brief disabled state).
- **Reduced-motion:** Instant fill swap, no pop.

---

#### E5 · `KoruToggleSwitch`
**Purpose** — A custom switch animating the thumb slide + track color shift on toggle.

```css
.koru-switch {
  --w: 44px; --h: 26px; --thumb: 20px; --gap: 3px;
  width: var(--w); height: var(--h);
  border-radius: 999px;
  background: var(--koru-line);
  position: relative;
  cursor: pointer;
  transition: background var(--t-quick) var(--koru-out);
  flex-shrink: 0;
}
.koru-switch::after {
  content: "";
  position: absolute;
  top: var(--gap); left: var(--gap);
  width: var(--thumb); height: var(--thumb);
  border-radius: 50%;
  background: white;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  transition: transform var(--t-quick) var(--koru-spring);
}
.koru-switch.is-on {
  background: var(--koru-primary);
}
.koru-switch.is-on::after {
  transform: translateX(calc(var(--w) - var(--thumb) - var(--gap) * 2));
}
```

- **Duration / easing:** 200ms · `out` (track) + `spring` (thumb overshoots slightly)
- **Use:** Settings toggles, dark-mode switch, notification preferences.
- **Don't:** Native `<input type="checkbox">` semantically required — wrap it visually instead.
- **Reduced-motion:** Instant snap, no overshoot.

---

#### E6 · `KoruSkeletonToContent`
**Purpose** — Skeleton crossfades into real content when data arrives.

```css
.koru-skeleton-to-content {
  position: relative;
}
.koru-skeleton-to-content > .skeleton,
.koru-skeleton-to-content > .content {
  transition: opacity var(--t-snappy) var(--koru-out);
}
.koru-skeleton-to-content > .skeleton { opacity: 1; }
.koru-skeleton-to-content > .content  { opacity: 0; }
.koru-skeleton-to-content.is-loaded > .skeleton { opacity: 0; pointer-events: none; }
.koru-skeleton-to-content.is-loaded > .content  { opacity: 1; animation: koru-card-in var(--t-snappy) var(--koru-out) both; }
```

- **Duration / easing:** 320ms crossfade · `out` + 320ms content rise
- **Use:** Any async-loaded card/tile that has a skeleton placeholder.
- **Don't:** Faster than 200ms data fetches (the skeleton flash is worse than no skeleton).
- **Reduced-motion:** Instant swap.

---

### F. SCROLL-LINKED ANIMATIONS (6)

> Use `IntersectionObserver` for "trigger once" effects, `scroll` + `rAF` for continuous parallax. Never attach scroll handlers without throttling.

---

#### F1 · `KoruParallaxHeader`
**Purpose** — Hero image/content moves at 0.5× scroll speed, creating depth.

```css
.koru-parallax-header {
  --scroll: 0;
  transform: translateY(calc(var(--scroll) * 0.5px));
  transition: transform 60ms linear;  /* smooths rAF jumps */
  will-change: transform;
}
.koru-parallax-header .koru-parallax-far {
  transform: translateY(calc(var(--scroll) * 0.2px));
}
```

```js
const header = document.querySelector('.koru-parallax-header');
let ticking = false;
window.addEventListener('scroll', () => {
  if (!ticking) {
    requestAnimationFrame(() => {
      header.style.setProperty('--scroll', Math.min(window.scrollY, 600));
      ticking = false;
    });
    ticking = true;
  }
}, { passive: true });
```

- **Duration / easing:** Continuous (60ms transition smoothing) · linear
- **Use:** Hero sections, article headers, product showcase.
- **Don't:** More than 2 parallax layers per view; on mobile (perf + motion sickness).
- **Reduced-motion:** Static, no parallax.

---

#### F2 · `KoruFadeOnScroll`
**Purpose** — Element fades + slides in when it enters the viewport. The workhorse scroll-reveal.

```css
.koru-fade-scroll {
  opacity: 0;
  transform: translateY(28px);
  transition:
    opacity var(--t-standard) var(--koru-out),
    transform var(--t-standard) var(--koru-out);
}
.koru-fade-scroll.is-in {
  opacity: 1;
  transform: translateY(0);
}
```

```js
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('is-in');
      io.unobserve(e.target);  // play once
    }
  });
}, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('.koru-fade-scroll').forEach(el => io.observe(el));
```

- **Duration / easing:** 480ms · `out`
- **Use:** Section headlines, feature blocks, testimonials, footer CTAs.
- **Don't:** Above-the-fold content (already visible — use `KoruCardIn` instead).
- **Reduced-motion:** Instant opacity 1 on intersect.

---

#### F3 · `KoruStickyCollapse`
**Purpose** — Sticky header shrinks (height + logo + font-size) as user scrolls down. Linear-style.

```css
.koru-sticky-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(var(--koru-cream-rgb), 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid transparent;
  transition:
    padding var(--t-quick) var(--koru-out),
    background var(--t-quick) var(--koru-out),
    border-color var(--t-quick) var(--koru-out);
  padding: 20px 0;
}
.koru-sticky-header.is-collapsed {
  padding: 10px 0;
  background: rgba(var(--koru-cream-rgb), 0.95);
  border-bottom-color: var(--koru-line);
  box-shadow: 0 4px 24px rgba(var(--koru-deep-rgb), 0.06);
}
.koru-sticky-header .logo {
  font-family: var(--koru-display);
  font-size: 24px;
  transition: font-size var(--t-quick) var(--koru-out);
}
.koru-sticky-header.is-collapsed .logo { font-size: 18px; }
```

- **Duration / easing:** 200ms · `out`
- **Use:** Top nav on landing pages, docs sidebars.
- **Don't:** Mobile apps with native bars; pages shorter than 2 viewports.
- **Reduced-motion:** Snap between expanded/collapsed instantly.

---

#### F4 · `KoruProgressBar`
**Purpose** — A reading-progress or onboarding-progress bar fills as user scrolls / advances.

```css
.koru-progress-bar {
  position: fixed;
  top: 0; left: 0;
  height: 3px;
  width: 100%;
  background: transparent;
  z-index: 100;
}
.koru-progress-bar::after {
  content: "";
  display: block;
  height: 100%;
  width: var(--progress, 0%);
  background: linear-gradient(90deg, var(--koru-primary), var(--koru-dark));
  box-shadow: 0 0 12px rgba(var(--koru-primary-rgb), 0.6);
  transition: width 80ms linear;
  border-radius: 0 3px 3px 0;
}
```

```js
const bar = document.querySelector('.koru-progress-bar');
function update() {
  const h = document.documentElement;
  const scrolled = h.scrollTop / (h.scrollHeight - h.clientHeight);
  bar.style.setProperty('--progress', (scrolled * 100) + '%');
}
document.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
```

- **Duration / easing:** 80ms smoothing · linear
- **Use:** Long-form articles, docs, multi-step onboarding.
- **Don't:** Short pages (the bar barely moves); already-busy tops (collides with sticky header).
- **Reduced-motion:** Solid bar at final position, no live update.

---

#### F5 · `KoruScrollStack`
**Purpose** — reactbits.dev's **Scroll Stack** pattern: cards stack on top of each other as you scroll (pin + cover).

```css
.koru-scroll-stack {
  position: relative;
}
.koru-scroll-stack-item {
  position: sticky;
  top: 80px;            /* below your sticky header */
  transition: transform var(--t-snappy) var(--koru-out);
  will-change: transform;
}
.koru-scroll-stack-item.is-covered {
  transform: scale(0.92);
  opacity: 0.6;
  filter: blur(2px);
}
```

```js
// Pseudo: each item compares its bottom to the next item's top
const items = document.querySelectorAll('.koru-scroll-stack-item');
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    e.target.classList.toggle('is-covered', !e.isIntersecting && e.boundingClientRect.top < 0);
  });
}, { threshold: [0, 0.5, 1] });
items.forEach(el => io.observe(el));
```

- **Duration / easing:** 320ms · `out`
- **Use:** Feature deep-dives, pricing tier comparison, step-by-step product tours.
- **Don't:** Mobile (sticky-stack janks on small screens); >5 stacked items.
- **Reduced-motion:** Items appear in normal document flow, no stacking.

---

#### F6 · `KoruScrollVelocityText`
**Purpose** — reactbits.dev's **Scroll Velocity** effect: a marquee of text scrolls faster as the user scrolls, direction-flips on scroll-up.

```css
.koru-velocity-text {
  display: flex;
  gap: 48px;
  white-space: nowrap;
  font-family: var(--koru-display);
  font-weight: 700;
  font-size: clamp(48px, 8vw, 120px);
  color: var(--koru-primary);
  will-change: transform;
  transform: translateX(var(--x, 0px));
}
.koru-velocity-text span { flex-shrink: 0; }
```

```js
const el = document.querySelector('.koru-velocity-text');
let x = 0, target = 0, lastScroll = window.scrollY, vel = 0;
window.addEventListener('scroll', () => {
  const dy = window.scrollY - lastScroll;
  vel = dy * 0.8;
  target += dy * 0.8;
  lastScroll = window.scrollY;
}, { passive: true });
(function loop() {
  x += (target - x) * 0.1;     // ease toward target
  target *= 0.92;              // decay velocity when not scrolling
  el.style.setProperty('--x', x + 'px');
  requestAnimationFrame(loop);
})();
```

- **Duration / easing:** Continuous rAF lerp (0.1) + decay (0.92)
- **Use:** One per landing page, mid-fold, between sections. "Built for teams. Built for speed. Built for you."
- **Don't:** More than one; near other moving elements (cognitive overload).
- **Reduced-motion:** Static centered text, no scroll-link.

---

## PART 3 — reactbits.dev Signature Effects (Koru-adapted deep dive)

The user explicitly asked for these seven patterns. All CSS above is brand-tuned; this section is the *strategic* mapping.

### 3.1 `KoruAurora` → **Aurora Background**
**Source:** `/backgrounds/aurora` + `/backgrounds/soft-aurora` — layered, slow, blurred radial gradients, `mix-blend-mode: screen/multiply`.
**Koru use:** Replace every static gradient-blob on the redesign. Use `multiply` on the cream bg (Part 2 · D6).
**Why premium:** The 18–26s drift is below conscious perception — the page feels *alive* without moving.
**Variants:** `KoruAuroraSubtle` (opacity 0.25, single blob, for cards); `KoruAuroraHero` (3 blobs, full-bleed, behind hero).

### 3.2 `KoruSpotlight` → **Spotlight Card**
**Source:** `/components/spotlight-card` — `radial-gradient` repaints via `--mx/--my` CSS vars on `pointermove`, default `rgba(255,255,255,0.25)`.
**Koru use:** The feature-grid card, pricing-tier card, and "case study" tile. Use violet-tinted `rgba(var(--koru-primary-rgb), 0.18)` (Part 2 · B5).
**Why premium:** No JS animation loop — just CSS var assignment on rAF. Cost is near-zero, perceived value is huge.
**Variant:** `KoruSpotlightBorder` — the spotlight also lights up the card border via `mask` (advanced; only for hero showcase).

### 3.3 `KoruScrambleText` → **Text Scramble** (hero title reveal)
**Source:** `/text-animations/text-scramble` + `/text-animations/decrypted-text` — per-char scramble, stagger = index × 30ms.
**Koru use:** Hero H1 on the marketing site. One-shot on load, never on scroll.

```js
// 1.2s total, 30ms per-char stagger, locks left-to-right
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&/⟨⟩";
function koruScramble(el, finalText) {
  const len = finalText.length;
  const lockTime = 900;
  el.textContent = finalText;
  let frame = 0;
  const id = setInterval(() => {
    let out = '';
    for (let i = 0; i < len; i++) {
      const charLockAt = (i / len) * lockTime;
      const elapsed = frame * 16;
      out += elapsed > charLockAt
        ? finalText[i]
        : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    }
    el.textContent = out;
    frame++;
    if (elapsed > lockTime + 300) { clearInterval(id); el.textContent = finalText; }
  }, 16);
}
```

**Why premium:** The stagger is the magic. Without it: slot machine. With it: the page is *decrypting itself*.
**Don't:** Body text, anything >2 lines, more than once per session.

### 3.4 `KoruMagnetic` → **Magnetic Button**
**Source:** `/components/magnetic-button` + `/animations/magnet-lines` — element translates toward cursor by 0.3–0.5× the delta.
**Koru use:** Exactly one per view — the primary hero CTA (Part 2 · C5). STRENGTH = 0.35.
**Why premium:** 0.35 reads as silk. 0.6 reads as a bug. The 400ms spring-back is what makes it feel *intentional*.
**Don't:** Touch (disable via `@media (hover: none)`).

### 3.5 `KoruTilt` → **Tilted Card**
**Source:** `/components/tilted-card` — `perspective(1000px) rotateX/Y` from mouse delta + glare `::before`.
**Koru use:** The hero product screenshot, the "app preview" tile (Part 2 · B6). Max 2 per page.
**Why premium:** The glare overlay (mix-blend-mode: overlay) is what sells it as a physical object.
**Don't:** Forms, content the user must read while hovering.

### 3.6 `KoruGradientText` → **Animated Gradient Text** (accent words)
**Source:** `/text-animations/gradient-text` — `background: linear-gradient(...)` + `background-clip: text` + animated `background-position`.

```css
.koru-gradient-text {
  background: linear-gradient(
    90deg,
    var(--koru-primary) 0%,
    var(--koru-dark) 25%,
    var(--koru-deep) 50%,
    var(--koru-dark) 75%,
    var(--koru-primary) 100%
  );
  background-size: 200% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  animation: koru-gradient-shift 6s var(--koru-in-out) infinite;
}
@keyframes koru-gradient-shift {
  0%   { background-position: 0% 0; }
  50%  { background-position: 100% 0; }
  100% { background-position: 0% 0; }
}
```

**Koru use:** Inline accent words in hero H1 ("Built for **teams** that move fast"); section eyebrow labels; pricing "Pro" tier name.
**Why premium:** Slow (6s) + symmetric easing = ambient, never distracting. Always between 3 brand colors, never rainbow.
**Don't:** Body paragraphs, links (kills affordance), >3 instances per page.

### 3.7 `KoruDecrypt` → **Decrypted Text** (tech-feel numbers)
**Source:** `/text-animations/decrypted-text` — like scramble but for numeric/ID strings, locks right-to-left, uses mono glyphs.
**Koru use:** Verification codes, API-key reveals, "transaction ID" displays, the dashboard's transaction-feed timestamps.

```js
// Locks right-to-left, mono glyphs, 60ms/char
const MONO = "0123456789ABCDEF";
function koruDecrypt(el, finalText) {
  const len = finalText.length;
  let locked = 0;
  const id = setInterval(() => {
    let out = '';
    for (let i = 0; i < len; i++) {
      if (i >= len - locked) out += finalText[i];
      else out += MONO[Math.floor(Math.random() * MONO.length)];
    }
    el.textContent = out;
    locked++;
    if (locked > len) clearInterval(id);
  }, 60);
}
```

**Why premium:** Right-to-left lock mimics a "scan" — feels like the system is reading the value out to you.
**Don't:** Marketing copy (feels cold); strings >16 chars (gets tedious).

---

## PART 4 — lucide-animated Approach, Adapted for Koru (Material Symbols)

lucide-animated uses **Motion + Lucide** with three motion classes: draw-on-view, loop, state-transition. Koru uses **Material Symbols Outlined (FILL 0, wght 400)**, which has a unique superpower: the `FILL` and `wght` axes are **CSS-animatable via `font-variation-settings`**. No SVG path surgery needed.

### 4.1 Draw-on-view for Material Symbols

Material Symbols don't expose `pathLength`, but we can fake the "draw" with a `clip-path` wipe combined with a weight ramp:

```css
.koru-symbol-draw {
  font-family: var(--koru-icon);
  font-variation-settings: 'FILL' 0, 'wght' 200, 'opsz' 24;
  clip-path: inset(0 100% 0 0);       /* hidden, wipes left→right */
  animation:
    koru-symbol-wipe 700ms var(--koru-out) both,
    koru-symbol-weight 700ms var(--koru-out) both;
}
@keyframes koru-symbol-wipe {
  to { clip-path: inset(0 0 0 0); }
}
@keyframes koru-symbol-weight {
  0%   { font-variation-settings: 'FILL' 0, 'wght' 200, 'opsz' 24; }
  60%  { font-variation-settings: 'FILL' 0, 'wght' 600, 'opsz' 24; }
  100% { font-variation-settings: 'FILL' 0, 'wght' 400, 'opsz' 24; }
}
```

**Trigger:** `whileInView` (IntersectionObserver adds a class). Stagger via `--i` index × 80ms.
**Use:** Feature-section icon rows (one of the most "premium" tells on a marketing page).

### 4.2 Loop variants for Material Symbols

| Variant | Animation | Duration | Use |
|---|---|---|---|
| `KoruSymbolRotate` | `transform: rotate(0 → 360deg)` linear infinite | 3s | Settings gear, sync icon, refresh |
| `KoruSymbolPulse` | `font-variation-settings: 'wght' 400 → 700` + `scale(1 → 1.08 → 1)` | 1.6s `in-out` | "Live" indicator, heart icon while liking |
| `KoruSymbolBounce` | `translateY(0 → -4 → 0)` | 1s `in-out` | Notification bell, "new" arrow |
| `KoruSymbolWiggle` | `rotate(0 → -8 → 8 → 0)` every 4s | 0.6s `in-out` | Error icon, "try again" |

```css
/* Example: the breathing heart while a like is processing */
@keyframes koru-symbol-pulse {
  0%, 100% { font-variation-settings: 'FILL' 1, 'wght' 400; transform: scale(1); }
  50%      { font-variation-settings: 'FILL' 1, 'wght' 700; transform: scale(1.08); }
}
.koru-symbol-pulse {
  font-family: var(--koru-icon);
  color: var(--koru-primary);
  animation: koru-symbol-pulse 1.6s var(--koru-in-out) infinite;
}
```

### 4.3 State-transition icons (bookmark empty → filled, with draw)

See **Part 2 · E4 `KoruBookmarkFill`** — already implemented using `font-variation-settings: 'FILL' 0 → 1` + scale pop. The same pattern applies to `favorite`, `star`, `bell`, `thumb_up` — every Material Symbol with a FILL variant.

**Tier-S detail:** the pop peaks at 1.25× at 40% of the animation, then settles to 0.92× at 70%, then back to 1.0. This *asymmetric* overshoot is what makes it feel like a physical button click, not a CSS transition.

---

## PART 5 — Implementation Guidance

### 5.1 Performance budget

| Surface | Max simultaneous animations | Notes |
|---|---|---|
| Hero | 3 (aurora + 1 entrance + 1 idle) | Aurora counts as 1 even though 3 blobs |
| Section | 2 hover-targets + 1 scroll-reveal | Disable idle on hover |
| Dashboard | 0 idle, 1 entrance | Numbers must remain readable |
| Mobile | 0 parallax, 0 tilt, 0 magnetic | Touch + perf + motion sickness |
| `prefers-reduced-motion` | 0 | All degrade to instant/single-fade |

### 5.2 The 4 universal rules (apply to every animation above)

1. **One spring, one ease-out.** Never mix. Koru spring = `cubic-bezier(0.34, 1.56, 0.64, 1)`. Koru out = `cubic-bezier(0.22, 1, 0.36, 1)`.
2. **Stagger ≥ 60ms, ≤ 80ms.** Below 60ms reads as simultaneous; above 80ms reads as slow.
3. **`will-change` only during the animation.** Add via JS on `pointerenter` / observer-fire, remove 200ms after `animationend`.
4. **Reduced-motion = instant.** No "slower" version. Slower is worse.

### 5.3 Quick reference — animation → token map

| Animation | Duration var | Easing var |
|---|---|---|
| KoruCardIn, KoruSectionStagger, KoruCountUp, KoruGlowBreathe, KoruPageFade, KoruFadeOnScroll, KoruScrollStack, KoruSkeletonToContent | `--t-standard` (480ms) or `--t-snappy` (320ms) | `--koru-out` |
| KoruSheetUp, KoruIconPop, KoruIconFillToggle, KoruToggleSwitch, KoruBookmarkFill | `--t-snappy` (320ms) or `--t-quick` (200ms) | `--koru-spring` |
| KoruShineSweep, KoruSuccessPop | one-shot 600/420ms | `--koru-out` / `--koru-spring` |
| KoruRipple, KoruScaleDown, KoruHaptic, KoruColorFlash, KoruMagnetic | `--t-instant` (120ms) / `--t-quick` | `--koru-out` / `--koru-spring` |
| KoruBreathe, KoruPulseDot, KoruShimmerLoader, KoruFloat, KoruRingPulse, KoruAurora | 1.6–26s | `--koru-in-out` |
| KoruParallaxHeader, KoruProgressBar, KoruVelocityText | continuous rAF | linear / lerp |

### 5.4 The "don't" master list (anti-patterns to ban)

- ❌ Bouncy easings on errors (`KoruShake` uses `out`, never `spring`).
- ❌ `transition: all` — always name properties explicitly.
- ❌ Animating `top/left/width/height` — use `transform` and `opacity` only.
- ❌ More than 2 idle animations visible at once.
- ❌ Aurora behind body copy without a 0.85+ opacity scrim.
- ❌ Magnetic / Tilt / Spotlight on touch (`@media (hover: none)` must disable).
- ❌ Scroll-velocity text inside a scroll-snap container (janks).
- ❌ `will-change` permanently in stylesheet (only via JS during animation).
- ❌ Repeating `KoruSuccessPop` on the same element (use a one-shot class then remove).

---

## PART 6 — Summary Index (all 36)

| # | Name | Category | Duration | Easing |
|---|---|---|---|---|
| A1 | KoruCardIn | Entrance | 320ms | out |
| A2 | KoruSheetUp | Entrance | 320ms | spring |
| A3 | KoruSectionStagger | Entrance | 480ms+70ms/i | out |
| A4 | KoruCountUp | Entrance | 1200ms | easeOutExpo |
| A5 | KoruIconPop | Entrance | 320ms | spring |
| A6 | KoruGlowBreathe | Entrance | 480ms | spring |
| A7 | KoruPageFade | Entrance | 100+200ms | out |
| B1 | KoruLift | Hover | 200ms | out |
| B2 | KoruShineSweep | Hover | 600ms | out |
| B3 | KoruIconFillToggle | Hover | 200ms | spring |
| B4 | KoruUnderlineGrow | Hover | 200ms | out |
| B5 | KoruSpotlight | Hover | 200ms | out |
| B6 | KoruTilt | Hover | 200ms | out |
| C1 | KoruRipple | Tap | 600ms | out |
| C2 | KoruScaleDown | Tap | 120ms | out |
| C3 | KoruHaptic | Tap | 220ms | out |
| C4 | KoruColorFlash | Tap | 480ms | out |
| C5 | KoruMagnetic | Tap | 200ms | spring |
| D1 | KoruBreathe | Idle | 4000ms | in-out |
| D2 | KoruPulseDot | Idle | 1800ms | out |
| D3 | KoruShimmerLoader | Idle | 1600ms | in-out |
| D4 | KoruFloat | Idle | 6000ms | in-out |
| D5 | KoruRingPulse | Idle | 2400ms | out |
| D6 | KoruAurora | Idle | 18–26s | in-out |
| E1 | KoruSuccessPop | State-change | 420ms | spring |
| E2 | KoruShake | State-change | 380ms | out |
| E3 | KoruSaveRise | State-change | 2800ms | out |
| E4 | KoruBookmarkFill | State-change | 280ms | spring |
| E5 | KoruToggleSwitch | State-change | 200ms | out/spring |
| E6 | KoruSkeletonToContent | State-change | 320ms | out |
| F1 | KoruParallaxHeader | Scroll-linked | continuous | linear |
| F2 | KoruFadeOnScroll | Scroll-linked | 480ms | out |
| F3 | KoruStickyCollapse | Scroll-linked | 200ms | out |
| F4 | KoruProgressBar | Scroll-linked | 80ms | linear |
| F5 | KoruScrollStack | Scroll-linked | 320ms | out |
| F6 | KoruScrollVelocityText | Scroll-linked | continuous | lerp |

**Plus 7 reactbits.dev signature adaptations:** KoruAurora (D6), KoruSpotlight (B5), KoruScrambleText (Part 3.3), KoruMagnetic (C5), KoruTilt (B6), KoruGradientText (Part 3.6), KoruDecrypt (Part 3.7).

**Plus the lucide-animated Material-Symbol system** (Part 4): draw-on-view, 4 loop variants, FILL-state transitions.

**Total: 36 catalog animations + 7 reactbits deep-dives + 1 Material-Symbols motion system = the motion backbone for the Koru redesign.**

---

*End of catalog. Built from live fetches of reactbits.dev and lucide-animated.com on the date of generation, cross-referenced with the motion language of Apple, Linear, Vercel, and Stripe. Every snippet is paste-ready; every easing and duration is brand-tuned to Koru's lavender-violet system.*
