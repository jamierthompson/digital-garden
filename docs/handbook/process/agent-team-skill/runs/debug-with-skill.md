# Orchestration Plan — "Brand color flashes wrong hue on first paint on `/work/<slug>`"

**Role:** team lead. **Mode:** Debugging via competing hypotheses (`references/debugging.md`).
**Symptom (verbatim, goes in every brief):** On `/work/<slug>`, the brand color renders the
**wrong hue for a split second on first paint, then snaps to the correct hue.** Unknown whether the
cause is caching, `@layer` order, or hydration/streaming. A flash-then-correct is a **paint-timing**
signature: something paints with a default/previous brand value before the correct scoped value is
applied.

---

## 0. Preflight — is a team the right tool, and can it even run?

### 0a. Can a team run at all? — YES, the flag is on

`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is present in **both** `~/.claude/settings.json` and the
process env. Teammates will actually spawn. (Per SKILL §0: without this, spawning silently no-ops.)

### 0b. ⚠️ BLOCKING REALITY CHECK — the route does not exist on the current tree

I explored `src/` before planning. **There is no `/work/<slug>` route, no OKLCH engine
(`src/lib/oklch/`), no `ProjectScope`, and no `[data-project]` theming in the working tree.** The
repo is at **Phase 0**: `src/app/` is a placeholder shell (`layout.tsx` hardcodes `<li>Work</li>`
text, not a route; `globals.css` is "Phase 0, unthemed"; `foundation.css` declares the
`@layer foundation, brand, project` order but nothing emits a `@layer brand` scoped `<style>` yet).
The themed-island architecture is **designed** (D1, D3, D11–D14) but **not built** — `build-phases.md`
puts the oklch-engine as a Phase-4 slice (D17).

**Therefore the symptom cannot be reproduced on `main`.** Before any team spawns, the lead must
resolve where the bug actually lives. Two possibilities:

1. **It's on an unmerged feature branch** (someone is mid-build on the engine / `/work` route). →
   The team is the right tool, but **every brief must name that branch**, and step 1 below
   (establish the repro) is mandatory and gating.
2. **It's a speculative/anticipated symptom against the planned design.** → A team is the **wrong
   tool**: there's nothing to instrument. The honest move is a single session doing a design review
   of D11/D12/D13 against the bundled docs, not 4 paid Claude instances debugging a phantom.

**Lead action before spawning:** run `git branch -a` and check out the branch where the route
renders; confirm `pnpm dev` actually shows the flash on `/work/<slug>`. **If no branch reproduces
it, do not spawn the team** — report back that the symptom isn't reproducible on any existing code
and recommend the single-session design review instead.

### 0c. If the repro exists — is a team better than subagents or solo?

Yes. This fits the team profile exactly (SKILL §0 table):

- **Workers must disprove each other.** Three named suspects (cache, `@layer`, hydration) are
  _mutually exclusive enough_ that a single investigator would anchor on the first plausible one and
  stop (the exact failure the debugging mode is designed against). Adversarial cross-examination is
  the value.
- It is **not** a "go fetch a result" task (→ would be subagents), and **not** sequential same-file
  edits (→ would be solo). Investigation fans out across **distinct subsystems** (the `use cache`
  boundary vs. CSS layer cascade vs. the Server/Client streaming seam) that can be probed in
  parallel, then converge.

**Decision: spawn a team — but only after 0b confirms a live repro.**

---

## 1. Pattern & why

**N investigators, one theory each, adversarial → consensus** (debugging.md §"The shape"). The
"flash then corrects" timing already tells us the bug is in **how/when the scoped brand value
reaches first paint**, so I enumerate the three named suspects as three theories, plus a fourth
teammate who owns the **ground-truth repro & evidence timeline** that every theory must explain
(this prevents "sounds plausible" from winning — debugging.md demands _evidence over plausibility_).
Investigation is read-only; the one teammate who adds instrumentation gets its **own throwaway
branch** so probes don't collide (debugging.md §"cautions").

**Team size: 4** (within the 3–5 sweet spot, SKILL §1). Three theory-owners is the minimum for a
real debate; the evidence-owner is the referee, not a fifth theory.

---

## 2. Work division (which hypotheses to whom)

| Teammate                     | Theory it owns                                                                                                                                                                                                                                                                                                                                                          | Primary source-of-truth                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Cacheford**                | Stale / mis-keyed `use cache` boundary: `ProjectScope` is `use cache`-d keyed on `brandColor`/`fontKey` with `cacheLife('max')` (D11 Axis A). A wrong/cross-slug cache hit or a server-baked `oklch()` literal from a prior slug paints first, then revalidates.                                                                                                        | D11, D3; `node_modules/next/dist/docs/.../cacheComponents.md`, `08-caching*`; skill `vercel:next-cache-components` |
| **Layerton**                 | `@layer` cascade: an **unlayered** CSS Module silently outranks the engine's `@layer brand` scoped `<style>`, OR layer order resolves a default/foundation value before brand (D12, the "@layer trap").                                                                                                                                                                 | D12, D13; `node_modules/next/dist/docs/.../11-css.md`; `src/app/foundation.css`; `pnpm lint:css`                   |
| **Hydra**                    | Hydration / streaming seam: `ProjectScope`'s theme `<style>` is rendered in a **streamed/suspended hole** instead of the prerendered shell, so default paints first and the correct hue arrives when the style hole streams / React adopts `<style precedence>` (D13, D11 Axis A). The classic flash-then-correct signature.                                            | D11 Axis A, D13; React 19 `<style precedence>` + Server/Client boundary docs in bundled docs                       |
| **Probe** (evidence referee) | No theory. Owns the **repro timeline**: chrome-devtools MCP performance trace + screenshots of the flash, `pnpm build` `<head>` inspection (count `<link rel=preload as=font>` and locate the theme `<style>` in initial HTML vs streamed chunk). Publishes the facts all three theories must fit. Owns a throwaway `debug/flash-probe` branch for any instrumentation. | `chrome-devtools` MCP/skill (D25 browser-verify); `pnpm build` head-check from D11                                 |

This split is along **distinct file/subsystem boundaries** (cache boundary code vs. CSS modules/layers
vs. the RSC render seam vs. browser evidence) so no two investigators trample the same ground —
and each theory has a clean way to be _disproven_ by Probe's timeline.

---

## 3. Verbatim spawn briefs

> Each is self-contained (SKILL §1): teammates load `AGENTS.md`/`CLAUDE.md` but see **none** of my
> exploration. The `<BRANCH>` placeholder is filled by the lead from step 0b before spawning.

### → Teammate **Cacheford** (model: opus / high-reasoning — cache-keying is subtle)

```
You are Cacheford, investigator on a debugging team. Do NOT fix anything yet — investigate and
gather evidence for ONE root-cause theory and try to disprove the others.

