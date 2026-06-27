# Git & PR Workflow

How we move code from a working tree to `main` on this repo. The rules here are binding;
the CI gate (§"The CI gate") enforces most of them mechanically. Agent-first: every step
is a concrete command.

> **Source of truth.** The merge gate is `.github/workflows/ci.yml` (job `verify`). The
> scripts it runs are in `package.json`. This doc tells you how to stay green; it does
> not redefine the gate. Decisions are anchored as `[D#]` ([../decisions/](../decisions/))
> and system-model sections as `§N` ([./architecture.md](./architecture.md)).

Related handbook pages: [./definition-of-done.md](./definition-of-done.md) (the per-task
done checklist), [./engineering-standards.md](./engineering-standards.md) (code conventions),
[./testing.md](./testing.md) (what `pnpm test` must cover).

---

## The loop at a glance

```
branch off main  →  each agent ships a complete, gate-green slice  →  push
                 →  lead curates history: rebase / squash / fixup / reorder  →  green gate on the tip
                 →  PR into main  →  CI green  →  squash-merge  →  delete branch
```

Small, focused commits are the unit of work, and each is a **finished, gate-green slice** — an
agent takes a task, completes it fully, and owns its quality. These branches are often worked by
an **agent team**, where each agent owns a distinct slice (see
[`./working-with-agents.md`](./working-with-agents.md) §6.1). Before merge the **team lead**
curates the branch — rebase, squash, fixup, reorder, drop — into one coherent, gate-green tip,
then **squash-merges**, so the story is told **once** in the squash-commit / PR body. One
coherent slice ≈ one PR. **Never commit to `main`.**

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
Keep commits **small and focused** — one logical change each, and each a **completed, gate-green
slice** you stand behind ([D17] sequences the build into commit-sized steps). The lead curates
the branch and the PR **squash-merges**, so the durable story is the **squash-commit / PR body**,
written once at the end (see §6). The squash subject must be Conventional-Commits-shaped (it lands
on `main`); branch-commit subjects should be too, but since the lead may squash or reword them,
don't agonize over the wording of commits you know will be combined.

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
docs: fold the production checklist into security-and-ops
fix(oklch): clamp out-of-gamut brandColor instead of throwing
```

> No commitlint is installed — the commit/branch conventions are **discipline-enforced**, not
> CI-checked. Get them right by hand.

---

## 3. Pre-commit checklist (run the gate locally)

**When the gate must be green:** at **two** moments. (1) **Every slice handoff** — when an agent
calls its task done, pushes for review, or hands the branch on, that slice must pass the full
gate; this is the per-task accountability the team model rests on, and it can be hook-enforced
(`TaskCompleted`). A purely local checkpoint commit you'll keep building on doesn't need it, but
anything you present as _finished_ does. (2) **The curated tip before the PR merges** — the final
tip that squash-merges to `main` must be green. The lead re-running the gate is a backstop,
**not** a substitute for each agent gating its own slice. The single command that mirrors the
gate in order (CI runs the TypeGen drift step unconditionally — so do you, even on an app-only
change; see §3.1):

```bash
pnpm lint && pnpm lint:css && pnpm lint:keys && pnpm lint:docs && pnpm format:check && pnpm typecheck && pnpm test \
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

When the branch is complete (**all** its tasks done — not a work-in-progress) and the lead has
curated it (§6), push and open a PR into `main`.

```bash
# the lead sets title + body explicitly — they ARE the squash-commit subject/body that lands on main
git push -u origin feat/oklch-contrast-engine          # add --force-with-lease after a curating rebase
gh pr create --base main --title "feat: oklch contrast engine" --body "what / why / how-tested"
```

Don't use `--fill` (it derives the subject from the branch's individual commits). Because the PR
**squash-merges**, its **title becomes the squash-commit subject and its body becomes the
squash-commit body** on `main` — so this is where the build story gets told, once. Write it
deliberately.

**PR hygiene:**

