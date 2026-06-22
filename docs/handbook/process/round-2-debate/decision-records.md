# Round-2 Debate — `decision-records.md`

Devil's-advocate review of `process/round-1-drafts/decision-records.md`. Verified
against the installed stack (`package.json`, `node_modules/next/dist/docs/`), the
23 decisions in `docs/decisions.md`, `.github/workflows/ci.yml`, and the seven
sibling drafts in `round-1-drafts/`.

**Verdict:** Strong draft. It nails the hardest call — strictly _process, not
record_ — and never restates a `D#`. Two issues are **blocking** (a wrong link
depth that breaks every architecture link, and a CI-fit section that contradicts
its own siblings and the real CI). The rest are tightening. Concrete fixes below.

---

## Concede first — what's good

- **Right altitude.** The page tells an agent _when_ to open, _how much_ debate to
  run, _how_ to format, and _how_ to supersede — and points to `decisions.md` /
  `audit/` for the content. No duplication of the architecture docs. This is exactly
  the "how we work, not what the system is" split the brief asked for.
- **The supersede rule is the keeper.** "Never edit, always supersede" + making
  `Superseded by D#` a fixed greppable token is genuinely useful and correctly
  grounded in the [D11]/[D23] precedent (both supersede a §7 reading today, but only
  in prose). Formalizing the token is a real improvement, not ceremony.
- **Two-mode debate is right-sized.** The "one paragraph vs. considered-options"
  table (lines 46–49) actively _prevents_ an agent from manufacturing five-lens
  ceremony for a one-line call. Good anti-over-engineering instinct.
- **Framework accuracy is clean.** The few version-dependent facts it leans on
  (async request APIs, `cacheComponents`, removed `export const dynamic`/`force-static`,
  the `@layer` trap, `proxy.ts`) all check out against the installed Next 16.2.9 docs.
  The draft is careful to attribute them to `[D11]`/`[D12]` rather than asserting them
  first-person — the correct move.

---

## BLOCKING

### B1 — Every architecture/audit link is one directory too shallow (wrong depth)

This is the depth question the author flagged — and the answer is **the draft is
wrong**, not just "to be confirmed." The other drafts already settled it.

The final home is `docs/handbook/process/` (that's where every sibling lives:
`working-with-agents.md`, `definition-of-done.md`, etc.). From there, the path to
`docs/decisions.md` is **`../../decisions.md`** (two levels up), not `../decisions.md`.
`../decisions.md` resolves to `docs/handbook/decisions.md` — a file that does not exist.

Ground truth — sibling `working-with-agents.md` (same dir, same final home) writes:

