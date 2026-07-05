# QA Report — palette-studio 34-token adaptation

**Branch under test:** `feat/studio-swatch-cards` @ `e7e58f5` (7 studio commits over engine base `de4d12e`)
**QA branch:** `qa/studio-34` @ worktree `.claude/worktrees/qa-studio`
**Reviewer:** fresh adversarial QA, no prior context of the build.

## Verdict: **SHIP** — no defects found.

Every code invariant and every rendered-surface hazard the brief named held under attack, across
15 hostile seeds (achromatic, extreme-L, the `#faf3c0` low-chroma-yellow class, yellow/cyan
stressers, near-black/near-white, garbage→fallback) in **both** schemes. Baseline gate was green
(352 tests); it remains green with **21 added tests** (373 total). Typecheck clean.

---

## Code attack surface

### 1. Receipt truthfulness — PASS
- `measureReceipt` re-measures the baked tokens with the engine's own `checkContrast`, so it can
  only disagree with the engine if it audits the wrong **target** or **background**. Verified the
  four status **TEXT** rows (`<status>-text`) audit `CONTRAST_TARGETS.accentText` (4.5:1 / Lc 60) —
  exactly the tier `palette.ts` binds them at (`kind:"auto"`, `target: accentText`). The saturated
  `<status>` **fills** are correctly kept out of the readable-text receipt (they're 3:1 UI, audited
  on the card).
- Worst-case surface is `surface-selected` everywhere it's claimed (`WORST_SURFACE` in both
  `contrast.ts` and `cardContract.ts`), and it *is* the least-contrast text-bearing surface in each
  scheme (light neutral-400, dark neutral-600 — the lightest dark surface). A pass here holds on
  every lighter surface.
- Swept all 15 hostile seeds × both schemes: **zero** failing receipt rows, **zero** card-audit
  failures. The receipt never printed a false "passes".

### 2. Provenance narration — PASS
- The card's 7 schema `kind`s map cleanly onto the engine's 4 provenance `kind`s
  (`auto`/`auto-on`→`step`, `fill-hover`→`fill`, etc.) — verified in `binding.ts` `resolveBinding`.
  `derivationSentence`'s branches read the right provenance shape for each.
- Swept all 34 cards × both schemes × 15 hostile seeds: every sentence is non-empty, ends with a
  period, and **never** falls through to a generic fallback (which would signal a provenance/kind
  mismatch). The `#faf3c0`/achromatic classes — where brand and neutral ramps converge — narrate
  truthfully because the copy reads the engine's solve-time provenance, never value-matches.

### 3. `BRAND_TOKEN_NAMES` completeness — PASS (compile-enforced)
- `USAGE: Record<BrandTokenName, string>` and the `derivationSentence` switch over `BindingKind`
  are both exhaustive: a 35th token or 8th kind is a **compile error**, not a silent gap. Runtime
  sweep confirms `CARD_CONTRACT` covers every token with usage + valid target identity.

### 4. Wash single-source — PASS
- `washBg.ts` holds **no** chroma constant; `washBgValue` returns `light-dark(bg.light, bg.dark)`
  read straight from the engine token set. Verified byte-identical to the engine's own serialized
  `--bg` line for all 15 seeds, and that turning `tintedNeutrals` off makes the wash achromatic —
  proving the tint comes from the engine, not an app-layer override (the b2982a8 stopgap is gone).

### 5. Structural pet peeves — PASS
- Every changed CSS Module declares `@layer components` and is strictly var-consuming; **no**
  foundation-token (`--brand-N`/`--neutral-N`) reaches — only semantic tokens.
- No monolith regressions; `ScrollArea` is a reused `ui/` primitive; card logic stays split across
  `cardContract`/`cardModel`/`derivationCopy` (contract / view-model / copy).

---

## Browser attack surface (:3010, dark-first, both schemes)

### 1. Soft-nav wash containment — PASS (the flagged hazard class)
`/palette-studio → /browse` (soft-nav): the studio scope stays **mounted** (Next Activity-hides it
with `display:none !important` on `<main data-template="canvas">`), but the wash does **not** leak:
- the client effect's inline `body{--bg}` is **cleared** (cleanup fires on hide), and
- the server `:has(… :not([style]))` rule correctly stops matching the hidden copy (the `:not([style])`
  guard excludes the `display:none`-marked main).
Browse route background resolved to its own `#0a0a0a`, not the studio tint. Back-nav restores the
wash with a **single** scope mounted (no stale duplicate).

### 2. Live seed → whole-page re-theme — PASS
Changing the seed re-themes the entire page (body wash, studio chrome, ScrollArea thumb `--accent`)
in the same commit (`tries:0` — instant, no intermediate frame). `DEFAULT_SEED`'s derived `--bg`
**exactly equals** the server-rendered wash (`light-dark(oklch(0.9798 0.0141 336.3), …)`), so the
client effect's first write matches the server value — **zero hydration flash** (confirmed against
served HTML, not just the settled page).

### 3. Scheme integrity (#159) — PASS
Forcing `:root { color-scheme: light }` while OS-emulated dark flips the scoped slot's `light-dark()`
tokens from dark→light (`surface` oklch(0.21…)→oklch(0.9555…)); the scope reads `color-scheme:
"light dark"` (inherited, **not** re-declared) and follows the forced override. The exact bug class
`3517116`/`d021c97` fix — the slot never shadows the site toggle. Export half is covered by
`exporters.test.ts` (`:root` export carries `color-scheme: light dark;`).

### 4. Console / CLS / targets / focus — PASS
- **CLS on load = 0.0001** (budget 0.1); no layout shift on seed change.
- **315 interactive elements, 0 under 24×24 CSS px** (RampStep buttons, preset radios, disclosures).
- Console: no errors/warnings from this slice. The only console noise is **environmental** — Sanity
  Live CORS (localhost not in the project's allowed origins) and a generic Next `app/loading` CSS
  preload-unused warning — neither caused by the 34-token work.

### 5. Preview specimens render truthfully — PASS (both schemes)
Distinct status colors (green/red/amber/blue text + outline), a legible soft `error-container`
alert, stepped resting/hover/selected rows, and — critically — the **scrim composites its alpha
over a visible checkerboard** (the checker pattern shows through the dimmed overlay). Screenshots:
`qa-preview-dark.png`, `qa-preview-light.png` (worktree root, not committed).

---

## Tests added (committed on `qa/studio-34`)

Added into existing co-located suites (nested `describe`, never sibling `qa-*` files):

- **`src/components/entry-scope/washBg.test.ts`** *(new — `washBgValue` had no direct test)*: the
  single-source invariant — wash == engine `--bg` across 7 hostile seeds, and the tint tracks the
  engine's `tintedNeutrals` rule (guards against re-introducing the removed stopgap constant).
- **`.../cards/derivationCopy.test.ts`** → real-engine hostile-seed sweep: all 34 cards × both
  schemes × 7 hostile seeds produce a real, specific, non-generic sentence + counterpart hint.
- **`.../core/contrast.test.ts`** → the receipt clears every readable pair on achromatic /
  low-chroma-yellow / extreme-L hues in both schemes (the receipt's core promise, on the hues the
  existing chromatic `HUE_SPAN` omits).

**Gate:** `vitest run src/entries/palette-studio src/components/entry-scope` → 22 files, 373 passed.
`tsc --noEmit` → clean.
