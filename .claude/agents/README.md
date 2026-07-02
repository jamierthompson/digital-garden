# Repo subagents (`.claude/agents/`)

Reusable subagent definitions for the **domain-review lenses this repo uses again and again**. Each is
a read-only reviewer grounded in this repo's own rules — the OKLCH engine, the token/theming system,
and the Sanity content model — citing the handbook ([`docs/`](../../docs/)) **by
file**, never by a decision number.

Spawn one with the `Agent` tool (`subagent_type: "<name>"`) or name it in an agent-team brief to inherit
its tool-allowlist and system prompt — see the [`agent-team`](../skills/agent-team/SKILL.md) skill,
especially the parallel-review mode.

| Agent                                                     | Use when                                                                                                                                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`oklch-engine-reviewer`](./oklch-engine-reviewer.md)     | A change touches `packages/oklch/` (`@garden/oklch`) — isomorphism, gamut-map-before-contrast, scheme-aware output, never-throws fallback.                                                 |
| [`theming-reviewer`](./theming-reviewer.md)               | A change touches tokens, CSS Modules / `@layer`, `ProjectScope`, or slot scoping — three-tier model, generic semantic names, global chrome vs slot-scoped brand, flash-free.               |
| [`sanity-content-reviewer`](./sanity-content-reviewer.md) | A change touches `studio/`, the schema, GROQ, `keys.ts`, or content fetching — one `entry` type + maturity + backlinks, stega off `brandColor`/`fontKey`, `defineLive`, committed TypeGen. |

## Generic process agents live globally

Reusable, cross-repo **process** agents — adversarial QA, architect, devil's-advocate, and the like —
are **not** defined here. They live in `~/.claude/agents/` so they're available in every repo. This
folder is only for agents that encode **this repo's domain rules**. If a lens here turns out to be
portable (no digital-garden-specific rules), it belongs in the global folder instead.
