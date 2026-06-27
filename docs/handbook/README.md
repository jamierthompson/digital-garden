# Handbook

The **agent-first operating manual** for this repo. It is written for a capable autonomous
agent (and the solo owner) landing cold: imperative, skimmable, example-driven — _how we
work here_, not _what the system is_. The system model lives alongside, in
[`architecture.md`](./architecture.md) (`§N`); binding rulings in [`../decisions/`](../decisions/)
(`[D#]`); the work backlog in [GitHub issues](https://github.com/jamierthompson/digital-garden/issues).
The one rule that overrides instinct everywhere: this is **Next.js 16 /
React 19 with Cache Components on app-wide** — your training data is stale, so verify
framework facts against the bundled docs at `node_modules/next/dist/docs/` before writing code.

## The docs

| Doc                                                                      | What it covers                                                                                                                                                                                |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`orientation.md`](./orientation.md)                                     | **Start here.** The map: repo layout, the four-idea mental model, the golden rules that silently break this stack, and a cold-start sequence for any task.                                    |
| [`architecture.md`](./architecture.md)                                   | **The system model** (cited everywhere as `§N`): the three-tier token model, the OKLCH engine, project modules, fonts, the Sanity content model, repo & hosting, the "don't reach up" litmus. |
| [`engineering-standards.md`](./engineering-standards.md)                 | How we write code: TypeScript discipline, Server vs Client Components, Cache Components / `'use cache'` / async request APIs, the CSS `@layer` trap, import boundaries.                       |
| [`git-and-pr-workflow.md`](./git-and-pr-workflow.md)                     | Branching, Conventional Commits, the local gate that mirrors CI, opening/merging PRs, the Studio TypeGen drift gate.                                                                          |
| [`definition-of-done.md`](./definition-of-done.md)                       | The single pre-push / pre-merge checklist. If it's green locally, CI is green.                                                                                                                |
| [`testing.md`](./testing.md)                                             | Vitest + RTL, what to test vs skip, the dual-env OKLCH engine run, the contrast harness, async-RSC limits, Playwright timing.                                                                 |
| [`working-with-agents.md`](./working-with-agents.md)                     | Cite-don't-remember, anchoring to decisions, the `AGENTS.md` entry point, multi-agent orchestration, subagent briefs, clean handoffs, the independent adversarial dev↔QA loop (solo or team). |
| [`decision-records.md`](./decision-records.md)                           | When to open an ADR, how much debate it earns, the entry format, and the never-edit / always-supersede rule.                                                                                  |
| [`accessibility-and-performance.md`](./accessibility-and-performance.md) | WCAG 2.2 AA + APCA targets, focus/interaction rules, Core Web Vitals budgets, the counter-intuitive font-preload policy.                                                                      |
| [`security-and-ops.md`](./security-and-ops.md)                           | Secrets & env policy, dependency hygiene, Sanity token handling, the Vercel deploy/rollback runbook.                                                                                          |

## Reading order

1. **[`orientation.md`](./orientation.md)** — always first; it routes you to the rest.
2. **[`engineering-standards.md`](./engineering-standards.md)** + **[`testing.md`](./testing.md)** — before you write or test code.
3. **[`git-and-pr-workflow.md`](./git-and-pr-workflow.md)** + **[`definition-of-done.md`](./definition-of-done.md)** — before you commit, push, or open a PR.
4. **[`accessibility-and-performance.md`](./accessibility-and-performance.md)** + **[`security-and-ops.md`](./security-and-ops.md)** — when shipping UI or touching secrets/deploys.
5. **[`working-with-agents.md`](./working-with-agents.md)** + **[`decision-records.md`](./decision-records.md)** — when orchestrating multi-agent work or recording an architecturally significant call.

Don't read cover-to-cover. Orientation's "Which doc for which task" table is the dispatcher —
jump to the page your task needs.

## How this handbook was built

Mirroring the architecture audit trail, this handbook was produced with the same multi-agent
pattern it documents in [`working-with-agents.md`](./working-with-agents.md) §4 — **research →
independent drafts → adversarial debate → synthesis**. That making-of trail (research notes,
round-1 drafts, the round-2 debate, and the synthesis) is preserved as frozen history under
[`../archive/handbook-making-of/`](../archive/handbook-making-of/), alongside the pre-build
architecture audit at [`../archive/audit/`](../archive/audit/).
