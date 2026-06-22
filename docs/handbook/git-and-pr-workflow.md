# Git & PR Workflow

How we move code from a working tree to `main` on this repo. The rules here are binding;
the CI gate (§"The CI gate") enforces most of them mechanically. Agent-first: every step
is a concrete command.

> **Source of truth.** The merge gate is `.github/workflows/ci.yml` (job `verify`). The
> scripts it runs are in `package.json`. This doc tells you how to stay green; it does
> not redefine the gate. Decisions are anchored as `[D#]` ([../decisions.md](../decisions.md))
> and plan sections as `§N` ([../architecture-plan.md](../architecture-plan.md)).

Related handbook pages: [./definition-of-done.md](./definition-of-done.md) (the per-task
done checklist), [./engineering-standards.md](./engineering-standards.md) (code conventions),
[./testing.md](./testing.md) (what `pnpm test` must cover).

---

## The loop at a glance

```
branch off main  →  small focused commits  →  green local gate  →  push  →  PR into main
                                                                              →  CI green
                                                                              →  merge  →  delete branch
```

One task ≈ one commit. One coherent slice (or phase) ≈ one PR. Never commit to `main`.

---

## 1. Branching

**Never commit directly to `main`.** Always branch first. On Vercel a merge to `main` is a
**production deploy**, so `main` must stay green and shippable at all times.

Keep branches **short** — but here that's a _consequence_, not a quota. `[D17]` sequences
the build into commit-sized steps (one task ≈ one commit, one slice ≈ one PR), so a
correctly-scoped branch is short by construction. The reason it matters on _this_ repo:
merge = production deploy, so a long-lived branch is a long gap between prod-shippable
states. Sync `main` into your branch right before you merge (see §6) — that's the freshness
that counts, not a sync at PR-open.

### Naming

Pattern: `type/kebab-case-description` — lowercase alphanumerics + hyphens, under ~50 chars.
The `type` is the **same token** as the commit type (§2): a `feat/…` branch carries `feat:`
commits, a `fix/…` branch carries `fix:` commits, and so on. Branch and commit match exactly —
nothing asymmetric to remember.

| Prefix      | Use for                         | Commit type |
| ----------- | ------------------------------- | ----------- |
| `feat/`     | new feature                     | `feat:`     |
| `fix/`      | bug fix                         | `fix:`      |
| `chore/`    | tooling, config, deps           | `chore:`    |
| `refactor/` | restructure, no behavior change | `refactor:` |
| `docs/`     | docs only                       | `docs:`     |
| `test/`     | tests only                      | `test:`     |

Any other Conventional Commits type is a valid prefix too (`build/`, `ci/`, `perf/`,
`revert/`) — the table lists the ones in routine use. The prefix always mirrors the commit
type exactly.

```bash
git switch main && git pull
git switch -c feat/oklch-contrast-engine
```

Examples: `feat/add-project-scope`, `fix/font-preload-head-link`, `chore/setup-commitlint`.

---

## 2. Commits — Conventional Commits 1.0.0

Spec: [conventionalcommits.org/en/v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).
Keep commits **small and focused** — one logical change each, so the history reads as the
story of how the build happened ([D17] sequences the build into commit-sized steps). On
this repo that story lives on `main` — we merge with merge commits, not squash, precisely
to preserve it (see §6).

```
<type>[optional scope]: <description>

[optional body — the WHY]

[optional footer(s)]
```

- **type** (required): `feat` (new feature) and `fix` (bug fix) are the spec's two normative
  types; `docs`, `style`, `refactor`, `test`, `chore`, `build`, `ci`, `perf`, and `revert` are
  the other conventional types — use whichever fits. The branch prefix (§1) is the same token.
- **scope** (optional): the package or area, e.g. `feat(studio):`, `chore(ci):`, `fix(oklch):`.
  Useful in this two-package workspace ([D23]) to signal app-vs-studio. Mind the position:
  `ci` in `chore(ci):` is a _scope_ (in parentheses, after the type), distinct from `ci:` used
  as a _type_ (before the colon) — both are valid Conventional Commits, but they sit in
  different slots.
- **description**: imperative mood, lower-case, **no trailing period**.
- **body**: one blank line after the description; explains _why_, not _what_ (the diff is the what).

### Breaking changes

Either `!` before the colon **or** a `BREAKING CHANGE:` footer (uppercase, literal):

```
feat(oklch)!: change engine signature to (brandColor, scheme)
```

The repo is `private` / `0.1.0` with no release automation, so SemVer impact is informational —
but `feat!:` is still how you flag a contract break for the next agent reading the log.

### Examples (match the existing log)

