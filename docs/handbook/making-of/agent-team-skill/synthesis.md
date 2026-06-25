# Synthesis — What the Eval Forced to Change

The consolidation step, mirroring [`../synthesis.md`](../synthesis.md). The eval ([`findings.md`](./findings.md))
showed a high-quality skill whose main weakness was **over-steering toward spawning a team** when a
cheaper tool fit. Two surgical edits followed; one round; no smoothed-over consensus. **Start here for
the conclusions; see [`README.md`](./README.md) for the map.**

> The synthesis rule held here, same as the handbook's: where the baseline genuinely beat the
> with-skill plan, name it and fix the skill — don't rationalize the skill's behavior. Two of the eight
> runs were lost to a platform incident; that gap is stated, not papered over.

## What changed in the skill

### 1. Phase-aware staffing (the anti-over-spawning fix)

**Why:** [`eval-runs/debug-baseline.md`](./eval-runs/debug-baseline.md) correctly used read-only **subagents for
diagnosis** and reserved a **team for a multi-file fix**; [`eval-runs/debug-with-skill.md`](./eval-runs/debug-with-skill.md)
spawned a 4-agent team for diagnosis. The skill's §0 had a team-vs-subagent gate, but the mode
references read as "you've already decided on a team."

**Edit:**

- `SKILL.md` §0 — added a "**staffing can change by phase — re-run this test per phase**" paragraph:
  most tasks have one phase that wants a team and one that doesn't; debugging diagnosis is often
  subagents while the fix is a team; "when a mode reference says 'spawn N teammates,' it assumes you've
  already passed this test _for that phase_ — if a phase is read-only fan-out with no cross-talk,
  downgrade it to subagents and say so."
- `references/debugging.md` — added a **"Staffing first: is this even a team phase?"** section up top:
  diagnosis (read-only) → subagents unless theories genuinely need live cross-examination; the fix →
  a coding team only if it spans multiple owned files. Common shape: "subagents (or a small debate team)
  to find the cause → a coding team to fix it."

### 2. Surface the existing review capabilities

**Why:** [`eval-runs/review-baseline.md`](./eval-runs/review-baseline.md) named **`pr-review-toolkit:review-pr`**
as the ~80% substitute and `/code-review` as the fast single-pass; the with-skill plan didn't surface
either. A skill should make the agent _more_ aware of existing tools.

**Edit:** `references/code-review.md` — added a **"Check the lighter options first"** callout naming
`pr-review-toolkit:review-pr` (the existing orchestrator) and `/code-review`, with the rule: if either
fits, recommend it and stop; use the team only for the **breadth + adversarial cross-examination** the
user explicitly asked for.

## What was deliberately _not_ changed

- **The four modes and the research→debate→synthesis core** survived — both review plans independently
  confirmed the skill correctly reserves heavy adversarial debate for architecture decisions, not
  reviews.
- **No second eval round** was run: the edits are additive guardrails (they tell the agent to consider
  cheaper tools), and the platform incident made more subagent runs unreliable. The before/after for
  decision/coding baselines remains inferred.
- **No `[D#]` was written.** Building a skill is tooling, not an architecture decision that locks a
  contract; `docs/decisions.md` was left untouched.

## Verdict

Ship it. The `agent-team` skill ([`.claude/skills/agent-team/`](../../../../.claude/skills/agent-team/))
codifies the repo's multi-agent pattern as an on-demand, mode-routed playbook, grounded in the official
docs ([`sources.md`](./sources.md)) and this repo's handbook. After the iteration it is also honest
about its own cost — it actively routes work to subagents, a single session, or an existing skill when
those are the right tool, and only spawns a team when the cross-examination or parallel file-ownership
genuinely earns the ~15× token premium.

## Related

- [`README.md`](./README.md) — the trail map · [`sources.md`](./sources.md) — official-doc ground truth
- [`eval-design.md`](./eval-design.md) · [`findings.md`](./findings.md) · [`eval-runs/`](./eval-runs/) — the evidence
- [`../../working-with-agents.md`](../../working-with-agents.md) — the prose pattern this skill operationalizes
- [`../../../audit/`](../../../audit/) · [`../`](../) — the two trails this one mirrors
