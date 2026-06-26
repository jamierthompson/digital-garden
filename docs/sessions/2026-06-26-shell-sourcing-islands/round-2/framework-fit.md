# Round 2 — FrameworkFit adjudication (the linchpin)

**The question put to me (SanityModel §6 + DevilsAdvocate §4):** if `ShellTheme` goes synchronous but
`title`/`description` stay in `siteSettings`, read **async + draft-aware** in `generateMetadata` —
(a) does sibling **content** deferral (`/work`, `/notes`, `/work/[slug]`, and the incoming `defineLive`
path) keep the route in **Branch 1** and rescue that metadata read, or does **Branch 2** fire regardless?
Is the "otherwise fully prerenderable" test **per-route** or **layout-global**? And (b) after the shell
goes synchronous, is **deleting** the `<Suspense>` correct, or must it survive for content?

**Verdict in one line:** the rescue is **per-route**, it exists on the content routes and **does not exist
on the static routes (`/`, `/about`, `/now`)**, so SanityModel's async-metadata split **throws Branch 2
on the static routes under draft** unless metadata also goes constant (or gains an explicit dynamic
marker); and the `<Suspense>` boundary **must survive for content** — the correct diff is _move the
synchronous shell above it_, not _delete it_ — but boundary-survival is **orthogonal** to the metadata
question and does not rescue it.

Doc shorthand: `gen-metadata.md` = `.../04-functions/generate-metadata.md`; `caching.md` =
`.../01-getting-started/08-caching.md`; `use-cache.md` = `.../01-directives/use-cache.md`.

---

## Ground truth I verified in the source (not from memory)

1. **The only `<Suspense>` in the entire app is the root-layout body boundary** (`layout.tsx:129`).
   `grep` across `src/app`: no other `Suspense`; the only `loading.tsx` is `work/[slug]/loading.tsx`.
2. **Child content pages await `sanityFetch` directly in the page body, with no per-page boundary:**
   `/work` (`work/page.tsx:26`), `/notes` (`notes/page.tsx:24`). They are **descendants of the root
   layout's `<Suspense>`**, so _that_ boundary is what catches their draft-mode deferral. `/work/[slug]`
   (`work/[slug]/page.tsx:55,72`) additionally has its **own** implicit boundary via `loading.tsx`.
3. **`/`, `/about`, `/now` read no Sanity content at all** — fully static (`page.tsx` is static; `grep`
   confirms neither `about/page.tsx` nor `now/page.tsx` touches `sanityFetch`/`getClient`/`client.fetch`).
   They export a **static `metadata` object** for their own title (`page.tsx:6-10`), but the **root
   layout's `generateMetadata`** (`layout.tsx:41`) still runs for them — it supplies the title _template_,
   default, and OG/description, and merges down (`gen-metadata.md` §Merging/Ordering l.1316-1328).
4. **The shell's async read is doing double duty today.** On the static routes there is no content read;
   the thing that defers under draft and thereby keeps `generateMetadata` in Branch 1 **is the shell's own
   `ShellTheme` read**. The `draft-deferral.test.ts:51-59` "exactly twice" invariant encodes only half of
   why the boundary matters; it never notes that the **same boundary also catches `/work` + `/notes`
   content**, nor that the shell read is the **sole** deferrer on `/`, `/about`, `/now`.

---

## (a) Per-route, not layout-global — and the static routes are the counterexample

**The "otherwise fully prerenderable" test is evaluated per-route (per page render), not layout-global.**
`gen-metadata.md` §"With Cache Components" (l.1254-1263):

> "generateMetadata follows the same rules as other components. If metadata … performs uncached data
> fetching, it defers to request time. **How Next.js handles this depends on the rest of your page:**
> — If other parts also defer to request time: … metadata streams in with other deferred content.
> — If **the page** is otherwise fully prerenderable: … an error is raised indicating **which page or
> layout** needs to be handled."

