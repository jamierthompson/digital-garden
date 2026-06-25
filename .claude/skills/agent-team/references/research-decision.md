# Mode: Research / Architecture Decision

> Read [`../SKILL.md`](../SKILL.md) §0–§1 first. This is the highest-value team pattern and the
> most expensive (~15× single-agent tokens — [Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)).
> **Reserve it for an architecture-class decision**: one that is hard to reverse, crosses a
> module/package boundary, locks an external contract (Sanity schema, `keys.ts`, token names), or
> contradicts the plan or a `[D#]`. For anything smaller, a single session is the right tool.

The repo has run this twice end-to-end — study them as templates:
[`docs/audit/`](../../../../docs/audit/) (five-lens architecture audit) and
[`docs/handbook/making-of/`](../../../../docs/handbook/making-of/) (research → drafts → debate → synthesis).

## The shape: research → N independent drafts → adversarial debate → cited synthesis

**1. Research, with citations.** Pin every claim to a primary source — the bundled docs
(`node_modules/next/dist/docs/`), a spec URL, or a `[D#]`. Isolate verbose fetching/log-crunching
in subagents (or research-phase teammates) that return a **dense, cited digest**. The repo's
[`docs/handbook/making-of/research/`](../../../../docs/handbook/making-of/research/) R1–R6 notes are the
output shape to aim for.

**2. N independent drafts — diversity is the whole point.** Spawn one teammate per **distinct
role-lens** and have each draft **independently, before seeing the others' work**. Identical agents
add nothing; the diversity is what makes the debate productive. The audit's five lenses are a model
set — adapt to the decision:

- **Architect** — abstraction altitude, coupling/cohesion, right-sized vs over-engineered.
- **FrameworkFit** — does it match the _actually installed_ Next 16 / React 19, verified against
  the bundled docs (not training data)?
- **Theming / ContentModel / Sequencing** — or whatever domain lenses the decision touches.
- Always consider an explicit **devil's advocate** lens.

Give each lens the §1 brief: objective, the source-of-truth files **by path**, boundaries, "return
a dense cited digest", model tier (route hard reasoning to a stronger model), and cite-don't-remember.

**3. Adversarial debate.** Have the teammates **challenge, defend, or concede** against each
other's drafts — message each other directly (this is exactly what teams do that subagents can't).
Critiques must be **fact-grounded** — cite a doc/decision, not vibes. This is where the decision
actually moves. See [`docs/audit/round-2-debate.md`](../../../../docs/audit/round-2-debate.md) for the
texture: a critique is only valid if it cites the source that _actually contains_ the fact.

**4. Cited synthesis (lead's job).** Consolidate into one verdict.

- **Do not smooth a fake consensus.** Where drafts genuinely disagree, resolve it and say which
  won and why. It's healthy for some critiques to be **rejected on verification** — the handbook
  synthesis rejected two; that's the pattern working.
- **Record the resolved calls as a new `[D#]`** in [`docs/decisions.md`](../../../../docs/decisions.md).
  Decisions are immutable — write a _superseding_ record, never edit an accepted one.
- **Persist the trail** (`round-1-*`, `round-2-*`, `synthesis.md`) to the repo as external memory.

## Team setup

- 3–5 lens teammates + you as lead/synthesizer. Name them by lens.
- Require **plan approval** if any teammate will write code as part of the decision.
- Keep each lens's draft in its **own file** (e.g. `making-of/round-1-drafts/<lens>.md`) so no two
  teammates write the same file.
