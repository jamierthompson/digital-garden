# Synthesis — Consolidated Verdict

Conclusions from the five-auditor audit and debate. For the underlying reports see
`round-1-independent-findings.md` and `round-2-debate.md`; for the quick-reference
decision list see `../decisions.md`.

## Verdict

The foundation is **sound and unusually well-reasoned** — the core machinery (pure
OKLCH engine, reference-by-key, the `ProjectScope` keystone, deferred-by-design
phasing) survived scrutiny, and the framework reading is accurate where most plans
drift. But the plan is **over-conceptualized in two places and under-specified in the
one that matters most**: the color engine. The fixes are surgical, not a redesign.

---

## The high-leverage decisions the debate forced

### 1. Token model → three tiers (Architect ⇄ Theming, both moved)

The §3.1 axiom "no global themeable values; each island carries a complete,
self-described foundation" is over-broad. What actually varies per project is **brand
color, font, and the feel/geometry set** — not spacing, type-scale ratios, motion, or
breakpoints (house style).

| Tier                 | Lives at                         | Contents                                                                      |
| -------------------- | -------------------------------- | ----------------------------------------------------------------------------- |
| Invariant foundation | global `:root`                   | spacing, motion, breakpoints, z-index, type-scale ratios, **semantic colors** |
| Brand + font         | `[data-project]` engine-scoped   | OKLCH ramp + resolved face — always scoped, always flash-free                 |
| Feel/geometry        | `[data-project]` scoped override | radius, border weight, shadow, density — defaults from tier 1                 |

Rewrite §3.1 from "no global themeable values" to **"no global brand/feel values;
invariant foundation is global."** This dissolves Architect's F2 (the coordination
layer is just tier 1) and shrinks each island's `<style>` to the brand ramp.

**The public token contract is the generic layer** — `--brand-*`, `--font-face`,
`--space-*`. `--logx-*` is an internal project alias, not the contract a shared
cross-project embed codes against. (Resolves Architect F1.)

### 2. OKLCH trilemma → bake `oklch()` literals server-side (Theming landed; Architect agreed)

{pure server engine, live per-token CSS override, contrast guarantee} — pick two.
**Live override isn't needed** (no consumer relies on CSS cascade re-derivation; the
playground and card swatches re-run the pure function in JS). So:

- Bake contrast-solved, gamut-mapped literals server-side.
- Relative-color CSS (`oklch(from …)`) only for decorative, non-contrast deltas.
- Keep `var(--public, var(--_internal-default))` for downward primitive theming;
  drop the §1/§3.3 "generalizes to the whole system" / live-re-derivation claim.

### 3. The engine is the root risk and is under-specified — decide now (signature-blocking)

- **Dark mode → decide the engine signature now** (`brandColor` vs `(brandColor,
scheme) → tokenSet`; single set vs `light-dark()`). Even "light-only for v1" must be
  explicit. Do not store per-scheme colors on the doc; at most an optional
  `brandColorDark` override.
- **Contrast must be SOLVED, not stepped** — binary-search L to a target (APCA Lc,
  WCAG fallback) against a given background, _after_ gamut-mapping. Fixed ΔL passes for
  blue and fails for yellow/cyan.
- **Gamut-map before contrast math** (cusp-aware); pick P3-vs-sRGB target explicitly.
- **Focus-ring color is an engine token** (contrast-solved); geometry stays global.
- **Semantic colors are NOT brand-derived** — tier-1 seed; build later.
- **Phase 1 exit = a visual + contrast-assertion harness** over 3–4 hue-spanning
  colors (incl. yellow + cyan), not "runs identically server/client."

### 4. `brandColor` is a data-quality 500 risk — three layers

ProjectScope is a Server Component; a bad color that throws bubbles to `global-error`
(whole document). **`error.tsx` does NOT catch its own segment's layout throw — and
ProjectScope is a layout wrapper.** So:

1. **Defensive engine** — parse/clamp/gamut-validate; return a fallback palette, never
   throw.
2. **Author-time Sanity validation** using the engine's own color pipeline.
3. **`unstable_catchError`** (`next/error`) wrapping ProjectScope as the backstop.

### 5. Reference-by-key drift — close the seam

