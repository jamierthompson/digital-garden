# Synthesis — Shell-identity sourcing (synchronous shell)

> Lead synthesis of a 4-lens architecture debate (Architect, SanityModel, FrameworkFit,
> DevilsAdvocate), run blind → adversarial → cited. Trail: `round-1-drafts/`, `round-2/`.
> **This is the decision trail, not the decision record.** The binding `[D#]` is drafted in §7
> but is **NOT** to be written into `decisions.md` until the prod-cold-start flash is verified on
> the live Vercel deploy (the handoff's hard rule). Resolved conflicts are called out in §3, not
> smoothed.

## 0. FINAL OUTCOME (2026-06-26) — supersedes the §2 verdict below

After the spike (Controls A/B/C, [`spike-findings.md`](./spike-findings.md)) and a foundational
reconsideration with the driver, the decision **reversed** from "(ii) shell identity → code config"
to **Path A — the shell is an editorial Sanity island, symmetric with each project island.**
Brand / font / title / description all **stay in `siteSettings`**, read async + draft-aware, live and
draft-previewable — exactly as a project reads its own brand. **No synchronous-config refactor; no
`shell.config.ts`; `siteSettings` is not dissolved.** The current implementation already realizes
this — it stays as-is.

**Why it reversed (both pillars of the config verdict fell):**

1. **The flash that motivated "make the shell a synchronous constant" is dev-server-only.** Control A
   measured the _current_ implementation on a prod build + draft cookie: the PPR build-time-resolved
   _themed_ shell is served in the initial bytes (brand `<style>` in `<head>`, `data-project="garden"`
   wrapper is the first body content) — **zero unbranded frames**. The unthemed fallback never appears
   on prod; it is a `next dev` artifact only, and **projects share the identical dev-only behavior**.
   So the config refactor's sole benefit is an imperceptible dev-only first frame — not worth
   special-casing the shell.
2. **The "shell brand is a constant fetched per request → wrong shape" premise is rejected by the
   islands model.** If the shell is an editorial island (curated in Sanity like a project), its brand
   is **content, not a constant** — fetching it per request is _correct_, and the [D15] "wrong shape"
   critique dissolves. Keeping it editorial is also what the **team-grade** goal wants (a content/
   design person edits the shell brand / logo / copy in Sanity), and the spike refuted the Branch-2
   blocker that had made "keep it live in Sanity" look illegal.

**The architecture (record verbatim).** `ProjectScope` is the island primitive. The **shell** is
`ProjectScope` slug=`"garden"` (brand from `siteSettings`, resolved in `ShellTheme`); **each project**
is `ProjectScope` slug=`<project>` (brand from its doc, resolved in the route). Both read async +
draft-aware, both suspend under draft behind an unthemed fallback (root `<Suspense>` / `loading.tsx`),
both flash _only in dev_, both are PPR-clean on prod. **Symmetric islands.** The config verdict would
have broken the symmetry by making the shell the one synchronous, non-editorial special case; Path A
preserves it.

**What this retires (all moot):** the seed-vs-title/description split, the `shell.config.ts` constant,
the `siteSettings` dissolution, the `generateMetadata`-lockstep, and the test-churn contract. The
implementation is **unchanged**; the remaining work is documentation/comment correction — including the
two refuted claims recorded in [`spike-findings.md`](./spike-findings.md) (the Branch-2 "lockstep" and
the `layout.tsx` comment that the `<Suspense>` boundary "licenses `generateMetadata`").

> The §1–§8 below are the _original_ config-verdict synthesis, kept as the decision trail (it is how the
> reversal was reached). Read §0 as the outcome; §1–§8 as the reasoning that — once the flash was
> measured dev-only and the islands frame restored — pointed the other way.

## 1. The question

The shared shell (top-level nav/identity: brand color, font, site title, default meta description)
is the **same on every request**. Today `ShellTheme` (`layout.tsx:63-87`) fetches it from Sanity
(`SITE_SETTINGS_QUERY`) as a per-request, **draft-aware** read. The agreed direction (entering the
debate) was to make `ShellTheme` **synchronous**. The open fork: **where does the synchronous
constant's value come from** — (i) build-time read of published Sanity, (ii) code config, (iii)
hybrid, (iv) something else.

## 2. Decision

**(ii) Code config — for all of shell identity.** A `shell.config.ts` module exports a synchronous
constant `{ title, description, brandColor, fontKey }`; `ShellTheme` **and** `generateMetadata`
read it synchronously. `brandColorDark` is **dropped** (see §4). `siteSettings` **dissolves now**
and is **named** (per [D24]) as the future home for genuinely-editorial, body-rendered, site-wide
content — instantiated only when such a field actually exists.

This is the **driver's call** (2026-06-26): _"the site shell [will] never be updated in Sanity …
the content of home/about/now will be updated in Sanity, but the brand will not be. Brand color and
type only change for the page content of projects (work)."_ The debate's evidence pointed here; the
user's statement makes it binding rather than inferred.

### The architectural seam (record this verbatim — "brand → config" without it is wrong)

- **Shell chrome (site-wide): config.** Constant brand/font/title/description. Never edited in
  Sanity. Leaves the draft read-path entirely.
- **Per-project brand (color + type): editorial content, stays live in Sanity.** It flows through
  `PROJECT_DETAIL_QUERY` → `ProjectScope` per project, on the draft-aware content path — exactly
  what feature #2 (`defineLive`) exists to preview. Untouched by this decision.
- **Home / About / Now page _content_: editorial, going to Sanity** (a separate, planned content
  slice). Inherits the shell's constant brand; supplies its own per-page copy on the content path.

So making the shell synchronous removes **only the shell** from the live read-path; every genuinely
editorial surface (project brand, page content) stays live. Feature #2 keeps its real job.

## 3. The one resolved conflict (NOT smoothed)

**DevilsAdvocate dissented** from blanket-config on `title`/`description` (round-2 §1). The dissent
is fair and worth preserving: by [D15]'s litmus a **meta description is editorial _by genre_** (SEO
copy is a recurring content task), and the "never edited" fact is a ~2-day / 1-doc / 1-author
sample — _absence of opportunity, not a decision never to edit_. Its sharpest point: the reopen door
for `title`/`description` is **not** a cheap config swap — making them live-editable again
re-entangles `generateMetadata` with the Branch-2 deferral this slice deletes (FrameworkFit Claim 3).
So: defer to config, but **knowingly, with the reopen recipe recorded — not filed under "zero loss."**

