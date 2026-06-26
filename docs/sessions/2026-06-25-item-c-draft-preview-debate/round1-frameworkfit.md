# Item C — Round 1 draft · Lens: **FrameworkFit** (what Next 16.2.9 / React 19.2.4 actually sanctions)

All citations are to the **bundled** docs under `node_modules/next/dist/docs/` (paths relative to that root). Line numbers are from the installed copy.

---

## One-paragraph summary

The framework-blessed fix is **one mechanism, applied at the body, that the framework gives us _conditional_ behavior for free** — wrap the `siteSettings` read in a `<Suspense>` boundary with a **real (non-empty) fallback**, placed _inside_ `<body>` around the brand-consuming subtree. Because the read goes through `sanityFetch` (a `'use cache'` fn), the published render resolves it **during prerender into the static shell** — Suspense "does not itself opt a component into dynamic rendering" (`08-caching.md:130`), so [D11]'s flash-free theme stays in the initial HTML bytes. Under Draft Mode the cache is bypassed by design (`use-cache.md:217`), the child genuinely suspends, and the resolved theme **streams** behind the fallback (`08-caching.md:99,128`). That same body-deferral also **rescues `generateMetadata`**: the metadata blocking-route error fires _only_ when metadata defers "while the rest of the page is **otherwise fully prerenderable**" (`generate-metadata.md:1261,1263`); once the body Suspense child also defers under Draft Mode, we are in the sanctioned "**other parts also defer to request time → metadata streams in with other deferred content**" branch (`generate-metadata.md:1260`), no error. I treat that metadata rescue as the leading hypothesis but **not guaranteed**, so I specify a sanctioned fallback for the head: a `draftMode()`-**conditional** `connection()` dynamic-marker in `<Suspense>` (`generate-metadata.md:1275-1314`). I explicitly reject "just add `'use cache'` to `generateMetadata`" as a Draft-Mode fix — Draft Mode bypasses it identically, so it is a no-op for the error.

---

## 1. Recommended approach (both sites)

### Site B — RootLayout body (`src/app/layout.tsx:67`) — **PRIMARY FIX**

Extract the seed read into an async child and wrap it in a real-fallback Suspense boundary **inside `<body>`**:

```tsx
// async server child — does the (use cache) read, renders the themed scope
async function ShellScope({ children }: { children: React.ReactNode }) {
  const settings = await sanityFetch(SITE_SETTINGS_QUERY);
  const scopeSeed = {
    slug: "garden",
    brandColor: settings?.brandColor ?? "",
    fontKey: settings?.fontKey ?? "",
  };
  return <ProjectScope seed={scopeSeed}>{children}</ProjectScope>;
}

// in RootLayout body:
<body>
  <ProjectScopeBoundary>
    <Suspense
      fallback={<ProjectScope seed={FALLBACK_SEED}>{children}</ProjectScope>}
    >
      <ShellScope>{children}</ShellScope>
    </Suspense>
  </ProjectScopeBoundary>
  <VisualEditingControls />
</body>;
```

- `FALLBACK_SEED` is the empty/degraded seed; `resolveScope`/`ProjectScope` is **TOTAL and never throws** on a bad/empty seed [D9], degrading to the engine fallback palette + shell mono face — so the fallback is a valid themed shell, not a blank screen.
- **Published path:** Draft Mode OFF ⇒ `sanityFetch`'s `'use cache'` resolves _during prerender_; `ShellScope` completes synchronously-enough to be **included in the static shell** (`08-caching.md:130` "does not itself opt … into dynamic rendering"; `:266-268` lists `use cache` results _and_ Suspense fallbacks as shell content; worked example `:416` "blog posts (cached with use cache) become part of the static shell along with the fallback UI … only the personalized preferences stream"). The fallback is **never shown**; the real themed `<style>`/`.variable` land in the initial bytes — **[D11] preserved**.
- **Draft path:** Draft Mode ON ⇒ cache bypassed (`use-cache.md:217` "all cached functions and components re-execute on every request, and results are not saved"); `ShellScope` now performs uncached request-time fetch, **suspends**, fallback renders into the shell, resolved draft theme **streams in** (`08-caching.md:99,128`). No blocking-route error because the access is now _inside_ `<Suspense>` (`08-caching.md:292`).

