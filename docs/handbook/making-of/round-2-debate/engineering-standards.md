# Round-2 Debate — Engineering Standards

Devil's-advocate review of [`../round-1-drafts/engineering-standards.md`](../round-1-drafts/engineering-standards.md).
Verified against the installed Next **16.2.9** / React **19.2.4** docs in `node_modules/next/dist/docs/`, `docs/decisions.md` (D1–D23), `eslint.config.mjs`, `package.json`, `.github/workflows/ci.yml`, and `studio/package.json`. Line numbers refer to the round-1 draft.

## Verdict

This is a strong draft — the strongest framework-facts doc I've reviewed in this set. Every load-bearing Next-16 claim I spot-checked is **accurate against the installed docs**, the foot-gun list is genuinely the right altitude for an agent landing cold, and it consistently points to `[D#]` / plan sections instead of re-deriving the system model. Most findings below are **fixes, not rewrites**. The two that matter: a **factually wrong `<Activity>` parenthetical**, and **two citation claims that say "Verified against ‹doc›" where the doc does not contain the claim**. Those undermine the doc's core promise ("don't trust memory, trust the bundled doc") and must be fixed.

---

## Axis 1 — ACCURACY

### What I verified as CORRECT (concede up front)

All checked against `node_modules/next/dist/docs/`:

- **Request APIs async** (L69–80): `cookies()` is async and must be awaited — `…/04-functions/cookies.md:6,67`. ✓
- **`proxy.ts`, Node-only, setting `runtime` throws** (L94): verbatim in `…/03-file-conventions/proxy.md:223` ("The `runtime` config option is not available in Proxy files. Setting the `runtime` config option in Proxy will throw an error") and the changelog `v16.0.0` entry. ✓
- **`'use cache'` can't read `cookies()`/`headers()`/`searchParams`; pass as args; args+closures become the key** (L84): `…/01-directives/use-cache.md:78–99,196,265`. ✓ The draft **correctly omits `draftMode()`** from the forbidden list — the doc explicitly says `draftMode()` _is_ readable inside `use cache` (`use-cache.md:219`). Good, precise call.
- **RSC arg serialization forbids class instances / `URL`; returns may include JSX; `children`/Server Actions pass-through** (L85): `use-cache.md:110,124–131,154–163`. ✓
- **Default cacheLife = stale 5 min / revalidate 15 min / never expire** (L86): exact, `…/04-functions/cacheLife.md:140`. ✓
- **`cacheTag` + `updateTag`** (L86): both functions exist as named — `…/04-functions/updateTag.md`, `cacheTag.md`. ✓ (Good: it picked the new `updateTag`, not the older `revalidateTag`.)
- **Remote-cache / serverless caveat** (L88): `…/01-directives/use-cache-remote.md:17–25,64,95` confirms in-memory `use cache` has low hit rates across serverless instances and `'use cache: remote'` is the durable option. ✓
- **`Uncached data was accessed outside of <Suspense>` build/dev error** (L67): exact string at `…/01-getting-started/08-caching.md:292`. ✓ (sourcing nit below)
- **`export const dynamic` / `force-static` removed; PPR/dynamic-by-default** (L57, L162): consistent with `migrating-to-cache-components.md` and `[D11]`. ✓
- **CI facts**: `pnpm --filter studio typegen` (L170) matches `studio/package.json` and `ci.yml:34`; the gate order and "`pnpm build` is the last CI gate" (L67) match `ci.yml:26–37`. ✓
- **`minWidth(bp: Breakpoint): string`** (L16): matches `src/lib/breakpoints.ts:16`. ✓

### A1 — ❗ `<Activity>` "effects cleaned up" is WRONG (L94)

> "`<Activity>` keeps recent routes mounted `mode="hidden"` across navigation (state + DOM preserved, **effects cleaned up**)…"

`…/02-guides/preserving-ui-state.md:17,25` says Next hides pages with **`display: none`** and **"Activity preserves all component state and DOM state by default"** — the _entire guide_ exists to show you how to **manually** reset transient state with `useLayoutEffect` cleanup _because_ effects/state are **not** auto-cleaned. The parenthetical "effects cleaned up" states the opposite of the doc and will actively mislead an agent into assuming a hidden route's effects have torn down. Two sub-issues:

1. **Factually inverted.** Default is preservation, not cleanup.
2. **`mode="hidden"`** is a real React Activity prop, but the Next doc describes the _behavior_ as hiding via `display: none`, not via an author-set `mode` prop. Phrasing implies you set `mode="hidden"`; you don't — Next does the hiding.