SYMPTOM (shared, verbatim): On /work/<slug>, the brand color renders the WRONG HUE for a split
second on first paint, then snaps to the correct hue. Flash-then-correct = a paint-timing bug.
REPRO: checkout branch <BRANCH>; pnpm install; pnpm dev; open /work/<slug> (ask teammate Probe for
the exact slug + a trace once it has one). The route/engine does NOT exist on main — only on <BRANCH>.

YOUR THEORY — stale or mis-keyed `use cache`: ProjectScope is `use cache`-d, keyed on
brandColor/fontKey with cacheLife('max'), and emits server-baked oklch() literals (D11 Axis A, D3).
Investigate whether a cross-slug or stale cache entry serves a PRIOR slug's brand literal on first
paint, then revalidates to the correct one. Check the cache key inputs, what's memoized inside the
boundary, and whether any request-time value leaks in.

SOURCES OF TRUTH — open these, do not work from memory (this repo is Next 16.2.9 / React 19.2.4,
your memorized cache APIs are wrong often enough to be dangerous):
- docs/decisions.md → D11 (esp. Axis A: ProjectScope in prerendered shell, use cache, cacheLife),
  D3 (server-baked oklch literals). Cite as [D#].
- node_modules/next/dist/docs/ → the cacheComponents + caching guides (cacheLife/cacheTag/use cache).
- Skill `vercel:next-cache-components` if useful.
- The actual ProjectScope / engine source on <BRANCH> (find it: grep for `use cache`, `cacheLife`,
  `data-project`, `oklch`).

BOUNDARIES: read-only investigation. Do NOT edit cache code or CSS. You own the CACHE subsystem
only — leave @layer/CSS to Layerton and the render/streaming seam to Hydra. If you need a runtime
trace, ask Probe (it owns instrumentation + the debug branch); don't add your own probes.

OUTPUT: a dense, cited digest — (1) verdict: does the evidence support a cache-caused flash? (2) the
specific evidence (cache key, a build/trace observation), (3) what would DISPROVE your theory, and
(4) one concrete attempt to disprove Layerton's or Hydra's theory with a fact. Message Layerton/Hydra
directly with any evidence that bears on their theory. Cite [D#] and doc paths.
```

### → Teammate **Layerton** (model: opus / high — cascade-layer interaction is a known footgun)

```
You are Layerton, investigator on a debugging team. Do NOT fix anything — investigate ONE theory and
try to disprove the others.

SYMPTOM (shared, verbatim): On /work/<slug>, the brand color renders the WRONG HUE for a split
second on first paint, then snaps to the correct hue. REPRO: checkout <BRANCH>; pnpm dev;
/work/<slug> (Probe has the exact slug + trace). Route/engine exist only on <BRANCH>, not main.

YOUR THEORY — @layer cascade (the "@layer trap", D12): Next does NOT auto-layer CSS Modules; an
UNLAYERED module silently outranks every `@layer brand`/`@layer project` style. Investigate whether
some CSS Module on this route is unlayered (or in the wrong layer) and wins over the engine's scoped
`@layer brand` <style> — so a default/foundation hue paints until something (hydration, a later sheet)
flips it. Also verify the global layer order is actually established before the brand sheet.

SOURCES OF TRUTH — open, don't recall:
- docs/decisions.md → D12 (every CSS Module declares @layer; unlayered outranks all), D13 (scoped
  <style> declares @layer brand). Cite [D#].
- src/app/foundation.css → confirms the `@layer foundation, brand, project;` order declaration.
- node_modules/next/dist/docs/ → the CSS / CSS-Modules guide (11-css).
- Run `pnpm lint:css` (the D12 enforcement) and read the engine's scoped <style> on <BRANCH>.

BOUNDARIES: read-only. You own CSS MODULES + @layer cascade only. Cache → Cacheford; render/streaming
timing → Hydra. Don't add runtime probes — that's Probe.

OUTPUT: dense cited digest — (1) verdict: is an unlayered/mis-layered rule winning at first paint?
(2) evidence (which module, which layer, computed-style observation), (3) what disproves it, (4) one
fact-based attempt to disprove Cacheford or Hydra. Message them directly with relevant evidence.
```

### → Teammate **Hydra** (model: opus / high — RSC render-seam reasoning is the hardest)

```
You are Hydra, investigator on a debugging team. Do NOT fix anything — investigate ONE theory and
disprove the others.

SYMPTOM (shared, verbatim): On /work/<slug>, the brand color renders the WRONG HUE for a split second
on first paint, then snaps to the correct hue. Flash-then-correct is the textbook signature of a
theme <style> arriving AFTER first paint. REPRO: <BRANCH>; pnpm dev; /work/<slug> (Probe has the
slug + trace). Exists only on <BRANCH>.

YOUR THEORY — hydration / streaming seam (D11 Axis A, D13): The fix-for-flash is to render
ProjectScope INSIDE the prerendered shell (above any Suspense) so the scoped theme <style> is in the
INITIAL static HTML. Investigate whether instead ProjectScope is suspended/streamed (a dynamic hole),
so default paints first and the correct hue lands when the hole streams in or React adopts a
`<style href precedence>`. Determine: is the theme <style> inline `dangerouslySetInnerHTML` in the
shell, or a streamed/precedence style? Is ProjectScope a Client Component re-theming on mount?

SOURCES OF TRUTH — open, don't recall (Next 16 / React 19 — memorized streaming/precedence behavior
is unreliable here):
- docs/decisions.md → D11 Axis A (ProjectScope in prerendered shell = flash-free), D13 (inline
  <style> flush-before-paint vs `<style href precedence>` only when suspended). Cite [D#].
- node_modules/next/dist/docs/ → Server/Client Components, Suspense/streaming, and PPR/cacheComponents
  guides; React 19 <style> precedence behavior.
- The ProjectScope render tree on <BRANCH>: where it sits relative to <Suspense>, and 'use client'.

BOUNDARIES: read-only. You own the RSC RENDER + STREAMING + hydration seam only. Cache → Cacheford;
CSS layers → Layerton. Use Probe for traces; don't self-instrument.

OUTPUT: dense cited digest — (1) verdict: is the theme <style> outside the prerendered shell / applied
post-paint? (2) evidence (where ProjectScope renders, initial-HTML vs streamed, trace timing), (3)
what disproves it, (4) one fact-based attempt to disprove Cacheford or Layerton. Message them directly.
```

### → Teammate **Probe** (model: sonnet — tool-driven evidence gathering)

```
You are Probe, the EVIDENCE REFEREE on a debugging team. You own no theory. Your job: produce the
ground-truth timeline of the flash that all three theories (cache, @layer, hydration) must explain.

SYMPTOM (shared, verbatim): On /work/<slug>, the brand color renders the WRONG HUE for a split second
on first paint, then snaps to correct. REPRO: checkout <BRANCH>; pnpm install; pnpm build && pnpm
start (and also pnpm dev). The route/engine exist ONLY on <BRANCH>, not main — if it does not render
there, SAY SO IMMEDIATELY to the lead; there may be no reproducible bug.

DELIVERABLES (publish to all teammates):
1. The exact slug + URL that reproduces, and whether it reproduces in prod build vs dev only.
2. A chrome-devtools performance trace + screenshots capturing the wrong-hue frame and the
   corrected frame, with timestamps (use the chrome-devtools MCP/skill — D25 requires browser
   verification of rendered surfaces).
3. The `pnpm build` <head> / initial-HTML check (per D11's empirical step): is the scoped theme
   <style> present in the INITIAL static HTML, or does it arrive in a streamed chunk? What
   oklch()/brand value is in that first <style>? Count `<link rel=preload as=font>`.
4. The computed brand custom-property value at first paint vs after correction.

SOURCES: docs/decisions.md D11 (empirical <head> check), D3, D12, D13; chrome-devtools skill.
BOUNDARIES: you MAY add temporary instrumentation, but ONLY on your own throwaway branch
`debug/flash-probe` cut from <BRANCH> — never on <BRANCH> itself, so probes don't collide. Don't
argue theories; deliver facts. Cite [D#] where a deliverable maps to a decision.

OUTPUT: a timeline doc (wrong-hue value @ T0 → correct-hue value @ T1, with what changed between)
plus the build <head> findings. This is the shared evidence base; post it early so the theory-owners
can test their hypotheses against it.
```

---

## 4. Closing the loop (lead's job)

1. **Hold the evidence first.** Wait for Probe's timeline before letting the theory-owners declare
   verdicts — a theory "survives" only by explaining Probe's facts, not by sounding reasonable
   (debugging.md §"evidence over plausibility").
2. **Drive the debate, don't vote.** Each theory-owner must (a) explain Probe's wrong-hue-→-correct
   transition under its theory and (b) survive the other two's disproof attempts. Most likely the
   timeline discriminates cleanly: if the wrong hue is in the **initial static HTML's `<style>`** →
   Cacheford (cache served stale literal) or Layerton (a rule outranks it) is live and Hydra is out;
   if the correct `<style>` is **absent from initial HTML and streams in late** → Hydra is live and
   the other two are out. I will **not smooth a fake consensus** (SKILL §1): if two causes are
   genuinely co-occurring (e.g. layer order AND streaming), I say so and rank them.
3. **Record the trail.** Write a findings doc mirroring `docs/audit/` — the confirmed root cause
   **and each disproven theory with why it was ruled out**, so the next investigator doesn't
   re-tread. Cite the `[D#]`s and Probe's evidence.
4. **Then fix, on a branch, never `main`.** A single-layer fix (e.g. move ProjectScope into the
   prerendered shell per D11 Axis A; or layer a stray module per D12) → one follow-up task. A
   cross-layer fix → escalate to the coding-feature mode (own-a-slice, gate-green, lead
   squash-merges). Gate before merge: the full chain in `AGENTS.md` (`pnpm lint:css` especially, for
   any D12 fix). If the fix changes the render seam, Probe re-runs its browser check to confirm the
   flash is gone (D25).
5. **Shut down** Cacheford, Layerton, Hydra, Probe by name once the cause is recorded.

```

```
