# Orchestration Plan — Parallel Review of PR #5 (security · tests · conventions)

**Lead:** this session. **Mode:** Parallel Code Review (one lens per teammate → cross-challenge → lead synthesizes).
**Source skill:** `agent-team/SKILL.md` §0–§1 + `references/code-review.md`.
**Grounding:** repo handbook `docs/handbook/working-with-agents.md` §4–§6, `docs/decisions.md` (`[D#]`), the CI gate in `AGENTS.md` / `.github/workflows/ci.yml`.

---

## 1. Preflight

### 1a. Is a team even the right tool?

**Yes — this is the textbook case for the Parallel Review mode**, and the user explicitly asked for it: _"security, test coverage, and our repo conventions all checked, not a single once-over."_ That is three distinct quality lenses run simultaneously, with the team's edge being **cross-examination** (one reviewer disproves another's false positive).

Checked against the SKILL §0 decision table:

- **Team** — independent lenses over the _same_ read-only diff, where reviewers benefit from challenging each other's findings. ✅ matches.
- **Subagents** — would work for a _non-interacting_ fan-out, but we lose the cross-challenge step (the team's whole advantage) and the shared task list. The user explicitly rejected "a single once-over," so breadth + adversarial verification is the point.
- **Single session / `/code-review` skill** — the right tool for a _fast single pass_; it gravitates to one issue class at a time. Rejected because the user wants three deliberately separate lenses, not one sweep.

Review is **read-only**, so the usual file-ownership constraint doesn't bite — lowest-risk team to run.

> **Token-cost honesty:** a team is ~several× a single pass (each teammate is a full Claude). Justified here by the explicit "not a single once-over" ask. If the user wanted speed over breadth, I'd run `/code-review` instead and say so.

### 1b. What must be true for the team to run at all

- **Experimental flag — CONFIRMED ON.** `~/.claude/settings.json` sets `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"` and the env var is exported. Spawning will work (without it, spawns silently no-op).
- **⚠️ BLOCKER — the review target does not exist yet.** `gh pr view 5` returns _"Could not resolve to a PullRequest with the number of 5."_ The repo has only PRs #1–#4, **all MERGED**, and no local/remote branch for a #5 (`git branch -a` shows only `main` and the merged `claude/agent-team-git-workflow-pd20yv`). **A team cannot review a target that isn't fetchable.** Before spawning, I must resolve one of:
  1. The PR lives on a fork / hasn't been pushed → get the correct repo or `gh pr checkout 5`.
  2. The user means a different number / a local branch / the working tree.
  3. It's genuinely not opened yet → nothing to review; report back rather than spawn a team against air.

  **I will confirm the exact target with the user and pin it to an immutable ref (`git rev-parse HEAD` of the PR branch) before any spawn.** Every brief below carries a `<TARGET>` placeholder filled with that resolved ref + `git diff main...<branch>` scope so all three teammates review the _same bytes_.

---

## 2. Approach / pattern & why

**Parallel Review** (`references/code-review.md`): one teammate per lens, each reviewing the identical diff through a different filter, then a **cross-challenge** round, then **lead synthesis** into one deduplicated, severity-ranked report.

- **3 teammates, not 5** — the user named exactly three concerns (security, tests, conventions). SKILL §1: "three focused teammates beat five scattered ones; scale up only when work genuinely parallelizes." I add no fourth lens unless the diff's content demands it (e.g. a rendered UI surface would pull in a `chrome-devtools` a11y/CWV pass per `[D25]`).
- **Reuse the repo's installed review agents as `agentType`** so each teammate inherits a purpose-built tool-allowlist + system prompt (SKILL §1, code-review.md table).
- **Cross-challenge is mandatory, not optional, here** — it's the only thing a team gives over three subagents, and it's what turns "three lists" into "verified findings." The security reviewer flags something the test reviewer can prove is already covered; the conventions reviewer rules a "bug" in-spec, etc.

---

## 3. The three teammates

| Name         | Lens                                                      | `agentType`                               | Model tier                                                  |
| ------------ | --------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| **Sentinel** | Security + silent-failure / error-handling                | `pr-review-toolkit:silent-failure-hunter` | Opus (security is an agent blind-spot, §2; reasoning-heavy) |
| **Coverage** | Test coverage + completeness                              | `pr-review-toolkit:pr-test-analyzer`      | Sonnet                                                      |
| **Canon**    | Repo-convention & decision adherence (the gate + `[D#]`s) | `pr-review-toolkit:code-reviewer`         | Opus (must reason about cascade/isomorphism footguns)       |

Division rationale: the three lenses map 1:1 onto the user's three asks, are **mutually non-overlapping by filter** (security/errors vs. test adequacy vs. house rules), and each maps to an installed agent built for it. Bugs/logic correctness is folded into Sentinel + Canon rather than adding a fourth teammate (don't add agents to fix coverage — §4 pitfall; sharpen briefs instead).

