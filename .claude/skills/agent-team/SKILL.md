---
name: agent-team
description: Spawn and orchestrate an experimental Claude Code agent team (multiple coordinating teammates with their own context windows that share a task list and message each other) for work in this repo. Use whenever the user wants to run an agent team, spin up teammates, "fan this out to agents", have agents debate or challenge each other, or parallelize a job across independent agents — for any of four jobs: an architecture/design decision (independent lenses → adversarial debate → cited synthesis → ADR), a parallel code review, debugging via competing hypotheses, or a cross-layer / multi-module coding feature where each agent owns a distinct slice. Trigger on "spawn a team", "agent team", "use teammates", "have agents debate this", "parallel review", "investigate with competing hypotheses", or any task large and divisible enough that several independent agents who challenge each other beat one session. This skill makes you the team LEAD: it covers preflight (the experimental flag), the team-vs-subagent decision, how to brief teammates, splitting work by file ownership, and how the lead curates history and merges. Prefer it over hand-rolling multi-agent coordination.
---

# Agent Team — spawn & orchestrate (experimental)

You are about to act as the **team lead**: spawn coordinating Claude Code teammates, divide
the work, keep them on track, and synthesize/curate the result. This skill is the playbook for
doing that well **in this repo**. It is grounded in:

- The repo's own operating manual: [`docs/handbook/working-with-agents.md`](../../../docs/handbook/working-with-agents.md)
  §4 (research → drafts → debate → synthesis), §5 (briefing), §6/§6.1 (own-a-slice, lead curates).
