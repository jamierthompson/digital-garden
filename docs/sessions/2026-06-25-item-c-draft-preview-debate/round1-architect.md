# Round 1 — Architect lens (abstraction altitude, coupling/cohesion, where the deferral belongs)

## Summary (one paragraph)

The deferral does **not** belong at either call site, and it does **not** belong pushed down into
`sanityFetch` — both for the same reason: the draft-vs-published _branch_ already lives in `sanityFetch`
(its `"use cache"` body reads `draftMode()` and `use-cache.md` §"Draft Mode" guarantees that under Draft
Mode the cache is _bypassed and re-executed every request_). That bypass is the conditional we need — it is
**already** wired. The only thing missing is a **render-time boundary** that lets the body's now-uncached
read stream under draft while staying static when published. So the fix is one structural move in the _body_:
extract the body's settings read + `ProjectScope` into a single async `ShellTheme` component and wrap it in a
**`<Suspense>` with a themed (non-empty) fallback**, _inside_ `<body>`. On the published path the child is
cached → resolves at prerender → lands in the static shell (Suspense is transparent); under draft the child is
uncached → streams. **Crucially, that body deferral also fixes `generateMetadata` with no second mechanism:**
`generate-metadata.md` §"With Cache Components" says when _other parts of the page already defer to request
time, metadata simply streams in with them_ — the explicit-choice error only fires when metadata is the
_sole_ dynamic thing on an otherwise-fully-prerenderable route. The asymmetry (metadata can't be
Suspense-wrapped) therefore does **not** force two mechanisms. We add **zero** new `connection()` calls, keep
the single read path intact, and lean on the framework's existing cache-bypass for conditionality. Net change:
move ~6 lines of body into `ShellTheme`, add a `<Suspense>` + a load-bearing comment + one draft-render test.

---

## 1. Recommended approach (concrete)

**File: `src/app/layout.tsx`** — restructure the body only; leave `generateMetadata` _untouched_.

Today the body inlines the read (`layout.tsx:67`) and builds `scopeSeed` (`:74`) directly in `RootLayout`.
Extract that into a co-located async component and put a Suspense boundary around it:

```tsx
// new async component (same file, or src/components/shell/ShellTheme.tsx)
async function ShellTheme({ children }: { children: React.ReactNode }) {
  const settings = await sanityFetch(SITE_SETTINGS_QUERY); // the SINGLE read path, unchanged
  const scopeSeed = {
    slug: "garden",
    brandColor: settings?.brandColor ?? "",
    fontKey: settings?.fontKey ?? "",
  };
  return <ProjectScope seed={scopeSeed}>{children}</ProjectScope>;
}

export default async function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <ProjectScopeBoundary>
          {/* Non-empty, THEMED fallback — never an empty fallback here, and never above <body> [caching.md] */}
          <Suspense
            fallback={
              <ProjectScope
                seed={{ slug: "garden", brandColor: "", fontKey: "" }}
              >
                {children}
              </ProjectScope>
            }
          >
            <ShellTheme>{children}</ShellTheme>
          </Suspense>
        </ProjectScopeBoundary>
        <VisualEditingControls />
      </body>
    </html>
  );
}
```

- `RootLayout` stays `async` (or can become sync — it no longer awaits) and **no longer reads Sanity itself**;
  the read is encapsulated in `ShellTheme`. Lower root coupling: the root composes boundaries, the leaf reads data.
- **`generateMetadata` is not changed at all.** It keeps calling `sanityFetch(SITE_SETTINGS_QUERY)`.
- `sanityFetch.ts`, `getClient.ts`, `client.ts`, `queries.ts`, `ProjectScope.tsx` — **all untouched.** The draft
  branch stays in exactly one place (`sanityFetch`), as designed.

**Why no new mechanism for metadata:** see §2. The body's draft-time deferral licenses metadata streaming.

**Conditionality is free.** Nothing in this code says "if draft". The `use cache` in `sanityFetch` _is_ the
switch: published → cached → `ShellTheme` resolves at prerender → Suspense shows resolved content in the static
shell; draft → cache bypassed (`use-cache.md` §"Draft Mode") → `ShellTheme` is uncached → Suspense streams it.

---

## 2. Why it satisfies the hard constraint (cited)

- **Published stays static `[D11]`.** `caching.md` §"How rendering works": _"`use cache`: the result is cached
  and included in the static shell"_ and _"`<Suspense>`: fallback UI is included in the static shell **while the
  content streams at request time**."_ When the child is fully cached (published), it resolves during prerender,
  so the **resolved** subtree — not the fallback — is in the shell. The Suspense is a no-op on the published path;
  the flash-free themed bytes are preserved. `ProjectScope`'s `<style precedence>` still hoists to `<head>` in the
  shell because the cached child resolves at build (ProjectScope doc-comment + `caching.md`).
- **We do NOT regress to whole-app-dynamic.** `caching.md` §"Opting out of the static shell" warns only about an
  **empty-fallback** `<Suspense>` placed **above the document `<body>`**. Ours is _inside_ `<body>` with a
  _non-empty_ themed fallback — the exact opposite of the anti-pattern.
