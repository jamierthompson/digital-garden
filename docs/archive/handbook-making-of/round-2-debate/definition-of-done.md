# Devil's-Advocate Review — Definition of Done (Round 1 draft)

Reviewed: `../round-1-drafts/definition-of-done.md`. Verified against the installed
Next 16.2.9 bundled docs (`node_modules/next/dist/docs/`), `.github/workflows/ci.yml`,
`package.json`, `scripts/check-css-layers.mjs`, `docs/decisions.md`,
`docs/architecture-plan.md` §8, and sibling drafts `git-and-pr-workflow.md` /
`engineering-standards.md`.

**Verdict:** Strong, accurate, well-anchored draft. The one-chain-mirrors-CI spine is the
right call and the per-step table is genuinely useful. The real problems are (1) **scope
bleed** — §5 and the TypeGen row duplicate content that sibling docs _already own_ as their
primary subject, and (2) **§4 reproduces architecture-plan §8 nearly verbatim**, which the
brief explicitly says to point at, not copy. A handful of smaller accuracy and citation nits.
Almost nothing here is wrong; the work is trimming and de-duping, not rewriting.

---

## What's good (concede first)

- **The spine is correct.** §1 reproduces CI's `verify` job step-for-step in CI's exact order
  (`lint → lint:css → lint:keys → format:check → typecheck → test → typegen + git diff →
build`). I diffed it against `.github/workflows/ci.yml` lines 26–37 and `package.json`
  scripts — it matches exactly, including the `pnpm --filter studio typegen && git diff
--exit-code sanity.types.ts` pair. "Green locally = green in CI" is honestly earned here,
  not asserted. This is the single most valuable thing the doc does.
