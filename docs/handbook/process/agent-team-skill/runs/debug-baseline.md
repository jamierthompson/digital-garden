# Orchestration Plan — "Brand color flashes the wrong hue on first paint" on `/work/<slug>`

**Lead:** this session. **Mode:** plan only — no debugging performed here.
**Symptom (verbatim):** On `/work/<slug>` the brand color flashes the _wrong hue_ for a split
second on first paint, then corrects. Suspected cause unknown: caching, `@layer` order, or
hydration.

This is the classic three-way theming bug for _this_ repo, and the repo's own docs already
name all three failure surfaces by `[D#]`. The plan is built to pin the root cause to **one** of
them with evidence, not to guess.

---

## 0. Preflight — is an agent team even the right tool, and can it run at all?

### 0a. The blocking finding: the code under investigation does not exist yet in `src/`

Before deciding _how_ to staff this, I checked _what_ there is to debug. The repo is at **Phase 0**:

```
src/app/        layout.tsx · page.tsx · globals.css · foundation.css · *.module.css
src/lib/        breakpoints.ts          ← no  src/lib/oklch/  engine
src/sanity/     lib/client.ts · lib/env.ts
```

- There is **no `/work/<slug>` route** (`find src -path "*work*"` → empty).
- There is **no `ProjectScope` component** — the one server component that emits the flash-free
  scoped `<style>` (`§6`, `[D11]`).
- There is **no OKLCH engine** at `src/lib/oklch/` (`[D14]`).
- `src/app/globals.css` is explicitly labelled _"Placeholder shell styling (Phase 0, unthemed).
  Will move under the shell island's scope once `ProjectScope` themes the garden."_
- The nav `/work` link is a skeleton `<li>Work</li>` with the comment _"real /work, /about, /now
  routes land in Phase 3."_

**Implication — this is the first thing the team must establish, not assume.** A flashing
_wrong hue_ requires a themed `/work/<slug>` to exist and run. Three possibilities, in priority
order:

1. **The symptom is on a deployed Vercel preview or an unmerged feature branch**, not `main`.
   → The repro must target _that_ deployment/branch. Step 1 below pins it.
2. **The symptom is on the user's local working tree** (uncommitted Phase 3 work). → `git status`
   / `git branch` will show it; the team works against that tree.
3. **The feature genuinely isn't built yet** and the report is aspirational/misremembered. → There
   is nothing to debug; bounce to the user with the Phase-0 evidence above rather than spawn a team
   to chase a phantom.

**No team is spawned until Step 1 produces a deterministic repro against real, identified code.**
Spawning investigators against code that doesn't exist is the most expensive way to learn it
doesn't exist.

### 0b. Team vs. subagents vs. single session

| Option                                                                                                                           | Fit here                                                                                                                                                                                                                                                                                                                                                                                    | Verdict                                       |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Single session**                                                                                                               | One person can chase three hypotheses, but serially, and the verbose browser/trace/log output pollutes the lead's context.                                                                                                                                                                                                                                                                  | Too slow; context bloat.                      |
| **Parallel investigator subagents** (`Agent`, fresh isolated context, return a dense cited digest — `working-with-agents.md` §5) | The diagnosis is **read-only** and splits into **3 genuinely independent hypotheses** with no shared files to edit and no branch to curate. This is exactly the "independent enough to parallelize" case, **3–5 concurrent is the sweet spot**.                                                                                                                                             | **Primary tool for the diagnosis phase.**     |
| **Full agent team** (shared branch, each owns a distinct _file set_, lead curates history & squash-merges — §6.1)                | The team model's defining benefit is **file-ownership isolation for parallel _edits_** ("break the work so each teammate owns a different set of files"). During diagnosis nobody edits anything, so that benefit is dormant. It only becomes the right tool **once the root cause is known and the fix spans multiple owned files** (e.g. an engine change + a CSS-layer change + a test). | **Deferred to the fix phase, conditionally.** |

**Decision:** run the **diagnosis as a fan-out of read-only investigator subagents** (one per
hypothesis), converge on root cause myself, then **escalate to a true agent team only for the fix**
if and only if the fix crosses ≥2 owned file sets. If the fix is a one-file change, a single
session ships it. This obeys the handbook's "default to single-agent; don't add agents to fix
coordination" rule (§4) — we add agents for _parallel independent investigation_, the one thing
they're unambiguously good at.

### 0c. What must be true for any multi-agent work to run

