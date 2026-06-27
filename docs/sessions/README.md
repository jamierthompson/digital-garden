# Session records — project work

A durable, append-only log of every **session that did real project work** in this repo: **why** it
ran, how it was structured, and the **outcome**. One file per session, named `YYYY-MM-DD-<slug>.md`.

> **Convention — ALL new session documentation goes here.** Session notes, spikes, decision
> debates/trails, empirical findings, and handoffs all live under `docs/sessions/`, named
> `YYYY-MM-DD-<slug>.md` (or a `YYYY-MM-DD-<slug>/` **folder** for a multi-file trail — e.g.
> [`2026-06-26-shell-sourcing-islands/`](./2026-06-26-shell-sourcing-islands/)). Do **not** put
> session work in `docs/handbook/making-of/` — that directory is the \*making-of the **handbook\***
> (how the handbook itself was written/evaluated), not a home for product-session notes.

**A session is one team's (or the solo lead's) sitting at the work.** A session record is written at
the **end of every session**, whether that session _completed_ a unit of work (e.g. a whole phase) or
stopped at a good handoff point (between tasks, so QA can run and a PR can open). A unit of work often
spans **several** sessions; each session has its own record. The record is the repo's external memory
and the **handoff to the next team** that picks up the incomplete work — so it can see what was
attempted and how it landed without re-reading a lost context window.

> **This is not the same as the skill-evaluation runs.** The artifacts under
> [`../archive/handbook-making-of/agent-team-skill/eval-runs/`](../archive/handbook-making-of/agent-team-skill/eval-runs/)
> are **verbatim agent outputs captured to build and grade the `agent-team` skill itself** — i.e. they
> were tooling/eval work, not product work. This directory is for sessions that build the
> **digital garden** (features, content model, theming engine, …). When in doubt: _did the session
> change `src/`, `studio/`, or the product? → it belongs here._

## What each record should answer

- **Why** — the trigger and the goal (what problem / phase / decision prompted the session).
- **Shape** — team vs subagents vs solo; the slice → owner → files map; how isolation was handled.
- **Outcome** — what shipped (PRs/commits), what passed the gate, what was deferred and why.
- **QA log** — the durable evidence of the adversarial dev↔QA loop: what was tested, what passed,
  what broke, and the fix. One entry **per coding agent** (see below — this is non-negotiable `[D26]`).
- **Lessons** — anything worth carrying into the next session.

## The QA log — what adversarial QA tested and found `[D26]`

Gate-green is _developer-done_, not _review-done_, so the green gate is **not** the QA evidence — the
QA log is. Every session record carries one, capturing the dev↔QA loop
([`../handbook/working-with-agents.md`](../handbook/working-with-agents.md) §6.2): **one entry per
coding agent** — a solo session has one (the lead's own work, QA'd by a fresh agent), a team session has one
per slice. The lead records each entry **as that slice's loop closes**, not reconstructed at the end
(external memory beats a lost context window). Each entry answers:

- **Slice · author · QA agent** — who built it; which **fresh** agent QA'd it (never the author).
- **What QA probed** — the adversarial surface it _attacked_, not "skimmed the diff": the edge /
  error / boundary / malformed-input cases, both color schemes, the focus/interaction floor on any
  rendered surface. Name the cases tried so the next agent sees the coverage.
- **Verdict** — `clean`, or **N defects** (with severity). A slice QA found clean **still gets a
  row** — "clean" is a recorded result, and a whole session with zero findings is itself a signal.
- **Each defect** — what broke → the fix (made by the **owning author**) → the re-check result.
  These cluster in the gate's blind spots: undefined CSS vars, async-RSC / jsdom gaps, contrast,
  error/not-found paths — the classes `pnpm test` is structurally blind to.
- **Tests added** — the co-located cases QA **authored** to lock each break (`[D26]` requires QA
  write them), by path. This is how a one-time break becomes a permanent regression guard.
- **Deferred** — anything filed as a [GitHub issue](https://github.com/jamierthompson/digital-garden/issues) with its PR# + reason.

A compact table up top + a short per-defect note below reads best — see
[`2026-06-24-phase-1-projectscope.md`](./2026-06-24-phase-1-projectscope.md) (§"QA log") for the
live shape. Skeleton:

```markdown
## QA log [D26]

| Slice     | QA agent (fresh) | Verdict   | Tests added                |
| --------- | ---------------- | --------- | -------------------------- |
| <slice-a> | QA-A             | 2 defects | `src/.../foo.test.tsx` ... |
| <slice-b> | QA-B             | clean     | `src/.../bar.test.ts`      |

**<slice-a> defects** — 1) <what broke> → <fix by author> → re-checked <result>. 2) …
**Deferred:** <finding> → build-phases.md "<phase>" (PR #NN, <reason>), or "none".
```

> **Backfill note.** Records dated **before 2026-06-25** predate [D26]; their QA logs were
> **backfilled** from the QA actually performed at the time, in this format — and **honestly
> labeled** where the pass wasn't a fresh adversarial agent (e.g. a `@claude` bot review round or a
> solo self-test). The format is retroactive; the history is not rewritten.

## Index

| Date       | Session                                                                                                      | Outcome                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| 2026-06-23 | [Phase 0.5 walking skeleton + parallel Phase 1/2](./2026-06-23-phase-0.5-walking-skeleton.md)                | 4 feature PRs (#8–#11) + review fixes         |
| 2026-06-24 | [Phase 1 keystone (real ProjectScope) + fast-follows](./2026-06-24-phase-1-projectscope.md)                  | 3 PRs (#14–#16); Phase 1 complete             |
| 2026-06-24 | [Phase 2 close-out: engine-backed brandColor validation](./2026-06-24-phase-2-engine-backed-validation.md)   | PR #18; `@garden/oklch` pkg; Phase 2 complete |
| 2026-06-24 | [Gate-doc sync guard (`pnpm lint:docs`)](./2026-06-24-doc-gate-sync-guard.md)                                | PR #19; builds the missing doc-sync guard     |
| 2026-06-24 | [Phase 3: first vertical slice end-to-end](./2026-06-24-phase-3-first-vertical-slice.md)                     | PR #20; first real project end-to-end         |
| 2026-06-24 | [Phase 3 carried items (draft rendering + notes/tags)](./2026-06-24-phase-3-carried-items.md)                | PR #21; Phase 3 still open (1 known defect)   |
| 2026-06-25 | [Phase 3: @layer fix + Preview entry point + CI schema deploy](./2026-06-25-phase-3-layer-preview-deploy.md) | PRs #23–#25; Phase 3 still open (Item C)      |
| 2026-06-26 | [Shell-identity sourcing → Path A (editorial island)](./2026-06-26-shell-sourcing-islands/)                  | Debate + spike; [D30]; no code change         |
| 2026-06-26 | [Sanity Live preview + publish→prod revalidation](./2026-06-26-sanity-live-preview.md)                       | PR #31; [D31]; #2/#3 done, Item C owner-gated |
| 2026-06-27 | [Phase 3 close-out: owner-gated wiring + live Item C sign-off](./2026-06-27-phase-3-closeout.md)             | PRs #34–#35; **Phase 3 COMPLETE**             |

_The 2026-06-23 session also produced two co-located **deliverable** docs (evidence, not standalone
sessions): [phase-0.5 render proofs](./2026-06-23-phase-0.5-render-proofs.md) and the
[log-explorer fit-spike](./2026-06-23-log-explorer-fit-spike.md)._
