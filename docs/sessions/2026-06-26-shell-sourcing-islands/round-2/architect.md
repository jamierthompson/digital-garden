# Round 2 — Architect lens

> Two challenges from the lead: (1) is "the build reads no Content Lake content, only
> schema" a real architectural boundary worth holding? (2) does naming (i) as a deferred
> upgrade per [D24] "quietly pre-commit" us — and where does title/description land once
> FrameworkFit has shown the live-async "keep in Sanity" shape is illegal?
>
> Position after reading all three round-1 drafts: **unchanged — (ii) code config for all
> four fields now.** Both challenges _strengthen_ it. I now converge explicitly with
> DevilsAdvocate's (iv-c) and against SanityModel's split.

## 1. The build-reads-content line — yes, it is a real boundary, and it is decisive

**Verified the CI claim.** `.github/workflows/ci.yml` job `verify` sets env to
`NEXT_PUBLIC_SANITY_PROJECT_ID` + `NEXT_PUBLIC_SANITY_DATASET` only (`ci.yml:11-13`, both
public, both shipped to the browser). The _only_ Sanity coupling in the gate is
`pnpm --filter studio typegen` → `git diff --exit-code sanity.types.ts` (`ci.yml:35-36`).
There is **no `SANITY_API_READ_TOKEN`**, and the typegen step reads the **in-repo Studio
schema**, not the Content Lake. DevilsAdvocate's factual claim (`devils-advocate.md` §2,
§5) is exactly correct.

**Through the Architect lens this is a hermeticity boundary, and it is the sharpest
argument in the whole debate.** Frame it as the property the build currently has:

> _The build is a pure function of the repo at a commit._ Given the checked-out source,
> `pnpm build` produces the same output with no live external authority and no secret. The
> only "external" input — TypeGen — is itself derived from in-repo code (the Studio schema
> is source, committed; the generated `sanity.types.ts` is committed and diff-gated). The
> build never asks the network "what is true right now?"