**Resolution (lead + driver).** The dissent is _accepted as a caveat, not as a reason to keep the
shell in Sanity_, because:

1. **The decision-owner has answered the open premise.** DevilsAdvocate correctly noted the
   never-edited fact was _silent_ on "will meta-copy become an editor task." The user resolved that
   silence directly: the shell is never edited in Sanity. That is the decision-to-never-edit the
   evidence couldn't supply.
2. **The genuine editorial case is served elsewhere, not lost.** If per-page SEO copy ever becomes
   an editorial task, it lands on the **per-page content path** (home/about/now content is going to
   Sanity anyway): a route supplies its own `title`/`description` from its Sanity content via that
   route's `generateMetadata`, merging over the shell's constant default
   (`gen-metadata.md` §Merging, l.1316-1328). The editorial door opens on the **page**, not the
   shell — so config-now forecloses nothing real.
3. **"Keep it live in Sanity" was never on the table** (FrameworkFit, §4): a draft-aware async
   `generateMetadata` read throws **Branch 2 on `/`, `/about`, `/now`** once the shell is
   synchronous (lead-verified: those three are static, no sibling deferral to ride). The only
   "keep in Sanity" path is build-time-generated (i) — which **also can't live-preview** and is
   rejected on the hermeticity grounds in §5.

**Honesty clause (carried into the ADR, per DevilsAdvocate):** config-now for `title`/`description`
is a **deliberate [D24] deferral of a genre-editorial field**, _not_ a zero-loss move. The reopen
recipe is **not** "edit two strings back into Sanity"; it is "add per-page metadata on the content
path" (the cheap, correct door) — explicitly **not** re-introducing a draft-aware root
`generateMetadata` read (the expensive, Branch-2 door). Recorded so a future reader doesn't mistake
the one for the other.

## 4. `brandColorDark` + schema fate

`brandColorDark` is **triple-dead**: fetched (`queries.ts:73`), **dropped** by `scopeSeed`
(`layout.tsx:73-77` forwards only `brandColor`/`fontKey`), **and** `null` in the live data. The
engine derives dark from `brandColor` when the override is empty ([D5]). → **omit from
`shell.config.ts`; delete from schema/query.**

