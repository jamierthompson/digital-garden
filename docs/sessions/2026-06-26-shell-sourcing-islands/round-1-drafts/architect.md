# Round 1 — Architect lens

> Lens: abstraction altitude, source-of-truth integrity, coupling/cohesion,
> right-sized-vs-over-engineered. Tool of record: the **[D15] litmus**.
> Read blind — no other draft consulted.

## 1. Position

**(ii) Code config — shell identity lives in a `shell.config.ts` constant**, owned by
the developer, consumed synchronously by `ShellTheme` and `generateMetadata`.

Not (i). The build-time-from-Sanity option builds a generated file + a CI/prebuild step
to keep a value _in Sanity_ that, by the team's own measurements and the [D15] litmus,
**should not be in Sanity in the first place**. (i) is real machinery spent preserving a
mislocated source of truth. The honest fix is to move the source of truth, not to
generate a bridge across it.

I hold this **conditionally**, and the condition is the single fact I most want the other
lenses to confirm or break (see §5): _does the editor ever actually curate the shell brand
color / shell font / site title as a content task?_ If the answer is genuinely "yes, this
is a thing the site owner re-themes from the Studio as editorial work," the litmus flips
and (i) becomes correct. My read of the evidence is that the answer is no — but I am one
lens, and SanityModel owns that fact.

## 2. Reasoning through the Architect lens

### Source-of-truth integrity — where does the constant honestly live?

The decision frames three places the value could "come from." The Architect question
underneath that is narrower: **what is the authority for this value, and is the storage
honest about it?**

- The shell identity is, by the team's own agreed framing, _"the SAME on every request — a
  constant."_ A constant whose authority is a developer is a **config value**. A constant
  whose authority is an editor is **content**. There is no third category; [D15]'s litmus is
  exactly this fork: _"editor writes/curates it → typed block; developer decides it →
  registry/config; neither → not an input."_
- Option (i) keeps Sanity as the _nominal_ source of truth but the _operative_ source of
  truth becomes the generated file committed to the repo — refreshed only at deploy. So the
  value a developer reads, reviews, and reasons about lives **in code anyway**; Sanity
  becomes an upstream that a build step snapshots. That is two sources of truth with a
  generator papering the seam, and the generator runs once per deploy — i.e. at exactly the
  cadence a developer edit-and-deploy already has. The Sanity round-trip buys nothing the
  git history of a `shell.config.ts` doesn't already give you.
- Option (ii) collapses authority and storage into one place: the developer decides it, the
  developer's config file holds it, `git blame` is the audit trail. **One source of truth,
  honestly located.** This is the cohesion win.

### Coupling / cohesion — what does each option couple the shell to?

`ShellTheme` today couples the **invariant top-level chrome** to:
`sanityFetch` → `getClient` → Draft Mode branch → `use cache` semantics → a `<Suspense>`
boundary → a deliberately-unthemed fallback (`layout.tsx:63–105`). Every one of those is
machinery that exists _only because a constant is being fetched per request._ The
load-bearing comment at `layout.tsx:115–128` is ~14 lines explaining how a `<Suspense>`
boundary "licenses" a metadata read under Draft Mode — that complexity is **entirely a
function of the fetch**, not of the shell.

- **(ii)** severs all of it. `ShellTheme` becomes synchronous, the `<Suspense>` boundary's
  _raison d'être for the shell_ disappears, `ShellThemeFallback` and its React-19
  href-dedup hazard (`layout.tsx:89–97`) evaporate because there is no suspending child to
  fall back _for_. The shell chrome stops importing the Sanity read path at all. Maximal
  decoupling; the coupling that's removed is coupling that never earned its place.
- **(i)** keeps the _conceptual_ coupling (shell identity is "in Sanity") while adding a
  **new** build-time coupling: a prebuild script, a generated artifact in the repo, a CI
  ordering constraint (generate-before-build), and a staleness window (the generated
  constant lags the published doc until the next deploy). It trades a runtime dependency for
  a build-time dependency plus a code-generation toolchain. More moving parts for the same
  synchronous-constant guarantee.

### Right-sized vs. over-engineered — fewest moving parts for the same guarantee

The agreed guarantee is: **`ShellTheme` resolves identity once, synchronously.** Hold that
fixed and count the parts each option adds:

| Option           | New parts to reach a synchronous constant                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (ii) code config | **one file** (`shell.config.ts`), a literal export                                                                                                                                  |
| (i) build-time   | a generated file + a prebuild script + a Sanity read in CI + a CI step ordered before `build` + a regeneration/staleness story + a `.gitignore`-or-commit decision for the artifact |
| (iii) hybrid     | everything in (i), **plus** a merge/override rule between config default and the Sanity read — the most parts of all                                                                |

