# Adversarial QA — `feat/harmony-tier-tokens` (260e53f, issue #334)

Independent QA, no prior context of the slice. Worktree: `.worktrees/qa-harmony`,
branch `qa/harmony-tier-tokens`.

**Verdict: one real defect (guard gap), two low-severity observations. Every substantive
correctness claim in the commit message held up under measurement.**

---

## Defects

### D1 — `pnpm lint:icon` is blind to the 7 new harmony text roles · **Medium** · RED test

The slice added seven roles solved at the `accentText` tier — WCAG 4.5:1 + APCA Lc 60
(`packages/oklch/src/targets.ts:26`, bound by the `harmony-<hue>-text` entries in
`DEFAULT_BINDING_SCHEMA`, `packages/oklch/src/palette.ts:314-404`). They are text roles by the
engine's own contract.

`scripts/check-icon-roles.mjs:39-40` still enumerates only the pre-#334 names:

```js
const TEXT_TIER =
  /var\(\s*--(muted-foreground|accent-text|(error|warning|success|info)-text)\s*[,)]/i;
```

**Reproduction** — identical rules, opposite verdicts:

```css
.icon {
  color: var(--accent-text);
} /* → 1 violation (correct) */
.icon {
  color: var(--harmony-complementary-text);
} /* → 0 violations (WRONG) */
```

**Impact.** A component CSS Module may paint an icon, mark, glyph or `svg` from a 4.5-solved
TEXT role and the whole gate stays green. That is precisely the
[WCAG 2.2 SC 1.4.11](https://www.w3.org/TR/WCAG22/#non-text-contrast) hole the guard exists to
close — now seven tokens wide. It is latent today only because nothing consumes the harmony
tokens yet; the first consumer is exactly when it bites, and by then the guard reads green.

**Test pinning it (currently FAILING):**
`scripts/check-icon-roles.test.ts` → `FAILS the harmony text roles — 4.5-solved text tier like
every other --*-text (#334)`

**Companion test (passing) to constrain the fix:**
`PASSES the harmony anchor + fill — decorative and ui-tier, both legal graphic ink (#334)` —
the bare anchor is decorative and `-fill` is `ui`-tier (3:1 + Lc 45), i.e. exactly the tier a
graphic _wants_. So the fix must match the `-text` suffix, **not** a blanket `--harmony-`.

> Note: the sibling guard `pnpm lint:color` has **no** such gap — it derives its token-name set
> from `src/styles/semantic/color.css` (`scripts/check-color-immutability.mjs:30-37`), which the
> slice regenerated, so all 21 new tokens are protected automatically. D1 is the one guard that
> hardcodes its list.

---

## Observations (no fix requested — pinned so they cannot erode)

### O1 — the decorative anchor is not _literally_ the seed color · Low

`packages/oklch/src/binding.ts:186-188` describes the bare token as "seed L (and chroma,
gamut-mapped) at the role's hue", which reads as an exact L reproduction. Measured across an
L×C×H grid:

| case                                                  | max \|ΔL\| vs `seed.L` | cause                              |
| ----------------------------------------------------- | ---------------------- | ---------------------------------- |
| ordinary in-gamut seed (`#3b82f6`)                    | ~0.007                 | per-step gamut map                 |
| lightness extreme (`#ffffff` → 0.98; `oklch(0.05 …)`) | **0.125**              | ramp EDGE clamp, `ramp.ts:188-190` |

Both are documented mechanisms and both are shared with the **accent** ramp, so this is
pre-existing engine behavior, not something #334 introduced. Pinned with explicit bounds in
`harmony-tokens.test.ts` ("lands within 0.02 L…", "is CLAMPED, not equal to the seed…").

### O2 — out-of-gamut harmony steps drift off the requested hue by up to ~4.1° · Low

E.g. seed hue 15°, `split-complementary-a`: requested 165°, delivered 160.9°. Drift correlates
**exactly** with `oog === true`; every in-gamut step is 0.000° off. The accent ramp shows the
same shift on its own out-of-gamut steps, so it is the mapping trading hue for gamut
membership — engine-wide, not harmony-specific. Bounded at 5° by a test.

---

## Claims verified (all held)