- **§2 table is accurate.** The `@layer` lint's accepted layer names (`foundation | brand |
project`) match `scripts/check-css-layers.mjs` lines 1–4 and 47 verbatim. The `[D#]`
  citations on each row are correct ([D12] for CSS layers, [D10] for key drift, [D23] for
  TypeGen, [D11] for Cache Components).
- **§3 Cache Components claims check out against the installed docs** (see Accuracy below).
  Including this section is correct: `pnpm build` _is_ the only gate that catches these, and
  pointing agents at the bundled docs rather than model memory is exactly right per AGENTS.md.
- **The "whole chain even for a schema-only change" callout** (§1) is a real, non-obvious
  footgun worth stating.

---

## 1. ACCURACY

Framework claims are **substantially correct** for installed Next 16.2.9 / React 19.2.4.
Spot-checks:

| Draft claim                                                                                                     | Verified?          | Source                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `Uncached data was accessed outside of <Suspense>` is the error string                                          | **Yes**            | `01-app/01-getting-started/08-caching.md:292` uses this exact phrasing                                                             |
| Request APIs (`cookies`/`headers`/`params`/`searchParams`) are async Promises                                   | **Yes**            | consistent across docs; matches AGENTS.md ground truth                                                                             |
| Non-deterministic calls need `await connection()` + `<Suspense>` (or `'use cache'`)                             | **Yes**            | `08-caching.md:202–211`; `connection.md:8`                                                                                         |
| `'use cache'` can't read `cookies()`/`headers()`/`searchParams` inside; pass as args; args become the cache key | **Yes**            | `use-cache.md:196` (cannot access), `:21` (pass as args, "preferred pattern"), `:76–99` (args + closure vars become the cache key) |
| Build hangs ~50s on an unawaited runtime Promise in a cached scope                                              | **Yes, precisely** | `use-cache.md:599` — "timeout after 50 seconds"; `:603` shows the exact error                                                      |

**A1 — Doc paths in §3 are wrong and will waste an agent's time.** The draft says
"specifically `cacheComponents.md`, `01-directives/use-cache.md`." The real paths are:

- `01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md`
- `01-app/03-api-reference/01-directives/use-cache.md`

Worse, the _content_ §3 cites mostly lives in **`01-app/01-getting-started/08-caching.md`**
(the Suspense error string, the `connection()` + `Math.random`/`Date.now`/`crypto` guidance),
**not** in `cacheComponents.md` (which is a terse config-flag reference and contains none of
those strings). An agent told to "verify against `cacheComponents.md`" will open it, not find
the error message, and lose trust in the doc.
**Fix:** point to the directory and the file that actually holds the guidance:

> Verify against the bundled docs — primarily `01-app/01-getting-started/08-caching.md`
> (the Suspense / `connection()` rules) and `01-app/03-api-reference/01-directives/use-cache.md`
> (the cache-key / pass-as-args rules) — before "fixing."

**A2 — There are two sibling error strings; name the other one so agents recognize it.** The
installed docs also emit **`Blocking data was accessed outside of Suspense`**
(`02-guides/public-static-pages.md:102`, `02-guides/instant-navigation.md:202`) for the
_await-before-Suspense_ case, distinct from the _uncached-data_ case the draft quotes. An
agent who hits "Blocking data…" and only memorized "Uncached data…" may not realize it's the
same family of fix. **Fix:** add a half-sentence — "(you may also see `Blocking data was
accessed outside of Suspense` — same family, same fix)."

**A3 — External-standard citation is fine.** Conventional Commits → `conventionalcommits.org/en/v1.0.0`
is the correct canonical URL. No WCAG/APCA claims appear in this doc, so nothing to police there.

**Net:** zero stale-model-memory framework errors. The only accuracy defects are the **doc
pathnames in §3**, which are load-bearing because the whole point of §3 is "go read the real
doc."

---

## 2. RIGHT-SIZED vs OVER-ENGINEERED

Mostly right-sized. Two flags:

**O1 — §4 (the §8 litmus) is too long for a DoD and duplicates the plan.** It's reproduced
almost word-for-word from `architecture-plan.md` §8 (lines 522–542) — I diffed them; only
cosmetic differences. The brief is explicit: _"Do not duplicate the architecture docs; POINT
to them."_ A seven-item checklist that fires "only when shipping a shared primitive" — which
the doc itself says is the _exception_, not the rule (Phases 3–4, second use onward per [D20])
— is a lot of column-inches in the one doc an agent reads on _every_ task. **Fix:** collapse
§4 to a 2–3 line pointer + the single most load-bearing line, e.g.:

> **Shipping a _shared_ primitive?** (rare — most work is per-project, which is _supposed_ to
> be specific.) Run the "don't reach up" litmus in [`../../architecture-plan.md`](../../architecture-plan.md) §8
> before merging: it renders on **generic tokens only** (`--brand-*`, `--font-face`,
> `--space-*`), never reaches up for a look, and its CSS Module declares its `@layer` `[D2][D12]`.
> Not a shared primitive? Skip it.

This keeps the trigger and the one-line essence; sends the full checklist to its source of
truth. Saves ~15 lines and removes a maintenance-drift liability (two copies of the same list).

**O2 — The closing branch-protection aside is borderline.** §7's "Branch protection requiring
`verify` is a GitHub-side setting; recommend it, don't assume it" is accurate and honest, but
it's process-config trivia in a _code_-DoD. It's one sentence, so not worth a fight — but if
trimming, it belongs in `git-and-pr-workflow.md` (which owns CI/PR mechanics), not here. Keep
only if it stays one sentence.

**Not over-engineered (defending the draft):** §3 Cache Components, the §2 table, and the §1
chain all earn their place — they directly help an agent ship code that passes the build. No
enterprise theater, no governance bloat. Good restraint overall.

---

## 3. CONSISTENCY

No contradictions with the 23 ADRs or the plan. Two **duplication / ownership** issues:

**C1 — §5 diff-review checklist duplicates `git-and-pr-workflow.md`, which owns it.** That
sibling already has the identical checklist as _its_ primary content:
`git-and-pr-workflow.md:124` — "No debug logs, no commented-out code, no unrelated changes in
the diff (`git diff --staged`)" — plus Conventional Commits (its §2) and the secrets rule.
The DoD restates all of it. The author flagged this as an open boundary question; my call:
**the DoD should keep a _one-line_ "diff is clean" gate that links out, not re-enumerate the
list.** A Definition of Done legitimately _references_ every gate, but it shouldn't be the
_authority_ on diff hygiene when a sibling is. **Fix:** compress §5 to:

> **Diff reviewed** — `git diff --staged` is clean: no debug logs / dead code / unrelated
> changes, no secrets, lockfile committed if deps changed, imports use `@/*`. Full rules:
> [`./git-and-pr-workflow.md`](./git-and-pr-workflow.md), [`./engineering-standards.md`](./engineering-standards.md).

Keep the **Sanity-token-vs-public-ID nuance** (§5 bullet 3) only if the sibling doesn't already
carry it — it's genuinely valuable and project-specific. (`engineering-standards.md:169` covers
the `NEXT_PUBLIC_*` boundary but not the "project ID + dataset are not secrets" framing, so a
one-liner here or there is fine — just don't state it in _both_.)

**C2 — The TypeGen row partly duplicates `git-and-pr-workflow.md`'s step table.** That sibling
has the same `pnpm --filter studio typegen` + `git diff --exit-code sanity.types.ts` step
(`git-and-pr-workflow.md:191`) _and_ a prose explainer (`:136–143`). The DoD table row is fine
to keep (it's part of the chain), but don't also write a second prose explainer here — point to
the sibling for the "why it drifts / how to fix" detail.

**C3 — `@/*` alias and "never hand-format" also live in `engineering-standards.md`.** Same
pattern: `engineering-standards.md:18` owns the `@/*` rule; the format-is-machine-enforced
framing is its line 7. These are fine as _one-line_ gate items in the DoD checklist, but the
DoD is now the third place each is stated. Consolidate to a link once §5 is compressed.

**Consistency wins (concede):** the `[D#]` and §8 anchors are all correct and the doc never
contradicts a decision — e.g. it correctly frames static-vs-dynamic as _component-level_ per
[D11], not via the removed `export const dynamic`. That's exactly the kind of stale-memory
trap it avoids.

---

## 4. AGENT-USEFULNESS

A cold agent _can_ follow this and ship cleaner code — the §1 chain is copy-pasteable and the
§2 "when it fails, you…" column is actionable. Three gaps:

**U1 — `lint:keys` "no-op until Phase 2" framing is correct but under-actionable.** The draft
says it "passes today." Confirmed: it's the stub from [D10]/[D17] Phase 0. But an agent landing
cold may wonder _why a no-op is in my Definition of Done._ **Fix:** one clause — "It's a stub
today (passes trivially); it's in the chain so the gate doesn't need re-plumbing when it goes
live in Phase 2 `[D10]`." That turns a confusing line into a teaching one. (Keep it in the
chain — it _is_ in CI, and DoD must mirror CI.)

**U2 — §1 chain uses `&&` line-continuations; give agents a paste-safe single block AND a
note on partial runs.** The chain is correct but if an agent's shell mangles the trailing `\ `
they'll get a cryptic failure. Minor, but consider noting: "Run the whole block; a mid-chain
failure short-circuits — fix and re-run from the top, don't cherry-pick steps." (The draft
_says_ "re-run the whole chain" in prose at §1 — good — just make sure the final-gate §7
checklist doesn't imply steps can be ticked independently.)

**U3 — §3's "If the build hangs (~50s)" is excellent and specific — keep it.** This is the kind
of concrete, experience-saving detail that makes a doc trustworthy. No change; calling it out as
a model for the rest.

**Missing nothing critical.** No vague "ensure quality" filler. The doc is actionable where it
counts.

---

## Recommended changes, prioritized

1. **(Accuracy, must-fix)** Correct the §3 doc paths and re-point to
   `01-app/01-getting-started/08-caching.md` — that's where the Suspense/`connection()` guidance
   actually lives, not `cacheComponents.md`. Add the `Blocking data…` sibling error string. [A1, A2]
2. **(Consistency, should-fix)** Compress §5 to a one-line "diff is clean" gate that links to
   `git-and-pr-workflow.md` (which owns the diff checklist) instead of re-enumerating it; keep
   only the project-specific Sanity-token nuance, and only if the sibling doesn't already. [C1, C3]
3. **(Right-sizing, should-fix)** Collapse §4 from a 7-item verbatim copy of architecture-plan
   §8 into a 3-line pointer + trigger; the brief says point, don't duplicate. [O1]
4. **(Polish)** Add the one-clause "why a no-op is in the chain" note to the `lint:keys` row; drop
   or one-line the branch-protection aside; don't re-explain TypeGen drift the sibling already
   explains. [U1, O2, C2]
