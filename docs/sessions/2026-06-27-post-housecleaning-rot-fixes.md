# Post-house-cleaning rot fixes + mutable decision records

**2026-06-27 · solo lead session · PR (open) · follows #48**

## Why

The owner spotted that #48 ("house-cleaning") hadn't actually removed every reference to the
evicted `archive/` — the `agent-team` skill still pointed at it. That one miss implied others, so
the session opened with a fresh, adversarial sweep of the whole repo's docs and comments to find
what the previous pass left behind, then fixed it. Mid-session the owner also reset two process
conventions (decision-record immutability; the `invariant foundation` naming) and flattened the
decisions register to a single file.

## Shape

Solo lead on `docs/post-housecleaning-rot-fixes`. Two QA rounds bracketing the work:

- **Round 1 — audit.** Five fresh read-only agents (QA-A…E), one per slice (root+skill /
  handbook / decisions+sessions / src+studio comments / oklch+scripts comments), graded every
  surface against #48's standard. Code comments came back clean; the docs carried four classes of
  residual rot beyond the archive refs.
- **Execution.** The lead fixed everything inline as one gate-green slice, then took the owner's
  mid-session direction (mutability switch; terminology; the file move; rot-prevention).
- **Round 2 — fresh adversarial QA on the diff `[D26][D28]`.** Two new agents with no prior
  context (QA-F process / QA-G rot-fixes) tried to break the change. All findings fixed and
  re-verified; gate re-run green.

The owner made the binding calls throughout (mutable records + git audit trail; tombstone D8 not
renumber; `foundation` over `invariant foundation`; de-hardcode over a CI guard; flatten the
register to `docs/decisions.md`).

## Outcome

**Residual rot fixed (what #48 missed):**

- **Archive refs** — every `out-of-repo archive/` pointer across the handbook, decisions register,
  and the `agent-team` skill repointed to `docs/sessions/` (the real worked-example home).
- **`[D32]` contradictions** — three living docs still listed semantic colors as a global
  foundation invariant; D32 made them brand-derived per island. Corrected, incl. D1's frozen-wrong
  body line.
- **`registry.ts` path drift** — docs (and a Studio field description) named phantom
  `src/projects/registry.ts` / `src/embeds/registry.ts`; the real homes are
  `src/lib/resolvers/{components,embeds,fonts}.ts`. Reconciled everywhere.
- **Stale `§8` cross-ref** — removed when the PR template was slimmed.

**Process changes (owner calls):**

- **`[D33]` — decision records are mutable; git is the audit trail.** Retires the supersede-only
  norm; rewritten in its canonical home (`decision-records.md`) and every echo. **D8 tombstoned**
  into `[D32]` (kept the anchor so no `[D#]` dangles); **D1** corrected with a dated `_Updated_`
  note. Citation map showed only D8 was actually superseded — every other decision is cited 5–50×,
  so the register was already lean; renumbering was rejected (363 `[D#]` cites live in frozen
  sessions + ~29 in immutable git/PR history — stable IDs, never renumbered).
- **Rot prevention** — de-hardcoded the D-range/counter restatements in `decision-records.md`;
  adding a future `D#` now touches nothing there (the bug that bit us three times this session
  can't recur).
- **Terminology** — `invariant foundation` → `foundation`, then the standalone
  `invariant tier`/`layer` too (genuine code/source "invariant" terms kept).
- **Register flattened** — `docs/decisions/README.md` → `docs/decisions.md`; every inbound
  reference rewritten; verified by hand (247 links, 0 dangling) since no CI link-checker exists
  (#49).
- **Signal docs** — `CONTRIBUTING.md` reframed as a workflow signal (not a contribution
  invitation); PR template slimmed to a rot-free shell; `deploy-schema.yml` comment clarified
  (disabled in the Actions UI, cites #43).

Comments/docs/config only — zero logic changed. Full gate green end-to-end (lint · lint:css ·
lint:keys · lint:docs · format:check · typecheck · **537 tests** · TypeGen no-drift · build).

## QA log `[D26]`

| Slice                               | QA agent (fresh, no prior context) | Verdict                                          | Tests added |
| ----------------------------------- | ---------------------------------- | ------------------------------------------------ | ----------- |
| R1 audit — root + agent-team skill  | QA-A                               | 4 SHOULD-FIX, 2 NIT (archive refs, stale `§8`)   | none (docs) |
| R1 audit — handbook                 | QA-B                               | 5 BLOCKER, 7 SHOULD-FIX (archive, D32, registry) | none (docs) |
| R1 audit — decisions + sessions     | QA-C                               | 1 BLOCKER (archive ref); rest clean              | none (docs) |
| R1 audit — src + studio comments    | QA-D                               | clean (3 cosmetic NIT)                           | none (docs) |
| R1 audit — oklch + scripts comments | QA-E                               | clean (2 NIT, recommended keep)                  | none (docs) |
| R2 fresh — process / `[D33]` change | QA-F                               | 0 BLOCKER, 3 SHOULD-FIX                          | none (docs) |
| R2 fresh — rot-fix diff             | QA-G                               | 0 BLOCKER, 3 SHOULD-FIX, 1 NIT                   | none (docs) |

**R2 defects → fix → re-check:** QA-F caught that tombstoning D8 turned the handbook's cited
supersession exemplar (and its copy-paste template) into a self-contradiction, plus two `D1–D32`
range strings → reconciled the template to a tombstone variant, bumped the ranges. QA-G
independently caught a **third** stale ref QA-F missed — `decision-records.md:76` said "next is
D33" while line 151 said D34 (number-collision risk) → fixed. Both re-verified; gate re-run green.

**Register move:** verified by an exhaustive automated link-resolution sweep (247 relative links
across 22 changed docs, 0 dangling) rather than a fresh agent — the slice is mechanical and its
only risk surface is link integrity, which the sweep covers more completely than a human pass.

## Lessons

- **An archive-style eviction needs a repo-wide inbound sweep _and_ a fresh re-audit.** #48
  de-linked the obvious directories but missed `.claude/skills/`; the only reliable catch was a
  cold fresh-agent pass over every surface.
- **Restated volatile facts always rot — remove them, don't police them.** The D-range/counter
  rotted three times in one session. De-hardcoding (single-source) beats a CI guard: there's
  nothing left to drift.
- **Decision numbers are stable identifiers.** Renumbering would have broken 363 frozen-session
  cites + immutable git/PR history for cosmetic gain. Tombstone over renumber; gaps are a feature.
- **Without a CI link-checker, a file move needs an exhaustive manual link sweep.** The
  trailing-slash-less target (`./docs/decisions`) slipped every regex that anchored on a slash;
  only resolving all 247 links caught it. (#49 would automate this.)
- **zsh doesn't word-split unquoted variables** the way bash does — a multi-file `sed` loop over a
  `$FILES` string silently ran zero times. Use an explicit literal list.