```
[`../../decisions.md`](../../decisions.md) (`[D#]`)
[`../../architecture-plan.md`](../../architecture-plan.md) (`§N`)
```

Every sibling uses `../../` for `decisions.md`, `architecture-plan.md`,
`build-phases.md`, `audit/`, and `AGENTS.md`. The draft under review uses a
**mixed, internally inconsistent** scheme:

| Draft (line)   | Draft writes                                              | Siblings write    | Correct for `docs/handbook/process/`                                                             |
| -------------- | --------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| 4, 28, 58, 183 | `../decisions.md`, `../architecture-plan.md`, `../audit/` | `../../…`         | **`../../…`**                                                                                    |
| 56             | `../../AGENTS.md`                                         | `../../AGENTS.md` | `../../../AGENTS.md` (AGENTS.md is at repo root, so from `docs/handbook/process/` it's three up) |

Note the self-inconsistency: the draft uses `../` for decisions but `../../` for
AGENTS — they can't both be right from one location. The brief's house style
(`./sibling`, `../architecture`) was written assuming a `docs/handbook/` home; the
actual structure adds a `process/` level, so architecture docs are `../../` and the
repo-root `AGENTS.md` is `../../../`.

**Fix:** rewrite all non-sibling links to match the siblings exactly —
`../../decisions.md`, `../../architecture-plan.md`, `../../audit/...`,
`../../.github/workflows/ci.yml`, and `../../../AGENTS.md`. Sibling links
(`./definition-of-done.md`, `./git-and-pr-workflow.md`, `./working-with-agents.md`)
are already correct. Sanity-check with a relative-link linter or
`git grep -o '](\.\.[^)]*)'` after the move.

### B2 — The "CI fit" section contradicts the real CI chain and its own siblings

Lines 128–129 list the CI chain as:

> `lint`, `lint:css`, `lint:keys`, `typecheck`, `test`, `format:check`, `build`

Two problems, both verifiable:

1. **Wrong order, and it disagrees with the canonical list.** The real
   `.github/workflows/ci.yml` runs: `lint → lint:css → lint:keys → format:check →
typecheck → test → (typegen + git diff) → build`. Both `definition-of-done.md`
   and `git-and-pr-workflow.md` reproduce that order verbatim. The draft floats
   `format:check` to the end, after `typecheck`/`test` — a third, conflicting
   ordering for the same chain across three handbook pages.
2. **It drops the TypeGen drift gate entirely.** CI has two steps the draft omits:
   `pnpm --filter studio typegen` and `git diff --exit-code sanity.types.ts` ([D23]).
   This matters _here specifically_: the whole point of this page is decisions that
   "lock an external contract … a Sanity schema field" (line 27). A schema-touching
   decision is the most likely thing to trip the very gate the draft forgot to list.

**Fix:** don't re-enumerate the chain at all — that's exactly the duplication the
brief warns against, and it's already drifted three ways. Replace lines 128–133 with
a pointer: _"Decision records are prose; no CI gate polices `decisions.md`. The only
discipline is `pnpm format` before commit — see [Definition of Done](./definition-of-done.md)
for the full gate chain."_ One sentence, zero drift risk. If you keep any list, copy
it from `definition-of-done.md` exactly, including the TypeGen step.

---

## RIGHT-SIZED vs OVER-ENGINEERED

### O1 — Two near-identical templates is one too many

The "entry format" block (lines 75–82), the "copy-paste template" (lines 150–159),
and the "superseding template" (lines 163–177) are three renderings of the same
shape. For a solo, agent-driven repo an agent will copy the _last_ code block it
sees. Three of them invites them diverging over time (B2 is what divergence looks
like). **Fix:** keep the one copy-paste template + the supersede variant (the
genuinely different case); demote the lines 75–82 block to a one-line "see the
copy-paste template below" and let the required-fields table carry the rules. Net:
fewer words, one source of truth for the shape.

### O2 — The Nygard/Fowler epigraph is slightly long for the payoff

Lines 7–13 are accurate (Nygard's 2011 post and Fowler's bliki entry are the real
lightweight-ADR sources, and "not full MADR" is the right call). But three sentences
of provenance is a lot up top. **Fix (optional):** compress to one sentence + the two
links. The agent needs "this is lightweight Nygard-style ADR, not MADR ceremony" —
it doesn't need the publication history before it learns _when to open a record_.

### O3 — Mild redundancy between "Pitfalls" and the body

Every Pitfalls bullet (lines 139–144) restates a rule already made above (supersede,
don't over-template, don't record trivia, keep anchors, cite docs, closed vocab).
For a skimmable agent doc a short recap is defensible, but it's pure repetition.
**Fix:** either cut it, or make it a true _quick-reference_ checklist with no prose —
not a second pass over the same sentences.

---

## CONSISTENCY

### C1 — "public token names (`--brand-*`, `--space-*`)" mixes a public and an internal example

Line 27 lists `--brand-*` and `--space-*` as "public token names" whose locking is
decision-worthy. Per [D2], the **public** contract is the generic layer (`--brand-*`,
`--font-face`, `--space-*`) — so `--brand-*`/`--space-*` are correctly public. Good.
But double-check you don't anywhere imply `--logx-*` is public: [D2] is explicit that
`--logx-*` is a **project-internal alias**, not a contract. The current line is fine;
just don't let a later edit add `--logx-*` to that "public names" list. (Flagging
because it's the easy mistake.) No change required unless you expand the example.

### C2 — "the engine signature" as a lockable contract — confirm it matches [D5]

Line 27 calls "the engine signature" a contract worth recording. [D5] fixes it as
`(brandColor, scheme) → tokenSet`. That's consistent — but the draft says "the engine
signature" generically. **Fix (minor):** either drop the example or pin it to [D5]'s
actual signature so an agent doesn't invent a different one. Anchoring beats vagueness
here.

### C3 — No contradiction with the decisions log — confirmed

I checked the draft against all 23 entries. The supersede precedents it cites
([D11] supersedes a §7 `use cache` reading; [D23] supersedes "one app, no workspace")
are accurate. The status-vocabulary examples ([D8] "build deferred"; [D11]/[D12]/[D23]
"verified against …") all match the live log. The `Open` → "track in the Open items
summary footer" instruction matches `decisions.md`'s actual footer (line 27). No
consistency defects in the _content_ — only the link plumbing (B1) and CI claim (B2).

---

## AGENT-USEFULNESS

### A1 — The status vocabulary is presented as "closed" but `decisions.md`'s own legend is narrower — say so

The draft's closed set (lines 97–103) has five statuses. `decisions.md`'s header
legend (lines 4–6) only defines **two**: `Decided` and `Open`. The other three
(`Decided (build deferred)`, `Decided (verified against …)`, `Superseded by D#`) are
_de facto_ patterns the draft is **promoting to first-class status** — which is a fine
and useful call, but an agent reading `decisions.md` will see a two-item legend and be
confused. **Fix:** add one line: _"This extends `decisions.md`'s two-item legend
(`Decided`/`Open`) by formalizing the parenthetical and supersession patterns the log
already uses informally."_ Makes the page's authority explicit instead of leaving an
agent to reconcile two different vocabularies.

### A2 — "Next monotonic `D#`" is correct but give the agent the command

Line 88 says use "the next monotonic `D#`, never reused." Good rule, but an agent
landing cold has to _find_ the current max. **Fix:** add the one-liner —
``the next number after the highest `D#` in `decisions.md` (today: `D24`; check with
`grep -oE '^### D[0-9]+' ../../decisions.md | tail -1`)``. Turns a rule into an action.
This is the single highest-value add for "would an agent actually follow it."

### A3 — "the worked example is `../audit/`" — tell the agent the cheap path, not just the full one

Lines 58–65 correctly point at the five-lens audit as the full-ceremony shape and say
"you rarely need all five lenses." Good. But an agent may still over-apply it. **Fix
(minor):** lead with the cheap path — _"For a single later decision, the two-mode
table above is the whole process; `../../audit/` is the reference for an
architecture-class **batch**, not a per-decision requirement."_ Reinforces O-style
right-sizing at the point of temptation.

---

## Summary table

| ID  | Severity | Issue                                                                                       | Fix                                                                                                           |
| --- | -------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| B1  | Blocking | Architecture/audit links one level too shallow; internally inconsistent (`../` vs `../../`) | Use `../../decisions.md`, `../../architecture-plan.md`, `../../audit/`, `../../../AGENTS.md` — match siblings |
| B2  | Blocking | CI chain mis-ordered and omits TypeGen drift gate ([D23])                                   | Drop the enumeration; point to `definition-of-done.md`                                                        |
| O1  | Medium   | Three overlapping templates                                                                 | Keep copy-paste + supersede variant; demote the third                                                         |
| O2  | Low      | Long ADR-provenance epigraph                                                                | Compress to one sentence + two links                                                                          |
| O3  | Low      | Pitfalls repeats the body                                                                   | Cut or make it a pure checklist                                                                               |
| C1  | Low      | "public token names" example — keep `--logx-*` out of it                                    | No change now; guard future edits ([D2])                                                                      |
| C2  | Low      | "engine signature" vague                                                                    | Pin to [D5] `(brandColor, scheme) → tokenSet` or drop                                                         |
| A1  | Medium   | "Closed" vocab is wider than `decisions.md`'s 2-item legend                                 | Add a line stating this page _extends_ the legend                                                             |
| A2  | Medium   | "Next monotonic `D#`" has no how-to                                                         | Add the `grep … tail -1` one-liner                                                                            |
| A3  | Low      | Audit example may be over-applied                                                           | Lead with the cheap two-mode path                                                                             |
