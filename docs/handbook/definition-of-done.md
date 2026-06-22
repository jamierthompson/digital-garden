# Definition of Done

> One checklist. Run it before you call **any** task done — before opening a PR, before
> claiming a slice is finished, before handing off. If a box can't be ticked, the work
> isn't done.

This is the gate. It mirrors the CI gate in `.github/workflows/ci.yml` (job `verify`) so
that **if this list is green locally, CI is green** — you never push to find out. CI is the
backstop, not the discovery mechanism. See [git-and-pr-workflow.md](./git-and-pr-workflow.md)
for branch/PR mechanics and [testing.md](./testing.md) for what to test.

---

## 1. The one command

Run the full chain locally. Same scripts, same order as CI:

```bash
pnpm lint && \
pnpm lint:css && \
pnpm lint:keys && \
pnpm format:check && \
pnpm typecheck && \
pnpm test && \
pnpm --filter studio typegen && git diff --exit-code sanity.types.ts && \
pnpm build
```

All green = the automated gate is satisfied. The sections below explain **what each step
guards** so that when one fails you fix the cause, not the symptom. Run the **whole block**;
steps run in dependency order and a mid-chain failure short-circuits the rest — fix it and
re-run from the top, don't cherry-pick steps.

> If you only changed a Studio schema, you still run the **whole** chain — TypeGen drift and
> the build can break from a schema edit alone.

---

## 2. Step-by-step: what each gate means

| Step          | Script                                                                  | Guards                                                                                                                                                       | When it fails, you…                                                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint          | `pnpm lint`                                                             | ESLint + **import boundaries** + **isomorphism** (`eslint.config.mjs`)                                                                                       | Read the boundary message — it tells you which rule + `[D#]`. Don't suppress; restructure.                                                                                            |
| CSS layers    | `pnpm lint:css`                                                         | The **`@layer` trap** — every `*.module.css` rule must be inside `@layer` or the module stays var-consuming `[D12]`                                          | Wrap rules in `@layer foundation\|brand\|project`. (`scripts/check-css-layers.mjs`)                                                                                                   |
| Key drift     | `pnpm lint:keys`                                                        | `keys.ts` ↔ resolver drift `[D10]`. A **stub today** (passes trivially); it's in the chain so the gate needs no re-plumbing when it goes live in **Phase 2** | Nothing yet; goes live Phase 2. (`scripts/check-key-drift.mjs`)                                                                                                                       |
| Format        | `pnpm format:check`                                                     | Prettier formatting                                                                                                                                          | Run `pnpm format` (never hand-format). Re-run the chain.                                                                                                                              |
| Types         | `pnpm typecheck`                                                        | `tsc --noEmit` — incl. resolvers typed `satisfies Record<Key, …>` (the compile-time half of key-drift defense)                                               | Fix the type. No `any` — use `unknown` then narrow.                                                                                                                                   |
| Tests         | `pnpm test`                                                             | `vitest run` — co-located unit/component tests                                                                                                               | Fix the code or the test. See [testing.md](./testing.md).                                                                                                                             |
| TypeGen drift | `pnpm --filter studio typegen` + `git diff --exit-code sanity.types.ts` | Generated `sanity.types.ts` matches the Studio schema `[D23]`                                                                                                | **Commit the regenerated `sanity.types.ts`.** The easiest gate to trip after a schema change — why it drifts and how to fix is in [git-and-pr-workflow.md](./git-and-pr-workflow.md). |
| Build         | `pnpm build`                                                            | Turbopack production build; surfaces Cache Components errors that lint/tsc can't (see §3)                                                                    | Read the build error; usually a missing `<Suspense>` or `'use cache'`.                                                                                                                |

---

## 3. Cache Components: build-only failures to expect `[D11]`

`cacheComponents` is on app-wide, so static-vs-dynamic is decided **per component** at build
time — `pnpm build` is the only gate that catches these. Model memory is stale here; verify
against the bundled docs before "fixing" — primarily
`node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` (the Suspense /
`connection()` rules) and `…/01-app/03-api-reference/01-directives/use-cache.md` (the
cache-key / pass-as-args rules).

- **`Uncached data was accessed outside of <Suspense>`** → wrap the dynamic read in
  `<Suspense>`, or mark the data `'use cache'`. `<Suspense>` alone does not make a component
  dynamic. (You may also see **`Blocking data was accessed outside of Suspense`** for the
  await-before-Suspense case — same family, same fix.)
- **Request APIs are async** — `cookies()` / `headers()` / `params` / `searchParams` are
  Promises. Synchronous access won't typecheck or build.
- **Non-deterministic calls** (`Math.random`, `Date.now`, `crypto.randomUUID`) need
  `await connection()` + `<Suspense>`, or `'use cache'`.
