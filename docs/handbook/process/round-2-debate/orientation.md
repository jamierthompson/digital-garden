# Round-2 Debate — Orientation (devil's-advocate review)

Target: `../round-1-drafts/orientation.md`. Reviewed in full against the installed stack
(Next **16.2.9** / React **19.2.4**), the bundled docs at `node_modules/next/dist/docs/`,
`../../../decisions.md` (D1–D23), `../../../architecture-plan.md`, `../../../build-phases.md`,
`ci.yml`, `eslint.config.mjs`, `package.json`, and the actual `src/` tree.

**Verdict up front:** this is a strong, correctly-scoped pointer doc. Every framework claim I
spot-checked is true for the _installed_ version (no stale model memory). It is right-sized — it
points instead of duplicating, and the duplication it does keep (stack table) is defensible. The
issues below are real but mostly surgical: one factual overclaim about the CI gate, two link/path
hazards, and a few "earns-its-place" trims. Nothing requires a structural rewrite.

---

## 1. ACCURACY — framework claims vs. installed Next 16.2.9 / React 19.2.4

I verified each model-breaking claim against the bundled docs. **All five golden-rule framework
facts hold.** Citations below are the files that confirm them.

| Draft claim (line)                                                                                    | Verified? | Source                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Request APIs async: `cookies()`/`headers()`/`draftMode()`/`params`/`searchParams` are awaitable (L82) | ✅        | `cookies.md` ("async function", `await cookies()`); `draft-mode.md` ("async function"); `page.md` (`params: Promise<…>`, `await params`)                                                                                                   |
| `proxy.ts` replaces `middleware.ts`, Node-only, setting `runtime` **throws** (L84)                    | ✅ exact  | `…/file-conventions/proxy.md` L223: "The `runtime` config option is not available in Proxy files. Setting the `runtime` config option in Proxy will throw an error." Changelog: `v16.0.0 — Middleware is deprecated and renamed to Proxy.` |
| Uncached data outside `<Suspense>` is a build-time hard error (L83)                                   | ✅        | `migrating-to-cache-components.md` L53/L57: dev+build raise an error; runtime data access is directed to wrap in `<Suspense>`                                                                                                              |
| `@layer` trap — Next does not auto-layer CSS Modules; unlayered outranks every `@layer` (L85)         | ✅        | matches D12 (itself "verified against `…/11-css.md`")                                                                                                                                                                                      |
| Literal dynamic imports per key (L86)                                                                 | ✅        | matches D21                                                                                                                                                                                                                                |

### A1 — (MUST FIX, factual overclaim) "this is exactly what CI runs, in order" is not true

Line 107–110 presents:

```bash
pnpm lint && pnpm lint:css && pnpm lint:keys && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
```

and calls it "exactly what CI runs, in order." It is **not** exact. `ci.yml` runs, between `test`
and `build`, two more steps:

```yaml
- run: pnpm test
- run: pnpm --filter studio typegen
- run: git diff --exit-code sanity.types.ts
- run: pnpm build
```

The draft relegates typegen to a _conditional_ step 7 ("If you touched the Studio schema…"), but in
CI it runs **unconditionally and before `build`** — an agent who only touched app code can still trip
`git diff --exit-code sanity.types.ts` if `sanity.types.ts` is stale for any reason. So the
single-line "this is exactly what CI runs" is misleading on two counts: order (typegen+diff sit
before build) and conditionality (CI doesn't gate it on "did you touch the schema").

**Fix:** either (a) make the inline chain match CI literally —

```bash
pnpm lint && pnpm lint:css && pnpm lint:keys && pnpm format:check && pnpm typecheck && pnpm test \
  && pnpm --filter studio typegen && git diff --exit-code sanity.types.ts && pnpm build
```

— and soften step 7 to "commit the regenerated `sanity.types.ts`," or (b) keep the trimmed chain but
change the prose from "exactly what CI runs, in order" to "the core gate CI runs (CI additionally
regenerates and git-diffs `sanity.types.ts` before `build` — see step 7)." Don't claim "exactly"
while omitting two steps.

