# Devil's-Advocate Debate — Accessibility & Performance

Reviewer pass on `round-1-drafts/accessibility-and-performance.md`. Attacked on four axes:
accuracy, right-sizing, consistency, agent-usefulness. Format: **concede → attack → fix.**

Verdict up front: this is one of the stronger drafts. The "contrast is solved by the engine,
consume the token" framing is exactly the load-bearing rule for this repo, the font-preload
section is correct against the _installed_ Next 16 docs (verified), and it points to the plan
instead of re-explaining it. But it ships **one genuine accuracy bug** (the WCAG large-text
threshold), **one cross-doc ownership collision** with `testing.md`, and a **link-path
fragility** that will silently break on promotion. Those three are required changes; the rest
are tighten-ups.

---

## Axis 1 — ACCURACY

### A1. **[REQUIRED] WCAG large-text threshold is wrong — points, not pixels.** (line 39)

> `| Large text / headings (≥ 18px or 14px bold) | ≥ 3:1 (1.4.3) |`

WCAG 2.2 SC 1.4.3 defines "large-scale text" as **18 point (≈ 24px) or 14 point bold
(≈ 18.66px)** — the unit is **points**, and the dictionary entry is explicit
([W3C, Contrast (Minimum), Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)).
The draft writes "18px / 14px bold," which **understates both bars by ~6px and ~5px.** An
agent that copies this checklist will green-light 18px body text at 3:1 — which actually
**fails** AA (it needs 4.5:1). This is the worst kind of error in a "verify-against"
checklist: it's confidently wrong and ships non-conformant UI.

**Fix:** `≥ 18pt (≈24px), or ≥ 14pt bold (≈18.66px)`. State the unit is point. If you want a
px-only shorthand for agents who only think in px, say "≈24px / ≈18.66px bold" and footnote
that WCAG specifies points.

### A2. **[concede] Font-preload mechanics are correct against installed Next 16.2.9.** (§4)

Verified against `node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`:

- "`next/font` default is `true`" — confirmed (font.md L186: _"The default is `true`."_). ✓
- "preload injection is a build-time static transform keyed to a statically referenced font
  object" — confirmed by the preload-scoping rules (font.md L1046–1051: a font is only
  preloaded on routes where the font _function reference_ lives — page/layout/root). A runtime
  `roster[fontKey].variable` index is not a static reference, so it can't be targeted. ✓
- `crossorigin` required on a manual font preload link — correct, standard CORS-for-fonts
  fact (fonts are always fetched in CORS mode), independent of Next. ✓
- "Prefer variable fonts" — matches the getting-started doc's explicit recommendation
  (13-fonts.md L177). ✓

No stale model memory here. Good.

### A3. **[concede] INP/FID and CWV budgets are accurate.** (§3)

