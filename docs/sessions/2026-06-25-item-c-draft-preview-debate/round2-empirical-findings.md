# Round 2 — Empirical findings (lead ran the experiments; tree reverted clean)

Real Draft Mode via the actual `__prerender_bypass` cookie (`draftMode().enable()` route handler —
the real mechanism, per ShellGuardian's bar). Next 16.xx / React 19.xx, dev server, Cache Components on.
Each experiment: edit → recompile → enable cookie → `GET /` → read new dev-log lines. All reverted.

## Baseline (reconfirmed)

- Published `GET /` → 200, clean.
- Draft `GET /` → blocking-route error at `generateMetadata (layout.tsx:39)`.
- Neutralize metadata → error MOVES to `RootLayout (layout.tsx:67)`. Both sites independently faulty.

## Experiment C2 — `"use cache"` on `generateMetadata` ALONE (body untouched)

**Result:** the `:39` metadata error is **SUPPRESSED**; the error **moves to the body read,
`RootLayout (layout.tsx:68)`**. Draft `GET /` still 200 but still logs one blocking-route error (body).

**Adjudication:**

- **ShellGuardian CORRECT, FrameworkFit REFUTED** on the narrow claim: `"use cache"` on
  `generateMetadata` _does_ suppress that site's error. The marker satisfies the prerender
  blocking-route guard (`caching.md:292` — error fires only if data "isn't wrapped in `<Suspense>`
  **or marked with `use cache`**") **even though** Draft Mode bypasses the cache at _runtime_
  (`use-cache.md` §Draft Mode). FrameworkFit conflated "runtime-bypassed" with "no-op for the guard."
- **But ShellGuardian also CORRECT that it's only half a fix:** the body site `:67/68` still breaks.
  `"use cache"` on metadata alone is NOT a complete fix.

## Experiment C1 — body `<Suspense>` via extracted `ShellTheme` ALONE (metadata untouched)

Extracted the body read + `ProjectScope` into an async `ShellTheme`, wrapped in `<Suspense>` with a
non-empty themed fallback (empty seed → engine fallback palette, `[D9]`). `generateMetadata` left as-is.

**Result:** draft `GET /` → **200, ZERO blocking-route errors at EITHER site.**

**Adjudication: Architect/FrameworkFit hypothesis CONFIRMED.** Once the body suspends (defers to
request time under draft), `generateMetadata` is in the sanctioned "other parts also defer → metadata
streams with them" branch (`generate-metadata.md:1260`), so its explicit-choice error never fires.
**One boundary fixes both sites — no second mechanism, no `connection()` marker, no `use cache` on
metadata needed.**

## Published-path verification with C1 (ShellGuardian's [D11] bar)

Raw first-flush HTML of published `GET /` (no draft cookie), via `curl` not browser DOM:

- **Clean** — no blocking-route error.
- `<head>` carries the `data-precedence="brand"` `@layer brand { … }` style **inline**, with the full
  `--brand-*` token set and real OKLCH values (hue 150 = garden green). **Brand tokens in byte zero.**
- **ZERO streaming-suspense markers** (`<template id="B:…">`, `$RC=`, `hidden id="S:…"` all absent) —
  the Suspense boundary is a genuine **no-op on the published path** (cached child completes at
  prerender; fallback never shown). **[D11] preserved.**
- CSS import block (`foundation.css → globals.css → next/font`) untouched → ShellGuardian's
  import-order risk `[D12/D27]` does not materialize for the minimal in-place extraction.

## What is NOT yet verified (honest)

- **Draft content-correctness:** C1 draft render was _error-clean_, but I did NOT assert it shows the
  EDITED draft title/brand. Needs a real draft edit (Sanity MCP) — deferred to implementation/QA.
- **`pnpm build` route classification** of `/` as a static-shell route (stronger than dev curl) — not run.
- **Draft-only theme flash** (fallback palette → real brand, confined to the editor iframe) is the
  irreducible cost all three acknowledged; observed as a render path, not an error.

## Net

Fix A (**body `<Suspense>` only, one mechanism**) is empirically the minimal complete fix: clears both
sites, preserves the published static shell, leaves import order alone. `"use cache"` on metadata
(ShellGuardian) is _valid but redundant_ given the auto-rescue; the `connection()` marker backstop is
_unneeded_. Open: draft content-correctness + build classification before merge.
