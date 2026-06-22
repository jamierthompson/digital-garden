# Testing

How we test this repo. Lean, meaningful-over-exhaustive, agent-runnable. This is "how we
test", not "what to test in detail" — the per-phase test list lives in
[`../build-phases.md`](../build-phases.md) and is locked by [D18]/[D19].

> **Stack is current, not remembered.** Vitest 4, React 19.2.4, Next 16.2.9 all diverge
> from older guides. Verify any framework testing claim against the bundled doc at
> `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md` before writing config.

---

## TL;DR

| Question         | Answer                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Runner           | **Vitest 4** (`vitest run` in CI, `vitest` watch locally)                                                   |
| Component lib    | **React Testing Library 16** + `@testing-library/jest-dom`                                                  |
| DOM env          | **jsdom** (single env today; engine adds a `node` project — see [Dual-env](#dual-env-the-oklch-engine-d14)) |
| E2E              | **Playwright — not yet installed.** Add only at **Phase 3** when routing lands ([D18])                      |
| Where tests live | **Co-located** next to the subject (`Foo.test.tsx` beside `Foo.tsx`) ([D18])                                |
| Coverage target  | **None.** Meaningful coverage, not a percentage                                                             |
| Async RSCs       | **Don't unit-test** — jsdom can't render them; route to Playwright                                          |

---

## Run it

```bash
pnpm test          # vitest run — single shot, what CI runs
pnpm test:watch    # vitest — watch mode for local iteration
```

Tests are gated on every PR into `main` (`.github/workflows/ci.yml`, job `verify`, step
`pnpm test`). Before pushing, run the **whole** local chain — `pnpm test` alone won't catch
a lint/format/typegen failure that reds the PR:

```bash
pnpm lint && pnpm lint:css && pnpm lint:keys && pnpm format:check \
  && pnpm typecheck && pnpm test && pnpm build
```

See [`./definition-of-done.md`](./definition-of-done.md) for the full pre-commit gate and
[`./git-and-pr-workflow.md`](./git-and-pr-workflow.md) for the CI contract.

---

## What to test vs. skip

Borrowed from the Testing Library guiding principle — _"the more your tests resemble the
way your software is used, the more confidence they give you"_
([testing-library.com](https://testing-library.com/docs/guiding-principles/)) — and the
owner's "meaningful coverage, not exhaustive" rule.

**Test:**

- **Pure logic & utilities** — `src/lib/**`, especially the **OKLCH engine** (its contract:
  see [Engine contract](#engine-contract-assert-behaviour-not-snapshots)). Highest value, easiest to test.
- **Sync Server Components and Client Components** — render with RTL, assert what the user
  sees and can interact with.
- **Resolvers / `keys.ts` lookups / index queries** — Phase 2 ([D18]); assert the typed
  `NotFound` path and visible fallbacks ([D10]).
- **The bad-input / error path** — `brandColor` garbage → safe fallback, never a throw ([D9]).
- **One integration/E2E of the primary flow** — Phase 3, Playwright ([D18]/[D19]).

**Skip:**

- Coverage-% chasing, trivial getters/setters, boilerplate.
- Framework internals and third-party library behaviour (don't test that Next routes or
  Sanity fetches — test _your_ transform of their output).
- CSS class names and internal component state — assert rendered output / roles instead.
- **Engine CSS snapshots** — assert _measured_ numeric contrast/gamut values so a failure
  means the right thing (see below).

---

## RTL usage rules

Query by what the user perceives. Priority (use the highest that fits;
[testing-library.com/docs/queries](https://testing-library.com/docs/queries/about/)):

1. `getByRole` — _"your top preference for just about everything"_
2. `getByLabelText` (form fields)
3. `getByText` / `getByDisplayValue` / `getByAltText`
4. `getByTestId` — **last resort only**, when nothing semantic fits.

```tsx
// co-located: src/components/.../Foo.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Foo from "./Foo";

describe("Foo", () => {
  it("renders the heading", () => {
    render(<Foo />);
    expect(
      screen.getByRole("heading", { name: /portfolio/i }),
    ).toBeInTheDocument();
  });
});
```

- **Async content:** use `findBy*` / `waitFor`, never bare `getBy*` for anything that
  appears after an `await`.
- `globals: true` is set, so `describe`/`it`/`expect` need no import — but import them
  anyway for clarity (the existing test does). `jest-dom` matchers
  (`toBeInTheDocument`) come from `tests/setup.ts`.

---

## Co-location ([D18])

Put the test next to its subject: `module.test.ts` beside `module.ts`, `Foo.test.tsx`
beside `Foo.tsx`. Next.js explicitly blesses co-location inside the `app` router (bundled
vitest doc: _"test files can also be colocated inside the `app` router"_).

- `tests/` holds **only** cross-cutting infra: `tests/setup.ts` today, plus `tests/e2e/`
  once Playwright lands.
- The current `tests/unit/page.test.tsx` is the **lone legacy exception** — migrate it to a
  co-located file as Phase 1+ work touches that surface. Don't add new files under
  `tests/unit/`.
- One test file ≈ one commit ([D18]).

---

## Async Server Components — the jsdom wall

Next 16's request APIs (`cookies()`, `headers()`, `params`, `searchParams`) are **async**,
so any component that awaits them — or awaits `fetch`/GROQ — is an **async RSC**. The
version-matched Next doc is explicit:

> Since `async` Server Components are new to the React ecosystem, Vitest currently does not
> support them. While you can still run **unit tests** for synchronous Server and Client
> Components, we recommend using **E2E tests** for `async` components.
> — `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`

**Rule:** sync component → Vitest + RTL. Async RSC → Playwright (Phase 3). Don't fight
jsdom to render an async RSC; it won't, and the failure is misleading.

---

## Dual-env: the OKLCH engine ([D14])

`src/lib/oklch/**` is **isomorphic** — it must run identically server- and client-side. Two
guards enforce this, and both are mandatory:

1. **Import-boundary lint** (`pnpm lint`, `eslint-plugin-boundaries`): the engine may not
   import `next/*`, `react`, `react-dom`, or touch DOM/Node globals. **Never** add
   `server-only` / `client-only` to engine files — they pin the module to one side and
   break isomorphism ([D14]).
2. **Dual-environment test run:** the engine suite executes under **both** `environment:
'node'` and `environment: 'jsdom'`.

The repo's `vitest.config.ts` is single-env (`jsdom`) today. When the engine lands
(Phase 1), add a **`test.projects`** split so the same glob runs in both envs — `projects`
is the current API (`workspace` is **deprecated** since Vitest 3.2;
[vitest.dev/guide/projects](https://vitest.dev/guide/projects)):

```ts
// vitest.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true, // inherit root plugins + resolve
        test: {
          name: "jsdom",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./tests/setup.ts"],
          // engine suite is the only thing that must run in BOTH; component
          // tests are jsdom-only. Keep the jsdom project broad...
        },
      },
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          globals: true,
          // ...and scope the node project to the engine glob.
          include: ["src/lib/oklch/**/*.test.ts"],
        },
      },
    ],
  },
});
```

Why `projects` over the per-file `// @vitest-environment node` docblock: the docblock runs
a file in _one_ chosen env, so satisfying "both" would mean duplicating the suite into two
wrapper files. `projects` runs the **same** glob in both envs with no duplication. Keep the
node project free of jsdom matcher setup — it needs no `setupFiles`.

> Confirm the exact `projects` shape against
> [vitest.dev/guide/projects](https://vitest.dev/guide/projects) when you wire it up — this
> snippet is the intended structure, not yet committed config.

### Engine contract: assert behaviour, not snapshots

The engine's tests assert the _contract_, hue-by-hue — not a frozen CSS string:

- **Determinism:** same `(brandColor, scheme)` → same `tokenSet`, every run ([D5]).
- **Contrast in both schemes:** APCA Lc for text (WCAG 2.x ratio as the compliance
  fallback), asserted in **light and dark** ([D4]/[D5]). OKLCH `L` is **not** contrast — a
  fixed ΔL is not a fixed ratio across hues, so assert the **measured** ratio per hue ([D4]).
- **Gamut-map first:** contrast is solved on the gamut-mapped colour ([D6]).
- **Never throws:** bad `brandColor` → safe fallback palette, asserted explicitly ([D9]).

See [`./accessibility-and-performance.md`](./accessibility-and-performance.md) for the
APCA Lc targets these assertions check against.

---

## Phase-1 visual contrast harness ([D17])

The engine's **exit criterion is observable palette quality, not determinism alone** ([D17]).
A visual harness renders ramps for **3–4 brand colours spanning the hue wheel — and it MUST
include a yellow and a cyan** (the contrast-stressers where ΔL≠contrast bites hardest),
**light and dark**, asserting APCA Lc / WCAG ratios on every text-on-surface and on-brand
pair _after_ gamut-mapping. Phase 1 is not done until this harness is green. This is where
accessibility/contrast assertions live — they fold into the engine harness, not a separate
a11y suite ([D19]).

---

## Playwright — later, not now

Playwright is **not installed**; add it **only at Phase 3** when routing and async RSCs
appear ([D18]/[D19]). When it lands:

- One E2E for the **primary user flow** — more valuable than dozens of shallow units.
- Use locators (`getByRole`) + web-first assertions (`await expect(locator)…`) which
  auto-wait/retry — **no manual sleeps**. Isolate tests (own storage/data per test). Mock
  third parties; don't test sites you don't own.
  ([playwright.dev/docs/best-practices](https://playwright.dev/docs/best-practices))
- Give it its **own CI step/job** (`pnpm test:e2e`) — installing browsers warrants a
  separate cache from the Vitest step. Keep `pnpm test` as the fast unit gate.

---

## Pitfalls

- **Async RSCs don't render in jsdom** — Vitest 4 still can't; route to Playwright.
- **`server-only` / `client-only` in the engine break [D14]** — forbidden; the boundary
  lint + dual-env run are the guards, not those packages.
- **`workspace` is deprecated** — use `test.projects` (Vitest ≥3.2 / 4).
- **OKLCH `L` ≠ contrast** ([D4]) — assert _measured_ ratios per hue; that's why yellow and
  cyan are mandatory stressers in the harness.
- **Don't snapshot engine CSS** — assert numeric contrast/gamut so tests fail for the right
  reason.
- **Don't chase coverage %** — meaningful over exhaustive.

---

## Anchors

[D4] · [D5] · [D6] · [D9] · [D10] · [D14] · [D17] · [D18] · [D19] —
[`../decisions.md`](../decisions.md). Plan §3.2 (OKLCH engine) —
[`../architecture-plan.md`](../architecture-plan.md). Phase 1 / Phase 3 —
[`../build-phases.md`](../build-phases.md). Research: [`./research/R3-testing.md`](./research/R3-testing.md).
