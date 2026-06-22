# Round-2 Debate — Testing

Devil's-advocate review of [`../round-1-drafts/testing.md`](../round-1-drafts/testing.md).
Verified against the installed stack (`package.json`, `vitest.config.ts`), the bundled Next
16.2.9 doc (`node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`), and
[`../../decisions.md`](../../decisions.md).

**Verdict:** Strong draft. The load-bearing claims (async-RSC wall, co-location blessing,
dual-env `projects`, the yellow/cyan harness as Phase-1 exit gate) are all accurate and
correctly sourced. The issues below are mostly precision bugs and a couple of right-sizing
trims — none fatal, but several would cause an agent to write wrong config or cite the wrong
phase. Findings are ordered by severity.

---

## A. ACCURACY

### A1 — `resolve: { tsconfigPaths: true }` is repeated from the live config but is NOT how the bundled Next doc sets up path aliases (BLOCKING for the snippet)

**Lines 164, 166 (the `vitest.config.ts` snippet).** The draft's `projects` snippet copies
`resolve: { tsconfigPaths: true }` from the _current_ committed `vitest.config.ts`. That
key is a **non-standard Vite/Vitest option** — `resolve.tsconfigPaths` is not a documented
Vite `resolve` field. The version-matched Next doc
(`01-app/02-guides/testing/vitest.md`, lines 65–76) sets up the `@/*` alias via the
**`vite-tsconfig-paths` plugin** (`plugins: [tsconfigPaths(), react()]`), not a `resolve`
flag. The repo's own global guide also references `vite-tsconfig-paths` as the (now
allegedly redundant) mechanism.

This matters twice over:

1. The draft _inherits_ a possibly-wrong key from the live config and then propagates it
   into a snippet labelled "intended structure" — doubling down on an unverified claim.
2. The whole premise of `extends: true` is that the child projects inherit root `plugins`
   and `resolve`. If the root `resolve.tsconfigPaths` is a no-op, the `@/*` alias may not
   resolve in either project and _every_ aliased import in tests silently breaks — exactly
   the failure mode the engine suite (which lives at `@/lib/oklch` and is imported by
   alias) would hit first.

**Fix:** Don't assert the alias mechanism from the live config. Either (a) drop
`resolve.tsconfigPaths` from the snippet and use the bundled-doc-blessed
`plugins: [tsconfigPaths(), react()]` with an explicit "confirm the alias actually
resolves in a `node`-env test before relying on it" note, or (b) add a one-line caveat that
`resolve.tsconfigPaths` is the repo's current shape but is **unverified against Vite/Vitest
docs** and the agent must confirm aliases resolve in _both_ projects when wiring the split.
Given the doc's own "stack is current, not remembered" banner, leaning on the bundled-doc
plugin form is the safer default.

### A2 — "Vite 7+ supports this natively" is asserted nowhere the agent can check

Related to A1: the live config's comment claims Vite 7 honours tsconfig paths natively. The
draft repeats the _effect_ of that claim by keeping the key. If A1's fix keeps
`resolve.tsconfigPaths`, the doc should at least point the agent at where to verify it
(vitejs.dev resolve docs) rather than treating it as settled — it currently reads as
settled.

### A3 — jsdom major version is stated as "jsdom" generically but the harness banner implies currency — minor

**Line 19 / TL;DR.** Fine as written, but note the installed `jsdom` is `^29.1.1` while the
bundled Next doc's manual-setup omits a version. No error here; flagging only because the
draft's banner promises version-specificity ("jsdom (single env today)") and an agent might
expect a pinned major. No change required.

### A4 — RTL version claim "16" is correct ✅

**Line 18.** `@testing-library/react` is `^16.3.2` in `package.json`. Accurate. Concede.

### A5 — Vitest 4 / `workspace` deprecation framing is correct ✅

