# Mode: Coding a Cross-Layer / Multi-Module Feature

> Read [`../SKILL.md`](../SKILL.md) (Preflight + universal mechanics) first. Use when a feature **spans layers or modules** and
> splits cleanly into slices over **distinct file sets** — frontend / data / tests, or several
> independent project modules. This is the highest-coordination mode: the official guidance says
> start with research/review before attempting parallel implementation, and the cardinal rule is
> **avoid file conflicts** — two teammates editing one file overwrite each other.

This mode fuses two sources: the repo's **own-a-slice / lead-curates** model
([`docs/handbook/working-with-agents.md`](../../../../docs/handbook/working-with-agents.md),
[`docs/handbook/git-and-pr-workflow.md`](../../../../docs/handbook/git-and-pr-workflow.md)) and the
**long-running-agent harness** ideas
([Anthropic](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)):
external-memory progress tracking and verify-before-done.

## The shape: split by files → each owns a gate-green slice → lead curates → squash-merge

**1. Decompose into file-disjoint slices.** Break the feature so **each teammate owns a different
set of files** (the official "avoid file conflicts" rule, and the handbook's "distinct set of
files"). If two slices must touch one file, that's a sequential dependency — model it as a task
**dependency** (a pending task with unresolved deps can't be claimed until they complete) rather
than parallel work. Aim for ~5–6 tasks per teammate.

**2. Set up external memory before spawning** (long-running-agent harness). For multi-session work,
persist a progress doc to the repo (what's done, what's next, the slice→owner→files map) so a
re-spawned teammate reads state instead of "continue what we were doing". The repo's docs are the
durable memory; the context window is not.

**3. Provision an in-root worktree per slice — so accept-edits just works.** Give each
slice its own checkout + branch **inside the repo root**, where the teammate's cwd scope already
covers it — `acceptEdits` then auto-accepts every edit there and you never babysit per-edit prompts:

```bash
git worktree add -b feat/<slug> .claude/worktrees/<slug> main   # creates the path + branch off main
(cd .claude/worktrees/<slug> && pnpm install)                    # worktrees don't inherit the gitignored node_modules
```

Brief the teammate that **its working directory is `.claude/worktrees/<slug>/`** — every edit, build,
test, and `git` command happens there. **Do not** use the harness `isolation: "worktree"` spawn flag:
it drops the checkout in an **ephemeral dir _outside_ the root**, out of `acceptEdits` scope, so every
write prompts the owner (the in-root-worktree rule; PR #20's prompt storm). `.claude/worktrees/` is already git-excluded
and Prettier/ESLint/tsconfig-ignored, so these nested checkouts don't pollute the lead's gate. If a
slice runs a dev/preview server, give it a **distinct port** (`pnpm dev -p 3010`, `3011`, …) — ports are
host-global and worktrees don't isolate them. The lead tears each one down (`git worktree remove
.claude/worktrees/<slug>`) at cleanup. **Caveat:** a worktree isolates _editing_ only — never
trust it for _final_ verification; gate on a clean `main`/CI build and the live deploy.

**4. Brief each slice owner** per the briefing checklist, and make the boundary explicit: **"you own these files in your
worktree; do not edit any others."** Include the binding rules for the area, the bundled-doc paths,
and **cite-don't-remember** (Next 16 / React 19). Consider **plan approval** for risky slices — the
teammate plans in read-only mode and you approve before it writes.

**5. Each slice ships complete and gate-green.** A slice is "done" only when it passes the full gate
in CI order:

```bash
pnpm lint && pnpm lint:css && pnpm lint:keys && pnpm lint:docs && pnpm format:check && pnpm typecheck && pnpm test \
  && pnpm --filter studio typegen && git diff --exit-code sanity.types.ts && pnpm build
```

Broken WIP is **not** handed off. Enforce this with a `TaskCompleted` hook that **exits code 2**
(blocks completion + sends feedback) until the gate is green — the verify-before-done discipline
that stops teammates marking work complete without testing. See
[`docs/handbook/definition-of-done.md`](../../../../docs/handbook/definition-of-done.md).

**6. One fresh, adversarial QA per slice — before it enters the PR.** Gate-green is
_developer-done_, not _review-done_. For **every** coding agent, spawn **one fresh QA teammate**
(`pr-review-toolkit:code-reviewer` / `feature-dev:code-reviewer`) — **never the agent that wrote the
slice**; the isolated context is the point. Brief it per the briefing checklist to **try to break** the slice, not skim
it: malformed / boundary / empty / hostile input (garbage `brandColor` → safe fallback, never a
throw), the error and not-found paths, both color schemes, the focus/interaction floor on any rendered
surface — and to **write the missing test cases** a product-team QA engineer would, proving each break
with a failing case first. Findings go back to the **owning** agent to fix; QA re-checks; repeat until
clean. In-scope findings are fixed before the PR; defer only genuinely-separable later work (file it
as a [GitHub issue](https://github.com/jamierthompson/digital-garden/issues) with PR# + reason). **Record each slice's
QA outcome** — what was probed, verdict, each defect → fix → re-check, tests QA added — in the
**PR body** as the loop closes, not reconstructed at the end. This loop is
**not team-only** — a solo session does exactly one author→one QA; here you just run one per coding agent.
Full mechanics: [`docs/handbook/working-with-agents.md`](../../../../docs/handbook/working-with-agents.md).

**7. Lead curates history & merges.** You do **not** inherit an unfinished slice (it bounces back
to its owner). Your job is _history_: rebase onto latest `main`, squash an agent's fix-ups, reorder
slices, drop a false start, then **squash-merge** with a deliberate PR body — the story told once.
Push curated history with `--force-with-lease`, never plain `--force`, so a teammate's concurrent
push isn't clobbered. **Never commit to `main`** (merge = production deploy on Vercel). Full
mechanics: [`git-and-pr-workflow.md`](../../../../docs/handbook/git-and-pr-workflow.md).

## Cautions specific to parallel coding

- **File ownership is the whole game.** The most common team failure is two teammates editing the
  same file. If you can't cleanly partition files, this isn't a team job — sequence it solo.
- **Worktree-per-slice is the default isolation** (step 3): each teammate gets its own
  in-root checkout + branch, so file conflicts are structurally impossible and accept-edits stays
  silent. A **shared branch** is the fallback when slices can't be cleanly partitioned — then
  teammates must pull/rebase before pushing and the lead reconciles.
- **Monitor for premature "done."** Watch task status (it can lag); confirm the slice actually
  passes the gate before you curate it in.