```
feat: enable Cache Components app-wide
chore: add CI gate (lint/format/typecheck/test/build) on PRs
docs: mark Vercel deploy complete (Phase 0 done)
fix(oklch): clamp out-of-gamut brandColor instead of throwing
```

> No commitlint is installed — the commit/branch conventions are **discipline-enforced**, not
> CI-checked. Get them right by hand.

---

## 3. Pre-commit checklist (run the gate locally)

Before you commit, and definitely before you push, **make CI's job redundant**. The single
command that mirrors the gate in order (CI runs the TypeGen drift step unconditionally — so
do you, even on an app-only change; see §3.1):

```bash
pnpm lint && pnpm lint:css && pnpm lint:keys && pnpm format:check && pnpm typecheck && pnpm test \
  && pnpm --filter studio typegen && git diff --exit-code sanity.types.ts && pnpm build
```

Then review the diff itself:

- [ ] Code runs; the gate above passes.
- [ ] Formatted with **`pnpm format`** (never hand-format — Prettier is the source of truth).
- [ ] No debug logs, no commented-out code, no unrelated changes in the diff (`git diff --staged`).
- [ ] No secrets. Only `NEXT_PUBLIC_*` may reach the client; a Sanity **token** is server-only.
      `.env*` stays gitignored; update `.env.example` if you added a variable. See
      [./security-and-ops.md](./security-and-ops.md).
- [ ] **Touched a dependency?** Commit the updated `pnpm-lock.yaml` — CI installs with
      `--frozen-lockfile` and fails on a stale lock.
- [ ] **Changed the Studio schema?** Regenerate and commit the types (see below) — the single
      easiest gate to forget.

### The Studio TypeGen gate [D23]

The Studio (`studio/`) is a separate workspace package; CI regenerates `sanity.types.ts` from
its schema and fails on **any** drift (`git diff --exit-code sanity.types.ts`, run from the
repo root). After any schema change:

```bash
pnpm --filter studio typegen        # emits ./sanity.types.ts at the repo ROOT, not into studio/
git add ./sanity.types.ts           # root-anchored path — the file is NOT in studio/
```

> **Why the path matters.** `studio/sanity.cli.ts` declares `generates: '../sanity.types.ts'`,
> so TypeGen writes to the **repo root**. If you are `cd`'d into `studio/` and run a bare
> `git add sanity.types.ts`, it resolves to `studio/sanity.types.ts` — which doesn't exist —
> and silently no-ops. The stale root file then trips the very [D23] gate you thought you
> handled. Always stage `./sanity.types.ts` from the repo root.

A non-empty `git diff sanity.types.ts` after a schema change is **expected** — commit it in
the **same commit** as the schema change so the type delta and its cause travel together
(this is the one-logical-change rule from §2). A non-empty diff after a _clean_ run with no
schema change means your committed types are stale — regenerate and commit.

---

## 4. Opening a PR

When the branch is complete (**all** its tasks done — not a work-in-progress), push and open a
PR into `main`.

```bash
# multi-commit phase PR: set the title explicitly (don't let --fill guess it)
git push -u origin feat/oklch-contrast-engine
gh pr create --base main --title "feat: oklch contrast engine" --body "what / why / how-tested"
```

`--fill` derives the title/body from the branch's commits, which is fine for a
**single-commit** branch but produces a misleading subject for a multi-commit phase PR. Set
`--title`/`--body` explicitly for anything more than one commit.

**PR hygiene:**

