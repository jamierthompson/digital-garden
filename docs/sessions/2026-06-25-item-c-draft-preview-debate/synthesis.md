# Synthesis — Item C draft-preview blocking-route fix (lead's verdict)

> **[Superseded in part — 2026-06-26, applies to this whole debate folder]** The conclusion that the
> body `<Suspense>` deferral "licenses"/"rescues" `generateMetadata` (the "other parts defer → metadata
> streams" mechanism, recurring across the round drafts here) was **refuted** by a later spike:
> `generateMetadata`'s `use cache` read is independently legal; the boundary is load-bearing for the
> async **body** read only. See
> [`../2026-06-26-shell-sourcing-islands/spike-findings.md`](../2026-06-26-shell-sourcing-islands/spike-findings.md).
> The fix that shipped stands; the mechanism was mis-attributed.

Three lenses (FrameworkFit, Architect, ShellGuardian) drafted independently, then re-evaluated
against lead-run experiments (C1/C2, real `__prerender_bypass` cookie, tree reverted clean).
Next 16.xx / React 19.xx, Cache Components on.

## Settled by evidence (no remaining dispute)

- **Cause:** under Draft Mode, Cache Components bypasses `use cache` (`use-cache.md` §Draft Mode), so
  `sanityFetch(SITE_SETTINGS_QUERY)` is uncached at two un-`<Suspense>`'d sites — `generateMetadata`
  (`layout.tsx:39`) and the `RootLayout` body (`:67`). Both are independent instances (proven: neutralize
  metadata → error moves to the body).
- **C2:** `'use cache'` on `generateMetadata` _alone_ suppresses the `:39` error (error moves to `:68`).
  The marker satisfies the build-time blocking-route guard (`caching.md:292`) even though Draft Mode
  bypasses the cache at runtime — _runtime-bypass ≠ guard-no-op_. **FrameworkFit's "no-op" REFUTED;
  FrameworkFit conceded.** But it's only half a fix (body still breaks).
- **C1:** body `<Suspense>` (extracted `ShellTheme`) _alone_, metadata untouched → draft `GET /` clean
  at BOTH sites. Once the body defers, metadata rides the sanctioned "other parts also defer → metadata
  streams" branch (`generate-metadata.md:1260`). **Architect/FrameworkFit hypothesis CONFIRMED.**
- **Published `[D11]` bar (dev curl):** brand `@layer brand` + `--brand-*` OKLCH inline in `<head>` at
  byte zero, zero streaming markers, Suspense a no-op on published, CSS import block untouched.
  **ShellGuardian's worst case refuted; objection withdrawn** (contingent on a _build-artifact_ recheck).

## The core fix (UNANIMOUS)

Extract the body read + `ProjectScope` into an async `ShellTheme`, wrap it in ONE in-`<body>`
`<Suspense>` with a **non-empty themed fallback** (empty seed → engine fallback palette, `[D9]`).
`ShellTheme` defined **inline** in `layout.tsx`; only new import is `import { Suspense } from "react"`
(a binding import — does NOT disturb the `[D12/D27]` side-effect import order; confirmed by curl + by
the invariant's own rule). Published stays static; draft streams the correct brand behind the fallback
(a draft-only, editor-iframe-only flash — the irreducible cost of the framework trilemma).

## The one genuine disagreement — RESOLVED

**Also add `'use cache'` to `generateMetadata`?** Architect: yes (dissolve the body→metadata coupling).
FrameworkFit + ShellGuardian: no (redundant; don't-build-until-forced).

**Verdict: NO — ship the minimal body-`<Suspense>`-only fix; do NOT add `'use cache'` to metadata.**
Decisive reasoning (beyond the 2-1):

1. C1 proves body-Suspense-only is complete. Adding the directive changes NOTHING on published (the
   inner `sanityFetch` is already cached there) and NOTHING on draft (bypassed) — its sole effect is to
   make the metadata site pass the guard _independently of the body deferring_.
2. The coupling's only failure mode is a **runtime-under-draft** regression — and `pnpm build` does
   **not** catch it (build prerenders the published path; the draft error is runtime-only). So a
   **runtime draft-render check is required regardless — for the BODY site, which the dissolve does not
   protect.** That required check ("draft `GET /` error-free at BOTH sites") _already covers_ the
   metadata coupling. The directive is therefore redundant with a check we must run anyway.
3. One mechanism is conceptually clearer ("the body Suspense defers the shell under draft" — one idea)
   than two draft-deferral mechanisms for the same data.

**Architect's insight is preserved, not discarded:** `'use cache'` on `generateMetadata` is the
sanctioned one-line **decoupling escalation** — apply it IF a future Next narrows the "other parts
defer → metadata streams" rule, OR if the runtime draft check proves infeasible to keep green.
Record in `decisions.md`. (FrameworkFit's "it masks the coupling" objection does NOT hold — removing
the body Suspense still fails loudly at the body, C2 — so the escalation is safe if ever needed.)

**Also dropped (unanimous):** the `connection()` dynamic-marker backstop — C1 proved it unnecessary;
it would re-derive the draft branch outside `sanityFetch` and scatter `connection()`. Record as the
deeper fallback only.

## Pre-merge bar (consolidated; `[D26]` QA owns the runtime/build items)

1. `pnpm build` succeeds AND classifies `/` as a prerendered/static-shell route (not `ƒ Dynamic`).
2. `next start` (built server) curl of published `/` reproduces byte-zero brand OKLCH tokens + zero
   streaming markers; byte-equivalent to pre-change in the brand-token region.
3. **Draft content-correctness (the single biggest open risk, `[D16]`):** real Sanity draft edit
   (title + brandColor) + real `__prerender_bypass` cookie → `GET /` reflects the EDITED values, not
   merely error-free. Verify the shell (siteSettings), per the all-content-incl-shell requirement.
4. Load-bearing comment on the `<Suspense>` boundary (mirror the import-order comment style):
   it also licenses `generateMetadata` to stream under Draft Mode (cite `generate-metadata.md`
   §"With Cache Components"); don't add a `siteSettings` read outside `ShellTheme`/the boundary.
5. A committed draft-render regression check asserting `/` is blocking-route-error-free at both sites
   (E2E/runtime — async-RSC draft render is jsdom-untestable, `[D25]`; if a unit-level static
   tripwire is the only feasible CI guard, assert the `<Suspense>` boundary exists + read-site count).
6. Eyeball the `[D9]` themed fallback so the draft-only flash is fallback-brand → real-brand, not
   unstyled.
7. Full AGENTS.md gate green, incl. `layout.import-order.test.ts`.

## Net

Minimal, evidence-backed, one mechanism. The design risk is retired; the residual risk moved OFF the
published shell and ONTO draft content-correctness (#3) — which the prior session never verified and
which is the first thing implementation must prove.
