# Accessibility & Performance

The non-negotiable constraints every agent honors when shipping UI here. This is a
**checklist you verify against**, not background reading. It does not re-explain the
OKLCH engine or the rendering model — for those, read
[`../../../architecture-plan.md`](../../../architecture-plan.md) §3.2 (engine) and §7
(Cache Components / PPR) and the decisions they cite. This doc says _what an agent must
check_ and _why it matters here_.

> Conformance target: **WCAG 2.2 Level AA** (W3C Recommendation, Oct 2023 — the current
> stable version and the legal baseline in most regions). **APCA / Lc** is the perceptual
> _quality_ target, layered on top — it is **not** legal cover (it's the candidate method
> for the still-unreleased WCAG 3). Ship AA as the floor; aim for APCA Lc.

---

## 1. Contrast — solved by the engine, not stepped by you `[D4]`

The hard part is automated. The engine takes a **contrast target** and binary-searches
lightness `L` for on-brand / on-surface pairs against the _relevant background_, on the
**gamut-mapped** color (`[D6]`: gamut-map _before_ contrast math), re-solved per scheme
(`[D5]`). See §3.2. What this means for you:

- **Never hand-pick a contrast pair or a fixed ΔL offset.** Equal ΔL ≠ equal contrast
  across hues (OKLCH `L` is perceptual lightness, not WCAG luminance or APCA Lc). A fixed
  step that passes for blue fails for yellow/cyan. Feed the engine a brand color; consume
  the token it emits. `[D4]`
- **Read the engine's emitted tokens** (`var(--brand-*)`, focus-ring color `[D7]`) — do
  not invent a foreground color in a CSS Module and hope it clears 4.5:1.
- **If you must author a static color** (rare — semantic/signal colors `[D8]`, decorative
  hairlines), it's _your_ job to verify the ratio. Decorative tints via
  `oklch(from …)` are permitted **only** for non-contrast deltas `[D3]`.

### Targets to check against

| Use                                         | WCAG 2.2 AA (floor, compliance) | APCA Lc (quality target)            |
| ------------------------------------------- | ------------------------------- | ----------------------------------- |
| Body text                                   | ≥ **4.5:1** (1.4.3)             | **Lc 75** min / **Lc 90** preferred |
| Large text / headings (≥ 18px or 14px bold) | ≥ **3:1** (1.4.3)               | **Lc 45**                           |
| Non-body content text                       | ≥ 4.5:1                         | **Lc 60**                           |
| UI components, borders, **focus ring**      | ≥ **3:1** (1.4.11)              | **Lc 30** spot-readable             |
| Disabled / placeholder                      | — (exempt)                      | **Lc 30**                           |
| Any non-text element                        | —                               | **Lc 15** floor (below = invisible) |

APCA primary for text, WCAG 2.x ratios as the compliance fallback — exactly `[D4]`. The
**Phase-1 visual harness is where this is proven**: ramps for 3–4 hue-spanning brand
colors (must include a **yellow and a cyan** — the contrast stressers), **both light and
dark**, asserting Lc / ratio on every text-on-surface and on-brand pair _after_
gamut-mapping (§3.2, build-phases Phase 1) `[D17]`. Don't snapshot the CSS — assert the
measured number so a failure means the contrast actually broke.

---

## 2. Focus & interaction (WCAG 2.2 AA) `[D7]`

| SC                                     | Rule                                                      | What to check                                                                                            |
| -------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 2.4.7 Focus Visible                    | Keyboard focus must be visible                            | Use `:focus-visible`, never bare `:focus`. **Never `outline: none`** without an equivalent visible ring. |
| 1.4.11 Non-Text Contrast               | Focus ring ≥ 3:1 vs adjacent colors                       | Ring color is engine-emitted per island surface `[D7]` — consume it; don't recolor it ad hoc.            |
| 2.4.11 Focus Not Obscured (new in 2.2) | Focused element not fully hidden by sticky/overlay UI     | Sticky shell nav / any sticky header must not cover the focused element.                                 |
| 2.5.8 Target Size (new in 2.2)         | Pointer targets ≥ **24×24** CSS px (or adequately spaced) | Nav links, `/work` cards, embed controls.                                                                |

- **Focus-ring split:** _geometry_ (width, offset, style, the `:focus-visible` policy) is
  **global invariant** (§3.1); _color_ is the **engine token** `[D7]`. Don't move geometry
  into a scope or smuggle a focus color into the global reset.
- For browsers without `:focus-visible`, mirror the rule inside
  `@supports not (selector(:focus-visible))`.

---

## 3. Core Web Vitals budgets

