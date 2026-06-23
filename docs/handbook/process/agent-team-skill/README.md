# Building the `agent-team` Skill — Process Trail

How the [`agent-team`](../../../../.claude/skills/agent-team/) skill was built and validated. This
mirrors the two worked examples already in the repo — the architecture [`../../../audit/`](../../../audit/)
and the handbook's own [`../`](../) (research → drafts → debate → synthesis) — applied this time to a
**skill-creation** task: draft a skill, then run an **eval-driven loop** (with-skill vs. baseline
subagents) to prove it earns its place and find what to fix.

The skill makes the running session a **team lead**: it codifies, as an on-demand playbook, the same
multi-agent pattern [`../../working-with-agents.md`](../../working-with-agents.md) §4–§6 documents in
prose. Four modes: architecture decision, parallel review, competing-hypotheses debugging, cross-layer
coding.

## How to read this folder

| File                                 | What it is                                                                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`sources.md`](./sources.md)         | The research input: what the **official** Anthropic/Claude Code docs say agent teams are good at — the ground truth the skill is built on.                          |
| [`eval-design.md`](./eval-design.md) | The eval method: the 4 test prompts (one per mode), the per-mode assertions, and how the with-skill vs. baseline comparison was run.                                |
| [`runs/`](./runs/)                   | The **real, verbatim agent outputs** — the orchestration plans each subagent produced. This is the evidence, not a summary of it.                                   |
| [`findings.md`](./findings.md)       | The comparison round (this trail's analogue of `round-2-debate.md`): with-skill vs. baseline, graded against the assertions, and the two gaps the baseline exposed. |
| [`synthesis.md`](./synthesis.md)     | **Start here for the conclusions.** What the eval forced to change in the skill, and the verdict.                                                                   |

## Headline outcome

The skill works: **every with-skill plan scored ~7/7** on its mode's assertions — correct preflight
(experimental-flag check), correct mode, self-contained briefs with file-ownership + cite-don't-remember,
and a disciplined close (synthesis without smoothed consensus / lead-curates-and-squash-merges). Two
plans showed the pattern landing especially well: the **decision** run caught that the question was
_already settled by `[D5]`_ and reframed the team as reaffirm-vs-supersede an immutable decision; the
**coding** run invented a **frozen contract** so a dependency chain could run in parallel.

The more useful finding was about the **baseline**. Because this repo's
[`../../working-with-agents.md`](../../working-with-agents.md) already encodes the whole pattern, a
general agent that reads the handbook _also_ scored ~7/7. So the skill's marginal lift is real but
modest — and the baselines exposed two places the skill was actually **weaker**, which drove the
iteration:

1. **It over-steered toward spawning a team.** The baseline debug plan made the sharper call —
   read-only **subagents** for diagnosis, a **team only for a multi-file fix** — while the with-skill
   plan spawned a 4-agent team for diagnosis. → Added **phase-aware staffing** to the skill.
2. **It missed the existing review orchestrator.** The baseline named **`pr-review-toolkit:review-pr`**
   as the ~80% substitute; the with-skill plan didn't. → The review mode now points at it (and
   `/code-review`) as the lighter-first options.

See [`synthesis.md`](./synthesis.md) for the full reasoning and the exact edits.

## Honest gaps in this run

- **6 of 8 runs landed.** An Anthropic platform incident (elevated error rate, 2026-06-23 ~14:19–14:53
  UTC) killed two baseline subagents (`decision/baseline`, `coding/baseline`) across two retries. The
  conclusions rest on the 4 with-skill plans + the 2 baseline pairs that completed (review, debug); the
  decision/coding baseline deltas are inferred, not measured. Flagged rather than smoothed over —
  same discipline as the handbook synthesis rejecting two critiques on verification.
- **Quantitative grading is assertion-pass-rate, judged by the lead from the verbatim plans in
  [`runs/`](./runs/)** — not a token/latency benchmark (the incident made timing data unreliable).
