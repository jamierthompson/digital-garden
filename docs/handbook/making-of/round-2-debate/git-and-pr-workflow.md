# Devil's-Advocate Review — Git & PR Workflow

Target: [`../round-1-drafts/git-and-pr-workflow.md`](../round-1-drafts/git-and-pr-workflow.md)
Reviewer stance: adversarial, line-level. Verified against the installed stack
(`ci.yml`, `package.json`, `studio/sanity.cli.ts`, `eslint.config.mjs`,
`docs/decisions.md`, the live git log, and `node_modules/next/dist/docs/`).

**Verdict up front:** This is a strong, ship-ready draft. The CI-step→local-command
table is exactly right and exactly what a cold agent needs; it matches `ci.yml` step
order 1:1. Most findings below are tightening, two are genuine accuracy nits, and a few
are right-sizing trims. Nothing here is a structural rewrite.

---

## Conceding what's good (don't touch these)

- **The CI gate table (§5)** maps each of the 8 `verify` steps to its local equivalent
  and a `[D#]`. I diffed it against `ci.yml` — order is correct (lint → lint:css →
  lint:keys → format:check → typecheck → test → typegen+diff → build). Keep verbatim.
- **The `feature/` vs `feat:` asymmetry callout (lines 52–54)** is a real, repo-specific
  footgun and the single most useful paragraph in the doc for an agent landing cold.
- **The Studio TypeGen gate (§3, lines 133–144)** correctly identifies the easiest gate
  to forget and gives the exact two commands. Anchored to [D23]. Accurate.
- **"Make CI's job redundant" single-command chain (line 117)** is correctly ordered and
  copy-pasteable. Good.
- The `--frozen-lockfile` / stale-lock checklist item (lines 128–129) is correct — CI
  does run `pnpm install --frozen-lockfile`.

---

## 1. ACCURACY

### A1 — `git add sanity.types.ts` is in the wrong directory; will silently no-op for an agent. [must fix]

Lines 138–142 and the quick-ref (line 242) tell the agent to run:

```bash
pnpm --filter studio typegen
git add sanity.types.ts
```

But `studio/sanity.cli.ts` writes the file to **`../sanity.types.ts`** (repo root), and
the `git diff --exit-code sanity.types.ts` in CI runs from the **repo root**. If an agent
is `cd`'d into `studio/` when it runs `git add sanity.types.ts` (the natural place to be
right after `pnpm --filter studio typegen`), the path resolves to `studio/sanity.types.ts`,
which doesn't exist, and the `add` no-ops. The committed root file stays stale and CI fails
on a gate the doc just told them they handled.

**Fix:** make the path unambiguous and root-anchored, and note where the file lands:

```bash
pnpm --filter studio typegen        # writes ./sanity.types.ts at the repo ROOT
git add ./sanity.types.ts           # from repo root; the file is NOT in studio/
```

A one-line note — "`typegen` emits to the repo root (`generates: '../sanity.types.ts'`
in `studio/sanity.cli.ts`), not into `studio/`" — kills this whole class of confusion.

### A2 — "Sync with `main` before you open the PR" undersells the CI requirement. [minor]

Line 37 says sync before opening the PR; line 208 recommends "Require branches to be
**up to date** with `main` before merging." These are slightly at odds in timing: the
binding requirement (if branch protection is on) is _up to date at merge_, not _at PR
open_. For a two-day branch the practical advice is "rebase/merge `main` right before you
merge, not just when you open." Recommend aligning the wording so an agent doesn't think a
pre-open sync discharges the at-merge freshness requirement.

### A3 — Vercel "Instant Rollback" claim is accurate — keep it, but it's a near-duplicate. [see §2/RightSized]

Verified against Vercel docs: instant rollback is real terminology (the
`deployment.rollback` webhook re-aliases the previous production deployment without a
rebuild). The draft's line 224–225 description is **factually correct**. The only question
is whether it belongs here vs `security-and-ops.md` — see R-1 below. No accuracy change
needed.

### A4 — No stale Next-16 memory detected. [pass]

The draft wisely says almost nothing about framework internals — it stays in git/CI
territory. The one framework-adjacent claim, "Next 16 / Turbopack production build" (line
192), is correct (`next build` is Turbopack-default in 16.2.9). It does **not** repeat any
removed-API hazards (`export const dynamic`, `middleware.ts`), so there's nothing to flag.
Good discipline — this is the right altitude for this doc.

### A5 — External-standard citations check out. [pass]

Conventional Commits 1.0.0 URL (line 67) and the trunk-based "short-lived branches" source
(line 35) are both correctly attributed. The "spec allows `build`/`ci`/`perf`" note (line 80) is accurate to the Conventional Commits spec's recommended-types list.

---

## 2. RIGHT-SIZED vs OVER-ENGINEERED

