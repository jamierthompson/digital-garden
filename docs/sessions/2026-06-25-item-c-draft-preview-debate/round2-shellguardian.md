# Round 2 — ShellGuardian (skeptic re-evaluation after empirical bar)

## (a) Fix A (body `<Suspense>` only) — objection WITHDRAWN, with ONE residual gate

The dev-curl directly satisfied the HTML-bytes core of my bar: `data-precedence="brand"` `@layer brand`
style + full `--brand-*` OKLCH inline in `<head>` at byte zero, **zero** streaming markers
(`<template id="B:`, `$RC=`, `hidden id="S:` all absent), Suspense a proven no-op on the published
path, CSS import block untouched (no `[D12/D27]` regression). That refutes my worst-case fears
(boundary leaking above `<body>`, brand tokens relegated to a streamed chunk). **I withdraw the
published-shell objection to Fix A.**

**The one place I do NOT fully release: dev-render ≠ build artifact.** My bar step 1 (`pnpm build`
classifies `/` as a static-shell/PPR route, not `ƒ Dynamic`) was explicitly **not run**. `[D11]` is a
promise about the **build-time prerendered document served from the edge**, and a dev-server curl is a
_proxy_ for that, not the artifact — Cache Components / PPR can classify differently under
`next build` than under on-demand dev rendering. This is precisely the "verified in the wrong
environment" shape the worktree-trap warned about. So: **withdrawn on the published HTML shape;
contingent on the build classification + a curl of the _built_ server (`next start`) reproducing the
same byte-zero brand tokens with zero streaming markers.** That is the only residual published risk,
and it is cheap to close.

Note this is NOT a new risk Fix A introduces: today's published path already relies on the build
reaching Sanity to bake brand tokens (baseline published `/` is clean). Fix A doesn't change that
dependency — it just adds a Suspense the build must still classify as a transparent no-op. Confirm,
don't assume.

## (b) `'use cache'` on `generateMetadata` — REDUNDANT, I withdraw it

C1 empirically confirmed the auto-rescue: body Suspense alone clears BOTH sites. So my metadata fix
loses both its rationales:

- **Suppress the metadata error** → redundant; the body deferral does it (`generate-metadata.md:1260`
  "other parts also defer → metadata streams").
- **Keep the published `<head>` static** → already true without it; the published curl showed real
  OKLCH in `<head>`, zero streaming markers, because nothing defers on the published path.

And my belt-and-suspenders "static `<head>` under DRAFT" rationale is **outright false**: under Draft
Mode `'use cache'` is bypassed (`use-cache.md:217`), so `generateMetadata` re-executes uncached and
its head **streams regardless** — `'use cache'` cannot make the draft head static. It also fails as a
guard against Architect's coupling regression (§3.1): if a future dev makes the body static again
under draft, a `'use cache'` metadata fn — being bypassed under draft — **still** trips the
blocking-route error. So it guards nothing.

Does a streamed draft `<head>` even matter? **No** — the draft head renders only inside the editor's
Presentation iframe; streamed title/OG there is invisible to the public and immaterial to the editor.
**Verdict: drop it.** Adding it is unjustified churn against don't-build-until-forced. FrameworkFit was
wrong that `'use cache'` is a no-op for the _guard_ (C2 refuted that), but right that it's the wrong
tool for _this_ fix.

## (c) Exact remaining pre-merge checks

The two the lead already flagged are necessary; here is the full bar I'd gate merge on:

1. **`pnpm build` route classification** — `/` emitted as prerendered/static-shell (PPR), NOT
   `ƒ Dynamic`. (The artifact `[D11]` is actually about; closes my residual (a).)
2. **Built-server raw-HTML re-check** — `next start` then `curl` published `/`: brand `@layer brand`
   style + full `--brand-*` OKLCH in `<head>` at byte zero, **zero** streaming markers. Production
   build, not dev. (Closes dev≠build.)
3. **Published byte-equivalence diff** — brand-token region of the _built-server_ published curl
   byte-equivalent before vs after Fix A. Proves nothing relocated out of the static shell.
4. **Draft content-correctness** — with a REAL Sanity draft edit to `siteSettings` (title + brandColor)
   and the real `__prerender_bypass` cookie, `GET /` must reflect the EDITED draft values in the
   response (streamed `<title>` AND the brand OKLCH token). Error-clean (C1) is necessary but NOT
   sufficient — the requirement is that the draft VALUE shows (`[D16]`, the whole point of Phase-3
   preview for the shell). This is the single biggest still-open item.
5. **Coupling guard (now mandatory, not optional)** — a load-bearing comment on the Suspense noting it
   also licenses `generateMetadata` to stream under draft, PLUS a committed draft-render test asserting
   `/` renders without the blocking-route error under Draft Mode. The metadata rescue is an _implicit
   cross-site_ dependency; without a pinned test it silently regresses. ([D26] QA writes this.)
6. **Full AGENTS.md gate** — lint / lint:css / lint:keys / lint:docs / format:check / typecheck / test
   (incl. `layout.import-order.test.ts` staying green) / Studio typegen diff / `pnpm build`.
7. **Draft fallback eyeball** — confirm the Suspense fallback renders the themed `[D9]` fallback
   (engine palette), so the draft-only flash is fallback-brand→real-brand, not unstyled→brand.
   Editor-only, low stakes, but cheap to verify in the iframe.

## Net

Fix A is the minimal complete fix and my published-shell objection is withdrawn on the HTML evidence,
gated only on the build-classification re-check (#1/#2). `'use cache'` on metadata: dropped as
redundant and ineffective-under-draft. The real open risk is no longer the published shell — it's
**draft content-correctness (#4)**, which error-clean does not prove.
