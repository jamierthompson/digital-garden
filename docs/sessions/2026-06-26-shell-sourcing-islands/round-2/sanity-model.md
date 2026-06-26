# Round 2 — SanityModel lens

> Read all three round-1 drafts (`architect.md`, `framework-fit.md`, `devils-advocate.md`).
> Three challenges land on my round-1 **split** (theme seed → code; `title`/`description` → keep
> live in Sanity). I **concede the split** and converge — but the concession is driven by _evidence
> I went and got_, and it sharpens the content-model verdict rather than just capitulating.

## 0. Headline

**Converge on (ii) — code config for ALL FOUR shell fields (`brandColor`, `fontKey`, `title`,
`description`). `siteSettings` dissolves: the fields are DELETED, not retained-unread. The singleton
is _named_ (per [D24]) as the future home for genuinely-editorial, body-rendered, site-wide content
— and instantiated only when such a field actually exists.**

My round-1 split kept `title`/`description` in Sanity for **one** reason: that they were
_live-editable and draft-previewable_ editorial copy. **FrameworkFit killed the "live/previewable"
half (Challenge 1). The facts I pulled killed the "editorial" half (Challenge 2).** With both gone,
keeping them in Sanity buys nothing and costs the metadata-deferral complexity. So the split was
wrong; the underlying litmus verdict (shell identity is config) is now _stronger_, not weaker.

---

## 1. Challenge 1 — framework legality of the split. **CONCEDED.**

FrameworkFit Claim 3 / §2 is doc-cited and correct, and it defeats the live half of my split:

- A synchronous `ShellTheme` makes the body **fully prerenderable**; a still-async, **draft-aware**
  `generateMetadata` read of `title`/`description` becomes the **lone deferrer** → `gen-metadata.md`
  §"With Cache Components" **Branch 2 → error** under Draft Mode (`framework-fit.md` Claim 3, §2).
- The `'use cache'`-on-`generateMetadata` escape **does not rescue it**, because that read is
  draft-aware and re-executes under Draft Mode (`use-cache.md` §"Draft Mode"; FrameworkFit Claim 2).
  Only a _truly synchronous constant_ clears Branch 2.

**On the sibling-content-deferral rescue (the Branch-1 question FrameworkFit is re-examining):** it
**cannot** save a live shell-metadata read, and the reason is a _content-model/route_ fact I can
assert without re-deriving the framework rule. `generateMetadata` here lives in the **root layout**
(`layout.tsx:41`) — it runs for **every** route. Branch 1 ("other parts also defer") only holds on a
given render _if something in that render's body defers_. A route with **static content and no
draft-aware content read** (the home/about/`now` pages — the Phase-3 slice, `[D17]`) has nothing to
defer once the shell is synchronous → Branch 2 → error. So a root-level draft-aware metadata read is
only legal if it can lean on sibling deferral **on every route**, which it can't. **Conclusion: there
is no "live, draft-previewable shell title" under the agreed premise.** The visible nav title is part
of the synchronous shell; the `<head>` `<title>` is governed by `generateMetadata` and must be
constant. Both are dead as live reads.

So the title/description fork is no longer "live Sanity vs. code." It is the **same** fork as
brand/font: **code-config (ii) vs. build-time-snapshot (i)** — and the live-preview tie-breaker that
was my entire reason to keep them in Sanity is **gone**. That collapses the question onto Challenge 2.

---

## 2. Challenge 2 — are `title`/`description` genuinely editor-owned? **VERDICT: NO. Config-by-habit.**

I own this fact, so I went and tested it three ways — not a maybe:

**Test A — has the schema field ever changed since creation?** No.
`git log --follow studio/schemaTypes/documents/siteSettings.ts` → the `title`/`description` field
_definitions_ have not been touched since they were introduced in **#11 (`0ff5461`, Phase 2)**;
`git log -L 18,29:…siteSettings.ts` returns **only the creation commit**.

**Test B — has the live content VALUE ever been edited by an author?** No. I queried the Content Lake
(`production`, project `7id6sf36`) for the singleton:

