# QA report — #253 authored site default theme seed

Fresh adversarial QA, no prior context of the slice. Branch `qa/253`.
Round 1 against slice tip `d4c29ea`; round 2 (re-check) against the fix `9444ce5`.

## 1. Verdict

**PASS — the slice survives. D1 fixed and verified, D2 covered, R1 closed by the lead.**

| Round 1 finding                             | Status                                                           |
| ------------------------------------------- | ---------------------------------------------------------------- |
| D1 (MAJOR) featured card ≠ detail page seed | **FIXED** in `9444ce5`, verified by execution + mutation testing |
| D2 (MINOR) `colorValidation.ts` untested    | **CLOSED** — 7 cases added round 1, green                        |
| R1 (RISK) prod default unauthored           | **CLOSED** by the lead (authored + value-verified pre-merge)     |

Final gates, re-run against `9444ce5` (scoped per brief — the lead owns the full gate):

| Check                                                                                                                             | Exit  |
| --------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `vitest run src/sanity/lib src/components src/app` — 58 files, 852 tests                                                          | **0** |
| `vitest run src/sanity/lib src/components/theme studio/schemaTypes packages/oklch src/styles` — 57 files, 1723 passed / 2 skipped | **0** |
| `pnpm typecheck`                                                                                                                  | **0** |
| `pnpm format:check`                                                                                                               | **0** |
| `pnpm --filter studio run typegen` + `git diff --exit-code sanity.types.ts`                                                       | **0** |

Round 1's three red pins are **green, unweakened** — see §7. Nothing is outstanding for the
author. The residual risks I could not close are in §5 and §7.4; none block merge.

## 2. Defects (round 1 — all resolved; kept as the durable record)

### D1 (MAJOR) — a seedless entry's featured card wears the ENGINE fallback, its detail page wears the AUTHORED default

The required→optional flip on `entry.theme.color` (`studio/schemaTypes/documents/entry.ts:152`)
created a new reachable state — a themed entry with no seed. `ENTRY_DETAIL_QUERY` resolves that
state onto the site default (`src/sanity/lib/queries.ts:84`). `FEATURED_QUERY` was not given the
same rung: it projects a bare `theme { color }` (`src/sanity/lib/queries.ts:154`), and
`EntryCard` feeds it straight to `cardSwatches` (`src/components/entry/EntryCard.tsx:67`), which
is **total** over bad input — `null` collapses to the engine fallback palette.

Concrete reproducer (executed, groq-js):

```
dataset: siteSettings.theme.color = "#0ea5e9"   // a BLUE authored default
         entry { kind: "note", featuredRank: 1 } // no theme object

/qa-entry   (detail) → themeSeed "#0ea5e9"  → accent oklch(0.55 0.125 239)  ← blue, authored
/           (card)   → theme    null        → accent oklch(0.48 0.2   350)  ← PINK, isFallback=true
```

Same entry, two different themes — a pink plate on a blue page. The card's inline swatches
override the page theme it sits in, so this is wrong under any reading of the design.