**Lines 17, 154–155, 250.** `vitest` is `^4.1.9`; `test.projects` replacing the deprecated
`workspace` field (deprecated since 3.2) is accurate and correctly hedged with the
"confirm against vitest.dev" note (line 198–200). Good. The one nit: the draft says
`projects` "is the current API" and cites `vitest.dev/guide/projects` — keep that hedge, it
is the right call given no installed-doc copy exists to diff against.

### A6 — Async-RSC quote is verbatim-accurate ✅

**Lines 130–133.** The block quote matches the bundled doc (line 9) essentially verbatim
("Since `async` Server Components are new… we recommend using **E2E tests** for `async`
components"). Correctly attributed to the version-matched path. This is the doc's strongest
sourcing. Concede fully.

### A7 — Co-location quote is accurate but slightly trimmed ✅ (minor)

**Line 113.** Draft quotes _"test files can also be colocated inside the `app` router."_ The
bundled doc (line 161) reads: _"The example above uses the common `__tests__` convention,
but test files can also be colocated inside the `app` router."_ The trim is fair and
preserves meaning. No change needed, though quoting the contrast with `__tests__` would
strengthen the "don't add new files under `tests/unit/`" rule on line 119.

---

## B. RIGHT-SIZED vs OVER-ENGINEERED

### B1 — The full pre-push chain is duplicated from the DoD doc it points to (line 38–44)

The draft prints the entire `pnpm lint && lint:css && lint:keys && format:check &&
typecheck && test && build` chain _and then_ links
[`./definition-of-done.md`](./definition-of-done.md) as the canonical home of "the full
pre-commit gate." That is the duplication the house style warns against — two copies of the
gate will drift. For a testing doc, the agent needs to know "tests run via `pnpm test`, and
`pnpm test` alone is not the whole PR gate — see the DoD." It does **not** need the full
seven-command chain restated here.

**Fix:** Cut the full chain block; replace with one sentence: "`pnpm test` is only the test
slice of the PR gate — run the full chain from
[`./definition-of-done.md`](./definition-of-done.md) before pushing." Keep the two `pnpm
test` / `pnpm test:watch` commands (those are genuinely this doc's job).

### B2 — Playwright section is appropriately deferred but the "own CI step/job" detail is premature theater (lines 240–241)

Specifying a separate CI cache/job for Playwright _before Playwright is installed and before
Phase 3_ is exactly the "enterprise process for its own sake" the brief says to cut. It's a
real concern, but it belongs in the DoD/CI doc at the time E2E lands, not pre-committed here
for a solo repo two phases early. The "one E2E for the primary flow" rule and the
auto-waiting/no-sleeps locator guidance _are_ worth keeping (they're cheap, durable, and
steer an agent correctly).

**Fix:** Keep lines 235–239 (the locator/best-practice bullets). Cut or compress line
240–241 to a single deferred note: "When E2E lands, give it its own CI step so browser
installs don't slow the unit gate — detail that in the CI doc then, not now."

### B3 — "import them anyway for clarity" partly fights `globals: true` (lines 102–105) — keep, but tighten

The advice to import `describe/it/expect` despite `globals: true` "for clarity" is a
defensible house preference (the legacy test does it), but as written it reads like
busywork. It earns its place only because it matches the existing file. Fine to keep — just
frame it as "match the existing file's explicit-import style" rather than an abstract
clarity argument, so an agent knows it's a consistency rule, not a correctness one.

---

## C. CONSISTENCY (vs decisions / plan / siblings)

### C1 — Phase mismatch: resolver/key tests are Phase 2, but the contrast test placement and the harness phase need to be airtight (lines 61–64, 218–226)

Cross-checked against [D17]/[D18]/[D19]:

- Line 61 puts "Resolvers / `keys.ts` lookups / index queries" at **Phase 2** — matches D18
  ("resolver/cardSwatches/index-query tests in Phase 2"). ✅
- Line 64 / line 234 put "one integration/E2E of the primary flow" at **Phase 3** — matches
  D18/D19/D17 (first slice ships in Phase 3, "One integration/E2E test"). ✅
- The visual contrast harness at **Phase 1** (lines 218–226) matches D17 ("visual harness
  over 3–4 hue-spanning colors as the **exit criterion**") and D19 ("accessibility/contrast
  assertions folded into Phase 1's engine harness"). ✅

**No contradiction** — concede the phasing is correct. One precision nit: D17's harness says
"3–4 hue-spanning colors"; the draft says "3–4 brand colours spanning the hue wheel — and it
MUST include a yellow and a cyan." The yellow/cyan mandate is the draft's _own_ addition (a
reasonable engineering inference from D4's "equal ΔL ≠ equal contrast across hues"), **not**
verbatim in D17. That's good editorializing, but the draft presents it with the same `[D17]`
citation weight as the count. **Fix:** make clear the yellow/cyan requirement is an
engineering derivation _from_ D4's ΔL-≠-contrast principle, not a literal D17 clause — e.g.
"D17 mandates 3–4 hue-spanning colours; we additionally pin yellow and cyan because D4."

### C2 — The "Phase 0.5 / walking skeleton" is invisible here, and `page.test.tsx` migration advice may collide with it (lines 117–119)

D17 introduces **Phase 0.5** (stub `ProjectScope`, hardcoded palette, thin `/work/<slug>`
route). The draft never mentions Phase 0.5 and tells the agent to migrate
`tests/unit/page.test.tsx` to co-located "as Phase 1+ work touches that surface." Since the
first co-locatable surface work is arguably Phase 0.5 (the skeleton route/component), the
"Phase 1+" framing is slightly off and could leave the legacy file orphaned through 0.5.

**Fix:** Change "Phase 1+" to "the next phase that touches that surface (0.5 onward)" so the
migration trigger isn't anchored to a phase number that skips the skeleton.

### C3 — D9 three-layer defense is under-cited (line 63, 211)

The draft cites [D9] for "bad-input → safe fallback, never throw," which is correct, but D9
is a **three-layer** defense (defensive engine + Sanity author-time validation +
`unstable_catchError` backstop). The testing doc only tests layer 1 (the engine fallback).
That's fine — testing layer 1 is this doc's scope — but an agent reading "never throws ([D9])"
might assume D9 is fully satisfied by the engine test. **Fix (optional, low priority):** add
a half-sentence: "the engine test covers D9 layer 1; the Sanity-validation and
`unstable_catchError` layers are tested where they live (Phase 2 / Phase 3)."

### C4 — Sibling links to not-yet-existing files are correct per house style ✅

**Lines 43, 44, 213.** `./definition-of-done.md`, `./git-and-pr-workflow.md`,
`./accessibility-and-performance.md` don't exist yet but are authored in parallel — linking
them now is correct per the brief's house style. The author already flagged this. Concede;
just confirm final filenames in the synthesis round (the author's own caveat #2).

### C5 — No duplication of architecture internals ✅

The doc consistently _points_ to `../architecture-plan.md` §3.2 and the decisions rather
than re-explaining the OKLCH engine's internals. The "Engine contract" section asserts
_test obligations_ (determinism, contrast-in-both-schemes, gamut-first, never-throws)
without redescribing how the engine works. This is exactly the "how we work, not what the
system is" line. Strong. Concede.

---

## D. AGENT-USEFULNESS

### D1 — The `include` split for the node project is presented as settled, but the author flagged it as the open question — surface that tension in the doc, not just the handoff note (lines 184–185)

The draft scopes the `node` project to `include: ["src/lib/oklch/**/*.test.ts"]` while
leaving `jsdom` broad (no `include`). The author's handoff correctly identifies this as a
judgment call. But a cold agent reading the snippet sees a confident `include` and a comment
("Keep the jsdom project broad") with **no explicit-include on jsdom** — which means the
engine's `*.test.ts` files run under **both** projects (correct, that's the goal) but _all
other_ tests run under jsdom only (also correct). That actually works. The real risk: if the
agent later adds a `node`-only test outside `src/lib/oklch`, the broad jsdom project will
_also_ pick it up and run it in the wrong env.

**Fix:** Add one inline comment to the snippet making the invariant explicit: "jsdom is
intentionally broad and will run everything _except_ what its own `exclude` removes; only the
engine glob is dual-run. If you ever need a node-only test outside the engine, give jsdom an
explicit `exclude` for it." This converts a latent footgun into a documented contract.

### D2 — "Don't unit-test async RSCs — route to Playwright" is actionable, but the agent has no Phase-1/2 fallback for testing async logic before Playwright exists (line 23, 135)

Playwright doesn't arrive until Phase 3. An agent in Phase 1/2 who writes an async RSC (e.g.
a GROQ-fetching server component) is told "don't unit-test it, use Playwright" — but
Playwright isn't installed yet. The doc leaves a gap: what does the agent do _in the
meantime_?

**Fix:** Add a sentence: "Until Playwright lands (Phase 3), extract the _testable_ logic out
of the async RSC — the GROQ transform, the resolver, the fallback selection — into a pure
function in `src/lib` or `src/sanity/lib` and unit-test _that_. The async shell stays
untested until E2E exists." This is consistent with the draft's own "test _your_ transform
of their output" rule (line 70) and gives the agent a concrete move instead of a dead end.

### D3 — `getByTestId` "last resort" is good, but the engine/harness has no DOM roles — the agent needs to know which query strategy applies to the visual harness (lines 79–85)

The RTL query priority is sound for components. But the Phase-1 visual harness asserts
_numeric contrast values_, not roles/text. An agent might try to force `getByRole` onto a
swatch grid. **Fix:** One line in the harness section clarifying that the harness asserts
computed colour/contrast values (read from the rendered styles or the engine output
directly), _not_ via RTL semantic queries — the RTL priority list governs component tests,
not the engine harness.

### D4 — Missing: how to actually run a single project / filter by name (low priority but high utility)

The "Run it" section gives `pnpm test` and `pnpm test:watch`. Once `projects` lands, an
agent debugging an isomorphism failure will want to run _just_ the `node` project. **Fix
(nice-to-have):** add, in or near the dual-env section, the filter command:
`pnpm test --project node` (verify exact flag against vitest.dev when wiring). Saves the
agent a doc lookup mid-debug.

---

## Summary of required changes (priority order)

1. **A1 (blocking for the snippet):** Don't propagate `resolve: { tsconfigPaths: true }`
   into the `projects` snippet as settled config — it's unverified against Vite/Vitest docs
   and the bundled Next doc uses the `vite-tsconfig-paths` _plugin_ instead. Either switch to
   the plugin form or add an explicit "confirm aliases resolve in both projects" caveat.
2. **B1:** Cut the duplicated seven-command pre-push chain (lines 38–44); replace with a
   one-line pointer to `./definition-of-done.md`.
3. **C1:** Attribute the yellow/cyan mandate to a D4 derivation, not to D17 verbatim (D17
   only says "3–4 hue-spanning").
4. **D1 / D2:** Make the jsdom-broad/node-narrow invariant explicit in the snippet (latent
   env footgun), and give Phase-1/2 agents a concrete fallback for async-RSC logic
   (extract-and-unit-test) since Playwright doesn't exist until Phase 3.
5. **Minor:** B2 (trim premature Playwright CI-job detail), C2 (Phase 0.5 migration
   trigger), C3 (D9 layer scoping), D3/D4 (harness query clarification + `--project` filter).

**Conceded as correct:** async-RSC quote and sourcing (A6), co-location blessing (A7),
Vitest-4/`workspace`-deprecation framing (A5), RTL version (A4), all phase placements
(C1 counts/E2E/harness — C5), no architecture duplication (C5), parallel sibling links (C4).
