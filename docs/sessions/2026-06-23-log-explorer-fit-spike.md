# Log-Explorer Fit-Spike (Phase 2)

> **Goal `[D17, §1, §4]`:** pull the migration risk forward without doing the migration. Map
> log-explorer's _real_ surface — odd state shapes, embed-prop needs, page shapes — onto the
> Phase-2 module structure + content model, **now, while it's cheap**, and answer one question:
> **does the model hold log-explorer, or where are the gaps?**

**Verdict (TL;DR): the content model holds.** The reference-by-key spine
(`componentKey` / `embedKey`), the single `brandColor` seed + optional `brandColorDark`, the
Portable-Text `essay` with key-only live embeds, and real-`reference` note backlinks all map
log-explorer cleanly. The one genuinely load-bearing tension — embedding the live demo in
**preset states** inside the essay — is exactly what `[D15]` already resolves (registered keys,
not an authored props blob). The open items below are **confirmations, not redesigns**, and
**none require a schema change now**.

> **Honesty caveat.** The actual log-explorer source is **not in this repo** — it's the old
> "fused bundle" this rearchitecture exists to migrate (`§1`, `architecture-plan` line 26). This
> spike reasons from (a) the architecture docs' own description of it as the migration target and
> (b) the well-understood shape of an interactive **log explorer** (load logs → filter / search /
> facet / time-range → virtualized rows → expandable detail → severity levels). The Phase-4
> migration **must re-run this check against the real code** — every "confirm" below is a
> ground-truthing TODO, not a settled fact.

---

## What log-explorer actually is (assumed surface)

An interactive log-viewing tool. Its plausible real surface:

- **Interaction state:** active filters, free-text query, selected time range, facet selections,
  the currently-expanded/selected entry, virtualized-list scroll position.
- **Severity / status:** log levels (error / warn / info / debug) → **status colors**, distinct
  from the brand ramp.
- **Data:** a sample log dataset the demo explores (a fixture, or possibly an uploadable file).
- **Pages:** the live experience (the tool itself), an essay write-up that embeds it in place of
  screenshots, possibly a hero.

---

## Mapping onto the content model

| log-explorer surface                     | Content-model home                                                        | Holds?     | Note                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| Which coded module to mount              | `project.componentKey` (plain string → `projects/registry.ts`) `[D10]`    | ✅         | Resolved in app code; Studio never imports the registry `[§6, D23]`.                                           |
| Island brand + type                      | `project.brandColor` + `project.fontKey` (+ optional `brandColorDark`)    | ✅         | One seed → both schemes `[D5]`. A dark-by-default log UI is exactly the `brandColorDark` use-case.             |
| The write-up                             | `project.essay` (Portable Text)                                           | ✅         | `block` + `liveEmbed` + `figure`.                                                                              |
| Embedding the **live demo** in the essay | `liveEmbed { embedKey, caption }` (the default block) `[D15]`             | ✅         | Key + caption only; click-to-edit targets the caption, not the tool `[D16]`.                                   |
| Embedding the demo in a **preset state** | a **separate registered `embedKey`** (e.g. `log-explorer-errors`) `[D15]` | ✅         | See "the load-bearing tension" below — this is the litmus working, not a gap.                                  |
| All interaction state (filters/query/…)  | **none — lives in code** (the experience's `useState` / headless `core/`) | ✅         | Content model stores zero interaction state, by design (same spirit as `[D16]`'s "scheme is render-time").     |
| Severity / status colors                 | **none — code-seeded** semantic colors `[D8]`                             | ✅ (G1)    | Intentionally not content. log-explorer is the likely first status-bearing UI → builds them in Phase 4 `[D8]`. |
| Related digital-garden notes             | `project.notes` → real `reference` to `note` `[D16]`                      | ✅         | `references()` resolves; integrity datastore-enforced.                                                         |
| Images in the write-up                   | `figure` typed block (asset + alt + caption) `[D15]`                      | ✅         | Genuine editorial content → typed block, per the D15 litmus.                                                   |
| Sample log dataset                       | **likely code fixture — none** (see G3)                                   | ⚠️ confirm | If it must be editor-uploadable, that's a file-asset field; if a code fixture, no model change.                |
| Multiple distinct long-form pages        | single `project.essay` (see G2)                                           | ⚠️ confirm | One essay + the live experience is expected; multi-page would need a richer body.                              |

---

## The load-bearing tension: embed presets vs. props (validates `[D15]`)

The sharpest migration risk for _any_ interactive project is: **"the essay needs to show the demo
in more than one configuration."** The naïve model is a `props` blob on the embed block
(`liveEmbed { embedKey, props: {...} }`). `[D15]` explicitly forbids that — _developer-decided
config is never authored content._

For log-explorer this resolves cleanly:

- **Initial filter / view presets** (errors-only, timeline view, a specific facet) are
  **developer-decided** → each meaningful preset is a **distinct registered key**
  (`log-explorer`, `log-explorer-errors`, …) **defaulted in the registry**, or one key with the
  default baked in. **Zero schema change**; the essay author just picks the key + writes a caption.
- The litmus: _editor writes/curates it → typed block; developer decides it → registry; neither →
  not an input._ Initial state is the **registry** column.

**Watch-item (confirm against real intent):** if product intent is that an **editor authors** the
embedded view — e.g. types a search string that the embed should open with, as curated narrative
content — that crosses into the typed-block column and would need a small typed embed (à la
`figure`). Current reading: developer-decided → registry. Confirm when the real source lands; if it
flips, it's an _additive_ typed block, not a redesign.

---

## Gaps (all confirmations, none blocking)

- **G1 — Status/semantic colors are code, not content.** log-explorer's severity colors are the
  trigger for the `[D8]` semantic-color set (independently seeded, **not** brand-derived, built in
  Phase 4). The content model correctly has **no** status-color field. _Action:_ none here; ensure
  the foundation reserves the semantic slots (Phase 0 did) and Phase 4 seeds them. **Not a
  content-model gap.**
- **G2 — Multi-page projects.** `project` has a single `essay`. If log-explorer's write-up is one
  long-form essay + the live experience (expected), this holds. If it needs several distinct
  long-form pages, the body needs to become repeatable/section-shaped. _Action:_ confirm against
  the real source; likely no change.
- **G3 — Sample dataset ownership.** If the demo's log data is a **code fixture** (most likely),
  no model change. If it should be **editor-uploadable**, add a file-asset field to `project` (or a
  dedicated doc) at migration time. _Action:_ confirm; cheap to add later either way.
- **G4 — Ground-truth the state shape.** The real risk this spike can't fully retire without the
  source: an "odd state shape" that turns out to want persistence or authored seeding. The mapping
  above assumes **all** interaction state is code-local. _Action:_ Phase-4 migration re-runs this
  table against the actual `log-explorer` code first.

---

## Conclusion

The Phase-2 content model **holds log-explorer**. Nothing in the assumed surface forces a schema
change: interaction state and status colors are code (by design, `[D8]`/`[D16]`), preset embeds are
registered keys (by design, `[D15]`), and the brand/font/essay/notes spine maps 1:1. The migration
this rearchitecture exists for looks **low-surprise** — the remaining work is four cheap
ground-truthing confirmations (G1–G4) against the real source in Phase 4, exactly the de-risking
`[D17]` asked this spike to deliver.