The boundary is **inside `<body>`** with a **non-empty fallback**, so it is clear of the "empty fallback above the document body defers the WHOLE app" trap (`08-caching.md:296-298`).

### Site A — `generateMetadata` (`src/app/layout.tsx:39`) — rescued by Site B; conditional marker as backstop

`generateMetadata` produces `<head>` and **cannot be Suspense-wrapped**. Two sub-claims:

**(a) Leading hypothesis: Site B's fix also clears the metadata error.** The metadata guard is narrow — `generate-metadata.md:1263`: the error exists to confirm intent when "**Streaming metadata at runtime while the rest of the page is fully prerenderable**." `:1258-1260`: "**If other parts also defer to request time**: Prerendering generates a static shell, and metadata streams in with other deferred content." Once `ShellScope` defers under Draft Mode, the route is no longer "otherwise fully prerenderable," so metadata is permitted to stream — no error, no extra code. Published: nothing defers, metadata is in the static `<head>`, no error either.

**(b) Sanctioned backstop if (a) doesn't hold in practice.** Add a **Draft-Mode-conditional** dynamic marker (the doc's Option B, `generate-metadata.md:1275-1314`) so the head deferral is _explicitly intentional_ without regressing published:

```tsx
async function DraftDynamicMarker() {
  const { isEnabled } = await draftMode();
  return isEnabled ? <Connection /> : null; // <Connection/> = `await connection(); return null`
}
// rendered inside its own <Suspense> in the body
```

`connection()` "indicates rendering should wait for an incoming user request before continuing" (`connection.md:6`). Gating it on `isEnabled` means: **published ⇒ marker is `null` ⇒ route fully prerenders, metadata in static head; draft ⇒ marker calls `connection()` ⇒ route is intentionally dynamic ⇒ metadata streams.** `draftMode().isEnabled` is the one request value safe to branch on here — it is _not_ in the runtime-API list that forces dynamic (`08-caching.md:134-139` lists only cookies/headers/searchParams/params) and is explicitly readable in these contexts (`draft-mode.md:45`, `use-cache.md:219`).

### Why **not** `'use cache'` on `generateMetadata` (the brief's pointed question)

