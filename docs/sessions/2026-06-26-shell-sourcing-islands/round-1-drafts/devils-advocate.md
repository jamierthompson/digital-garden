# Round 1 — DevilsAdvocate (blind draft)

**Decision under attack:** the synchronous shell constant's _source_ — (i) build-time from Sanity, (ii) code config, (iii) hybrid, (iv) something else. The team has agreed `ShellTheme` goes synchronous; I challenge even that where the evidence lets me.

**Method:** every challenge points at a file, a `[D#]`, or a measured number. Where I assert Next behavior I lean on the bundled-doc citations already embedded in the repo (`sanityFetch.ts` cites `use-cache.md §"Draft Mode"`; `layout.tsx` cites `generate-metadata.md §"With Cache Components"`) plus the spike's own measurements.

---

## 1. The "do nothing" case — at full strength

**The strongest form.** The thing this entire refactor targets is a flash that **users never see**. Measured, instrumented, per-animation-frame, Slow 4G (`docs/handoff-sanity-preview-session.md` §"shell-flash thread", and the `spike/zero-flash-shell` commit message `3497fa9`):

- **Production build (`pnpm build && next start`), draft mode: ZERO unbranded frames.** PPR bakes the resolved real brand into the prerendered static shell and serves it instantly.
- **Dev server: 1 unbranded frame (~14 ms).** Imperceptible, and it is a `next dev` artifact — it does not exist on any surface a visitor or even a Preview editor hits in production.

So the honest framing of the status quo: a **documented, tested, contained** fallback (`ShellThemeFallback`, `layout.tsx:98`) that degrades to a structural-but-unbranded shell for ~14 ms **in dev only**. It is guarded by two pinning tests and three `[D#]`s. It ships correct output on every production path. "Leave it, ship features (`defineLive` #2, revalidation #3, prod preview #4 — all genuinely unbuilt per the handoff)" is a defensible engineering call, and a junior reviewer who said "you're spending a debate + a refactor + test churn on a 14 ms dev-only frame" would not be wrong on the numbers.

**Why it does NOT hold (my honest verdict).** The "do nothing" case defends the _flash_. But the flash was never the real defect — it is a **symptom**. The actual smell is structural and visible in the source regardless of paint timing:

- `ShellTheme` (`layout.tsx:63-68`) fetches a **per-request, draft-aware** value (`sanityFetch(SITE_SETTINGS_QUERY)`) for something that is a **per-request constant**. That single mismatch is what forces the whole apparatus: per-request read → suspends in draft (Cache Components re-executes all `use cache` under Draft Mode, `sanityFetch.ts:14-24` citing `use-cache.md`) → needs a `<Suspense>` → needs a fallback → the fallback **cannot** carry the same-`href` themed `<style>` (React 19 de-dupes hoisted styles by `href`, keeping the first committed — proven by the Item C regression, `layout.shell-theme-dedup.qa.test.tsx:19-35`) → so the fallback is unthemed.
- That is three `[D#]`s of scar tissue ([D9], [D11], [D16]) and a ~40-line load-bearing comment block (`layout.tsx:89-128`) standing guard over a **wrong shape**. Team-grade code does not carry a known-wrong shape indefinitely because its worst symptom happens to be invisible in prod.
- The repo's own discipline forbids the "do nothing" rationalization: **[D28] was written about this exact slice.** The Item C author "verified" the fix by checking token _presence_ in dev HTML and rationalized past a ship-blocker. The lesson recorded in `decisions.md` is that "it looks fine where I checked" is precisely the failure mode this codebase has agreed to stop accepting.

**Verdict:** "do nothing" wins on _user impact_ and loses on _shape_. It is the right answer **only if** you also believe the per-request-constant shape is acceptable — and the repo has already, in writing, decided it is not the kind of thing it ships. So: reject "do nothing," but **steal its discipline** — whatever we build must be _simpler_ than what's there, not a lateral move that swaps one apparatus for another (that disqualifies several candidates below).

---

## 2. Strongest attack on each named option

### Attack on (i) — build-time read from Sanity

**It invents a build dependency the repo does not have, onto a pipeline already shown to be fragile.**

