# Orchestration Plan — Review PR #5 (security · tests · conventions)

**Role:** team lead. **Deliverable:** a plan, not a run.
**Repo:** `/Users/jamiethompson/dev/digital-garden` (Next.js 16.2.9 / React 19.2.4, Sanity, Vercel).

---

## 0. Preflight — is a team the right tool, and can it even run?

### 0a. BLOCKER: PR #5 does not exist yet

I checked before planning anything:

```
$ gh pr view 5 --json ...
GraphQL: Could not resolve to a PullRequest with the number of 5.

$ gh pr list --state all
4  docs: adopt agent-team git workflow …        MERGED
3  docs: operating handbook …                    MERGED
2  Phase 0 — Scaffolding + guardrails            MERGED
1  docs: project plans + architecture audit      MERGED
```

The highest PR in this repo is **#4, and all four are merged**. There is no open `#5` and no
local/remote branch other than `main` and the merged `claude/agent-team-git-workflow-pd20yv`.
**A review team has no target.** Spinning up agents now would burn ~3× tokens reviewing nothing,
or worse, hallucinate findings against an empty diff.

**Gate-zero action before any spawn:** confirm the real target with the user — one of:
(a) PR #5 isn't pushed yet → push it, then proceed; (b) they meant a different number (#1–#4, all
merged — a post-merge audit is still valid but changes "before I merge" framing); (c) they meant an
unpushed local branch / working tree → point me at it. I will **not** spawn the team until
`gh pr view <N>` resolves and `gh pr diff <N>` returns a non-empty diff. Everything below is written
to fire the moment that target is confirmed; treat `<N>` as the placeholder for the real number.

### 0b. Is an agent _team_ the right tool? (vs. single session / subagents / a skill)

| Option                                           | Fit                                                                                                                                                                                                                                                                                                                                                                                    | Verdict                                     |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Single session, one pass**                     | User explicitly rejected this — _"not a single once-over."_ One context also blurs the three lenses together and over-indexes on "does it work" (the documented agent blind spot — working-with-agents.md §2, arXiv 2511.12884).                                                                                                                                                       | ✗ ruled out by the ask                      |
| **`/code-review` skill**                         | Reviews the **working-tree diff** for correctness bugs + cleanups at an effort level. Single-lens, your-own-diff, no security/coverage/convention split. Good as a _teammate's internal tool_, not as the whole job.                                                                                                                                                                   | ✗ too narrow alone                          |
| **`pr-review-toolkit:review-pr` skill**          | This is the closest substitute — it already orchestrates the specialized review agents. Honest call: it covers ~80% of this. The team buys three things over it: (1) lenses pinned **explicitly** to the user's three named concerns, (2) each lens grounded in _this repo's_ `[D#]`s and handbook paths rather than generic best-practice, (3) lead synthesis tuned to the repo gate. | △ viable; team is the tailored version      |
| **Stateless subagent fan-out (`Agent` tool ×3)** | Mechanically sufficient — three read-only reviewers in parallel returning digests is exactly fan-out. A _team_ adds named, **persistent** teammates I can re-message to defend/concede a contested finding (working-with-agents.md §4 adversarial step) and a lead that curates.                                                                                                       | △ lighter equivalent if no iteration needed |
| **Agent team (recommended)**                     | Three distinct, non-overlapping, **read-only** lenses over one shared diff, run concurrently, each owning its concern, lead synthesizes + (if needed) re-queries. Matches the user's framing and the feature is available here.                                                                                                                                                        | ✓ **chosen**                                |

### 0c. What must be true for the team to run at all

