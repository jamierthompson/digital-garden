# Docs house-cleaning → product-team workflow

**2026-06-27 · solo lead session · PR #48**

## Why

The build is past its initial risk-retirement era (Phases 0–3 complete). The phase-planning docs that drove it had become the _opposite_ of useful — a `build-phases.md` backlog, a system model written as a "plan," and ops info repeated across four files. Goal: retire that scaffolding, move work tracking to **GitHub issues**, eliminate cross-file repetition, and leave the repo in a state where ordinary **product-team practices** apply.

## Shape

Solo lead. Two read-only **audit subagents** up front (citation/blast-radius map; docs inventory + consolidation clusters) plus a readiness audit → an owner-approved scrub plan → execution as a series of gate-green commits on `chore/docs-house-cleaning` → one **fresh adversarial QA pass** `[D26][D28]` → fixes → an owner-driven consolidation follow-up. Owner made the binding calls along the way (keep one decision register; no milestones for the backlog but split delivery milestones for oklch; `architecture-plan.md` distilled rather than deleted; sessions kept; LICENSE is all-rights-reserved, not MIT).

## Outcome

**GitHub tracking stood up:** 10 self-contained issues (#37–#46), a clean `type:*`/`area:*` label taxonomy (defaults removed), two delivery milestones (**@garden/oklch (engine package)** ← #41/#42; **oklch-engine playground** ← #37), a `type:spike` label + spike template, and spike #47 (styling approach — README _and_ code diverge).

**Docs restructured (PR #48):**

- Deleted `build-phases.md`, `production-checklist.md`, `architecture-plan.md`.
- `architecture-plan.md` → distilled into `docs/handbook/architecture.md` (present-tense system model; `§N`/`§N.N` anchors preserved so ~68 source citations resolve).
- `production-checklist.md` → folded into `handbook/security-and-ops.md` §5 (now the single ops owner).
- `decisions.md` → `docs/decisions/README.md` (D1–D31 preserved); `audit/` + `handbook/making-of/` → `docs/archive/`; `sessions/` kept in place.
- New **`[D32]`** — status colors are **brand-derived per island** (engine-generated) — **supersedes `[D8]`** (owner call).
- All handbook pages, `AGENTS.md`, the README, the `agent-team` skill, and code comments rewired + de-Phased; "deferred review findings" convention re-homed from `build-phases.md` → GitHub issues.
- Two real gate bugs fixed: `lint:docs` was missing from the gate chain in `git-and-pr-workflow.md`, `engineering-standards.md`, and the PR template; `decision-records.md` had a stale `D1–D26` count.
- Hygiene: `LICENSE` (all-rights-reserved / source-available), `CONTRIBUTING.md` (solo + AI-agent), `.github/ISSUE_TEMPLATE/` (bug / task / spike).
- **Single-source consolidation (post-QA, owner-flagged):** the "don't reach up" litmus had been duplicated into the PR template + DoD; collapsed so it lives **only** in `architecture.md` §8, with DoD and the (now lean) PR template pointing to it. The PR template no longer copies the DoD checklist or gate chain.

**Branch protection:** confirmed `main` is protected by the **ruleset** `protect-default-branch` (PRs required, no force-push/delete, review threads must resolve, `code_quality` errors gate) — so "never commit to main" _is_ enforced. The one gap, **`verify` not a required status check**, is handed to the owner to apply (ruleset edit / UI) — the agent's API write was permission-blocked.

## QA log [D26]

| Slice                        | QA agent (fresh, no prior context) | Verdict                          | Tests added                          |
| ---------------------------- | ---------------------------------- | -------------------------------- | ------------------------------------ |
| docs house-cleaning (branch) | 1 fresh adversarial agent          | no blockers; 4 SHOULD-FIX, 2 NIT | none (docs/config; full gate re-run) |

**Defects → fix → re-check:**

1. `src/app/foundation.css` asserted the **superseded D8** position ("fixed signal colors, NOT brand-derived") in shipped code → rewritten to D32 (no global slot; brand-derived per island) → re-checked, consistent with the new decision.
2. **14 dangling links in the `docs/sessions/` tree** to deleted/moved docs (the structural author fixed `decisions/README.md`'s links but not the session referrers) → index (`sessions/README.md`) repointed (making-of → archive; deferred-findings → issues); dated logs de-linked deleted-doc refs to code-spans and repointed `../decisions.md` → `../decisions/` → re-checked, zero dangling.
3. `src/lib/resolvers/embeds.ts` leftover **`PHASE 3+:`** comment (uppercase — missed by the case-sensitive sweep) → dropped → re-grep clean (case-insensitive).
4. `packages/oklch/src/README.md` referenced deleted `architecture-plan §3.2` → `architecture.md §3.2`.

**NITs:** `decision-records.md` bare `decisions.md` prose mentions → `decisions/README.md`; trimmed an editorial addition to D27's immutable body back to a pure de-link.

**Verified clean by QA:** `§N` integrity (all cited sections exist in `architecture.md`), D32/D8 correctness, gate-chain byte-sync across AGENTS/DoD/ci, hygiene files, and every handbook/AGENTS/skill link.

**Deferred / follow-ups:** require `verify` status check (owner — ruleset); styling-approach spike (#47); `Deploy Sanity Schema` workflow fix (#43).

## Lessons

- **The PR template is bypassed by agent-created PRs** (`gh pr create --body`) — #48 itself never used it. Duplicating the DoD checklist / litmus into `.github/` is repetition the _primary author (an agent)_ never even sees. Rule: single-source + pointer; don't restate gates in the template.
- **Adversarial QA only catches what the brief frames as in-scope.** The QA pass found the referrer-rot the author missed, but not the litmus _over-duplication_ — because the brief told it that expansion was intended. The owner caught it. Frame QA briefs to question the requirements, not just the diff.
- **Immutable ADR bodies (D1–D31) keep their historical "Phase" language by design** (the never-edit rule); only their _links_ were re-depthed after the move.