- **Today the build touches zero Content Lake data.** CI's _only_ Sanity coupling is `pnpm --filter studio typegen` + `git diff --exit-code sanity.types.ts` (`.github/workflows/ci.yml:35-36`). That is generated from the **schema** (static, in-repo Studio code) — **no token, no network read of published content**. The build job's env is `NEXT_PUBLIC_SANITY_PROJECT_ID` / `_DATASET` only (`ci.yml:12-13`) — deliberately **no `SANITY_API_READ_TOKEN`**. Option (i) adds a _new_ class of dependency: the build now reads **content** from the Content Lake, which needs a token in CI and network reachability at build time.
- **The pipeline is already visibly fragile here.** Commit `7bb695d` ("ci: deploy Sanity schema from CI (workaround for darwin Rolldown crash)") shows Sanity build tooling has _already_ had to be worked around once. Adding a hard build-time Content Lake read is loading more onto a beam that has bent before.
- **Failure modes, all new:** prebuild token expires → red build; CI can't reach the Content Lake (Sanity incident) → a deploy of an _unrelated_ feature is blocked on Sanity uptime; someone edits the generated constant by hand → silent drift until the next prebuild clobbers it.
- **The "it's like `sanity.types.ts`" defense is a category error.** `sanity.types.ts` is generated from _schema shape_; the proposed constant is generated from _content values_. One needs only the repo; the other needs the live database + auth. Do not let the synthesis wave this through on the precedent — the precedent is exactly the line (i) crosses.

**Counter-attack I'll concede:** the _mechanism_ (generate a file, commit it, `git diff --exit-code` it in CI) is a real, proven repo pattern. If a build-time read is ever justified, **model it on the typegen gate** rather than inventing new ceremony. But that's a future-proofing note, not a reason to build it now (see §4, [D24]).

### Attack on (ii) — code config (`shell.config.ts`)

**The "nothing is lost" claim is mostly true for brand/font and false for the metadata it drags along.**

- **For `brandColor`/`fontKey`: the editorial loss is imaginary, and I can prove it.** These fields are **stega-excluded** (`client.ts:21` lists `brandColor`/`brandColorDark`; [D16] disables stega on them because "invisible encoding chars break the OKLCH parse"). Stega-excluded means **no click-to-edit overlay in Presentation** — the editor literally cannot visually edit them in the preview surface. And the smoking gun: `siteSettings.brandColorDark` is an **authorable, validated field** (`studio/.../siteSettings.ts`) that `SITE_SETTINGS_QUERY` dutifully fetches (`queries.ts:72`) — but `ShellTheme`'s `scopeSeed` **only forwards `brandColor` and `fontKey`** (`layout.tsx:73-77`). The dark override is **already a no-op for the shell.** The "editors tune the shell" story is _already_ partly fictional in the live code. By the repo's own [D15]/[D16] litmus ("developer decides it → registry/config; editor writes/curates it → typed block"), brand/font are config that _happens_ to be sitting in Sanity.
- **Where (ii) genuinely bites: `title` and `description`.** Here "[D15] says config" is **not** a clean fit. `description` is "Shell tagline / default meta description" — that is **marketing copy**, plausibly edited without a developer. And the entanglement makes this unavoidable: making `ShellTheme` synchronous removes the body's draft deferral, which **also licenses `generateMetadata`'s draft read** (`layout.tsx:118-128`; `layout.draft-deferral.test.ts:51-60` pins "reads SITE*SETTINGS_QUERY exactly twice" \_because* the body read rescues `generateMetadata`). Remove the sibling deferral and `generateMetadata`'s own `siteSettings` read trips `Uncached data … outside of <Suspense>` under draft (per the cited `generate-metadata.md §"With Cache Components"`). So a synchronous shell **forces `generateMetadata` to go constant too** — dragging `title` + `description` out of the live path. (ii) doesn't just relocate a color; it hardcodes the site's editable copy. **That** is the honest cost, and the framing that calls this "shell identity = brand + font" undersells it.
- So (ii) is honest for brand/font and **lossy for title/description** — and the debate has been hiding that second half.

### Attack on (iii) — hybrid (config default overridable by build-time read)

**It pays both bills and is the hardest shape to reason about.**

- It inherits **all of (i)'s** new build-time-Sanity dependency and failure modes, **plus** a second source of truth (config default _vs_ build-read override). "Which value is live right now?" now has a branch in it. That is _more_ apparatus than the status quo, not less — and §1 disqualified lateral moves that don't simplify.
- The override semantics are a trap: if the build read fails, do you fall back to the config default (silently shipping a possibly-stale brand and masking a broken pipeline — the exact silent-failure shape [D9]/this repo keeps legislating against) or fail the build (then the config default is dead weight that never runs)? Either answer makes one half of the hybrid pointless.
- **YAGNI by the repo's own law.** [D24] ("establish the pattern early, instantiate it late") says: name where a capability _will_ live, do **not** stand it up until a concrete trigger earns it, and "I'll need this later" is explicitly **not** a trigger. (iii) is the canonical [D24] violation — it builds the build-time-read machinery _now_ to hedge a need (editors changing shell identity between deploys) that has **never once occurred** and whose primary field (`brandColorDark`) the shell doesn't even read.

