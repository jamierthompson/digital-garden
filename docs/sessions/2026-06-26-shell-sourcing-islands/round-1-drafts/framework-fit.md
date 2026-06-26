# Round 1 — FrameworkFit (blind draft)

**Lens:** load-bearing feasibility. Does the agreed direction (synchronous `ShellTheme`) actually work
against Next **16.2.9** / React **19.2.4**, and what does each sourcing option cost in pure framework
mechanics? Every framework claim is cited to the **installed** bundled docs under
`node_modules/next/dist/docs/` (per AGENTS.md "one rule"). Where a doc doesn't settle it, I say
"spike needed" rather than guess.

**Doc shorthand (all under `node_modules/next/dist/docs/`):**

- `use-cache.md` = `01-app/03-api-reference/01-directives/use-cache.md`
- `draft-mode.md` = `01-app/03-api-reference/04-functions/draft-mode.md`
- `gen-metadata.md` = `01-app/03-api-reference/04-functions/generate-metadata.md`
- `caching.md` = `01-app/01-getting-started/08-caching.md`
- `css.md` = `01-app/01-getting-started/11-css.md`

---

## 1. Verdict on each claim

### Claim 1 — A synchronous `ShellTheme` removes the flash AND the fallback. **VERIFIED** (with one caveat).

The current draft-mode chain, link by link:

1. `ShellTheme` is `async` and `await`s `sanityFetch(SITE_SETTINGS_QUERY)` (`layout.tsx:63-68`).
   `sanityFetch` is `"use cache"` and reads `draftMode()` _inside_ the cache scope
   (`sanityFetch.ts:53,63`).
2. Under Draft Mode, **every cached function re-executes on every request and nothing is saved to
   cache** — `use-cache.md` §"Draft Mode" (l.217): _"all cached functions and components re-execute on
   every request, and results are not saved to the cache."_ Confirmed by `draft-mode.md` Good-to-know
   (l.47): _"all functions and components under a caching directive scope re-execute on every
   request…"_. So the cached read becomes **request-time data** for draft requests.
3. Request-time data in the render path that isn't in the static shell must sit behind `<Suspense>`,
   else Next throws **`Uncached data was accessed outside of <Suspense>`** — `caching.md` §"How
   rendering works" (l.292). Hence the load-bearing boundary at `layout.tsx:129-133`.
4. The fallback can't carry the themed `<style href=…>` — see Claim 5.

A **synchronous** `ShellTheme` (no `await`, value read from a synchronous constant) breaks the chain at
step 1: it does no I/O, so it is a _deterministic operation_ whose output is **automatically included
in the static HTML shell** — `caching.md` §"Working with deterministic operations" (l.236-260):
_"Operations like synchronous I/O, module imports, and pure computations can complete during
prerendering. Components using only these operations have their rendered output automatically included
in the static HTML shell."_ This is exactly the rationale already written into
`ProjectScope.tsx:35-39`. No `await` ⇒ no suspension ⇒ **no Suspense boundary, no fallback, no flash**
— in _both_ published and draft requests (the constant is identical in both). **Verified.**

> **Caveat (not a framework defect — a consequence to surface):** "synchronous constant" means the
> shell identity (title / brandColor / fontKey) is **published-pinned and no longer draft-previewable**.
> The current flash is _draft-only_ (`layout.tsx:96`); going synchronous removes the flash _by removing
> the live draft read_. That is correct **iff** the shell is truly a per-request constant (the stated
> premise). It is a content-model decision, flagged for ContentModel/Altitude in §5.

### Claim 2 — A _published-pinned_ `use cache` read STILL suspends in draft mode. **VERIFIED.**

The spike claim is true, and it is the load-bearing fact for the whole decision. The suspension is
caused by **`use cache` re-execution under Draft Mode**, _not_ by which client (`getClient(isEnabled)`)
the read picks. Re-writing `sanityFetch` to always use the published client would change _what content_
is returned but not _that it re-executes at request time_: `use-cache.md` §"Draft Mode" (l.217) and
`draft-mode.md` (l.47) both say **all** cached functions re-execute on every draft request with nothing
saved. An async function that re-runs a `fetch` at request time and is awaited in render = suspends =
needs `<Suspense>` (`caching.md` l.292).

