# Run record — the gate-doc sync guard (`pnpm lint:docs`)

- **Date:** 2026-06-24
- **Mode:** solo (small tooling chore), adversarially self-tested
- **PR:** #19 · **Branch:** `chore/doc-gate-sync-check`

## Why

Closing out PR #18 surfaced that `orientation.md` advertised a `scripts/check-doc-gate-sync.mjs`
(`pnpm lint:docs`) "gate-doc sync guard" that **never existed** — no such script, no `lint:docs`
package script, nothing in git history. The owner's call: if it doesn't exist, build it for real.
The guard is genuinely useful — the CI gate chain is written in three places that must agree
(`AGENTS.md` Pre-flight checks, `definition-of-done.md` §1, `ci.yml` `verify`), and nothing
mechanical caught them drifting. This is the exact doc-rot the repo now asks everyone to kill on
sight (orientation "Golden rules", added in PR #18).

## What shipped

- **`scripts/check-doc-gate-sync.mjs`** — extracts the gate chain from all three sources,
  normalizes each to an ordered step list (splitting on `&&`, dropping `pnpm install` setup), and
  fails if they diverge, printing each list + the first mismatch. Text-based (no YAML/MD parser dep),
  matching the house style of `check-key-drift.mjs`.
- **Wired into the gate:** `pnpm lint:docs` added to `package.json` and to the canonical chain in
  all three sources (after `lint:keys`) + `ci.yml` `verify`. The guard's own step is part of the
  chain it checks — self-consistent, not circular.
- **Co-located test** (`check-doc-gate-sync.test.ts`) — happy path against the real repo + four
  fixture cases (synced passes, dropped step fails, reorder fails, missing section fails).
- **Docs:** restored the `orientation.md` repo-map entry (the script exists now); added a
  `Doc-gate sync` row to the DoD §2 table and refreshed the stale `Key drift` row; updated every
  prose mention of the chain (orientation cold-start, working-with-agents §7, DoD §7) and the
  README scripts list to include `lint:docs`.

## QA log [D26]

_Retrofit + honest label: a small, self-contained tooling chore, **adversarially self-tested** (no
separate fresh QA agent — predates [D26]). Detail below._

| Slice                     | Author       | QA                                               | Verdict | Tests added                                                                            |
| ------------------------- | ------------ | ------------------------------------------------ | ------- | -------------------------------------------------------------------------------------- |
| `check-doc-gate-sync.mjs` | main session | solo adversarial self-test (mutation + fixtures) | clean   | fixture suite: synced-passes, dropped-step-fails, reorder-fails, missing-section-fails |

**What QA probed:** mutation-tested the guard — deleted a step from `ci.yml`, confirmed non-zero exit

- the right message, reverted; the fixture suite pins divergence detection so a future false-pass
  fails a test. **Deferred:** none.

Adversarially self-tested rather than via a separate QA agent (small, self-contained tooling with
its own adversarial test suite): proved the guard **fails-closed** by deleting a step from `ci.yml`
and confirming non-zero exit + the right message, then reverting; the fixture suite pins divergence
detection (dropped step, reorder, missing section) so a future false-pass would fail a test. Full
gate green: `lint · lint:css · lint:keys · lint:docs · format:check · typecheck · test (452) ·
studio typegen + no-drift · build`.

## Lessons

- **A guard the docs claim exists but doesn't is worse than no guard** — it implies a safety net
  that isn't there. This run turned the claim true. Meta-point: the new `lint:docs` would itself
  have caught the gate-chain drift that motivated it; the doc-rot that motivated it (a phantom
  script) is the class the "see something, say something" norm (PR #18) targets.
