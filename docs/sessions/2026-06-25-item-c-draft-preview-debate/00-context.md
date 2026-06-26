# Item C — shared context for the design debate (GROUND TRUTH)

> You are one of three lens-teammates in an adversarial design debate. This file is the shared,
> already-proven diagnosis and the constraints. **Trust it as ground truth** — the cause is settled;
> the debate is purely about the FIX. Verify every framework claim you add against the **bundled
> docs** at `node_modules/next/dist/docs/` — this repo is Next 16.2.9 / React 19.2.4 and memorized
> APIs are wrong often enough to be dangerous (AGENTS.md "the one rule").

## The bug (exact cause, empirically reproduced — do NOT re-litigate)

The shell root layout reads `siteSettings` via `sanityFetch(SITE_SETTINGS_QUERY)` in **two**
un-`<Suspense>`'d sites:

- `src/app/layout.tsx:39` — inside `generateMetadata()`
- `src/app/layout.tsx:67` — inside the `RootLayout` body (feeds the brand seed to `ProjectScope`)

`sanityFetch` is a `"use cache"` function. On the **published** path the read is cached → completes
during prerender → lands in the static HTML shell. Clean.

Under **Draft Mode**, Cache Components **bypasses the cache** — `use-cache.md` §"Draft Mode":
_"all cached functions and components re-execute on every request, and results are not saved to the
cache."_ So both reads become **uncached, request-time** fetches. Cache Components forbids uncached
data accessed during prerender unless wrapped in `<Suspense>` (or `use cache`) → the **blocking-route**
error (`caching.md` ~line 292; `generate-metadata.md` §"With Cache Components" ~line 1254).

Verbatim error:

```
Error: Route "/": Uncached data or `connection()` was accessed outside of `<Suspense>`.
  https://nextjs.org/docs/messages/blocking-route
    at Module.generateMetadata (src/app/layout.tsx:39:20)
```

Proven scope: with metadata neutralized, the error MOVES to `RootLayout (layout.tsx:67/69)`. So
**both sites are independent instances of the same fault**; metadata just trips first (evaluated
first). A fix must cover BOTH. Published `GET /` is clean; Draft `GET /` errors.

Note asymmetry: `generateMetadata` produces `<head>` and **cannot be `<Suspense>`-wrapped** the way a
body subtree can — see `generate-metadata.md` §"With Cache Components" for the sanctioned options
(`'use cache'` on the metadata fn, OR a `connection()` dynamic-marker inside `<Suspense>`). The body
read CAN live inside a Suspense boundary. The two sites may need different mechanisms.

## The hard constraint (this is what makes it non-trivial)

**The published path must stay statically prerendered** — the flash-free themed shell `[D11]`: the
brand tokens/theme must be in the **initial HTML bytes**. Any fix that makes the shell
_unconditionally_ dynamic (e.g. a bare top-level `await connection()`, or an empty-fallback Suspense
above `<body>`) regresses the published experience (`caching.md` warns an empty-fallback Suspense
above the document body defers the WHOLE app to request time). So the fix must be **conditional**:
defer-to-request ONLY under Draft Mode; stay static when published — at BOTH read sites.

Also binding: `[D16]` (draft mode design; `getClient(isDraft)`), `[D9]` (resolveScope/ProjectScope is
TOTAL — never throws on bad seed). The draft preview must work for **ALL** content **including
siteSettings/the shell**, not just project pages (owner requirement; it's a Phase-3 goal AND a
Phase-4 prerequisite).

## Source-of-truth files to open (by path)

- `src/app/layout.tsx` — the two read sites + the existing LOAD-BEARING import-order comment
- `src/sanity/lib/sanityFetch.ts` — the `"use cache"` + `draftMode()`-inside-cache read path
- `src/sanity/lib/getClient.ts`, `src/sanity/lib/client.ts` — published vs draft client
- `src/sanity/lib/queries.ts` — `SITE_SETTINGS_QUERY`
- `src/components/project-scope/ProjectScope.tsx` + `ProjectScopeBoundary.tsx` — how the seed renders
- Bundled docs (READ THESE, don't trust memory):
  - `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md` §"With Cache Components" (~1254) and §"Streaming metadata" (~1222)
  - `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md` §"Draft Mode"
  - `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` (blocking-route, Suspense streaming, the empty-fallback-above-body warning)
  - `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/draft-mode.md`
  - `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md` (if present)
- `docs/decisions.md` — [D11], [D16], [D9] (cite by number)

## What to deliver (Round 1 — independent draft)

Write to YOUR OWN file only (named in your brief). **Do NOT read the other teammates' draft files
this round** — independent drafting is the point. Your draft must contain:

1. **Your recommended approach** to fixing BOTH read sites, concrete enough to implement (name the
   files/functions changed, the mechanism, and how the published path stays static).
2. **Why it satisfies the constraint** — cite the bundled doc passage that sanctions it.
3. **Failure modes / costs** of your approach (be honest).
4. **The strongest objection you anticipate** to your own approach, and your answer.
5. A crisp **one-paragraph summary** at the top.

Keep it a dense, cited digest — not a wall of prose. Round 2 will be adversarial cross-examination.
