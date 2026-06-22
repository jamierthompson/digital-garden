# Synthesis — How the Rounds Shaped the Handbook

What the debate forced to change. This is the consolidation step of the
research → drafts → debate → synthesis pattern the handbook itself documents
([`../working-with-agents.md`](../working-with-agents.md) §4) and that the
architecture [`../../audit/`](../../audit/) trail models. Each handbook page was drafted
independently ([`round-1-drafts/`](./round-1-drafts/)), then cross-examined against the
installed stack ([`round-2-debate/`](./round-2-debate/)). The round-2 reviews verified
every draft against the **actual** ground truth — `ci.yml`, `package.json`,
`studio/sanity.cli.ts`, `eslint.config.mjs`, `../../decisions.md`, the live git log, and
the bundled `node_modules/next/dist/docs/` — not against model memory. Critiques are
referenced by their round-2 codes (A#, B#, C#, D#, O#, R#, U#).

> **The synthesis rule we held to:** where a draft and a critique genuinely conflicted,
> resolve it explicitly and say which won and why — never smooth over a real disagreement
> with a tidy summary ([Ewerlöf](https://blog.alexewerlof.com/p/multi-agent-system-reliability)).
> Two critiques were **rejected** on verification (below); that's the pattern working, not
> failing.

---

## What the debate forced, across the whole set

Three themes recurred in round 2 and reshaped every doc:

1. **Match the gate _literally_, in CI's order.** The biggest class of fix was drafts that
   _summarized_ the CI chain instead of reproducing it. CI runs
   `pnpm --filter studio typegen && git diff --exit-code sanity.types.ts` **unconditionally
   before `build`**; drafts that dropped it, or claimed "exactly what CI runs" while omitting
   it, were corrected to the real 8-step chain. This is now consistent across
   `orientation.md`, `definition-of-done.md`, and `git-and-pr-workflow.md`.

2. **Cite the source that _actually contains_ the fact.** Several drafts anchored a claim to
   a plausible-but-wrong bundled-doc path (the `@layer` trap to `11-css.md`; the Suspense
   error to `cacheComponents.md`). Round 2 re-anchored each to where the fact really lives —
   or, for spec/bundler behavior the Next docs _don't_ state ([D12] `@layer`, [D21] templated
   imports), to `[D#]` + the lint script instead of a doc that doesn't hold the claim.

3. **Right-size ruthlessly; cut borrowed governance.** Drafts imported human-team metrics
   (line-count review caps, "two days max" branch rules, multi-template ADR ceremony) that
   don't earn their place in a solo, agent-driven repo. These were cut or reframed as
   _consequences_ of a decision already in force (e.g. branch brevity follows from [D17]'s
   commit-sized steps, not a quota).

Two critiques were **rejected after verification**: a link-depth rewrite for
`decision-records.md` (B1) and `git-and-pr-workflow.md` that assumed a
`docs/handbook/process/` home — the docs ship at `docs/handbook/`, where the drafts' `../`
(architecture) and `../../` (repo root) depths were already correct per house style; and a
critique disputing two bundled-doc paths in `working-with-agents.md` that, on checking, do
exist and hold the cited facts.

---

## Per-doc changelog

### `orientation.md`

Fixed the local gate to match CI literally (added the unconditional
`pnpm --filter studio typegen && git diff --exit-code sanity.types.ts` before `build`,
dropped the false "exactly what CI runs" claim, reframed step 7 as "commit the regenerated
types"); added the sibling-link promotion-invariant note; de-densified mental-model bullets
3–4 to name + one-line + §/[D#] anchor (cut engine and `ProjectScope` internals); made step 3
actionable with a verified bundled-doc pointer table; trimmed the Testing/Lint stack-table
cells to the decision plus sibling-doc links; hedged "removed" → "no longer apply", added a
`grep '\[ \]'` cold-boot command, and anchored the "stale training data" claim to the
proxy/async/`force-static` churn.

### `engineering-standards.md`

Corrected the inverted `<Activity>` claim (state + DOM are **preserved**, effects not
auto-cleaned); dropped the false "Verified against `…/11-css.md`" citation for the `@layer`
trap and re-anchored it to the CSS cascade-layers spec + [D12] + `check-css-layers.mjs`;
noted that `keys.ts` lives in the shared workspace package per [D23]; fixed over-deep relative
links for the `docs/handbook/` home; trimmed the verbatim ESLint-message column and global
enumeration (now pointing to `eslint.config.mjs`); added the read-outside / pass-as-arg
`'use cache'` code example; added the missing `08-caching.md` (Suspense error) and
`lazy-loading.md` (`ssr: false`) citations.

### `git-and-pr-workflow.md`

Root-anchored the TypeGen stage to `git add ./sanity.types.ts` with a note that
`studio/sanity.cli.ts` emits to repo root (A1); **reversed the merge policy** from
`--squash`/linear-history to merge commits, to preserve the [D17] commit-sized story both
existing PRs and §2 keep (C1); re-anchored sibling/`[D#]`/`§N`/`ci.yml` links for the flat
`docs/handbook/` location (C3); cut the borrowed "<300/400-line" review metric and "two days
max" rule, reframing branch brevity as a [D17] consequence (R1/R3); surfaced the
stubbed-`lint:keys` caveat, the expected-typegen-diff guidance, and explicit
`gh pr create --title/--body` for multi-commit PRs (U1/U4/U5); swapped `git add -p` for
`git add -A` in the quick-ref with `-p` noted as the at-keyboard option (U2); aligned sync
timing to "before merge" and framed branch protection as optional solo hardening (A2/R2);
clarified that `ci` is a valid scope but not a type (C2).

### `definition-of-done.md`

Fixed §3 doc paths to point at `01-app/01-getting-started/08-caching.md` (where the Suspense
/ `connection()` guidance lives, not `cacheComponents.md`) and named the
`Blocking data was accessed outside of Suspense` sibling error (A1/A2); collapsed §4 from a
verbatim 7-item copy of architecture-plan §8 to a 3-line pointer (O1); compressed §5's
diff-review checklist to a one-line "diff is clean" gate linking the owning siblings, keeping
only the Sanity-token nuance (C1/C3); dropped the duplicate TypeGen prose explainer for a
sibling link (C2); added the "stub today, in the chain so it needs no re-plumbing in Phase 2"
note to the `lint:keys` row (U1); clarified short-circuit / no-cherry-pick behavior (U2);
moved the branch-protection aside to a one-line recommend-and-link (O2); corrected parent-doc
links from `../../` to `../`.

### `testing.md`

Replaced the unverified `resolve: { tsconfigPaths: true }` in the dual-env snippet with the
bundled-Next-doc `vite-tsconfig-paths` plugin form plus a "confirm aliases resolve in both
projects" caveat (A1, verified against `…/vitest.md`); cut the duplicated seven-command
pre-push chain down to a pointer to `definition-of-done.md` (B1); re-attributed the
yellow/cyan harness mandate to a [D4] derivation rather than [D17]'s authority (C1); made the
jsdom-broad / node-narrow env split an explicit documented invariant in the snippet (D1) and
gave Phase 1/2 agents the extract-pure-logic fallback for async-RSC testing (D2); trimmed
premature Playwright CI-job detail (B2), reframed explicit-import advice as a consistency rule
(B3), retargeted the `page.test.tsx` migration trigger to "0.5 onward" (C2), scoped the [D9]
"never throws" assertion to layer 1 (C3), clarified the harness asserts computed values not
RTL queries (D3), added the `pnpm test --project node` filter (D4), and fixed the R3 research
link path for the file's location.

### `working-with-agents.md`

Re-sourced the §1 CSS-`@layer` row to [D12] + `check-css-layers.mjs` and the
templated-import row to [D21] (bundled docs confirmed to contain neither), and added an
Authority column splitting documented-Next-behavior from spec/bundler-behavior-we-lint-for;
scoped the `dynamic`-removal claim to "removed under `cacheComponents`" per route-segment-config
`index.md`; **kept** the critique-disputed `08-caching.md` and
`05-server-and-client-components.md` paths — both exist and hold the cited facts (the critique
was wrong there); softened the unverifiable `AGENTS.md` governance / "20+ tools" and
exact-arXiv-percentage claims to accuracy-over-confidence phrasing; added a copy-pasteable
`grep` recipe, a Model-tier brief-checklist line, a "default to single-agent" trigger, and
de-duplicated the self-contained-in / dense-digest-out handoff lesson into §5.

### `decision-records.md`

Replaced the mis-ordered, drift-prone CI-chain enumeration with a one-sentence pointer to
`definition-of-done.md`, noting the [D23] TypeGen gate (B2); collapsed three overlapping
templates into one copy-paste + supersede variant with the fields-table as sole source of
truth (O1); compressed the Nygard/Fowler epigraph to one sentence + links (O2); rewrote
Pitfalls as a prose-free Quick-reference checklist (O3); added the "extends `decisions.md`'s
two-item legend" line to the status vocabulary (A1); gave the next-`D#` rule the actual
`grep … | tail -1` command and today's `D24` (A2); led the debate section with the cheap
two-mode path over the audit (A3); pinned the engine-signature contract to [D5]
`(brandColor, scheme) → tokenSet` and kept `--logx-*` out of the public-names list per [D2]
(C1/C2). **Rejected B1's link-depth rewrite** — it computed paths for a
`docs/handbook/process/` home, but the doc ships to `docs/handbook/`, where `../decisions.md`
and `../../AGENTS.md` are already correct.

### `accessibility-and-performance.md`

Fixed the WCAG 1.4.3 large-text bug (point-based 24px / 18.66px-bold, not 18px / 14px) with a
callout that 18px body still needs 4.5:1; cut the duplicated Phase-1 harness mechanics down to
a pointer to `testing.md` (D19) so this doc owns _targets_ and testing owns _assertions_; made
the `<head>` font-preload check runnable (`curl … | grep` with an expected result); added
APCA-Lc-is-a-guideline and consume-via-tokens / hand-check-only-static-colors provenance notes;
defined the 2.5.8 spacing exception instead of leaving "or adequately spaced" as a loophole;
rewrote all links to destination-relative paths so they resolve from `docs/handbook/`.

### `security-and-ops.md`

Killed the fabricated 4-line `.env.example` snippet (the real file has 3 public vars, no
token) for a link + prose; dropped the non-existent `[D-proxy]` anchor and re-anchored
proxy-is-Node-only to `…/proxy.md`; removed the unsourced "Edge can't set the draft cookie"
claim and reframed draft mode around server-side Route Handlers; relabeled
`X-Robots-Tag: noindex` as general SEO practice (not a Next rule, verified absent from
`draft-mode.md`); trimmed Vercel promote/rollback to the verifiable core (auto-deploy on
merge, roll back from dashboard, link Vercel docs); asserted `SANITY_API_READ_TOKEN` per
`next-sanity`; made `pnpm audit` lockfile-triggered; pointed CORS config at sanity.io/manage;
tightened the [D17]/[D19] footer labels, added the [D23] TypeGen diff-gate pointer; fixed
every relative link to the canonical `docs/handbook/` depth.

---

## Cross-doc reconciliation (final pass)

After the per-doc debates, a final pass over the promoted set fixed three things the
independent rounds couldn't see:

- **`git-and-pr-workflow.md`'s headline "single command that mirrors the gate" still omitted
  the TypeGen drift step** while `orientation.md` and `definition-of-done.md` included it. The
  three canonical gate strings are now identical and in CI order.
- **The stale "this doc still lives in `round-1-drafts/`" note in `orientation.md`** — true
  during drafting, false once promoted — was removed; all sibling `./*.md` links now resolve
  from the final location.
- **A stray serialization artifact at the tail of `testing.md`** was removed.

All `./`, `../`, and `../../` links were verified to resolve from `docs/handbook/`.

---

## Related

- [`../README.md`](../README.md) — the handbook index.
- [`./research/`](./research/) — R1–R6 cited research notes.
- [`./round-1-drafts/`](./round-1-drafts/) · [`./round-2-debate/`](./round-2-debate/) — the trail.
- [`../../audit/`](../../audit/) — the architecture audit this process mirrors.
