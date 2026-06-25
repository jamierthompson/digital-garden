# Session record — Phase 3 close attempt: @layer fix + Preview entry point + CI schema deploy

- **Date:** 2026-06-25
- **Mode:** **agent team** (lead + spawned background teammates over file-disjoint slices), per
  `.claude/skills/agent-team`. Staffing was re-evaluated per phase: data seeding, the deep
  investigations, and curation were **lead** work, while the three coding slices and their adversarial
  QA were **teammates**.
- **QA:** one fresh, independent adversarial QA per coding agent `[D26]` (see QA log). The lead also ran
  direct browser/prod verification (`chrome-devtools` MCP + the live Vercel deploy) `[D25]`.
- **PRs:** **#23** (@layer fix), **#24** (Preview wiring), **#25** (CI schema deploy) — three focused PRs,
  squash-merged sequentially (owner's call), @layer first (it fixes a live prod bug).
- **Outcome — Phase 3 stays OPEN.** Items A (@layer fix) and B (Preview entry point) are **done**; the
  schema-deploy blocker is solved via CI. **Item C (draft-content rendering verified end-to-end in
  Preview) is NOT done** — it needs the deployed schema + the owner's interactive Studio login, neither
  headless-doable. Phase 3 is **not** declared complete (owner's explicit instruction). Tracked in
  `build-phases.md` "What's left to close Phase 3".

## Why

Closing the three carried items from `build-phases.md`: (A) the app-wide `@layer` cascade inversion,
(B) the missing Preview entry point, (C) end-to-end draft-content verification — plus seeding enough
real content (notes + project-with-notes) to visually exercise `RelatedNotes`/`TagList`.

## Data seeding (lead)

The dataset had 1 project (`first-light`), 0 notes. Seeded **4 published notes** (`On Color in Code`,
`The Cascade, Layered`, `Notes Grow by Accretion`, `First Light, Revisited`) with bodies, tags, and
note→note backlinks (varied `relatedCount`), and wired `first-light.notes[]` → 3 of them. Verified:
populated `RelatedNotes` (3 entries) + `TagList` render locally. Reference integrity forced a
create-without-refs → publish → patch-in-refs → publish ordering.

## Slice A — the `@layer` cascade inversion (PR #23, `[D27]`)

The headline of the session. **The first attempt was wrong, and a fresh investigation got it right** —
a vindication of the [D26]/fresh-context discipline.

- **First coding agent** implemented the planned fix (split the `@layer` statement into a dedicated
  `layers.css` imported first), **browser-verified it did NOT work**, tried six adaptations, and
  concluded — honestly but **incorrectly** — that "no in-source mechanism can reorder Turbopack's chunk
  emission." Committed as `refactor:` (not `fix:`), recommended not merging. Good honesty, wrong verdict.
- **A fresh-context diagnosis agent** (run on the owner's instruction, no prior theory fed to it) found
  the **true root cause**: Turbopack anchors a route's **first emitted stylesheet to whatever is imported
  first in `layout.tsx`**. `next/font` was imported before `foundation.css`, so the font/component-module
  chunk (carrying `@layer project {}`) loaded first and registered `project` as the **lowest** layer. The
  verified fix: **import the global CSS above `next/font`** — a one-region reorder, no `layers.css`, no
  reset surgery.
- **Lead resolved the QA conflict with direct evidence.** The slice's adversarial QA (LayerQA) could
  **not reproduce** the inversion in its git worktree and flagged the mechanism as unverified. Rather than
  smooth this into consensus, the lead reproduced directly: on a **fresh `main` checkout** the inversion is
  **deterministic** (3/3 clean builds, `project < foundation < brand`, chips `padding:0`), and it was
  **live on the production Vercel deploy** (`/work/first-light` chips computed `padding:0`). The fix
  produces `foundation`-first **3/3 builds × 5 routes** on the canonical env; browser-verified chips
  `4px 12px` both schemes. **Conclusion:** Turbopack chunk emission order is **environment-sensitive** —
  worktrees can mask a bug that ships from a fresh checkout. Recorded as a caveat in `[D27]`.
- Guard: `src/app/layout.import-order.test.ts` pins `foundation.css` as the first side-effect import
  (LayerQA contributed the stronger "first side-effect import" assertion). No import-sorter is enabled;
  the test fails the gate if one is added or the imports are reordered.

## Slice B — Preview entry point (PR #24, `[D16]`)

`presentationTool` + `defineLocations` wired into `studio/sanity.config.ts`, driving the existing
draft-mode handlers. Used the **current** `sanity@6.1.0` API (`previewUrl.initial`/`previewMode`; the
older `origin`/`draftMode` keys are `@deprecated`). Slug-guarded locations (no `/work/undefined`).
Origin overridable via `SANITY_STUDIO_PREVIEW_URL`. No new dep, no type drift. The localhost CORS
origin was added out-of-band (prerequisite for the Preview iframe).

## Slice B′ — schema deploy: a real upstream blocker, solved via CI (PR #25)

`sanity schemas deploy` **cannot run on the owner's machine**: it loads `@rolldown/binding-darwin-x64@1.0.3`,
whose native binary **SIGABRTs** (crash report: `abort ← napi_call_threadsafe_function ← rolldown-binding.darwin-x64.node`).
Ruled out, with evidence: it is **not** Rosetta (the machine is a genuine Intel i7-8850H Mac, `process.arch=x64`
native), **not** `autoUpdates`, **not** the manifest step, and **not** a version lag — reproduced across
`@sanity/cli` **7.2.3 + 7.4.0** and Node **20 + 22**. (Also clarified for the owner: `sanity` and
`@sanity/cli` are **separately versioned** — `sanity` v6 is current, `@sanity/cli` v7 is current; not a
stale major.) **Fix:** deploy from CI (Ubuntu/linux-x64, where Rolldown works) via
`.github/workflows/deploy-schema.yml` + a `SANITY_DEPLOY_TOKEN` repo secret (owner created the token and
set the secret). The live deploy run is the owner's post-merge `workflow_dispatch`.

## QA log `[D26]`

| Slice                   | Author                       | QA agent (fresh)               | Verdict         | Defects → fix                                                                                                                              | Tests QA added                                                            |
| ----------------------- | ---------------------------- | ------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| A — @layer fix          | lead (after fresh diagnosis) | LayerQA (`general-purpose`)    | ship-with-fixes | F1 dangling `[D27]` → D27 authored; F2 "can't reproduce" → **lead resolved with fresh-checkout + live-prod evidence** (worktree masked it) | "foundation.css must be first side-effect import" (folded in)             |
| B — Preview wiring      | Preview agent                | PreviewQA (`general-purpose`)  | ship-with-fixes | F1 `/work/undefined` on slug-less draft → slug-guarded; F3 env-validity doc → added                                                        | none (no idiomatic Studio test seam — honestly flagged)                   |
| B′ — CI deploy workflow | CIDeploy agent               | CIDeployQA (`general-purpose`) | ship-with-fixes | MEDIUM no `permissions:` → `permissions: {}`; no `timeout-minutes` → added; path gap → `sanity.cli.ts` added; comment doc-path → fixed     | none (unexecutable YAML; verified statically + actionlint + doc citation) |

**Process note (recorded to memory):** the lead initially substituted a _lead diff-review_ for fresh QA
on the CI workflow ("low-risk, unexecutable"). The owner caught it; `[D26]` is non-negotiable for **every**
coding-agent slice including CI/config. Corrected by spawning CIDeployQA, which found the real
least-privilege gap. A lead review is a complement, not a substitute.

## Item C — attempted, surfaced a blocking defect (Phase 3 stays OPEN)

After the merges, the owner deployed the schema (PR #25 workflow, successful) and Preview was entered.
**Verified observations:** draft/published isolation holds at the data layer (`published` = "First Light" /
3 notes; a test draft = edited title / 4 notes); cookieless public + prod sessions render **published** (no
leak); the `/work/[slug]` page **renders the draft** under Draft Mode. **Defect found:** with Draft Mode ON,
a runtime **Blocking Route** error fires — `Route "/": Uncached data … accessed outside of <Suspense>` at
`generateMetadata` (`layout.tsx:39`) → `sanityFetch(SITE_SETTINGS_QUERY)`. It blocks clean end-to-end preview
and appears **only with Draft Mode ON** (the path unverified since PR #21). Full draft preview — including
`siteSettings`/the shell — is a Phase-3 goal **and** a Phase-4 prerequisite, so it is in scope. **Handed to
the next session for FRESH exploration — no suspected fix is recorded, deliberately (avoid confirmation
bias).** Full observations + repro live in `build-phases.md` ("What's left to close Phase 3 / Item C"). The
test draft was created and **discarded** (dataset left clean).

## Could NOT verify

- The Blocking Route defect's root cause / fix — left for fresh exploration next session, by design.

## Wrap-up PR — `chore/deps-node24-and-item-c-findings`

A maintenance PR closing this session: **Node 24 CI actions** (`checkout`/`setup-node`/`pnpm-action-setup`
→ `@v5`, clearing the Node-20 runner deprecation); an **in-range dependency refresh** (React 19.2.7,
`@vitejs/plugin-react` 6.0.3, `styled-components` 6.4.3, sanity/vision 6.2.0, uuid) with the breaking majors
(TypeScript 6, ESLint 10, `@types/node` 26) **deferred** as deliberate follow-ups; and the Item C findings
above recorded into the docs. Full gate green.

## Gate

All three branches: full gate green (`lint · lint:css · lint:keys · lint:docs · format:check · typecheck ·
test (493) · studio typegen · git diff --exit-code sanity.types.ts · build`). Stale agent worktrees were
pruned (they had polluted the test glob — 1407→493 once cleaned). Branches curated to clean single-purpose
history; squash-merged; deleted after merge.
