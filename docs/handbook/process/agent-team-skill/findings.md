# Findings — With-Skill vs. Baseline

This trail's analogue of the debate round ([`../round-2-debate/`](../round-2-debate/)): the plans in [`eval-runs/`](./eval-runs/)
graded against the [`eval-design.md`](./eval-design.md) assertions, and the head-to-head that drove the
iteration. Grading is assertion-pass-rate, judged by the lead from the verbatim outputs.

## Scorecard

| Mode     | With-skill | Baseline | Notes                                                                                                                                                        |
| -------- | :--------: | :------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Decision |  **7/7**   | — (lost) | Caught that `[D5]` already decides this; reframed as reaffirm-vs-supersede.                                                                                  |
| Review   |  **7/7**   | **7/7**  | Both caught the PR-#5-doesn't-exist trap. Baseline _also_ named `pr-review-toolkit:review-pr` as a substitute and reasoned review is convergent (no debate). |
| Debug    |  **6/6**   |  strong  | Both caught the route-doesn't-exist trap. Baseline made the sharper staffing call (subagents for diagnosis, team for the fix).                               |
| Coding   |  **7/7**   | — (lost) | Froze a contract up front to parallelize a dependency chain; verified file-disjointness.                                                                     |

Headline: **the skill reliably produces excellent plans.** It also reliably hit the deliberate preflight
traps — no with-skill plan spawned a team against a non-existent target.

## Where the skill clearly added value

- **Decision ([`runs/decision-with-skill.md`](./eval-runs/decision-with-skill.md)):** the strongest single
  artifact. It read `docs/decisions.md` first, found **`[D5]` already chose `light-dark()`**, and
  reframed the entire job: a team here is "a deliberate re-litigation to either reaffirm with fresh
  evidence or **supersede** — decisions are immutable." It planned a `D24 — reaffirms/supersedes D5`
  record and a persisted `round-1/round-2/synthesis` trail. This is the handbook's ADR discipline
  applied without being told.
- **Coding ([`runs/coding-with-skill.md`](./eval-runs/coding-with-skill.md)):** spotted that
  data→component→tests is a _sequential dependency chain_, and neutralized it with a **frozen contract**
  (field shape + props + component key fixed in the briefs) so all three slices code in parallel against
  it. File-ownership table with a **single writer** for the generated `sanity.types.ts`. Gate-green
  handoff, `TaskCompleted` hook, lead-curates + squash-merge, never-main, `--force-with-lease`.

## Where the baseline matched or beat the skill (the iteration signal)

Because [`../../working-with-agents.md`](../../working-with-agents.md) §4–§6 already encodes this whole
pattern, the handbook-reading baselines were excellent too — and on two points **sharper** than the
with-skill runs:

1. **Tool selection / over-spawning.**
   [`runs/debug-baseline.md`](./eval-runs/debug-baseline.md) argued that **diagnosis is read-only and belongs
   in parallel subagents**, reserving a true **team for the multi-file fix** — and only if the fix
   crosses ≥2 owned file sets. [`runs/debug-with-skill.md`](./eval-runs/debug-with-skill.md) instead spawned a
   4-agent team for diagnosis itself. The skill's §0 had the team-vs-subagent gate but the mode
   references assumed "you've decided on a team" and didn't re-test staffing per phase. **The baseline's
   instinct was the better one.**

2. **Knowing the existing capabilities.**
   [`runs/review-baseline.md`](./eval-runs/review-baseline.md) built a full options table that named
   **`pr-review-toolkit:review-pr`** as the ~80% substitute ("honest call: it covers ~80% of this") and
   `/code-review` as the fast single-pass. [`runs/review-with-skill.md`](./eval-runs/review-with-skill.md)
   mapped lenses onto `pr-review-toolkit:*` agents but **never surfaced the existing review-pr
   orchestrator** as the lighter-first option. The skill should make the agent _more_ aware of existing
   tools, not less.

Both review plans also independently reasoned that **a PR review is convergent, not the heavy
adversarial-debate pattern** — confirming the skill correctly reserves debate for architecture
decisions.

## Verdict going into synthesis

The skill is high-quality and faithfully transfers the pattern; its marginal lift over a strong
handbook-reading baseline is modest and concentrated in the mode recipes. The highest-value fix is to
make it **honest about when _not_ to spawn a team** — the one thing the baseline did better. See
[`synthesis.md`](./synthesis.md).
