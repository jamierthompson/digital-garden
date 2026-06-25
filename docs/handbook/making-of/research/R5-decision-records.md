# R5 — Decision Records (ADR practice)

Research note for the handbook authors. Scope: verified external ADR standards +
the format already running in this repo (`../../../decisions.md`, D1–D23), and a
right-sized decision-record **process** recommendation for a solo, agent-driven
portfolio. Research only — no handbook prose is authored here.

## What the standards actually say (primary sources)

**Origin — Nygard, 2011.** Michael Nygard coined the ADR in the essay
"Documenting Architecture Decisions" while at Cognitect. The format is
deliberately lightweight: a short doc (one to two pages) that answers one
question — _why did we do it this way?_ — written "as if it is a conversation
with a future developer." Five sections:

| Section          | Nygard's guidance                                                            |
| ---------------- | ---------------------------------------------------------------------------- |
| **Title**        | short noun phrase, numbered (`ADR 1: …`)                                     |
| **Status**       | proposed / accepted / deprecated / superseded (+ pointer to the replacement) |
| **Context**      | the forces at play — technical, social, project-local — in **neutral** voice |
| **Decision**     | full sentences, active voice: **"We will …"**                                |
| **Consequences** | _all_ outcomes, not just the positive ones — what gets easier AND harder     |

Source: Nygard, "Documenting Architecture Decisions"
(https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions);
template at
https://github.com/joelparkerhenderson/architecture-decision-record/blob/main/locales/en/templates/decision-record-template-by-michael-nygard/index.md

**Two immutability rules that matter most (Nygard + Fowler):**

1. **Sequential, monotonic numbering — numbers are never reused.**
2. **Accepted ADRs are never edited or reopened.** When a decision changes you
   write a _new_ record that **supersedes** the old one; the old one stays in the
   log marked `superseded by ADR-N`. This preserves the audit trail of _why the
   thinking changed_. Fowler: "Once an ADR is accepted, it should never be
   reopened or changed — instead it should be superseded."
   Source: https://martinfowler.com/bliki/ArchitectureDecisionRecord.html

**Where ADRs live (Fowler):** in the source repo of the code they apply to —
`doc/adr/` is the common path — in lightweight markup (Markdown) so they diff and
travel with the code. (This repo already does this: `docs/decisions.md`.)