Option (i) **breaks that invariant.** A build-time `client.fetch(SITE_SETTINGS_QUERY)`
makes the build's output a function of `(repo, live Content Lake state, valid token,
network reachability)`. That is not a quantitative "one more step" — it is a **category
change in what a build _is_**: from hermetic-and-reproducible to live-DB-dependent. In
source-of-truth terms, the authority for a shipped value moves from _the commit_ to _a
mutable external system queried at build time_. That is precisely the coupling the
Architect lens exists to flag.

**The "it's just like the `sanity.types.ts` gate" defense is a category error — I agree
with DevilsAdvocate and can sharpen _why_ in Architect terms:**

|                             | `sanity.types.ts` (today)                  | Build-time shell constant (option i)                                                     |
| --------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Derived from                | **schema shape** — in-repo Studio code     | **content values** — live Content Lake documents                                         |
| Inputs needed               | the repo only                              | repo **+ live DB + read token + network**                                                |
| Reproducible from a commit? | **Yes** — hermetic                         | **No** — depends on DB state _at build time_                                             |
| Authority for the value     | the committed source                       | a mutable external system                                                                |
| Failure surface             | drift caught by `git diff` (deterministic) | token expiry, Sanity downtime, network — **non-deterministic, blocks unrelated deploys** |

Same _file-generation mechanism_, fundamentally different _dependency class_. TypeGen
codifies a contract the repo already owns; (i) imports a fact the repo does not own. The
precedent does not license (i) — **the precedent is the exact line (i) crosses.** Note the
repo has _already_ had to work around Sanity build tooling once (commit `7bb695d`, "darwin
Rolldown crash"); loading a hard Content-Lake read onto that beam is adding weight where it
has already bent.

**Architect verdict on Challenge 1:** the no-content-at-build-time boundary is worth
holding as a first-class invariant, for the same reason the isomorphic-engine boundary
([D14]) and the literal-dynamic-import boundary ([D21]) are held — they are cheap to keep,
expensive to recover once eroded, and "just this one read" is how they erode. Crossing it
for shell identity — a value nobody edits — spends a durable architectural property to host
a constant. That is the worst possible trade: maximal boundary cost, zero benefit. **And
the slippery-slope guard the lead asked for: the rule "the build reads no content, only
schema" is a one-line, lintable/reviewable invariant. "The build may read _some_ content if
it's a constant" is not a boundary at all — it has no edge, so it cannot stop the next
build-time read. A boundary you can state in one sentence is worth more than a judgment call
you re-litigate per PR.** Hold the line.

## 2. The [D24] framing — naming (i) is the discipline working, _not_ pre-commitment

DevilsAdvocate asks whether naming build-time-from-Sanity as the deferred upgrade "quietly
pre-commits" us to building it. **It does not — provided we name it the way [D24] actually
prescribes.** Read [D24] (`decisions.md:292-316`) literally: it is a _table_ of
`Concern | Default | Trigger to instantiate`, and it states two safeguards in tension:

1. _"name where each kind of code will live"_ — naming is **mandatory**, because it is what
   "stops deferral becoming disorder — a reader always knows where a concern _will_ go."
2. *"'I'll need this later' is explicitly **not** a trigger — the discipline is to wait for
   the *actual* second use."*

So naming a destination is the **opposite** of pre-committing: [D24] _requires_ the name and
_forbids_ treating the name as a reason to build. The pre-commitment DevilsAdvocate fears
only happens if we name (i) as a _roadmap milestone_ ("we'll add this") rather than as a
_trigger-gated default_ ("if and only if X, this is where it goes"). The fix is purely in
how we write it — make the trigger a **falsifiable condition**, not a vibe:

> **Default:** shell identity (`title`, `description`, `brandColor`, `fontKey`) is a code
> constant in `shell.config.ts`.
> **Trigger to instantiate (i):** a _named non-developer_ needs to change a shell-identity
> field _without a deploy_, **and accepts deploy-latency** (no live preview — see §3). Until
> both are true, (i) is not built.

That is a `[D24]`-table row, identical in form to the four rows already in the decision. It
is legible deferral, not a hidden commitment.

**But the Architect refinement the lead should carry into synthesis:** naming (i) as _the_
upgrade path is naming the **wrong destination for the most likely trigger**. Decompose the
hypothetical future need:

- **Trigger A — "editor wants to change the title, deploy-latency is fine."** Upgrade = (i),
  build-time generation. Plausible but narrow.
- **Trigger B — "editor wants _live_ editorial control of the title (see edits in
  Presentation / draft)."** Upgrade is **not (i)** — FrameworkFit proved a build-time
  constant gives _no_ live preview (`framework-fit.md` §5.1: "a build-time constant still
  won't live-preview shell edits"). Trigger B's real destination is a **runtime** draft-aware
  read for _metadata only_, behind its own resolution — i.e. re-introducing a slice of the
  very apparatus we are removing, scoped to `generateMetadata`.

A single "name (i) as the upgrade" entry silently assumes Trigger A and mis-routes Trigger
B. The honest [D24] entry names **both** branches and which trigger selects each. This
_strengthens_ "config now," because it shows (i) is not even the natural upgrade for the
likelier editorial trigger — so we are deferring a path that may never be the right one,
which is exactly the kind of structure [D24] says _not_ to stand up speculatively.

## 3. Where title/description land — config-now, by the litmus against the factual premise

The lead's framing is the crux, and FrameworkFit collapsed the option space for me. Three
facts, chained:

1. **SanityModel's preferred shape is illegal.** SanityModel (`sanity-model.md` §1, §6) wants
   `title`/`description` to _stay in `siteSettings`, read on the async `generateMetadata`
   path_. FrameworkFit Claim 3 (`framework-fit.md` §1, §2) shows that once `ShellTheme` is
   synchronous, the body is fully prerenderable, so a still-async draft-aware
   `generateMetadata` read flips from Branch 1 (licensed) to **Branch 2 → error**
   (`gen-metadata.md` §"With Cache Components", l.1254-1273); and the `'use cache'`-on-
   `generateMetadata` escape **doesn't save it** because the read is still draft-aware. So
   SanityModel's "keep it live in Sanity" shape **does not survive contact with the
   framework** without re-introducing a body Suspense/dynamic-marker — a partial walk-back of
   the deletion that is the whole point.
2. **Therefore the live-Sanity option is gone.** The only legal "keep it in Sanity" is (i)
   build-time-generated — a _constant_, with **no live preview and no edit-without-redeploy**
   (FrameworkFit §3 table; `framework-fit.md` §5.1). So for title/description the real choice
   is exactly two: **(ii) config-now constant** vs **(i) build-time-from-Sanity constant.**
   Both are constants; the only difference is _where the constant's bytes originate_ and _what
   the build must touch to get them_.
3. **[D15] against the _verified_ fact decides between those two.** [D15]
   (`decisions.md:171-181`): \*editor writes/curates it → content; developer decides it →
   config; **neither → not an input.\*** The litmus turns on the **curation workflow**, not the
   data's prose-shape. The lead has now upgraded my round-1 premise to a **hard fact**: the live
   `siteSettings` document has **never been edited** — `_createdAt` 2026-06-24T18:15:37Z vs
   `_updatedAt` 2026-06-24T18:15:42Z, **5 seconds apart and untouched since** (the gap is just
   the create-then-seed write; `brandColorDark` is `null` and is also dropped by `scopeSeed`,
   `layout.tsx:73-77`). This is no longer "probably never curated" — it is _measured_ zero
   curation. Applied to the litmus:
   - There is no curation workflow, and now we know there has never _been_ one: solo portfolio
     (AGENTS.md header), title "Digital Garden" since seed, no named non-developer editor, and a
     document whose update-timestamp equals its create-timestamp.
   - So title/description are **"developer decides it → config,"** or at most **"neither → not
     an input"** — both land in code. The "editor writes/curates it → content" branch of [D15]
     presupposes an _actual_ ongoing editorial act; the timestamps prove there is none. A field
     that has never been written by an editor is config that happens to be _stored_ in a
     content document — exactly the [D16] "config-by-habit" shape, now with a timestamp to
     prove it.

   Yes, `description` is the one field with a _colorable_ content claim — it is human-readable
   marketing-ish prose, and on a site _with_ editorial staff it would be content. But [D15]
   asks _who curates it_, not _what shape is it_. Shape-says-content, workflow-says-config →
   the litmus resolves to config, and [D24] reinforces it ("wait for the _actual_ second use,"
   not the hypothetical).

**Why (ii) beats (i) specifically for title/description — the Architect tiebreak.** Between
two constants, the only reason to prefer (i) is "keep it editor-editable in Sanity." But
fact (2) shows (i) delivers **no live editability** — edits don't appear until a redeploy,
and never in draft preview. So (i) keeps the field _sitting in Sanity_ while _stripping the
only capability that would justify keeping it there_. That is the precise **source-of-truth
dishonesty** the Architect lens most objects to: a document field that advertises an editing
affordance and silently ignores edits between deploys (SanityModel makes the same point from
the editor-experience angle, `sanity-model.md` §3 — "a broken editor mental model"). (i)
pays the build-reads-content crossing (§1) **and** ships a dishonest affordance, to host a
value nobody edits. (ii) is honest: config that lives in code _looks like_ config; nobody
expects Presentation to edit it. **Config-now wins for all four fields.**

This also disposes of SanityModel's split-the-document worry (`sanity-model.md` §5.2,
"two homes for shell identity"). The split SanityModel proposes (seed in code, copy in
Sanity) is the shape FrameworkFit just proved illegal-as-live; the only legal split is
seed-in-code + copy-as-build-constant, which is two homes _and_ a content-read crossing _and_
a dishonest affordance. Putting all four in `shell.config.ts` is the _one-home_ answer — more
cohesive, not less.

## 4. Convergence and the one synthesis caveat I co-sign

I converge with **DevilsAdvocate (iv-c)**: ship `shell.config.ts` for all four fields now;
`ShellTheme` synchronous; `generateMetadata` reads the same constant in lockstep (the
atomicity constraint FrameworkFit Claim 3 proved — convert both reads together or draft mode
breaks); name (i) as a trigger-gated upgrade per [D24], written as the falsifiable row in §2
(and honestly noting (i) only serves Trigger A, not Trigger B).

**The caveat I co-sign for synthesis (DevilsAdvocate §4, FrameworkFit §5):** "the shell
leaves the draft path" and "delete the `<Suspense>` boundary" are **separate questions.** If
the incoming `defineLive` content path (handoff #2) keeps a draft read suspending under the
body boundary, the boundary stays _for that content_ and the shell merely stops being one of
the things under it — the diff becomes "move the shell out from under `<Suspense>`," not
"delete `<Suspense>`." That does **not** change the sourcing decision (config-now stands
either way), but synthesis must state it explicitly so the implementer doesn't write the wrong
diff. This is a framework-mechanics question owned by FrameworkFit and the #2 slice, not by
the sourcing verdict.

## Citations index

- `.github/workflows/ci.yml:11-13,35-36` — public env only, no read token; build reads schema
  (typegen), not Content Lake.
- `src/app/layout.tsx:41-42,63-77,115-133` — `generateMetadata` + `ShellTheme` both read
  `SITE_SETTINGS_QUERY`; `scopeSeed` forwards only `brandColor`/`fontKey` (brandColorDark
  fetched-but-dropped, `queries.ts:73`).
- `docs/decisions.md` — [D15] litmus (171-181), [D24] name-default + trigger table (292-316),
  [D14]/[D21] held boundaries (163-169, 257-263), [D16] stega off seed (184-192).
- `node_modules/next/dist/docs/.../generate-metadata.md` §"With Cache Components" (1254-1273)
  — Branch-1 licensed vs Branch-2 error; `'use cache'` escape insufficient for a draft-aware read.
- Round-1 drafts: `framework-fit.md` (Claims 1-3, §3 table, §5.1 — no live preview from a
  build constant); `sanity-model.md` (§1 split, §3 broken editor model); `devils-advocate.md`
  (§2 build-reads-content category error, §3 iv-c, §4 separate-questions caveat).