- Continuous refinement: every session runs this pattern and records what worked (and what didn't)
  in [`docs/sessions/`](../../../docs/sessions/), so the practice improves with use.
- Official guidance: [Agent teams](https://code.claude.com/docs/en/agent-teams) and
  [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents).

**Read this whole file, then open the one mode reference that matches the job.** Don't run all
four — pick one.

---

## 0. Preflight — confirm a team is the right tool, then that it's enabled

**First decide: team, subagents, or solo?** A team costs **significantly more tokens** than a
single session (each teammate is a full Claude instance) and adds coordination overhead. The
official guidance: teams are for work where **parallel exploration adds real value** and workers
**need to talk to each other** — challenge findings, share hypotheses, coordinate a shared task
list. If workers only need to go fetch a result and report back, use **subagents** (cheaper, the
`Agent` tool). If the work is sequential, touches the same files, or has many dependencies, use a
**single session**. Default to the smallest tool that fits.

| Signal                                                                | Reach for          |
| --------------------------------------------------------------------- | ------------------ |
| Workers must debate / disprove each other / converge on consensus     | **Team**           |
| Independent slices over **distinct file sets**, shipped in parallel   | **Team**           |
| Verbose work to isolate (log-crunch, doc-fetch) — only result matters | **Subagents**      |
| Sequential, same-file, or dependency-heavy                            | **Single session** |

**Staffing can change by phase — re-run this test per phase; don't lock in "team" for the whole
job.** Most real tasks have one phase that wants a team and another that doesn't. The sharpest case is
**debugging**: pure root-cause _diagnosis_ is read-only and is often best as parallel **subagents**
(use a competing-hypotheses _team_ only when theories genuinely need to debate and disprove each
other), while the **multi-file fix** afterward is a team. Don't pay for a team on a phase a cheaper
tool covers just because a later phase needs one. When a mode reference says "spawn N teammates," it
assumes you've already passed this test _for that phase_ — if a phase is read-only fan-out with no
cross-talk, downgrade it to subagents and say so.

**Then confirm the experimental flag is on.** Agent teams are **disabled by default**; without
`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in settings/env, no team forms and no teammate spawns.
Verify before you promise a team:

```bash
grep -r CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS ~/.claude/settings.json .claude/settings*.json 2>/dev/null \
  || echo "NOT SET — agent teams are disabled; tell the user to add it to settings.json env and restart"
```

If it's unset, stop and tell the user — spawning will silently do nothing otherwise.

---

## 1. The universal mechanics (apply to every mode)

These hold no matter which mode you pick. The mode reference adds the mode-specific recipe on top.

**Team size & task sizing** (from the official best-practices):

- **3–5 teammates** is the sweet spot. Three focused teammates beat five scattered ones. Scale up
  only when the work genuinely parallelizes.
- **~5–6 tasks per teammate** keeps everyone busy and lets you reassign if one gets stuck.
- A task is a **self-contained unit that produces a clear deliverable** (a function, a test file,
  a review, a draft). Too small → coordination overhead exceeds benefit. Too large → teammates run
  too long without check-ins and waste effort.

**Briefing — every spawn prompt must be self-contained** (handbook §5). Teammates start with a
**fresh, isolated context**: they load `CLAUDE.md`/`AGENTS.md`, skills, and MCP servers, but they
do **not** see your conversation history or anything you've read. The spawn prompt is the only
channel in. Every brief includes:

- [ ] **Objective** — one crisp task, not a grab-bag.
- [ ] **Source-of-truth files by path** — name the bundled docs (`node_modules/next/dist/docs/`),
      the `[D#]`s, the `§N`s, and the ground-truth files it must open. It can't see what you read.
- [ ] **Boundaries** — what's out of scope, what not to touch, which decisions are binding, and
      (critically) **which files this teammate owns** so two teammates never edit the same file.
- [ ] **Output format** — a **dense, cited digest** (or, for coding, a gate-green slice + summary),
      not raw output.
- [ ] **Model tier** — name it if the subtask needs stronger reasoning vs. a cheap pass.
- [ ] **Cite-don't-remember** — restate it: "verify framework claims against the bundled docs at
      `node_modules/next/dist/docs/`; don't work from memory." This repo is Next 16 / React 19 and
      memorized APIs are wrong often enough to be dangerous (AGENTS.md "the one rule").

Spawn teammates with predictable names so you can address them later ("call them Architect,
Theming, …"). You can spawn a teammate **using a subagent definition** (e.g. `feature-dev:code-reviewer`,
`Explore`) to reuse a role's tool-allowlist and system prompt — mention the agent type in the
spawn instruction.

**Own the permission surface — don't make the owner babysit** (handbook §6.2). Set the posture once
at spawn, then clear teammates' permission requests yourself; escalate to the owner only for genuinely
out-of-policy actions. For the **coding mode** this is mostly free: give each teammate an **in-root git
worktree** at `.claude/worktrees/<slug>/` (never the ephemeral `isolation: "worktree"` flag, which lands
outside the root) so its edits sit inside cwd scope and `acceptEdits` auto-accepts them with no prompts
`[D29]` — full recipe in [`references/coding-feature.md`](references/coding-feature.md) step 3.

**Two failure modes to design against** (both documented):

- **Don't add agents to fix coordination.** When teammates duplicate or miss work, the fix is a
  **sharper delegation prompt**, not more teammates ([Anthropic multi-agent research](https://www.anthropic.com/engineering/multi-agent-research-system)).
- **Synthesis must not smooth a fake consensus.** Where teammates genuinely disagree, resolve it
  explicitly and say which view won **and why** — never paper over a real conflict with a tidy
  summary ([Ewerlöf](https://blog.alexewerlof.com/p/multi-agent-system-reliability)).

**Monitor & steer.** Don't let the team run unattended — check progress, redirect approaches that
aren't working, and synthesize findings as they arrive. If the lead (you) starts doing the work
instead of delegating, stop and wait for teammates. Known experimental quirks to watch: task
status can lag (nudge a teammate to mark its task done so dependents unblock); resume/rewind don't
restore in-process teammates (re-spawn if needed).

**Quality gates via hooks (optional but powerful).** `TeammateIdle`, `TaskCreated`, and
`TaskCompleted` hooks can **exit code 2 to send feedback and keep a teammate working** — e.g. block
a task from being marked complete until the gate is green. Use this to enforce
[`definition-of-done.md`](../../../docs/handbook/definition-of-done.md) on coding slices.

---

## 2. Pick the mode

Open the matching reference and follow its recipe. Each reference assumes you've read §0–§1 above.

| The job in front of you                                                                                                                                                                   | Mode                 | Reference                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------- |
| A hard-to-reverse **architecture / design decision** — crosses a module boundary, locks an external contract (Sanity schema, `keys.ts`, token names), or contradicts the plan or a `[D#]` | Research / decision  | [`references/research-decision.md`](references/research-decision.md) |
| **Review** a diff / PR / branch across independent quality lenses                                                                                                                         | Parallel review      | [`references/code-review.md`](references/code-review.md)             |
| **Debug** something with an unclear root cause — several plausible theories                                                                                                               | Competing hypotheses | [`references/debugging.md`](references/debugging.md)                 |
| **Build** a feature that spans layers/modules, splittable into slices over distinct files                                                                                                 | Coding feature       | [`references/coding-feature.md`](references/coding-feature.md)       |

If the user's ask doesn't fit a mode, the honest answer may be "this doesn't need a team" — say so
and propose subagents or a single session instead (§0).

---

## 3. Closing the loop (lead's job at the end)

However the mode ends, you (the lead) finish it:

- **Research / review / debugging** → **synthesize** into one cited artifact. Resolve conflicts
  explicitly (§1). For an architecture decision, record the resolved calls as a **new `[D#]`** in
  [`docs/decisions.md`](../../../docs/decisions.md) (records are mutable — edit in place; git holds the
  history `[D33]`; supersede only when inline contrast helps). Persist the trail to the repo as a dated **`docs/sessions/YYYY-MM-DD-<slug>`** record — one
  `.md` file, or a folder for a multi-file trail (convention + example in
  [`docs/sessions/README.md`](../../../docs/sessions/README.md)) — so the next session has external
  memory, not a lost context window.
- **Coding** → each teammate hands off a **complete, gate-green slice** over its own files. Before a
  slice enters the PR, run **one fresh, adversarial QA per coding agent** (`[D26]`) — a fresh
  reviewer, never the author, that **tries to break** the slice and writes the missing test cases
  (edge / error / boundary / malformed input, both schemes); the owning agent fixes, QA re-checks
  (the dev↔QA loop — same shape solo, just one author→one QA). Then **you curate history** (rebase
  onto `main`, squash fix-ups, reorder, drop false starts) and **squash-merge** with a deliberate PR
  body. Never commit to `main`. Full mechanics:
  [`docs/handbook/working-with-agents.md`](../../../docs/handbook/working-with-agents.md) §6.2 (QA loop)
  and [`docs/handbook/git-and-pr-workflow.md`](../../../docs/handbook/git-and-pr-workflow.md) §6 (curate/merge).
- **Shut down** teammates by name when done; the team's directories clean up automatically when the
  session ends.
