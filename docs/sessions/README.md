# Session records — project work

A durable, append-only log of every **session that did real project work** in this repo: **why** it
ran, how it was structured, and the **outcome**. One file per session (or a folder for a multi-file
trail), named `YYYY-MM-DD-<slug>`. The dated directory listing _is_ the index — these notes are
frozen history, left as written unless a later correction warrants a dated callout at the top of the
file. Ongoing work is tracked in [GitHub issues + milestones](https://github.com/jamierthompson/digital-garden/milestones).

> **Convention — all new session documentation goes here.** Session notes, spikes, decision
> debates/trails, empirical findings, and handoffs live under `docs/sessions/`, named
> `YYYY-MM-DD-<slug>.md` (or a `YYYY-MM-DD-<slug>/` **folder** for a multi-file trail — e.g.
> [`2026-06-26-shell-sourcing-islands/`](./2026-06-26-shell-sourcing-islands/)).

**A session is one team's (or the solo lead's) sitting at the work.** A record is written at the
**end of every session**, whether it _completed_ a unit of work or stopped at a clean handoff point.
A unit of work often spans several sessions; each gets its own record. The record is the repo's
external memory and the handoff to whoever picks the work up next.

## What each record should answer

- **Why** — the trigger and the goal.
- **Shape** — team vs subagents vs solo; the slice → owner → files map; how isolation was handled.
- **Outcome** — what shipped (PRs/commits), what passed the gate, what was deferred (and the GitHub
  issue/milestone it moved to).
- **QA log** — the durable evidence of the adversarial dev↔QA loop `[D26]` (see below).
- **Lessons** — anything worth carrying into the next session.

## The QA log `[D26]`

Gate-green is _developer-done_, not _review-done_ — so the green gate is **not** the QA evidence; the
QA log is. Each record carries one **entry per coding agent** (solo → one, team → one per slice),
recorded as that slice's loop closes. The dev↔QA loop itself is owned by
[`../handbook/working-with-agents.md`](../handbook/working-with-agents.md) §6.2 — this is just the
record format:

```markdown
## QA log [D26]

| Slice     | QA agent (fresh) | Verdict   | Tests added            |
| --------- | ---------------- | --------- | ---------------------- |
| <slice-a> | QA-A             | 2 defects | `src/.../foo.test.tsx` |
| <slice-b> | QA-B             | clean     | `src/.../bar.test.ts`  |

**<slice-a> defects** — 1) <what broke> → <fix by author> → re-checked <result>.
**Deferred:** <finding> → GitHub issue #NN, or "none".
```

A slice QA found **clean** still gets a row — a whole session with zero findings is itself a signal.
