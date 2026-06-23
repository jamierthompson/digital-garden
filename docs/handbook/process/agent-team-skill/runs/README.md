# Run Artifacts — Verbatim Agent Outputs

The actual orchestration plans produced by the eval subagents, copied **verbatim** (the real evidence,
not a summary). Each was written by a fresh `general-purpose` subagent given the test prompt from
[`../eval-design.md`](../eval-design.md); with-skill runs were told to read the staged `agent-team`
skill first, baseline runs were not.

| File                                                 | Mode     | Condition           |
| ---------------------------------------------------- | -------- | ------------------- |
| [`decision-with-skill.md`](./decision-with-skill.md) | Decision | with skill          |
| [`review-with-skill.md`](./review-with-skill.md)     | Review   | with skill          |
| [`review-baseline.md`](./review-baseline.md)         | Review   | baseline (no skill) |
| [`debug-with-skill.md`](./debug-with-skill.md)       | Debug    | with skill          |
| [`debug-baseline.md`](./debug-baseline.md)           | Debug    | baseline (no skill) |
| [`coding-with-skill.md`](./coding-with-skill.md)     | Coding   | with skill          |

**Missing:** `decision-baseline` and `coding-baseline` — both baseline subagents died in the
2026-06-23 platform incident across two retries (see [`../README.md`](../README.md) "Honest gaps").

These are unedited model output and may contain the agents' own minor inaccuracies — they're preserved
as the primary record the grading in [`../findings.md`](../findings.md) was judged against.