**Delete, not retain-but-unread.** Keeping `brandColor`/`fontKey` in the schema while the shell
reads from config reproduces the exact "editor changes the field, nothing happens" confusion the
debate rejected (i) for (SanityModel round-2 §3). With all four fields gone, `siteSettings` has no
remaining fields → the type, its singleton Structure wiring (`sanity.config.ts`), the `[0]` query
(`queries.ts:66-75`), and the Presentation "Used on every page" location come out together.
**Named** per [D24] as the future home for editorial site-wide _body_ content (footer/social/now-
status) — reborn on first real use, not kept empty "just in case."

## 5. Why not (i) / (iii)

- **(i) build-time from Sanity — rejected.** Architect's decisive argument (round-2 §1): the build
  is currently a **pure function of the repo at a commit** — the only Sanity coupling is
  `pnpm --filter studio typegen` from the _in-repo schema_; CI provisions **no** `SANITY_API_READ_TOKEN`
  (`ci.yml:11-13,35-36`, lead-verified). Option (i) makes the build's output a function of
  `(repo, live Content Lake state, token, network)` — a **category change in what a build is**,
  hermetic → live-DB-dependent. "It's just like `sanity.types.ts`" is a category error (schema-shape
  vs content-values; reproducible-from-commit vs not). And it **buys nothing**: a build-time constant
  still can't live-preview (FrameworkFit), so it pays the hermeticity crossing + a CI token + a
  generated file to host a value nobody edits, _and_ re-imports the "edits do nothing until deploy"
  dishonesty. Strictly dominated by (ii).
- **(iii) hybrid — rejected.** Most apparatus of all; a config-default-vs-build-read precedence
  branch; and any "synchronous seed + still-live shell preview" re-introduces the deferred async read
  - the de-dup hazard for the preview path — walking back the very thing we're removing.

## 6. Implementation shape (framework-mechanics, owned by FrameworkFit)

The agreed direction is **confirmed sound** against the bundled docs:

- **Synchronous `ShellTheme` removes flash + fallback in both published _and_ draft** — no `await` ⇒
  deterministic ⇒ static shell (`caching.md` §"deterministic operations", l.236-260). It also
  **structurally eliminates the React-19 href-dedup hazard class** [D28] (no fallback ⇒ no second
  `<style>` emitter), deleting a fragile invariant that needs two guard tests today.
- **A published-pinned `use cache` read still suspends in draft** (`use-cache.md` §Draft Mode) — so
  only a _genuinely synchronous constant_ escapes; "re-pin the read" is dead.
- **`generateMetadata` reads the same constant** — because `siteSettings` is deleted, it has no async
  source left. **Spike correction (see [`spike-findings.md`](./spike-findings.md), Controls B & C):**
  the Branch-2 error FrameworkFit gave as the _reason_ for this **did NOT reproduce** in Next 16.2.9.
  A synchronous shell + async draft-aware `generateMetadata` rendered `/`,`/about`,`/now` at 200 under
  draft with no error — and removing _both_ `VisualEditingControls` (Control B) _and_ the `<Suspense>`
  boundary (Control C) **still** didn't make it throw. The metadata read is `use cache`: cached at
  build (no prerender deferral) and dynamic under draft (no prerender determination), so the Branch-2
  prerender-time check never fires. So the conclusion holds (metadata → constant) but the operative
  reason is **"the source is deleted,"** not "Branch-2 forces a lockstep."

**The correct diff is "move the shell _above_ the boundary," NOT "delete the boundary":**

```tsx
<ShellTheme>                          {/* synchronous: ProjectScope in the static shell */}
  <Suspense fallback={…}>{children}</Suspense>   {/* content reads defer here under draft */}
</ShellTheme>
```