- **Not on `main`, clean tree.** Guardrail: _never commit to `main`_ (`AGENTS.md`). Any fix lands
  on a `fix/work-slug-color-flash` branch. Diagnosis itself writes no code.
- **A deterministic repro exists** (Step 1). Without it there is nothing to verify a fix against.
- **The browser-verification capability is live.** The symptom is a _rendered-surface, first-paint_
  bug — jsdom cannot see it (`testing.md`, `[D25]`). The repro and every verdict run through the
  **`chrome-devtools` MCP** (performance trace + screenshots), which is connected in this session.
- **Each investigator gets a self-contained brief** (§5): it sees none of my context, my file
  reads, or this conversation — the brief is the only channel in, a dense cited digest the only
  channel out.

---

## 1. Step 1 (lead, before any spawn) — establish & freeze the repro

I do this myself; it's cheap, it's the gate for everything else, and it produces the shared
artifact every investigator keys off.

1. `git status && git branch -a` — find where the themed `/work/<slug>` actually lives (branch,
   working tree, or nowhere). Identify the exact slug(s) that flash.
2. Stand up that code: `pnpm build && pnpm start` (production build — PPR/`use cache` behavior is
   build-only; `pnpm dev` will _not_ reproduce a caching/streaming flash faithfully), **or** target
   the Vercel preview URL if that's where it was seen.
3. Drive **`chrome-devtools` MCP**: `new_page` → `performance_start_trace` (reload, clear cache) →
   `navigate_page` to `/work/<slug>` → `performance_stop_trace` + burst `take_screenshot`s through
   first paint. Capture: the wrong hue's actual OKLCH/computed value, the corrected hue, the **delay
   between them**, and whether the correction coincides with hydration, a streamed chunk, or a
   second style recalc.
4. Save a one-page **`repro.md`** (computed-style timeline + which `<style>`/class changed +
   network/stream waterfall + whether it repros on hard-reload vs warm cache). **This file is pasted
   verbatim into all three briefs** so every investigator debugs the _same_ observed event.

If Step 1 cannot produce a flash (feature absent), I stop and report 0a possibility 3 to the user.

---

## 2. Approach / pattern

**Differential diagnosis by independent elimination.** Three investigators, each _owns one
hypothesis_, each tries to **confirm or kill its own** with repo-grounded evidence, working from
the _same_ frozen repro. Diversity of lens is the whole point (§4) — identical agents add nothing.
Crucially each is told the _other two_ hypotheses exist and to **flag any evidence that points at a
neighbor's** rather than tunnel — that cross-pollination is what makes convergence honest. No
debate round is needed: this is empirical, not architectural, so verdicts are evidence, not opinion.
I converge.

The three hypotheses map 1:1 onto the three failure surfaces the repo's own decisions already
enumerate — this is not a generic checklist, it's _this codebase's_ known theming footguns:

- **H1 Caching** — `[D11]` (`use cache` / `cacheLife('max')` keyed on `brandColor`/`fontKey`; PPR
  prerendered-shell-with-dynamic-holes), §7.
- **H2 `@layer` order** — `[D12]` (unlayered CSS Module silently outranks every `@layer` style;
  `foundation < brand < project`), `[D13]`, enforced by `pnpm lint:css`.
- **H3 Hydration / streaming** — `[D13]` (inline `<style>` vs streamed `precedence`), `[D11]` Axis A
  (shell vs streamed hole), `[D9]` (defensive fallback `brandColor` painting first), `[D14]`.

"Flashes the **wrong hue** then **corrects**" is a strong discriminator and each investigator is
told what their hypothesis predicts the _first_ hue would be:

- **H1** predicts the first hue is **another project's** brand (a stale/shared cached shell).
- **H2** predicts the first hue is whatever an **unlayered/higher-cascade** rule paints, replaced
  once the `@layer brand` scoped `<style>` wins (or vice-versa) after a recalc.
- **H3** predicts the first hue is the **defensive fallback** (`[D9]`) or _unthemed_ default,
  replaced when the real scoped `<style>` arrives via a **streamed hole / post-hydration** instead
  of the initial shell (an Axis-A `[D11]` placement regression, or a server/client RSC mismatch).

---

## 3. Work division across teammates