**Blocking before Phase 2:** `keys.ts` is the single source of truth; resolvers typed
`satisfies Record<Key,…>` (missing entry = compile error); resolvers return typed
`NotFound`; render seams show fallbacks (`not-found.tsx`; "missing embed" placeholder).
**Deferrable to Phase 4:** GROQ-published-keys-vs-code CI check; key-rename migrations.

**Embed rule:** generic `liveEmbed(embedKey+caption)` is the default; a widget gets its
own typed block only for genuine editorial _content_; never model code config as a
block or props blob.

### 6. Fonts → `preload: false` by default

Runtime `fontKey` resolution defeats Next's build-time per-route preload. Set
`preload:false` on all roster faces; only 1–2 shell faces preload in the root layout;
apply the resolved face via its `.variable` class; `--logx-font` maps to it.
**Open decision:** if `/work/<slug>` is SSG via `generateStaticParams`, preload is
recoverable — pin down SSG-vs-dynamic, then run the empirical `<head>` check.

### 7. `@layer` cascade trap — VERIFIED

Next does not auto-layer CSS Modules; an unlayered module silently outranks every
`@layer project` style. Lint-enforce that every CSS Module wraps its body in `@layer`
(or stays strictly var-consuming); declare `@layer foundation, brand, project;` in a
global sheet loaded first; the engine's `<style>` declares `@layer brand`.

### 8. Sequence by risk-retirement, not dependency topology

Add **Phase 0.5 walking skeleton** (stub ProjectScope, no engine) targeting the two
version-dependent unknowns (React 19 `<style precedence>`+Suspense flush; @layer vs
unlayered cascade) + the no-throw path. **The first real slice (Phase 3) is a
dead-simple project** (a trivial real entry that isolates the routing/Sanity/RSS
machinery against real data); **`oklch-engine` moves to the second slice (Phase 4)**,
where it does its self-validating-showcase job and doubles as the "a second project
ships without touching the first" proof. Bundle guardrails (CI, boundary lints, @layer
lint, key-drift check) into Phase 0. Co-locate tests per phase.
`error/not-found/loading` + `generateMetadata` land in Phase 3. Full `log-explorer`
migration stays Phase 4 but a fit-spike in Phase 2 pulls the learning forward. See
`../decisions.md` D17 and the closing artifact in `round-2-debate.md` (Sequencing) for
the full revised phase list.

---

## Smaller confirmed items

- **Visual editing × live embeds:** disable Sanity **stega** on `brandColor`/`fontKey`
  (invisible chars break OKLCH parse + font lookup); `liveEmbed` click-to-edit is
  caption-only.
- **Backlinks:** `references()` only finds **real `reference` fields** — model
  inter-note links as references, not slug strings.
- **Breakpoints** can't be `:root` custom props feeding `@media` — use container
  queries / build-time constants.
- **Headless `core/`:** let it emerge when logic warrants; don't pre-carve it into
  every module template.
- **RSC code-splitting (§4.2):** Server Components auto-split; registry values must be
  literal `() => import("@/projects/<slug>")`, never templated.
- **Isomorphic engine enforcement:** lint boundary forbidding `next/*`/`react`/DOM/Node
  in `src/lib/oklch/` + dual-env Vitest (node + jsdom). Not `server-only`/`client-only`.

---

## What everyone agreed is genuinely good — preserve it

The pure, isomorphic, dependency-free **OKLCH engine with clean dependency direction**;
the **reference-by-key + `keys.ts`/resolver split** (real Studio-bundle benefit); the
**server-rendered scoped `<style>` as genuinely flash-free for color** (verified — no
hydration hack); the **essay-free `/work` query**; and the **deferred-by-design
discipline**. The bones are strong.

## Resolved by the user (2026-06-21)

1. **Dark mode is in scope from v1** — the engine is scheme-aware
   (`(brandColor, scheme) → tokenSet`), emitting both schemes via `light-dark()`. See
   D5.
2. **Static/dynamic is component-level, not route-level** — the "SSG vs dynamic for
   `/work/<slug>`" question is obsolete under Next 16 `cacheComponents` (verified
   against the installed docs). `ProjectScope` renders in the prerendered shell
   (`use cache`); font preload stays `preload:false`-default because face _targeting_
   is a build-time-static-analysis question independent of caching. Tied decision:
   enable `cacheComponents` app-wide. See D11.
