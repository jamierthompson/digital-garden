# Adversarial QA — Item C draft-preview fix (`src/app/layout.tsx`)

> **ROUND 2 UPDATE (re-verified the author's fix in the MAIN checkout):** ✅ **DEFECT 1 and
> DEFECT 2 are FIXED.** The author replaced the themed Suspense fallback with a
> `ProjectScope`-free `ShellThemeFallback`, so only the real `ShellTheme` emits
> `<style href="project-theme-garden">`. Verified on the real stack:
>
> - **#1 published:** main-tree `pnpm build` → `/` = ○ Static; prerendered
>   `.next/server/app/index.html` `<head>` now carries the REAL brand
>   (`--brand-accent: oklch(0.48 0.13 150)` + `var(--font-fraunces)`), fallback hue 264 gone.
> - **#2 draft:** edited draft (hue 25 + title) under the draft cookie on :3000 → browser
>   computed `--brand-accent` = `oklch(0.45 0.18 25)` + `--font-face` = `"Fraunces"`. Edited
>   brand previews. No blocking-route throw.
> - **#3 no leak:** cookieless :3000 = real published brand (hue 150) only.
> - **#5 gate:** FULL gate green (lint, lint:css, lint:keys, lint:docs, format:check,
>   typecheck, **test 499 passed**, typegen + types-diff, build).
> - **DEFECT 2:** `layout.draft-deferral.test.ts` now strips comments before matching AND adds a
>   "mounts `<ProjectScope>` exactly once" guard. The false-green is closed. (`<ProjectScope\b`
>   correctly does NOT match `<ProjectScopeBoundary`, so the count is 1.)
>
> **Residual NOTE (not a blocker, owner's call) — requirement #4 "themed fallback":** the new
> Suspense fallback is _unthemed_ (renders no `ProjectScope`), so the draft-only loading state is
> the neutral FOUNDATION palette, not the engine-fallback BRAND palette. This is a literal
> deviation from #4's "the draft-only fallback must be THEMED" — BUT it is **not** a flash of
> _unstyled_ content (the real harm #4 names): `ShellNav.module.css` consumes
> `var(--brand-text, var(--foreground))` etc., so the fallback is readable and layout-stable;
> the brand resolves when `ShellTheme` streams in, draft-Preview-only (published never shows it).
> One real gap: `ShellNav.module.css` `font-family: var(--font-face)` has **no** fallback → a brief
> default-font flash in draft Preview; consider `var(--font-face, var(--font-geist-mono))`. A
> _themed_ fallback using a DISTINCT slug/href (not "garden") would satisfy #1/#2/#4 at once and
> avoid both the de-dup AND the flash — optional improvement. Recommend the owner either accept
> the unthemed draft-only loading state or adopt the distinct-href themed fallback, and amend #4.
>
> **Not re-run this round (unchanged code path, low risk):** the [D9] bad-`brandColor`/`fontKey`
> _draft_ probe — totality lives in `resolveScope`/`ShellTheme`'s `ProjectScope`, untouched by this
> fix; verified green in Round 1.
>
> _Everything below is the original Round-1 report (verdict FAIL) that prompted the fix._

---

**QA engineer:** fresh adversarial agent [D26] — did not write the change.
**Date:** 2026-06-25
**Change under review:** `M src/app/layout.tsx` (Suspense + `ShellTheme` extraction) and
`?? src/app/layout.draft-deferral.test.ts`.

## VERDICT: ❌ DOES NOT HOLD UP — ship-blocking regression

The fix **closes the original throw** (verified) but **introduces a new, deterministic
regression that breaks the fix's own #1 and #2 acceptance criteria**: the published static
`/` and the draft Preview both render the **engine fallback palette (hue 264 / mono font)**
instead of the real (or draft-edited) brand. The gate is fully green and the author's
regression test passes — so this ships silently green. One additional finding: the author's
regression test has a **false-green** hole.

---

## How I verified (real stack, not just jsdom)

Isolated everything from the user's running `next dev` (:3000) using a detached git worktree
(`/tmp/dg-qa-worktree`, fix applied, APFS-cloned `node_modules`):

- `pnpm build` → production `next start -p 3010` → raw `curl` + a real-browser computed-style
  check (Chrome DevTools MCP) [D25].
- `next dev -p 3011` + a **throwaway** `GET /api/qa-draft-enable` route (calls
  `(await draftMode()).enable()`) to obtain the `__prerender_bypass` cookie. Route + worktree
  **deleted**; Sanity drafts **discarded**; user's :3000 server left running.

Full AGENTS.md gate run green in isolation: `lint`, `lint:css`, `lint:keys`, `lint:docs`,
`format:check`, `typecheck`, `test`, `typegen` + `sanity.types.ts` diff, `build`.
(`typegen` must be run in the main checkout — studio's `node_modules` isn't in the worktree.)

---

## DEFECT 1 (ship-blocker) — published `/` and draft Preview render the FALLBACK theme, not the real brand

### Requirements violated

- **#1** "Published `/` … brand `@layer brand` OKLCH tokens must be in the first-flushed
  `<head>`" [D11] — **FAILED**.
- **#2** "Draft Mode preview must render fresh DRAFT content … INCLUDING the shell … an edited
  brandColor must show under Preview" [D16] — **FAILED** (at the render layer).

### Root cause

The Suspense **fallback** renders `<ProjectScope seed={{slug:"garden", brandColor:""…}}>` and
the real `ShellTheme` renders `<ProjectScope seed={{slug:"garden", brandColor:<real>…}}>`.
Both resolve `slug="garden"`, so both emit `<style href="project-theme-garden"
precedence="brand">` with the **same href**. React 19 de-dupes hoisted stylesheets by href and
keeps the **first** one committed. During prerender the Suspense fallback's `<style>` commits
first, so the fallback palette wins and the real brand `<style>` is dropped. The body still
mounts the real `<div data-project="garden" class="fraunces…">`, but `--font-face` /
`--brand-*` for `[data-project="garden"]` are supplied by the _fallback_ style → the page is
themed by the fallback.

This is a **regression**: pre-fix there was a single ProjectScope, so the real brand style was
the only one and won.

### Repro A — published static `/` (production build)

```
# in isolated worktree (fix applied): pnpm build && next start -p 3010
curl -s http://localhost:3010/ | …                 # one <style data-href="project-theme-garden">
```

- Build classifies `/` as **○ Static** ✓ (so criterion "not ƒ Dynamic" passes).
- The single surviving head `<style>`:
  `--brand-accent: light-dark(oklch(0.3 0.11 264), …)` → **hue 264 (fallback)**,
  `--font-face: var(--font-geist-mono), …` → **mono (fallback)**.
- The real brand (hue 150 / fraunces) appears **only** in the RSC flight payload in `<body>`,
  **never** as an applied `<style>`.

Real-browser computed style (post-hydration, Chrome DevTools MCP) on `[data-project="garden"]`:

```
--font-face  = "Geist Mono", "Geist Mono Fallback", ui-monospace, monospace   (FALLBACK)
--brand-accent = light-dark(oklch(0.3 0.11 264), oklch(0.8 0.0902 264))        (FALLBACK hue 264)
numGardenStyleTags = 1
```

Expected: `var(--font-fraunces)` + hue **150** (published `siteSettings.brandColor =
oklch(0.62 0.13 150)`, `fontKey = "fraunces"`).

**Proof it is a regression** — same dev server, layout reverted to the committed pre-fix
version, cookieless `/`:

```
head <style project-theme-garden>:
  --font-face: var(--font-fraunces), …                       (REAL)
  --brand-accent: light-dark(oklch(0.48 0.13 150), …)        (REAL hue 150)
HEAD has hue150? True | hue264? False
```

### Repro B — draft Preview (the actual #2 scenario)

Draft edit via Sanity MCP: `siteSettings` → `title:"DRAFT-QA-TITLE-ZZZ"`,
`brandColor:"oklch(0.62 0.18 25)"` (red). Under the draft cookie on `/`:

- Draft data **does** reach the server (draft title ×4 and hue-25 tokens present in the RSC
  payload — so `sanityFetch`/draft perspective works, no leak).
- But the **applied** `[data-project="garden"]` style is still hue **264 (fallback)** in raw
  HTML and in the browser (`--brand-accent` = hue 264, `--font-face` = Geist Mono). The editor
  never sees the edited brand/font. → **#2 fails for the shell brand.**

### Confirmed in a committable unit test

`renderToStaticMarkup` and jsdom RTL both reproduce the href de-dup deterministically: two
same-href brand `<style>`s collapse to one, and it's the **first (fallback)** one. See the
added test below.

### Note on the title (separate, likely pre-existing — NOT attributed to this fix)

`<title>` renders `Home` on BOTH published and draft, with no `… · <siteTitle>` template
suffix, on `/`. The draft title reaches the server (in the payload) but the `<title>` element
doesn't reflect it. This is identical pre/post-fix and on `/` specifically (home route appears
to set an absolute title), so I did not attribute it to this change — but the owner should
confirm whether the home `<title>` is intended, because requirement #2 names the title too.
The brand/font rendering failure above is the substantive #2 violation.

---

## DEFECT 2 (test quality) — the author's regression test has a false-green

`layout.draft-deferral.test.ts` asserts `/<Suspense\b/.test(source)` against the **raw**
source. The load-bearing comment in `layout.tsx` literally contains the text `<Suspense>`
(3×), so the regex matches the **comment**, not the JSX element.

**Verified:** delete the real JSX `<Suspense …>…</Suspense>` (rendering `<ShellTheme>`
directly — which re-introduces the original blocking-route throw under draft mode) but keep the
comment → the test stays **3/3 green**. ESLint flags the now-unused `Suspense` import only as a
**warning** (`eslint` exits 0), so the **whole gate stays green**. The tripwire fails to guard
its single most important invariant.

(The other two assertions — read-count == 2, and `async function ShellTheme` present — DO
correctly fail when a 3rd read is added or the read is moved out. Only the `<Suspense>`
assertion is hollow.)

---

## What PASSED (independently verified)

- **Original bug reproduced** (pre-fix, draft cookie, `/`): verbatim
  `Error: Route "/": Uncached data or connection() was accessed outside of <Suspense>` …
  `…/blocking-route`. Matches the recorded Item C defect exactly.
- **Fix closes the throw**: post-fix, `/` under the draft cookie returns 200 with no
  blocking-route error in the server log. ✓ (This part of the fix is correct.)
- **#3 no draft→published leak**: cookieless `/` shows published content only (hue 150, no
  draft title, no hue 25). ✓ (data-layer property of `sanityFetch`/`getClient`, unaffected.)
