# Git & PR Workflow

How we move code from a working tree to `main` on this repo. The rules here are binding;
the CI gate (§"The CI gate") enforces most of them mechanically. Agent-first: every step
is a concrete command.

> **Source of truth.** The merge gate is `.github/workflows/ci.yml` (job `verify`). The
> scripts it runs are in `package.json`. This doc tells you how to stay green; it does
> not redefine the gate. Decisions are anchored as `[D#]` ([../../decisions.md](../../decisions.md))
> and plan sections as `§N` ([../../architecture-plan.md](../../architecture-plan.md)).

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

Branches are **short-lived** (trunk-based development, [trunkbaseddevelopment.com](https://trunkbaseddevelopment.com/short-lived-feature-branches/)):
ideally hours, **two days max**. Longer than that and it stops being a feature branch and
starts being a merge problem. Sync with `main` before you open the PR.

### Naming

Pattern: `type/kebab-case-description` — lowercase alphanumerics + hyphens, under ~50 chars.

| Prefix      | Use for                         | Pairs with commit type |
| ----------- | ------------------------------- | ---------------------- |
| `feature/`  | new feature                     | `feat:`                |
| `fix/`      | bug fix                         | `fix:`                 |
| `chore/`    | tooling, config, deps           | `chore:`               |
| `refactor/` | restructure, no behavior change | `refactor:`            |
| `docs/`     | docs only                       | `docs:`                |
| `test/`     | tests only                      | `test:`                |

> **Mind the asymmetry.** Branch prefixes are spelled out (`feature/`), commit types are
> abbreviated (`feat:`). A `feature/…` branch carries `feat:` commits. Do **not** write a
> `feat/…` branch or a `feature:` commit.

```bash
git switch main && git pull
git switch -c feature/oklch-contrast-engine
```

Examples: `feature/add-project-scope`, `fix/font-preload-head-link`, `chore/setup-commitlint`.

---

## 2. Commits — Conventional Commits 1.0.0

Spec: [conventionalcommits.org/en/v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).
Keep commits **small and focused** — one logical change each, so the history reads as the
story of how the build happened ([D17] sequences the build into commit-sized steps).

```
<type>[optional scope]: <description>

[optional body — the WHY]

[optional footer(s)]
```

- **type** (required): one of `feat fix docs style refactor test chore`. This is the owner's
  set — the spec allows more (`build`, `ci`, `perf`), but stay within this set here.
- **scope** (optional): the package or area, e.g. `feat(studio):`, `chore(ci):`, `fix(oklch):`.
  Useful in this two-package workspace ([D23]) to signal app-vs-studio.
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
command that mirrors the gate in order:

```bash
pnpm lint && pnpm lint:css && pnpm lint:keys && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
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
its schema and fails on **any** drift (`git diff --exit-code`). After any schema change:

```bash
pnpm --filter studio typegen
git add sanity.types.ts
```

If `git diff sanity.types.ts` is non-empty after a clean run, your committed types are stale —
commit them.

---

## 4. Opening a PR

When the branch is complete (**all** its tasks done — not a work-in-progress), push and open a
PR into `main`.

```bash
git push -u origin feature/oklch-contrast-engine
gh pr create --base main --fill   # then edit title/body
```

**PR hygiene:**

- **One PR = one purpose.** Don't mix a refactor, a fix, and a feature in one PR. Scope to a
  coherent slice or a build phase (e.g. PR #2 was "Phase 0 — Scaffolding + guardrails").
- **Keep it reviewable.** Review quality drops past ~400 changed lines; aim **< 300** where you can.
- **Title** is Conventional-Commit-shaped (it becomes the squash subject if you squash):
  `feat: oklch contrast engine`.
- **Description** carries: _what_ changed, _why_ (motivation/context), _how it was tested_, and
  any deploy notes. Write it like a teammate will review it.
- **No checklists with unfinished items.** All tasks are done before the PR opens — the PR is a
  finished unit of work, not a progress tracker.

See [./definition-of-done.md](./definition-of-done.md) for what "done" means before you open.

---

## 5. The CI gate

CI is the merge gate ([D17]/[D19] — a Phase-0 guardrail). It runs on every `pull_request`
targeting `main`. **The workflow file is the source of truth** —
[`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml), single job **`verify`**,
`ubuntu-latest`, Node 22, pnpm, `pnpm install --frozen-lockfile`.

Steps run **in this order**; each maps to a local command you should have already run:

| #   | CI step                                                                 | Local equivalent          | Guards                                                                                             |
| --- | ----------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | `pnpm lint`                                                             | `pnpm lint`               | ESLint: `eslint-config-next` + import boundaries ([D14] isomorphic engine, [D21] literal imports)  |
| 2   | `pnpm lint:css`                                                         | `pnpm lint:css`           | `scripts/check-css-layers.mjs` — every CSS Module declares its `@layer` ([D12], the "@layer trap") |
| 3   | `pnpm lint:keys`                                                        | `pnpm lint:keys`          | `scripts/check-key-drift.mjs` — stubbed now, goes live Phase 2 ([D10])                             |
| 4   | `pnpm format:check`                                                     | `pnpm format` then commit | Prettier formatting                                                                                |
| 5   | `pnpm typecheck`                                                        | `pnpm typecheck`          | `tsc --noEmit`                                                                                     |
| 6   | `pnpm test`                                                             | `pnpm test`               | Vitest ([D18])                                                                                     |
| 7   | `pnpm --filter studio typegen` + `git diff --exit-code sanity.types.ts` | regenerate + commit types | Sanity TypeGen drift ([D23])                                                                       |
| 8   | `pnpm build`                                                            | `pnpm build`              | Next 16 / Turbopack production build                                                               |

> The Sanity project ID and dataset are set as **plain env** in the workflow, not secrets —
> they ship to the browser by design ([D16] / [./security-and-ops.md](./security-and-ops.md)).
> A Sanity **token** would be a secret and must never appear here or in `NEXT_PUBLIC_*`.

**If CI is red:** read the failing step, run that one command locally, fix, re-push. Don't push
"to see if CI passes" — run the chain first.

### Branch protection (recommended, not visible in-repo)

Whether `main` actually _requires_ `verify` to pass before merge is a GitHub repo **setting**,
not something the workflow file can prove. Recommended configuration:

- Require status check **`verify`** to pass before merging.
- Require branches to be **up to date** with `main` before merging.
- Require **linear history** (forces squash/rebase; blocks merge commits).

---

## 6. Merge & cleanup

Merge only when **CI is green** and the branch is up to date with `main`.

```bash
gh pr merge --squash --delete-branch   # squash keeps main history one-commit-per-PR
git switch main && git pull
git branch -d feature/oklch-contrast-engine   # if the remote delete didn't prune locally
```

- **Delete the branch** (local + remote) after merging — keep the repo tidy.
- Merging to `main` **deploys to production on Vercel**. Confirm the deploy is healthy; if not,
  Vercel **Instant Rollback** re-aliases the previous production deploy (no rebuild). See
  [./security-and-ops.md](./security-and-ops.md).

---

## Quick reference

```bash
# start
git switch main && git pull
git switch -c feature/<slug>

# before commit
pnpm format
pnpm lint && pnpm lint:css && pnpm lint:keys && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
git add -p && git commit -m "feat: <imperative description>"

# schema changed?
pnpm --filter studio typegen && git add sanity.types.ts

# ship
git push -u origin feature/<slug>
gh pr create --base main --fill
# …CI green…
gh pr merge --squash --delete-branch
git switch main && git pull
```
