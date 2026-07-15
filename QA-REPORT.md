# QA report — #253 authored site default theme seed

Fresh adversarial QA, no prior context of the slice. Branch `qa/253`, slice tip `d4c29ea`.

## 1. Verdict

**Defects found — 1 major, 1 minor, plus release-order risk the code cannot settle.**

The seed-resolution chain itself is sound: I could not find a dataset shape that makes it throw,
poison, or de-sync `/now` from a `now` entry. The defect is in a surface the slice did **not**
touch but whose behaviour it silently changed.

## 2. Defects

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

## 3. Tests written (committed to `qa/253`)

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

## 4. Probed and found sound

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

## 5. Coverage I could not reach

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

## 6. Re-check owed

D1 is the author's to fix (including the `EntryCard` meta-text design call, which is the owner's).
The 3 red tests in `FEATURED_QUERY — the featured card's seed vs the entry page's seed (#253 QA)`
are the acceptance criteria — they must go green without being weakened. I re-check after the fix.