"Good" at the **75th percentile**, mobile + desktop ([web.dev/vitals](https://web.dev/articles/vitals)):

| Metric                                                 | "Good"       |
| ------------------------------------------------------ | ------------ |
| **LCP** Largest Contentful Paint                       | ≤ **2.5 s**  |
| **INP** Interaction to Next Paint (replaced FID, 2024) | ≤ **200 ms** |
| **CLS** Cumulative Layout Shift                        | ≤ **0.1**    |

The architecture already buys most of this — don't undo it:

- **Keep the `/work` index query essay-free** (§6): it pulls `blurb` / `brandColor` /
  `fontKey`, never the essay. Small index payload protects **LCP**. Don't add the essay to
  the card query "for convenience."
- **Keep `ProjectScope` in the prerendered shell** (PPR via Cache Components `[D11]`, §7):
  themed `<style>` + font class land in the **initial static HTML** (flash-free); the
  essay/notes stream. Don't push the scope into a streamed hole.
- **Don't introduce layout shift.** `next/font`'s size-adjusted fallback gives zero CLS; a
  per-project display face swaps _intentionally_ on navigation (§5) — that's by design, not
  a CLS bug. Reserve space for media; size embeds.

**CWV is verified in Phase 4, not gated early** (`[D17]`, build-phases Phase 4) — but the
levers above are decided now, so don't regress them in earlier phases.

---

## 4. Font-preload policy `[D11]` §5 — the load-bearing, counter-intuitive rule

This is the rule agents get wrong from stale instinct. Read §5 and `[D11]` before touching
the roster.

- **`preload: false` on every roster face.** The `next/font` default is `true`, so you
  must set `false` **explicitly** on each face in `src/fonts/roster.ts`.
- **`preload: true` only on the 1–2 shell faces** declared in the **root layout** — they
  apply on every route.
- **Why per-project faces can't be preloaded:** `next/font` preload injection is a
  **build-time static transform** keyed to a _statically referenced_ font object.
  `roster[fontKey].variable` is a **runtime index** Next can't target. This is a
  _static-analyzability_ question — **not** SSG-vs-dynamic (that route toggle is gone under
  Cache Components `[D11]`). Caching bakes the resolved className into the HTML but emits
  **no** `<link rel=preload as=font>` for a face it couldn't statically identify.
- **Per-project faces are applied, not preloaded:** `.variable` on the `[data-project]`
  scope, `--logx-font` maps to it; they tolerate `font-display: swap` below the fold.
- **If an above-the-fold project face genuinely must preload,** emit
  `<link rel="preload" as="font" crossorigin>` **manually** — `crossorigin` is required
  for fonts even same-origin.
- Prefer **variable fonts** (one file, many weights).

**Empirical verification (do this, don't assume) — Phase 0.5 inspection `[D11]`:**

```bash
pnpm build
# visit /work/<slug>, view-source the <head>, then count preload links:
```

Expect `<link rel="preload" as="font">` for the **shell faces only**. If a resolved
per-project face shows up, the policy is being defeated — investigate.

---

## Agent quick-list (the traps)

1. **Don't hand-pick contrast.** Feed the engine; consume its tokens. Fixed ΔL is banned `[D4]`.
2. **Contrast is solved on the gamut-mapped color** (`[D6]` before `[D4]`) and **re-solved
   per scheme** (`[D5]`) — never one ratio reused across light/dark.
3. **APCA is not legal cover** — ship WCAG 2.2 AA as the floor, use Lc as the quality target.
   Don't claim "WCAG 3 compliant."
4. **`outline: none` without a visible replacement fails 2.4.7** — always pair with a
   `:focus-visible` ring ≥ 3:1.
5. **Don't expect per-project fonts to preload** — runtime `fontKey` defeats static
   analysis `[D11]`. Set `preload: false` and verify the `<head>` empirically.
6. **Sticky nav can obscure focus** (2.4.11); **tap targets ≥ 24px** (2.5.8) on
   nav / cards / embed controls.
7. **Don't bloat the `/work` query** — keep it essay-free to protect LCP (§6).

---

_Related: [`./security-and-ops.md`](./security-and-ops.md) (secrets, Sanity tokens, Vercel
ops), [`./definition-of-done.md`](./definition-of-done.md) (the ship gate),
[`./testing.md`](./testing.md) (the Phase-1 contrast harness). Architecture:
[`../../../architecture-plan.md`](../../../architecture-plan.md) §3.1–3.2, §5, §7 ·
[`../../../decisions.md`](../../../decisions.md) `[D4]` `[D5]` `[D6]` `[D7]` `[D11]` ·
[`../../../build-phases.md`](../../../build-phases.md) Phases 0.5 / 1 / 4._
