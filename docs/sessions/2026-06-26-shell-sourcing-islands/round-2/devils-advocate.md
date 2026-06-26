# Round 2 — DevilsAdvocate

Read all three round-1 drafts. The consensus is real but **not uniform**: Architect and FrameworkFit say _all four_ shell fields → config; **SanityModel dissents** and wants a **split** — theme seed (`brandColor`/`brandColorDark`/`fontKey`) → config, but **`title`/`description` stay in `siteSettings`** on the async `generateMetadata` path (sanity-model.md §1, §4). That dissent is the crack I'm widening, because it lands exactly on the one place (iv-c) over-reaches.

---

## 1. Breaking my own consensus

### The fields are NOT one decision — split them by door-cost, not by convenience

(iv-c) bundles five fields into one verdict ("config now"). Three of them are open-and-shut; **two are not**, and pretending they are is the consensus's blind spot.

**`brandColor` / `brandColorDark` / `fontKey` — config now, zero regret, cheap door.**
No scenario survives scrutiny:

- They are **stega-excluded** ([D16]; `client.ts:21`) — already non-click-to-edit in Presentation, so config loses _no_ editing affordance that exists (SanityModel proves this, sanity-model.md §4).
- `brandColorDark` is **fetched-but-dropped** by the shell today (`layout.tsx:73-77` forwards only `brandColor`+`fontKey`; `queries.ts:72` fetches the override) — the "editor tunes the shell" story is _already_ fictional for this field.
- The reopen door is the **[D24]-named `(i)` path**: add a prebuild generator. Cheap, and the recipe is written.
- Verdict on the door: not a one-way door in any meaningful sense, because **nothing real ever wants to walk back through it.**

**`title` / `description` — config now is _defensible_ but it is the genuine regret surface, and the door is NOT cheap.**

This is where I break consensus. Architect (§3) and even my own R1 draft waved these through as "config under [D24]." That was too fast. Three corrections:

1. **They are genuinely editorial.** `description` is "Shell tagline / **default meta description**" (`siteSettings.ts`). Tuning a meta description for SEO/voice is a textbook _ongoing content task_ — the one shell field a non-developer legitimately edits **repeatedly**, not once at rebrand. By [D15]'s own litmus ("editor writes/curates it → content"), this lands on the _content_ side, not config. SanityModel is right and Architect's own draft concedes it's "the one _arguable_ content case" (architect.md:121).

2. **The reopen door is expensive — and the consensus mis-prices it as "edit a file."** Reverting `brandColor` to config-or-Sanity is a value swap. Reverting `title`/`description` to _live-editable_ Sanity is **not** — it re-entangles `generateMetadata` with the draft-deferral / Branch-2 problem this whole slice is deleting. FrameworkFit Claim 3 (framework-fit.md:68-93) proves it: once the body is fully prerenderable, a draft-aware `generateMetadata` read is the **lone deferrer → Branch 2 → error**, and the `'use cache'`-on-metadata escape hatch _does not save it_ (the read is draft-aware, still re-executes). So "let an editor tune the meta description live again, later" is not a config edit — it's re-opening the exact framework hazard we're congratulating ourselves for closing. **That is the one-way-door cost the consensus is hiding.**

3. **The door's true cost is currently _unknown_, because it's entangled with feature #2 (`defineLive`), which isn't built.** Here's the hinge nobody has nailed down: `generateMetadata`'s draft read can ride along on **any** sibling deferral (gen-metadata.md Branch 1, "if other parts also defer"). Today that sibling is the shell. After the shell goes synchronous, **does a child route segment's draft read (the incoming `<SanityLive>`/`liveSanityFetch` content path) count as "other parts" and re-license the root `generateMetadata` read?** If **yes** → SanityModel's split is _free_: `title`/`description` stay editorial, no Branch-2 error, because content deferral carries them. If **no** → keeping them editorial costs a dedicated resolution and config-now is right. **This is unresolved and unspikeable until #2 exists.** (FrameworkFit flagged the Branch-2 surface as spike-needed but did _not_ connect it to whether #2's content deferral re-licenses metadata — that connection is the actual decision input.)