Option A (`generate-metadata.md:1265-1273`) is for "metadata depends on external data **but not runtime data**" — superficially our shape. **But it does not fix the Draft-Mode error**, because Draft Mode bypasses _every_ cached scope identically (`use-cache.md:217`; `draft-mode.md:47`). Under Draft Mode a `'use cache'` `generateMetadata` re-executes uncached at request time — the exact condition that trips the guard. And on the published path the transitive `sanityFetch` cache _already_ makes metadata prerenderable, so Option A adds nothing there either. Net: **Option A is a no-op for this bug.** The metadata deferral must be signalled by the _route having an intentional dynamic part_ (Site B's Suspense, or the conditional `connection()` marker) — not by caching the head.

---

## 2. Why it satisfies the hard constraint (published stays static) — the governing rule

The constraint is that the themed shell must be in the **initial HTML bytes** on the published path [D11] (`ProjectScope` rendered inside the prerendered shell, `use cache`d, theme `<style>` + font `.variable` in initial static HTML). The rule that guarantees this with my fix:

> `08-caching.md:130` — "`<Suspense>` … **does not itself opt a component into dynamic rendering.** If a component only performs synchronous work, it will complete during prerendering regardless of whether it is wrapped in `<Suspense>`."
> `08-caching.md:266-268` — static shell includes **both** `use cache` results **and** Suspense fallbacks.

So wrapping a `use cache` read in Suspense is _free_ on the published path: the cached value resolves into the shell, fallback unused. The boundary only "activates" when the child actually defers — which happens **only** under Draft Mode (cache bypass). The conditionality the brief demands is therefore **intrinsic to `use cache` + Suspense**, requiring no `if (isEnabled)` branch in the body at all. (The metadata backstop, if needed, achieves the same conditionality explicitly via `isEnabled`-gated `connection()`.)

---

## 3. Failure modes / costs (honest)

1. **Double-mounting `children` under Draft Mode.** Because the fallback must render a themed shell wrapping `children`, and the resolved `ShellScope` also wraps `children`, the page subtree mounts once under the _fallback_ theme then re-mounts under the _resolved draft_ theme when the stream lands. Cost is **Draft-Mode-only** (authors, not visitors) and is a brief theme-flash on preview — published never suspends so never double-mounts. Mitigations: keep the fallback seed = the degraded engine palette so the flash is fallback→brand (acceptable for an authoring surface); or hoist only a brand-token provider into Suspense and keep `children` outside the suspending node (more refactor). Worth debating in Round 2.
2. **Metadata rescue (1(a)) is a hypothesis, not proven.** I have not empirically reproduced that Site B alone clears the `layout.tsx:39` error — the doc text (`:1260`) strongly implies it, but the guard's exact evaluation order vs. `generateMetadata` is not spelled out. If it doesn't hold, we pay the backstop's extra marker component. **This must be verified by repro, not asserted.**
3. **Serverless cache durability.** `use cache` is in-memory by default and "may re-evaluate on every request" in serverless (`08-caching.md:198`). On Vercel the _published_ shell still prerenders at build, so this mainly affects ISR-style revalidation, not the initial static shell — but if shell brand must survive cold reads, `'use cache: remote'` is the documented lever (`:198`). Out of scope for the error, flagged for completeness.
4. **`FALLBACK_SEED` must stay genuinely total.** The whole conditional-static story leans on [D9] never throwing; a regression there turns the fallback into an error boundary trip during streaming.

---

## 4. Strongest objection I anticipate, and my answer

**Objection:** "Wrapping the brand read in Suspense means under Draft Mode the theme is _not_ in the initial bytes — so you've recreated exactly the flash [D11] forbids, just hidden behind 'it's only draft.' And you're _assuming_ the cached value lands in the shell on published; if Suspense forces a streaming boundary even for cached children, published regresses too."

**Answer:** Two parts. (i) [D11] protects the **published** experience — the flash-free shell for real visitors; it does not promise zero-flash inside the authenticated Draft preview, which is an editorial surface ([D16]) where seeing draft brand _stream in_ is acceptable and expected. The constraint in 00-context is explicit: "defer-to-request ONLY under Draft Mode; **stay static when published**" — my fix is static-on-published, deferred-on-draft, exactly. (ii) The "Suspense forces streaming even for cached content" worry is **directly refuted by the bundled docs**: `:130` ("does not itself opt … into dynamic rendering"), `:266-268` (cached results are shell content), and the worked example `:416` where a `use cache` subtree sits in the static shell while only the runtime sibling streams. Cached children resolve during prerender and are emitted into the static HTML; the fallback is shown **only** when the child suspends, which a cache hit never does. So published does not regress — and that is a doc-pinned guarantee, not an assumption.

---

### Citation index (bundled docs)

- `01-app/01-getting-started/08-caching.md` — `:99,128` streaming uncached via Suspense (fallback in shell, content streams); `:130` Suspense does not opt into dynamic; `:266-268` shell contents; `:292` blocking-route error condition; `:296-298` empty-fallback-above-body trap; `:416` worked static+cached+streaming example; `:134-139` runtime-API list; `:198` serverless cache durability.
- `01-app/03-api-reference/04-functions/generate-metadata.md` — `:1256` metadata defers on uncached/runtime data; `:1258-1263` the two-branch guard (other-parts-defer vs otherwise-prerenderable → error); `:1265-1273` Option A (`'use cache'`); `:1275-1314` Option B (`connection()` dynamic-marker in Suspense, with the "DO NOT place `await connection()` [unconditionally at top] … prevents content being in the static shell" note at `:1302-1304`).
- `01-app/03-api-reference/01-directives/use-cache.md` — `:217` Draft Mode bypasses all cached fns; `:219` `isEnabled` readable inside `use cache`, cookies/headers not.
- `01-app/03-api-reference/04-functions/draft-mode.md` — `:45` `isEnabled` readable in caching scope; `:47` Draft Mode re-executes cached scopes, nothing saved.
- `01-app/03-api-reference/04-functions/connection.md` — `:6` "wait for an incoming user request before continuing"; `:8` for per-request output without request-time APIs.
- `docs/decisions.md` — [D9] `resolveScope`/`ProjectScope` TOTAL, never throws; [D11] flash-free themed shell in initial static bytes; [D16] draft/visual-editing surface.
