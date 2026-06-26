# Session 2026-06-26 — shell-identity sourcing → Path A (islands)

A 4-lens agent-team architecture debate, then an empirical spike, then a foundational reconsideration
with the driver. The question that had circled several sessions: **where does the shell's brand /
identity come from, and why does the shell "flash" unthemed?**

**Outcome (final — Path A).** The shell is an **editorial Sanity island, symmetric with each project
island**: brand / font / title / description stay in `siteSettings`, read async + draft-aware, live and
draft-previewable — exactly like a project reads its own brand from its document. **No** synchronous-
config refactor, **no** `shell.config.ts`, `siteSettings` is **not** dissolved; **the current
implementation is unchanged.** The unbranded shell flash is **`next dev`-only** (a production build
serves the PPR build-time-resolved themed shell in the initial bytes — zero unbranded frames) and is
**accepted** as a symmetric-island non-issue. See [`synthesis.md`](./synthesis.md) **§0** for the
decision and exactly why it reversed.

> **The trail records a reversal.** The debate first reached a **(ii) code-config** verdict (record it
> as the mid-point). Then the spike showed (a) the flash is **dev-only** — prod was already clean, and
> (b) the framework blocker ("Branch-2 lockstep") **doesn't exist**; and the driver's **islands** frame
> showed the shell brand is _editorial content, not a constant_, so the "wrong shape" premise dissolved.
> Both pillars of the config verdict fell → **Path A**. Read `synthesis.md` §0 as the outcome; the round
> drafts + §1–§8 as the (sound, on its premises) reasoning that pointed the other way.

## The trail

- [`round-1-drafts/`](./round-1-drafts/) — four **blind** independent lens drafts: `architect.md`
  ([D15] litmus / altitude), `sanity-model.md` (content model + editor DX), `framework-fit.md`
  (Cache-Components feasibility vs the bundled Next 16 docs), `devils-advocate.md` (attacks the premise).
- [`round-2/`](./round-2/) — adversarial round: each lens challenged the others, grounded in the bundled
  docs + facts the lead verified against the live Content Lake / CI config.
- [`synthesis.md`](./synthesis.md) — lead synthesis. **§0 = the final Path A outcome + why it reversed**;
  §1–§8 = the superseded config-verdict reasoning, kept as the trail.
- [`spike-findings.md`](./spike-findings.md) — the empirical controls (A–D): flash is dev-only; the
  Branch-2 "lockstep" and the "boundary licenses `generateMetadata`" claims refuted; the `<Suspense>`
  boundary **is** load-bearing for the async body read; plus the `[D27]` import-order red-herring result.
- [`essay-source-material.md`](./essay-source-material.md) — the islands model + the **dev-vs-prod /
  PPR** flash mechanism (the crux), with measured byte offsets and visual ideas — raw material for a
  visual essay.

**Method note:** lenses drafted blind, then debated via direct messaging; the lead verified the
load-bearing facts independently (live `siteSettings` query, `ci.yml`, the bundled docs, and four
build+draft-cookie spike controls) and fed them back so the debate — and the reversal — ran on measured
ground truth, not inference.