```jsonc
{
  "_id": "siteSettings",
  "_createdAt": "2026-06-24T18:15:37Z",
  "_updatedAt": "2026-06-24T18:15:42Z", // +5 seconds → the create→publish round-trip, NOT an edit
  "title": "Jamie's Digital Garden",
  "description": "A personal portfolio and digital garden — projects, notes, and writing…",
  "brandColor": "oklch(0.62 0.13 150)",
  "brandColorDark": null, // ← see Challenge 3
  "fontKey": "fraunces",
}
```

`_updatedAt` is **5 seconds** after `_createdAt`. That gap is the seed-then-publish handshake, not
editorial activity. **The document has never been meaningfully edited since the moment it was
seeded.** There is no editorial loop in the data.

**Test C — is there a named non-developer who'd edit them between deploys?** No. `title` is
**"Jamie's Digital Garden"** — a personal name. AGENTS.md's header is unambiguous: _"A personal
portfolio + digital garden."_ The handoff calls the owner a _"design engineer, new to Sanity"_ — the
sole editor **is** the developer. There is no second person, now or named-as-near.

**The one honest nuance, and why it still loses.** `description` is, _by genre_, the field most
plausibly editor-owned — its schema label is literally "Shell tagline / default meta description"
(`siteSettings.ts:28`), and SEO/meta copy is the kind of thing a marketing team edits without a
developer. So I will not pretend `description` is as open-and-shut as `brandColor`. But [D15]'s litmus
asks **"who curates it,"** answered by **evidence**, and [D24] is explicit that _"I'll need this
later" is not a trigger_. **Editorial-by-genre is speculation; editorial-by-evidence is zero here.**
Under the repo's own discipline, speculation defers to config. Verdict: **all four fields are config**
until a real editor and a real edit appear.

This **converges with Architect §5-Q1 / §3** (litmus lands every field on developer-decides) and
**DevilsAdvocate §2 / (iv-c)** (brand/font open-and-shut; `description` the only colorable claim,
overridden by "zero evidence + solo + [D24]"). Three lenses now agree on the fact; I supplied the
measurement.

---

## 3. Challenge 3 — `brandColorDark` smoking gun + schema fate.

**Confirm/refute the no-op: CONFIRMED — and it is worse than stated.**

- `SITE_SETTINGS_QUERY` fetches `brandColorDark` (`queries.ts:71`).
- `ShellTheme`'s `scopeSeed` forwards **only** `brandColor` and `fontKey` (`layout.tsx:73-77`) — it
  **drops `brandColorDark`**. (The engine is scheme-aware and derives dark from `brandColor` when the
  override is empty, `[D5]`; the shell simply never passes the override through.)
- And Test B shows the live value is **`null`**. So `brandColorDark` is **fetched, dropped, _and_
  empty** — a triple-dead field. The "editors tune the shell in Studio" story is already fiction in
  the running code, exactly as DevilsAdvocate §2 argued.

**Delete vs. retain-but-unread? DELETE. This is forced by my own round-1 argument.** In round 1 I
damned option (i) precisely because it produces the **"editor edits the field, nothing happens until
(or even after) a deploy"** confusion. **Retaining `brandColor`/`fontKey`/etc. in the schema while
the shell sources from `shell.config.ts` reproduces that _identical_ sin** — an editor opens "Site
settings," changes `brandColor`, and the live site never moves, because nothing reads it. To stay
intellectually consistent I cannot recommend the retain-but-unread hedge I condemned. **The honest end
state is deletion of the orphaned fields, not a Studio control wired to nothing.**

**Does the `siteSettings` singleton survive? Not as a shell-identity doc.** With all four fields gone,
the document has **no remaining fields** — so the schema type, its singleton Structure wiring
(`sanity.config.ts:14-31`), the `[0]` query (`queries.ts:66-75`), and the Presentation "Used on every
page" location (`sanity.config.ts:77-80`) all come out together. `siteSettings` exists **today solely
to hold shell identity** (nothing else references it; `project`/`note` are independent docs). Remove
shell identity and it dissolves.