This is the repo's own **[D24] deferral discipline** ("name where it will live; don't stand
up structure until a concrete trigger earns it") and **AGENTS.md**'s "fewest moving parts
for the same guarantee" applied directly. The trigger that would earn (i)'s machinery is
"an editor needs to re-theme the shell without a deploy." Until that trigger fires, (i) is
**ceremony around a value that never changes between deploys** — and a value that _does_
change between deploys is a code change anyway (you're deploying), so the Sanity hop adds a
content round-trip to something already gated on a deploy.

(iii) the hybrid is the worst of the Architect's worlds: it pays (i)'s full toolchain cost
**and** introduces a precedence question ("which wins, the config default or the Sanity
read, and why"). Two sources of truth with a documented merge rule is the canonical
over-abstraction smell. Reject unless a lens surfaces a concrete need for both layers — I
don't see one.

### What about `brandColorDark`?

`SITE_SETTINGS_QUERY` pulls `brandColorDark` (`queries.ts:73`) and the engine is
scheme-aware by `[D5]` (`(brandColor, scheme) → tokenSet`, a single `brandColor`
generates _both_ ramps, `brandColorDark` is an _optional_ hand-tuned override). So the
shell config surface is at most `{ title, description, brandColor, brandColorDark?, fontKey }`
— a handful of developer-decided primitives. `fontKey` is _already_ a developer concept: it
indexes the code-owned font roster (`[D11]`, `roster[fontKey]`), and `[D16]` already
**disables stega on `brandColor`/`fontKey`** precisely because they are machine-consumed
config, not editorial prose. The schema is already treating these as config-shaped. (ii)
just finishes the thought.

## 3. The [D15] litmus, applied explicitly to shell identity

[D15] verbatim: _"editor writes/curates it → typed block (content); developer decides it →
registry/config; neither → not an input."_ Field by field:

- **`brandColor` / `brandColorDark`** — a developer decision. It must parse as OKLCH, gamut-map,
  and contrast-solve (`[D9]`, `[D4]`, `[D6]`); `[D16]` strips stega from it because it is
  _consumed by code_, not read by humans. An editor "curating" the shell's brand is not a
  content task on a portfolio — it's a design/identity decision the developer owns. → **config**.
- **`fontKey`** — indexes the code-owned roster (`[D11]`). An unknown key degrades to the
  shell mono face (`[D9]`, `layout.tsx:70–77`). This is a _reference to a developer registry_.
  By [D15] a key into a code registry is the textbook "developer decides it → registry."
  → **config**.
- **`title` / `description`** — the one _arguable_ content case. These are human-readable
  strings that feed `generateMetadata` (`layout.tsx:43–45`). On a site with editor-managed
  copy they'd be content. On _this_ site — a personal portfolio whose site title is "Digital
  Garden" and changes roughly never — they are developer-decided identity strings. The litmus
  asks _who curates it_; the honest answer for a one-author portfolio is the author-as-developer,
  in a deploy. → **config**, but this is the field SanityModel should pressure-test (§5).

**Litmus verdict:** every shell-identity field lands on the _developer-decides → config_ side,
or (for title/description) is at best ambiguous and defaults to config under [D24]'s
"don't stand up structure until a trigger earns it." Nothing in shell identity is something
**an editor writes or curates as content**. By [D15], the shell brand _should leave
`siteSettings`_ — option (ii) isn't a regression, it's the litmus being applied correctly.
The tradeoff the prompt flags for (ii) ("shell brand leaves `siteSettings`") is, under this
lens, **the point**, not the cost.

## 4. Strongest case AGAINST my position (steelman of (i))

1. **Single-system-of-record for "site identity."** A real editor (or future-you in the
   Studio) sees title, description, and brand swatches alongside the project documents and
   edits them in one place, with Sanity validation (`[D9]` author-time `validation` using the
   engine's own pipeline) catching a bad `brandColor` _before_ it ships. (ii) loses that
   author-time guard and the Presentation/visual-editing affordance for the shell. If the
   site owner is a _content person_, "edit your site title in code" is a genuine regression in
   who-can-do-what.

2. **`generateMetadata` already reads it; keep the model uniform.** The codebase has _one_
   read path (`sanityFetch`, deliberately — `sanityFetch.ts:7–9` "so the published-vs-draft
   branch lives in exactly one place"). (ii) introduces a **second** sourcing model for
   content-shaped values: most things come from Sanity, but the shell comes from a config
   file. A reader now has to know which values are "special." (i) keeps _everything_ sourced
   from Sanity and merely changes _when_ the shell read happens (build vs request) — arguably
   the smaller conceptual delta.

3. **Re-theming without a code change.** If the brand is ever A/B'd, seasonally swapped, or
   handed to a non-dev collaborator, (i) lets the shell re-brand by editing Sanity +
   redeploying (or triggering a rebuild) — no PR, no `shell.config.ts` diff. (ii) makes every
   shell re-theme a code change forever. The generated-file + CI step is the price of keeping
   that door open.

4. **The generated-file pattern is not exotic here.** The repo _already_ generates
   `sanity.types.ts` from the Studio schema in CI and `git diff --exit-code`s it (`[D23]`,
   AGENTS.md pre-flight). A generated shell-identity constant is the _same proven pattern_,
   so (i)'s "extra CI step" is incremental, not novel — the toolchain muscle already exists.

My rebuttal in one line: (4) is the strongest and it _narrows_ the cost gap, but it doesn't
change the litmus — generating `sanity.types.ts` bridges _types_ a developer can't
hand-author from a schema an editor genuinely owns; generating a shell-brand constant
bridges a value the developer _already decides_, so it's the same machinery aimed at a
non-problem. And (1)/(3) both reduce to "what if the shell brand is content?" — which is
precisely the [D15] question SanityModel must answer, not assume.

## 5. Open questions for the other lenses

**For SanityModel (you own the litmus's factual premise):**

1. Is there _any_ real workflow — now or credibly near — where an editor curates shell
   `title`/`brandColor`/`fontKey` as a **content** task from the Studio, independent of a
   deploy? If yes, [D15] flips and I concede toward (i). If no, (ii) stands.
2. `siteSettings` is a singleton with a `[0]` guard (`queries.ts:57–75`) and stega already
   disabled on `brandColor`/`fontKey` (`[D16]`). Does pulling shell identity out of
   `siteSettings` leave that document with _enough_ genuinely-editorial content to still
   justify existing — or does it dissolve? (i.e. is `siteSettings` _already_ mostly config in
   content's clothing?)

**For FrameworkFit:** 3. Confirm the agreed premise from the docs: a _published-pinned_ `use cache` read **still
re-executes (suspends) under Draft Mode** — `use-cache.md` §"Draft Mode" + `draft-mode.md`
note 47 say _all_ cached functions re-execute, with no published-pin escape hatch. If
that's airtight, async-anything for the shell is dead and only a synchronous constant
survives — which both (i) and (ii) satisfy, so this doesn't pick between them but it does
_kill_ any "just re-pin the read" counter-proposal. 4. For (i): where does the prebuild Sanity read run, and does it cleanly _not_ taint the
isomorphic engine (`[D14]` — no `server-only`/`client-only` in `@garden/oklch`) or the
`pnpm build` graph? Is "generate constant → build" expressible without fighting Turbopack's
chunk-order sensitivity (`[D27]`)?

**For DevilsAdvocate:** 5. Attack the agreed frame itself: is "make `ShellTheme` synchronous" actually necessary, or
is the dev-only ~14ms one-frame flash (zero frames in prod, per the BACKGROUND) **not worth
any of this** — i.e. is the right-sized answer "document the dev-only artifact and change
nothing"? If the flash doesn't clear the bar for _any_ change, it certainly doesn't clear
the bar for (i)'s toolchain. 6. The `generateMetadata` lockstep (`layout.tsx:115–128`): once `ShellTheme` is synchronous,
`generateMetadata`'s shell read **must** also become a synchronous constant or it
re-introduces the blocking-route problem under Draft Mode (`generate-metadata.md`
§"With Cache Components"). Does any option let these two drift, or must they move together?
I assert they must move together — both read the same `SITE_SETTINGS_QUERY` and both must
become the same constant. Confirm or break.

## Citations index

- `src/app/layout.tsx` — `ShellTheme` async read (63–87), `ShellThemeFallback` href-dedup
  hazard (89–105), the load-bearing `<Suspense>` + `generateMetadata` licensing comment
  (115–133), `generateMetadata` (41–59).
- `src/sanity/lib/sanityFetch.ts` — single read path, Draft Mode re-execution (7–31, 63–64).
- `src/sanity/lib/queries.ts` — `SITE_SETTINGS_QUERY` fields (66–75), singleton `[0]` (57–65).
- `docs/decisions.md` — [D15] litmus (171–181), [D9] never-throw + author-time validation
  (87–92), [D11] Cache Components / fontKey roster (104–135), [D16] stega off brandColor/fontKey
  (184–192), [D5] scheme-aware engine / brandColorDark optional (52–62), [D23] generated
  `sanity.types.ts` in CI (272–288), [D24] deferral discipline (292–316), [D27] Turbopack
  chunk-order (384–420).
- `node_modules/next/dist/docs/.../01-directives/use-cache.md` §"Draft Mode" (215–237):
  _all_ cached functions/components re-execute every request under Draft Mode, nothing saved.
- `node_modules/next/dist/docs/.../04-functions/draft-mode.md` note 47: same guarantee.
- `node_modules/next/dist/docs/.../04-functions/generate-metadata.md` §"With Cache Components"
  (1254–1314): metadata defers to request time on uncached fetch; Suspense'd dynamic markers.