"the rest of your page" / "which page" is per-route language. PPR prerenders a **static shell per route**
(`caching.md` §"How rendering works" l.262-282), and metadata is resolved as part of rendering **that
route**. So the Branch-1/Branch-2 decision is made independently for each route, even though
`generateMetadata` is authored once in the root layout. Concretely, with a **synchronous shell** and a
**still-async, draft-aware** `generateMetadata` read:

| Route          | Other deferred work under draft?                                                 | Branch | Result under draft                                |
| -------------- | -------------------------------------------------------------------------------- | ------ | ------------------------------------------------- |
| `/work`        | yes — `WORK_INDEX_QUERY` re-executes uncached (`use-cache.md` §Draft Mode l.217) | **1**  | metadata streams ✅                               |
| `/notes`       | yes — `NOTES_INDEX_QUERY` likewise                                               | **1**  | metadata streams ✅                               |
| `/work/[slug]` | yes — `PROJECT_DETAIL_QUERY` (also its own `loading.tsx`)                        | **1**  | metadata streams ✅                               |
| **`/`**        | **no — fully static page, shell now synchronous**                                | **2**  | **`Uncached data … outside <Suspense>` error** ❌ |
| **`/about`**   | **no**                                                                           | **2**  | **error** ❌                                      |
| **`/now`**     | **no**                                                                           | **2**  | **error** ❌                                      |

So DevilsAdvocate §4(2)'s "sibling content deferral might rescue it" instinct is **correct for the
content routes and wrong for the static routes**. The rescue is real but **route-local**: it only exists
where _that route_ has its own deferred read. On `/`, `/about`, `/now` the only thing that ever deferred
was the shell read itself — and the whole point of this change is to delete it. **Branch 2 fires on
exactly the routes that have nothing else to defer.**

**Why the build stays green and this is a trap.** At build, Draft Mode is OFF, so the `use cache`
metadata read is _cached_, not deferred → every route prerenders → `pnpm build` is green. The Branch-2
error manifests **only at request time under the draft cookie**, on the static routes — precisely the
verification trap `draft-deferral.test.ts:20-24` and [D28] warn about ("looks fine where I checked").
This is **doc-grounded** (the branch rule) + **repo-established** (Item C manifested at runtime under the
cookie, not at build), but the exact firing is **runtime-only ⇒ spike, below**.

**Does anything cheaper rescue an async metadata read?** Two, both with costs:

- **`'use cache'` on `generateMetadata`** (the doc's first remedy, l.1265-1273, and the repo's recorded
  escalation, `layout.tsx:128`): **does not work here**, because the read is **draft-aware** — under
  Draft Mode a `use cache` `generateMetadata` _also_ re-executes uncached (`use-cache.md` §Draft Mode
  l.217) and still defers ⇒ still Branch 2 on the static routes. (Round-1 Claim 3 result, unchanged.)
- **An explicit dynamic marker** (`await connection()` inside a `<Suspense>`, `gen-metadata.md`
  l.1275-1314): _does_ work — it tells Next the static route's deferral is intentional, flipping it to
  Branch 1 and **streaming** the `<title>`. Cost: a marker component on **every static route** (`/`,
  `/about`, `/now`), i.e. per-route apparatus added back to preserve the async read, plus a streamed
  (not-in-initial-HTML) `<title>` in draft. Cosmetically fine in draft (no CLS), but it is _more_ shape,
  not less — and SanityModel did not price it.

**Conclusion for (a):** SanityModel's "keep `title`/`description` async in `generateMetadata`" **does not
work as drawn**. It silently breaks `/`, `/about`, `/now` under draft. To keep those two fields async +
previewable you must add dynamic markers to the static routes; otherwise `generateMetadata` must read the
**same synchronous constant** as the shell (Round-1 Claim 3 stands, now with the exact failing routes
named).

---

## (b) The `<Suspense>` boundary survives — for _content_ — but that does not rescue metadata

**Deleting the boundary is wrong.** It is load-bearing for content **today**, independent of the shell
and independent of `defineLive`:

