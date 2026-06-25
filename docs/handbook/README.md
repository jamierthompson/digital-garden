# Handbook

The **agent-first operating manual** for this repo. It is written for a capable autonomous
agent (and the solo owner) landing cold: imperative, skimmable, example-driven — _how we
work here_, not _what the system is_. For the system model, these docs point you to the
architecture docs ([`../architecture-plan.md`](../architecture-plan.md),
[`../decisions.md`](../decisions.md), [`../build-phases.md`](../build-phases.md)) rather than
restating them. The one rule that overrides instinct everywhere: this is **Next.js 16 /
React 19 with Cache Components on app-wide** — your training data is stale, so verify
framework facts against the bundled docs at `node_modules/next/dist/docs/` before writing code.

## The docs

| Doc                                                                      | What it covers                                                                                                                                                                                |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`orientation.md`](./orientation.md)                                     | **Start here.** The map: repo layout, the four-idea mental model, the golden rules that silently break this stack, and a cold-start sequence for any task.                                    |
| [`engineering-standards.md`](./engineering-standards.md)                 | How we write code: TypeScript discipline, Server vs Client Components, Cache Components / `'use cache'` / async request APIs, the CSS `@layer` trap, import boundaries.                       |
| [`git-and-pr-workflow.md`](./git-and-pr-workflow.md)                     | Branching, Conventional Commits, the local gate that mirrors CI, opening/merging PRs, the Studio TypeGen drift gate.                                                                          |
| [`definition-of-done.md`](./definition-of-done.md)                       | The single pre-push / pre-merge checklist. If it's green locally, CI is green.                                                                                                                |
| [`testing.md`](./testing.md)                                             | Vitest + RTL, what to test vs skip, the dual-env OKLCH engine run, the Phase-1 contrast harness, async-RSC limits, Playwright timing.                                                         |
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

Mirroring the architecture [`../audit/`](../audit/) trail, this handbook was produced with the
same multi-agent pattern it documents in [`working-with-agents.md`](./working-with-agents.md)
§4 — **research → independent drafts → adversarial debate → synthesis**. The trail is preserved
under [`making-of/`](./making-of/):

| Stage                                                                                         | Where                                                      |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Research** — every claim pinned to a primary source (bundled docs, a spec URL, or a `[D#]`) | [`making-of/research/`](./making-of/research/) (R1–R6)     |
| **Round-1 drafts** — each doc drafted independently, before seeing the others                 | [`making-of/round-1-drafts/`](./making-of/round-1-drafts/) |
| **Round-2 debate** — each draft critiqued against the others; fact-grounded, not vibes        | [`making-of/round-2-debate/`](./making-of/round-2-debate/) |
| **Synthesis** — what the debate forced to change, per doc                                     | [`making-of/synthesis.md`](./making-of/synthesis.md)       |

Start with [`making-of/synthesis.md`](./making-of/synthesis.md) if you want the conclusions —
how the rounds shaped the final docs.