Corollary: the **only** escape is a genuinely synchronous value — no `await`, no `"use cache"`, no
request-time I/O — i.e. a module-imported constant (options i/ii). A "re-pinned async read" does not
escape. **Verified by docs**, and independently corroborated by this repo's own production-verified
Item C regression (commit `bbea62e`; `layout.tsx:118-127`).

### Claim 3 — Making `ShellTheme` synchronous forces `generateMetadata` to become synchronous too. **VERIFIED.**

`generateMetadata` (`layout.tsx:41-42`) `await`s the **same** draft-aware `sanityFetch`. The comment at
`layout.tsx:121-127` claims the body `<Suspense>` "licenses" that read via the _"other parts also defer
→ metadata streams with them"_ branch. That matches the doc precisely. `gen-metadata.md` §"With Cache
Components" (l.1254-1263):

- **Branch 1** — _"If other parts also defer to request time: Prerendering generates a static shell,
  and metadata streams in with other deferred content."_ ← today's state (the body `ShellTheme` defers
  under draft mode, so metadata rides along).
- **Branch 2** — _"If the page or layout is otherwise fully prerenderable: Next.js requires an explicit
  choice… an error is raised indicating which page or layout needs to be handled."_

If `ShellTheme` goes synchronous, the body is **fully prerenderable**, but `generateMetadata` still does
a draft-aware `use cache` read that re-executes under draft mode (Claim 2). The route flips from Branch 1
to **Branch 2 ⇒ error**. So `generateMetadata`'s `siteSettings` read **must move to the same synchronous
constant in lockstep**. Two important sub-points:

- The doc's first remedy — `"use cache"` directly on `generateMetadata` (`gen-metadata.md` l.1265-1273)
  — **does not save us here**, because that read is _draft-aware_ (it re-executes under draft mode per
  Claim 2) and would still defer while the body is prerenderable ⇒ still Branch 2. Only a truly
  synchronous constant clears it.
- This is a **lockstep / atomicity** constraint, not an extra cost axis: making `ShellTheme` synchronous
  while leaving `generateMetadata` on `sanityFetch` produces a **broken draft mode**. The slice must
  convert _both_ reads together. It does **not** change the (i) vs (ii) calculus — both options feed the
  same synchronous constant to both call sites equally.

