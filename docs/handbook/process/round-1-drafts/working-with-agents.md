# Working With Agents

> How autonomous and multi-agent work happens in this repo. This is the **operating
> manual for AI agents** (and the solo owner) — the very process that produced this
> handbook. It is right-sized for a solo, agent-driven portfolio repo: no governance
> theater, only what helps an agent land cold and ship clean code.
>
> Sources of truth this doc points at — open them, don't summarize from memory:
> framework facts → `node_modules/next/dist/docs/`; decisions → [`../decisions.md`](../decisions.md) (`[D#]`);
> system model → [`../architecture-plan.md`](../architecture-plan.md) (`§N`); build order →
> [`../build-phases.md`](../build-phases.md); the worked example of this process →
> [`../audit/`](../audit/).

---

## 1. The one rule that breaks model memory: cite, don't remember

This repo runs **Next.js 16.2.9 / React 19.2.4**, which differ from your training data.
Your memorized APIs are wrong often enough to be dangerous. The fix is not "try harder
to remember" — it is to **read the version-exact primary source before writing
framework code.**

- **Framework behavior** → bundled docs at `node_modules/next/dist/docs/` (`01-app`,
  `02-pages`, `03-architecture`, …). They ship with the installed version, so they are
  correct where memory is not. The root [`AGENTS.md`](../../AGENTS.md) says the same.
- **Project decisions** → [`../decisions.md`](../decisions.md). Cite as `[D#]`.
- **System model** → [`../architecture-plan.md`](../architecture-plan.md). Cite as `§N`.
- **External standards** (Conventional Commits, WCAG/APCA, AGENTS.md spec, ADR practice,
  Core Web Vitals) → state them **as that standard**, with the URL. Accuracy over confidence.

**Verify-before-write checklist.** Before writing framework code, confirm each of these
against the bundled docs — every one contradicts pre-2026 memory:

| Footgun                          | Reality (Next 16 / React 19)                                                                                                 | Verify in                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Request APIs sync                | `cookies()`/`headers()`/`draftMode()`/`params`/`searchParams` are **async** (`await`)                                        | `04-functions/cookies.md`, `…/05-server-and-client-components.md` |
| `export const dynamic`           | **Removed.** Static-vs-dynamic is **component-level** under `cacheComponents` [D11] (PPR: prerendered shell + dynamic holes) | `cacheComponents.md`, `08-caching.md`                             |
| `middleware.ts`                  | Renamed **`proxy.ts`**, Node runtime only (setting `runtime` throws)                                                         | `16-proxy.md`                                                     |
| CSS Modules auto-layered         | They are **not** — an unlayered module outranks **every** `@layer` style [D12]                                               | `…/11-css.md`                                                     |
| Templated dynamic import         | Use **literal** `() => import("@/projects/<slug>")` [D21] — templates defeat static analysis                                 | `…/lazy-loading.md`                                               |
| `'use cache'` reads request APIs | Cannot — read **outside**, pass as args (args = cache key)                                                                   | `01-directives/use-cache.md`                                      |

When in doubt, the rule is the same as the audit's: **cite the bundled doc path, not a
remembered API.** Verification precedents already in the log: [D11], [D12], [D23] each
pin a version fact to a bundled-doc path rather than to memory.

## 2. Anchor everything to the decisions — don't drift the architecture

The fastest way an agent wrecks this repo is by quietly re-litigating a settled call.
Twenty-three decisions ([D1]–[D23]) are **binding**. Before you write code that touches
theming, content modeling, caching, fonts, or routing, find the relevant `[D#]` and obey it.

- **If your instinct contradicts a `[D#]`, you are probably running on stale memory — stop.**
  Re-read the decision and the bundled doc it cites. Example traps: reaching for
  `export const dynamic` (gone — [D11]); adding `server-only` to the OKLCH engine (breaks
  isomorphism — [D14]); writing an unlayered CSS Module (silently beats layered styles — [D12]);
  a templated `import(\`…/${slug}\`)` ([D21]).
