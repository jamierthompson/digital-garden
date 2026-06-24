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

This repo runs **Next.js 16 / React 19**, which differ from your training data.
Your memorized APIs are wrong often enough to be dangerous. The fix is not "try harder
to remember" — it is to **read the version-exact primary source before writing
framework code.**

- **Framework behavior** → bundled docs at `node_modules/next/dist/docs/` (`01-app`,
  `02-pages`, `03-architecture`, …). They ship with the installed version, so they are
  correct where memory is not. The root [`AGENTS.md`](../../AGENTS.md) says the same.
- **Project decisions** → [`../decisions.md`](../decisions.md). Cite as `[D#]`.
- **System model** → [`../architecture-plan.md`](../architecture-plan.md). Cite as `§N`.
- **External standards** (Conventional Commits, WCAG/APCA, the `AGENTS.md` convention, ADR
  practice, Core Web Vitals) → state them **as that standard**, with a URL. Accuracy over confidence.

**Capabilities before knowledge — use the tools you have, don't hand-roll.** Before you
research or build, check what specialized capability is already in your session and prefer it
over reinventing the work. If you're unsure one exists, **look** (`ToolSearch`, the skills
list, the `Agent` types) before assuming it doesn't.

- **Skills** (the `Skill` tool / `/`-commands) — invokable playbooks. This stack ships deep
  ones: `sanity:*` (schema, GROQ, TypeGen, Portable Text, migrations, content modeling),
  `vercel:*` (`nextjs`, `ai-sdk`, `next-cache-components`, `shadcn`, `deployments-cicd`,
  `turbopack`, `react-best-practices`…), and `chrome-devtools:*` (Lighthouse/CWV, a11y
  audits — **required** to browser-verify any rendered surface before done, `[D25]`). When a
  skill matches the task, invoke it **before** writing code or searching the web.
- **Subagents** (the `Agent` tool, by `subagent_type`) — isolate verbose or specialized work:
  `Explore` (codebase search), `feature-dev:*` (architecture / blueprints / review),
  `pr-review-toolkit:*` (review lenses), `vercel:*` (`ai-architect`, `deployment-expert`,
  `performance-optimizer`). Brief them per §5 — they start with no context.
- **MCP server tools** — live integrations: the **Sanity** MCP (query/manage the dataset) and
  **Vercel** MCP (deployments, logs, runtime). Load a referenced-but-unloaded tool with `ToolSearch`.

**The source-of-truth ladder** — highest first; never skip straight to memory:

1. **A specialized capability** — a skill / subagent / MCP tool purpose-built for the task.
2. **Version-exact local sources** — the bundled Next docs (`node_modules/next/dist/docs/`),
   `[D#]`, `§N`, and the repo's own config / ground-truth files.
3. **Official web sources, cited by URL** — the framework's or standard's own docs.
4. **Never raw training memory** for anything version- or fact-specific — it is the single
   most likely thing to be wrong on this stack.

**Make "cite, don't remember" executable.** Search the installed docs before you write —
don't recall:

```bash
# Verify a framework fact against the version-exact installed docs (not memory):
grep -rniE 'cookies|async' \
  node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md

# Find the doc that covers a topic, then read it:
grep -rli 'use cache' node_modules/next/dist/docs/
```

**Verify-before-write checklist.** Before writing framework code, confirm each of these.
The right column marks whether the rule lives in a **Next doc** (open the path) or is
**spec/bundler behavior the repo lints for** (the authority is the decision + the lint
script — the bundled docs do _not_ state it):

| Footgun                          | Reality (Next 16 / React 19)                                                                                                                                                                    | Authority                                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Request APIs sync                | `cookies()`/`headers()`/`draftMode()`/`params`/`searchParams` are **async** (`await`)                                                                                                           | Next doc: `03-api-reference/04-functions/cookies.md`, `01-getting-started/05-server-and-client-components.md`         |
| `export const dynamic`           | **Removed _under_ `cacheComponents`** (enabled app-wide here — [D11]). Replaced by `'use cache'` + `cacheLife`; pages are dynamic-by-default. PPR = prerendered shell + dynamic holes           | Next doc: `…/03-file-conventions/02-route-segment-config/index.md` (removal note), `01-getting-started/08-caching.md` |
| `'use cache'` reads request APIs | **Cannot** — read request APIs **outside**, pass as args (args = cache key)                                                                                                                     | Next doc: `01-directives/use-cache.md`                                                                                |
| `middleware.ts`                  | Renamed **`proxy.ts`**, Node runtime only (setting `runtime` throws)                                                                                                                            | Next doc: `01-getting-started/16-proxy.md`                                                                            |
| CSS Modules auto-layered         | They are **not**. An unlayered module's plain rules outrank **every** `@layer` style. This is CSS-cascade spec + Next's no-auto-layer behavior — **not stated in any Next doc**                 | Spec/lint: [D12] + `scripts/check-css-layers.mjs` (`pnpm lint:css`)                                                   |
| Templated dynamic import         | Use **literal** `() => import("@/projects/<slug>")` — a templated `import(\`…/${slug}\`)`defeats bundler static analysis. **Not stated in`lazy-loading.md`\*\* (it only shows literal examples) | Spec/lint: [D21] + bundler static-analysis behavior                                                                   |

