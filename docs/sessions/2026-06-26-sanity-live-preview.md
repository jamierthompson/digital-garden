# Session 2026-06-26 — Sanity Live preview + publish→prod revalidation

**Why.** Phase 3's Item C and the carried "Sanity Live Preview & production wiring" block were the
last open work before Phase 3 could close. Two coupled capabilities remained: real-time **draft
preview of content** (`defineLive` + `<SanityLive>`, build-phases #2) and **publish→production
revalidation** so a published change appears on Vercel without a redeploy (build-phases #3). Mock
data was needed first to exercise both across more than the single `first-light` project.

**Shape.** Solo lead + a **2-coding-agent team** over file-disjoint slices, each in its own in-root
worktree `[D29]`, each cleared by **one fresh, adversarial QA agent** `[D26]`. The read-path is a
sequential spine (both slices centre on it), so it was _not_ over-parallelised — the webhook slice was
built against a **lead-fixed tag contract** so it didn't depend on the Live slice's code at runtime.

| Slice                                                                      | Agent        | Files owned                                                                          | QA agent       |
| -------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------ | -------------- |
| **A — Live read-path** (`defineLive`, stega single-source, `<SanityLive>`) | `Live`       | `src/sanity/**`, `layout.tsx`, `notes/`, `draft-mode/enable` comment, `.env.example` | `QALive`       |
| **B — Publish→prod revalidation** (`/api/revalidate` webhook)              | `Revalidate` | `src/app/api/revalidate/**`                                                          | `QARevalidate` |

**Tag contract (lead-fixed):** every content fetch carries `sanity` + `sanity:<_type>`; the webhook
revalidates the same, derived **server-side from `_type`** (never a payload-supplied tag).

**Outcome.** Both slices landed in one curated, squash-merged PR (**#31**, `8b4b2ac`). Gate green on
the curated tip (525 tests). Mock data: 3 published projects (`tidepool` teal, `marginalia` indigo +
`brandColorDark` override, `goldenrod` yellow contrast-stresser) seeded via the Sanity MCP to vary
hue/font/notes/tags. Two new decisions recorded: **[D30]** (Path A — shell is an editorial island) and
**[D31]** (defineLive read-path + webhook-as-freshness-source).

### Key implementation notes (verified against installed code, not memory)

- `defineLive` resolves from **`next-sanity/live`** (not the package root in v13.1.1). Under Cache
  Components, Next selects a distinct impl (`dist/live/conditions/next-js/`) whose `sanityFetch` calls
  `cacheTag`/`cacheLife` and reads no request APIs — safe inside `use cache`, and it requires
  `strict: true` + explicit `perspective`/`stega`.
- **Stega exclusions** single-sourced into `src/sanity/lib/stega.ts` `[D16]`; the 5 code-consumed
  fields stay byte-clean under `stega: true` (proven by a real-encoder integration test).
- `revalidateTag(tag, { expire: 0 })` — the two-arg form the bundled Next 16.2.9 docs require for
  webhooks; `updateTag` is Server-Action-only and throws in a Route Handler.
- **Behaviour change:** dropped the time-based `cacheProfile` ("hours" for notes). `defineLive` owns
  cache lifetime (1y) with on-demand tag revalidation, so **the webhook is now load-bearing for
  published cold-cache freshness** — see [D31].

### Production verification (the new #31 deploy, chrome-devtools)

- `/work` index now lists **all 4 projects** (the stale-index gap closed by the rebuild —
  `generateStaticParams` re-ran over the published set).
- **Path A flash holds post-migration** — the branded shell (`data-precedence="brand"`, hue-150 OKLCH,
  `--font-fraunces`) is in the initial PPR bytes (`x-nextjs-prerender:1`, cache HIT); no fallback frame.
  The read-path swap did not regress flash-free.
- **`<SanityLive>` EventSource connects** to `…api.sanity.io/.../data/live/events/production` → 200
  (live wiring + CORS working for published content).
- **`/api/revalidate`**: valid Sanity HMAC → `200 {"revalidated":true,"tags":["sanity:project","sanity"]}`;
  tampered → 401; unsigned → 401; GET → 405. The deployed endpoint **and** the Vercel secret verify a
  real signature end-to-end.
- **Not verifiable solo:** the draft-content **Presentation walkthrough** (edit a draft, watch it
  preview live) needs the hosted Studio / an authenticated Presentation session — owner-gated. The
  draft _path_ is code-verified (QA proved the perspective branch + no draft→published leak) and the
  mechanism is deployed; only the live UI walkthrough remains.

## QA log [D26]

| Slice                  | QA agent (fresh) | Verdict                                                                               | Tests added                                                   |
| ---------------------- | ---------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| A — Live read-path     | `QALive`         | **ship-ready, 0 functional/security defects** (+2 LOW rot/hardening, fixed in-branch) | `src/sanity/lib/stega.integration.test.ts` (`8d0d342`)        |
| B — Revalidate webhook | `QARevalidate`   | **clean, 0 defects**                                                                  | 4 cases in `src/app/api/revalidate/route.test.ts` (`0774871`) |

**Slice A — what QA probed + defects.** Token-leak grep of the build: read token AND browser token →
**0 occurrences anywhere in `.next/`** (read token is a runtime `process.env` read of a non-`NEXT_PUBLIC_`
var, never inlined; browser token reaches the client only via SanityLive's serialized prop at request
time). Import-graph proof: no `"use client"` file imports `live.ts`/`sanityFetch.ts`. Mutation-proved
the layout guards are real (reordering CSS → `layout.import-order.test.ts` fails; adding `<ProjectScope>`
to the fallback → dedup test fails). Verified the published branch passes `perspective:"published"` +
`stega:false`; draft→published cache leak is framework-prevented. Added a real-`@sanity/client`-encoder
stega test. **2 LOW defects, both fixed by author in-branch:** 1) stale `getClient` comment in
`draft-mode/enable/route.ts` → reworded. 2) no `server-only` guard → added `import "server-only"` to
`sanityFetch.ts` (installed `server-only@0.0.1`). **Observation (→ [D31]):** the dropped freshness
backstop makes the webhook load-bearing for cold-cache freshness; documented, not a defect.

**Slice B — what QA probed.** Attacked forged signature → 401, missing header (`null`) → 401, secret
unset → 500 with `parseBody` never called, malformed body → 400 (not a thrown 500), signed-but-no-`_type`
→ 400, **tag injection** (payload `tags`/`tag` ignored; tags derive from `_type` only), secret never
logged. Confirmed `revalidateTag` two-arg `{expire:0}` and that `updateTag` throws in a Route Handler,
both against the bundled docs. Added 4 adversarial tests (8→12). Found **clean**.

**Deferred:** the doc-rot QA-D2 (stale `getClient` prose in `security-and-ops.md` + `build-phases.md`)
was fixed in this session's docs sweep, not in the slice branch. The **owner-gated** items (Sanity
webhook registration, hosted Studio deploy, draft Presentation walkthrough) are tracked in
`build-phases.md` Item C / wiring block.

