# Decision Records

How architecturally significant decisions get made, recorded, and superseded in
this repo. The log lives in [`../decisions.md`](../decisions.md) (entries `D1`–`D25`).
This page is the **process**; that file is the **record**.

> Lightweight Nygard-style ADR
> ([_Documenting Architecture Decisions_](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions),
> 2011; [Fowler](https://martinfowler.com/bliki/ArchitectureDecisionRecord.html)) —
> a short "why did we do it this way?" for a future agent landing cold. **Not** full
> MADR per-file ceremony; that's multi-team governance and fails the project's
> "right-sized, not maximal" bar (§8).

---

## When to open a decision (vs. just proceed)

Most coding choices do **not** get a record. Open a `D#` only when the call is
**architecturally significant** — it has a measurable effect on structure or
quality. Record it if ANY of these is true:

- [ ] It's **hard to reverse** (changing it later means reworking multiple files or a shipped contract).
- [ ] It **crosses a module or package boundary** (e.g. the app ↔ `studio/` workspace seam — see [D23]).
- [ ] It **locks an external contract**: a Sanity schema field, `keys.ts`, public token names (`--brand-*`, `--space-*` — the generic public layer per [D2], **not** the project-internal `--logx-*` alias), or the engine signature `(brandColor, scheme) → tokenSet` ([D5]).
- [ ] It **contradicts the plan** ([`../architecture-plan.md`](../architecture-plan.md)) or an existing `[D#]`.
- [ ] It rests on a **version-dependent framework fact** that breaks model memory (async request APIs, `cacheComponents`, the `@layer` trap, `proxy.ts`) — record it _with the bundled-doc path you verified against_.

**Litmus (the one-line test):** _would a future agent landing cold be confused, or
do harm, without knowing why we chose this?_ If yes → record. If it's a
day-to-day implementation choice a reader can infer from the code → **don't**;
trivia buries the significant entries.

**Just proceed (no record) for:** naming a local variable, picking a component's
internal structure, a refactor with no behavior change, anything CI already
enforces (lint/format/type rules — see [`./definition-of-done.md`](./definition-of-done.md)).

---

## How much debate (right-sized)

For a single later decision, **the two-mode table below is the whole process.**
The five-lens audit in [`../audit/`](../audit/) is the reference for an
architecture-class _batch_ of decisions — not a per-decision requirement. Don't
over-apply it.

A decision earns as much process as its blast radius:

| Call type                  | Process                                                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Obvious / low-blast**    | One Nygard-style paragraph: the forces, the call, the consequences. Do **not** manufacture a debate.                                                     |
| **Contested / high-blast** | State the forces → enumerate **considered options** with honest pros/cons → state the decision **and all consequences** (what gets easier _and_ harder). |

A solo owner or a single agent can argue both sides — the value is the
_enumerated alternatives_, not the head-count. Rules:

- **Cite, don't remember.** Any version-dependent fact must be settled against the
  bundled docs (`node_modules/next/dist/docs/`) or an external standard — never
  model memory. This mirrors [`../../AGENTS.md`](../../AGENTS.md). Precedents:
  [D11], [D12], [D23] each name the doc path they checked.
- **The worked example is [`../audit/`](../audit/).** The original 23 decisions (`D1`–`D23`) in
  `decisions.md` came from the five-lens audit
  ([`README`](../audit/README.md) → [`round-1-independent-findings`](../audit/round-1-independent-findings.md)
  → [`round-2-debate`](../audit/round-2-debate.md) → [`synthesis`](../audit/synthesis.md)) —
  the full-ceremony shape for an architecture-class batch. Borrow its _spirit_
  (independent reasoning → adversarial challenge → synthesis that resolves
  conflict, never smooths it over), not its head-count, for a single call.
- **Don't fake consensus.** If options genuinely conflict, the record states the
  tradeoff that was accepted — it does not pretend there was no cost.

---

## The entry format

The required-fields table below is the contract; the [copy-paste template](#copy-paste-template)
at the bottom renders it. Match the shape already running in `decisions.md`.

| Field           | Rule                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Number**      | Next monotonic `D#`. **Never reused, never renumbered.** Find the current max — today the next is `D26`; check with `grep -oE '^### D[0-9]+' ../decisions.md \| tail -1`. |
| **Title**       | Imperative noun phrase — the decision, not the topic ("Bake `oklch()` literals server-side", not "Color baking").                                                         |
| **Status**      | From the closed vocabulary below — not free text.                                                                                                                         |
| **`Amends §N`** | The plan section(s) this changes. A decision that touches the plan **must** cite the section; this is what keeps the log and the plan from silently diverging.            |
| **Why**         | The reasoning. Add `(user call, <date>)` when the owner makes the final call; add `(verified against <path>)` for version-dependent facts.                                |
| **`[D#]` refs** | Cross-reference related decisions inline.                                                                                                                                 |

**Status vocabulary (closed set — adopt one, don't invent).** This **extends**
`decisions.md`'s two-item legend (`Decided` / `Open`) by formalizing the
parenthetical and supersession patterns the log already uses informally:

| Status                                | Meaning                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `Decided`                             | Resolved and in force.                                                                                           |
| `Decided (build deferred)`            | Resolved, but implemented later (e.g. [D8] semantic colors, built when status UI lands).                         |
| `Decided (verified against <source>)` | Resolved on a version-dependent fact, checked against a named doc ([D11], [D12], [D23]).                         |
| `Open`                                | Needs the owner's call before it can be locked. Track it in the **Open items summary** footer of `decisions.md`. |
| `Superseded by D#`                    | No longer in force; replaced. See below.                                                                         |

---

## Superseding — never edit, always supersede

This is the **one rule that keeps the log trustworthy** (Nygard + Fowler): an
accepted decision is **never edited or reopened**. When the thinking changes:

1. **Append a new `D#`** that begins **"Supersedes D#"** and explains what changed and why.
2. **Edit only the old entry's status line** to add **`Superseded by D#`** — a pointer, not a rewrite. Leave its body intact so the audit trail of _why the thinking moved_ survives.

The repo already does this informally — [D11] supersedes a §7 reading of the
`use cache` note; [D23] supersedes the "one app, no workspace" §7 framing. This
process formalizes `Superseded by D#` as a fixed status token so supersession is
greppable.

> **Why it matters here:** agents work from the log to avoid re-litigating settled
> calls. If you rewrite history instead of superseding, the next agent loses the
> reasoning and may silently reintroduce the rejected option.

---

## CI fit

Decision records are prose; **no CI gate polices `decisions.md`.** The only
discipline is `pnpm format` keeping the Markdown clean before commit. For the full
gate chain (and the [D23] TypeGen drift step a schema-locking decision is most
likely to trip), see [`./definition-of-done.md`](./definition-of-done.md).

---

## Quick reference

- Bar = **architecturally significant** ([gate above](#when-to-open-a-decision-vs-just-proceed)). No trivia.
- **Never edit** an accepted entry — supersede with a new `D#`.
- **Don't over-template** — one paragraph fits most calls; full MADR is ceremony this repo skips.
- **Keep the anchors** — every plan-touching decision cites `Amends §N`; cross-link siblings as `[D#]`.
- **Don't trust memory on framework facts** — cite the bundled-doc path ([D11]/[D12]/[D23] precedent).
- **Status from the closed vocabulary** — never free text.

---

## Copy-paste template

```markdown
### D<n> — <imperative decision title>

**Decided** (user call, YYYY-MM-DD). Amends §N.
<The forces at play. For a contested call: the considered options with honest
pros/cons, then the call. For an obvious call: one paragraph. State the
consequences — what gets easier AND harder. Cross-reference [D#] siblings.
For a version-dependent fact, append "(verified against
node_modules/next/dist/docs/<path>)".>
```

(`D<n>` is the next free number — find it per the table above; it's `D26` today.)

**Superseding** — append the new entry, then add the pointer to the old one's
status line (don't touch its body):

```markdown
### D<new> — <new decision that replaces an old one>

**Decided** (user call, YYYY-MM-DD). Amends §N. Supersedes D<old>.
<Why the earlier call no longer holds and what replaces it. [D#] refs.>
```

```markdown
### D<old> — <the superseded decision's original title — body unchanged>

**Decided.** Superseded by D<new>. Amends §N.
<...original body unchanged...>
```

---

## Related

- [`../decisions.md`](../decisions.md) — the live log (`D1`–`D25`) + Open items footer.
- [`../audit/`](../audit/) — the worked five-lens → debate → synthesis example.
- [`./working-with-agents.md`](./working-with-agents.md) — how agents cite `[D#]` / `§N` and hand off cleanly.
- [`./git-and-pr-workflow.md`](./git-and-pr-workflow.md) — committing a decision (a `docs:` change, its own commit).
- [`./definition-of-done.md`](./definition-of-done.md) — the full CI gate chain.