- [ ] **Target resolves** — `gh pr view <N>` succeeds and `gh pr diff <N>` is non-empty (0a).
- [ ] **Read-only reviewers → no file conflicts.** Reviewers never write repo files, so the
      handbook's "own a distinct set of files / avoid conflicts" rule (working-with-agents.md §6.1,
      [Agent Teams](https://code.claude.com/docs/en/agent-teams)) is satisfied by lens, not by path.
      No worktree isolation needed.
- [ ] **Gate is runnable** for the test/convention lenses to _execute_, not just read:
      `pnpm lint && pnpm lint:css && pnpm lint:keys && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`
      (AGENTS.md "the gate"; CI job `verify`). If deps aren't installed, `pnpm install` first.
- [ ] **Diff is fetched once and shared** — lead runs `gh pr diff <N>` and the checked-out branch,
      so all three lenses review the _same_ bytes.

### 0d. Why NOT the heavy five-lens debate

working-with-agents.md §4 reserves research→drafts→**debate**→synthesis (~15× cost) for an
**architecture-class decision** — hard to reverse, crosses a module boundary, locks an external
contract. A PR review is **convergent, not generative**: independent lenses → dedupe → severity.
So the pattern here is **parallel independent review, then lead synthesis** — _not_ adversarial
debate. (I keep the adversarial step in reserve for one case only: if two lenses disagree on whether
a specific finding is real, I re-message those teammates to defend or concede with a cited fact.)

---

## 1. Approach / pattern

**Parallel independent lenses → lead synthesis** (3 concurrent teammates + lead).

1. **Lead setup (me):** confirm `<N>`, check out the PR branch, capture `gh pr diff <N>` and the
   changed-file list, run the gate once to get ground-truth pass/fail, hand all three the _same_
   diff + file list.
2. **Three teammates review independently**, in parallel, each blind to the others (diversity is
   the point — §4). Each owns one lens, touches no files, returns a **dense, cited digest** in a
   fixed format (§5 brief checklist).
3. **Lead synthesis:** dedupe overlaps, assign severity, resolve any lens-vs-lens conflict
   explicitly (no fake consensus — Ewerlöf), produce one merge-readiness verdict.

3 concurrent is the everyday sweet spot (working-with-agents.md §5).

---

## 2. Division of work — the three lenses (mapped to the user's three asks)

| Lens                                    | Owns                                                                                                              | Primary agent type                                                           | Model tier                                   |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------- |
| **L1 Security & robustness**            | secrets/env exposure, Sanity token handling, error-suppression/silent failures, the `brandColor` 500-risk defense | `pr-review-toolkit:silent-failure-hunter` (+ `/security-review` as its tool) | **Strong (Opus-class)** — security reasoning |
| **L2 Test coverage**                    | new logic covered? edge cases? co-location? dual-env engine? browser-verify?                                      | `pr-review-toolkit:pr-test-analyzer`                                         | **Mid (Sonnet-class)** — mechanical-ish      |
| **L3 Repo conventions & framework-fit** | `[D#]` adherence, the gate, Next-16/React-19 correctness, Conventional Commits, AGENTS guardrails                 | `pr-review-toolkit:code-reviewer`                                            | **Strong (Opus-class)** — broad judgment     |

Lenses are **non-overlapping by concern**; if a finding straddles two (e.g. a swallowed Sanity
error that's also untested), it surfaces in both and the lead dedupes. The exact agent roster is
tuned to the diff _after_ I see it — e.g. if the PR adds a new TypeScript type, I add a 4th
`type-design-analyzer` pass; if it's docs-only, L2 shrinks.

---

## 3. Verbatim spawn briefs

> Shared preamble injected into all three (subagents start with **zero** context — working-with-agents.md §5):
> _"You are a review teammate. You start with no context: read every path named below before judging.
> Repo is Next.js 16.2.9 / React 19.2.4 — your training data is wrong here often enough to be dangerous,
> so **verify framework claims against `node_modules/next/dist/docs/`, never memory** (AGENTS.md "the one
> rule"). Cite every non-obvious finding to a source that actually contains the fact: a bundled-doc path,
> a `[D#]` in `docs/decisions.md`, a handbook section, or a standard's URL. You are READ-ONLY: do not edit,
> stage, or commit anything. The review target is PR #<N>; its diff is `gh pr diff <N>` and the branch is
> checked out. Return ONLY the dense digest in the Output Format — not raw tool output."_

### Teammate A — Security & robustness (L1)

```
OBJECTIVE: Find security and silent-failure defects in PR #<N>. One concern only — do not grade tests or style.

REVIEW TARGET: `gh pr diff <N>` (changed files only) on the checked-out PR branch. Use `gh pr view <N>` for intent.

SOURCE OF TRUTH — open these before judging:
- docs/handbook/security-and-ops.md — §1 Secrets & env policy (the one rule + public-vs-secret),
  §2 Dependency hygiene, §3 Sanity token handling, §4 Vercel deploy runbook.
- docs/decisions.md — [D9] brandColor three-layer defense (500-risk), [D14] OKLCH engine stays
  isomorphic (never add server-only/client-only to src/lib/oklch/), [D16] Sanity visual-editing.
- AGENTS.md "Non-negotiable guardrails" — secrets→environment only; never commit .env*.
- working-with-agents.md §2 — security/perf are the documented agent blind spot; hold the line.

WHAT TO HUNT:
1. Any secret/token/key hardcoded or echoed into client bundles, logs, or committed .env*.
   Confirm .env* is gitignored and .env.example stays a placeholder-only contract.
2. Sanity token handling per §3 — server-only read paths, no token leakage to the client.
3. Silent failures: swallowed catches, empty error branches, fallbacks that mask real errors
   (this is your specialty as silent-failure-hunter) — especially around brandColor parsing /
   the [D9] 500-risk defense and any data fetch.
4. Dependency hygiene (§2) — new/changed deps: provenance, lockfile committed, no risky transitive adds.
You MAY run `/security-review` as a tool to seed candidates, then verify each by hand against the diff.

BOUNDARIES: read-only; no edits/commits. Do NOT assess test thoroughness (Teammate B) or naming/style
(Teammate C) unless a security defect lives there. Decisions [D9],[D14],[D16] are binding — flag
violations, never re-litigate. If the diff touches no security surface, say so plainly — do not invent findings.

OUTPUT FORMAT (dense digest, nothing else):
- Verdict: BLOCK / WARN / CLEAR for the security lens.
- Findings table: | Severity (Critical/High/Med/Low) | File:line | What | Why it's a defect (cite [D#]/§/doc-path/URL) | Fix |
- "Checked and clean": one line per surface you verified safe (so the lead knows coverage, not silence).

MODEL TIER: Strong (Opus-class) — security reasoning warrants it.
```

### Teammate B — Test coverage (L2)

```
OBJECTIVE: Judge whether PR #<N>'s tests adequately cover its new/changed logic and edge cases. One concern only.

REVIEW TARGET: `gh pr diff <N>` — pair each changed source file with its test changes. Run the suite:
`pnpm test` (and `pnpm typecheck`) to see what actually passes; report failures verbatim.

SOURCE OF TRUTH — open these before judging:
- docs/handbook/testing.md — "What to test vs. skip", "RTL usage rules", "Co-location [D18]",
  "Async Server Components — the jsdom wall", "Dual-env: the OKLCH engine [D14]" (assert behaviour
  not snapshots), "Phase-1 visual contrast harness [D17]", "Browser verification (Chrome DevTools MCP) [D25]".
- docs/decisions.md — [D18] tests co-located with subject, [D14] engine dual-env test,
  [D17] sequence-by-risk contrast harness, [D25] rendered surfaces get an agent browser-check before done.
- docs/handbook/definition-of-done.md — §6 "Tests, browser verification & docs".

WHAT TO ASSESS:
1. Does every new branch/edge in the diff have a test? Name the specific uncovered cases.
2. Co-location per [D18] — tests next to subject, not in a far-off folder.
3. If src/lib/oklch/ changed — is the dual-env ([D14]) test present and asserting behaviour, not snapshots?
4. If a rendered surface changed — is the [D25] browser-verification noted/done, or flagged as owed?
5. Test quality: are they meaningful (would they catch a regression) or assertion-light?

BOUNDARIES: read-only; no edits/commits. Do NOT assess security (Teammate A) or style/conventions
(Teammate C). Don't demand tests for things testing.md says to SKIP — cite the section. If coverage is
genuinely adequate, say so; don't manufacture gaps.

OUTPUT FORMAT (dense digest, nothing else):
- Verdict: BLOCK / WARN / CLEAR for the test lens.
- Coverage gaps table: | Severity | Changed file (the logic) | Missing test/case | Cite (testing.md §/[D#]) |
- Suite result: pass/fail counts; paste any failure.
- "Adequately covered": one line per changed file whose coverage you judged sufficient.

MODEL TIER: Mid (Sonnet-class) — largely mechanical mapping of logic→tests.
```

### Teammate C — Repo conventions & framework-fit (L3)

```
OBJECTIVE: Verify PR #<N> obeys this repo's decisions, gate, and Next-16/React-19 conventions. One concern only.

REVIEW TARGET: `gh pr diff <N>` plus the commit messages (`gh pr view <N> --json commits`). Run the gate:
`pnpm lint && pnpm lint:css && pnpm lint:keys && pnpm format:check && pnpm typecheck && pnpm build`
and, if studio/ schema changed: `pnpm --filter studio typegen && git diff --exit-code sanity.types.ts`.
Report each gate step's real pass/fail.

SOURCE OF TRUTH — open these before judging:
- AGENTS.md — "Non-negotiable guardrails" (the @layer trap, isomorphic engine, literal dynamic imports,
  pnpm only, async request APIs / proxy.ts) and "Pre-flight checks (the gate)".
- docs/decisions.md — especially [D11] export const dynamic removed under cacheComponents / font preload,
  [D12] every CSS Module declares its @layer (lint:css), [D14] isomorphic OKLCH engine,
  [D21] literal dynamic imports only, [D22] breakpoints not :root custom props, [D23] Studio standalone
  workspace + regenerate sanity.types.ts. Cite by [D#].
- docs/handbook/git-and-pr-workflow.md — branch naming (feat/|fix/|chore/), Conventional Commits,
  squash-merge story, never commit to main.
- docs/handbook/engineering-standards.md and definition-of-done.md — code organization, "don't reach up".
- node_modules/next/dist/docs/ — verify ANY framework claim here (request APIs async, no export const
  dynamic, middleware→proxy.ts) before asserting it.

WHAT TO CHECK:
1. Each guardrail above — flag violations with the [D#] + the lint script that enforces it.
2. Gate: does the full chain pass? Any red step is a BLOCK.
3. Framework correctness against the BUNDLED docs (not memory) — async cookies()/headers()/params,
   no removed-API usage, proxy.ts not middleware.ts, literal `() => import("@/projects/<slug>")`.
4. Conventional Commits + branch naming + "never commit to main".

BOUNDARIES: read-only; no edits/commits. Do NOT assess security depth (Teammate A) or test thoroughness
(Teammate B). Decisions are BINDING and immutable — flag contradictions; if you think a decision is wrong,
say a *superseding* record is needed, never propose editing it (decision-records.md). No memory-based
framework claims — cite a doc path.

OUTPUT FORMAT (dense digest, nothing else):
- Verdict: BLOCK / WARN / CLEAR for the conventions lens.
- Gate result: per-step pass/fail (lint, lint:css, lint:keys, format:check, typecheck, test, build, typegen).
- Violations table: | Severity | File:line | Rule broken (cite [D#]/AGENTS guardrail/doc-path) | Fix |
- "Conforms": one line per convention area you verified clean.

MODEL TIER: Strong (Opus-class) — broad judgment across decisions + framework.
```

---

## 4. How the work divides (summary)

- **By lens, not by file** — reviewers are read-only, so there are no file conflicts to partition
  around; the clean split is the _concern_ (security / tests / conventions) the user named.
- **Parallel, blind, concurrent** — three at once (the §5 sweet spot), each unaware of the others so
  diversity holds.
- **Each owns its slice end-to-end** — runs its own gate/suite slice, returns a self-standing verdict,
  is accountable for that lens's coverage (the "Checked and clean" / "Conforms" lines prove coverage,
  not silence).
- **Overlap handled at synthesis, not by widening scope** — a straddling finding appears in two
  digests; the lead dedupes rather than asking reviewers to coordinate (don't add agents to fix
  coordination — §4).

---

## 5. Closing the loop — lead synthesis

1. **Collect** the three digests (each already a dense, cited table — no raw dumps to wade through).
2. **Dedupe & cluster** findings that appear in more than one lens into a single row, keeping every cite.
3. **Severity-rank** across all lenses into one ordered list: **Critical → High → Med → Low**, where any
   red gate step or leaked secret is auto-**BLOCK**.
4. **Resolve conflicts explicitly** — if two lenses disagree on whether a finding is real, I re-message
   those two teammates to defend-or-concede _with a cited fact_ (the one place I invoke the adversarial
   step), and record which view won and why. **No fake consensus** (Ewerlöf) — a genuine disagreement is
   reported as such, not smoothed over.
5. **Single merge verdict** back to the user: **MERGE-READY / MERGE-WITH-FIXES / DO-NOT-MERGE**, with the
   ranked findings, each carrying file:line + cite + suggested fix, and a short "what was verified clean"
   so the user trusts the coverage. The lead does **not** edit the PR — fixes route back to the slice owner
   (working-with-agents.md §6.1); the lead only curates and reports.

---

## TL;DR for the user

PR #5 doesn't exist in this repo (latest is #4, all merged) — **I need the real target before spawning
anyone.** Once confirmed, I'll run a 3-teammate parallel review — Security (Opus), Test-coverage (Sonnet),
Conventions/framework-fit (Opus) — each read-only, each grounded in the exact `[D#]`s and handbook sections
above, then synthesize one severity-ranked, cited merge verdict.