| Investigator | Owns hypothesis        | First-hue prediction                  | Primary evidence it gathers                                                                                                                                                                                                                                                                      |
| ------------ | ---------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **CACHE**    | H1 caching / PPR       | a _different_ project's brand         | Where `use cache`/`cacheLife` sit; is the cache key the full `brandColor`+`fontKey` (`[D11]`)?; does the prerendered shell get shared across slugs?; warm-vs-cold-cache repro diff; Vercel/CDN cache headers.                                                                                    |
| **LAYER**    | H2 `@layer` order      | whatever out-ranks `@layer brand`     | Every CSS Module's `@layer` declaration vs `[D12]`; any **unlayered** module on the `/work/<slug>` tree; the scoped `<style>`'s `@layer brand`; computed-style "which rule won" at paint vs after; does `pnpm lint:css` pass?                                                                    |
| **HYDRATE**  | H3 hydration/streaming | defensive fallback `[D9]` or unthemed | Is `ProjectScope` in the **prerendered shell** or a **streamed/suspended hole** (`[D11]` Axis A, `[D13]`)?; inline `dangerouslySetInnerHTML` vs `<style precedence>`; React hydration-mismatch warnings in console; does the corrected paint coincide with the hydration tick or a stream chunk? |

Files are _read_ by all three (it's a diagnosis), so there's no edit-conflict to partition — the
partition is **by hypothesis and by evidence type**, which keeps their digests non-overlapping.

---

## 4. The exact spawn briefs (verbatim)

All three launch **concurrently** (single message, three `Agent` calls), `subagent_type:
general-purpose` (they need Bash + chrome-devtools MCP + Read, not just search). **Model tier:
Sonnet** for all three — this is evidence-gathering against a frozen repro, not open-ended hard
reasoning; I reserve stronger reasoning for my own convergence step. `repro.md` from Step 1 is
pasted into the `<<<REPRO>>>` slot of each.

### 4a. Investigator CACHE

```
OBJECTIVE
Confirm or kill ONE hypothesis: the wrong-hue flash on /work/<slug> is a CACHING / PPR bug —
a stale or cross-slug-shared prerendered shell (or a too-coarse `use cache` key) serves one
project's brand color on first paint, then the correct dynamic value replaces it.

You own H1 only. Two sibling investigators own H2 (@layer order) and H3 (hydration/streaming).
Do NOT fix anything — this is read-only diagnosis. If your evidence points at H2 or H3 instead,
say so explicitly with the evidence; do not tunnel on confirming H1.

SYMPTOM & REPRO (frozen — debug exactly this event)
<<<REPRO: paste repro.md — computed-style timeline, the two hue values + delay, the style/class
that changed, the network/stream waterfall, warm-vs-cold-cache behavior, exact slug(s)>>>
H1 predicts the FIRST (wrong) hue is ANOTHER project's brand color. Check that prediction first.

SOURCE OF TRUTH — open these, do not work from memory
- docs/decisions.md → [D11] (`use cache` keyed on brandColor/fontKey, `cacheLife('max')`, no
  request APIs in that boundary; PPR = prerendered shell + dynamic holes; Axis A placement).
- docs/architecture-plan.md → §7 (rendering model) and the ProjectScope caching contract (§6).
- Framework truth: node_modules/next/dist/docs/ — read `01-directives/use-cache.md`,
  `01-getting-started/08-caching.md`, and the cacheComponents/PPR docs. `export const dynamic`
  is REMOVED under cacheComponents — do not reach for it. Verify every Next claim against these
  installed docs, NOT your training data (this repo is Next 16.2.9 / React 19.2.4).
- Ground truth in the running app: where `use cache` / `cacheLife` / `cacheTag` actually sit on
  the /work/<slug> path; the `/work` index query; ProjectScope's cache key; Vercel response
  cache headers (use the chrome-devtools MCP network panel and/or Vercel MCP logs).

WHAT TO PRODUCE AS EVIDENCE
- Is the cache key the FULL brandColor+fontKey, or something coarser that could collide across
  slugs? Quote the code.
- Does the prerendered shell get shared/reused across different slugs? Cold-cache vs warm-cache
  repro: does the flash only appear warm (smoking gun for cache) or also cold?
- If warm-only and the first hue == a previously-visited slug's brand → H1 CONFIRMED.

BOUNDARIES
Read-only. Touch no files. Stay on H1. Cite the bundled-doc PATH or [D#] for every framework/
project claim — a claim with no source is not evidence.

OUTPUT FORMAT
A dense, skimmable digest (not raw logs): VERDICT (confirmed / killed / partial) · the 3–5
strongest evidence lines each with its source path/[D#] · any evidence that actually points at
H2/H3 · the single most decisive next probe if still ambiguous.
```

### 4b. Investigator LAYER

```
OBJECTIVE
Confirm or kill ONE hypothesis: the wrong-hue flash on /work/<slug> is a CSS @layer / cascade
bug — an unlayered or higher-priority rule paints one hue first, then the `@layer brand` scoped
<style> (or vice-versa) wins after a style recalc, swapping the hue.

You own H2 only. Siblings own H1 (caching) and H3 (hydration/streaming). Read-only diagnosis,
no fixes. If evidence points at H1 or H3, say so explicitly; don't tunnel.

SYMPTOM & REPRO (frozen — debug exactly this event)
<<<REPRO: paste repro.md>>>
H2 predicts the FIRST (wrong) hue is whatever rule OUT-RANKS `@layer brand` at first paint —
e.g. an unlayered CSS Module, or a source-order/specificity winner — replaced once the correct
layered rule applies. Check which rule actually "won" at paint vs after, via computed styles.

SOURCE OF TRUTH — open these, do not work from memory
- docs/decisions.md → [D12] (Next does NOT auto-layer CSS Modules; an UNLAYERED module silently
  outranks EVERY @layer style — "the @layer trap"; layer order `foundation < brand < project`;
  the scoped <style> declares `@layer brand`). Also [D13] (streamed <style> precedence) and
  [D1]/[D2] (token tiers).
- src/app/foundation.css → confirms `@layer foundation, brand, project;` is declared first.
- Framework truth: node_modules/next/dist/docs/.../11-css.md (CSS Modules / layering behavior).
  Verify against these installed docs, NOT memory (Next 16.2.9 / React 19.2.4).
- Enforcement: scripts/check-css-layers.mjs (run `pnpm lint:css`). A passing lint does NOT prove
  innocence — lint checks declaration, not paint-time cascade outcome.
- Ground truth: every *.module.css on the /work/<slug> render tree — does each wrap its body in
  `@layer foundation|brand|project` or stay strictly var-consuming? Find any unlayered rule.

WHAT TO PRODUCE AS EVIDENCE
- A list of every CSS Module on the /work/<slug> tree and its @layer status; flag any unlayered
  one whose declarations touch brand color / `--brand-*` / `--logx-*`.
- chrome-devtools computed-style read: WHICH rule supplied the color at first paint vs after the
  swap — same selector re-evaluated, or a different rule winning? If an unlayered rule paints
  first and the layered `@layer brand` rule wins after recalc → H2 CONFIRMED.

BOUNDARIES
Read-only. Touch no files. Stay on H2. Cite the bundled-doc PATH or [D#] for every claim.

OUTPUT FORMAT
Dense digest: VERDICT (confirmed/killed/partial) · 3–5 strongest evidence lines with source
path/[D#] · the offending selector(s) if found · any evidence pointing at H1/H3 · most decisive
next probe.
```

### 4c. Investigator HYDRATE

```
OBJECTIVE
Confirm or kill ONE hypothesis: the wrong-hue flash on /work/<slug> is a HYDRATION / STREAMING /
placement bug — the correct scoped <style> is NOT in the initial prerendered HTML but arrives via
a streamed/suspended hole or post-hydration, so a defensive-fallback or unthemed hue paints
first, then corrects (or a server/client RSC payload mismatch swaps it).

You own H3 only. Siblings own H1 (caching) and H2 (@layer order). Read-only diagnosis, no fixes.
If evidence points at H1 or H2, say so explicitly; don't tunnel.

SYMPTOM & REPRO (frozen — debug exactly this event)
<<<REPRO: paste repro.md>>>
H3 predicts the FIRST (wrong) hue is the DEFENSIVE FALLBACK brandColor ([D9]) or an UNTHEMED
default, and the correction coincides with the HYDRATION tick or a streamed chunk arriving —
NOT with a cache state and NOT with a pure CSS recalc. Pin the correction to an event on the
performance trace.

SOURCE OF TRUTH — open these, do not work from memory
- docs/decisions.md → [D11] Axis A (render ProjectScope INSIDE the prerendered shell so the
  scoped <style> + font .variable class land in the INITIAL static HTML — flash-free; a streamed
  hole = delayed = flash), [D13] (plain inline `dangerouslySetInnerHTML` is flush-before-paint;
  use `<style href=... precedence>` ONLY if ProjectScope can be suspended), [D9] (defensive,
  never-throws fallback brandColor — the likely first hue), [D14] (isomorphic engine; no
  server-only/client-only).
- docs/architecture-plan.md → §6/§7 (ProjectScope is the resolution keystone; flash-free
  contract; `unstable_catchError`/error-boundary note around ProjectScope).
- Framework truth: node_modules/next/dist/docs/ — Suspense/streaming, PPR, and React 19 <style>
  precedence behavior. Verify against installed docs, NOT memory (Next 16.2.9 / React 19.2.4).
- Ground truth: is the correct scoped <style> present in the INITIAL HTML response
  (`curl`/view-source the document before JS), or injected later? Console for React
  hydration-mismatch warnings. chrome-devtools performance trace: does the hue swap line up with
  the hydration commit or a stream boundary?

WHAT TO PRODUCE AS EVIDENCE
- Initial-HTML check: is the scoped `[data-project=...]` <style> (and font .variable class) in
  the raw server response, or absent until hydration/stream? Quote the relevant HTML.
- Is ProjectScope in the shell or behind a Suspense boundary? Inline vs precedence <style>?
- Any console hydration-mismatch warning? Does the corrected paint coincide with hydration?
  If the first hue == the [D9] fallback and the style arrives post-shell → H3 CONFIRMED.

BOUNDARIES
Read-only. Touch no files. Stay on H3. Cite the bundled-doc PATH or [D#] for every claim.

OUTPUT FORMAT
Dense digest: VERDICT (confirmed/killed/partial) · 3–5 strongest evidence lines with source
path/[D#] · whether the scoped <style> is in initial HTML (yes/no + quote) · any evidence
pointing at H1/H2 · most decisive next probe.
```

---

## 5. Closing the loop — convergence on root cause

1. **Collect the three digests** (each: confirmed / killed / partial + cited evidence + any
   cross-pointers at a sibling hypothesis).
2. **Expect exactly one CONFIRMED.** The three hypotheses are mutually exclusive at the level of
   _what changes the hue_ (a cache state vs. a cascade winner vs. a stream/hydration event), and the
   frozen `repro.md` timeline discriminates them: a **warm-cache-only** flash whose first hue is
   another slug's brand ⇒ H1; a flash that survives a single cold load and is a **pure style
   recalc** with no new style node ⇒ H2; a flash whose correction is **time-locked to hydration/a
   stream chunk** and whose first hue is the `[D9]` fallback ⇒ H3.
3. **Resolve conflict honestly, don't smooth it** (§4 pitfall). If two come back "partial," or two
   claim confirmed, I look for the **interaction** (e.g. ProjectScope correctly in the shell _but_
   an unlayered module out-ranks it — an H2/H3 combo) and re-spawn the **one** decisive probe named
   in the digests rather than re-running everyone. _Add a sharper probe, not more agents._
4. **Reproduce the root cause on demand** before declaring it — toggle the suspected mechanism
   (e.g. warm vs cold cache; add/remove the `@layer` wrapper in a throwaway local check; move
   ProjectScope above/below a Suspense boundary) and confirm the flash tracks it. A root cause I
   can switch on and off is proven; one I can only argue is not.
5. **Then, and only then, choose the staffing for the fix** (the deferred 0b decision):
   - Fix touches **one file set** (e.g. just CSS-module `@layer` wrappers, or just ProjectScope
     placement) → **single session** ships it on `fix/work-slug-color-flash`, runs the full gate,
     and **browser-re-verifies the flash is gone via chrome-devtools** (`[D25]`) before done.
   - Fix crosses **≥2 owned file sets** (e.g. engine + CSS layer + a regression test) → **escalate
     to a true agent team**: each teammate owns a distinct file set, ships a complete gate-green
     slice, and I (lead) curate history and **squash-merge** with the root-cause story in the PR
     body (§6.1).
6. **Record the outcome.** The fix lands a **regression guard** (a test that fails on the flash —
   e.g. asserting the scoped `<style>` is in the initial HTML, or a `lint:css` case for the
   offending module) so it can't silently come back, and the gate is green per
   `definition-of-done.md` including the browser check `[D25]`.

**Gate before any merge** (`AGENTS.md`): `pnpm lint && pnpm lint:css && pnpm lint:keys &&
pnpm format:check && pnpm typecheck && pnpm test && pnpm --filter studio typegen &&
git diff --exit-code sanity.types.ts && pnpm build`.
