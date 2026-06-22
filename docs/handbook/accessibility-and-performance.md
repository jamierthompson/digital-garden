# Accessibility & Performance

The non-negotiable constraints every agent honors when shipping UI here. This is a
**checklist you verify against**, not background reading. It does not re-explain the
OKLCH engine or the rendering model — for those, read
[`../architecture-plan.md`](../architecture-plan.md) §3.2 (engine) and §7 (Cache
Components / PPR) and the decisions they cite. This doc says _what an agent must check_
and _why it matters here_.

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

You **consume** these via tokens — the engine targets them, the harness asserts them. You
only check a row **by hand** in the rare "you must author a static color" case (§1 bullet
3). The table exists so the engine's targets and the harness's assertions share one source
of truth.

| Use                                               | WCAG 2.2 AA (floor, compliance) | APCA Lc (quality target)            |
| ------------------------------------------------- | ------------------------------- | ----------------------------------- |
| Body text                                         | ≥ **4.5:1** (1.4.3)             | **Lc 75** min / **Lc 90** preferred |
| Large text / headings (≥ 24px, or ≥ 18.66px bold) | ≥ **3:1** (1.4.3)               | **Lc 45**                           |
| Non-body content text                             | ≥ 4.5:1                         | **Lc 60**                           |
| UI components, borders, **focus ring**            | ≥ **3:1** (1.4.11)              | **Lc 30** spot-readable             |
| Disabled / placeholder                            | — (exempt)                      | **Lc 30**                           |
| Any non-text element                              | —                               | **Lc 15** floor (below = invisible) |

> **Large-text unit is _point_, not pixel.** WCAG 1.4.3 defines large-scale text as **18pt
> (≈ 24px) or 14pt bold (≈ 18.66px)** — the px values above are conversions. **18px body
> text is _not_ large** and needs the full 4.5:1, not 3:1. Sizing the bar in px understates
> it by ~6px / ~5px and ships non-conformant UI.
> ([W3C Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html))
>
> **APCA Lc tiers are a guideline, not a ratified threshold** — they're the APCA
> Readability Criterion / "Bronze" tiers, the candidate for WCAG 3. Cite **4.5:1** as a
> standard; cite **Lc 75** as a quality target.

APCA primary for text, WCAG 2.x ratios as the compliance fallback — exactly `[D4]`. These
targets are **proven by the Phase-1 visual contrast harness, owned by
[`./testing.md`](./testing.md)** (`[D19]`): the yellow/cyan stressers, both light and dark
schemes, the gamut-map-first ordering, and the "assert the measured number, don't snapshot
the CSS" rule all live there. **This doc owns the _targets_; testing owns the _harness_.**

---

## 2. Focus & interaction (WCAG 2.2 AA) `[D7]`

| SC                                     | Rule                                                  | What to check                                                                                            |
| -------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 2.4.7 Focus Visible                    | Keyboard focus must be visible                        | Use `:focus-visible`, never bare `:focus`. **Never `outline: none`** without an equivalent visible ring. |
| 1.4.11 Non-Text Contrast               | Focus ring ≥ 3:1 vs adjacent colors                   | Ring color is engine-emitted per island surface `[D7]` — consume it; don't recolor it ad hoc.            |
| 2.4.11 Focus Not Obscured (new in 2.2) | Focused element not fully hidden by sticky/overlay UI | Sticky shell nav / any sticky header must not cover the focused element.                                 |
| 2.5.8 Target Size (new in 2.2)         | Pointer targets ≥ **24×24** CSS px                    | Nav links, `/work` cards, embed controls. Treat 24×24 as a firm floor.                                   |

- **Focus-ring split:** _geometry_ (width, offset, style, the `:focus-visible` policy) is
  **global invariant** (§3.1); _color_ is the **engine token** `[D7]`. Don't move geometry
  into a scope or smuggle a focus color into the global reset.
- **2.5.8 spacing exception** exists (a target under 24px passes if a ≥24px-diameter circle
  centered on it doesn't overlap another target's circle) — but **don't reach for it to
  dodge the floor**. Default to 24×24; use the exception only with a deliberate reason.
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
levers above are decided now, so don't regress them in earlier phases. Per task, browser
spot-check the surface you touched for obvious CLS/paint regressions via the Chrome DevTools
MCP (§5) — lighter than, and distinct from, the Phase-4 budget pass `[D25]`.

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
pnpm build && pnpm start &        # serve the production build locally
sleep 3                           # let the server come up
curl -s http://localhost:3000/work/<slug> \
  | grep -o '<link rel="preload"[^>]*as="font"[^>]*>'