When in doubt, the rule is the same as the audit's: **cite the source that actually
contains the fact** — a bundled-doc path for documented Next behavior, or `[D#]` + the
lint script for spec/bundler behavior. Don't send the next agent to a doc that doesn't
hold the claim. Verification precedents in the log ([D11], [D12], [D23]) pin version facts
to a source rather than to memory.

## 2. Anchor everything to the decisions — don't drift the architecture

The fastest way an agent wrecks this repo is by quietly re-litigating a settled call.
Decisions ([D1]–[Dxx]) are **binding**. Before you write code that touches
theming, content modeling, caching, fonts, or routing, find the relevant `[D#]` and obey it.

- **If your instinct contradicts a `[D#]`, you are probably running on stale memory — stop.**
  Re-read the decision and the source it cites. Example traps: reaching for
  `export const dynamic` (gone under `cacheComponents` — [D11]); adding `server-only` to the
  OKLCH engine (breaks isomorphism — [D14]); writing an unlayered CSS Module (silently beats
  layered styles — [D12]); a templated `import(\`…/${slug}\`)` ([D21]).
- **Accepted decisions are immutable.** This mirrors ADR practice (Nygard; Fowler): you do
  **not** edit a decided record. If thinking genuinely changes, write a _new_ superseding
  decision — see [`./decision-records.md`](./decision-records.md) for when and how. Supersession
  precedents: [D11] supersedes a §7 reading, [D23] supersedes "one app, no workspace".