> Residual uncertainty (small): the exact _surface_ of the Branch-2 error — build-time prerender
> diagnostic vs. request-time-under-the-draft-cookie (as Item C's body read manifested). See §4 spike 1.

### Claim 4 — A build-time-generated constant module imports synchronously into a Server Component without tripping Cache Components rules. **VERIFIED feasible.**

A generated module (`export const SHELL_IDENTITY = {…}`) read synchronously is a _module import +
pure computation_ = deterministic ⇒ static shell, no `use cache`, no Suspense, no draft-mode
re-execution (it is **not** a caching-directive scope). `caching.md` l.236-260, which even shows
`await import('./constants.json')` as shell-safe. **Feasible.** Gotchas, all real but bounded:

1. **Graph/ordering of the gate.** The generated file must exist before `pnpm typecheck`/`test`/`build`
   run. This is _exactly_ the `sanity.types.ts` pattern [D23] — generate, commit, `git diff --exit-code`
   in CI. Reusing that discipline makes (i) architecturally consistent; inventing a _new_ "generated but
   gitignored, only-made-in-CI" path would break local gate runs.
2. **CSS import order [D27].** The generated import has no CSS side-effect, so — like the existing
   `Suspense`/`next/font` binding imports — it **must sit below** `import "./foundation.css"; import
"./globals.css";` (`layout.tsx:11-12`) so it doesn't move Turbopack's first-stylesheet anchor. Pinned
   by `layout.import-order.test.ts`. Minor, easily satisfied.
3. **Build-time Sanity read.** Prebuild reads _published_ `siteSettings` over the public CDN client (no
   token). Needs Sanity reachable at build; a `siteSettings` edit needs a **rebuild/redeploy** to appear
   (no ISR, no draft preview of the shell). That is the defining semantic cost of (i).
4. **Stega.** Must be stega-free in the baked literal (would corrupt the OKLCH parse / font lookup);
   already mandated by [D16] and the build read uses the published client anyway.

### Claim 5 — React 19 hoists `<style precedence href>` and de-dupes by `href`, keeping the FIRST committed → a themed fallback collapses to the engine-fallback palette. **VERIFIED (de-dup); the "first-wins → fallback wins" specifics are React-19 behavior confirmed empirically, not from the bundled Next docs.**

- `ProjectScope` emits `<style href={`project-theme-${slug}`} precedence={BRAND_LAYER}>`
  (`ProjectScope.tsx:47`). Two same-`href` emitters collapse to **one** surviving tag — pinned by this
  repo's QA test `layout.shell-theme-dedup.qa.test.tsx:53-65` (`gardenStyles().length` ⇒ `1`).
- The **de-dup + hoist-by-`href`/`precedence`** mechanism is **React 19** stylesheet behavior, _not_
  Next. The bundled Next docs only _reference_ React 19 stylesheet support in passing (`css.md` l.348,
  pointing at the React `<link>` docs) and do **not** document the de-dup/precedence ordering. So I
  cite: react.dev `<style>`/`<link>` precedence docs (external) + the repo's own test.
- "Keeps the FIRST committed, so the _fallback_ (rendered first at prerender) wins and themes the shell
  with the engine fallback palette" — this specific ordering is **production-verified** in this repo
  (Item C / [D28]; documented in the QA test docstring l.19-35), not derivable from the installed Next
  docs. Treat as _observed-and-pinned_, not doc-cited.

**Decision-relevant upside:** a synchronous `ShellTheme` has **no fallback and no second emitter**, so
the entire de-dup hazard class — the thing [D28] caught — _disappears_. That removes a fragile invariant
that today needs two guard tests to defend. Strong point in favor of going synchronous regardless of
(i)/(ii).

---

## 2. The `generateMetadata` interaction, spelled out

- **Today:** body `ShellTheme` defers under draft mode ⇒ Branch 1 of `gen-metadata.md` §"With Cache
  Components" ⇒ metadata's draft-aware read streams alongside ⇒ no error. (Comment at `layout.tsx:121-127`
  is **accurate**.)
- **After making `ShellTheme` synchronous:** body is fully prerenderable ⇒ a still-async, draft-aware
  `generateMetadata` read is the lone deferrer ⇒ **Branch 2 ⇒ error** under draft mode.
- **Therefore:** `generateMetadata` must read the **same synchronous constant** as `ShellTheme`. The
  `"use cache"`-on-`generateMetadata` escape hatch does **not** suffice (Claim 3) because the read is
  draft-aware.
- **Effect on (i) vs (ii):** none. Both options serve one synchronous constant to both call sites. The
  only new constraint is **atomicity** — convert both reads in the same slice or draft mode breaks.
  (Title/description default also stop being draft-previewable, consistent with the Claim-1 caveat.)

---

## 3. Per-option technical cost/risk (pure framework mechanics)