**adr.github.io** is the umbrella reference. An ADR "captures a single AD and its
rationale"; the running collection is the **decision log**. The bar for recording
is an **architecturally significant** decision — one with a measurable effect on
structure or quality (ASR, after Zdun et al., "Sustainable Architectural
Decisions"). Source: https://adr.github.io/

**MADR (Markdown Any Decision Records)** is the heavier, structured evolution.
Front-matter metadata (`status`, `date`, `deciders`) plus: Context & Problem
Statement → Decision Drivers → **Considered Options** → Decision Outcome
(+ Consequences + **Confirmation**: how the decision is validated, e.g. a test or
review) → Pros/Cons per option → More Information. Ships full and minimal
variants, each annotated or bare. Sources: https://adr.github.io/madr/ ;
https://adr.github.io/adr-templates/ ; https://github.com/adr/madr

## How this repo already does it (ground truth)

`docs/decisions.md` is a **single-file** ADR log, D1–D23, not one-file-per-ADR.
Each entry's shape:

```
### D# — <imperative title>
**<Status>** (optional: who/when, e.g. "(user call, 2026-06-21)"). Amends §N, §M.
<why / forces / the resolved call, often citing verification source>
```

Observed conventions worth encoding as-is:

- **Status vocabulary in use:** `Decided`, `Decided (build deferred)`,
  `Decided (verified against <source>)`, `Open`. ("Open items summary" footer
  tracks anything unresolved — currently none.)
- **Anchoring:** every record cites the plan sections it changes via **`Amends §N`**
  and cross-references sibling decisions inline as **`[D#]`** (e.g. D5 cites
  D16; D11 supersedes a §7 reading; D17 amends `build-phases.md`). This is the
  repo's supersession mechanism today — newer D# entries explicitly say what they
  override (D11 "supersedes the casual reading of §7"; D23 "Supersedes the
  'one app, no workspace' framing in §7").
- **The "debate" provenance:** decisions were produced by the five-lens audit
  (`../../../audit/README.md` → `round-1` → `round-2-debate.md` → `synthesis.md`).
  Lenses: Architect, FrameworkFit, Theming, ContentModel, Sequencing. The debate
  round (devil's advocate: challenge / defend / concede) is where the plan
  actually moved. `decisions.md` is the distilled output; `synthesis.md` is the
  reasoning.
- **Verification discipline:** version-dependent calls cite the bundled-doc path
  they were checked against (D11, D12, D23) — never model memory. This mirrors
  AGENTS.md's "read `node_modules/next/dist/docs/` first" rule.

## Recommended process (right-sized for solo + agents)

**Keep the single-file `docs/decisions.md` log + `D#` scheme.** Do not migrate to
one-file-per-ADR or full MADR — that ceremony is for multi-team governance and
fails the project's "right-sized, not maximal" test. Borrow MADR's _Considered
Options_ and _Confirmation_ ideas only where a call is genuinely contested.

**1. When to open a decision.** Only for an **architecturally significant** call —
one that's hard to reverse, crosses module/package boundaries, locks an external
contract (Sanity schema, `keys.ts`, token names), or contradicts the plan/an
existing `[D#]`. Day-to-day coding choices do **not** get a record. Litmus: _would
a future agent landing cold be confused or do harm without knowing why?_

**2. The debate round (lightweight).** For a contested or high-blast-radius call,
run a compressed version of the audit pattern: state the forces, enumerate
**considered options** with honest pros/cons, then the decision + _all_
consequences. For an obvious call, a single Nygard-style paragraph is enough — do
not manufacture a debate. A solo owner or an agent can run both sides; cite any
external standard or **bundled-doc path** that settles a version-dependent fact.

**3. Recording.** Append the next monotonic `D#`. Required: imperative title,
**Status**, **`Amends §N`** (which plan section it changes), the _why_, and inline
`[D#]` cross-refs. Add a date + "(user call)" when the owner makes the final call.
Numbers are **never reused**.

**4. Superseding.** Never edit an accepted decision's substance. Open a **new**
`D#` that says **"Supersedes D#"**; edit the old entry's status line only to add
**`Superseded by D#`** (a pointer, not a rewrite). This is exactly the
Nygard/Fowler rule and matches what D11/D23 already do informally — the
recommendation is to make `Superseded by` a fixed status token.

**5. CI fit.** No new gate is needed; this is prose. Optionally extend the
existing `format:check`/markdown lint to the handbook. (Repo scripts today:
`lint`, `lint:css`, `lint:keys`, `typecheck`, `test`, `format` — `.github/workflows/ci.yml`.)

## Pitfalls to flag for the authors

- **Don't reopen/rewrite accepted entries** — the #1 way ADR logs lose their
  value is editing history instead of superseding. Encode `Superseded by D#`.
- **Don't over-template.** Full MADR per decision is ceremony this repo doesn't
  need; the existing one-paragraph form is correct for most `D#`s.
- **Don't record trivia.** A log full of non-significant entries buries the
  significant ones. Keep the bar at "architecturally significant."
- **Keep the `§N` / `[D#]` anchors.** They are what make the log navigable and
  prevent silent contradiction of the plan. A new decision that touches the plan
  MUST cite the section it amends.
- **Version-dependent facts cite the bundled doc, not memory** (the D11/D12/D23
  precedent) — consistent with AGENTS.md and the Next 16 / React 19 breakage list.
- **Status must be unambiguous** — adopt a closed vocabulary (`Decided`,
  `Decided (build deferred)`, `Open`, `Superseded by D#`) rather than free text.

## Anchors relevant to this repo

- Log + format in use: `../../../decisions.md` (D1–D23); audit trail:
  `../../../audit/` (README, round-1, `round-2-debate.md`, `synthesis.md`).
- Supersession precedents to cite as the in-repo pattern: **D11** (supersedes a
  §7 reading), **D23** (supersedes "one app, no workspace" §7 framing),
  **D17** (amends `build-phases.md` wholesale).
- Verification-against-bundled-docs precedent: **D11**, **D12**, **D23**.
- Plan-section anchoring convention: every decision's `Amends §N` line.

## Sources

- Nygard, "Documenting Architecture Decisions" (2011):
  https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions
- Nygard template (Joel Parker Henderson collection):
  https://github.com/joelparkerhenderson/architecture-decision-record/blob/main/locales/en/templates/decision-record-template-by-michael-nygard/index.md
- Fowler, "Architecture Decision Record":
  https://martinfowler.com/bliki/ArchitectureDecisionRecord.html
- adr.github.io (ADR umbrella / definition / ASR):
  https://adr.github.io/
- MADR project + templates:
  https://adr.github.io/madr/ · https://adr.github.io/adr-templates/ ·
  https://github.com/adr/madr