---

## 4. Verbatim spawn briefs

> Each is self-contained (teammates see no conversation history — handbook §5). `<TARGET>` = the resolved PR #5 ref + diff command pinned in preflight 1b.

### 4a. Sentinel — Security & silent-failure lens

```
You are Sentinel, a code-review teammate. ONE lens only: SECURITY and SILENT FAILURES. Do not review tests or style — other teammates own those.

OBJECTIVE
Review the diff of PR #5 — `<TARGET>` (e.g. `git diff main...<pr5-branch>`) — for: secret/credential exposure, injection, unsafe input handling, auth/authorization gaps, and silent failures (swallowed errors, empty catches, fallbacks that hide faults, error paths that log-and-continue when they should surface).

REVIEW TARGET
Run `<TARGET>` yourself to get the exact changed lines. Review ONLY what the diff touches (+ immediately adjacent code needed to judge it). Read-only — do not edit files.

SOURCE-OF-TRUTH (open these; do not work from memory)
- docs/handbook/security-and-ops.md — §1 secrets & env policy (secrets→env only; `.env*` never committed), §3 Sanity token handling, §2 dependency hygiene.
- docs/decisions.md — [D9] `brandColor` three-layer defense: the engine must PARSE/CLAMP/GAMUT-VALIDATE and return a fallback palette, NEVER throw; `unstable_catchError` is the backstop, NOT a segment error.tsx. [D14] OKLCH engine stays isomorphic — flag any `server-only`/`client-only` added to src/lib/oklch/. [D16] stega off brandColor.
- docs/handbook/working-with-agents.md §2 — "security & performance are agents' documented blind spots"; hold the line on [D9]/[D11] even when they feel like overhead.
- For any Next.js 16 / React 19 framework claim (request APIs async, `proxy.ts`, `'use cache'` cannot read request APIs), VERIFY against node_modules/next/dist/docs/ before asserting. Do NOT trust memorized Next APIs — this repo diverges from training data (AGENTS.md "the one rule").

BOUNDARIES
- Security + error-handling ONLY. No test-coverage or convention findings (note-and-defer if you spot one).
- Binding: [D9], [D14], [D16] are settled — cite them, don't relitigate.
- Don't run the app or mutate the working tree.

OUTPUT FORMAT
A dense, cited finding list. Each: `file:line · severity(blocker|high|medium|nit) · what · why-it's-exploitable/unsafe · cited source ([D#] / handbook §/ bundled-doc path) · suggested fix`. Lead with a one-line verdict (blockers? y/n). No raw dumps.

CITE, DON'T REMEMBER: every framework claim ties to a node_modules/next/dist/docs/ path; every repo-rule claim to a [D#] or handbook section that actually contains it.
```

### 4b. Coverage — Test-coverage lens

```
You are Coverage, a code-review teammate. ONE lens only: TEST COVERAGE and test quality for PR #5. Do not review security or style — other teammates own those.

OBJECTIVE
Judge whether the tests in/around PR #5's diff adequately cover the new/changed behavior: meaningful assertions (not snapshot theater), edge cases, error paths, and the repo's specific testing rules. Identify untested logic that should be tested and weak/over-mocked tests.

REVIEW TARGET
Run `<TARGET>` (e.g. `git diff main...<pr5-branch>`) for changed files. For each changed source file, check whether a co-located `*.test.ts(x)` covers it. Read-only.

