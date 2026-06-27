# Docs house-cleaning → product-team workflow

**2026-06-27 · solo lead session · PR #48 (open)**

## Why

The build is past its initial risk-retirement era (Phases 0–3 complete). The phase-planning docs that drove it had become the _opposite_ of useful — a `build-phases.md` backlog, a system model written as a "plan," ops info repeated across four files, and a layer of cross-file duplication the repo's own "single-source pointer" rule forbade. Goal: retire that scaffolding, move work tracking to **GitHub issues + milestones**, kill duplication and rot, and leave the repo in a state where ordinary **product-team practices** apply. "Phase" stops being a planning word going forward (milestones replace it); frozen history keeps it.

## Shape

Solo lead, in two passes on `chore/docs-house-cleaning`. Pass 1 stood up GitHub tracking and did the first restructure; pass 2 (owner-directed) went deeper on duplication, rot, and code comments. Both used the same loop: read-only **audit subagents** up front → owner-approved plan → execution as gate-green commits → **fresh adversarial QA** `[D26][D28]` → author fixes → re-check. Pass 2 fanned the audit across **five** read-only auditors (root/handbook/decisions+sessions/archive/code-comments) and the code-comment sweep across **four** parallel editing agents (oklch / src TS·TSX / CSS / scripts·studio), each reviewed by the lead before commit. The owner made the binding calls throughout (keep one decision register; milestones not in-repo phases; sessions kept but the index dropped; archive kept locally but evicted from git; LICENSE is all-rights-reserved; restore `settings.json`).

## Outcome

**GitHub tracking stood up:** issues #37–#47, a clean `type:*`/`area:*` label taxonomy (defaults removed), two delivery milestones (**@garden/oklch (engine package)**; **oklch-engine playground**), a `type:spike` label + template, and spike #47 (styling approach). Link-checker tooling filed as **#49** (no Markdown link/anchor check exists in the gate — the root cause of most rot this branch fixed by hand).

**Restructure (pass 1):**

- Deleted `build-phases.md`, `production-checklist.md`, `architecture-plan.md`; distilled the architecture plan into `handbook/architecture.md` (present-tense system model, `§N` anchors preserved) and folded the production checklist into `security-and-ops.md` §5.
- `decisions.md` → `docs/decisions/README.md` (single register, D1–D32). New **`[D32]`** — status colors are brand-derived per island, **supersedes `[D8]`**.
- Rewired + de-Phased the handbook, `AGENTS.md`, README, and `agent-team` skill; "deferred findings" convention re-homed to GitHub issues. Hygiene: `LICENSE`, `CONTRIBUTING.md`, issue/PR templates.
- Collapsed the duplicated "don't reach up" litmus + DoD checklist to single-source pointers.

**Deeper slim + de-rot (pass 2):**

- **Retired "Phase" from living surfaces → milestones.** Dropped the rot-prone `sessions/README.md` index (the dated directory listing _is_ the index; it had carried live "Phase 3 COMPLETE" status and lost two sessions); slimmed it to purpose + how-to-write. Frozen session/ADR bodies keep their "Phase" language by design.
- **Versions → major-only** in living docs ("Next.js 16", "React 19"); the exact pins live in `package.json`.
- **Gate command single-sourced.** `definition-of-done.md` §1 is the one doc copy; `AGENTS.md` + the handbook point to it; `ci.yml` is the executable truth. The `lint:docs` guard (`check-doc-gate-sync.mjs`) + its test narrowed from 3 sources to 2 (DoD §1 ↔ ci.yml).
- **Capability/MCP enumerations → "look, then ask."** The `sanity:*`/`vercel:*`/MCP-server lists (which rot as plugins change) replaced with the standing line: the tools you need are likely installed and authed; look before assuming, ask if missing.
- **Compressed the duplicated `[D26]`/`[D28]` QA-loop restatements** (orientation, DoD, git-and-pr) to pointers to `working-with-agents` §6.2.
- **studio/README.md** boilerplate ("Congratulations, you have now installed…") → a real README. **`.env.example`/`.env.local`** comments slimmed (secrets never touched). `.claude/settings.json` removed then restored at owner's call; `.gitignore` tidied.
- **Archive evicted from git.** `docs/archive/` (~8k lines of frozen making-of + pre-build audit) moved to a gitignored `/archive/` at the repo root — kept locally for future writing, out of version control — and **~24 inbound links de-linked** across the handbook/decisions/README + the `agent-team` skill.
- **Code-comment sweep** across `src/`, `packages/oklch`, `scripts/`, `studio/` to the owner's etiquette: delete section banners, historical ("used to…") and aspirational ("…later") notes, and obvious restatements; keep every `[D#]`/`§N` rationale and real gotcha (Turbopack import-order anchor, React 19 href de-dup, stega/draft-mode subtleties, isomorphism, never-throws/hostile-slug contracts). 74 files, comments only — gate stayed green (typecheck + 537 tests + build). The standard is documented in `engineering-standards.md` §6.
- `.github`/`.claude` audited: clean (the disabled-but-tracked `deploy-schema.yml` accurately points at its tracking issue; `claude.yml` `checkout@v4` vs `@v5` elsewhere noted, left).