---

## 3. The (iv) the framing misses

### (iv-a) — The themed-fallback spike, resurrected — and why it's a band-aid, not an option

What `spike/zero-flash-shell` (`3497fa9`) actually does: give `ShellThemeFallback` the **hardcoded constant** brand (`oklch(0.62 0.13 150)` / `fraunces`) so the same-`href` de-dup keeps the _fallback's_ `<style>` and it is now _correct_. The dev flash disappears.

**The case for it:** smallest possible diff (16 lines), no new files, no build dependency, keeps Sanity as nominal source of truth for the published path (in prod, `ShellTheme` doesn't suspend, so the real read still wins).

**Why it's a dead end (killing it with evidence):**

- It is **option (ii) in disguise, but strictly worse** — it hardcodes the brand constant **and** keeps the now-partly-dead async read. In _draft_ mode the async `ShellTheme` suspends, the fallback's hardcoded `<style>` commits first, and React 19 de-dup **drops the real read's output** (the very mechanism `layout.shell-theme-dedup.qa.test.tsx` documents). So an editor previewing an edited shell brand sees the **hardcoded constant**, silently — two sources of truth that diverge _only in the one mode (draft preview) whose entire purpose is to show edits_. The author's own commit message admits it: "a future published change to the shell brand would not appear (the constant wins the de-dup)."
- It carries the **Item C failure mode forward**, merely with the constant set to today's correct value. It is the same hazard, re-armed, depending on a human keeping a hardcoded literal in sync with the Content Lake. That's the definition of a band-aid the user explicitly rejected ("'works on prod' ≠ 'correct'", handoff §"WHERE WE STOPPED").
- It does **not** simplify — the apparatus (async read, Suspense, fallback, dedup comment) all stays; it just papers the fallback. Fails §1's bar.

**Verdict: kill it.** Its only real content — "the shell brand is a constant" — is exactly what (ii)/config says _honestly_, in one place, without a redundant suspending read.

### (iv-b) — Dev-only divergence

Render a constant-themed fallback **only** when `process.env.NODE_ENV !== "production"`. Defends the literal measured fact (flash is dev-only).

**Kill it:** env-conditional _rendering_ of a load-bearing layout subtree is a worse smell than the flash — two code paths through the shell, the prod path effectively untested by the dev path, and it still keeps the whole async/Suspense/fallback apparatus. Strictly worse than (ii) and it doesn't even fix the shape. Mentioned only to take it off the table.

### (iv-c) — The one I'll actually defend: **config-now, build-read-named-later (a sharpened (ii) under [D24])**

Not a fourth mechanism so much as the **disciplined framing the (i)/(ii)/(iii) menu obscures**: the menu argues "where does the value come from" as if it must be answered _maximally and now_. [D24] says answer it _minimally now, name the upgrade path_:

- **Now:** `shell.config.ts` constant for `brandColor`, `fontKey`, `title`, `description`. `ShellTheme` becomes synchronous; `generateMetadata` reads the same constant; the `<Suspense>` (for the shell), the fallback, and both per-request `siteSettings` reads are deleted. This passes the [D15]/[D16] litmus cleanly for brand/font (stega-excluded, developer-decided, already a no-op to "edit") and applies plain YAGNI to title/description (a **solo portfolio**, AGENTS.md header — the title has been "Digital Garden" since commit one; nobody is editing it between deploys).
- **Named, not built:** a comment/decision records that _if_ a real editorial trigger ever appears (an actual second person wanting to change the site title without a deploy), the upgrade is option (i) modeled on the existing `sanity.types.ts` typegen gate — generate `shell.config.generated.ts` from published `siteSettings` in CI, `git diff --exit-code` it. The destination is named so deferral isn't disorder ([D24]'s explicit safeguard).

**The case against my own pick (honestly):** it _does_ remove `title`/`description` from the Content Lake, and `description` is the one field with a colorable editorial claim. If the synthesis believes site copy is genuinely editor-owned, (i) (build-time, keeps Sanity as source) beats my pick _for those two fields specifically_. My rebuttal: there is **zero evidence** anyone has ever edited them, the repo is explicitly solo/learning, and [D24] forbids building for a hypothetical. But I'd accept a **split**: brand/font → config (open-and-shut); title/description → (i) build-time _only if_ synthesis can name a real near-term editor need. Absent that need, all four go to config.

---

## 4. What I'd ship + the single biggest risk

