# Round 2 — Architect (coupling defense + concession)

Design CONFIRMED by C1: body `<Suspense>`/`ShellTheme` clears both sites, published stays static
(brand tokens in byte-zero `<head>`, zero streaming markers). But ShellGuardian's coupling critique is
now _proven_, not hypothetical: with C1 alone, metadata's legality is **action-at-a-distance** — it
holds only because the body defers (`generate-metadata.md:1260` "other parts also defer → metadata
streams"). Remove the boundary and the `:39` error silently returns. I take that seriously and answer
in three parts; the headline is a **concession**, not a defense: I now recommend _dissolving_ the
coupling, not just guarding it.

---

## (a) Concrete guard against silent regression — three layers, two regression modes

The two regressions to catch: **(R1)** someone removes/relocates the body `<Suspense>`; **(R2)** someone
adds a _third_ un-`Suspense`'d, un-`use cache`'d `siteSettings` read.

**Layer 1 — dissolve R1 entirely (see (b)): `'use cache'` on `generateMetadata`.** Once metadata is
_independently_ legal (C2 proved `use cache` suppresses the `:39` error on its own — the prerender guard
is satisfied by "wrapped in `<Suspense>` **or marked with `use cache`**", `caching.md:292`), its legality
no longer depends on the body deferring. The action-at-a-distance contract is **gone**, not merely
documented. This is the primary guard and it costs one directive line.

**Layer 2 — load-bearing comment, exact placement.** On the body `<Suspense>` in `layout.tsx`, sibling
in spirit to the existing import-order comment (`layout.tsx:3-10`):

```tsx
{
  /* LOAD-BEARING BOUNDARY [D11/D16]. This <Suspense> is the ONLY thing that lets the
    siteSettings read defer under Draft Mode while staying static when published:
    cached (published) → resolves at prerender into the shell, fallback never shown;
    bypassed (draft, use-cache.md §Draft Mode) → streams. Do NOT remove it, and do NOT
    add another siteSettings read in this body that is not inside ShellTheme / a Suspense
    boundary or a `use cache` fn — it will throw blocking-route under draft. Pinned by
    layout.draft-deferral.test.ts. */
}
<Suspense
  fallback={<ProjectScope seed={FALLBACK_SEED}>{children}</ProjectScope>}
>
  <ShellTheme>{children}</ShellTheme>
</Suspense>;
```

**Layer 3 — a source-order test, `src/app/layout.draft-deferral.test.ts`** (exact sibling of
`layout.import-order.test.ts:60` — a static-text guard, because the real blocking-route error is a
build/dev-time signal that jsdom cannot raise; the project already treats async-RSC/draft render as the
browser/Playwright job, `page.integration.test.tsx:22-26` [D25]). It asserts, against the raw source:

1. `layout.tsx` contains a `<Suspense` boundary (R1 tripwire — removing it fails loudly).
2. `sanityFetch(SITE_SETTINGS_QUERY)` appears **exactly twice** in `layout.tsx` — once in
   `generateMetadata`, once in `ShellTheme` (R2 tripwire — a third read → count 3 → fail with a message
   pointing the dev to "wrap it or route it through ShellTheme").
3. `generateMetadata` is marked `"use cache"` (pins Layer 1 — if someone strips it, the decoupling is
   gone and the test says so).

**Layer 4 — the runtime proof lives in QA, not a unit test.** The semantic guarantee (draft `GET /` →
200, zero `blocking-route`; published `/` byte-zero brand tokens) is ShellGuardian's curl+build
verification bar, run by the fresh QA agent [D26] — exactly because async-RSC draft render is
jsdom-untestable. The source test is the _loud tripwire in the gate_; the QA bar is the _proof_.

## (b) Is the connection-marker escalation still over-built? — Yes, more clearly than in Round 1.

C1 proved the marker is **unnecessary** for correctness; C2 proved `use cache` on metadata is the cheap
independent fix for the head. The `connection()` marker would (i) add a component, (ii) re-derive the
draft branch _outside_ `sanityFetch` to gate `connection()` on `draftMode().isEnabled` — the precise
"don't scatter the draft branch / don't scatter `connection()`" smell the single-read-path design exists
to prevent — and (iii) buy nothing C1+`use cache` doesn't already have. §8 don't-build-until-forced:
C1 demonstrates it is _not forced_. **Recommendation: do not ship it; record it in `decisions.md` as the
documented fallback IF a future Next release narrows the "other parts defer → metadata streams" rule.**

**The concession:** I no longer recommend C1 _alone_ (my Round 1 minimal stance). I recommend
**C1 + `'use cache'` on `generateMetadata`** — adopting ShellGuardian's family-3, but as an _addition_,
not a replacement. Rationale, and why it beats my Round 1 position:

- It **dissolves the coupling** I was asked to defend (metadata becomes self-legal — Layer 1 above).
- It keeps the published `<head>` **fully prerendered/static**, not streamed (ShellGuardian's correct
  preference for a shell route) — `use cache` resolves metadata into the static head; under draft it is
  bypassed and re-executes fresh, so draft title/OG are still correct.
- Cost is **one directive line** — vastly cheaper than the marker, and unlike the marker it adds _no_
  draft branch outside `sanityFetch` (the `use cache` body has no `draftMode()` gate; the bypass is the
  framework's, not ours). So it does not violate the single-read-path cohesion.
- FrameworkFit's R1 objection ("`use cache` on metadata is a no-op for this bug") was about it being
  insufficient _alone_ — true, and not what I'm proposing. As an addition for _decoupling + static head_
  it is not a no-op: C2 empirically shows it independently suppresses the `:39` site.

Net shipped fix: **body `<Suspense>`/`ShellTheme` (the complete [D11] fix) + `'use cache'` on
`generateMetadata` (decouple + static head).** Both sites independently legal → defense-in-depth.

## (c) Import order [D12/D27] — confirmed untouched.

The empirical curl already showed the CSS block (`foundation.css → globals.css → next/font`) unchanged
(findings:46). To keep it that way: define `ShellTheme` **inline in `layout.tsx`** (no new
component-path import), so the _only_ added import is `import { Suspense } from "react"` — a **named
binding import, not a side-effect import**. The import-order invariant is exclusively about _bare
side-effect_ imports: `layout.import-order.test.ts:60` matches `^import\s+["']…["']` and its own comment
states "Type-only and binding imports are erased / don't emit a leading CSS chunk, so they're fine."
Placed in the binding-import group (after the two CSS imports), `foundation.css` remains the **first
side-effect import**, so Turbopack still anchors the first emitted stylesheet to it — the cascade-layer
order is unaffected and `layout.import-order.test.ts` stays green. If `ShellTheme` were instead extracted
to its own file, the added `from "@/components/shell/ShellTheme"` is also a binding import (still after
foundation.css) — safe — but inline is the truly minimal, zero-new-path-import move and is what I
recommend. The `"use cache"` directive on `generateMetadata` adds no import at all.