**Fix:** Replace with: _"`<Activity>` keeps recently-visited routes in the DOM (hidden via `display: none`) instead of unmounting them, so React state and DOM state are **preserved** across back/forward nav. Effects are **not** auto-cleaned — reset transient state yourself in a `useLayoutEffect` cleanup. See `…/02-guides/preserving-ui-state.md`."_ Honestly, this whole sentence is tangential to "engineering standards" (it's a behavior gotcha, not a coding rule) — consider cutting it to one foot-gun bullet or moving it out.

### A2 — ❗ "Verified against `…/11-css.md`" does NOT verify the `@layer` trap (L122)

> "The engine's scoped `<style>` declares `@layer brand`. **Verified against `…/01-app/.../11-css.md`.**"

I read `…/01-getting-started/11-css.md` end-to-end. It contains **zero** mention of `@layer`, cascade layers, or "unlayered modules outrank layered styles." Its CSS-ordering section (L400–458) only covers **import-order chunking**, a different mechanism. The `@layer` trap is **true CSS-cascade behavior** and the `[D12]` ruling is sound — but the _citation is false_. The Next doc neither states nor implies it. This is inherited verbatim from `[D12]` ("verified against `…/11-css.md`"), so the draft is faithfully repeating a bad citation — but a doc whose thesis is "cite the bundled doc, not memory" cannot itself cite a doc that doesn't say the thing.

**Fix:** Drop "Verified against `…/11-css.md`". Re-anchor honestly: cite the **CSS cascade-layers spec** (MDN / CSS Cascading and Inheritance Level 5) for _why_ unlayered beats layered, and cite **`[D12]` + `scripts/check-css-layers.mjs`** for _what we enforce_. State plainly: "Next's CSS doc does not assign Modules to a layer, which is exactly the gap this rule closes" — that's the accurate framing.

### A3 — Sourcing nit: Suspense error string cited to the wrong file (L57, L67)

The draft cites the cache-components story to `migrating-to-cache-components.md` and `use-cache.md` (correct), but the **exact** error string `Uncached data was accessed outside of <Suspense>` lives in `…/08-caching.md:292`, not in the two files cited near it. **Fix:** add `…/01-getting-started/08-caching.md` to the citation on L67 so an agent can find the string it's quoting.

### A4 — `ssr: false` claim (L45) — correct but under-sourced

"`ssr: false` is Client-Component-only — you cannot pass it from a Server Component" is correct (`next/dynamic`'s `ssr: false` is rejected in Server Components). It's the one framework claim in the doc with **no citation** while its neighbors all have one. **Fix:** anchor to `…/02-guides/lazy-loading.md`.

---

## Axis 2 — RIGHT-SIZED vs OVER-ENGINEERED

The draft is mostly well right-sized. Three things to trim or reconsider:

### B1 — The verbatim ESLint boundary messages restate config (L139–144) — the author's own flagged concern

The author asked whether reproducing the `eslint.config.mjs` `message` strings and global list earns its place. **My ruling: trim, don't reproduce.** The R4 guidance ("state intent, don't re-list config") applies. The _intent_ table (project ⇏ project, oklch ⇏ everything, isomorphic) is exactly what an agent needs and should stay. But copying the **exact `message:` strings** verbatim (L142 "lift shared code into a shared module", etc.) is config-duplication that will silently drift the day someone reword the lint message — and it buys the agent nothing, because the agent _sees the real message when the lint fails_. Keep the **rule + why**; drop the **verbatim message column**; point to `eslint.config.mjs` as the source of truth for exact wording. Same for the full `NON_ISOMORPHIC_GLOBALS` enumeration (L149) — listing all twelve is fine as a one-time orientation, but consider "(window/document/process/Buffer/… — full list in `eslint.config.mjs`)" so the doc isn't the second place to update.

### B2 — §3's Vercel/`'use cache: remote'` bullet (L88) is borderline

It's accurate, but it's an _ops/deployment_ concern bleeding into a coding-standards doc, and the decision ("consider remote for runtime data") isn't yet a project rule. For a solo portfolio with ~5 mostly-static projects this is theoretical. **Fix:** keep it to a single sentence or move it to `security-and-ops.md`. Don't let it grow.

### B3 — Keep — not over-engineered

The TS table, the three-outcome cache table, the `@layer` rule, the isomorphism boundary, and the foot-gun checklist are all earning their place. No cuts there. The doc resisted the temptation to re-explain the token tiers (it points to `[D1]`) — good restraint.

---

## Axis 3 — CONSISTENCY

No contradictions with the 23 decisions found — the draft tracks them tightly. Specifics:

- §3's theming pattern (L90) matches `[D11]` Axis A almost word-for-word (`ProjectScope` in the prerendered shell, `use cache` keyed on `brandColor`/`fontKey`, `cacheLife('max')`, no request APIs in that boundary). ✓
- §2/§5 isomorphism + "no `server-only`/`client-only`" matches `[D14]`. ✓
- §4 token tiers / public-name contract match `[D1]`/`[D2]`; breakpoints-not-`:root` matches `[D22]`; stega-off matches `[D16]`; streamed `<style>` precedence matches `[D13]`. ✓
- Reference-by-key `satisfies Record<Key,…>` matches `[D10]`. ✓

### C1 — Inconsistency with `[D23]`: `keys.ts` "single source of truth" location (L20)

L20 calls `keys.ts` "the single source of truth" and §5 mentions the package boundary, but the draft never states **where** `keys.ts` must live. `[D23]` (closing paragraph) is explicit: because the standalone Studio can't import the app's `src/*`, **`keys.ts` must live in a shared workspace package both consume**, not in `src/`. An agent reading only this doc could reasonably put `keys.ts` under `src/lib/` and break the Studio import. **Fix:** one clause on L20 — "lives in the shared workspace package both the app and Studio consume (`[D23]`), never duplicated."

### C2 — Does it duplicate the architecture docs? Mostly no — one spot

§4's three-tier token enumeration (L102–106) restates `[D1]`/§3.1 in full. It's borderline duplication, but it's short and the agent needs the tier names to apply the `@layer` rule, so I'd **keep it** — just make sure it's framed as "(see `[D1]`/§3.1 for the full model)" rather than presenting itself as the definition.

---

## Axis 4 — AGENT-USEFULNESS

High. The "three outcomes per component" table (L61–65) and the async-API code block (L71–78) are the kind of copy-pasteable, decision-shaped content that actually changes what an agent writes. The foot-gun checklist is the best single artifact in the doc. Remaining gaps:

### D1 — Broken relative links — the doc will 404 its own anchors (L3, L5, L180)

The author flagged this; confirming and sharpening. The sibling links `./testing.md` etc. **resolve today** in `round-1-drafts/` (all siblings exist there). But the up-links are **internally inconsistent** and will break regardless of final location:

- `../../architecture-plan.md` and `../../decisions.md` → **2 levels up**.
- `../../../AGENTS.md` (L5) → **3 levels up**.

These can't both be right from one file. From the _intended_ final `docs/handbook/` location: `decisions.md` is `../decisions.md` (1 level: `docs/handbook/` → `docs/`), **not** `../../`. So **every** `../../` up-link is one level too deep for `docs/handbook/`, and `../../../AGENTS.md` is two too deep (AGENTS is at repo root = `../../AGENTS.md` from `docs/handbook/`). **Fix:** decide the canonical home first, then compute once: from `docs/handbook/`, use `../decisions.md`, `../architecture-plan.md`, `../build-phases.md`, `../../AGENTS.md`, and `./<sibling>.md`. The synthesizer should verify these against the _final_ path, not assume "they'll resolve once moved."

### D2 — `'use cache'` placement lacks a concrete "where do I put the directive" example (L82–88)

The rules are correct but abstract. An agent knows it _can't_ read `cookies()` inside the scope, but the doc never shows the **read-outside / pass-as-arg refactor** in code — which is the single most common mistake. **Fix:** add the 4-line example the bundled doc itself uses (`use-cache.md:612–635`): read `cookies()` in the dynamic parent, pass the value into the `'use cache'` child as a prop. Two-thirds of agent cache bugs are this exact shape.

### D3 — `generateMetadata` line (L92) is correct but buried

"`generateMetadata` is Server-Components-only with async `params`" is right and useful, but it's stranded at the bottom of §3 between cache rules and routing facts. Minor: it belongs with the async-request-API cluster (L69–80), since "async `params`" is the same gotcha.

---

## Recommended-change checklist (priority order)

1. **[Accuracy, must-fix]** Rewrite the `<Activity>` parenthetical (L94) — "effects cleaned up" is inverted; default is **preservation**. Or cut the sentence to a foot-gun bullet.
2. **[Accuracy, must-fix]** Drop "Verified against `…/11-css.md`" from the `@layer` claim (L122); that doc doesn't contain it. Re-anchor to the CSS cascade-layers spec + `[D12]` + `check-css-layers.mjs`.
3. **[Consistency, must-fix]** State that `keys.ts` lives in the **shared workspace package** per `[D23]` (L20), not in `src/`.
4. **[Right-sized]** Drop the verbatim ESLint `message` column (L142–144) and trim the global enumeration (L149); keep the rule+why, point to `eslint.config.mjs` for exact strings.
5. **[Agent-usefulness]** Recompute all relative links from the final `docs/handbook/` path (`../decisions.md`, `../../AGENTS.md`, …); they're inconsistent and over-deep today (L3, L5, L180).
6. **[Agent-usefulness]** Add the read-outside-pass-as-arg `'use cache'` code example from `use-cache.md` (§3).
7. **[Sourcing nits]** Cite `08-caching.md` for the Suspense error string (L67); cite `lazy-loading.md` for the `ssr: false` claim (L45).