- `/work` and `/notes` have **no** per-route boundary; their `sanityFetch` content reads defer under
  draft (`use-cache.md` §Draft Mode l.217) and are caught **only** by the root-layout `<Suspense>`.
  Delete it and both routes throw `Uncached data … outside <Suspense>` under draft (`caching.md` l.292).
- The incoming `defineLive`/`<SanityLive>` content path (handoff #2) is _also_ a draft-time content read
  and will rely on a boundary the same way.
- (`/work/[slug]` is already covered by its own `loading.tsx`, so it alone would survive a deletion —
  but `/work` and `/notes` would not.)

**So the correct diff is "move the shell out from under the boundary," not "delete the boundary."**
Today: `<Suspense fallback={<ShellThemeFallback/>}><ShellTheme>{children}</ShellTheme></Suspense>`. The
shape that makes the shell synchronous _and_ keeps content deferral legal is to render the synchronous
shell **above** the boundary and keep `<Suspense>` around `{children}`:

```
<ShellTheme>                         {/* synchronous: ProjectScope in the static shell */}
  <Suspense fallback={…}>{children}</Suspense>   {/* content reads defer here under draft */}
</ShellTheme>
```

This also **kills the de-dup hazard outright**: with a single `ProjectScope` mounted above the boundary
and **no themed fallback**, the second same-`href` `<style>` emitter that caused Item C is structurally
impossible (confirming DevilsAdvocate §4 / the [D28] mechanism in `shell-theme-dedup.qa.test.tsx`).

**But boundary-survival is orthogonal to the metadata question — and this is the subtle trap.** A
`<Suspense>` that wraps `{children}` only puts a route in Branch 1 **if something inside it actually
suspends**. On `/`, `/about`, `/now`, `{children}` is static — nothing suspends inside the boundary —
so the route is **still "otherwise fully prerenderable,"** and an async draft-aware `generateMetadata`
**still throws Branch 2** there. The boundary rescues _content on content routes_; it does **not** rescue
_metadata on static routes_. Keeping the boundary and keeping metadata async are **not** a working
combination. DevilsAdvocate §4 framed this exactly right: "the shell leaves the draft path; the boundary's
fate is a _separate_ question owned by content (#2)" — and I'll add the third, decisive separation:
**the metadata read's fate is a _third_ separate question, and on the static routes only a synchronous
constant (or a per-route dynamic marker) resolves it.**

---

## What this means for the decision (framework-mechanics ruling)

1. **Shell → synchronous: confirmed sound** (Round 1, unchanged). Removes flash + fallback + the de-dup
   hazard class.
2. **`<Suspense>` boundary: keep it, restructured.** Move the synchronous shell above it; keep it around
   `{children}` for `/work`, `/notes`, and `defineLive` content. Do **not** delete it. (Optional cleanup,
   not required by this decision: give `/work` and `/notes` their own `loading.tsx` so they stop depending
   on the layout boundary — then the layout boundary's only remaining job is whatever content the layout
   itself renders. Out of scope here; flag for Architect.)
3. **`generateMetadata` `siteSettings` read: must go to the synchronous constant in lockstep** — **unless**
   the team explicitly wants `title`/`description` draft-previewable, in which case the price is a
   `connection()` dynamic marker on **each** static route (`/`, `/about`, `/now`), not "nothing." There is
   **no zero-apparatus way** to keep the metadata read async after the shell goes synchronous. This makes
   SanityModel's split **more expensive than it appears**, and tilts toward DevilsAdvocate's "all four
   fields → constant" for framework-simplicity — though _whether_ title/description are editor-owned
   remains SanityModel/Altitude's call, not mine. My ruling is only: **async-metadata is not free here.**

   **Crucial sourcing consequence (resolves SanityModel's §6 question against the live-async path):** once
   `title`/`description` must be a **synchronous constant**, a _live_ Sanity read is off the table for them
   on the static routes. So if the team still wants those two fields **sourced from Sanity**, the **only**
   path that keeps Sanity as source _and_ satisfies the synchronous requirement is **option (i): build-time
   generation** (prebuild reads published `siteSettings` → generated constant module, imported
   synchronously by both `ShellTheme` and `generateMetadata`). SanityModel's specific proposal — keep them
   in Sanity on a **live async** `generateMetadata` read — is **mechanically broken on `/`, `/about`,
   `/now`** (lead-confirmed: those three are synchronous static components with no sibling deferring read,
   so Branch 2 fires). The live-async option does not survive; the realistic menu collapses to **(ii)
   config constant** or **(i) build-time-generated constant** — both synchronous, differing only in _where
   the strings originate_, which is the content-model axis SanityModel/Altitude owns.

---

## Spike (runtime-only — the per-route Branch-2 firing cannot be settled from docs alone)

The branch _rule_ is doc-settled; its _per-route firing under the draft cookie_ is runtime-only
(`draft-deferral.test.ts:20-24`: not jsdom-testable; build stays green). Exact test + expected signals:

**Spike S1 — prove the static-route Branch-2 failure and that a constant clears it.**

1. Make `ShellTheme` synchronous (constant seed); leave `generateMetadata` reading async `sanityFetch`.
2. `pnpm build` → **expected: green** (draft off at build — this is the trap; do not stop here).
3. `next start`; enable draft via `/api/draft-mode/enable`; request **`/`** (and `/about`, `/now`) **with
   the `__prerender_bypass` cookie**.
   - **Expected signal (hypothesis): a `Uncached data was accessed outside of <Suspense>` /
     `blocking-route` error** naming the **root layout / the static page**, because the route is otherwise
     fully prerenderable and the lone deferred read is `generateMetadata` (`gen-metadata.md` l.1254-1263).
   - Request `/work` and `/notes` with the cookie → **expected: no error** (content read keeps Branch 1).
     This contrast is the proof the test is **per-route**.
4. Point `generateMetadata` at the **synchronous constant** → re-run step 3 → **expected: all routes clean,
   clean console, real brand applied** (computed `--brand-*` on `[data-project=garden]`, both schemes —
   the [D28] method, not token presence in dev HTML).

**Spike S2 (only if the team wants async-metadata preserved) — prove the dynamic-marker path.**
Add a `connection()`-in-`<Suspense>` marker to `/`, `/about`, `/now`; keep `generateMetadata` async →
**expected: static routes flip to Branch 1, no error, `<title>` streams** (verify it still lands in the
draft DOM and that an HTML-limited bot still gets it in `<head>` per `gen-metadata.md` §"Streaming
metadata" l.1222-1230). This measures the true cost of keeping title/description live.

**Verification discipline:** fresh checkout, not a worktree ([D27] trap); production `next start` + draft
cookie, not `next dev` ([D28]); assert on **computed/applied** style and the **absence of the console
error**, per [D25].

---

## Net adjudication for the synthesis

- (a) **Per-route.** Content deferral rescues `generateMetadata` on `/work`, `/notes`, `/work/[slug]`;
  it does **not** rescue `/`, `/about`, `/now`, where the synchronous shell removes the only deferrer →
  **Branch 2 error under draft**. The rule is doc-grounded; the runtime firing is Spike S1.
- (b) **Keep `<Suspense>`, restructured** (shell above it; boundary around `{children}`) — it is
  load-bearing for content (`/work`, `/notes`, `defineLive`). "Delete it" is the wrong diff. But keeping
  it does **not** rescue async metadata on the static routes — that needs a synchronous constant or a
  per-route dynamic marker.
- Therefore SanityModel's async-`generateMetadata` split is **not free**; Round-1 Claim 3 holds and is
  sharpened to "fails specifically on `/`, `/about`, `/now`." The content-model question (are
  title/description editor-owned enough to justify the marker apparatus?) is handed back to
  SanityModel/Altitude with the **true framework price** now attached.
