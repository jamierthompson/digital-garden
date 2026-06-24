# Run records — project work

A durable, append-only log of every **multi-agent run that did real project work** in this repo:
**why** it was run, how it was structured, and the **outcome**. One file per run, named
`YYYY-MM-DD-<slug>.md`. This is the repo's external memory for orchestration — so the next session
(or a future you) can see what was attempted and how it landed without re-reading a lost context
window.

> **This is not the same as the skill-evaluation runs.** The runs under
> [`../handbook/process/agent-team-skill/runs/`](../handbook/process/agent-team-skill/runs/) are
> **verbatim agent outputs captured to build and grade the `agent-team` skill itself** — i.e. they
> were documentation/tooling work, not product work. This directory is for runs that build the
> **digital garden** (features, content model, theming engine, …). When in doubt: _did the run
> change `src/`, `studio/`, or the product? → it belongs here._

## What each record should answer

- **Why** — the trigger and the goal (what problem / phase / decision prompted the run).
- **Shape** — team vs subagents vs solo; the slice → owner → files map; how isolation was handled.
- **Outcome** — what shipped (PRs/commits), what passed the gate, what was deferred and why.
- **Review + fixes** — what review surfaced and what was changed in response.
- **Lessons** — anything worth carrying into the next run.

## Index

| Date       | Run                                                                                                        | Outcome                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 2026-06-23 | [Phase 0.5 walking skeleton + parallel Phase 1/2](./2026-06-23-phase-0.5-walking-skeleton.md)              | 4 feature PRs (#8–#11) + review fixes         |
| 2026-06-24 | [Phase 1 keystone (real ProjectScope) + fast-follows](./2026-06-24-phase-1-projectscope.md)                | 3 PRs (#14–#16); Phase 1 complete             |
| 2026-06-24 | [Phase 2 close-out: engine-backed brandColor validation](./2026-06-24-phase-2-engine-backed-validation.md) | PR #18; `@garden/oklch` pkg; Phase 2 complete |
| 2026-06-24 | [Gate-doc sync guard (`pnpm lint:docs`)](./2026-06-24-doc-gate-sync-guard.md)                              | PR #19; builds the missing doc-sync guard     |