### The single most plausible regret scenario, stated concretely

> Three months out, the user adds a collaborator (or just does their own SEO pass). They open Studio to tune the site's meta `description` and tagline for search/voice — a normal, recurring content task. Under (iv-c) it's a code PR + deploy + a developer-in-the-loop, **forever**. And reopening that door isn't "move two strings back to Sanity" — it's re-solving the `generateMetadata` Branch-2 deferral, possibly re-introducing a Suspense boundary in the root layout we just deleted.

**Verified evidence (lead, against the live Content Lake — project `7id6sf36`/`production`):** the `siteSettings` singleton has **never been edited** — `_createdAt` 2026-06-24T18:15:37Z, `_updatedAt` …:42Z, **5 seconds apart, untouched since**. `brandColorDark` = **null** (so my "fetched-but-dropped" smoking gun is _also_ never-set — doubly dead: queried, dropped by the shell, AND no editor ever populated it). `title` = "Jamie's Digital Garden", `description` set once at creation.

**Is that a real [D24] trigger or a phantom? — judged honestly, not lazily.**

- For `brandColor`/`brandColorDark`/`fontKey`: **phantom, now with hard evidence.** No one tunes a cascade-driving OKLCH token on a Tuesday, a rebrand ships via PR regardless, _and_ the one field that allowed editorial dark-tuning (`brandColorDark`) has a 0-edit, null-value track record. Config-now is correct and the verified fact closes it.
- For `description`/`title`: **the regret survives the verified fact — here's the discipline the evidence does _not_ let me skip.** Zero edits over the doc's entire life is real, but its entire life is **~2 days** (created 2026-06-24; today is 2026-06-26) on a **single-author** repo where the author _is_ the developer. That is the **absence of opportunity, not a decision to never edit** — a 2-day, 1-document, 1-person sample cannot speak to the scenario the regret is actually about: the _moment staffing or workflow changes_ (a collaborator, a deliberate SEO pass). The verified fact rightly demolishes "editors actively re-theme the shell"; it is **silent** on "will meta copy ever become an editor task," because nothing has yet created the conditions for that task to exist. So: the fact **downgrades** the title/description trigger from "likely" to "unproven and currently dormant" — which under [D24] does justify deferring (the trigger hasn't fired) — but it does **not** make it a phantom, because the door it's deferring is the expensive `generateMetadata`-Branch-2 one, not a cheap config swap. **Defer, yes; but defer _knowingly_, with the reopen recipe recorded — don't file it under "zero loss."**

### Two scenarios the prompt named — adjudicated

- **A/B test on shell brand → phantom, AND it doesn't even favor the alternatives.** No experimentation framework exists or is planned; request-time variant serving needs middleware/edge the repo lacks. Decisively: **a build-time constant (i) _cannot_ A/B** (one value baked per deploy), and config (ii) can't either. A/B brand would need a request-time variant mechanism — which is _neither_ (i) nor (ii) nor the status quo. So this scenario argues for _none_ of the options and is irrelevant to the choice. Kill it.
- **CMS-editing collaborator → splits exactly along my field line.** A collaborator editing _content_ (projects, notes, essays) is fully supported and never touches shell identity. A collaborator editing _brand/font_ is a designer doing a rebrand → PR/deploy regardless. A collaborator editing _title/description_ → real, and **only (i) or the status quo serves them** — and (i) only half-serves (their edit shows after a redeploy, never in draft preview, sanity-model.md §3). So even the collaborator scenario doesn't rescue (i): if you genuinely want editor-owned live meta copy, the answer is "keep `title`/`description` async in Sanity" (SanityModel's split), **not** build-time (i).

### My revised recommendation (where I now differ from straight (iv-c))