### R1 — The "< 300 changed lines" / "review quality drops past ~400" rule is borrowed enterprise metrics. [trim]

Line 162. For a **solo, agent-driven** repo there is no second reviewer whose attention
degrades at 400 lines — the "reviewer" is the author and CI. The cited threshold comes
from large-team code-review research (SmartBear/Cisco study) that doesn't transfer to a
one-person garden. Keep the _spirit_ ("one PR = one purpose, keep diffs scoped") which you
already state on line 160–161, and **cut the hard line-count numbers** — they read as
governance theater an agent will either ignore or cargo-cult. If you keep a number, frame
it as a soft heuristic, not a quoted finding.

### R2 — Branch-protection sub-section is right-sized, but verify it isn't aspirational policy. [keep, with caveat]

Lines 201–209 are correctly framed as _recommended, not visible in-repo_ — good honesty.
This is the right call for the brief (don't assert a GitHub setting you can't see). One
nudge: since this is a **solo** repo, "Require status check `verify`" and "require linear
history" are settings the owner may deliberately _not_ enable (solo devs often merge their
own green PRs without protection). Add a half-sentence that these are optional hardening,
not a gate the workflow depends on — otherwise an agent may assume merges are blocked when
they aren't, and write instructions premised on a gate that isn't there.

### R3 — "two days max" branch lifetime is a borrowed rule that doesn't bind here. [trim to a nudge]

Lines 35–37. Trunk-based "two days max" is a team-coordination rule to limit _merge
conflict surface across multiple developers_. Solo, there's no one else's `main` to drift
from. The real reason short branches matter **here** is different and worth stating
instead: **merge = production deploy**, so a long branch means a long gap between
prod-shippable states, and the one-task-one-commit/one-slice-one-PR discipline ([D17])
already keeps branches small. Recommend reframing from "two days max (trunk-based rule)"
to "short by construction because [D17] sequences the build into commit-sized steps" —
same outcome, anchored to _our_ source of truth instead of an external team practice.

### R4 — Otherwise lean. [pass]

No Code-of-Conduct, no SLA, no PR-template boilerplate, no approval-count theater. The doc
respects the "right-sized, not maximal" mandate. Good.

---

## 3. CONSISTENCY

### C1 — `--squash` + linear-history recommendation contradicts established repo practice. [needs a ruling]