- **Draft is fresh `[D16]`.** Under Draft Mode the cache is bypassed (`use-cache.md`:217 — _"all cached functions
  and components re-execute on every request, and results are not saved"_); `getClient(true)` serves drafts.
- **Metadata is legal under draft with no second mechanism.** `generate-metadata.md` §"With Cache Components":
  _"**If other parts also defer to request time**: Prerendering generates a static shell, and **metadata streams
  in with other deferred content**."_ The dedicated remedies (put `'use cache'` on the metadata fn, or add a
  `connection()` dynamic marker) are for the _other_ bullet — _"the page or layout is otherwise fully
  prerenderable"_ — i.e. when metadata is the **sole** deferral. Our body deferral removes that precondition, so
  the explicit-choice error never arises. (Note `'use cache'` on `generateMetadata` would **not** fix the draft
  path anyway — it too is bypassed under Draft Mode, so it's a non-option here regardless.)

This is the lowest-coupling placement of the `[D11]` guarantee: the static promise lives where it already lives
(`sanityFetch`'s `use cache`), and the boundary that permits draft streaming is a single Suspense in the body.

---

## 3. Failure modes / costs (honest)

1. **Implicit cross-coupling: metadata's legality depends on the body deferring.** This is the real cost. If a
   future dev makes the body fully static again under draft (e.g. removes the Suspense, or stops reading
   `siteSettings` in the body) while `generateMetadata` still reads it, the blocking-route error returns _at the
   metadata site_. Mitigation: a **load-bearing comment** on the Suspense ("this boundary also licenses
   `generateMetadata` to stream under Draft Mode — see generate-metadata.md §With Cache Components") **and** a
   draft-mode render test that asserts `/` renders without the blocking-route error. This is the single point a
   reviewer must guard. It is _less_ self-evident than an explicit marker (see §4).
2. **Doc-reading risk.** My whole case rests on "other parts defer → metadata streams." If that rule is narrower
   in 16.2.9 than the prose implies (e.g. it needs an explicit dynamic marker even when siblings defer), the body
   fix alone won't clear the metadata error and we escalate to §4's marker. **This must be empirically verified
   under Draft Mode before merge** (the bug was reproduced; the fix must be too).
3. **Draft-only theme flash.** Under draft, `ShellTheme` streams, so the brand `<style>` hoists when it resolves;
   the author briefly sees the _fallback_ theme. Mitigated by rendering a themed fallback (a fallback-seed
   `ProjectScope`), so it's fallback-brand → real-brand, not unstyled → brand. Author-only, preview-only,
   acceptable. Published is unaffected.
4. **`children` referenced twice** (fallback + real). Harmless (RSC), but slightly awkward; if it grates, the
   fallback can render a minimal themed wrapper without `children` and accept a flash of empty content during the
   sub-second draft stream.
5. **Two reads remain** (metadata + body). Inherent — `generateMetadata` is a separate function and cannot share
   a render-tree value with the body (rules out a literal "read once" across both; see §4). Deduped to one fetch
   on published via the shared cache key (existing comment at `layout.tsx:66`); under draft both re-execute, which
   is correct — draft is request-time by definition and there is ~1 author, so the duplicate fetch is a non-issue.

---

## 4. Strongest objection + answer

**Objection (the one I'd raise against myself): "You rejected pushing the deferral down for cohesion, then left
an _implicit_ coupling between two files. An explicit `<DraftDynamicMarker>` component — a `use cache` gate that
renders `<Suspense><Connection/></Suspense>` only when `draftMode().isEnabled` — would make metadata's deferral
_self-licensed_, independent of the body, and give the deferral a single named home (true cohesion). Isn't that
the more architecturally honest answer?"**

**Answer:** It's the more _robust_ answer and the correct **escalation**, but it's over-built for the situation
_as proven_, and the repo's discipline says don't build it until forced (AGENTS.md "don't-build-until-forced";
`sanityFetch.ts` already invokes this rule by listing only two `cacheLife` profiles). Three reasons to prefer the
minimal fix first:

1. **The framework already gives us conditionality and licensing for free.** The marker reintroduces the very
   thing the codebase works hard to centralize: a hand-rolled `draftMode()` branch _outside_ `sanityFetch` (to
   gate `connection()`), plus a `connection()` call — exactly the "scatter `connection()` / re-derive the draft
   branch at the call site" smell. The minimal fix derives conditionality from the existing `use cache` bypass,
   keeping the draft branch in its one sanctioned home.
2. **The marker can't be pushed into `sanityFetch` either** — `connection()` is forbidden inside `use cache`, and
   `sanityFetch` returns _data_, not JSX. So the marker would have to live as a _new_ root-level component anyway,
   i.e. it doesn't actually improve altitude over a body Suspense; it just adds a component and a dynamic API.
3. **The implicit coupling is cheap to make explicit-enough** with a comment + a draft-render test (§3.1). That's
   a 2-line + 1-test cost vs. a new component + `connection()` + its own draft-gate + its own test.

So my recommendation is: **ship the body-Suspense fix; verify the metadata error clears under Draft Mode; if and
only if it does not, escalate to the explicit draft-gated dynamic marker** (which becomes the cohesive home for
_both_ sites' deferral). That escalation path is the FrameworkFit/ShellGuardian conversation for Round 2, but the
ordering — minimal first, marker on demonstrated need — is the §8-disciplined call.

**On "read once" (restructure option d, full form):** genuinely impossible to unify across both sites —
`generateMetadata` is a separate function evaluated outside the render tree and cannot consume a value produced by
a body component. The most "read once" we can get is _per context_: one read in metadata, one in the body's
`ShellTheme`. That's what this design does; it does not pretend to do more.
