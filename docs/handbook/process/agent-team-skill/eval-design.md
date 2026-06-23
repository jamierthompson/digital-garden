# Eval Design — How the Skill Was Tested

Following the `skill-creator` loop (draft → test → grade → iterate → optimize). The question each test
answers: **does a session _with_ the skill produce a better team-lead orchestration plan than a session
_without_ it?** The unit under test is the **plan** — preflight, mode choice, verbatim spawn briefs,
work split, close-the-loop — not an actually-run team (subagents can't spawn nested teams, and the plan
is what the skill most directly shapes).

## Method

- **One test prompt per mode** (4 total), written the way the repo owner would actually type them.
- **Each prompt run twice**: a **with-skill** subagent (told to read the staged `SKILL.md` and follow
  it) and a **baseline** subagent (identical task framing, no skill). 8 runs total.
- **Clean baseline.** Because `.claude/skills/agent-team/` is a project skill, any spawned subagent
  would auto-load it — contaminating the baseline. So for the eval the live skill was **parked** out of
  `.claude/skills/` and a copy staged elsewhere; with-skill runs were pointed at the staged path, and
  the skill was **restored** afterward.
- **Grading:** each plan is scored against its mode's assertions (below), pass/partial/fail, judged from
  the verbatim output in [`runs/`](./runs/).

## The test prompts

| Mode     | Prompt (verbatim)                                                                                                                                                                                        |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decision | _"I'm torn on whether the OKLCH engine emits both light+dark via `light-dark()` or stores per-scheme tokens — this locks the engine signature for every project. Spin up a team to settle it properly."_ |
| Review   | _"Review PR #5 before I merge — I want security, test coverage, and our repo conventions all checked, not a single once-over."_                                                                          |
| Debug    | _"On `/work/<slug>` the brand color flashes the wrong hue for a split second on first paint then corrects. No idea if it's caching, `@layer` order, or hydration. Get to the bottom of it."_             |
| Coding   | _"Build the ProjectScope feature across the data layer, the component, and tests — split it up so we move fast."_                                                                                        |

Two prompts contain deliberate **traps** that a good plan should catch in preflight rather than charge
past: PR #5 **does not exist** in the repo (latest is #4, all merged), and the `/work/<slug>` route +
OKLCH engine **aren't built yet** (the repo is at Phase 0). A plan that spawns a team against a
non-existent target is failing preflight.

## The assertions (per mode)

Common to all: **preflight checks the experimental flag**; **right-tool justification** (team vs.
subagents vs. solo); **correct mode**; **briefs are self-contained** (source-of-truth files _by path_ +
cite-don't-remember restated); **close-the-loop** is disciplined.

- **Decision** — diverse independent lenses (3–5) drafting before seeing each other; synthesis resolves
  conflicts explicitly (no smoothed consensus) and records a **new `[D#]`** (supersede, never edit);
  grounded in the existing `docs/audit/` trail / the engine-signature decision.
- **Review** — one distinct lens per teammate (≥ security, test-coverage, conventions); reuses installed
  agents (`pr-review-toolkit:*`); notes review is read-only (no file-ownership conflict); lead
  synthesizes one deduplicated, severity-ranked report.
- **Debug** — a distinct hypothesis per teammate; teammates actively **disprove** each other; convergence
  is evidence-driven and disproven theories are recorded.
- **Coding** — each teammate owns a **distinct** file set (overlaps → task dependencies, not parallel
  writes); gate-green handoff (full CI chain); verify-before-done (hook / progress doc); lead curates
  history & squash-merges; never commit to `main`; `--force-with-lease`.

The full machine-readable set lives in the eval workspace (`evals.json` / per-run `eval_metadata.json`).
Results and grading are in [`findings.md`](./findings.md).