The `<Suspense>` is **load-bearing for content** today (`/work`, `/notes` await `sanityFetch` with
no per-route boundary; caught only by the root-layout boundary) and for the incoming `defineLive`
path (#2). Keep it around `{children}`; the shell stops being one of the things under it. (Optional,
out of scope: give `/work`+`/notes` their own `loading.tsx` so the layout boundary's only job is the
layout's own content.)

**Migration correctness:** bake the **live published values**, not the thinner in-code fallbacks —
`title "Jamie's Digital Garden"`, the full one-sentence `description`, `brandColor oklch(0.62 0.13 150)`,
`fontKey "fraunces"` (omit `brandColorDark`). The `layout.tsx:43-45/73-77` fallbacks remain only as
the [D9] never-throw safety net.

### Test-churn contract (the QA bar for the eventual slice — DevilsAdvocate round-2 §2)

- `layout.import-order.test.ts` ([D27]) — **LIVES, untouched** (orthogonal; still guards the new
  binding import sitting below the CSS imports). Re-run on a **fresh checkout, never a worktree**.
- `layout.draft-deferral.test.ts` — **rewritten/renamed** (e.g. `layout.shell-synchronous.test.ts`):
  the "exactly twice" `SITE_SETTINGS_QUERY` read-count **inverts to `0`** (all-config); assert
  `ShellTheme` is **not** async; keep "exactly one `ProjectScope`" (re-rationalized). _The asserted
  read-count IS the decision record — a stray non-zero means the refactor didn't land._
- `layout.shell-theme-dedup.qa.test.tsx` — **deleted as a file** (the Item-C hazard is structurally
  impossible without a fallback); the structural guard migrates to the "one `ProjectScope`"
  assertion. Delete-and-replace, not delete-and-thin.
- `queries.test.ts` + `sanity.types.ts` — **updated/deleted** to match the dissolved schema; the
  slice **must regenerate `sanity.types.ts`** ([D23] gate — the easiest gate to trip).
- Browser verification ([D25]/[D28]): flash-free **computed** brand on a **production build + draft
  cookie**, both color schemes, clean console — not token presence in dev HTML.

### Spike — DONE (2026-06-26). See [`spike-findings.md`](./spike-findings.md)

Outcome: synchronous-constant shell validated (flash-free, content stays live under draft); the
predicted Branch-2 error **did not reproduce** — `generateMetadata` moves to the constant because the
source is deleted, not to dodge an error. The QA contract below is amended accordingly (assert **zero
`siteSettings` reads** + all-routes-200-under-draft, **not** "expect a Branch-2 throw"). Original spike
plan retained for the record:

1. Make `ShellTheme` synchronous; leave `generateMetadata` on the async read; `pnpm build` (expect
   green), `next start`, enable draft, request `/` with the `__prerender_bypass` cookie → **expect a
   Branch-2 / "uncached data outside `<Suspense>`" error** naming the root layout/static page;
   request `/work` → **expect no error** (proves per-route).
2. Point `generateMetadata` at the constant → re-run → **expect all routes clean**, real brand
   applied (computed `--brand-*`, both schemes).

## 7. Proposed decision record — DRAFT, do NOT write to `decisions.md` yet

> Held back per the handoff hard rule until the prod-cold-start flash is verified on the live Vercel
> deploy (feature #4). Drafted here so the trail carries it.

**[D## — Shell identity is code config; the synchronous shell leaves the draft read-path].**
Shell identity (`title`, `description`, `brandColor`, `fontKey`) is **developer config** in
`shell.config.ts`, read synchronously by `ShellTheme` and `generateMetadata`; `siteSettings`
dissolves (fields deleted, not retained-unread) and is named for future editorial site-wide _body_
content. Rationale: [D15] litmus resolves to config against measured zero curation; the synchronous
shell deletes the flash + fallback + the [D28] de-dup hazard class; option (i) breaks build
hermeticity and still can't live-preview. **Seam:** per-project brand and page content stay live in
Sanity (the draft/`defineLive` path); only the constant shell chrome becomes config.
**Caveat ([D24], honest):** `title`/`description` are genre-editorial; config-now is a _deliberate
deferral_, and the reopen path is **per-page metadata on the content path**, explicitly not a
draft-aware root `generateMetadata` read.

## 8. Next steps

1. **Spike** the synchronous-constant shell (§6) on `feat/shell-sourcing` — prove it deletes the
   flash + fallback + the Branch-2 risk (incl. `generateMetadata`), in a production build + draft
   cookie.
2. Implement the slice (config + synchronous shell + boundary restructure + schema dissolution +
   test-churn contract).
3. Fresh-context adversarial QA ([D26]/[D28]).
4. This _simplifies_ feature #2 (`defineLive`): the shell is out of the live read-path, so #2 only
   ever handles content — revisit the A/B sourcing question for `sanityFetch.ts` in that lighter
   light.
5. At session end, **after Vercel flash verification**, write the §7 `[D#]` into `decisions.md`.