| Claim                                                                        | How it was checked                                                                                                                | Result                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-fill` clears 3:1/Lc 45 and `-text` clears 4.5:1/Lc 60 on **every** surface | 21 tokens × 22 hostile seeds × 2 rule sets × 2 gamuts × 2 schemes × **all 5 surfaces**                                            | **0 failures** — the "solve the worst case ⇒ holds everywhere" claim is real                                                                                                                                                                       |
| `resolveHarmonyTier` refactor is output-identical                            | Reconstructed the pre-refactor `buildRamp` + `minPass` computation independently and demanded agreement on ramp, color, and label | **0 diffs** across 22 seeds × 2 schemes × 7 hues                                                                                                                                                                                                   |
| Golden fixture is a pure addition                                            | Flattened both revisions, compared every leaf                                                                                     | 9376 pre-existing leaves: **0 changed, 0 removed**, 8176 added                                                                                                                                                                                     |
| Never throws / falls back                                                    | 22 hostile inputs incl. `NaN`, `{}`, `[]`, `""`, numbers, alpha-carrying, unparseable                                             | no throw; `isFallback` true; all 21 tokens still emitted and finite                                                                                                                                                                                |
| Determinism                                                                  | Repeated builds byte-compared; dark-first vs dark-after-light                                                                     | byte-identical; scheme resolution is order-independent                                                                                                                                                                                             |
| All 59 tokens delivered to the page                                          | Grepped the built `.next/server/app/system.html`                                                                                  | 21 `--harmony-*` properties present (60 inline custom properties total)                                                                                                                                                                            |
| Hue rotation normalizes across 0/360                                         | `rotate(350,30)=20`, `rotate(15,-30)=345`, `rotate(-10,0)=350`, `rotate(720,45)=45`; plus per-role wiring check                   | correct                                                                                                                                                                                                                                            |
| Achromatic seed (C=0)                                                        | 7 derived hues collapse to identical greys                                                                                        | degenerate but valid; graded tokens still clear their floors. Pinned as a decision, not a surprise                                                                                                                                                 |
| Perf                                                                         | 200 `buildTokenSet` calls, 2 runs each, on 260e53f vs its parent                                                                  | **21.6–21.9 ms → 23.5–23.8 ms (+8%)** despite 13 ramps vs 6 — the `detectDirection` single-ramp optimization pays for most of the 7 new ramps. No timeout risk (suite 124 s wall; slowest file 55 s; per-test sweeps well under their 30 s budget) |

---

## Tests added

| File                                                | Tests                                                                                                                                                                                                                                                                     | Status |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `packages/oklch/src/harmony-tokens.test.ts` _(new)_ | 19 — five-surface contrast sweep, gamut sweep, never-throws/fallback, NaN + hue-range scan, rotation boundary + per-role wiring, achromatic degeneracy, anchor identity bounds + clamp, refactor equivalence, provenance two-vocabulary agreement, determinism + ordering | green  |
| `packages/oklch/src/binding.test.ts`                | +3 — `anchor` on an un-anchored ramp, out-of-range label totality (and the fact that provenance echoes the _requested_ label, not the returned step), role isolation                                                                                                      | green  |
| `src/lib/theme.test.ts`                             | +2 — full engine-name delivery (the existing invariant was count-agnostic and stayed green through 38→59), prefix-overlap distinctness (`--harmony-triadic-a` vs `-a-fill` vs `-a-text`)                                                                                  | green  |
| `scripts/check-icon-roles.test.ts`                  | +2 — D1 (**RED**) and its fix-constraining companion (green)                                                                                                                                                                                                              | 1 red  |

## Gate

Run in the QA worktree, full chain from `docs/definition-of-done.md`:

```
lint             PASS      lint:docs      PASS
lint:css         PASS      format:check   PASS
lint:color       PASS      typecheck      PASS
lint:icon        PASS      build          PASS
lint:dimension   PASS
lint:routes      PASS      test           FAIL — 3530 passed, 1 failed (D1), 2 skipped
lint:keys        PASS
```

The single failure is D1's pinning test. Everything else is green.

## Coverage I could not reach

- **No rendered-surface pass.** The 21 tokens are delivered but nothing in the app consumes
  them yet, so there is no painted surface to drive a browser check against. The first
  component that paints from a harmony token needs its own visual + focus/contrast pass —
  and that is also the moment D1 stops being latent.
- **APCA was measured with the engine's own implementation**, not an independent one, so this
  confirms internal consistency rather than third-party agreement. WCAG ratios are the legal
  bar and were checked the same way.
- **Studio-side consumers** of `HarmonyTier` (receipt/annex UI) were checked only at the engine
  seam, not through the Studio.