## QA log [D26]

| Slice                                | QA agent (fresh, no prior context) | Verdict                          | Tests added                          |
| ------------------------------------ | ---------------------------------- | -------------------------------- | ------------------------------------ |
| Pass 1 — tracking + restructure      | 1 fresh adversarial agent          | no blockers; 4 SHOULD-FIX, 2 NIT | none (docs/config; full gate re-run) |
| Pass 2 — deeper slim + comment sweep | 1 fresh adversarial agent          | no blockers; 2 SHOULD-FIX        | none (docs/config; full gate re-run) |

**Pass 1 defects → fix → re-check:**

1. `foundation.css` asserted the **superseded D8** position in shipped code → rewritten to D32 (brand-derived per island) → consistent.
2. **14 dangling links** in the `sessions/` tree to deleted/moved docs → index repointed; dated logs de-linked to code-spans → zero dangling.
3. Leftover uppercase **`PHASE 3+:`** comment in `resolvers/embeds.ts` (missed by a case-sensitive sweep) → dropped → re-grep clean.
4. `packages/oklch/src/README.md` referenced deleted `architecture-plan §3.2` → `architecture.md §3.2`. **NITs:** bare `decisions.md` prose mentions; an over-edit to D27's immutable body.

**Pass 2 defects → fix → re-check:**

1. **Six residual links into `docs/archive/`** survived in the `agent-team` skill (`SKILL.md` + `references/research-decision.md`) — the inbound de-link sweep hadn't covered `.claude/`. De-linked to plain text → zero archive links remain in any tracked file.
2. `definition-of-done.md` §2 still called the gate guard "three declarations (AGENTS.md, this file, ci.yml)" → "two declarations (this file §1 ↔ ci.yml)" → consistent with the script, test, and every other living doc.

**Verified clean by QA (pass 2):** all relative links + intra-doc anchors resolve (incl. the new `#1-the-one-command` and fixed `#golden-rules-non-negotiable`); the gate guard + its test pass at 2 sources; no comment cut dropped a `[D#]`/gotcha or now mismatches its code; no version-rot in living docs; sessions/studio/env docs read coherently. Full gate green end-to-end (lint · lint:css · lint:keys · lint:docs · format:check · typecheck · 537 tests · TypeGen no-drift · build).

**Deferred / follow-ups:** Markdown link-checker (#49); require `verify` as a status check (owner — ruleset); styling-approach spike (#47); `Deploy Sanity Schema` workflow fix (#43).

## Lessons

- **An inbound-reference sweep must cover the whole repo, not just `docs/`.** Moving `docs/archive/` out, the de-link pass hit the handbook/decisions/README but missed `.claude/skills/` — QA caught six dead links there. Grep _all_ tracked files for the moved path, not the obvious directory.
- **A comment sweep parallelizes well but needs a human gate.** Four agents under one strict rule set (delete banners/history/obvious, keep `[D#]`/gotchas) + lead review of the dense files + the full gate (types + 537 tests prove no logic moved) made an aggressive 74-file cut safe.
- **Single-source + pointer beats restated guardrails.** The gate command, capability lists, and QA-loop rule were each duplicated across many files; collapsing to one home + pointers (and narrowing the machine guard to match) removes whole classes of future drift.
- **Frozen history keeps its language; living surfaces don't.** "Phase" stays in dated session bodies and immutable ADRs by design; only regenerable surfaces (the sessions index, code comments, handbook prose) were moved to the milestone vocabulary.
- **Adversarial QA only catches what the brief frames as in-scope** (pass 1 carried this forward): frame QA to question the requirements, not just the diff.