# Expect ONLY your 1–2 shell faces (match the filenames from src/fonts/roster.ts).
# A resolved per-project face in this output = the policy is defeated → investigate.
```

Diff the output against the known shell-face filenames. If a per-project face appears,
`preload: false` is missing somewhere or a face is being statically referenced where it
shouldn't be.

---

## 5. Browser verification via the Chrome DevTools MCP — required for rendered surfaces `[D25]`

Unit tests run in **jsdom**: it doesn't paint, can't render async RSCs
([`./testing.md`](./testing.md)), and measures nothing about focus visibility, tap-target size,
layout shift, or paint timing. So a green `pnpm test` + `pnpm build` is **not** evidence a
surface is accessible or unbroken in a real browser. **When a task ships or changes a rendered,
user-facing surface** — a route, a component's visual output, theming / `ProjectScope`, or any
focus/interaction state — **verify it in a real browser with the `chrome-devtools` MCP before
calling it done.** No login needed; serve the page first (`pnpm dev`, or `pnpm build &&
pnpm start` for production-faithful output), then drive the MCP.

**What to drive it through** (each maps to a check above):

- **Accessibility** — keyboard focus ring is **visible** (`:focus-visible`, 2.4.7), focus is
  **not obscured** by the sticky shell nav (2.4.11), tap targets clear **24×24 px** on nav /
  `/work` cards / embed controls (2.5.8, §2), and a Lighthouse a11y pass surfaces no
  semantics/contrast regression. The engine harness owns the **numeric** contrast proof
  (§1, [`./testing.md`](./testing.md)); this is the in-browser cross-check on the assembled page.
- **Layout & paint** — no unexpected **CLS** on load, and none on the _intentional_ per-project
  font swap (§3); media has reserved space; embeds are sized.
- **Flash-free theme** `[D11]` — the scoped theme `<style>` and the font `.variable` class are
  in the **initial HTML** (no FOUC on first paint), confirming `ProjectScope` rendered in the
  prerendered shell, not a streamed hole. The browser counterpart to §4's empirical `<head>` check.
- **Console** — no errors or warnings on the surface you touched.

**This is not the Phase-4 CWV budget pass** `[D17]`. That formal pass — asserting the LCP / INP
/ CLS budgets in §3 and the perf hardening — stays Phase 4. This per-task check is the lighter
_"did I obviously regress accessibility, layout, or the flash-free theme on the surface I just
touched"_; the a11y floor (§2) is always-on, so its verification is too. It is an
**agent-driven manual step, not a CI gate** (CI can't drive a browser) — the same status as
§4's `<head>` check. Committed automated coverage stays Vitest now / Playwright at Phase 3
([`./testing.md`](./testing.md), `[D18]`/`[D19]`).

---

## Agent quick-list (the traps)

1. **Don't hand-pick contrast.** Feed the engine; consume its tokens. Fixed ΔL is banned `[D4]`.
2. **Contrast is solved on the gamut-mapped color** (`[D6]` before `[D4]`) and **re-solved
   per scheme** (`[D5]`) — never one ratio reused across light/dark.
3. **Large text is measured in _points_** — 18pt (≈24px) / 14pt bold (≈18.66px). 18px body
   text needs the full **4.5:1**, not 3:1.
4. **APCA is not legal cover** — ship WCAG 2.2 AA as the floor, use Lc as the quality target.
   Don't claim "WCAG 3 compliant."
5. **`outline: none` without a visible replacement fails 2.4.7** — always pair with a
   `:focus-visible` ring ≥ 3:1.
6. **Don't expect per-project fonts to preload** — runtime `fontKey` defeats static
   analysis `[D11]`. Set `preload: false` and verify the `<head>` empirically.
7. **Sticky nav can obscure focus** (2.4.11); **tap targets ≥ 24×24px** (2.5.8) on
   nav / cards / embed controls.
8. **Don't bloat the `/work` query** — keep it essay-free to protect LCP (§6).
9. **The contrast harness lives in [`./testing.md`](./testing.md)** — this doc owns the
   targets, testing owns the assertions. Don't restate the harness spec here.
10. **Browser-verify any rendered surface** with the `chrome-devtools` MCP before done — focus
    visibility, tap-size, CLS, flash-free theme, clean console (§5). jsdom proves none of it `[D25]`.

---

_Related: [`./security-and-ops.md`](./security-and-ops.md) (secrets, Sanity tokens, Vercel
ops), [`./definition-of-done.md`](./definition-of-done.md) (the ship gate),
[`./testing.md`](./testing.md) (the Phase-1 contrast harness). Architecture:
[`../architecture-plan.md`](../architecture-plan.md) §3.1–3.2, §5, §7 ·
[`../decisions.md`](../decisions.md) `[D4]` `[D5]` `[D6]` `[D7]` `[D11]` `[D17]` `[D19]` `[D25]` ·
[`../build-phases.md`](../build-phases.md) Phases 0.5 / 1 / 4._