- **One PR = one purpose.** Don't mix a refactor, a fix, and a feature in one PR. Scope to a
  coherent slice or a build phase (e.g. PR #2 was "Phase 0 — Scaffolding + guardrails").
  Keep the diff scoped to that one purpose; a sprawling diff is a sign the branch is doing
  too much, not a line-count to hit.
- **Title** is Conventional-Commit-shaped: `feat: oklch contrast engine`.
- **Description** carries: _what_ changed, _why_ (motivation/context), _how it was tested_, and
  any deploy notes. Write it like a teammate will review it.
- **No checklists with unfinished items.** All tasks are done before the PR opens — the PR is a
  finished unit of work, not a progress tracker.

See [./definition-of-done.md](./definition-of-done.md) for what "done" means before you open.

---

## 5. The CI gate

CI is the merge gate ([D17]/[D19] — a Phase-0 guardrail). It runs on every `pull_request`
targeting `main`. **The workflow file is the source of truth** —
[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), single job **`verify`**,
`ubuntu-latest`, Node 22, pnpm, `pnpm install --frozen-lockfile`.

Steps run **in this order**; each maps to a local command you should have already run:

| #   | CI step                                                                 | Local equivalent                         | Guards                                                                                                                                      |
| --- | ----------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `pnpm lint`                                                             | `pnpm lint`                              | ESLint: `eslint-config-next` + import boundaries ([D14] isomorphic engine, [D21] literal imports)                                           |
| 2   | `pnpm lint:css`                                                         | `pnpm lint:css`                          | `scripts/check-css-layers.mjs` — every CSS Module declares its `@layer` ([D12], the "@layer trap")                                          |
| 3   | `pnpm lint:keys`                                                        | `pnpm lint:keys`                         | `scripts/check-key-drift.mjs` — **stubbed; passes trivially until Phase 2** ([D10]). A green here does **not** yet mean keys are validated. |
| 4   | `pnpm format:check`                                                     | `pnpm format` then commit                | Prettier formatting                                                                                                                         |
| 5   | `pnpm typecheck`                                                        | `pnpm typecheck`                         | `tsc --noEmit`                                                                                                                              |
| 6   | `pnpm test`                                                             | `pnpm test`                              | Vitest ([D18])                                                                                                                              |
| 7   | `pnpm --filter studio typegen` + `git diff --exit-code sanity.types.ts` | regenerate + `git add ./sanity.types.ts` | Sanity TypeGen drift ([D23])                                                                                                                |
| 8   | `pnpm build`                                                            | `pnpm build`                             | Next 16 / Turbopack production build                                                                                                        |

> The Sanity project ID and dataset are set as **plain env** in the workflow, not secrets —
> they ship to the browser by design ([D16] / [./security-and-ops.md](./security-and-ops.md)).
> A Sanity **token** would be a secret and must never appear here or in `NEXT_PUBLIC_*`.

**If CI is red:** read the failing step, run that one command locally, fix, re-push. Don't push
"to see if CI passes" — the local chain in §3 is byte-for-byte the same commands CI runs, so
running it first costs one paste and saves a full CI round-trip plus a red check on the PR.

### Branch protection (optional hardening, not visible in-repo)

Whether `main` actually _requires_ `verify` to pass before merge is a GitHub repo **setting**,
not something the workflow file can prove. For a solo repo this is **optional hardening** the
owner may deliberately skip (merging your own green PR is fine) — don't write instructions that
assume merges are mechanically blocked. If enabled, the sensible configuration is:

- Require status check **`verify`** to pass before merging.
- Require branches to be **up to date** with `main` before merging.

> **Linear history is intentionally _not_ recommended here** — it would force squash/rebase
> and discard the commit-sized [D17] story we keep on `main` (see §6).

---

## 6. Merge & cleanup

Merge only when **CI is green** and the branch is up to date with `main`. Sync `main` into
your branch first so the merge resolves locally, not as a surprise in the PR:

```bash
git switch feat/oklch-contrast-engine
git fetch origin && git merge origin/main   # or rebase; resolve conflicts here, re-run §3
gh pr merge --merge --delete-branch          # merge commit — preserves the commit-sized story
git switch main && git pull
```

**Merge with a merge commit, not `--squash`.** Both existing PRs (#1, #2) landed as merge
commits, and that's deliberate: a merge commit keeps each `feat:`/`chore:` step from the
branch on `main`, which is exactly the commit-sized build story [D17] and §2 value. Squashing
collapses a whole phase PR into one commit and throws that story away.

- Reach for `--squash` **only** for the opposite case: a messy WIP branch whose intermediate
  commits ("wip", "fix typo", "actually fix it") are _not_ a clean story worth keeping. There,
  one tidy squashed commit beats noise. The default is `--merge`.
- **Delete the branch** (local + remote) after merging — keep the repo tidy.
- Merging to `main` **deploys to production on Vercel**. Confirm the deploy is healthy; if not,
  Vercel **Instant Rollback** re-aliases the previous production deploy (no rebuild). See
  [./security-and-ops.md](./security-and-ops.md).

---

## Quick reference

```bash
# start
git switch main && git pull
git switch -c feat/<slug>

# before commit — same chain, same order as CI (incl. the unconditional TypeGen drift step)
pnpm format
pnpm lint && pnpm lint:css && pnpm lint:keys && pnpm format:check && pnpm typecheck && pnpm test \
  && pnpm --filter studio typegen && git diff --exit-code sanity.types.ts && pnpm build
git add -A && git commit -m "feat: <imperative description>"   # use git add -p to review hunks at a keyboard

# schema changed? stage the regenerated types (file lands at the repo ROOT, not in studio/)
pnpm --filter studio typegen && git add ./sanity.types.ts

# ship
git fetch origin && git merge origin/main      # sync, re-run the gate, resolve conflicts locally
git push -u origin feat/<slug>
gh pr create --base main --title "feat: <subject>" --body "what / why / how-tested"
# …CI green…
gh pr merge --merge --delete-branch            # merge commit keeps the [D17] commit story
git switch main && git pull
```
