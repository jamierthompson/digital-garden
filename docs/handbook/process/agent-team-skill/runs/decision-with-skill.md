# Orchestration Plan — Settle the OKLCH engine emission/signature decision

**Lead:** this session. **Mode:** Research / Architecture Decision (`agent-team` skill → `references/research-decision.md`).
**Decision under question:** does the OKLCH engine emit **both** schemes in one scoped block via CSS
`light-dark()`, or **store per-scheme tokens** (two resolved token sets, switched by `[data-scheme]` /
`color-scheme`)? This locks the engine's public signature — `(brandColor, scheme) → tokenSet` vs.
`(brandColor) → { light, dark }` — for **every** project module, so it is architecture-class.

---

## 0. Preflight

### 0a. Is a team even the right tool here?

**Yes — this is the canonical case for the research/decision mode**, with one critical caveat (0c).
Against the skill's decision table:

- **Hard to reverse, crosses a boundary, locks an external contract.** The engine signature is the
  invariant every project module composes against (AGENTS.md: "each project … on a shared invariant
  foundation"). Changing it later means touching the engine _and_ every consumer + the scoped `<style>`
  emission path. That is exactly the "locks a contract → architecture-class" trigger in
  `references/research-decision.md`.
- **Genuine, defensible disagreement exists** — `light-dark()` (less CSS, pure-CSS switching, but
  couples both schemes into one value function) vs. per-scheme token sets (more bytes, but each scheme
  is independently inspectable/overridable and trivially testable). Workers need to **challenge and
  disprove each other** on browser-support facts, FOUC behavior, and isomorphism — not just fetch a
  result. That's the team-vs-subagent line.
- It is **not** sequential same-file work (single session) and **not** mere verbose fetching
  (subagents). It's parallel exploration across distinct lenses that must converge.

**Cost honesty:** this mode is ~15× single-agent tokens. Justified here because the call is durable and
repo-wide. I'd refuse a team for anything smaller.

### 0b. Can a team run at all?

**Confirmed enabled.** `grep` found `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"` in
`~/.claude/settings.json`. No blocker; spawning will work.

### 0c. The decisive preflight finding — this question is _already decided_ as `[D5]`

Reading `docs/decisions.md` first (per AGENTS.md "verify, then write"):

> **D5 — Dark mode is in scope from v1; engine signature is `(brandColor, scheme) → tokenSet`**
> _Decided (user call, 2026-06-21)._ … "The scoped `<style>` emits both via CSS `light-dark()`
> (baseline 2025) so one block carries both schemes and switching is pure CSS (`color-scheme`) …
> **No per-scheme field on the doc** (per D16/ContentModel) … an _optional_ `brandColorDark` override,
> defaulted from the engine — never a required parallel field."

So the user's two options map exactly onto **D5 (light-dark) vs. the alternative D5 rejected**.
**Decisions in this repo are immutable** (`docs/handbook/decision-records.md`; skill §3) — you supersede,
never edit. That reframes the whole job and I will not let the team "discover" D5 cold:

- The honest deliverable is **not** "pick a winner from scratch." It is: **does new evidence justify
  superseding D5, or does D5 stand reaffirmed?** Every brief states D5 up front and demands teammates
  engage it directly (defend or build a cited case to supersede).
- A second ground-truth check: **the engine does not exist yet.** `find src -path '*oklch*'` is empty;
  per D17/D22 the oklch-engine is the _second_ Phase-4 slice. So there is **no engine code to read** —
  teammates must be grounded in `docs/architecture-plan.md` (§3.2, §6), `docs/decisions.md`
  (D3–D9, D12, D14, D16), and the **bundled Next docs** for the rendering/FOUC facts — not source.

I will surface this to the user before spending team tokens: _"D5 already chose light-dark(); a team here
is a deliberate re-litigation to either reaffirm with fresh evidence or supersede. Proceed?"_ If they only
wanted a refresher on why D5 was chosen, that's a single-session answer, not a team.

---

## 1. Pattern & why

**research → N independent drafts → adversarial debate → cited synthesis → superseding/affirming `[D#]`.**
This is the shape `docs/audit/` and `docs/handbook/process/` already ran to completion in this repo, so
it produces an artifact trail the next session can read as external memory. Diversity of lens is the whole
point: identical agents add nothing, so each teammate drafts **independently before seeing the others**,
then they challenge each other with **fact-grounded** critiques (cite a doc/`[D#]`/spec, not vibes —
`docs/audit/round-2-debate.md` is the texture to match).

**4 lens teammates + lead-as-synthesizer** (skill's 3–5 sweet spot). No code is written — this is a
decision, so no plan-approval gate is needed and no file-ownership conflicts on `src/` arise; the only
shared artifacts are the per-lens draft files, each owned by one teammate.

**One shared research subagent first (cheap, not a teammate):** before drafting, I dispatch a single
`Explore`/general subagent to return a dense cited digest of the _factual_ questions (light-dark() +
`color-scheme` baseline/browser-floor status; SSR/streaming FOUC interplay in Next 16). This isolates
verbose fetching so the four lens teammates argue over a shared fact base instead of each re-fetching.

---

## 2. Work division (4 lenses, distinct concerns, distinct files)

| Teammate                          | Owns the question of…                                                                                                                                                                                                                                              | Owns draft file                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| **Theming**                       | CSS emission mechanics: does `light-dark()` survive the `@layer` model (D12 trap), `color-scheme` switching, flash-free first paint, gamut/P3 (D6), token-override ergonomics                                                                                      | `round-1-drafts/theming.md`             |
| **FrameworkFit**                  | Are the _factual_ claims true on the installed stack? `light-dark()`/`color-scheme` baseline + browser floor, Next 16 SSR/streaming + hydration/FOUC, `prefers-color-scheme` default — verified against bundled docs + spec, **not memory**                        | `round-1-drafts/frameworkfit.md`        |
| **EngineAPI (Architect)**         | The signature itself: `(brandColor, scheme)→tokenSet` vs `(brandColor)→{light,dark}`; isomorphism constraint (D14, no `server-only`/`client-only`); defensive no-throw (D9); right-sized vs over-engineered; reversibility cost across all projects                | `round-1-drafts/engine-api.md`          |
| **DevilsAdvocate / ContentModel** | **Steelman per-scheme token storage** so the debate is real; plus the content-model axis — D16 "scheme is a render-time axis, no per-scheme doc field," the optional `brandColorDark` override (D9), testability of two independent sets (D17 dual-scheme harness) | `round-1-drafts/per-scheme-advocate.md` |

This split has no overlap: mechanics vs. platform-facts vs. API-shape vs. the rejected alternative's best
case. If two teammates duplicate, the fix is a sharper brief — **not** a fifth teammate.

---

## 3. Verbatim spawn briefs

> Common preamble appended to **all four** (skill §1 "cite-don't-remember"):
> _"You are a teammate on a decision team led by this session. Start from a fresh context: you can see
> only this brief. Verify every framework/platform claim against the version-exact bundled docs at
> `node_modules/next/dist/docs/` and named spec URLs — this repo is Next 16.2.9 / React 19.2.4 and
> memorized APIs are wrong often enough to be dangerous (AGENTS.md 'the one rule'). The OKLCH engine is
> NOT yet implemented (`src/lib/oklch/` does not exist), so there is no engine source to read — ground
> yourself in the cited docs/decisions below. Output ONLY a dense, cited digest to your owned file (≤2
> pages); pin each claim to a primary source (a bundled-doc path, a spec/MDN/caniuse URL, or a `[D#]`).
> Do NOT edit any other file, any `src/` code, or `docs/decisions.md`. Decisions in this repo are
> immutable — if you want to overturn D5 you must make a citable case to SUPERSEDE it, not edit it."_

### Teammate: **Theming**

```
Objective: Decide, on CSS-mechanics grounds, whether the OKLCH engine's scoped <style> should emit BOTH
schemes via CSS light-dark() (status quo per [D5]) or emit per-scheme token sets switched by color-scheme
/ a [data-scheme] selector. Argue mechanics only; leave platform-support facts to FrameworkFit.

Read first (source of truth, by path):
- docs/decisions.md — D5 (the standing call), D3 (bake oklch() literals server-side), D4 (contrast solved),
  D6 (gamut-map before contrast), D7 (focus-ring token), D12 (every CSS Module declares @layer — "the
  @layer trap": an unlayered block outranks every @layer style), D14 (isomorphic engine).
- docs/architecture-plan.md §3.1–§3.2 and §6 (cascade tiers, scoped <style> emission).
- docs/handbook/engineering-standards.md (the @layer rule + rationale).

Specifically resolve:
1. Does a light-dark() value INSIDE a @layer block behave correctly, or does per-scheme emission interact
   better/worse with the foundation|brand|project layering of [D12]? Cite the cascade behavior.
2. Flash-free first paint: which approach risks a scheme-flash on SSR first paint, and how is it avoided?
3. Token-override ergonomics: D3 keeps var(--public, var(--_internal-default)) for downward theming and an
   optional brandColorDark ([D5]/[D9]) — which emission shape makes that override cleaner?
4. Byte cost of duplicating ramps vs. one light-dark() block, at the per-project scoped-<style> level.

Boundaries: mechanics + cascade only. Don't re-derive browser support (FrameworkFit owns it). Don't touch
code. Output: round-1-drafts/theming.md — recommendation + the 2–3 facts that would change your mind.
Model: default (Sonnet) is fine; this is well-scoped.
```

### Teammate: **FrameworkFit**

```
Objective: Establish the GROUND-TRUTH platform facts that the light-dark() vs per-scheme-token choice
turns on, verified against the installed stack — not memory. You are the team's fact-checker; the other
lenses will cite you.

Read first (source of truth, by path):
- node_modules/next/dist/docs/ — the App-Router rendering/streaming + metadata/color-scheme guidance for
  the INSTALLED version. Quote file paths.
- docs/decisions.md — D5 (claims light-dark() is "baseline 2025" and switching is "pure CSS"), D14
  (engine must stay isomorphic — no server-only/client-only), D11 (prior "verified against installed
  docs" precedent).
- Spec/support sources by URL: MDN light-dark() and color-scheme pages; web.dev/caniuse baseline status.

Specifically resolve (cite the source that ACTUALLY contains each fact):
1. Is CSS light-dark() genuinely Baseline as D5 claims? State the browser floor and any gap vs. this
   project's support target. If the claim is stale, say so — that alone could justify superseding D5.
2. prefers-color-scheme default + a manual toggle: does pure color-scheme switching work without JS, and
   does it cause an SSR/hydration mismatch or FOUC in Next 16 streaming? Per-scheme [data-scheme] needs a
   class on <html> before paint — does that force a blocking inline script (a cost light-dark() avoids)?
3. Does either approach pull the engine toward a client boundary and threaten the [D14] isomorphism lint?

Boundaries: facts only — don't make the architectural call (Architect owns it). Don't touch code.
Output: round-1-drafts/frameworkfit.md — a fact table, each row with a citation + confidence.
Model: STRONGER reasoning tier (Opus) — this is the verification load-bearing lens; a wrong support fact
poisons the whole decision.
```

### Teammate: **EngineAPI (Architect)**

```
Objective: Make the abstraction-altitude call on the engine's PUBLIC SIGNATURE, since that is what locks
for every project. Compare (brandColor, scheme) -> tokenSet  [status quo, D5]  against
(brandColor) -> { light, dark }  [emit both, caller picks]  against a per-scheme-store variant.

Read first (source of truth, by path):
- docs/decisions.md — D5 (current signature), D3 (server-side literals, no live re-derivation goal),
  D4 (contrast re-solved per scheme), D9 (three-layer defensive engine, never throw; brandColorDark),
  D14 (isomorphic — no server-only/client-only in src/lib/oklch/), D16 (scheme is a render-time axis).
- docs/architecture-plan.md §3.2 and §6 (engine role, ProjectScope composition).
- docs/build-phases.md / D17, D22 (engine is the 2nd Phase-4 slice — not built yet).

Specifically resolve:
1. Which signature minimizes coupling for every downstream project module while honoring D4 (contrast
   re-solved per scheme) and D9 (defensive, returns a fallback palette, never throws)?
2. Reversibility: if we pick wrong, what's the blast radius across engine + all consumers + scoped <style>?
   Which option is the cheaper mistake to unwind? Weight the recommendation by this.
3. Is scheme-as-parameter vs. scheme-as-return-shape over- or under-engineered relative to actual needs
   (D3: no consumer needs live per-token override)?

Boundaries: API shape & coupling only; defer CSS mechanics to Theming and platform facts to FrameworkFit.
Don't touch code. Output: round-1-drafts/engine-api.md — recommended signature (exact TS type), the
trade-off table, and the disconfirming evidence that would flip you.
Model: STRONGER tier (Opus) — this is the load-bearing architectural judgment.
```

### Teammate: **DevilsAdvocate / ContentModel**

```
Objective: Build the STRONGEST honest case for per-scheme token storage (the option D5 rejected), so the
debate is real and D5 isn't reaffirmed by default. Also own the content-model axis. Your job is to make
the team work to keep D5 — concede only on cited facts.

Read first (source of truth, by path):
- docs/decisions.md — D5 (what it rejected and why), D16 (no per-scheme doc field — "scheme is a
  render-time axis, not authored content"), D9 (optional brandColorDark override, defaulted from engine),
  D17 (Phase-1 visual harness asserts contrast in BOTH schemes), D4 (per-scheme contrast).
- docs/architecture-plan.md §3.2 (token model) and the ContentModel lens framing in docs/audit/README.md.

Specifically argue:
1. Independent inspectability/testability: per-scheme sets are two plain token maps you can snapshot and
   diff per scheme (D17 harness) — is that materially easier to test than one light-dark() block? Cite how.
2. Override path: does a hand-tuned dark brand (brandColorDark, D9) compose more cleanly when each scheme
   is its own resolved set, vs. threading a second value into light-dark()?
3. Where does per-scheme storage LOSE? Be honest — byte cost, two-source-of-truth drift risk, D16 pull
   toward an authored field. State the line past which you concede to D5.

Boundaries: you may argue to supersede D5 but must cite to do so; never edit decisions.md. Don't touch
code. Output: round-1-drafts/per-scheme-advocate.md — the steelman, then your honest concession line.
Model: default (Sonnet).
```

(Research subagent — dispatched before the four, NOT a teammate, via the `Agent` tool / `Explore`:
_"Return a dense cited digest: (1) current Baseline/browser-floor status of CSS `light-dark()` and
`color-scheme` with MDN+caniuse URLs; (2) whether Next 16 App-Router streaming SSR causes a scheme-flash
or hydration mismatch for pure-CSS `color-scheme` switching vs. a `[data-scheme]` class needing a
pre-paint script — cite `node_modules/next/dist/docs/` paths. Facts only, ≤1 page, every line cited."_)

---

## 4. Adversarial debate (round 2)

Once the four drafts land, I post a debate prompt to all four and have them **message each other
directly** (the thing teams do that subagents can't): each must challenge ≥2 others' drafts with a
**fact-grounded** critique that cites a bundled-doc path / spec URL / `[D#]` — a critique is only valid if
it cites the source that _actually contains_ the fact (`docs/audit/round-2-debate.md` standard). The live
flashpoints I'll steer toward: FrameworkFit's baseline finding vs. Theming's `@layer`-trap concern vs.
DevilsAdvocate's testability claim vs. Architect's reversibility weighting. I monitor and redirect; I do
**not** start drafting myself while they work. Each teammate appends its concessions/holds to a shared
`round-2-debate.md`.

## 5. Closing the loop (lead's job)

1. **Synthesize** one cited verdict in `synthesis.md`. **No fake consensus** — where lenses genuinely
   disagree I state which view won _and why_, and it's healthy if some critiques are **rejected on
   verification** (the handbook synthesis rejected two; that's the pattern working).
2. **Record the call as an immutable `[D#]`** in `docs/decisions.md`:
   - If D5 holds → a short **`D24 — reaffirms D5`** entry noting the re-litigation and the fresh evidence
     that confirmed it (so this isn't reopened a third time).
   - If the evidence overturns it → **`D24 — supersedes D5`**, stating the new signature/emission and
     exactly what changes. Never edit D5 in place; mark it superseded-by-D24.
3. **Persist the trail** as external memory, mirroring `docs/audit/`: a new folder (e.g.
   `docs/decisions/engine-signature/`) holding `round-1-drafts/*`, `round-2-debate.md`, `synthesis.md`,
   plus a README routing table like `docs/audit/README.md`. (The eval copy lands under this task's
   `outputs/`; the real artifact lands in-repo on a `docs/…` branch — **never commit to `main`**, per the
   guardrails — for the user to review.)
4. **Shut down** the four teammates by name; team directories auto-clean at session end.

**Net:** the team's real output is not "which is better in the abstract" — it's a **cited, debate-tested
verdict on whether to reaffirm or supersede `[D5]`**, recorded immutably with its evidence trail.
