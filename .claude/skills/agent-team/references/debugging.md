# Mode: Debugging via Competing Hypotheses

> Read [`../SKILL.md`](../SKILL.md) §0–§1 first. Use when a bug's **root cause is unclear** and
> there are several plausible theories. A single agent tends to find one plausible explanation and
> stop looking (anchoring). Multiple investigators who actively try to **disprove each other** beat
> that bias — the surviving theory is much more likely to be the real cause.

## Staffing first: is this even a team phase?

Debugging is two phases — **diagnosis**, then **fix** — and they want different tools. Decide per phase
(SKILL.md §0); don't default the whole job to a team:

- **Diagnosis is read-only.** If the theories are independent enough to investigate in parallel but
  don't really need to _argue_ with each other, parallel **subagents** (the `Agent` tool) returning
  cited digests are cheaper and sufficient — the lead converges. Reach for a **competing-hypotheses
  team** only when the value is live cross-examination: teammates messaging each other to disprove
  theories in real time (the recipe below). Both are legitimate — pick honestly.
- **The fix is usually a team** _only if_ it spans multiple owned files (engine + CSS + a regression
  test) — that's [`coding-feature.md`](coding-feature.md). A one-file fix is a single session.

So a common, correct shape is **subagents (or a small debate team) to find the cause → a coding team
to fix it**. The rest of this page is the debate-team recipe — use it when the cross-examination earns
its cost.

## The shape: N teammates, one theory each, adversarial → consensus

**1. Frame the symptom precisely.** Write down the observed behavior, the expected behavior, repro
steps, and any logs/errors. This goes in every brief verbatim so teammates investigate the same
phenomenon.

**2. Enumerate hypotheses, one per teammate.** Spawn 3–5 teammates, each assigned a _different_
root-cause theory to investigate. If you can't name distinct theories up front, spawn a short
research pass first (or ask the team to propose theories, then assign). Example split for a Next 16
/ React 19 surface:

- Caching / `'use cache'` boundary or stale `cacheTag` (`08-caching.md`)
- Async request API misuse (`cookies()`/`params` not awaited)
- `@layer` cascade / unlayered CSS Module silently winning (an unlayered module outranks every layered style)
- Hydration / Server-vs-Client component boundary
- Data layer (GROQ / TypeGen drift / reference-by-key resolver returning `NotFound`)

**3. Adversarial debate — "like a scientific debate."** The key mechanism: each teammate's job is
**not only to investigate its own theory but to try to disprove the others'**. Have them message
each other directly with evidence (a log line, a doc citation, a minimal repro). Theories that
can't survive scrutiny get eliminated. This is the exact pattern the official docs hold up as the
strongest debugging use of teams.

**4. Converge & record.** The lead drives to the consensus root cause, backed by evidence (not a
vote). Update a findings doc with the conclusion **and the disproven theories** (why each was ruled
out) — that record saves the next investigator from re-treading them. Then fix it (a small fix may
be a single follow-up task; a cross-layer fix → [`coding-feature.md`](coding-feature.md)).

## Team setup & cautions

- 3–5 teammates. Brief each per §1 with the symptom, repro, the source-of-truth files **by path**,
  and **cite-don't-remember** — a wrong memorized Next/React behavior will send an investigator
  down a phantom theory.
- Investigation is mostly read-only; if a teammate needs to add temporary instrumentation, give it
  its **own file/branch** so probes don't collide.
- Demand **evidence over plausibility** — a theory "survives" only when the others fail to disprove
  it with facts, not because it sounds reasonable.
