# Sources — What the Official Docs Say Agent Teams Are Good At

The research input for the skill. Every design choice traces to one of these, plus the repo's own
[`../../working-with-agents.md`](../../working-with-agents.md) §4–§6 and the two worked trails
([`../../../audit/`](../../../audit/), [`../`](../)). Cite the source that actually contains the fact.

## 1. Agent teams — [code.claude.com/docs/en/agent-teams](https://code.claude.com/docs/en/agent-teams)

The experimental multi-session feature the skill orchestrates.

- **Disabled by default.** Without `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in settings/env, "no team
  is set up at session start … and Claude does not spawn or propose teammates." → the skill's §0
  preflight checks this first.
- **Teams vs. subagents** is the load-bearing distinction. Subagents "report results back to the main
  agent only" and "never talk to each other"; team teammates "message each other directly," share a
  task list, and self-claim work. Teams cost more (each teammate is a full Claude instance). → use a
  team when workers must **discuss/challenge/coordinate**; use subagents when **only the result
  matters**.
- **Strongest use cases** (verbatim): **research and review**; **new modules or features** ("each own a
  separate piece without stepping on each other"); **debugging with competing hypotheses** ("test
  different theories in parallel and converge … faster"); **cross-layer coordination** (frontend/
  backend/tests, "each owned by a different teammate"). → these became the skill's four modes.
- **Best practices:** 3–5 teammates ("three focused teammates often outperform five scattered ones");
  ~5–6 tasks each; tasks are "self-contained unit[s] that produce a clear deliverable"; **"avoid file
  conflicts"** — "break the work so each teammate owns a different set of files"; **"start with research
  and review"** (no code) before parallel implementation; "monitor and steer."
- **Mechanics encoded in the skill:** `TeammateIdle` / `TaskCreated` / `TaskCompleted` hooks (exit code
  2 = reject + feedback, keep working); plan-approval mode for risky work; spawning a teammate from a
  **subagent definition** to reuse a role's tool-allowlist + system prompt; task **dependencies**
  (a blocked task can't be claimed until its deps complete).
- **Known limitations** (so the skill warns about them): no session-resume for in-process teammates;
  task status can lag; one team per session; no nested teams; lead is fixed.

## 2. Long-running agents — [anthropic.com/engineering/effective-harnesses-for-long-running-agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)

Less about _teams_, more about _durable_ agent work — its lessons shaped the **coding** mode.

- **Good at** "complex tasks requiring work that spans hours, or even days" — incremental feature
  development across many context windows, not single-pass completion.
- **Harness = external memory + verification.** An **initializer** scaffolds (`init.sh`, a
  `progress.txt`, a JSON feature-list with everything marked _failing_); a **coding agent** reads
  progress + git log, does **one feature at a time**, and **verifies before marking done**. → the
  coding mode's "external progress doc before re-spawning" and the `TaskCompleted`-gate (verify-before-
  done) come straight from here.
- **Named failure mode:** "Claude's tendency to mark a feature as complete without proper testing,"
  fixed with explicit tool-based verification. → the gate-green-handoff rule.
- **Multi-agent is an open question there** — the article uses a single agent with phase-differentiated
  prompts and only _speculates_ specialized agents could help. → reinforces the skill's "default to the
  smallest tool; don't spawn a team for a phase that doesn't need one."

## 3. Supporting evidence (via the repo's R4 note)

[`../research/R4-agent-collaboration.md`](../research/R4-agent-collaboration.md) already collected the
multi-agent literature this skill leans on: adversarial debate raises accuracy when agents are diverse
and critiques are fact-grounded; Anthropic's multi-agent research system (+90.2% over single-agent at
~15× tokens — reserve for high-value decisions); and the two pitfalls the skill encodes — **synthesis
must not smooth a fake consensus**, and **don't add agents to fix coordination** (sharpen the prompt).