|                                          | Framework risk                                                                                                                                                                                                                | What it costs                                                                                                                                                                         | Notable hazards                                                                                                                                                                                           |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **(i) Build-time from Sanity**           | **Low.** Generated module = deterministic import = static shell (`caching.md` 236-260). No `use cache`, no Suspense, no draft interaction.                                                                                    | Prebuild step; generated-file discipline (commit + CI `git diff --exit-code`, i.e. the [D23] TypeGen pattern); import placed below CSS imports [D27]; build-time Sanity reachability. | Constant can **drift** from Sanity if prebuild not run (mitigated exactly like `sanity.types.ts`). Shell edits need **redeploy** (no ISR/draft preview of shell). Keep stega off the baked literal [D16]. |
| **(ii) Code config (`shell.config.ts`)** | **Lowest.** A plain TS constant import — unambiguously synchronous/static-shell. Zero Sanity coupling at build, no prebuild, no network, no generated-file gate.                                                              | Shell identity leaves Sanity → not Studio-editable.                                                                                                                                   | Essentially no _framework_ risk. The "cost" is purely content-model ownership (ContentModel's call). Matches the [D24]/[D15] litmus: _developer decides it → registry/config, not authored content._      |
| **(iii) Hybrid**                         | **Highest.** Any "synchronous seed + still-live Sanity draft preview of the shell" design **re-introduces** the deferred async read behind `<Suspense>` — and with it the Claim-5 de-dup hazard [D28] — for the preview path. | All of (i) **plus** a parallel deferred path and its guard tests.                                                                                                                     | Largely **defeats the purpose** unless live in-Studio preview of shell identity is a hard requirement. From framework mechanics alone: most moving parts, least marginal benefit.                         |

**Framework-neutral read:** (i) and (ii) are both sound; the choice between them is a _content-model /
ownership_ question (does shell identity live in Sanity?), not a framework one. (iii) is the only option
that carries genuine framework risk, because it walks back the very deferral we're removing.

---

## 4. Spike-needed items (exact empirical tests — READ-ONLY phase, not run here)

1. **`generateMetadata` Branch-2 surface.** Make `ShellTheme` synchronous, _leave_ `generateMetadata`
   on `sanityFetch`, run `pnpm build`, then request `/` with the `__prerender_bypass` draft cookie.
   _Measure:_ does the error fire at **build** or only at the **draft request**, and is the text the
   Branch-2 "fully prerenderable" error? Then point `generateMetadata` at the synchronous constant and
   confirm: clean build, clean draft request, clean console. (Settles the Claim-3 residual.)
2. **(If option i) gate ordering.** Confirm the prebuild generator runs before `typecheck`/`test`/`build`
   in _every_ gate script and in CI, that the generated file `git diff --exit-code`s clean (the [D23]
   discipline), and that its import sits below the CSS imports without moving the Turbopack anchor —
   re-run `layout.import-order.test.ts` **and** a _fresh-checkout_ build, never a worktree ([D27]'s
   verification trap).
3. **Flash-free on the real stack ([D25]/[D11]/[D28] method).** On a production build + draft cookie,
   assert the **computed** `--brand-*` on `[data-project="garden"]` equals the real brand in **both**
   color schemes, no FOUC, clean console — the exact method [D28] established (computed/applied style on
   a clean production build, not token _presence_ in dev HTML).

---

## 5. Open questions for the other lenses

1. **ContentModel / Altitude:** Is the shell identity (title / brandColor / fontKey) required to be
   **editable in Studio** and **previewable in Draft Mode**? If _no_ → (ii) is simplest and deletes the
   most machinery. If _yes_ → (i) keeps it in Sanity, **but a build-time constant still won't
   live-preview shell edits** (rebuild required); true live preview forces the async/Suspense/de-dup
   path back — i.e. it reopens exactly what we're closing. There is no free "synchronous _and_
   live-previewable" shell.
2. **For the user (via Altitude):** if shell identity stays in Sanity (i), is it acceptable that a
   shell title/brand edit needs a **redeploy** to show, with **no draft preview** of the shell? That's
   the real trade to put to them.
3. **[D16] expectation check:** losing draft-mode preview of the shell title/brand (and the metadata
   title) — does that conflict with any stated visual-editing goal, or is the shell explicitly outside
   the click-to-edit surface?
4. **Scope of "constant":** the premise is "shell = per-request constant." If any shell field is
   actually expected to vary (A/B, locale, season), that field can't be a synchronous constant and the
   whole analysis changes for _that field only_.
