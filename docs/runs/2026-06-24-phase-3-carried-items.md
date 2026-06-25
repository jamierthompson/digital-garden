# Run record — Phase 3 carried items (draft-content rendering + project notes/tags)

- **Date:** 2026-06-24
- **Mode:** **solo, step-by-step** (lead session; no team) — the two items are sequential and overlap
  on `/work/[slug]`, so a team would collide on a shared file for no parallelism. The `/agent-team`
  preflight test (team vs. subagent vs. solo) was re-run and downgraded to solo, as the skill directs.
- **QA:** a primed static `code-reviewer` (insufficient — see below), then a **fresh, independent,
  browser-driven adversarial QA** (`general-purpose`, no priming) · **Browser verify:** lead via
  `chrome-devtools` MCP
- **PR:** #21 (`feat/phase-3-carried-items` → `main`) · **Outcome (partial — Phase 3 stays OPEN):**
  item 2 (project `tags`/`notes`) **done**; item 1 (draft rendering) **code-complete but NOT verified
  end-to-end** (blocked on a Sanity read token + an unwired Preview entry point); one app-wide `@layer`
  defect found. Merged as an increment, not a Phase-3 close — remaining work tracked in
  `build-phases.md` ("What's left to close Phase 3").

## Why

PR #20 shipped the whole of Phase 3 but deferred two cross-route items as not-a-per-route-hack:
draft content didn't **render** in Preview (every fetch was `use cache` + the published client), and
`PROJECT_DETAIL_QUERY` over-fetched `notes[]->` + `tags` that the project route rendered nowhere.

## Item 1 — draft-content rendering via a shared `sanityFetch`

A single `sanityFetch(query, params?, cacheProfile?)` is now the one content read path, adopted in
`/work`, `/work/<slug>` (page + `generateMetadata`), the root `layout` (`siteSettings`), and `/notes`.

**Divergence from the deferred sketch — the bundled docs overruled the plan.** `build-phases.md`
line 249 said to read `(await draftMode()).isEnabled` _outside_ the `use cache` boundary and branch.
The version-exact docs say otherwise: `draftMode()` is the **one** runtime API readable _inside_ a
`use cache` scope, and under Cache Components Next **natively re-executes every cached function on
every request and saves nothing while Draft Mode is on** — "without requiring any changes to your
caching code" (`node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md`
§"Draft Mode"; `…/04-functions/draft-mode.md`). So the helper reads `draftMode()` inside `use cache`
and branches to `getClient(isEnabled)`: public visitors keep the prerendered static shell; Preview
gets fresh drafts (uncached, drafts perspective, stega on). This is simpler and safer than the sketch
(no second uncached path to keep in sync) — the AGENTS.md "verify, don't trust stale memory" rule,
applied to a stale _plan_. `generateStaticParams` stays on the published `client` by design (build-
time enumeration of published slugs). The build confirms it: `/work/[slug]` is `◐` (Partial
Prerender), `/notes` carries a 1h revalidate vs. 30d elsewhere (the `cacheProfile` threading through).

One framework friction worth recording: `cacheLife`'s parameter is a profile-name union, not a bare
`string`, so it only accepts a **literal** — a variable (even one narrowed) won't satisfy it. The
helper branches to a literal `cacheLife("hours")`/`cacheLife("max")` call; `CacheProfile` is narrowed
to the two profiles actually used (don't-build-until-forced).

## Item 2 — render the notes/tags the detail query already pulls

**Rendered, not trimmed** (the chosen direction: grow the page now). Two pure, synchronous,
var-consuming components — `TagList` (chips in the header) and `RelatedNotes` (a see-also list after
the experience) — each self-guards to `null` when empty. Titles/tags are **plain text, not links**:
there are no individual-note or tag-archive routes yet, so linking would dead-end; the notes stay
real Sanity references `[D16]` and become links when such a route lands. The GROQ query is unchanged,
so TypeGen doesn't drift. Minimal CSS only (a styling pass is explicitly deferred).

## QA log [D26]

_Retrofit: this run predates [D26], but it is the sharpest live illustration of why [D26] says
**adversarial** — the primed first pass confirmed the design and found nothing; the unprimed,
break-it second pass caught the real defects. Detail in the section below._

| Slice                            | Author       | QA agent (fresh)                                                                               | Verdict                               | Tests added                              |
| -------------------------------- | ------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------- |
| draft `sanityFetch` + notes/tags | main session | (1) primed `code-reviewer` — _insufficient_; (2) fresh adversarial `general-purpose` + browser | ship-with-fixes (2 fixed, 1 deferred) | `getClient` fail-loud guard (3 branches) |

**Defects (detail below):** 1) Prettier blocker in `getClient.test.ts` → `pnpm format` → fixed
(would have gone red in CI). 2) Missing test for the `getClient(true)` fail-loud guard → added,
pins all three branches. 3) App-wide `@layer` order inversion (pre-existing) → **deferred**.
**Couldn't test locally (flagged, not faked):** the draft happy-path — no `SANITY_API_READ_TOKEN` +
empty dataset. **Deferred from QA:** the `@layer` inversion → `build-phases.md` "Known defect — fix
next" (pre-existing, defeats `[D12]`'s intent).