- **`'use cache'` can't read** `cookies()`/`headers()`/`searchParams` inside — read them
  outside and pass as **arguments** (args become the cache key).

If the build hangs (~50s) rather than errors, suspect an unawaited runtime Promise passed
into a cached scope.

---

## 4. "Don't reach up" — universal principle, shared-primitive litmus

**The principle is universal — it is _not_ tied to shared primitives.** Every unit, even one
used only across a single project's own pages, is **self-sufficient**: it reads its themeable
values from **generic tokens** (`--brand-*`, `--font-face`, `--space-*`) and its **props**, and
never reaches _up_ for a host's look or a parent's internal state. A card shown on both a hero
and an essay page consumes the project tokens, not "whatever the hero mounted above me."
Reading the global **invariant** tier (spacing, motion, semantics) is fine — that's plumbing,
not a look. `[D1][D2]`

**The full litmus is the heavier, shared-primitive gate.** When you ship a _shared_ primitive
(rarer — most work is per-project and _supposed_ to be specific), run the complete checklist in
[`../architecture-plan.md`](../architecture-plan.md) §8 before merging: generic-tokens-only
rendering, every themeable value a public token with an internal default, downward theming,
declared-once-and-composed-in, and its CSS Module declaring its `@layer`. `[D1][D2][D12]`

> Same rule at both scopes — never reach up for a _look_. The shared-primitive case just adds
> the full checklist, because there the failure is silent and cross-cutting.

---

## 5. Diff review — clean before you commit

The automated gates can't see intent. Before committing, `git diff --staged` and confirm the
diff is clean: **no debug logs / dead code / unrelated changes**, **no secrets**, **lockfile
committed** if deps changed (`pnpm-lock.yaml` — CI runs `--frozen-lockfile`), and **imports
use `@/*`**. Full rules live in [git-and-pr-workflow.md](./git-and-pr-workflow.md) and
[engineering-standards.md](./engineering-standards.md).

> **Project-specific secrets nuance:** the public Sanity project ID + dataset are _not_
> secrets (they ship to the browser); a Sanity **token** is — server-side only, never
> `NEXT_PUBLIC_*`. `.env*` stays gitignored; `.env.example` is current.

---

## 6. Tests, browser verification & docs

- [ ] **Tests co-located** next to their subject (`*.test.tsx` beside the file). `[D18]`
      New shared logic, sync RSCs, and Client Components get a meaningful test; don't chase
      coverage %. Async RSCs and the primary flow are **Playwright at Phase 3** — not jsdom.
      See [testing.md](./testing.md).
- [ ] **Rendered surface? Browser-verified.** `[D25]` If the task ships/changes a route, visual
      output, theming, or focus/interaction, drive it through the **`chrome-devtools` MCP**
      before calling it done — focus & tap-size (the a11y floor), no CLS/paint regression,
      flash-free theme, clean console. jsdom proves none of this and CI can't drive a browser;
      this is an agent-in-the-loop manual step, not a gate. Skip it only for non-rendering work
      (lib/logic, schema, config, docs). See
      [accessibility-and-performance.md](./accessibility-and-performance.md) §5.
- [ ] **Docs updated** if behavior, scripts, or conventions changed — README and any affected
      handbook page. An architecturally significant decision gets a new `D#` in
      [`../decisions.md`](../decisions.md) (never edit an accepted one — supersede it; see
      [decision-records.md](./decision-records.md)).

---

## 7. Final gate (copy-paste)

```text
[ ] pnpm lint · lint:css · lint:keys · format:check · typecheck · test · build  — all green
[ ] sanity.types.ts regenerated & committed (after ANY Studio schema change)    [D23]
[ ] Cache Components: dynamic reads in <Suspense> or 'use cache'                 [D11]
[ ] "Don't reach up": every unit self-sufficient; full §8 litmus for shared prims §8 / [D1][D2]
[ ] Concerns separated; types co-located (shared on 2nd use); one file/concern    engineering-standards §6
[ ] Diff reviewed: clean — no debug logs / dead code / unrelated changes / secrets
[ ] Lockfile committed if deps changed; imports use @/*
[ ] Tests co-located & meaningful; docs/README/decisions updated if needed      [D18]
[ ] Rendered surface? Browser-verified via chrome-devtools MCP (focus/tap/CLS/flash) [D25]
```

Tick the boxes top to bottom — they aren't independent; the §1 chain short-circuits, so a
green run means every step before it passed too. If every box is ticked, the work is
**done** — open the PR. CI re-runs the same chain as the merge gate, so a green local run
means no surprises. (Requiring `verify` as a merge gate is a GitHub branch-protection
setting — recommend it; see [git-and-pr-workflow.md](./git-and-pr-workflow.md).)