### A2 — (NIT, precision) "`export const dynamic` / `force-static` are removed" (L83)

The bundled `migrating-to-cache-components.md` frames these as **replaced / "No longer needed"** under
`cacheComponents` (L13: route-segment configs "are replaced by `use cache` and `cacheLife`"), not as
syntactically _removed from the parser_. D11 uses the same "removed" shorthand, and the brief lists it
as ground truth, so this is **acceptable as-is** — but a one-word hedge ("no longer apply" or "are
inert") would be more precise and still short. Low priority; flagging only because the doc's own
thesis is "verify against the bundled docs, your memory is stale," so it should model that precision.

### A3 — (verify, not in this doc's scope but worth a pointer) `unstable_catchError` is a Client API

The draft doesn't mention `unstable_catchError` (good — that's D9 / standards territory), but note for
downstream authors: the bundled `catchError.md` L19 says it "can be called from Client Components,"
and imports from `next/error`. D9 prescribes it wrapping `ProjectScope` (a server component). That
server/client nuance is a real thing to nail down in `security-and-ops.md` / engineering-standards,
**not here**. No change to orientation required; logged so it isn't lost.

### A4 — external-standard claims are correctly attributed

"Conventional Commits" (L93) and the APCA/WCAG framing referenced via the table (L133) are stated as
external standards, consistent with the brief's accuracy bar. The draft does not over-claim WCAG/APCA
specifics here (it defers them to `accessibility-and-performance.md`), which is the right call. No issue.

---

## 2. RIGHT-SIZED vs. OVER-ENGINEERED

Broadly right-sized. The doc is a map, not a manual, and it resists re-explaining the architecture.
A few items to weigh:

### R1 — (KEEP, with the author) The stack table (L15–24) earns its place — but trim one cell

The author flagged this for debate. **Keep it.** An agent landing cold in the handbook should not have
to leave to learn "no Tailwind, Studio is standalone." The cost is low (10 rows) and the payoff is high.
BUT: the "Lint / format" row (L23) leaks tooling detail (`eslint-plugin-boundaries`) that belongs in
`engineering-standards.md`, and the "Testing" row duplicates what `testing.md` owns. Recommend trimming
those two rows to the _decision_ not the _tooling_ ("ESLint + Prettier; Vitest + RTL") and letting the
sibling docs carry specifics. Net: table stays, two cells get lighter.

### R2 — (TRIM) The mental-model section risks re-explaining the architecture (L62–72)