**But name its rebirth (this is the content-model lens's positive contribution, per [D24]).** There
_is_ a legitimate future `siteSettings`: a home for **genuinely-editorial, site-wide content that
renders in the body** and therefore _can_ be a live, draft-previewable read behind the existing
`<Suspense>` — e.g. a footer message, social links, an "about/now" status blurb. Those are real
editorial content (an editor writes prose, picks links), they are **not** shell identity, **not**
metadata, and **not** synchronous-constant material — so they sit cleanly on the live content path
and even earn Presentation click-to-edit (unlike the stega-excluded seed, `[D16]`). The singleton
should be **named as that future home and instantiated only when the first such field actually
exists** — not kept alive empty "just in case" (the [D24] discipline DevilsAdvocate invokes in
(iv-c)). So: `siteSettings`-as-shell-identity → deleted now; `siteSettings`-as-editorial-site-content
→ named, deferred, reborn on real use.

---

## 4. What I now hold (revised position)

| Field              | Round-1 (me)        | Round-2 (me)                                         | Why it moved                                              |
| ------------------ | ------------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| `brandColor`       | config              | **config**                                           | unchanged — litmus + stega-excluded + Test B              |
| `brandColorDark`   | config              | **config (delete; it's triple-dead)**                | confirmed fetched-dropped-null                            |
| `fontKey`          | config              | **config**                                           | unchanged — code-registry key                             |
| `title`            | keep live in Sanity | **config**                                           | Challenge 1 killed "live"; Challenge 2 killed "editorial" |
| `description`      | keep live in Sanity | **config**                                           | same; genre-claim overridden by zero-evidence + [D24]     |
| `siteSettings` doc | slimmed singleton   | **dissolved now; named for editorial-rebirth later** | nothing left to hold; retain-unread = the sin I damned    |

**Migration-correctness note (lead-verified).** The `shell.config.ts` constant must be seeded from
the **live published values**, NOT the in-code fallbacks. The fallbacks at `layout.tsx:43-45` /
`73-77` are _degradation defaults_ (`"Digital Garden"`, `"A personal portfolio and digital
garden."`, empty seed) — deliberately thinner than the real content. The live document carries the
**richer** truth: title `"Jamie's Digital Garden"`, the full one-sentence description, `brandColor
oklch(0.62 0.13 150)`, `fontKey "fraunces"` (`brandColorDark` is `null` → omit it; the engine derives
dark from `brandColor`, `[D5]`). So the move is a **one-time content→config migration**, not "reuse
the fallback literal." Bake the published values verbatim; the fallbacks remain only as the `[D9]`
never-throw safety net inside the resolver.

This is **(ii)**, full-strength, matching the (i)-vs-(ii) anchor the synthesis wanted — and it is the
_only_ option that **simplifies** (deletes the suspending read + Suspense-for-the-shell + fallback +
both reads + the de-dup hazard) rather than relocating the apparatus. Option (i) for any field is now
_strictly_ dominated: it can't deliver live preview either (FrameworkFit Claim 1 caveat + §1 above),
so it pays a CI-token + build-read + generated-file cost to preserve a Sanity round-trip that buys
**nothing** for fields no one edits — _and_ re-imports the "edits do nothing until deploy" confusion.

## 5. Residual questions I'm handing on

- **FrameworkFit (owns the boundary's fate):** confirm with bundled-doc citations that once the shell
  - metadata are constant, the body `<Suspense>` is removed for the **shell**, but whether it
    _survives for the `defineLive` content path_ (#2) is a **separate** question — i.e. the shell
    _leaves_ the draft path; it does not by itself delete the boundary (DevilsAdvocate §4-Q2). The
    sourcing verdict (this doc) does not depend on the boundary's fate.
- **Architect / DevilsAdvocate:** do you accept **deletion** (not retain-unread) of the orphaned
  `siteSettings` fields as the consistency-forced end state, and the **named-rebirth** framing for the
  singleton? If anyone wants `siteSettings` kept as an empty shell "for later," that's the [D24] line
  to argue at.
- **All:** the only thing that flips this back toward (i) is a **named, near-term, non-developer
  editor** of `title`/`description`. The evidence (Tests A–C) says there isn't one. If the user
  asserts one exists, (i)-for-those-two-fields reopens — but it _still_ won't live-preview, so the
  user must accept "edit in Studio → redeploy → it appears, with no draft preview." Put that trade to
  them explicitly.