- **Security and performance are agents' documented blind spots** — agents over-index on
  "make it work" and under-test the non-functional edges (research on agent context files
  flags these as the most common gaps; [arXiv 2511.12884](https://arxiv.org/html/2511.12884v1)).
  Hold the line on the `brandColor` 500-risk three-layer defense ([D9]) and the font-preload
  policy ([D11]) even when they feel like overhead. See
  [`./accessibility-and-performance.md`](./accessibility-and-performance.md) and
  [`./security-and-ops.md`](./security-and-ops.md).

## 3. The `AGENTS.md` entry point

[`AGENTS.md`](https://agents.md/) is an open, vendor-neutral convention — "a README for
agents." It **complements** the README (README = humans; `AGENTS.md` = agent context) and
is read by a range of agent tools.

- The repo's root [`AGENTS.md`](../../AGENTS.md) currently holds only the managed
  `<!-- BEGIN:nextjs-agent-rules -->` block. **Never hand-edit inside those markers** —
  `create-next-app` regenerates them. Any house content goes _outside_ the markers.
- **Nesting: nearest file wins.** In this `app + studio` pnpm workspace [D23], a nested
  `studio/AGENTS.md` (Sanity schema / TypeGen / stega-off-`brandColor` rules [D16]) takes
  precedence for agents working in `studio/`.
- **Keep it lean — bloat actively harms.** Research on agent context files finds that
  padding them (e.g. LLM-generated boilerplate) _reduced_ task success and raised cost
  ([arXiv 2511.12884](https://arxiv.org/html/2511.12884v1)). **Do not restate what
  CI/configs already enforce.** State a rule once, point to the gate, and trust the tool.
  The bar is `pnpm lint · lint:css · lint:keys · format:check · typecheck · test · build`
  (see [`./git-and-pr-workflow.md`](./git-and-pr-workflow.md) and
  [`./definition-of-done.md`](./definition-of-done.md)) — not a re-explanation in prose.

## 4. Multi-agent orchestration: research → drafts → debate → synthesis

**Default to single-agent work.** Reach for the five-lens pattern below **only** for an
architecture-class decision — one that is hard to reverse, crosses a module/package
boundary, locks an external contract (Sanity schema, `keys.ts`, token names), or
contradicts the plan or a `[D#]`. It runs ~15× the token cost of single-agent work
([Anthropic — Multi-Agent Research](https://www.anthropic.com/engineering/multi-agent-research-system)),
so reserve it.

This handbook and the [`../audit/`](../audit/) trail were both built with this pattern.
The shape (as practiced in `audit/`):

1. **Research, with citations.** Pin every claim to a primary source — bundled docs, a
   spec URL, or a `[D#]`. Verbose fetching/log-crunching happens in isolated subagents that
   return a **dense, cited digest** (see the `process/research/` notes R1–R6, and §5).
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

## 5. When to spawn a subagent, and how to brief it

Subagents in Claude Code start with a **fresh, isolated context** — they do **not** see the
conversation history, your prior file reads, or skills you invoked. The only channel in is
the delegation prompt; the only channel out is the returned summary
([Claude Code — Subagents](https://code.claude.com/docs/en/sub-agents)). This is the #1
thing agents get wrong about subagents — and it is the mechanic §4 and §6 both rely on, so
get it right here.

**Spawn one when** the work is verbose enough to pollute the lead's context (test runs, doc
fetches, log crunching) or independent enough to parallelize (the audit's per-lens drafts).
**3–5 concurrent is the everyday sweet spot**; route hard reasoning to a stronger model.

**Brief checklist — every delegation prompt must be self-contained and include:**

- [ ] **Objective** — one crisp task, not a grab-bag.
- [ ] **Source-of-truth files by path** — the agent can't see what you've read. Name the
      bundled docs, the `[D#]`s, the `§N`s, and the ground-truth files it must open.
- [ ] **Boundaries** — what's out of scope, what not to touch, which decisions are binding.
- [ ] **Output format** — return a **dense digest**, not raw output (cited, skimmable).
- [ ] **Model tier** — name it if the subtask needs stronger reasoning vs. a cheap fetch, so
      the cost/quality trade-off is explicit rather than left to default.
- [ ] **The cite-don't-remember rule** restated — "verify framework claims against the
      bundled docs; don't work from memory."

> Rule of thumb: _Skill teaches the how · Hook enforces the rule · Subagent isolates the work._

## 6. Clean handoffs & continuity

Context doesn't carry across a handoff — the mechanics of self-contained-in / dense-digest-out
live in §5. This section is what to do _between_ handoffs:

- **Persist phase summaries to the repo before re-spawning.** External memory (the docs
  themselves — this handbook, `decisions.md`, the `process/` notes) beats context-window
  stuffing for long, multi-session efforts
  ([Anthropic — Multi-Agent Research](https://www.anthropic.com/engineering/multi-agent-research-system)).
  A prompt that says "continue what we were doing" fails; a pointer to a written summary doesn't.
- **One task ≈ one commit ≈ one clean handoff.** Small, focused commits are the unit of work —
  and each is a **completed, gate-green slice** an agent stands behind, reviewable, a natural
  seam for the next agent (or the owner) to pick up. The lead curates the branch and squash-merges
  it, so the story is told once in the PR (see §6.1 and
  [`./git-and-pr-workflow.md`](./git-and-pr-workflow.md) §6) — but that's about _history_, not
  about lowering the bar on a handoff.

### 6.1 Agent teams: each agent owns a slice; the lead curates history

Per Anthropic's [Agent Teams guidance](https://code.claude.com/docs/en/agent-teams): teammates
"each own a separate piece without stepping on each other," you "break the work so each teammate
owns a different set of files," and a task is a "self-contained unit that produces a clear
deliverable." Split the responsibility cleanly:

- **Each agent owns a slice and is accountable for it.** Take a task, ideally over a **distinct
  set of files** (the docs' explicit "avoid file conflicts" rule), complete it **fully and
  gate-green**, and own its quality. A task is "done" only when it passes the gate — quality can
  be hook-enforced (`TaskCompleted` / `TeammateIdle` exit code 2 keeps a teammate working). Broken
  WIP is **not** something you hand off; local checkpoints are your own business.
- **The team lead curates history, not your slice.** The lead's git magic is about _history_:
  rebase onto latest `main`, squash an agent's fix-ups, reorder slices, drop a false start, then
  **squash-merge** and write the PR body (the durable story). The lead does **not** inherit
  responsibility for an unfinished slice — that bounces back to the owning agent.
- **Shared-branch hygiene:** push curated history with `--force-with-lease` (never plain
  `--force`) so a teammate's concurrent push isn't clobbered. Full mechanics:
  [`./git-and-pr-workflow.md`](./git-and-pr-workflow.md) §6.

### 6.2 The team lead runs the loop: permissions · QA · merge-readiness

§6.1 splits _ownership_; this is what the lead actively **runs** during a team session. The
lead is the run's single point of contact with the owner — **the owner directs the run, not
each tool call.**

- **Own the permission surface — don't make the owner babysit.** Set the run's permission
  posture once at spawn (the `agent-team` skill's preflight covers the spawn-time mechanic),
  then resolve teammates' permission requests on the run's behalf: batch them and
  decide. Escalate to the owner only for genuinely out-of-policy actions — something
  destructive or outward-facing, anything a `[D#]` forbids, anything that spends real money or
  touches production — with a one-line _what + why_. The default is **the lead clears the
  path**, not _the owner approves each call_.

- **Independent QA before the PR — run a dev↔QA loop.** A gate-green slice is
  _developer-done_, not _review-done_ — the §3 self-check and the green gate are necessary, not
  sufficient. Before a slice enters the PR, the lead spawns a **fresh** code-review subagent
  (`pr-review-toolkit:code-reviewer` / `feature-dev:code-reviewer`, or the `/code-review`
  skill) to **independently review and test it** — _fresh_ meaning **not** the agent that wrote
  it; an isolated context is the whole point (brief it per §5). The loop mirrors dev↔QA:
  - **The reviewer reviews; the author fixes — don't collapse the two.** Findings go back to
    the **owning agent**, which makes the changes; then QA reviews **again**. Repeat until clean.
  - **Fix in-scope now; defer only genuinely-later work.** Anything in the current slice's or
    phase's scope gets **fixed before the PR**. A finding is deferred only when it truly belongs
    to a later phase — it needs a package boundary that doesn't exist yet, a future consumer, or
    later-phase work. The lead then logs it in [`../build-phases.md`](../build-phases.md) under
    the phase that should pick it up (the "Review-surfaced follow-ups" section), with the PR#
    and a one-line reason. Deferring is for cross-phase work, **not** a shortcut around the slice.

- **Own merge-readiness — CI green, review clean.** "Ready to merge" is the **lead's** call, and
  it means **both**: the CI `verify` gate green on the curated tip
  ([`./git-and-pr-workflow.md`](./git-and-pr-workflow.md) §5) **and** the independent QA review
  (above) clean — every finding either fixed in-branch by the owning agent or filed as a
  cross-phase follow-up in [`../build-phases.md`](../build-phases.md) with its PR# and reason. The
  independent review happens **pre-PR** via the QA subagent — there is **no automatic review bot**
  in CI. The repo keeps one on-demand Claude workflow (`@claude` in a PR comment); the lead may
  invoke it for a second opinion and treats anything it surfaces like QA's findings, but it's a
  tool, not a gate. Only then does the lead curate history (§6.1) and squash-merge.

- **Close the run — every run ends with two writes (non-negotiable).** Before the squash-merge,
  the run produces both, or it isn't done:
  1. **Update the project [`README.md`](../../README.md)** so it still describes the repo as it now
     is — at minimum the **Status** line (phase progress) and any changed scripts, structure, or
     conventions. The README is human-facing and rots silently; a stale "Phase 0 complete" is the
     smell this rule exists to kill. (The per-task echo of this is the DoD §6 "docs updated" box;
     this makes it a hard **run-level** requirement, not a maybe.)
  2. **Write the run record** in [`../runs/`](../runs) (`YYYY-MM-DD-<slug>.md`) — why / shape /
     outcome / review + fixes / lessons, per [`../runs/README.md`](../runs/README.md) — and add its
     row to that index. This is the repo's external memory; a run that did real product work and
     left no record is invisible to the next session. Applies to **solo runs too**, not just teams.

## 7. Keeping agents from drifting the architecture — quick gate

Before you finish a task, self-check:

- [ ] Did I touch theming / caching / fonts / content-model / routing? → I found and obeyed
      the relevant `[D#]`.
- [ ] Did I write framework code? → I verified it against `node_modules/next/dist/docs/`
      (or, for spec/bundler rules, against `[D#]` + the lint script), not memory.
- [ ] Did I contradict a decision? → I stopped and wrote a **superseding** record instead of
      editing the old one ([`./decision-records.md`](./decision-records.md)).
- [ ] Is every non-obvious claim in my output anchored to a `[D#]`, a `§N`, or a URL —
      pointing at the source that _actually contains_ it?
- [ ] Did I keep docs minimal — no restating what CI already enforces?
- [ ] Green gate: `pnpm lint && pnpm lint:css && pnpm lint:keys && pnpm format:check && pnpm typecheck && pnpm test && pnpm build` — and, once `studio/` lands, after a Studio schema change run `pnpm --filter studio typegen` + commit the regenerated `sanity.types.ts` [D23].

See also: [`./orientation.md`](./orientation.md) ·
[`./engineering-standards.md`](./engineering-standards.md) ·
[`./decision-records.md`](./decision-records.md).