The brief is explicit: "Do not duplicate the architecture docs; POINT to them." Bullets 3 and 4 are
dense enough to read as _summaries_ rather than _pointers_ — e.g. bullet 3 restates D3/D4/D5/D6/D9
("bakes contrast-solved, gamut-mapped `oklch()` literals server-side… scheme-aware… defensive — never
throws") and bullet 4 restates the entire `ProjectScope` contract from D11 Axis A. That's helpful
orientation, but it's a maintenance liability: when the engine signature or ProjectScope caching detail
changes, this prose silently goes stale while §3.2 / D11 are the real source of truth.

**Recommendation:** keep the _names_ and the _one-line "what it is"_ per keystone (that's genuine
orientation), but cut the implementation clauses down to the cited anchor. E.g. bullet 3 →
"**The OKLCH engine** (§3.2 [D3–D6, D9]) — a pure, isomorphic `(brandColor, scheme) → tokenSet` that
bakes literals server-side and never throws. Read §3.2 before building against it." Drop the
binary-search / `light-dark()` / gamut-map specifics — they're one click away and they rot here.
This is the single biggest "right-size" win available.

### R3 — (KEEP) The "Lands in later phases" list (L57–58) is genuinely useful

Telling an agent that empty/absent dirs (`src/lib/oklch/`, `src/projects/<slug>/`, the `keys.ts`
contracts) are _already boundary-guarded_ prevents the classic "this folder doesn't exist, I'll put it
somewhere else" failure. This earns its place. No change.

### R4 — (no enterprise theater found)

I looked for governance padding (CoC, SLAs, contributor process, sign-off ceremonies) per the brief.
**None present.** The PR/branch/commit rules (L92–96) are the owner's binding conventions, not theater,
and they're stated as one-liners with the detail delegated to `git-and-pr-workflow.md` /
`definition-of-done.md`. Correctly right-sized.

---

## 3. CONSISTENCY — vs. the 23 decisions, the plan, and siblings

No contradictions with D1–D23 found. Spot-checks that passed:

- L17 "Cache Components on app-wide [D11]" ✅ (D11 tied decision; build-phases Phase 0 marks it done).
- L21 standalone Studio [D23] ✅ exact.
- L50 `breakpoints.ts` "NOT :root vars — invalid in @media [D22]" ✅ exact to D22.
- L66 "projects → shared, never back; never project → project … lint-enforced" ✅ matches
  `eslint.config.mjs` boundary rules and D14/D20.
- L68 "`--logx-*` is a project-internal alias, never what a shared unit codes against [D2]" ✅ exact to D2.
- L87 "Do not put `server-only`/`client-only` on the OKLCH engine [D14]" ✅ exact to D14.
- L84 proxy "Node runtime only — setting `runtime` throws" ✅ matches bundled docs (see A1 table).

### C1 — (MUST FIX, broken-link hazard) sibling links resolve to the wrong place _today_

The author flagged the sibling links as forward references. The real hazard is sharper than "the files
don't exist yet": **they DO exist — in the same `round-1-drafts/` folder as this draft** (I confirmed
all eight siblings are present in `docs/handbook/process/round-1-drafts/`). But the links are written as
`./engineering-standards.md`, `./git-and-pr-workflow.md`, etc., which from _this draft's_ location
(`…/round-1-drafts/orientation.md`) resolve to the round-1 sibling drafts — i.e. they happen to work
_now_ by accident, and will **break** the moment this doc is promoted to `docs/handbook/orientation.md`
(siblings would then need to be at `docs/handbook/engineering-standards.md`, which is the intended final
state). So the links are correct _for the final location_ and accidentally-correct _for the draft
location_, but there's no guarantee the promotion moves all nine files together.

**Fix:** add one line near the top or in the "Which doc" table caption: _"Sibling links (`./_.md`)
assume the final `docs/handbook/`layout; they resolve once the whole set is promoted out of`process/round-1-drafts/` together."\* This converts a silent future-404 into a known invariant. Cheap
insurance.

### C2 — (NIT) the "Where docs disagree, decisions.md wins" precedence (L5) is correct but slightly under-anchored

Line 5 establishes a clean precedence ladder (handbook < architecture docs < decisions.md; everything <
bundled Next docs). This is consistent with `decisions.md`'s own header ("this log is the source of
truth for the deltas until the plans are revised"). Good. Minor: the claim "your training data is stale
on this stack" would land harder with the same one-clause justification the golden-rules section uses
(the proxy/async/force-static churn). Optional.

### C3 — (no duplication-of-architecture violation beyond R2)

Aside from the mental-model density flagged in R2, the doc consistently points rather than re-documents.
The repo map (L30–55) describes _where files live_, not _how the system works_ — that's orientation's job,
not the architecture plan's. No violation.

---

## 4. AGENT-USEFULNESS — would a cold agent produce cleaner code from this?

Largely yes. This is the doc's strongest axis. The cold-start sequence (L100–116) is concrete,
ordered, and copy-pasteable, and it correctly front-loads "find your phase → read the cited §N/[D#] →
verify against bundled docs → branch → smallest slice → run the gate." That is exactly the loop that
keeps an agent from shipping stale-memory framework code.

### U1 — (MUST FIX, ties to A1) the most-used command in the doc is subtly wrong

