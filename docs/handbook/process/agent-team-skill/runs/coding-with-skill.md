# Orchestration Plan — Build the `ProjectScope` feature with an agent team

**Lead:** this session. **Mode:** Coding a cross-layer feature (`agent-team` skill →
`references/coding-feature.md`). **Request:** "Build the ProjectScope feature across the data
layer, the component, and tests — split it up so we move fast."

`ProjectScope` is read as a project's **scope panel** — role, timeline, tech stack, status —
sourced from Sanity and rendered inside a project module. It is a new feature (the repo is
early-stage: `src/lib/` and `src/sanity/lib/` are near-empty, no `src/projects/` yet), so we are
_adding_ file-disjoint slices, not editing a tangle of shared ones. That is what makes a team viable.

---

## 1. Preflight

### 1a. Is a team even the right tool?

Per the skill's decision table (§0): a **team** is justified when independent slices land over
**distinct file sets** in parallel. The user's own framing — "data layer, component, tests, split it
up" — maps onto three naturally file-disjoint slices. So the _shape_ fits a team.

**But the honest caveat:** these three slices have a real dependency chain —
`data (type/contract) → component (consumes type) → tests (consume component)`. Left unmanaged,
that chain is _sequential_, and the skill is explicit: "If the work is sequential, touches the same
files, or has many dependencies, use a single session." The thing that converts this from
sequential-solo into genuine-parallel-team is **a frozen contract defined up front by the lead**
(the `ProjectScope` field shape + component props). With the contract frozen, all three teammates
code concurrently against it; the real type is wired at integration. **Decision: team of 3 — but
only because I freeze the contract in the briefs below.** Without that, I'd do this solo. (Not
subagents: the slices need a shared task list, a shared contract, and to hand gate-green branches
back — that's coordination, not fire-and-forget fetch.)

### 1b. What must be true for a team to run at all

- **Experimental flag — VERIFIED ON.** `grep` found `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"`
  in `~/.claude/settings.json`. Teammates will actually spawn.