SOURCE-OF-TRUTH (open these; do not work from memory)
- docs/handbook/testing.md — "What to test vs. skip" (§43), RTL usage rules (§72), co-location [D18] (§110), the jsdom wall for async Server Components (§126), the dual-env OKLCH engine rule [D14] (§149: assert behaviour not snapshots; the engine is tested in BOTH node and jsdom), Phase-1 visual contrast harness [D17] (§242), pitfalls (§287).
- docs/handbook/definition-of-done.md §6 "Tests, browser verification & docs" — the bar a slice must clear.
- docs/decisions.md — [D18] Vitest now / Playwright at Phase 3 (don't demand E2E yet); [D14] dual-env engine testing; [D17] contrast harness.
- Stack reality: Vitest + React Testing Library + jsdom (package.json `test` = `vitest run`). Async RSCs can't be rendered in jsdom — don't fault a PR for "missing" a test that the jsdom wall makes impossible; cite §126.

BOUNDARIES
- Test coverage/quality ONLY. No security or convention findings (note-and-defer).
- Don't demand test types the handbook defers (no Playwright/E2E before Phase 3 [D18]).
- Read-only; don't write tests — recommend them.

OUTPUT FORMAT
Dense, cited list. Each: `file (or untested symbol):line · severity · gap or weak test · why it matters · cited rule (handbook §/[D#]) · concrete test to add`. Lead with a coverage verdict (adequate / gaps / blocking gaps). No raw dumps.

CITE, DON'T REMEMBER: tie every "should be tested" to testing.md's actual guidance; verify any Next/React testing claim against node_modules/next/dist/docs/ rather than memory.
```

### 4c. Canon — Repo-convention & decision-adherence lens

```
You are Canon, a code-review teammate. ONE lens only: does PR #5 obey THIS repo's conventions, decisions, and CI gate. Do not review security or test coverage — other teammates own those.

OBJECTIVE
Catch violations of the repo's binding decisions and house rules — the footguns that silently break this stack and the CI gate that must be green before merge.

REVIEW TARGET
Run `<TARGET>` (e.g. `git diff main...<pr5-branch>`). Review changed files against the rules below. Read-only — do not edit. You MAY run the gate read-only to verify (`pnpm lint`, `pnpm lint:css`, `pnpm lint:keys`, `pnpm format:check`, `pnpm typecheck`) but do not push or commit.

SOURCE-OF-TRUTH (open these; do not work from memory)
- AGENTS.md "Non-negotiable guardrails" + "Pre-flight checks (the gate)": full chain is
  `pnpm lint && pnpm lint:css && pnpm lint:keys && pnpm format:check && pnpm typecheck && pnpm test && pnpm --filter studio typegen && git diff --exit-code sanity.types.ts && pnpm build`.
- docs/decisions.md, binding:
  - [D12] the "@layer trap" — EVERY CSS Module declares its `@layer` (foundation|brand|project) or is strictly var-consuming; an unlayered module outranks every @layer style. Enforced by `pnpm lint:css` (scripts/check-css-layers.mjs).
  - [D14] OKLCH engine stays isomorphic — NEVER `server-only`/`client-only` in src/lib/oklch/.
  - [D21] literal dynamic imports only — `() => import("@/projects/<slug>")` per key; never templated `import(\`…/${slug}\`)`.
  - [D10] reference-by-key drift — `keys.ts` is the single source of truth; enforced by `pnpm lint:keys` (scripts/check-key-drift.mjs).
  - [D23] after any Studio schema change, regenerate + commit root-anchored `sanity.types.ts`.
- docs/handbook/engineering-standards.md, git-and-pr-workflow.md (Conventional Commits, branch naming feat/fix/chore, never commit to main), definition-of-done.md.
- Next.js 16 / React 19 footguns — VERIFY against node_modules/next/dist/docs/: request APIs are async (`await cookies()/headers()/params/searchParams`); `export const dynamic` removed under Cache Components [D11]; `middleware.ts` is `proxy.ts`.

BOUNDARIES
- Conventions/decisions/gate ONLY. No security or test-coverage findings (note-and-defer).
- Decisions are immutable — flag violations, don't propose re-litigating them.
- Read-only; no commits/pushes.

OUTPUT FORMAT
Dense, cited list. Each: `file:line · severity · rule violated · cited authority ([D#]/AGENTS.md/lint script/bundled-doc path) · fix`. Call out explicitly whether the CI gate would pass or fail and which command trips. Lead with a verdict (gate-green? convention-clean?). No raw dumps.

CITE, DON'T REMEMBER: every rule ties to the [D#] + lint script or the bundled-doc path that actually states it (per working-with-agents.md §1 — cite the source that holds the fact).
```

---

## 5. Closing the loop (lead's synthesis)

1. **Collect** all three digests; keep each teammate's `file:line + severity + citation`.
2. **Cross-challenge round (the team's edge).** Before synthesizing, I post each teammate's findings to the other two and ask: _"Does any of this overlap your lens, contradict a finding, or is it a false positive you can disprove with a citation?"_ — e.g. Coverage shows Sentinel a "silent failure" path is actually covered + asserted; Canon shows a flagged pattern is in-spec per a `[D#]`. This is exactly the step subagents can't do.
3. **Deduplicate & merge** findings that multiple lenses hit (e.g. a swallowed error that is _also_ an untested path _also_ violating [D9]) into one entry with all citations.
4. **Resolve conflicts explicitly — never smooth a fake consensus** (SKILL §1 / handbook §4 pitfall). Where teammates disagree, I state which view won **and why**, with the citation, rather than averaging.
5. **Produce one severity-ranked report**: Blockers (must fix before merge) → High → Medium → Nits, each with `file:line`, the owning lens, and its citation. Explicit headline: **merge / don't-merge**, and _which gate command (if any) would fail_.
6. **Advisory only** — per code-review.md, fixes are a separate coding pass; this review does not mutate the PR. If the user wants fixes, that's a follow-up Coding-feature team (own-a-slice) or a single session.
7. **Shut down** Sentinel, Coverage, Canon by name once the synthesis is delivered.

> If preflight 1b is unresolved (PR #5 still not fetchable), **none of this runs** — I report the blocker to the user and ask them to point me at the real target first.