**Ship (iv-c): code config for all four shell fields now, with the build-time-from-Sanity path named-but-deferred per [D24].** It is the only candidate that _simplifies_ (deletes the Suspense + fallback + two reads + the dedup hazard outright, rather than relocating them), it satisfies the [D15]/[D16] litmus where that litmus actually applies, and it respects [D24]. (i) and (iii) build a Content-Lake build dependency to hedge a need that has never occurred; the spike (iv-a) re-arms the Item C hazard.

**Single biggest risk the synthesis MUST resolve before trusting any of this — the `generateMetadata` / `<Suspense>` entanglement, and whether the boundary is load-bearing for _content_ too:**

The handoff flags it ("Wrinkle to validate either way", §"shell-flash thread") and it is _not_ yet spiked. Two unknowns the synthesis cannot hand-wave:

1. When the shell read is gone, does `generateMetadata`'s now-lone draft read still throw `Uncached data … outside of <Suspense>`? If the constant covers metadata too (my plan), this is moot — verify it. If synthesis wants metadata to stay live, the boundary survives _for metadata alone_ and half the "delete the apparatus" benefit evaporates.
2. **Does the body `<Suspense>` license any _other_ draft read** — e.g., the incoming `defineLive` content path (#2, handoff §"defineLive")? If content reads still suspend in draft, the boundary stays for _them_ regardless, and the shell merely _stops being one of the things behind it_. That changes the diff (you don't delete `<Suspense>`, you just move the shell out from under it) but **not** the sourcing decision. Synthesis must state explicitly: "the shell leaves the draft path; the boundary's fate is a _separate_ question owned by #2." Conflating them will produce a wrong diff.

Verify both against `node_modules/next/dist/docs/.../generate-metadata.md` and `.../use-cache.md` on the **real stack** (an async-RSC draft render is not jsdom-testable — `layout.draft-deferral.test.ts:20-24`, [D25]).

**On the test churn (Premise 2 — is deleting the dedup guard a smell?):** No — _if_ done honestly.

- `layout.import-order.test.ts` ([D27]) is **orthogonal** — untouched. The synchronous shell does not move the CSS import anchor.
- `layout.draft-deferral.test.ts` and `layout.shell-theme-dedup.qa.test.tsx` pin invariants of an apparatus this change **deletes** (the Suspense boundary, the exactly-once-ProjectScope-mount, the "fallback must not render ProjectScope"). The dedup guard exists **only because a fallback exists**; remove the fallback and the second-`ProjectScope`-mount hazard is _structurally impossible_, not merely untested. Deleting a regression test because you deleted the entire failure mode is **not** the same smell as deleting it because it's inconvenient. **But** the deletion is only clean if it is _replaced_ by a test pinning the **new** invariant: the shell renders synchronously and performs **zero** per-request `siteSettings` reads (assert `sanityFetch(SITE_SETTINGS_QUERY)` count is **0**, inverting the current "exactly twice"). Delete-and-replace = fine; delete-and-thin-coverage = the smell. The QA pass ([D26]/[D28]) must confirm the replacement lands.

---

## 5. Open questions for the other lenses

- **SanityModel:** Is `siteSettings.title`/`description` _genuinely_ editor-owned, or config-by-habit? Concrete test: has either value changed since commit one, and is there a named non-developer who would edit them between deploys? If no → all four fields are config and (i)/(iii) are solving a phantom. Also: defend or concede that **`brandColorDark` is currently fetched-but-dropped by the shell** (`layout.tsx:73-77` vs `queries.ts:72`) — does the singleton stay in the schema at all if the shell sources from config, or does it shrink to content-only fields?
- **FrameworkFit:** Settle the entanglement in §4 with **bundled-doc citations**: (a) with the shell read gone, does a synchronous shell + a constant-fed `generateMetadata` actually clear the blocking-route rule with **no** `<Suspense>`? (b) Independently — does the `defineLive` content path (#2) keep a draft read behind that boundary, making "delete `<Suspense>`" wrong even though "move the shell out" is right?
- **Architect:** Does build-time codegen from the **Content Lake** (option (i)) cross a line the repo has deliberately held — _the build reads no content, only schema_ (`ci.yml:12-13,35-36`)? If we cross it for the shell, what stops "just one more build-time read" from accreting? And is the [D24] "name-it-defer-it" discipline a sufficient guardrail, or does naming option (i) as the upgrade path quietly pre-commit us to building it?
- **All:** Does anyone dispute §1's verdict — that the flash being **dev-only** makes this a _shape_ fix, not a _bug_ fix? If it's "only" shape, the bar for the chosen option is **must be simpler than the status quo**; that bar alone eliminates (iii) and the spike.