"INP replaced FID, 2024" is correct (INP became the third Core Web Vital in March 2024).
LCP ≤ 2.5s / INP ≤ 200ms / CLS ≤ 0.1 at p75 all match
[web.dev/vitals](https://web.dev/articles/vitals). ✓

### A4. **[concede] APCA-is-not-legal-cover framing is accurate and important.** (lines 10–13, 137)

APCA is the candidate method for the still-unreleased WCAG 3, not a conformance standard —
the draft states this correctly and tells agents not to claim "WCAG 3 compliant." This is a
real trap and the draft defuses it. ✓

### A5. **[minor] "baseline 2025" for `light-dark()` is asserted in [D5], not here — fine,**

but the draft leans on `light-dark()` indirectly via §3.2 without restating the support
claim, so nothing to fix. The one thing to watch: the APCA Lc threshold numbers (Lc 75 body,
Lc 45 large, Lc 60 non-body, Lc 30 UI, Lc 15 floor) are the **APCA "Bronze Simple"
readability tiers** — they're a _design guideline_, not a ratified standard. The draft
already frames them as a "quality target," which is the honest framing. **Suggested:** add a
one-line provenance note ("APCA Lc tiers per the APCA Readability Criterion / Bronze guidance
— a guideline, not a ratified threshold") so an agent doesn't cite "Lc 75" as a standard the
way it'd cite "4.5:1."

---

## Axis 2 — RIGHT-SIZED vs OVER-ENGINEERED

### B1. **[concede] The doc is right-sized.** No governance theater, no SLAs. It's a checklist

with copy-pasteable commands. The engine-does-the-contrast framing actively _removes_ work
from agents rather than adding ceremony. This is the correct altitude for a solo
agent-driven repo.

### B2. **[minor over-reach] The full APCA threshold table may be more than an agent can act on.**

(lines 36–43)

For a repo where **the engine solves contrast and the agent never hand-picks a ΔL** (the
doc's own central rule), six rows of APCA Lc thresholds are reference data the agent will
almost never apply by hand — the _engine_ applies them. The rows an agent actually uses
manually are the WCAG floors for the rare "you must author a static color" case (line 30–32).

**Not a cut — a re-frame.** Keep the table (it documents what the engine targets, and the
testing harness asserts against it), but add one line above it: _"You consume these via
tokens; you only check them by hand in the rare static-color case (§1 bullet 3). They're here
so the engine's targets and the harness's assertions have one source of truth."_ That earns
the table's place and tells the agent when it's _their_ job vs the engine's.

### B3. **[keep] The `@supports not (selector(:focus-visible))` fallback (lines 66–67)** is

borderline — it's defensive coding for browsers that are now vanishingly rare (`:focus-visible`
is Baseline since 2022). For a 2026 portfolio targeting modern browsers this is arguably
gold-plating. **But** it's one line and it's correct, so I'd keep it as a "do it right"
nudge rather than flag it as theater. Marginal call; leave to author.

---

## Axis 3 — CONSISTENCY

### C1. **[REQUIRED] Contrast-harness ownership collides with `testing.md`.** (lines 45–50)

The author's own debate note flags this, and it's real. The draft's §1 closing paragraph
("The Phase-1 visual harness is where this is proven… ramps for 3–4 hue-spanning colors…
must include a yellow and a cyan… both light and dark… assert the measured number") is
**near-verbatim duplicated** in `testing.md`'s "Phase-1 visual contrast harness" section,
which _also_ says "3–4 brand colors… MUST include a yellow and a cyan… light and dark…
asserting APCA Lc / WCAG ratios… after gamut-mapping." Two docs, one spec, stated twice. When
the harness spec changes (e.g. it becomes 5 colors), they drift.

`testing.md` already declares itself the owner: D19 folds "accessibility/contrast assertions
into Phase 1's engine harness," and `testing.md` says _"This is where accessibility/contrast
assertions live."_ `testing.md` even links **here** for the Lc _targets_. That's the right
split — so this doc shouldn't restate the _harness mechanics_.

**Fix:** In this doc's §1, cut the harness mechanics down to a pointer:
_"The engine's contrast targets above are proven by the Phase-1 visual harness — owned by
[`./testing.md`](./testing.md) (the yellow/cyan stressers, both schemes, assert-the-measured-
number rule live there). This doc owns the **targets**; testing owns the **assertions**."_
Keep the "don't snapshot the CSS — assert the measured number" _principle_ in only one place
(testing.md has it; here, drop or one-line-reference it). That gives a clean two-doc contract:
**A&P owns thresholds, testing owns the harness.**

### C2. **[concede] No contradictions with the 23 ADRs.** Spot-checked the load-bearing ones:

- D4 (contrast solved, not stepped) — draft §1 restates it correctly, including
  gamut-map-before-contrast (D6) and re-solve-per-scheme (D5). ✓
- D7 (focus-ring color = engine token, geometry = global) — draft §2 splits these exactly
  right, including the "don't smuggle a focus color into the global reset" nuance from D7's
  own text. ✓
- D11 (preload:false default; static-analyzability ≠ SSG) — draft §4 nails the "this is a
  static-analyzability question, NOT SSG-vs-dynamic" distinction, which is the _whole point_
  of D11. ✓
- D17 (CWV verified Phase 4, not gated early) — draft §3 closing line matches. ✓

### C3. \**[REQUIRED-ish, mechanical] Link-path depth is correct *today\* but violates house style

and will break on promotion.\*\* (lines 6, 149–154)

The draft is in `docs/handbook/process/round-1-drafts/`, so `../../../architecture-plan.md`
resolves correctly to `docs/architecture-plan.md` (verified — the file exists at that depth).
**But** the handbook house style says docs live in `docs/handbook/` and should link
architecture as `../architecture-plan.md` and siblings as `./<file>.md`. When this draft is
promoted from the `round-1-drafts/` staging dir up to `docs/handbook/`, **every
`../../../` architecture link becomes a broken two-too-deep path**, and the sibling links
(`./security-and-ops.md` etc.) will only work if the siblings move together.

Note `definition-of-done.md` (a sibling draft) already uses `../../architecture-plan.md`
(two levels) — which is _also_ wrong from the current location and proves the drafts disagree
with each other about depth. **There's an inconsistency between siblings right now.**

**Fix:** Decide once (debate-level, applies to all drafts): either (a) author the drafts with
the _destination_ (`docs/handbook/`) relative paths and accept they're broken in staging, or
(b) keep staging paths and fix them in the promotion commit. Whichever — make this doc match
its siblings. Today they don't agree.

### C4. **[concede] Doesn't duplicate the architecture plan — it points to it.** §3.2/§7

references instead of re-explaining the engine and PPR. Exactly the handbook's mandate. ✓

---

## Axis 4 — AGENT-USEFULNESS

### D1. **[concede] The empirical `<head>` check is the single most useful thing in the doc.**

(lines 120–128) A cold agent can run `pnpm build`, view-source `/work/<slug>`, count preload
links, and _know_ the policy holds. That's exactly the "concrete command, verifiable outcome"
the house style wants. ✓

### D2. \*\*[REQUIRED — the check is incomplete] The `<head>` check has no actual command for the

count.\*\* (lines 122–128)

The code block is:

```bash
pnpm build
# visit /work/<slug>, view-source the <head>, then count preload links:
```

…and then the block **ends**. The comment promises a count and delivers nothing — the agent
is told to "count" but given no command and no expected number to compare against. "Expect
preload links for the shell faces only" is prose below, not an assertion the agent can run.

**Fix:** Give a runnable count against the dev/preview server, e.g.:

```bash
pnpm build && pnpm start &   # or hit the Vercel preview URL
curl -s http://localhost:3000/work/<slug> \
  | grep -o '<link rel="preload" as="font"[^>]*>'
# Expect ONLY your 1–2 shell faces. A per-project face here = policy defeated.
```

An agent can diff that output against the known shell-face filenames. As written, the agent
has to invent the verification step — which defeats "verify, don't assume."

### D3. **[minor] "≥ 18px or 14px bold" (the A1 bug) is also an agent-usefulness failure** —

it's the kind of line an agent copies verbatim into a code comment or a review. Doubly worth
fixing.

### D4. **[concede] The "Agent quick-list (the traps)" is excellent.** Seven numbered, specific,

copy-paste-able rules, each tied to a `[D#]`. A cold agent could work off that list alone.
This is the model for how every handbook doc should end.

### D5. **[minor] §2 row 2.5.8 "Nav links, /work cards, embed controls" is good and specific —**

but "or adequately spaced" (line 61) is the WCAG 2.5.8 exception and agents will reach for it
to dodge the 24px rule. **Suggested:** add the actual exception bar — _"spacing exception: a
≥24px-diameter circle around the target's center must not overlap another target's"_ — or
just drop "or adequately spaced" so the rule reads as a firm 24×24 floor. As written it's a
loophole with no definition.

---

## Summary of REQUIRED changes (in priority order)

1. **Fix the WCAG large-text threshold (A1):** points, not pixels — `≥18pt (≈24px) / ≥14pt
bold (≈18.66px)`. The current "18px/14px" understates the bar and will ship 18px text at
   3:1 that actually fails AA.
2. **Resolve the contrast-harness ownership collision with `testing.md` (C1):** this doc owns
   the **targets/thresholds**; `testing.md` owns the **harness mechanics** (yellow/cyan,
   both schemes, assert-the-measured-number). Cut the duplicated harness spec here to a
   pointer.
3. **Complete the empirical `<head>` check (D2):** the code block promises a count and gives
   no command. Add a runnable `curl … | grep` (or equivalent) with an expected result.

## Recommended (not blocking)

4. Fix/align the relative link depth so siblings agree and survive promotion to
   `docs/handbook/` (C3).
5. Add one provenance line for the APCA Lc tiers (guideline, not standard) and one "you
   consume these via tokens; hand-check only the static-color case" line above the threshold
   table (A5/B2).
6. Define or drop the 2.5.8 "or adequately spaced" loophole (D5).