**Why it is invisible today:** commit `3a7318a` retuned `FALLBACK_SEED` to the same pink the site
currently authors as its default. The two mechanisms are separate (the slice's own docs say so)
but their _values_ now coincide, so "wore the authored default" and "collapsed to the engine
safety net" are indistinguishable by eye. The moment the site default is authored to anything
else — the entire point of #253 — every seedless featured card silently de-syncs from its own
page.

**Pre-existing narrow form, materially widened:** a `now` entry can be featured (`FEATURED_QUERY`
takes any kind) and can never author a color (`forbiddenForNow`), so its card already hit the
engine fallback before this slice. That card's paint therefore _changed_ with this commit — from
the old slate blue to the new pink — with no authored intent behind it.

**Fix constraint the author should weigh, not a QA call:** the obvious fix is to give
`FEATURED_QUERY` the same `themeSeed` expression the detail query uses, so the two agree by
construction rather than by review. But `EntryCard` renders the raw seed string as visible meta
text (`EntryCard.tsx:44`: `[entry.stage, entry.theme?.color].filter(Boolean).join(" · ")`), so
resolving a default onto the card would newly print the default hex on every seedless card. That
is a design decision (owner's), not a mechanical one.

Tests written (fail first, currently RED — 3):
`src/sanity/lib/queries.test.ts` → `FEATURED_QUERY — the featured card's seed vs the entry page's seed (#253 QA)`.

### D2 (MINOR) — `colorValidation.ts` had no test file at all

`isThemeColorString` is now load-bearing in a new place — it is the only check between an
author's typo and `siteSettings.theme.color`, the one required seed every fallback chain lands
on. It shipped untested. Written now (7 cases, all green), including the coupling that matters
most: the check keys off a **failed parse**, not a value comparison, so authoring the fallback's
own pink is ordinary valid input. Had `isFallback` been value-based, the site default would have
been the one color the Studio refuses to publish.

### R1 (RISK — not a code defect) — release ordering is unverifiable from here

#253 requires the default seed to be authored in the prod dataset **before** the validators flip,
"so nothing renders unseeded in the gap". The `""`-passes rule in `isThemeColorString` means a
blank default publishes clean at the Studio layer, and D1's value-coincidence means an unauthored
default looks identical to an authored one on screen. I cannot verify the prod dataset from the
worktree. **Someone must confirm `siteSettings.theme.color` is authored on prod before merge** —
and confirm it by _value_, not by eye.

## 3. Tests written (round 1 — committed to `qa/253`)

> Counts and exit codes below are the **round-1** record, taken against the pre-fix tip `d4c29ea`.
> The current post-fix numbers are in §1; round 2's additions are in §7.5.

Vitest exit code after additions: **1** — the 3 D1 pins are red by design; everything else green.
`Test Files 1 failed | 56 passed (57)` · `Tests 3 failed | 1706 passed | 2 skipped (1711)`
(baseline before my additions: 1679 passed / 56 files → **+32 tests**).
`pnpm typecheck` → **0**. `pnpm format:check` → **0**.

**`src/sanity/lib/queries.test.ts`** — `themeSeed — hostile datasets degrade, never poison (#253 QA)` (7, green):

- no settings doc + seedless entry → null, not an error — both rungs traverse an empty `[0]`.
- no settings doc + **now** entry → null — the /now rung traverses null too.
- drifted non-object `theme` on settings → null, no throw (raw API write has no schema).
- drifted non-object `pageThemes` → a now entry still lands on the site default.
- empty-string **site default** stays `""` — presence-gating reaches the LAST rung too.
- drifted NUMBER seed passes through unchanged — pins that the runtime contract is _wider_ than
  the generated `string | null` type, which is why `PageTheme` takes `unknown`.
- **multiple siteSettings docs** → both independent `[0]` subqueries read the SAME doc (a now
  entry can't wear doc A's override over doc B's default).

**`src/sanity/lib/queries.test.ts`** — `FEATURED_QUERY … (#253 QA)` (4; 1 green, 3 RED = D1):

- seedless featured entry's detail page wears the authored default (green — pins the contract).
- its card resolves the same seed its detail page does (**RED**).
- its card does not fall back to the engine palette (**RED**).
- a featured **now** card does not fall back to the engine palette (**RED**).

**`src/components/theme/sitePageSeed.test.ts`** — `resolver edges (#253 QA)` (5, green):

- `theme: {}` (color absent, not null) → null · explicitly-`undefined` override → default ·
  `theme.color: null` → null · settings doc drifted to a non-object → resolves null, never throws ·
  empty-string site default stays `""` (symmetry with the `""`-override case at the last rung).

**`src/components/theme/sitePageSeed.test.ts`** — `/now page seed vs now-entry seed — cross-surface agreement (#253 QA)` (7 `it.each`, green):
The invariant the two-rung chain exists to buy. `/now` resolves via JS `??` over
`SITE_SETTINGS_QUERY`; a now entry resolves via GROQ `coalesce`/`select` — different vocabularies
(JS: null AND undefined; GROQ: null only) over different projections. Each shape runs through
**both real code paths** (`SITE_SETTINGS_QUERY` executed with groq-js and fed to the resolver's
own fetch) and asserts equality: /now override authored · no override · `pageThemes` absent ·
explicit null override · `""` override · neither override nor default · no settings doc.
**They agree in all seven.** A future edit to either rung that de-syncs the surfaces now fails
here rather than on the deployed site.

**`studio/schemaTypes/shared/colorValidation.test.ts`** — NEW FILE (7, green): see D2. Reads the
fallback seed through the engine's **public** surface (`buildTokenSet(bad).meta.seed`) rather than
deep-importing `packages/oklch/src/seed`, so the test doesn't reach past the published contract.

## 4. Probed and found sound (round 1)

- **Golden-fixture regen claim — VERIFIED, not taken on trust.** Diffed every case key against
  `main`: `blue`/`violet`/`crimson`/`too-light`/`achromatic`/`achromatic-p3`/`untinted-neutrals`
  are bit-for-bit identical; only `fallback` changed. The consolidation genuinely didn't perturb
  the engine.
- **Seed consolidation is complete.** Exactly two importers (`palette.ts:56`, `harmony.ts:19`);
  zero residual hand-mirrored copies repo-wide.
- **`seed.ts` is isomorphic** — no `server-only`/`client-only`, no `node:` imports, no
  `process.`/`require`. Correctly kept _internal_ (not re-exported from `index.ts`), matching the
  "safety-net-only" framing.
- **`isFallback` is parse-derived**, not value-derived (`palette.ts:454`, `harmony.ts:69`) — so
  the fallback/default value collision is inert at the validator.
- **`sanity.types.ts` is honest.** Ran `pnpm --filter studio run typegen`; `git diff --exit-code
sanity.types.ts` clean. The committed types are what typegen produces.
- **`requiredForThemedKind` is cleanly deleted** — no dangling imports or references; the only
  survivors are three deliberate "the old floor is retired" comments.
- **Stega coverage holds.** `siteSettings.theme` rides the existing `theme` ancestor rule
  (`stega.ts:49`); the top-level `themeSeed` alias is a `coalesce`/`select` over subqueries, so
  either it carries no source mapping or it maps back to `theme.color`/`pageThemes.now` — both
  ancestor-excluded. No hole either way.
- **`SitePageKey` still derives correctly** through the new result type (`typecheck` exit 0); the
  `keyof`-the-generated-type guard survives the required→optional flip.
- **`color.css` byte-receipt passes in both vitest projects** (jsdom + node, `test.projects` with
  `extends: true`) — the regenerated baked set matches live `buildTokenSet(undefined)`.
- **The deliberate `""` design decisions behave as documented** at every rung, on both the GROQ
  and the JS path — pinned rather than flagged, per brief.

## 5. Coverage I could not reach (round 1 — updated in §7.6)

- **Sanity's runtime `required()` semantics.** The schema suite is spy-Rule based: it proves
  `required`/`custom` _attach_, not what they _do_. Whether `.required()` on the `theme` **object**
  rejects an object whose sub-fields are all blank, and whether it rejects `""` on `theme.color`,
  needs a Studio runtime the suite doesn't have. This is the gap R1 lives in — `isThemeColorString`
  deliberately passes `""`, so `required()` is the _only_ thing stopping a blank default, and
  nothing in the repo tests it.
- **The custom validator's identity.** `calledRules(color)` proves _a_ `custom` is attached, not
  that it is `isThemeColorString`. A wrong-but-present validator would pass the schema suite.
- **No rendered/browser pass.** Per brief I ran scoped vitest only — no `pnpm build`, no dev
  server, no full gate. D1 is proven at the data+engine layer (resolved seeds and solved accents),
  not by a painted screenshot. Given D1 is a _visual_ divergence gated on an authored value, a
  browser check against a non-pink default is worth doing once the fix lands.
- **The prod dataset** (R1) — out of reach and out of scope from the worktree.

## 6. Re-check owed (round 1)

D1 was the author's to fix (including the `EntryCard` meta-text design call, the owner's). The 3
red tests were the acceptance criteria — green without weakening. **Discharged in §7.**

---

## 7. Round 2 — re-check of the D1 fix (`9444ce5`)

`FEATURED_QUERY` now resolves the same two-rung `themeSeed` expression as `ENTRY_DETAIL_QUERY`;
`EntryCard` reads the resolved seed for both the plate swatches and the mono readout. Re-checked
adversarially against the four questions put to me.

### 7.1 Are the 3 pins green, and do they still assert what they asserted?

**Yes — and one is now stronger.** The edits are a mechanical projection rename
(`theme.color` → `themeSeed`) forced by the query's new shape. Assertion-by-assertion:

- `expect(featured[0].themeSeed).toBe(detail.themeSeed)` — was
  `expect(featured[0].theme?.color ?? null).toBe(...)`. Same meaning, and **stricter**: the round-1
  form coerced `undefined` → `null` before comparing, this one cannot.
- `expect(buildTokenSet(featured[0].themeSeed).meta.isFallback).toBe(false)` ×2 — byte-identical
  intent, unchanged operator, unchanged expected value.
- The now-card pin **gained** `expect(featured[0].themeSeed).toBe("#7c3aed")` — it no longer
  merely proves "not the fallback" but pins the exact authored `/now` seed.

One test was deleted — `"survives an entirely absent theme (a featured now-entry carries none)"`.
Legitimate, not a weakening: `theme` is gone from the prop shape, so "absent theme" is no longer a
representable state; `themeSeed: null` covers the same ground and is retained.

**I did not take "they pass" on trust** — see 7.2, where I reintroduced the original defect and
confirmed the pins actually bite.

### 7.2 Does the drift guard work? (mutation-tested)

The expression is now hand-copied into two queries. That is the right trade (GROQ has no
shared-fragment primitive here) but it makes **drift the standing risk** — and a drift would again
be invisible while the fallback and the default share a value. I guarded it twice and then
**proved both guards fail on drift**, because a guard that cannot fail is worthless:

Mutant: strip the site-default rung from `FEATURED_QUERY` only — i.e. reintroduce D1 verbatim.
→ **6 tests fail**, including the byte-identical pin and 3 executed-matrix cases. Reverted; working
tree verified clean via `git diff --exit-code`.

Both guards are load-bearing and neither is redundant:

- **By execution** (10 `it.each` shapes) — the real contract. Catches a rewrite that keeps the text
  plausible but changes the semantics, which a string pin cannot see.
- **By text** (byte-identical extraction) — catches a divergence in a dataset shape nobody thought
  to enumerate, which the matrix cannot see.

### 7.3 Did the EntryCard/readout change open new holes?

No. Probed:

- **Hostile seed → inline style: closed.** The readout is now raw text, but the plate's custom
  properties are baked through `buildTokenSet`, so `</style><script>…` collapses to the fallback
  palette and can never reach the `style` attribute. Pinned: every swatch matches
  `light-dark(oklch(…), oklch(…))` and contains no `<`.
- **Hostile seed → readout text: safe.** React escapes text children; the seed is interpolated as a
  string, not `dangerouslySetInnerHTML`. No injection path.
- **Null chain: intact.** `themeSeed: null` → `filter(Boolean)` drops it → meta row omitted
  entirely when nothing is left. `""` likewise. Author's tests cover both; they pass.
- **Drifted non-string seed: total.** Round 1 pinned that GROQ passes a number through `themeSeed`
  unchanged (the runtime contract is wider than the generated `string | null`). It now reaches the
  readout too, so I pinned `cardSwatches` never throws on `12345 / true / {} / []`.
- **The now-card path: correct.** A featured `now` now resolves the `/now` seed, matching its own
  detail page — it previously always hit the fallback. Pinned by value.
- **No consumer broke.** `EntryCard`'s only real consumer is `src/app/page.tsx`; `/browse`
  deliberately renders no themed card, so the prop-shape change has no second caller. Confirmed by
  grep and a green `typecheck`.
- **TypeGen is honest.** `FEATURED_QUERY_RESULT` correctly narrowed `theme: {color} | null` →
  `themeSeed: string | null`; regenerated types match the committed file.

### 7.4 Observations — not defects, no action asked

- **`FEATURED_QUERY` now runs 2 `siteSettings` subqueries per featured card** (2N total) where it
  previously ran none. Correctness is unaffected and at garden scale this is noise, but it is a new
  per-row cost on the LCP-critical front door. Flagging for the record, not asking for a change.
- **The meta readout has no `.trim()` guard**, unlike the title on the line above it
  (`EntryCard.tsx:44`). A whitespace-only seed would render `"sketch ·    "`. Not reachable through
  the Studio — `isThemeColorString` rejects `"   "` (pinned in `colorValidation.test.ts`) — so this
  needs a raw API write to hit, and it is cosmetic. Pre-existing, untouched by the fix.

### 7.5 Tests added in round 2 (all green)

`src/sanity/lib/queries.test.ts`:

- `themeSeed — the copied expression must not drift between the two queries (#253 QA)` — 10
  executed shapes (own seed · seedless · now with/without override · now with a
  validator-bypassing color · `""` seed · null color · no settings doc · drifted non-object theme ·
  **kindless** entry) + the byte-identical text pin.
- `EntryCard readout — hostile resolved seeds (#253 QA)` — 3 cases (hostile seed cannot reach the
  inline style · collapses to fallback rather than throwing · total over drifted non-strings).

### 7.6 Coverage still unreached

Unchanged from §5, and none of it is blocking:

- **Sanity's runtime `required()` semantics** — still spy-Rule only. R1's mitigation is now
  procedural (the lead value-verified the prod default), not tested. If a future slice blanks that
  field via the API, nothing in the suite catches it.
- **No browser pass.** D1's fix is proven at the data + engine layer (resolved seeds, solved
  accents, mutation-tested guards), not by a painted screenshot. The one thing a browser would add
  that I could not: confirming the featured plate and its detail page look identical against a
  **non-pink** default. Worth one pass at the owner's next rendered-surface review — the values now
  agree by construction, so I rate this low risk.
