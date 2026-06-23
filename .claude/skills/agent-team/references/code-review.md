# Mode: Parallel Code Review

> Read [`../SKILL.md`](../SKILL.md) §0–§1 first. This is the best **first** team to run — clear
> boundaries, no parallel writes, low coordination risk. A great way to feel out agent teams.

A single reviewer gravitates toward one class of issue at a time. Splitting the review into
**independent lenses** means every dimension gets thorough attention simultaneously, and the
teammates can challenge each other's findings (the team advantage over subagents).

> **Check the lighter options first.** Two installed capabilities already cover much of this — name
> them in your preflight and justify the team over them, don't silently skip them:
>
> - **`pr-review-toolkit:review-pr`** — a skill that _already orchestrates_ the specialized review
>   agents. It covers the bulk of a multi-lens PR review out of the box. A team beats it only when you
>   want lenses pinned to the user's exact named concerns, each grounded in _this repo's_ `[D#]`s/gate,
>   plus live cross-examination between reviewers.
> - **`/code-review`** — a fast single-pass review of the working diff at an effort level. Right when
>   the user wants speed over breadth.
>
> If either fits, recommend it and stop. Use the team when the value is **breadth + adversarial
> cross-examination** the user explicitly asked for ("not a single once-over").

## The shape: one lens per teammate → each reports findings → lead synthesizes

**1. Establish the target.** Identify exactly what's under review — a PR number, a branch diff
(`git diff main...HEAD`), or the working tree. Put it in every brief so teammates review the _same_
thing through different filters.

**2. Spawn one teammate per lens.** Give each a distinct filter so they don't overlap. Map to the
repo's existing review agents where they fit — spawn teammates **using those subagent definitions**
to inherit their tool-allowlists and prompts:

| Lens                             | Reuse this agent type / focus                                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Correctness / bugs / logic       | `pr-review-toolkit:code-reviewer` or `feature-dev:code-reviewer`                                                                         |
| Silent failures / error handling | `pr-review-toolkit:silent-failure-hunter`                                                                                                |
| Test coverage                    | `pr-review-toolkit:pr-test-analyzer`                                                                                                     |
| Type design                      | `pr-review-toolkit:type-design-analyzer`                                                                                                 |
| Repo-convention adherence        | the gate + `[D#]`s + handbook (this repo's footguns: `@layer` [D12], isomorphic engine [D14], literal imports [D21], async request APIs) |
| Accessibility / performance      | `chrome-devtools:*` / `vercel:performance-optimizer` for rendered surfaces ([D25])                                                       |

Brief each per §1: name the diff/PR, the source-of-truth files by path, the binding `[D#]`s, "report
findings as a dense list with file:line + severity + cited rationale", and cite-don't-remember.

**3. Cross-challenge (optional but valuable).** Have reviewers read each other's findings and flag
false positives or disagreements — a security flag that the test-coverage reviewer can show is
already covered, etc. This is the team's edge over isolated subagents.

**4. Lead synthesizes.** Collapse into one deduplicated, severity-ranked report. Resolve
disagreements explicitly (don't average them away). Note which findings are blocking vs nits.

## Team setup

- 3–5 lens teammates; review is read-only so **no file-ownership conflict** — the usual constraint
  doesn't bite here.
- This mode pairs naturally with the repo's `/code-review` skill (which reviews a diff inline). Use
  a team when you want **breadth + cross-examination**; use `/code-review` for a fast single pass.
- Output is advisory — fixes are a separate coding pass (see [`coding-feature.md`](coding-feature.md)).