## The QA story — honestly

The first "QA" was a `pr-review-toolkit:code-reviewer` subagent, but it was **primed** (handed the
divergence rationale, the `[D#]`s, "the gate is green") and did a **static read only** — it ran no
scenarios and confirmed the design rather than attacking it. That is a code review, not QA.

A second pass was a **genuinely independent adversarial QA**: fresh context, no priming on design or
conclusions, mandate to _break it_, with the live browser (`chrome-devtools` MCP) against the running
dev server. It earned its cost:

1. **Prettier blocker (fixed).** `getClient.test.ts` had a format violation — committed because the
   new file was run through `pnpm test` but not `format:check`. CI would have gone red. (`pnpm format`.)
2. **Missing test for the fail-loud guard (added).** `getClient(true)` throwing when
   `SANITY_API_READ_TOKEN` is absent is the security guarantee `sanityFetch`'s draft path leans on
   (no silent fallback to published). It had no test; `getClient.test.ts` now pins all three branches.
3. **An app-wide `@layer` inversion (queued as the next fix).** See below.

**Could not be tested locally (flagged, not faked):** the draft **happy-path** — no
`SANITY_API_READ_TOKEN` in `.env.local`, and the dataset has zero notes / zero projects-with-notes,
so populated `RelatedNotes` renders only in the unit test. Needs a token'd preview/Presentation env.
What _was_ verified live: published render themes off the real engine palette (not fallback), tag
chips have strong contrast (`--brand-on-accent` on `--brand-accent`), null-guards work in the real
DOM, no draft→published cache leak (`x-nextjs-cache: HIT`, zero stega chars, no token in HTML), no
`any` widening, `$slug` stays a bound param, console clean, full gate + build green.

## Found defect — app-wide `@layer` order inversion (pre-existing; next fix)

Independent QA + a lead `<head>` cascade probe confirmed: project-layer rules **lose** to the
foundation reset, so `@layer foundation { * { padding:0; margin:0 } }` wipes `padding`/`margin` from
every `@layer project` module (the new tag chips compute `padding: 0`; pre-existing embed caption /
experience module are hit too). **Root cause:** source is correct (`foundation.css` declares `@layer
foundation, brand, project;`), but **Turbopack drops `foundation` from the order _statement_** when
bundling it with foundation's `@layer foundation {…}` block — the live first sheet carries statement
`@layer brand, project;` + blocks `project` then `foundation`, so registration is `brand → project →
foundation` and foundation is **highest** priority. `lint:css` can't catch it (it checks per-module
layer declaration, not runtime registration order). Not introduced by this PR (landed with `dbf6719`
on `main`); it defeats `[D12]`'s intent. **Likely fix:** a dedicated single-statement `layers.css`
imported first so Turbopack has no `foundation` block to merge against — to be browser-re-verified.
Tracked in `build-phases.md` ("Known defect — fix next").

## Gate

`pnpm lint · lint:css · lint:keys · lint:docs · format:check · typecheck · test (489) · typegen +
drift · build` — all green. Three commits curated (sanityFetch + adoption; notes/tags components; the
fail-loud guard test with the Prettier fix folded in), squash-merged; branch deleted.
