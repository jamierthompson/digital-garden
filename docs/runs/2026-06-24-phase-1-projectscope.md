# Run record — Phase 1 keystone (real `ProjectScope`) + gated Phase 2 fast-follows

- **Date:** 2026-06-24
- **Mode:** agent-team, coding-feature (own-a-slice → independent QA → lead curates → squash-merge)
- **Lead:** main session · **Teammates:** Theming, Swatches, Hardening · **QA (fresh, per slice):** QA-Swatches, QA-Theming, QA-Hardening · **Browser verify:** Verify-Theming

## Why

The 2026-06-23 run completed Phase 0.5 + every ungated Phase 1/2 building block, but deliberately
**held the engine-gated fast-follows** for once the OKLCH engine landed. With the engine merged
(PRs #8/#10), this run picks those up: the **real `ProjectScope`** (the last open Phase 1 item —
the engine is built, so the keystone can finally consume it) plus the Phase 2 items gated on the
engine (`cardSwatches`) and on `keys.ts` (live key-drift), and the two opportunistic engine
cleanups. Goal: finish Phase 1 and everything in Phase 2 that could run concurrently with it.

## Shape — three file-disjoint slices, each in its own git worktree

Chosen as a **team** (not subagents/solo) because the work split into independent slices over
distinct file sets, shippable in parallel. The parallel-coding risk (two agents editing one file)
was mitigated by **file-disjoint ownership** + a **separate git worktree per slice**. An overlap
check (`git diff --name-only` across all three branches, intersected) confirmed no file appeared in
more than one branch; `main` never moved, so no rebase/conflict reconciliation was needed.

| Owner         | Branch                                     | Owns (only)                                                                                                                                                             | Phase              |
| ------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Theming**   | `feat/project-scope-engine`                | `src/components/project-scope/**`, `src/app/work/[slug]/page.tsx` (+ `ModuleShell.module.css`, `src/fonts/roster.ts` — added by the lead as in-scope blockers surfaced) | 1 (last open item) |
| **Swatches**  | `feat/card-swatches`                       | `src/lib/cardSwatches.ts` (+ test)                                                                                                                                      | 2 (engine-gated)   |
| **Hardening** | `chore/key-drift-live-and-engine-cleanups` | `scripts/check-key-drift.mjs` (+ test), `src/lib/oklch/palette.ts`, `src/lib/oklch/harness/harness.test.ts`                                                             | 2 + cleanups       |

## The dev↔QA loop did the load-bearing work (handbook §6.2)

A gate-green slice is _developer-done_, not _review-done_. Each slice went to a **fresh** QA
reviewer (never its author) that independently re-ran the gate and reviewed against the binding
`[D#]`s; the rendered keystone also got a `[D25]` **browser pass**. The loop caught **three defects
the green gate is structurally blind to**, each fixed in-branch by the owning agent and re-verified:

1. **Latent `next/font` build break** (Theming) — `roster.ts` passed a `const` to each loader's
   `variable:`; the SWC plugin requires inline string literals. Latent on `main` because nothing
   imported the roster into a built page until `ProjectScope` wired it in. Would have blocked all
   Phase 3 routes too.
2. **Key-drift guard false-pass** (Hardening, found by QA-Hardening) — the `satisfies` source-text
   tripwire passed when the annotation survived inside a brace-bearing comment. Fixed by stripping
   comments before the regex; regression-tested.
3. **WCAG-AA contrast failure** (Theming, found by Verify-Theming's browser pass) — `ModuleShell`
   consumed the stub's `--brand-accent-contrast`/`--brand-on-surface`, which the engine doesn't
   emit, so the badge fell to foundation defaults at **1.54:1 / 1.87:1**. Renamed to the engine's
   `--brand-on-accent`/`--brand-text`; re-verified at **11.35:1 light / 9.43:1 dark**.

Undefined CSS vars don't error and jsdom doesn't compute color — #3 is exactly the class of defect
`[D25]` browser verification exists to catch.

## Notable engineering calls

- **`ProjectScope` stays synchronous, no `use cache`.** The build plan sketched "render via
  `use cache`", but the bundled caching docs are explicit: a sync component's output is auto-included
  in the static HTML shell. `use cache` would force it async (breaking jsdom testability) for no
  gain. The plan line was reworded to match; the build confirms `/work/[slug]` as Partial Prerender.
- **`[D13]` made mechanical.** The `@layer brand` string and the React `precedence` prop are now
  single-sourced from one `const BRAND_LAYER`, so they cannot desync; a test pins the hoisted
  style's `data-precedence`.
- **Key-drift right-sized honestly.** Code↔keys completeness is already compile-enforced by the
  resolvers' `satisfies`; the live check adds runtime well-formedness (kebab/uniqueness/collision)
  and a tripwire that the `satisfies` guards stay wired. The published-Sanity-keys-vs-code net
  remains Phase 4 (needs GROQ) — documented as the seam.

## Outcome — 3 focused PRs (+ this docs PR)

Opened 2026-06-24, all CI-green + QA-clean at hand-off, left for the owner to squash-merge:
**#14** real `ProjectScope` (Phase 1 complete), **#15** `cardSwatches`, **#16** key-drift live +
engine cleanups. The branches are file-disjoint, so they merge in any order. The only item from
this run carried forward is the pre-existing Phase-2 engine-backed `brandColor` validation (a
package-boundary task), tracked in [`../build-phases.md`](../build-phases.md).