- **One PR = one purpose.** Don't mix a refactor, a fix, and a feature in one PR. Scope to a
  coherent slice (typically one issue). Keep the diff scoped to that one purpose; a sprawling
  diff is a sign the branch is doing too much, not a line-count to hit.
- **Title** is Conventional-Commit-shaped: `feat: oklch contrast engine` — it lands verbatim as
  the squash subject on `main`.
- **Description = the durable story.** The squash collapses the branch to one commit, so the body
  carries the narrative: _what_ changed, _why_ (motivation/context), _how it was tested_, and any
  deploy notes. Write it like a teammate will review it — and like the future agent who'll read
  `git log` and find only this. A short, ordered "what landed" list earns its place here.
- **No checklists with unfinished items.** All tasks are done before the PR opens — the PR is a
  finished unit of work, not a progress tracker.
- **Passed independent, adversarial QA `[D26]`.** Every slice — solo or team — clears a **fresh**
  QA subagent (the dev↔QA loop) before it enters the PR: gate-green is _developer-done_, not
  _review-done_. QA **tries to break the slice** and writes the missing test cases a product-team QA
  engineer would (edge/error/boundary/malformed-input, both schemes), the owning author fixes, QA
  re-checks. Staffing scales — solo session → one QA; team session → one per coding agent. The lead owns this
  loop; mechanics in [./working-with-agents.md](./working-with-agents.md) §6.2.

See [./definition-of-done.md](./definition-of-done.md) for what "done" means before you open.

---

## 5. The CI gate

CI is the merge gate ([D17]/[D19] — an enforce-from-the-start guardrail). It runs on every `pull_request`
targeting `main`. **The workflow file is the source of truth** —
[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), single job **`verify`**,
`ubuntu-latest`, Node 22, pnpm, `pnpm install --frozen-lockfile`.

Steps run **in this order**; each maps to a local command you should have already run:

| #   | CI step                                                                 | Local equivalent                         | Guards                                                                                                                                      |
| --- | ----------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `pnpm lint`                                                             | `pnpm lint`                              | ESLint: `eslint-config-next` + import boundaries ([D14] isomorphic engine, [D21] literal imports)                                           |
| 2   | `pnpm lint:css`                                                         | `pnpm lint:css`                          | `scripts/check-css-layers.mjs` — every CSS Module declares its `@layer` ([D12], the "@layer trap")                                          |
| 3   | `pnpm lint:keys`                                                        | `pnpm lint:keys`                         | `scripts/check-key-drift.mjs` — key-drift guard ([D10]): runtime well-formedness + a comment-stripped `satisfies` tripwire. (The published-keys-vs-code net is tracked in the issue backlog.) |
| 4   | `pnpm lint:docs`                                                        | `pnpm lint:docs`                         | `scripts/check-doc-gate-sync.mjs` — the gate chain stays identical across AGENTS.md, DoD §1, and `ci.yml`                                   |
| 5   | `pnpm format:check`                                                     | `pnpm format` then commit                | Prettier formatting                                                                                                                         |
| 6   | `pnpm typecheck`                                                        | `pnpm typecheck`                         | `tsc --noEmit`                                                                                                                              |
| 7   | `pnpm test`                                                             | `pnpm test`                              | Vitest ([D18])                                                                                                                              |
| 8   | `pnpm --filter studio typegen` + `git diff --exit-code sanity.types.ts` | regenerate + `git add ./sanity.types.ts` | Sanity TypeGen drift ([D23])                                                                                                                |
| 9   | `pnpm build`                                                            | `pnpm build`                             | Next 16 / Turbopack production build                                                                                                        |

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
- **Restrict the merge method to _squash_** (and optionally _rebase_) — disable the merge-commit
  button so branch history can't leak onto `main`.

> **Linear history is the intent here:** branch commits are curated raw material, so
> squash-merging (or a lead-curated rebase) keeps `main` to one coherent commit per PR. Enabling
> GitHub's "Require linear history" is consistent with this.

