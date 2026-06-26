# Session — Item C: draft-preview blocking-route fix (debate → experiment → fix)

> **[Superseded in part — 2026-06-26]** This record's framing that the body `<Suspense>` deferral
> "licenses"/"rescues" `generateMetadata` (the "other parts defer → metadata streams" mechanism) was
> **refuted** by a later spike: `generateMetadata`'s `use cache` read is independently legal; the
> boundary is load-bearing for the async **body** read only. See
> [`./2026-06-26-shell-sourcing-islands/spike-findings.md`](./2026-06-26-shell-sourcing-islands/spike-findings.md).
> The fix itself (the boundary + unthemed fallback) stands; only the _why-it-works_ mechanism was
> mis-attributed.

**Date:** 2026-06-25 · **Shape:** solo lead + a 3-agent adversarial design debate (read-only, no
worktrees) → lead-run experiments → solo implementation → fresh blind QA `[D26]`. · **Versions:**
Next 16.xx / React 19.xx, Cache Components on.

## Why

The last open blocker on Phase 3: **Item C** in [`../build-phases.md`](../build-phases.md) — with
Sanity Draft Mode ON, the shell root layout threw a Cache-Components **blocking-route** error
(`Uncached data … was accessed outside of <Suspense>`), so in-product Preview of the site was broken.
The prior session (PR #21) found the symptom but recorded **no suspected fix on purpose** (to avoid
confirmation bias), and the draft path had never been runnable locally (no read token, no Preview
entry point). This session had both — a `SANITY_API_READ_TOKEN` in `.env.local` and the
`presentationTool` wired (PR #24) — so the bug was reproducible for the first time.

## Shape

Diagnosis was a single-surface read-only job; the **fix design** was the interesting part, with a
real tension (preserve the published static shell **and** make draft preview correct), so the user
asked for an **adversarial design debate**. Three lens-teammates drafted independently, then
re-evaluated against lead-run experiments. No worktrees (read-only debate → no parallel-edit risk →
`acceptEdits` applied cleanly in the main tree). The fix itself was solo (`layout.tsx` + a `ShellNav`
font fallback + two test files), then a fresh blind QA pass that caught a ship-blocker (below).

### Exact cause (empirically reproduced, from first principles)

`sanityFetch` is a `"use cache"` function. On the **published** path the shell `siteSettings` read is
cached → completes during prerender → ships in the static HTML. Under **Draft Mode**, Cache
Components **bypasses `use cache`** (re-executes uncached every request — `use-cache.md` §"Draft
Mode"), so the read becomes request-time data at **two** un-`<Suspense>`'d sites in `layout.tsx`:
`generateMetadata` and the `RootLayout` body. Cache Components forbids uncached data during prerender
unless wrapped in `<Suspense>` or marked `use cache` (`caching.md` "blocking-route") → the error.
Proven scope: neutralize metadata → the error **moves** to the body; both sites are independent
instances. Published is clean because the cache is live.

### The debate — round 1 (independent drafts)

Three lenses, each drafting blind to the others (full drafts in the companion trail):

- **FrameworkFit** (what Next 16 actually sanctions): body read → async child in `<Suspense>` with a
  real fallback; hypothesized the body deferral **also** clears the metadata error via the "other
  parts also defer → metadata streams" branch (`generate-metadata.md` §"With Cache Components"), flagged
  as verify-by-repro. Asserted `'use cache'` on `generateMetadata` is a **no-op** for the error.
- **Architect** (where the branch belongs): the published/draft branch already lives in `sanityFetch`;
  the only gap is a render-time boundary. Extract `ShellTheme`, wrap in one `<Suspense>`; one boundary
  fixes both. Honest cost flagged: metadata's legality becomes coupled to the body deferring.
- **ShellGuardian** (devil's advocate, defends `[D11]`): framed the **trilemma** (Suspense→draft
  flash / degrade→wrong brand / block→today's error; no fourth door). Hard-blocked any `connection()`
  at the layout root or `<Suspense>` above `<body>` (deletes the static shell). Preferred `'use cache'`
  on `generateMetadata`; insisted on a raw-HTML (`curl`, not DOM) + build-classification verification bar.

### The experiments (lead ran them; tree reverted clean)

The crux claims were **runtime-testable**, so rather than let the team duel over predictions, the lead
reproduced real Draft Mode (the actual `__prerender_bypass` cookie) and tested:

- **C2** — `'use cache'` on `generateMetadata` ALONE: the `:39` error is **suppressed**; it moves to
  the body. → The `use cache` _marker_ satisfies the prerender guard even though Draft Mode bypasses
  the cache at runtime (`caching.md` "blocking-route": error fires only if data "isn't wrapped in
  `<Suspense>` **or marked with `use cache`**"). **FrameworkFit's "no-op" refuted; ShellGuardian right;
  but only half a fix** (body still breaks).
- **C1** — body `<Suspense>` (extracted `ShellTheme`) ALONE, metadata untouched: draft `GET /` **clean
  at both sites**. → **Architect/FrameworkFit's auto-rescue hypothesis confirmed** (`generate-metadata.md`
  §1260). One boundary fixes both.
- **Published `[D11]` bar** — raw `curl` of published `/`: brand `@layer brand` + `--brand-*` OKLCH
  inline in `<head>` at byte zero, **zero** streaming markers, Suspense a no-op on published, CSS import
  block untouched. ShellGuardian's worst case refuted.

### Round 2 (re-evaluation against the evidence)

- **FrameworkFit** conceded the "no-op" (runtime-bypass ≠ guard-no-op); endorsed body-`<Suspense>`-only;
  added that the guard runs at **build** time too, so dev-curl is weaker → demanded `pnpm build` classify
  `/` static.
- **ShellGuardian** **withdrew** its objection on the HTML evidence (contingent on the build re-check)
  and **withdrew** its own `'use cache'`-on-metadata (conceding its "static `<head>` under draft"
  rationale was false — bypassed under draft). Shifted the real residual risk **off the shell onto draft
  content-correctness**.
- **Architect** went the other way — argued to **add** `'use cache'` on `generateMetadata` to _dissolve_
  the body→metadata coupling (defense in depth), with a comment + source-order test.

### Synthesis verdict (lead; the one genuine disagreement resolved, not smoothed)

**Ship the minimal one-mechanism fix: body `<Suspense>`/`ShellTheme` only; do NOT add `'use cache'`
to `generateMetadata`.** Decisive reasoning beyond the 2-1: the coupling can only regress at
**runtime under draft**, which `pnpm build` does **not** catch — so a runtime draft check is required
**regardless** (for the body site, which the directive doesn't protect), and that required check
already covers the metadata coupling. The directive is redundant with work we must do anyway, and one
mechanism is conceptually clearer. **Architect's insight is preserved** as the sanctioned one-line
**escalation** (apply iff a future Next narrows the auto-rescue rule) — recorded in
[`../decisions.md`](../decisions.md). The `connection()` marker was dropped entirely (C1 proved it
unnecessary). Full verbatim trail (round-1 drafts, the C1/C2 experiment findings, round-2
re-evaluations, synthesis, QA log):
[`2026-06-25-item-c-draft-preview-debate/`](./2026-06-25-item-c-draft-preview-debate/).

## Outcome

**Fix (`src/app/layout.tsx` + `ShellNav.module.css`):** the body `siteSettings` read extracted into an
async `ShellTheme`, wrapped in one load-bearing in-`<body>` `<Suspense>`. `generateMetadata` untouched.
`Suspense` imported after the CSS side-effect imports so it can't disturb the `[D27]` Turbopack anchor.
A load-bearing comment documents the cross-site contract.

The Suspense **fallback** is `ShellThemeFallback`, which renders the shell structure (boundary + nav +
content) **without `ProjectScope`** — see the QA defect below for why a themed fallback was impossible
without redesign. `ShellNav.module.css` gained a `var(--font-face, var(--font-geist-mono))` fallback so
the unthemed loading frame uses the shell mono face rather than the browser default.

**Regression tripwires (new):** `layout.draft-deferral.test.ts` pins the source invariants — a real
`<Suspense>` JSX element (comments stripped — see the false-green below), exactly two
`SITE_SETTINGS_QUERY` reads, the body read in `async ShellTheme`, and **exactly one `<ProjectScope>`
mount**. `layout.shell-theme-dedup.qa.test.tsx` (QA-authored) documents the React 19 href-de-dup
mechanism. The runtime error is jsdom-untestable `[D25]`, so these guard the source shape while the QA
bar owns the runtime proof.

### The QA catch — a ship-blocking regression the author missed `[D26]`

The first implementation gave the Suspense fallback its own `<ProjectScope slug="garden">` (a _themed_
fallback, per debate requirement #4). The real `ShellTheme` also renders `<ProjectScope slug="garden">`,
so **both emitted `<style href="project-theme-garden">`. React 19 de-dupes hoisted stylesheets by href
and keeps the FIRST committed — the fallback** — so the published static build _and_ draft Preview
rendered the engine **fallback palette (hue 264 / mono)**, never the real or edited brand. A
`[D11]`/`[D16]` regression that shipped fully gate-green.

The author's own verification **missed it**: it checked brand-token _presence_ in the dev-server HTML
(the real tokens _were_ present, just unapplied) instead of the _applied/computed_ style on a production
build. The fresh, no-context QA agent (`QA-ItemC`) caught it with the right method — `pnpm build` →
computed style — exactly the rigor the `[D26]` rule update was reaching for. **Fix:** the unthemed
`ShellThemeFallback` (only the real scope emits the brand style → it wins, no collision).

QA also caught a **false-green** in the author's tripwire: `/<Suspense\b/` matched the word `<Suspense>`
in the load-bearing _comment_, so deleting the real JSX boundary kept the test green. Fixed by stripping
comments before matching, plus the exactly-one-`<ProjectScope>` guard.

**Verified (developer-done), the right way this time:**

- Published `/` — clean `pnpm build` (`○ Static`, zero blocking-route errors); the **authoritative
  `.next/server/app/index.html`** carries exactly one `project-theme-garden` style with the REAL brand
  (`--brand-accent: …oklch(0.48 0.13 150)`, `--font-face: var(--font-fraunces)`), no hue-264 accent.
  `[D11]` ✓
- Draft `/` — real `__prerender_bypass` cookie + a real `siteSettings` draft edit (title + hue-25
  brand): browser-computed `--brand-accent` = the **edited** hue, `--font-face` = Fraunces; no throw;
  cookieless stays hue 150 (**no leak**). Draft discarded; dataset clean. `[D16]` ✓
- Full AGENTS.md gate green (499 tests incl. the new tripwires; typegen + `sanity.types.ts` diff clean).

> **Verification-environment trap (logged for the next session):** the author and QA briefly _disagreed_
> (FAIL vs PASS) because a Turbopack **dev server and a production build were racing on the same `.next`
> directory**, leaving stale/mixed prerender artifacts — false readings in _both_ directions. Reconciled
> only by a strictly isolated `rm -rf .next` + `pnpm build` with **no server running**. This draft bug is
> trustworthy only from a clean, single-writer `.next`.

**Open / NOT accepted as final (see [`../build-phases.md`](../build-phases.md)):** the unthemed fallback
is an **interim**. Requirement #4 ("draft-only fallback must be themed") stands **unchanged** — it is not
reworded to bless the interim. The themed-fallback follow-up (a distinct-`href`/slug fallback that
satisfies #1/#2/#4 at once) is logged as open and must not ship without **live-browser production
experimentation across more mock projects** first. The behavior change is not pre-accepted.

## QA log [D26]

`QA-ItemC` — a **fresh agent with no debate/fix context** (the standard this session's `[D26]` rule
update targets: QA must have no prior context of the work, not merely "not be the author"). It drove the
real production repro, not a static skim.

| Slice                | QA agent (fresh, no context) | Verdict                      | Tests added                                                            |
| -------------------- | ---------------------------- | ---------------------------- | ---------------------------------------------------------------------- |
| Item C draft-preview | QA-ItemC                     | **PASS** (after 1 fix cycle) | `layout.shell-theme-dedup.qa.test.tsx` (mechanism + false-green guard) |

- **DEFECT 1 (ship-blocker)** — themed fallback + real shell share `<style href="project-theme-garden">`
  → React 19 keeps the first (fallback) → published & draft render the fallback palette, not the real
  brand. **Fix:** unthemed `ShellThemeFallback` (no `ProjectScope`). **Re-check:** clean-build
  `.next/server/app/index.html` = one tag, hue 150 / Fraunces; draft = edited hue; byte-for-byte agreement
  author↔QA.
- **DEFECT 2 (false-green)** — `<Suspense>` source assertion matched the comment. **Fix:** strip comments
  - exactly-one-`<ProjectScope>` guard. **Re-check:** the two regression mutations now fail as intended.
- **Residual (open, owner's call, NOT a blocker)** — the new fallback is unthemed (neutral foundation
  palette in the draft loading frame), a literal deviation from requirement #4. Not unstyled (token
  fallbacks keep it readable + layout-stable) and draft-Preview-only. **Logged open** in `build-phases.md`;
  requirement #4 left as-is.
- **Confirmed pre-existing (not this fix):** `<title>=Home` on `/` (`page.tsx:7` sets it); the `%s ·
<siteTitle>` template suffix not showing is a separate metadata curiosity — parked.

## Lessons

- **Presence ≠ applied.** The author's "verified" was checking whether brand tokens _appeared_ in the
  HTML; the defect was that the real tokens appeared but the _fallback_ style won React 19's href de-dup
  and actually applied. Verify the **computed/applied** style, not token presence.
- **Build ≠ dev, and a shared `.next` lies.** The defect manifested on the production build, not dev; and
  a dev server racing a build on one `.next` produced contradictory FAIL/PASS reads. Trust only a clean,
  single-writer `pnpm build`.
- **Blind, adversarial QA earns its cost.** A no-context agent using the right method caught a
  ship-blocker the author rationalized past — the concrete payoff of the `[D26]` rule update.
- **`use cache` is a prerender-guard MARKER, not just a runtime cache** — it satisfies the blocking-route
  guard even when Draft Mode bypasses the cache (refuted the "no-op" claim).
- **Test the testable mid-debate** — running the two crux experiments flipped two stated positions and
  settled the design on fact, not prediction.