- **`brandColor` / `brandColorDark` / `fontKey` → config now.** Unanimous, correct, done. Delete from `siteSettings` schema + query.
- **`title` / `description` → do NOT bundle into the same verdict.** Two honest paths, and the choice should be made with the #2 entanglement on the table, not before it:
  - **Path A (ship-now, what I'd default to):** config now, but the decision record must (a) state the [D15] litmus puts these on the _content_ side and we're overriding it on [D24] grounds for a solo portfolio, and (b) write the **exact reopen recipe** including the Branch-2 re-entanglement, so "move them back" is never mistaken for a cheap config edit.
  - **Path B (if synthesis wants to preserve editorial copy):** keep `title`/`description` in `siteSettings`, async, and **sequence their final resolution to land with #2** — verify whether #2's content deferral re-licenses the root `generateMetadata` read. If it does, SanityModel's split costs nothing.
- **The trap to avoid:** shipping (iv-c) as "all five fields, config, clean" and recording it as zero-loss. It is **not** zero-loss for `title`/`description`; it's a deferral with a non-trivial reopen cost. Say so in the ADR or [D28]-style hindsight will bite again.

**One-line synthesis ask:** decide `title`/`description` _separately_ from the theme seed, and decide it _knowing_ the reopen door runs through `generateMetadata`'s Branch-2 problem — not as if it were a `shell.config.ts` line edit.

---

## 2. Test-churn adjudication — the QA contract for the slice

I read all three pinning tests plus the collateral. Verdict per file. **Critical coupling: the exact read-count assertion encodes which §1 decision shipped** — so this contract is the canary for the title/description call.

### `src/app/layout.import-order.test.ts` ([D27]) — **LIVES, untouched. Genuinely orthogonal.**

It pins CSS cascade-layer registration order (foundation.css first side-effect import, before `next/font` and components). A synchronous shell does **not** move any CSS import. Confirmed orthogonal — and it actively _keeps guarding the new code_: FrameworkFit Claim 4 gotcha 2 (framework-fit.md:109-112) notes the new `shell.config` import is a _binding_ import (`import { SHELL_IDENTITY }`, no chunk) and must sit below the CSS imports; the existing assertion "`foundation.css` must be the **first side-effect import** — nothing may precede it" already enforces that. **No change. Re-run on a fresh checkout, never a worktree ([D27]'s own verification trap, decisions.md:402).**

### `src/app/layout.draft-deferral.test.ts` — **SUBSTANTIALLY REWRITTEN / RENAMED. The file's premise (the shell defers in draft) is deleted.** Assertion-by-assertion:

| Assertion (current)                                           | Fate                        | New invariant                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) "wraps the shell subtree in a real `<Suspense>`" (l.43)   | **DIES**                    | The shell no longer defers, so it needs no boundary. Do **not** replace with "no `<Suspense>` anywhere" — too brittle against #2, which may add a _content_ Suspense in the root layout. Assert the shell-specific fact instead (below).                                                                                                                               |
| (b) "reads `SITE_SETTINGS_QUERY` exactly twice" (l.51)        | **INVERTS**                 | **This is the headline new invariant.** Count of `sanityFetch(SITE_SETTINGS_QUERY)` in `layout.tsx` → **`0` if title/description also go config (Path A)**, or **`1` if they stay in `generateMetadata` (Path B)**. The number you assert _is_ the decision record. The DevilsAdvocate flag: pick the number deliberately; a stray `2` means the refactor didn't land. |
| (c) "keeps the body read inside an async `ShellTheme`" (l.62) | **INVERTS**                 | New: `ShellTheme` is **synchronous** — assert `/async function ShellTheme/` is **false** (or the component reads only from the imported constant). This is the positive proof the I/O was removed.                                                                                                                                                                     |
| (d) "mounts `<ProjectScope>` exactly once" (l.69)             | **LIVES (re-rationalized)** | Still `.toBe(1)`, still meaningful — but the _reason_ changes from "the fallback must not also mount one" to "the synchronous shell mounts exactly one." Keep the assertion; rewrite the docstring. This is the migrated structural guard (see next file).                                                                                                             |

→ **Action:** delete the draft-deferral framing, rename the file (e.g. `layout.shell-synchronous.test.ts`), keep (d), invert (b)+(c). Born invariants: _zero (or one) per-request `siteSettings` reads_, _`ShellTheme` synchronous_, _exactly one `ProjectScope`_.

### `src/app/layout.shell-theme-dedup.qa.test.tsx` — **DIES as a file. Not a smell — the failure mode is structurally eliminated.**

Both assertions go:

- (a) "two same-slug `ProjectScope`s collide → React de-dupes to one tag" (l.53) — tests a _true_ React-19 property, but its **purpose** ("why the Suspense fallback must not render `ProjectScope`", l.52) is moot: a synchronous shell has **no fallback**, so there is no second emitter, so the collision is **impossible by construction**, not merely untested.
- (b) "a real `<Suspense>` exists in layout.tsx" (l.67) — **DIES** (same as draft-deferral (a)).

**Is deleting the Item-C regression guard a smell?** No — _and here's the discipline that makes it not one_: you delete a regression test when you delete the **entire failure mode**, not when it's inconvenient. The Item-C hazard (fallback + real both emit `project-theme-garden` → React keeps the wrong one) existed **only because a fallback existed**. Remove the fallback and you remove the hazard's precondition — the "exactly one `ProjectScope`" assertion migrating to the renamed file (d) is the _structural_ proof the collision can't recur, which is **stronger** than the old behavioral test. **This is delete-and-replace, not delete-and-thin.** If synthesis wants to keep the React-de-dup _mechanism_ test as a pure `ProjectScope` unit property, it moves to `ProjectScope.test.tsx` — it does **not** belong in a layout QA file pinning a deleted hazard.

### `src/sanity/lib/queries.test.ts` — **COLLATERAL the three-test list missed. Changes with the schema.**

It asserts `SITE_SETTINGS_QUERY` contains `brandColor`, `brandColorDark`, `fontKey`, `title`, `description` (queries.test.ts:79-85). Once shell identity leaves Sanity:

- **Path A (all config):** nothing reads `siteSettings` → the query (and this test) is **deleted entirely**, or slimmed to whatever (if anything) remains. The `git diff --exit-code sanity.types.ts` gate ([D23]) will also fire when the schema fields are removed and TypeGen reruns — **the slice MUST regenerate `sanity.types.ts`** (AGENTS.md pre-flight; the easiest gate to trip).
- **Path B (title/description stay):** the query slims to `{ _id, title, description }`; this test's field list drops `brandColor`/`brandColorDark`/`fontKey`. Still alive, narrowed.

→ **QA contract must include:** TypeGen regen + `sanity.types.ts` diff committed, and `queries.test.ts` updated (or deleted) to match the surviving query. Don't let this one hide.

### The QA contract, one paragraph

The slice is gate-green only when: `layout.import-order.test.ts` passes **unchanged** (re-run fresh-checkout); the renamed shell-synchronous test asserts the deliberate read-count (**0** for Path A / **1** for Path B), `ShellTheme` synchronous, exactly one `ProjectScope`; `layout.shell-theme-dedup.qa.test.tsx` is **deleted** with its structural guarantee migrated, not dropped; `queries.test.ts` + `sanity.types.ts` are updated to the surviving schema/query; and the [D26]/[D28] browser verification re-confirms flash-free **computed** brand on a production build + draft cookie in **both** color schemes (not token presence in dev HTML — the exact Item-C trap). The fresh-context QA agent should specifically try to break it by: (1) requesting `/` under the draft cookie to confirm no Branch-2 `generateMetadata` throw, and (2) confirming no orphaned `siteSettings` read survives the chosen path.