The local gate (L109) is the one thing an agent will copy-paste every task. Because of A1 it can pass
locally and then fail CI on the typegen git-diff. For a doc whose entire value proposition is "run this
and CI will be green," that's the highest-impact bug in the file. Fixing A1 fixes this. (Calling it out
separately because its _usefulness_ cost is bigger than its _accuracy_ cost — a passing-local /
failing-CI loop is exactly the friction this doc exists to remove.)

### U2 — (SHOULD FIX) step 3 "verify framework facts" lists triggers but not _which doc_

Line 104: "If your task touches routing, caching, request APIs, CSS layers, fonts, or rendering, open
the matching doc in `node_modules/next/dist/docs/`." Good instinct, but "the matching doc" is vague —
an agent has to go spelunking. A two-or-three-row pointer would make this actionable, e.g.:

| Touching…                   | Bundled doc                                                                      |
| --------------------------- | -------------------------------------------------------------------------------- |
| caching / static-vs-dynamic | `01-app/02-guides/migrating-to-cache-components.md`, `…/directives/use-cache.md` |
| request APIs                | `…/04-functions/cookies.md`, `headers.md`, `draft-mode.md`                       |
| proxy/middleware            | `…/03-file-conventions/proxy.md`                                                 |

These paths are stable in 16.2.9 (I just walked them). Even three rows turns "go look" into "open this."
If that's deemed standards-doc territory, at minimum name the two cacheComponents guide files inline,
since they're the ones an agent will need on nearly every rendering task.

### U3 — (NICE-TO-HAVE) no "you are here / first command to run" for a literal cold boot

An agent landing with zero context benefits from one explicit first move before the 8-step sequence —
e.g. "`cat docs/build-phases.md | grep -n '\[ \]' | head` to see the next unchecked task," or simply
"open `../build-phases.md` and find the first `[ ]`." The sequence _says_ "find your phase" but doesn't
give the one command that surfaces it. Small, optional, but it's the kind of concrete nudge the brief
asks for ("missing a concrete command/example").

### U4 — (GOOD) the typegen footgun callout (L112) is exactly right _as a concept_

Calling `pnpm --filter studio typegen` "the easiest gate to trip" is true and well-placed; the only
problem is the conditional framing vs. CI's unconditional run (A1). Keep the callout, fix the framing.

---

## What's genuinely good (concede)

- **Zero stale-memory framework errors.** Every model-breaking fact checks out against the _installed_
  docs — the proxy-throws-on-runtime detail is quoted almost verbatim from `proxy.md`.
- **Precedence ladder (L5)** is crisp and matches `decisions.md`'s self-declared authority.
- **Repo map** correctly distinguishes "exists now" from "boundary-guarded but empty," which directly
  prevents misplacement bugs.
- **Cold-start sequence** is the right shape and mostly copy-pasteable; it bakes in "read the cited
  §N/[D#] and verify the bundled docs" as steps, not as hopeful prose.
- **Right-sizing discipline** holds: it points to the eight siblings instead of absorbing them, and
  carries no governance theater.

---

## Required-change checklist (priority order)

1. **(A1/U1) Fix the local gate command** so it either matches CI literally (incl. `typegen` +
   `git diff --exit-code sanity.types.ts` **before** `build`) or stops claiming "exactly what CI runs."
   Make the typegen step unconditional, matching CI.
2. **(C1) Add the sibling-link invariant note** — `./*.md` links assume the promoted `docs/handbook/`
   layout and resolve only when the whole set moves out of `round-1-drafts/` together.
3. **(R2) De-densify mental-model bullets 3 & 4** — keep the keystone _name + one-line what-it-is +
   anchor_; cut the D3–D6/D9/D11 implementation clauses that will rot against the source of truth.
4. **(U2) Make step 3 actionable** — name the specific bundled-doc paths (at least the two
   cacheComponents guides) instead of "the matching doc."
5. **(R1) Trim the two leaky stack-table cells** (lint-plugin / testing specifics) down to the decision.
6. _(Optional)_ A2 precision hedge on "removed"; U3 one cold-boot command; C2 anchor for the "stale
   training data" claim.