- **#4 [D9] totality**: draft `brandColor:"totally-not-a-color!!!"` + `fontKey:"nonexistent"`
  → 200, no throw, no `unstable_catchError` "Theme unavailable" fallback; scope still emitted
  (degrades to engine fallback). ✓ The fallback IS themed (not unstyled). ✓
- **#5 gate**: green end-to-end (see above). ✓
- **`/` is ○ Static** in `pnpm build` (not `ƒ Dynamic`). ✓

So criteria #3, #4, #5 and the "no-throw / static-classification" halves of #1–#2 hold. The
**theme-correctness** halves of #1 and #2 do not.

---

## Missing test cases (the QA-added tests)

Added **`src/app/layout.shell-theme-dedup.qa.test.tsx`** (co-located, Vitest; gate stays green —
verified: full suite 498 passed + 1 expected-fail, prettier ✓, eslint ✓):

1. **De-dup mechanism** (passes now): rendering the fallback ProjectScope then the real one
   (same `slug="garden"`) yields exactly **one** `<style href="project-theme-garden">` — proves
   the two compete for one href.
2. **Known-defect guard** via `it.fails(...)`: the surviving style MUST carry the real hue
   (150), not the fallback (264). `it.fails` keeps the gate GREEN while the bug exists and flips
   RED the moment the architecture is fixed (then delete `.fails`). This is the regression test
   the change is missing.