---

## 6. Curate, merge & cleanup

This is the team lead's step. Two parts: **curate the branch** (the "git magic"), then
**squash-merge** it. Do it only when the work is complete and the PR is **ready to merge** —
which is the lead's explicit call (on a solo session the lead is also the author) and means **both**:
the CI `verify` gate green on the curated tip (§5) **and** the independent, adversarial pre-PR QA
pass clean `[D26]`, with every finding
either fixed in-branch by the owning agent or filed as a follow-up in the
[GitHub issue tracker](https://github.com/jamierthompson/digital-garden/issues) with a reason (see
[./working-with-agents.md](./working-with-agents.md) §6.2 for the dev↔QA loop).

### 6a. Curate the branch (the lead's git magic)

Agents deliver **complete, gate-green slices** (each agent owns its slice's quality — §3); the
lead's job here is not to fix those slices but to **curate history**: rebase onto latest `main`
and squash an agent's fix-ups, reorder slices, or drop a false start into a coherent tip. The
squash collapses the branch to one commit anyway (§6b), so optimize for a clean final diff and a
tip that passes §3, not for a tidy intermediate log. If a slice arrives _not_ green, that's the
**owning agent's** task to finish, not history to paper over.

```bash
git switch feat/oklch-contrast-engine
git fetch origin
git rebase origin/main          # replay onto latest main; resolve conflicts here, not in the PR
git rebase -i origin/main       # optional: squash/fixup/reorder/drop to tidy the branch
# …re-run the full §3 gate on the result…
git push --force-with-lease     # history was rewritten — force-with-lease, never plain --force
```

- **`--force-with-lease`, never `--force`.** It refuses to clobber commits another agent pushed
  while you were rebasing — essential on a shared team branch.
- **Squashing here is optional polish, not required.** Since the PR squash-merges (§6b), even a
  noisy branch collapses to one commit on `main`. Interactive-rebase tidying mainly helps
  reviewers read the branch and makes conflict resolution sane — do as much or as little as the
  branch needs.
- **Sync onto latest `main` before merge** so conflicts resolve locally, not as a surprise in
  the PR. `main` may have moved (another PR shipped); on Vercel that's already in production.

### 6b. Squash-merge

```bash
gh pr merge --squash --delete-branch   # ONE commit on main; its subject/body = the PR title/body (§4)
git switch main && git pull
```

**Squash-merge — the branch becomes one commit on `main`.** The squash subject/body is the PR
title/description (§4), so the durable story is told there, once. (A lead who genuinely wants
more than one commit on `main` may instead curate a clean, each-commit-green linear history and
`gh pr merge --rebase`. Keep the merge-commit button **off**: it would leak branch history onto
`main`.)

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

# work — each agent ships a complete, gate-green slice; commit small & focused
git add -A && git commit -m "feat: <imperative description>"   # use git add -p to review hunks at a keyboard

# schema changed? stage the regenerated types (file lands at the repo ROOT, not in studio/)
pnpm --filter studio typegen && git add ./sanity.types.ts

# lead curates before merge — rebase onto main, optionally squash/reorder
git fetch origin && git rebase origin/main     # resolve conflicts locally; `git rebase -i` to tidy

# gate the CURATED TIP — same chain, same order as CI (incl. the unconditional TypeGen drift step)
pnpm format
pnpm lint && pnpm lint:css && pnpm lint:keys && pnpm lint:docs && pnpm format:check && pnpm typecheck && pnpm test \
  && pnpm --filter studio typegen && git diff --exit-code sanity.types.ts && pnpm build

# ship — PR title/body become the squash-commit subject/body on main (tell the story here)
git push -u origin feat/<slug>                  # add --force-with-lease after a curating rebase
gh pr create --base main --title "feat: <subject>" --body "what / why / how-tested"
# …CI green…
gh pr merge --squash --delete-branch           # one commit on main; subject/body = the PR title/body
git switch main && git pull
```
