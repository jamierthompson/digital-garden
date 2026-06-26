# Round 1 — SanityModel lens (content model + editor experience)

> Blind draft. Judges "where does the synchronous shell-identity constant's value come from?"
> from the CMS / content-modeling angle. Cites files as `path:line`, decisions as `[D#]`,
> Sanity docs by URL, Next behavior by the bundled-doc path the repo already cites.

## 1. Position

**(ii) Code config — with a precise split, not a blanket move.** The shell's **theme seed**
(`brandColor`, `brandColorDark`, `fontKey`) is **developer/design-system config masquerading as
content**; it should move to a `shell.config.ts` constant that `ShellTheme` consumes
synchronously. The shell's **editorial copy** (`title`, `description`) is genuinely content and
should **stay in `siteSettings`**, read on the **async `generateMetadata` path** — where it never
touches the synchronous theme and never causes the flash.

So `siteSettings` does not disappear; it **slims to the two fields that are actually editorial and
actually benefit from visual editing.** The synchronous constant that fixes the flash is the theme
seed, and that seed is code.

**I reject (i) build-time-read** as the source for the theme seed: it is mechanically idiomatic but
a **content-model anti-pattern** — it keeps a value in the CMS _specifically so an editor can change
it_, then severs the editorial feedback loop (Presentation, draft preview) that is the only reason
to put a value in a CMS. More in §3–§5.

## 2. Reasoning through the content-model lens

**The repo already has a litmus, and it decides this.** `[D15]` (decisions.md:171): _"editor
writes/curates it → typed block; developer decides it → registry; **neither → not an input.**"_
`[D16]` (decisions.md:183) extends it: _never model code-level config as content; default it in
code._ Apply it to the three shell fields:

- **`brandColor` / `brandColorDark`** — parsed by the OKLCH engine, not rendered as prose
  (`client.ts:19-25` lists them as code-consumed). They ARE the brand. A brand color is a
  design-system token; "changing" it is a rebrand (a design PR), not a Tuesday edit. → **developer
  decides → config.**
- **`fontKey`** — resolved _against code_ by key (`client.ts:11-13`, `siteSettings.ts:46-53`:
  _"Curated roster face… resolved in app code"_). The set of legal values lives in `keys.ts`; the
  field is a pointer into code. → **developer decides → config.**
- **`title` / `description`** — human-readable site name + meta/OG description
  (`siteSettings.ts:18-29`; consumed by `generateMetadata`, `layout.tsx:41-59`). A content/marketing
  team legitimately tunes site title and meta description for SEO/voice. → **editor writes →
  content.** Keep in Sanity.

The theme seed is _already treated as config everywhere in the codebase_ — stega-excluded
(`client.ts:19-25`, `[D16]`), engine-validated, defensively rendered with a code fallback
(`layout.tsx:73-77`, `[D9]`). It is var-consuming design data that happens to be _stored_ in a
document. Option (ii) stops storing config in the content layer; it doesn't remove a capability the
shell actually exercises.

**Who is the "editor"?** Today: solo (the owner, "new to Sanity" per the handoff). Deciding as if a
content team will use it doesn't change the verdict for the _seed_ — a content team edits **copy and
media**, not the OKLCH brand token that drives the cascade-layer system. The people who change a
shell **brand color or font** are designers/developers shipping a redesign, and they ship it through
a PR + deploy regardless of where the value lives. The people who change the **site title** are
editors — so that field stays in the CMS.

**Realistic cadence (the operational story for "editor wants to change the shell title").**