3. **False-green guard** (passes now): asserts a real `<Suspense>` JSX element exists in
   `layout.tsx` **after stripping comments** — catches the Defect-2 mutation the author's test
   misses.

### Test cases that still need a runtime/E2E harness (no Playwright yet — Phase 3 [D18/D19])

Specify precisely for when the harness lands; they assert the user-visible guarantee end-to-end:

- **E2E-1 (published real brand):** build + `next start`; `GET /` cookieless; assert the
  `<head>` `<style[data-href="project-theme-garden"]>` contains the published
  `siteSettings.brandColor` hue and `var(--font-<resolved>)`, and does **not** set
  `--font-face: var(--font-geist-mono)` / a fallback hue for `[data-project="garden"]`. (Would
  fail today.)
- **E2E-2 (draft brand previews):** enable Draft Mode; edit `siteSettings.brandColor`; load `/`
  in the Preview iframe; assert `getComputedStyle([data-project="garden"]).--brand-accent`
  reflects the **edited** hue. Discard the draft after. (Would fail today.)

---

## Suggested fix direction (for the owning author — not implemented by QA)

The boundary approach is sound; the bug is that the fallback emits a **competing same-href
brand style**. Options: (a) don't render a themed `ProjectScope` in the Suspense fallback — use
an unthemed/neutral wrapper, or one whose `<style>` uses a **distinct href** so it can't win
the real theme's slot; (b) give the fallback a non-`"garden"` slug so its href differs; or
(c) restructure so the real `ShellTheme` style is the one committed first. Whatever is chosen,
unskip/clear `it.fails` in the QA test and add E2E-1/E2E-2 when Playwright lands. Re-verify the
published `<head>` carries the real brand AND draft Preview shows edited brand.

---

## Could not fully verify

- **Production draft Preview inside the real Sanity Presentation iframe** (vs. my throwaway
  cookie route): needs interactive Studio login (not headless-doable). I verified the same code
  path via the bypass cookie on both `next start`-equivalent and `next dev`; the de-dup defect
  is render-time and independent of how the cookie is set, so the conclusion holds — but a human
  should confirm in the actual Presentation tool.
- **Light/dark both schemes:** the engine emits `light-dark()` pairs; I confirmed BOTH schemes
  carry the fallback hue 264 in the surviving style (so the defect affects both). I did not do a
  per-scheme visual pass.