## Owner handoff — to finish the live story (not code)

1. **Sanity webhook** (so revalidation fires automatically on publish): sanity.io/manage → API →
   Webhooks → URL `https://<prod>/api/revalidate`, POST, trigger on create/update/delete, projection
   `{ _type, _id, "slug": slug.current }`, **Secret = `SANITY_REVALIDATE_SECRET`** (already in
   `.env.local` and Vercel Production). The endpoint is already verified to accept a valid signature.
2. **Deploy the Studio** (`pnpm --filter studio deploy`, first run picks a `*.sanity.studio` host) and
   set `NEXT_PUBLIC_SANITY_STUDIO_URL` in Vercel; then the **draft Presentation walkthrough** across the
   mock projects (the one piece not verifiable solo).

Already done this session: Vercel Production env (`SANITY_API_READ_TOKEN`, `SANITY_API_BROWSER_TOKEN`,
`SANITY_REVALIDATE_SECRET`); CORS origins (prod + localhost, with credentials); mock data.

## Lessons

- **The read-path was the spine, not a parallel peer.** `defineLive`'s auto-`syncTags` means #2 and #3
  are coupled through the read path; the right shape was a small team with a lead-fixed contract, not a
  big fan-out. Re-running the team-vs-solo test per phase (skill §0) caught this.
- **Verify-then-write paid off repeatedly:** `defineLive` is at `next-sanity/live` not root; Cache
  Components selects a different impl; `revalidateTag` needs the two-arg form vs. the Sanity rule's
  deprecated single-arg. All would have been wrong from memory.
- **A signed live POST is worth more than a 401.** The 401 proves the guard; only a valid-HMAC 200
  proves the Vercel secret matches and the lib verifies on real infra.
