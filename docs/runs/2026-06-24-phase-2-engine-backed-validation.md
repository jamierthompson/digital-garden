# Run record — Phase 2 close-out: engine-backed `brandColor` validation (`@garden/oklch` package)

- **Date:** 2026-06-24
- **Mode:** solo (single-agent) + a fresh independent QA pass before the PR (handbook §6.2)
- **Lead/author:** main session · **QA (fresh, not the author):** `pr-review-toolkit:code-reviewer`
- **PR:** #18 · **Branch:** `feat/engine-backed-brandcolor-validation`

## Why

This was the **last open Phase 2 item** and the one deliberately deferred across the prior runs:
true engine-backed `brandColor` validation `[D9]` (layer 2 — author-time Sanity validation via
the engine's _own_ color pipeline, not a regex). It was deferred because it's a **package-boundary
task**: the standalone Studio cannot import the app's `src/lib/oklch` `[D23]`, so real validation
first needed the engine to live in a neutral package both the app and the Studio depend on. With
that prerequisite done, the validation swap is near-drop-in. Completing it makes **Phase 2
complete**.

## Shape — solo, not a team

Chosen **solo** because the work is a mostly-serial refactor with a shared core (the package must
exist before its consumers can rewire; eslint/vitest/tsconfig are single shared files). There was
no disjoint-file split to parallelize, and the handbook defaults to single-agent unless work splits
cleanly over distinct files (§6.1). Three logical commits, then QA, then two fix/polish commits:

| Commit                                       | What                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `refactor:` extract engine → `@garden/oklch` | `git mv src/lib/oklch → packages/oklch/src`; package.json `exports → ./src/index.ts`; rewire all wiring |
| `feat:` engine-backed validation             | `isBrandColorString` runs `buildTokenSet`; accepts iff `!meta.isFallback`                               |
| `style:` `colour` → `color`                  | repo-wide spelling normalization (owner request, mid-run)                                               |
| `test:` validation oracle contract           | table-driven accept/reject pinned in the engine package (the Studio has no runner)                      |
| `docs:` repoint engine location              | fix the doc-rot the move introduced (QA finding)                                                        |

## The hard part: a just-in-time TypeScript workspace package

`@garden/oklch` ships **no build step** — its `exports` points at `./src/index.ts` (raw TS) and
each consumer transpiles it:

- **Next app** — `transpilePackages: ["@garden/oklch"]` in `next.config.ts` (verified against the
  bundled doc `…/05-config/01-next-config-js/transpilePackages.md`, not memory).
- **Studio** — Vite/Sanity transpile TS natively; proven by `pnpm --filter studio typegen` (schema
  extract loads the validation module that imports the package) **and** `cd studio && pnpm build`
  (Vite bundles it).

The `[D14]` isomorphism guard **moved with the engine**: it's no longer a `boundaries` element
(that plugin is `src/**`-scoped), so a dedicated `eslint.config.mjs` block on `packages/oklch/**`
restates both halves — `no-restricted-globals` (DOM/Node) and `no-restricted-imports`
(`next`/`react`/`react-dom`/`server-only`/`client-only`, which the dropped `from: oklch` boundary
rules used to enforce). Confirmed the bare `pnpm lint` gate traverses `packages/` and fails-closed
on a planted `window` reference. Dual-env (node + jsdom) Vitest include retargeted to
`packages/oklch/**`, keeping the isomorphism test in one place.

## Notable engineering calls

- **`buildTokenSet`, not `parseColor`, as the validation oracle.** Today `isFallback` is exactly
  `parseColor(value) !== null`, so either works — but running the full pipeline keeps author-time
  validation in lockstep if `isFallback` ever depends on more than parse. The contract is "accept
  iff the engine won't fall back," i.e. author-time validation == render-time behavior.
- **Deliberate boundary shift vs the old regex, and it's _more_ correct.** `rgb()` is now accepted
  (the engine parses it); 4-digit `#abcd` is now rejected (the engine has no `#rgba` form, so the
  old regex would have passed a value that silently falls back at render). QA verified no input
  passes validation yet falls back, or vice versa, and that the function never throws `[D9]`.
- **No Studio test runner — pin the contract at the engine layer instead `[D24]`.** The Studio is
  declarative schema + ~3 lines of validation glue; standing up a second runner for that is
  premature infrastructure. The contract that matters (what the engine considers usable) is engine
  behavior, so it's a table-driven test in `packages/oklch`, where the runner already exists.
- **ADR text left immutable.** The relocation _executes_ `[D23]`'s own implication (engine → shared
  package), so it needed no superseding record. `decisions.md` (D14's `src/lib/oklch` mention) and
  the historical `audit/` + `process/` records were left as-is; only living docs were repointed.

## QA log [D26] — verdict SHIP-WITH-FIXES

_Retrofit: this run predates [D26] but already ran a fresh pre-PR QA pass; captured here in the
[D26] format. Detail below._

| Slice                                          | Author       | QA agent (fresh)                  | Verdict                                              | Tests added                     |
| ---------------------------------------------- | ------------ | --------------------------------- | ---------------------------------------------------- | ------------------------------- |
| engine → `@garden/oklch` + engine-backed valid | main session | `pr-review-toolkit:code-reviewer` | ship-with-fixes (engineering clean; 6 doc-rot fixes) | validation-oracle contract test |

**What QA probed:** re-ran the full gate; planted `window` + 5 framework imports against the `[D14]`
isomorphism guard (all caught, lint non-zero, reverted); verified the `[D9]` no-throw + the
accept/reject boundary shift against the real engine; grep'd living docs for the deleted engine path.
**Deferred from QA:** none.

A fresh `code-reviewer` (not the author) re-ran the full gate, independently probed the `[D14]`
guard (planted `window` + five framework imports → all caught, lint non-zero, reverted), and
verified the D9 behavior changes against the real engine. **Engineering: clean.** The only findings
were **doc-rot the move introduced** — `AGENTS.md` (a guardrail), `engineering-standards.md`,
`orientation.md`, `README.md`, `architecture-plan.md`, `testing.md` still located the engine at the
deleted `src/lib/oklch/`. All **fixed in-branch** before the PR (the repo's "tell me so I can fix
the stale one" rule; in-scope because the move caused it). The optional coverage suggestion was
satisfied by the `test:` commit. **Nothing deferred from this run.**

## Outcome

- **Shipped (PR #18):** `@garden/oklch` workspace package; engine-backed `brandColor` validation in
  the Studio; repo-wide `colour→color`; the validation-oracle contract test; doc-rot fixes; the
  README brought current (Status: Phases 0–2 complete); and a new **standing end-of-run
  requirement** — every run refreshes the README + writes a run record — codified in
  [`../handbook/working-with-agents.md`](../handbook/working-with-agents.md) §6.2 and the DoD
  (owner request, mid-run).
- **Gate green** on the curated tip: `lint · lint:css · lint:keys · format:check · typecheck ·
test (447) · studio typegen + no-drift · build` — plus `cd studio && pnpm build` and
  `pnpm install --frozen-lockfile`.
- **Phase 2 complete.** Remaining package-boundary work (`keys.ts` → shared package) stays Phase 4;
  this run built the package pattern that move will reuse.

## Lessons

- **A file move silently rots every doc that names the old path.** The gate is blind to it
  (`grep` isn't a CI step). The fresh QA pass — explicitly briefed to check living docs against the
  new location — is what caught it. Worth a standing habit: after any relocation, `grep` the old
  path across living docs before the PR.
- **Just-in-time TS packages are the low-friction monorepo-sharing move here** — no build/watch
  step, both bundlers transpile source, types resolve straight from `.ts`. The only wiring cost is
  `transpilePackages` on the Next side; the Studio needs nothing.