Lines 207–208, 217, 248 push **squash merges + linear history**. But the live git log shows
**both** existing PRs (#1, #2) landed as **merge commits** (`Merge pull request #2 …`), and
those merges preserved the per-commit story (`feat: enable Cache Components`, `chore: add
CI gate`, etc.) that [D17] and your own §2 (lines 68–69) explicitly value: "history reads
as the story of how the build happened … [D17] sequences the build into commit-sized
steps."

This is a real internal tension the author flagged, and it's the single most important
_decision_ to resolve before this doc is binding:

- **Squash** collapses a phase PR into one commit — you _lose_ the commit-sized D17 story
  on `main` and keep only the PR-sized story. That directly undercuts §2's stated value.
- **Merge commit** (current practice) keeps the D17 commit granularity on `main` and is
  what the repo already does.

The draft can't simultaneously praise commit-sized history ([D17], §2) _and_ mandate
squash, which discards it. **Recommended resolution:** default to **merge commits** (match
existing practice + [D17]'s commit-story rationale), and mention squash only as the tool
for the opposite case — a messy WIP branch whose intermediate commits _aren't_ a clean
story. Whichever the owner picks, §2's "commit-sized story" language and the merge section
must agree. Right now they don't.

(If the owner _does_ choose squash-always, then §2 lines 68–69 and the [D17] citation need
softening, because squash means the story lives in PRs, not in `main`'s log.)

### C2 — Commit-type set vs Conventional Commits spec: internally consistent, flag the studio scope. [pass, minor]

Line 79 restricts to `feat fix docs style refactor test chore` ("the owner's set"). This is
consistent with the global CLAUDE.md instructions. But note the CI workflow itself uses a
`chore(ci):`-style change historically (`chore: add CI gate …`) — the draft's
`chore(ci):` example (line 81) is fine, but double-check the owner wants `ci` as a _scope_
when `ci` is excluded as a _type_. Minor; the scope/type distinction is legitimate, just
call it out so an agent doesn't read `chore(ci):` as license to use `ci:` as a type.

### C3 — Sibling links point at `./` within `process/` — will break when the tree is finalized. [must fix before merge]

The draft links siblings as `./definition-of-done.md`, `./security-and-ops.md`,
`./engineering-standards.md`, `./testing.md`. Confirmed: the round-1 drafts directory
contains `definition-of-done.md`, `security-and-ops.md`, `testing.md` — **but no
`engineering-standards.md`** (the closest is none; there's `working-with-agents.md`,
`orientation.md`, `accessibility-and-performance.md`, `decision-records.md`). So:

- `./engineering-standards.md` (lines 13, referenced as "code conventions") **points at a
  file that does not exist** in the draft set. Either it's planned-but-unwritten, or the
  intended target is a differently-named sibling. Resolve the name before this links rot.
- The brief's house-style example shows siblings at `docs/handbook/<file>.md` (one level
  up from `process/`). If the final tree flattens, every `./sibling.md` here breaks. The
  author already flagged this — it's real and blocking for a clean merge. Do a link pass
  once the tree is frozen.

### C4 — Does not duplicate the architecture docs. [pass]

The doc correctly _points_ to `[D#]`/`§N` rather than restating the system model. The CI
table cites guards by `[D#]` instead of re-explaining the @layer trap or isomorphic engine.
This matches the "handbook is how we work, not what the system is" mandate. Good.

---

## 4. AGENT-USEFULNESS

### U1 — `lint:keys` row needs the "stubbed" caveat surfaced, not buried. [improve]

Line 187 correctly notes `check-key-drift.mjs` is "stubbed now, goes live Phase 2 ([D10])."
Good — but an agent debugging a _green_ `lint:keys` during Phase 0/1 might assume the check
is exercising real keys and trust it. One clause — "passes trivially until Phase 2; a green
here does **not** yet mean keys are validated" — prevents false confidence. Small, high
value for an agent reading the table as ground truth.

### U2 — `git add -p` in the quick-ref assumes interactive staging works. [minor footgun]

Line 239: `git add -p && git commit -m "…"`. `git add -p` is interactive. In a
non-interactive agent/CI shell it will hang or fail. Most of this repo's tooling note says
interactive git flags aren't supported in the agent environment. Recommend the quick-ref
default to `git add -A` (or explicit paths) and mention `git add -p` only as the
_human-at-keyboard_ option for reviewing hunks. An agent copy-pasting the quick-ref
verbatim should get a command that runs unattended.

### U3 — "Don't push to see if CI passes — run the chain first" is great advice; give it teeth. [improve]

Lines 198–199. The instruction is right but an agent benefits from _why it's cheap to
comply_: the local chain (line 117) is the exact same commands, so running it costs one
paste and saves a full CI round-trip + a red check on the PR. Consider linking line 198
back to the line-117 chain explicitly ("the chain in §3 is byte-for-byte what CI runs").

### U4 — Missing: what to do when `typegen` legitimately changes types. [gap]

§3's TypeGen gate tells the agent to regenerate + commit, but not how to _recognize_ the
intended workflow vs an accident. Add one line: "A non-empty `git diff sanity.types.ts`
after a schema change is **expected** — commit it in the _same_ commit as the schema change
so the type delta and its cause travel together." This ties the [D23] gate to the
one-logical-change commit rule and tells the agent the diff isn't a bug.

### U5 — `gh pr create --fill` then "edit title/body" is underspecified. [minor]

Lines 154–156, 246. `--fill` populates title/body from the _branch's commits_. For a
multi-commit phase PR, `--fill` produces a title from the first/last commit that may not be
the PR's true subject (line 163 wants a Conventional-Commit-shaped title). Recommend
`gh pr create --base main --title "feat: …" --body "…"` for multi-commit PRs, and reserve
`--fill` for single-commit branches where it does the right thing. Otherwise an agent gets
a misleading squash subject (compounding the C1 squash question).

---

## Priority-ordered fix list

| #        | Severity         | Finding                                                                                   | Fix                                                                   |
| -------- | ---------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| A1       | **must fix**     | `git add sanity.types.ts` no-ops from `studio/`; file lands at repo root                  | Root-anchor the path + note `generates: '../sanity.types.ts'`         |
| C1       | **needs ruling** | `--squash`/linear-history contradicts existing merge-commit practice + [D17] commit-story | Default to merge commits; squash only for messy WIP; align §2 wording |
| C3       | **must fix**     | `./engineering-standards.md` targets a non-existent sibling; `./` paths fragile           | Resolve the name; link pass once tree is frozen                       |
| R1       | trim             | "< 300 / 400-line" review metric is borrowed team research                                | Cut the numbers; keep "one PR = one purpose"                          |
| R3       | trim             | "two days max" is a multi-dev rule                                                        | Reframe as "short by construction via [D17]"                          |
| U2       | minor            | `git add -p` hangs in non-interactive shells                                              | Default quick-ref to `git add -A`/paths                               |
| U1/U4/U5 | improve          | stubbed `lint:keys` caveat, expected-typegen-diff note, `--fill` on multi-commit PRs      | One clause each                                                       |
| A2/R2    | minor            | up-to-date timing + solo branch-protection framing                                        | Align "sync before merge"; note protection is optional hardening      |

Everything not listed (CI table, asymmetry callout, TypeGen commands, secrets checklist,
no-stale-framework-memory) is correct and should ship as-is.
