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
guards** so that when one fails you fix the cause, not the symptom. Steps run in dependency
order; a failure short-circuits the rest. Fix it and re-run the whole chain.

> If you only changed a Studio schema, you still run the **whole** chain — TypeGen drift and
> the build can break from a schema edit alone.

---

## 2. Step-by-step: what each gate means

| Step          | Script                                                                  | Guards                                                                                                              | When it fails, you…                                                                             |
| ------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Lint          | `pnpm lint`                                                             | ESLint + **import boundaries** + **isomorphism** (`eslint.config.mjs`)                                              | Read the boundary message — it tells you which rule + `[D#]`. Don't suppress; restructure.      |
| CSS layers    | `pnpm lint:css`                                                         | The **`@layer` trap** — every `*.module.css` rule must be inside `@layer` or the module stays var-consuming `[D12]` | Wrap rules in `@layer foundation\|brand\|project`. (`scripts/check-css-layers.mjs`)             |
| Key drift     | `pnpm lint:keys`                                                        | `keys.ts` ↔ resolver drift `[D10]`. **Stub/no-op until Phase 2** — passes today                                     | Nothing yet; goes live Phase 2. (`scripts/check-key-drift.mjs`)                                 |
| Format        | `pnpm format:check`                                                     | Prettier formatting                                                                                                 | Run `pnpm format` (never hand-format). Re-run the chain.                                        |
| Types         | `pnpm typecheck`                                                        | `tsc --noEmit` — incl. resolvers typed `satisfies Record<Key, …>` (the compile-time half of key-drift defense)      | Fix the type. No `any` — use `unknown` then narrow.                                             |
| Tests         | `pnpm test`                                                             | `vitest run` — co-located unit/component tests                                                                      | Fix the code or the test. See [testing.md](./testing.md).                                       |
| TypeGen drift | `pnpm --filter studio typegen` + `git diff --exit-code sanity.types.ts` | Generated `sanity.types.ts` matches the Studio schema `[D23]`                                                       | **Commit the regenerated `sanity.types.ts`.** The easiest gate to trip after any schema change. |
| Build         | `pnpm build`                                                            | Turbopack production build; surfaces Cache Components errors that lint/tsc can't (see §3)                           | Read the build error; usually a missing `<Suspense>` or `'use cache'`.                          |

---

## 3. Cache Components: build-only failures to expect `[D11]`

`cacheComponents` is on app-wide, so static-vs-dynamic is decided **per component** at build
time — `pnpm build` is the only gate that catches these. Verify against the bundled docs at
`node_modules/next/dist/docs/` (specifically `cacheComponents.md`, `01-directives/use-cache.md`)
before "fixing" — model memory is stale here.

- **`Uncached data was accessed outside of <Suspense>`** → wrap the dynamic read in
  `<Suspense>`, or mark the data `'use cache'`. `<Suspense>` alone does not make a component
  dynamic.
- **Request APIs are async** — `cookies()` / `headers()` / `params` / `searchParams` are
  Promises. Synchronous access won't typecheck or build.
- **Non-deterministic calls** (`Math.random`, `Date.now`, `crypto.randomUUID`) need
  `await connection()` + `<Suspense>`, or `'use cache'`.
- **`'use cache'` can't read** `cookies()`/`headers()`/`searchParams` inside — read them
  outside and pass as **arguments** (args become the cache key).

If the build hangs (~50s) rather than errors, suspect an unawaited runtime Promise passed
into a cached scope.

---

## 4. The "don't reach up" litmus — shared primitives only (§8, `[D1]`/`[D2]`)

Lint enforces the half it can (import boundaries, `@layer` declaration). The rest is an
**advisory** check you run by hand **before shipping a _shared_ unit** — not every component.
Full source: [`../../architecture-plan.md`](../../architecture-plan.md) §8.

- [ ] Renders correctly reading only **generic tokens** (`--brand-*`, `--font-face`, `--space-*`) + its own defaults — no project-specific (`--logx-*`) dependency. `[D2]`
- [ ] Every themeable value is a **public token** with an internal default.
- [ ] Assumes no **themeable ambient context** (a parent's brand/feel, a font mounted higher).
      Reading the global **invariant** tier (spacing, motion, semantics) is fine — that's
      plumbing, not a look. `[D1]`
- [ ] Declared **once and composed in**, never re-instantiated per island.
- [ ] Host themes it **downward**; the unit never reaches up.
- [ ] Any CSS Module **declares its `@layer`** or stays strictly var-consuming. `[D12]`
- [ ] Any embed key is **namespaced with the project's prefix** so a project-local embed
      can't shadow a shared one.

> Not building a shared primitive? Skip this section. Per-project look-and-feel is _supposed_
> to be specific — the litmus exists to keep shared plumbing from inheriting a look.

---

## 5. Diff review — read every line before you commit

The automated gates can't see intent. Before committing, `git diff` and confirm:

- [ ] **No debug artifacts** — no leftover `console.log`, no commented-out code, no `TODO`
      you meant to resolve.
- [ ] **No unrelated changes** — one task = one focused commit. Reformatting, drive-by
      refactors, or unrelated files don't belong in this diff. ([Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/);
      see [git-and-pr-workflow.md](./git-and-pr-workflow.md).)
- [ ] **No secrets** — no tokens/keys/credentials. Public Sanity project ID + dataset are
      _not_ secrets (they ship to the browser); a Sanity **token** is — server-side only,
      never `NEXT_PUBLIC_*`. `.env*` stays gitignored; `.env.example` is current.
- [ ] **Lockfile committed** if dependencies changed (`pnpm-lock.yaml` — CI runs
      `--frozen-lockfile`).
- [ ] **Imports** use the `@/*` alias, not deep relative chains.

---

## 6. Tests & docs

- [ ] **Tests co-located** next to their subject (`*.test.tsx` beside the file). `[D18]`
      New shared logic, sync RSCs, and Client Components get a meaningful test; don't chase
      coverage %. Async RSCs and the primary flow are **Playwright at Phase 3** — not jsdom.
      See [testing.md](./testing.md).
- [ ] **Docs updated** if behavior, scripts, or conventions changed — README and any affected
      handbook page. An architecturally significant decision gets a new `D#` in
      [`../../decisions.md`](../../decisions.md) (never edit an accepted one — supersede it;
      see [decision-records.md](./decision-records.md)).

---

## 7. Final gate (copy-paste)

```text
[ ] pnpm lint · lint:css · lint:keys · format:check · typecheck · test · build  — all green
[ ] sanity.types.ts regenerated & committed (after ANY Studio schema change)    [D23]
[ ] Cache Components: dynamic reads in <Suspense> or 'use cache'                 [D11]
[ ] "Don't reach up" litmus passed (shared primitives only)                     §8 / [D1][D2]
[ ] Diff reviewed: no debug logs / dead code / unrelated changes / secrets
[ ] Lockfile committed if deps changed; imports use @/*
[ ] Tests co-located & meaningful; docs/README/decisions updated if needed      [D18]
```

If every box is ticked, the work is **done** — open the PR. CI re-runs the same chain as the
merge gate; a green local run means no surprises. (Branch protection requiring `verify` is a
GitHub-side setting; recommend it, don't assume it.)