- **Clean file partition — VERIFIED disjoint** (the whole game per `coding-feature.md`):

  | Slice             | Owns (writes)                                                                                                                                                                  | Consumes (read-only, never edits)             |
  | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
  | **A — Data**      | `studio/schemaTypes/projectScope.ts` (new), `studio/schemaTypes/index.ts` (register), `src/sanity/lib/queries.ts` (new, `defineQuery`), **regenerates** root `sanity.types.ts` | —                                             |
  | **B — Component** | `src/projects/oklch-engine/ProjectScope.tsx` (new), `src/projects/oklch-engine/ProjectScope.module.css` (new)                                                                  | `sanity.types.ts` (import the generated type) |
  | **C — Tests**     | `tests/unit/project-scope.test.tsx` (new), `tests/fixtures/project-scope.ts` (new)                                                                                             | the component (B), the contract               |

  The one shared/generated file, `sanity.types.ts`, has a **single writer (A)**. B imports from it
  but never edits it. No two teammates write the same file. (If we discover the component must live
  under a different slug, that's a brief tweak, not a partition break.)

- **Branch base:** all three branch off latest `main`; **never commit to `main`** (merge = Vercel
  prod deploy). Each ships a gate-green slice over its own files.

---

## 2. Approach / pattern, and why

**Contract-first parallel slices → gate-green handoff → lead curates → squash-merge.**

1. **Lead freezes the contract first** (in the briefs, verbatim below) so the dependency chain
   stops being a blocker: the `ProjectScope` field shape, the `componentKey`, and the component's
   props are fixed before anyone writes. This is the move that legitimizes parallelism here.
2. **Three teammates, one per layer** (3 is the low end of the 3–5 sweet spot and exactly matches
   the user's split — _don't add agents to fix coordination_; sharpen the brief instead).
3. **External memory:** I write the slice→owner→files map + frozen contract to
   `docs/handbook/process/` (mirroring the repo's existing worked examples) so a re-spawned
   teammate reads state, not "continue what we were doing."
4. **Verify-before-done:** a `TaskCompleted` hook **exits code 2** until the full gate passes, so no
   teammate can mark a slice complete on broken WIP (`definition-of-done.md`).
5. **Lead curates & squash-merges** — never inherits an unfinished slice.

---

## 3. Verbatim spawn briefs

> Common preamble appended to **every** brief: _"You start with fresh context — you cannot see my
> conversation or anything I've read. This repo is **Next.js 16.2.9 / React 19.2.4**;
> memorized APIs are wrong often enough to be dangerous. **Verify, then write — never trust stale
> memory.** Read the version-exact bundled docs at `node_modules/next/dist/docs/` before any
> framework code, and cite `[D#]` decisions by reading `docs/decisions.md`. Branch off latest
> `main`; **never commit to `main`.** A slice is done only when the full gate passes in CI order:
> `pnpm lint && pnpm lint:css && pnpm lint:keys && pnpm format:check && pnpm typecheck && pnpm test
&& pnpm --filter studio typegen && git diff --exit-code sanity.types.ts && pnpm build`. Fix
> formatting with `pnpm format`, never by hand. Report back a dense digest: files changed, gate
> output, and any contract friction — not raw code dumps."_
>
> **FROZEN CONTRACT (identical in all three briefs):** `ProjectScope` is a Sanity object with fields
> `role: string`, `timeline: string`, `stack: string[]`, `status: 'shipped' | 'wip' | 'archived'`.
> The query exports `projectScopeQuery` via `defineQuery`. The React component is
> `<ProjectScope scope={ProjectScope} />`, default export, named `ProjectScope`, registered under
> `componentKey` `"project-scope"`.

### Teammate **Data** — model: **Sonnet (high reasoning)**

```
Objective: Build the data layer for the ProjectScope feature: a Sanity object schema, a typed GROQ
query, and the regenerated types.

You OWN (write only these):
- studio/schemaTypes/projectScope.ts   (new — defineType/defineField for the object)
- studio/schemaTypes/index.ts          (register the new type in the array — append only)
- src/sanity/lib/queries.ts            (new — export projectScopeQuery via defineQuery)
- sanity.types.ts                      (root — REGENERATE, do not hand-edit)

Source of truth (open these — you can't see what I read):
- node_modules/next/dist/docs/ for any framework behavior; the Sanity skill `sanity:typegen` for
  TypeGen mechanics.
- docs/architecture-plan.md §4 (project modules) and the lines on "TypeGen + defineQuery": typed
  GROQ, run TypeGen after ANY schema or query change, defineQuery must wrap the query literally
  (NO runtime interpolation).
- docs/decisions.md — [D23]: after any Studio schema change, commit the regenerated root
  sanity.types.ts; `git diff --exit-code sanity.types.ts` is the easiest gate to trip.

Implement the FROZEN CONTRACT above exactly: fields role/timeline/stack/status, query name
projectScopeQuery. Run `pnpm --filter studio typegen` and COMMIT the regenerated sanity.types.ts.

Boundaries: Do NOT create or edit the React component, CSS, or tests — those are owned by other
teammates. Do NOT touch src/lib/oklch/ ([D14]: the OKLCH engine stays isomorphic). Do NOT add
`server-only`/`client-only` anywhere. pnpm only.

Output: gate-green branch `feat/project-scope-data` + digest (files, typegen diff, gate output).
```

### Teammate **Component** — model: **Sonnet**

```
Objective: Build the ProjectScope React component that renders a project's scope panel from the
contract type.

You OWN (write only these):
- src/projects/oklch-engine/ProjectScope.tsx        (new)
- src/projects/oklch-engine/ProjectScope.module.css (new)

You CONSUME read-only (never edit): the generated `ProjectScope` type from `sanity.types.ts`. If
that type isn't generated yet when you start, code against the FROZEN CONTRACT above (define a
local matching type) and swap to the import at integration — do not block on the Data teammate.

Source of truth (open these):
- node_modules/next/dist/docs/ — Server vs Client Components, default to a Server Component unless
  you need interactivity; verify before writing.
- docs/architecture-plan.md §4 — project modules live under src/projects/<slug>/.
- docs/decisions.md — [D12] the "@layer trap": every CSS Module MUST declare its @layer
  (foundation|brand|project) or stay strictly var-consuming; an unlayered module outranks every
  @layer style and `pnpm lint:css` will fail. Use `@layer project`. [D21]: literal dynamic imports
  only — if you register the component, use `() => import("@/projects/oklch-engine/ProjectScope")`,
  never a templated import.
- docs/handbook/accessibility-and-performance.md for semantic markup / a11y.

Render role, timeline, stack (list), status per the contract. Props: `{ scope: ProjectScope }`,
default export named ProjectScope.

Boundaries: Do NOT edit sanity.types.ts, the schema, the query, or any test file. Do NOT touch
src/lib/oklch/ ([D14]). pnpm only.

Output: gate-green branch `feat/project-scope-component` + digest (files, gate output, whether you
imported the real type or the local contract stand-in).
```

### Teammate **Tests** — model: **Sonnet**

```
Objective: Write unit tests for the ProjectScope component and a reusable fixture.

You OWN (write only these):
- tests/unit/project-scope.test.tsx  (new)
- tests/fixtures/project-scope.ts    (new — a sample ProjectScope object matching the contract)

You CONSUME read-only: the component from src/projects/oklch-engine/ProjectScope.tsx and the
contract. Test against the FROZEN CONTRACT and the component's public props — do not block waiting
on the other slices; use your fixture as input.

Source of truth (open these):
- docs/handbook/testing.md — Vitest + React Testing Library conventions, what to test vs skip,
  RTL query priority (prefer getByRole). Mirror the existing pattern in tests/unit/page.test.tsx
  (import from "@/...", describe/it/expect from vitest, render+screen from @testing-library/react).
- vitest.config.ts / tests/setup.ts for the harness (jsdom, globals, jest-dom matchers).

Cover: renders role/timeline, renders each stack item, reflects each status value. Use
getByRole-first queries.

Boundaries: Do NOT edit the component, schema, query, or sanity.types.ts. Do NOT add an E2E
(Playwright is a later phase per testing.md). pnpm only.

Output: gate-green branch `feat/project-scope-tests` + digest (files, test count, gate output).
```

---

## 4. Work division & dependencies

- **Parallelism via frozen contract.** All three start at once against the contract in §3. The
  natural chain `Data → Component → Tests` is neutralized because the type shape and props are
  fixed up front; teammates use local stand-ins / fixtures until integration.
- **The single ordering constraint:** the _real_ `sanity.types.ts` import (Component) and the live
  schema can only be wired after **Data** commits the regenerated types. Modeled as a **task
  dependency**, not a blocker: Component's first 5 tasks (markup, CSS @layer, props, a11y, local
  type) run free; only its final "swap local type → generated import" task depends on Data's
  "typegen committed" task. Same for Tests' optional "type-level assertion against generated type."
- **~5–6 tasks per teammate** (e.g. Data: schema object → register → query → typegen → commit types
  → self-gate). I keep ~3 buffer tasks unassigned to reassign if one stalls.
- **Monitor & steer:** watch for lagging task status (nudge a teammate to mark done so dependents
  unblock); watch for premature "done" (confirm the gate actually passed before curating). If two
  slices start colliding on a file, the fix is a sharper brief, not a 4th teammate.

---

## 5. Closing the loop (lead's job)

1. **Gate-green handoff.** Each teammate's branch tip must pass the full gate (CI order, §3
   preamble); the `TaskCompleted` hook (exit 2) blocks completion until it does. I re-run the gate
   as a backstop on each branch before curating — I do **not** inherit an unfinished slice; it
   bounces back to its owner.
2. **Lead curates history** (`git-and-pr-workflow.md` §6): rebase the three slices onto latest
   `main`, order them **Data → Component → Tests** (so each commit builds), squash each teammate's
   fix-ups, drop any false start. Push rewritten history with **`--force-with-lease`, never plain
   `--force`** (won't clobber a teammate's concurrent push).
3. **One PR into `main`, squash-merge** with a deliberate Conventional-Commits-shaped subject
   (`feat: add ProjectScope scope panel (data + component + tests)`) and a body that tells the story
   once. Verify CI green on the curated tip — that tip is what deploys to Vercel prod. **Never
   commit to `main` directly.** Delete the branch(es).
4. **Persist external memory:** drop the slice→owner→files map + frozen contract into
   `docs/handbook/process/` so the next session has durable memory, then **shut down teammates by
   name** (Data, Component, Tests).