- **Accepted decisions are immutable.** This mirrors ADR practice (Nygard; Fowler): you do
  **not** edit a decided record. If thinking genuinely changes, write a _new_ superseding
  decision — see [`./decision-records.md`](./decision-records.md) for when and how. Supersession
  precedents: [D11] supersedes a §7 reading, [D23] supersedes "one app, no workspace".
- **Security and performance are agents' documented blind spots** (~14.5% prevalence each;
  [arXiv 2511.12884](https://arxiv.org/html/2511.12884v1)) — agents over-index on "make it
  work." Hold the line on the `brandColor` 500-risk three-layer defense ([D9]) and the
  font-preload policy ([D11]) even when they feel like overhead. See
  [`./accessibility-and-performance.md`](./accessibility-and-performance.md) and
  [`./security-and-ops.md`](./security-and-ops.md).

## 3. The `AGENTS.md` entry point

[`AGENTS.md`](https://agents.md/) is an open, vendor-neutral standard ("a README for
agents"), now stewarded by the Agentic AI Foundation under the Linux Foundation. It
**complements** the README (README = humans; `AGENTS.md` = agent context) and works
across 20+ tools.

- The repo's root [`AGENTS.md`](../../AGENTS.md) currently holds only the managed
  `<!-- BEGIN:nextjs-agent-rules -->` block. **Never hand-edit inside those markers** —
  `create-next-app` regenerates them. Any house content goes _outside_ the markers.
- **Nesting: nearest file wins.** In this `app + studio` pnpm workspace [D23], a nested
  `studio/AGENTS.md` (Sanity schema / TypeGen / stega-off-`brandColor` rules [D16]) takes
  precedence for agents working in `studio/`.
- **Keep it lean — bloat actively harms.** LLM-generated context files _reduced_ task
  success and raised cost >20% ([arXiv 2511.12884](https://arxiv.org/html/2511.12884v1)).
  **Do not restate what CI/configs already enforce.** State a rule once, point to the gate,
  and trust the tool. The bar is `pnpm lint · lint:css · lint:keys · format:check ·
typecheck · test · build` (see [`./git-and-pr-workflow.md`](./git-and-pr-workflow.md)
  and [`./definition-of-done.md`](./definition-of-done.md)) — not a re-explanation in prose.

## 4. Multi-agent orchestration: research → drafts → debate → synthesis

This handbook and the [`../audit/`](../audit/) trail were both built with the same
high-value pattern. Use it for **architecture-class decisions only** — calls that are hard
to reverse, cross a module/package boundary, lock an external contract (Sanity schema,
`keys.ts`, token names), or contradict the plan or a `[D#]`. It is ~15× the token cost of
single-agent work ([Anthropic — Multi-Agent Research](https://www.anthropic.com/engineering/multi-agent-research-system)),
so reserve it.

The shape (as practiced in `audit/`):

1. **Research, with citations.** Pin every claim to a primary source — bundled docs, a
   spec URL, or a `[D#]`. Verbose fetching/log-crunching happens in isolated subagents that
   return a **dense, cited digest** (see the `process/research/` notes R1–R6).
2. **N independent drafts.** Diverse role-lenses draft _independently, before seeing each
   other's work_ — the audit's five lenses (Architect, FrameworkFit, Theming, ContentModel,
   Sequencing). Diversity is what makes the next step work; identical agents add nothing.
3. **Adversarial debate (devil's advocate).** Each lens challenges, defends, or **concedes**
   against the others. Critiques must be **fact-grounded** (cite a doc/decision), not vibes —
   this is where the plan actually moves ([`../audit/round-2-debate.md`](../audit/round-2-debate.md)).
4. **Cited synthesis.** Consolidate into a verdict and record the resolved calls as `[D#]`
   in [`../decisions.md`](../decisions.md) ([`../audit/synthesis.md`](../audit/synthesis.md)).

**Two pitfalls to encode (both documented failure modes):**

- **Synthesis must not smooth a fake consensus.** Where drafts genuinely disagree, resolve
  the conflict explicitly and say which view won and why — do not paper over it with a tidy
  summary ([Ewerlöf](https://blog.alexewerlof.com/p/multi-agent-system-reliability)).
- **Don't add agents to fix coordination.** When workers duplicate or miss work, the fix is a
  **sharper delegation prompt**, not more agents ([Anthropic — Multi-Agent Research](https://www.anthropic.com/engineering/multi-agent-research-system)).

For routine work, prefer **single-agent** with subagents only to isolate verbose subtasks.

## 5. When to spawn a subagent, and how to brief it

Subagents in Claude Code start with a **fresh, isolated context** — they do **not** see the
conversation history, your prior file reads, or skills you invoked. The only channel in is
the delegation prompt; the only channel out is the returned summary
([Claude Code — Subagents](https://code.claude.com/docs/en/sub-agents)).

**Spawn one when** the work is verbose enough to pollute the lead's context (test runs, doc
fetches, log crunching) or independent enough to parallelize (the audit's per-lens drafts).
**3–5 concurrent is the everyday sweet spot**; route hard reasoning to a stronger model.

**Brief checklist — every delegation prompt must be self-contained and include:**

- [ ] **Objective** — one crisp task, not a grab-bag.
- [ ] **Source-of-truth files by path** — the agent can't see what you've read. Name the
      bundled docs, the `[D#]`s, the `§N`s, and the ground-truth files it must open.
- [ ] **Boundaries** — what's out of scope, what not to touch, which decisions are binding.
- [ ] **Output format** — return a **dense digest**, not raw output (cited, skimmable).
- [ ] **The cite-don't-remember rule** restated — "verify framework claims against the
      bundled docs; don't work from memory."

> Rule of thumb: _Skill teaches the how · Hook enforces the rule · Subagent isolates the
> work._ ([ofox.ai](https://ofox.ai/blog/claude-code-hooks-subagents-skills-complete-guide-2026/))

## 6. Clean handoffs & continuity

- **Self-contained in, dense digest out.** Because context doesn't carry across the handoff,
  a prompt that says "continue what we were doing" fails. Spell it out; return a summary
  tight enough to re-enter the lead's context without the raw material.
- **Persist phase summaries to the repo before re-spawning.** External memory (the docs
  themselves — this handbook, `decisions.md`, the `process/` notes) beats context-window
  stuffing for long, multi-session efforts
  ([Anthropic — Multi-Agent Research](https://www.anthropic.com/engineering/multi-agent-research-system)).
- **One task ≈ one commit ≈ one clean handoff.** Aligns with the Git workflow
  ([`./git-and-pr-workflow.md`](./git-and-pr-workflow.md)): small, focused, and
  reviewable so the next agent (or the owner) can pick up cleanly.

## 7. Keeping agents from drifting the architecture — quick gate

Before you finish a task, self-check:

- [ ] Did I touch theming / caching / fonts / content-model / routing? → I found and obeyed
      the relevant `[D#]`.
- [ ] Did I write framework code? → I verified it against `node_modules/next/dist/docs/`,
      not memory.
- [ ] Did I contradict a decision? → I stopped and wrote a **superseding** record instead of
      editing the old one ([`./decision-records.md`](./decision-records.md)).
- [ ] Is every non-obvious claim in my output anchored to a `[D#]`, a `§N`, or a URL?
- [ ] Did I keep docs minimal — no restating what CI already enforces?
- [ ] Green gate: `pnpm lint && pnpm lint:css && pnpm lint:keys && pnpm format:check && pnpm typecheck && pnpm test && pnpm build` — and, after a Studio schema change, `pnpm --filter studio typegen` + commit the regenerated `sanity.types.ts` [D23].

See also: [`./orientation.md`](./orientation.md) ·
[`./engineering-standards.md`](./engineering-standards.md) ·
[`./decision-records.md`](./decision-records.md).
