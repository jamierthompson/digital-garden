# Decision Records

How architecturally significant decisions get made, recorded, and revised in
this repo. The log lives in [`../decisions.md`](../decisions.md).
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
- [ ] It **locks an external contract**: a Sanity schema field, `keys.ts`, public token names (`--brand-*`, `--space-*` — the generic public layer per [D2], **not** a project-internal `--<proj>-*` alias), or the engine signature `(brandColor, scheme) → tokenSet` ([D5]).
- [ ] It **contradicts the system model** ([`./architecture.md`](./architecture.md)) or an existing `[D#]`.
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

For a single later decision, **the two-mode table below is the whole process.** Full five-lens
ceremony is the reference for an architecture-class _batch_ of decisions — not a per-decision
requirement. Don't over-apply it.

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
- **The full-ceremony shape** is independent findings → round-2 debate → synthesis; the original
  23 decisions (`D1`–`D23`) were settled that way. A worked example in-tree is any debate trail
  under [`../sessions/`](../sessions/) (e.g. `2026-06-25-item-c-draft-preview-debate/`). Borrow its
  _spirit_ (independent reasoning → adversarial challenge → synthesis that resolves conflict, never
  smooths it over), not its head-count, for a single call.
- **Don't fake consensus.** If options genuinely conflict, the record states the
  tradeoff that was accepted — it does not pretend there was no cost.

---

## The entry format

The required-fields table below is the contract; the [copy-paste template](#copy-paste-template)
at the bottom renders it. Match the shape already running in `decisions.md`.

| Field           | Rule                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Number**      | Next monotonic `D#`. **Never reused, never renumbered.** Find the current max with `grep -oE '^### D[0-9]+' ../decisions.md \| tail -1`.   |
| **Title**       | Imperative noun phrase — the decision, not the topic ("Bake `oklch()` literals server-side", not "Color baking").                          |
| **Status**      | From the closed vocabulary below — not free text.                                                                                          |
| **Why**         | The reasoning. Add `(user call, <date>)` when the owner makes the final call; add `(verified against <path>)` for version-dependent facts. |
| **`[D#]` refs** | Cross-reference related decisions inline.                                                                                                  |

**Status vocabulary (closed set — adopt one, don't invent).** This expands
`decisions.md`'s legend (`Decided` / `Superseded by D#` / `Open`) with the
full parenthetical and supersession patterns the log uses:

| Status                                | Meaning                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `Decided`                             | Resolved and in force.                                                                                           |
| `Decided (build deferred)`            | Resolved, but implemented later (e.g. [D32] brand-derived status colors, built when status UI lands).            |
| `Decided (verified against <source>)` | Resolved on a version-dependent fact, checked against a named doc ([D11], [D12], [D23]).                         |
| `Open`                                | Needs the owner's call before it can be locked. Track it in the **Open items summary** footer of `decisions.md`. |
| `Superseded by D#`                    | No longer in force; replaced. See below.                                                                         |

---

## Editing & supersession — git is the audit trail `[D33]`

Decision records are **mutable**: edit an entry in place so the register reads as **current truth**.
This is a deliberate **departure from classic ADR immutability** (Nygard/Fowler) — `git log -p
docs/decisions.md` recovers any prior wording with author and message, so the audit trail the
immutable rule existed to protect is already there `[D33]`. Every edit lands through the normal
branch → gate → squash-merge flow.

- **Edit in place** when the thinking changes. For a _material_ change, optionally add a dated
  `_Updated YYYY-MM-DD:_` note so the shift is legible inline without `git blame` (D1 carries one).
- **Supersession is optional.** When the old rationale is worth keeping visible _beside_ the new call,
  append a new `D#` ("Supersedes D#"), add `Superseded by D#` to the old entry's status line, and
  leave its body intact. When it isn't, **tombstone** the old entry instead — keep its heading/anchor
  (so no `[D#]` citation dangles) and replace the body with a one-line `Superseded by D#` pointer,
  letting git hold the original (the D8 → D32 pair is the model). The `Superseded by D#` status token
  covers both.

> **Why it matters here:** agents work from the log to avoid re-litigating settled calls. Keep the
> register accurate and let git hold the history — a stale entry left "frozen for the audit trail"
> misleads the next agent more than an honest in-place edit ever would.

---

## CI fit

Decision records are prose; **no CI gate polices `decisions.md`.** The only
discipline is `pnpm format` keeping the Markdown clean before commit. For the full
gate chain (and the [D23] TypeGen drift step a schema-locking decision is most
likely to trip), see [`./definition-of-done.md`](./definition-of-done.md).

---

## Quick reference

- Bar = **architecturally significant** ([gate above](#when-to-open-a-decision-vs-just-proceed)). No trivia.
- **Edit in place** — git holds the history `[D33]`; supersede only when inline contrast helps.
- **Don't over-template** — one paragraph fits most calls; full MADR is ceremony this repo skips.
- **Propagate, don't point** — when a decision changes something, edit the affected doc(s) in place and update every reference, so each reads as current truth (git holds the history `[D33]`). `[D#]` is a plain see-also, not a relationship marker the reader must resolve.
- **Don't trust memory on framework facts** — cite the bundled-doc path ([D11]/[D12]/[D23] precedent).
- **Status from the closed vocabulary** — never free text.

---

## Copy-paste template

```markdown
### D<n> — <imperative decision title>

**Decided** (user call, YYYY-MM-DD).
<The forces at play. For a contested call: the considered options with honest
pros/cons, then the call. For an obvious call: one paragraph. State the
consequences — what gets easier AND harder. Cross-reference [D#] siblings.
For a version-dependent fact, append "(verified against
node_modules/next/dist/docs/<path>)".>
```

(`D<n>` is the next free number — find it per the table above.)

**Superseding (optional)** — when you want the old rationale visible inline, append the new entry
and add the pointer to the old one's status line (keep its body intact):

```markdown
### D<new> — <new decision that replaces an old one>

**Decided** (user call, YYYY-MM-DD). Supersedes D<old>.
<Why the earlier call no longer holds and what replaces it. [D#] refs.>
```

```markdown
### D<old> — <the superseded decision's original title>

**Decided.** Superseded by D<new>.
<...original body kept intact...>
```

To **tombstone** instead — when the old rationale isn't worth keeping inline, since git has it —
keep the heading/anchor and replace the body with a one-line pointer, as D8 does:

```markdown
### D<old> — <original title>

**Superseded by [D<new>].** Body removed; original rationale in git history `[D33]`.
```

---

## Related

- [`../decisions.md`](../decisions.md) — the live log + Open items footer.
- [`../sessions/`](../sessions/) — worked five-lens → debate → synthesis trails in-tree (the example to borrow from).
- [`./working-with-agents.md`](./working-with-agents.md) — how agents cite `[D#]` and hand off cleanly.
- [`./git-and-pr-workflow.md`](./git-and-pr-workflow.md) — committing a decision (a `docs:` change, its own commit).
- [`./definition-of-done.md`](./definition-of-done.md) — the full CI gate chain.