- _Shell title/description:_ occasional (SEO copy, renames) → stays editable in Studio, previews via
  Presentation, publishes live once a revalidation webhook exists (handoff feature #3). Async
  `generateMetadata` read. Cost of editing: zero developer time. ✅ This is why it stays content.
- _Shell brand color/font:_ effectively never (it is the site's identity). Under (ii) a change is a
  one-line `shell.config.ts` edit + deploy — the same workflow a redesign already uses, and _cheaper
  and more reviewable_ than a Studio edit that has to survive validation, stega exclusion, and a
  webhook. The CMS adds **negative** value here: per-request fetch, draft-mode suspend, Suspense
  fallback, unthemed flash (`layout.tsx:89-105`), all to host a value no one edits.

## 3. Is build-time-read-of-published-Sanity a sound, idiomatic pattern?

**Mechanically: yes, fully supported.** A prebuild Node script using `@sanity/client` is a
first-class, documented use (the client lists Node.js as a primary runtime and `client.fetch` as the
read path — https://www.sanity.io/docs/apis-and-sdks/js-client-getting-started). Concretely it would
require:

1. A script (e.g. `scripts/generate-shell-config.ts`) run in a `prebuild`/CI step **before
   `next build`**, that:
   - builds a published-perspective client (`createClient({projectId, dataset, useCdn:true,
perspective:'published', apiVersion})` — same env as `env.ts:1-12`);
   - `client.fetch(SITE_SETTINGS_QUERY)`;
   - writes a generated TS module (e.g. `src/sanity/lib/shell-identity.generated.ts`) exporting a
     typed constant; `ShellTheme` imports it synchronously.
2. **Token:** a **public dataset reads with `useCdn:true` and NO token**; a private dataset needs a
   server-only read token in CI env (the repo already provisions `SANITY_API_READ_TOKEN`,
   `getClient.ts:30`). So a CI secret + env wiring on Vercel.
3. **Generated-file hygiene:** must be `.gitignore`d or committed-and-lint-gated; the repo already
   runs a "regenerate then `git diff --exit-code`" gate for `sanity.types.ts` (`[D23]`,
   AGENTS.md pre-flight), so a second generated artifact is a known shape but **another way to trip
   the gate** and another prebuild dependency on network + token at build time.

**As a content model: it is the worst option for the seed.** Its entire premise is "Sanity stays
source of truth so the editor can change it." But a build-time snapshot means:

- The editor changes shell brand in Studio → **Presentation shows no change** (the iframe runs the
  built app, which imported a baked constant). Draft preview — the feature the user is _actively
  building_ (handoff #1–#2, `defineLive`) — **cannot ever** reflect a build-time-frozen field.
- Publishing shows no change either, **until the next deploy**. So the field presents an editing
  affordance whose effect is invisible and arbitrarily delayed.

That is a **broken editor mental model**: a value sits in the CMS, invites edits, and silently
ignores them between deploys. Sanity's own framing of the content model (e.g.
https://www.sanity.io/docs/developer-guides/deciding-fields-and-relationships and the
singleton/"site settings" pattern in
https://www.sanity.io/docs/studio/manually-group-items-in-a-pane) is about content people _operate
on continuously_ — not deploy-time constants. (i) takes a field out of the live loop while leaving it
in the place that advertises a live loop. (ii) is more honest: config that lives in code _looks like_
config and no one expects Presentation to edit it.

## 4. Editor mental-model + visual-editing / preview impact per option

The decisive fact for this lens, often missed: **the theme seed is ALREADY not click-to-edit.**
`[D16]` + `client.ts:19-25` deliberately **disable stega** on `brandColor`/`brandColorDark`/`fontKey`
because the invisible encoding chars break the OKLCH parse and the font-key lookup. So in
Presentation **today**, an editor _cannot_ click the shell brand color or font to edit it — that
affordance was knowingly surrendered at `[D16]`. Therefore:

- **(ii) Code config (my position).** Moving the seed to `shell.config.ts` **loses no visual-editing
  capability that existed** — the seed was never a stega/click-to-edit target. `title`/`description`
  _can_ carry stega and _are_ legitimate Presentation targets, so keeping them in `siteSettings`
  **preserves the one real visual-editing affordance the shell has.** Net effect on Presentation:
  unchanged. Net effect on the `defineLive` work (handoff #2): **strictly simpler** — the shell drops
  out of the live read path entirely, so `<SanityLive/>` / `liveSanityFetch` only ever handle
  _content_, exactly as the handoff predicts (handoff:62-67, 102-109). The `siteSettings` "Used on
  every page" Presentation location (`sanity.config.ts:77-80`) stays meaningful for the copy fields.
  _Mental-model cost:_ an editor opening "Site settings" no longer sees brand color/font — mildly
  surprising if they expected to theme from Studio (they couldn't usefully anyway). Mitigate with a
  Studio note field or by renaming the doc to "Site metadata."
- **(i) Build-time read.** Worst preview story (see §3): the seed stays in `siteSettings`, _looks_
  editable, shows in no preview, and refreshes only per deploy. Maximally confusing for the editor.
- **(ii)/(i) for `title`/`description`:** if these were _also_ moved to code, the shell would lose a
  **genuine** Presentation affordance (editing the site title in-context). That is the one place the
  CMS earns its keep — hence my split keeps them in Sanity.

## 5. Strongest case AGAINST my position

1. **Single source of truth / future theming product.** If the garden grows toward
   multi-theme, seasonal rebrands, or per-section shell identity controlled by non-developers, a
   brand-color-as-content field becomes valuable, and (ii) means every such change needs a developer
   - deploy. (i) keeps Sanity as SOT _and_ is synchronous _and_ refreshes per deploy — a real middle
     path if "editor-owned rebrand without a code PR, accepting deploy-latency" is a goal. My position
     bets that goal won't materialize for a personal portfolio; if it does, (ii) is a one-way-ish door.
2. **Fractured "Site settings" model.** Splitting the document — copy in Sanity, tokens in code —
   means "what does the shell look like?" now has two homes. A single `siteSettings` doc (option i or
   status quo) is a cleaner editor concept than "look in the doc for the title, look in the repo for
   the color."
3. **The seed-as-content is already wired** (schema, validation, query, stega exclusion, scope seed
   plumbing). (ii) means deleting working schema + query fields and rerunning TypeGen `[D23]` — churn
   the build-time option avoids. (i) reuses every existing field untouched.

## 6. Open questions for the other lenses

- **Architect:** Where does `shell.config.ts` sit relative to the engine isomorphism boundary
  `[D14]` and the `ProjectScope` seed contract? Ideal shape: a typed constant that `resolveScope`
  consumes **identically** to a Sanity-derived seed, so the no-throw `[D9]` path
  (`layout.tsx:73-77`) and the `slug:"garden"` island key (`§3.1`) are byte-for-byte unchanged — the
  only diff is _where the three strings originate_. Does that hold?
- **FrameworkFit:** My split keeps `generateMetadata` reading `siteSettings` **async + draft-aware**
  for `title`/`description`. Once `ShellTheme` is synchronous, the body subtree no longer suspends —
  so does the metadata read **lose its current "license"** and re-trip `Uncached data … outside of
<Suspense>` under Draft Mode (the exact failure `layout.tsx:115-128` documents, citing
  `generate-metadata.md §"With Cache Components"`)? If so, the metadata read needs its **own**
  resolution — published-pinned `'use cache'`, or its own boundary. Verify against
  `node_modules/next/dist/docs/`. This is the one place my "keep copy in Sanity" split adds Next
  complexity, and it must be priced in. (Note: a streamed/delayed `<title>` in draft is invisible —
  no CLS — so even a suspending metadata read is cosmetically fine; the question is purely whether it
  _throws_.)
- **DevilsAdvocate:** Is "an editor realistically never changes the shell brand color/font" a safe
  assumption to hard-code against? Does moving the seed to code quietly **foreclose** a planned
  theming feature, and is the split's two-homes-for-shell-identity cost worse than the flash it cures?
- **All:** If we keep `siteSettings` for copy but move the seed to code, should the schema's
  `brandColor`/`fontKey` fields be **deleted** (honest, but loses the option to revert) or **retained
  but unread** (hedge, but reintroduces the "edits do nothing" confusion that damns option (i))?
