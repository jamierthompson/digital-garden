# Testing

How we test this repo. Lean, meaningful-over-exhaustive, agent-runnable. This is "how we
test", not "what to test in detail" — the per-phase test list lives in
[`../build-phases.md`](../build-phases.md) and is locked by [D18]/[D19].

> **Stack is current, not remembered.** Vitest 4, React 19.2.4, Next 16.2.9 all diverge
> from older guides. Verify any framework testing claim against the bundled doc at
> `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md` before writing config.

---

## TL;DR

| Question         | Answer                                                                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runner           | **Vitest 4** (`vitest run` in CI, `vitest` watch locally)                                                                                                 |
| Component lib    | **React Testing Library 16** + `@testing-library/jest-dom`                                                                                                |
| DOM env          | **jsdom** (single env today; engine adds a `node` project — see [Dual-env](#dual-env-the-oklch-engine-d14))                                               |
| E2E              | **Playwright — not yet installed.** Add only at **Phase 3** when routing lands ([D18])                                                                    |
| Browser checks   | **Chrome DevTools MCP** — agent-driven a11y/CWV/visual verification of rendered surfaces; the ship-gate browser check, **not** committed CI tests ([D25]) |
| Where tests live | **Co-located** next to the subject (`Foo.test.tsx` beside `Foo.tsx`) ([D18])                                                                              |
| Coverage target  | **None.** Meaningful coverage, not a percentage                                                                                                           |
| Async RSCs       | **Don't unit-test** — jsdom can't render them; extract the logic (Phase 1/2) or route to Playwright (Phase 3)                                             |

---

## Run it

```bash
pnpm test          # vitest run — single shot, what CI runs
pnpm test:watch    # vitest — watch mode for local iteration
```

Tests are gated on every PR into `main` (`.github/workflows/ci.yml`, job `verify`, step
`pnpm test`). But **`pnpm test` is only the test slice of the PR gate** — run the full
local chain (lint, `lint:css`, `lint:keys`, `format:check`, typecheck, test, build) from
[`./definition-of-done.md`](./definition-of-done.md) before pushing, and see
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

> **Adversarial QA authors tests too.** The independent pre-PR QA pass `[D26]` isn't only a
> read-through — it **writes the breaking test cases the author optimized past** (malformed
> `brandColor` → fallback never throws `[D9]`, the not-found / error path, both schemes, the empty
> and boundary inputs) and proves the break with a failing case before the owning author fixes it.
> Those cases are normal co-located tests held to the same bar as everything here — meaningful, by
> role/behavior, no snapshot dumps. The dev↔QA loop lives in
> [`./working-with-agents.md`](./working-with-agents.md) §6.2.

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
- `globals: true` is set, so `describe`/`it`/`expect` need no import — but **match the
  existing file's explicit-import style** (`tests/unit/page.test.tsx` imports them) for
  consistency, not correctness. `jest-dom` matchers (`toBeInTheDocument`) come from
  `tests/setup.ts`.

This priority list governs **component tests**. The Phase-1 engine harness asserts numeric
contrast/color values, not roles — see [Visual contrast harness](#phase-1-visual-contrast-harness-d17).

---

## Co-location ([D18])

Put the test next to its subject: `module.test.ts` beside `module.ts`, `Foo.test.tsx`
beside `Foo.tsx`. Next.js explicitly blesses this — the bundled vitest doc uses the common
`__tests__` convention but adds: _"test files can also be colocated inside the `app`
router."_ We always co-locate; we do not use `__tests__/`.

- `tests/` holds **only** cross-cutting infra: `tests/setup.ts` today, plus `tests/e2e/`
  once Playwright lands.
- The current `tests/unit/page.test.tsx` is the **lone legacy exception** — migrate it to a
  co-located file in the next phase that touches that surface (0.5 onward — the walking
  skeleton is the first co-locatable work). Don't add new files under `tests/unit/`.
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

**Rule:** sync component → Vitest + RTL. Async RSC → don't fight jsdom to render it; it
won't, and the failure is misleading.

**Before Playwright lands (Phases 1–2):** Playwright doesn't arrive until Phase 3, so an
async RSC written earlier has no E2E to cover it. Don't leave it untested — **extract the
testable logic** (the GROQ transform, the resolver, the fallback selection) into a pure
function in `src/lib` or `src/sanity/lib` and unit-test _that_. The async shell stays
untested until E2E exists. This is the same "test _your_ transform of their output" move
from [What to test](#what-to-test-vs-skip).

---

## Dual-env: the OKLCH engine ([D14])

`packages/oklch/**` (the `@garden/oklch` package [D23]) is **isomorphic** — it must run
identically server- and client-side. Two guards enforce this, and both are mandatory:

1. **Isomorphism lint** (`pnpm lint`): a dedicated `eslint.config.mjs` block on
   `packages/oklch/**` (`no-restricted-imports` + `no-restricted-globals`) forbids the engine
   from importing `next`/`next/*`, `react`, `react-dom`, or touching DOM/Node globals. **Never** add
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
import tsconfigPaths from "vite-tsconfig-paths"; // see alias caveat below
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The bundled Next 16.2.9 doc resolves the @/* alias via the vite-tsconfig-paths
  // PLUGIN, not a `resolve.tsconfigPaths` flag. The live single-env config uses
  // `resolve: { tsconfigPaths: true }` — that key is non-standard/unverified against
  // Vite/Vitest docs. Prefer the plugin form here, and CONFIRM that an aliased import
  // (e.g. `@/lib/cardSwatches`) actually resolves in BOTH projects before relying on it.
  plugins: [tsconfigPaths(), react()],
  test: {
    projects: [
      {
        extends: true, // inherit root plugins
        test: {
          name: "jsdom",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./tests/setup.ts"],
          // INVARIANT: jsdom is intentionally broad — it runs EVERYTHING by default.
          // The engine glob below is dual-run (jsdom + node); all other tests are
          // jsdom-only. If you ever need a node-only test OUTSIDE the engine, give
          // jsdom an explicit `exclude` for it, or it will also run here in the wrong env.
        },
      },
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          globals: true,
          // node project is scoped to the engine glob ONLY. No jsdom matcher setup
          // (no setupFiles) — it needs none.
          include: ["packages/oklch/**/*.test.ts"],
        },
      },
    ],
  },
});
```

Why `projects` over the per-file `// @vitest-environment node` docblock: the docblock runs
a file in _one_ chosen env, so satisfying "both" would mean duplicating the suite into two
wrapper files. `projects` runs the **same** glob in both envs with no duplication.

Run just one env while debugging an isomorphism failure:

```bash
pnpm test --project node    # verify exact flag against vitest.dev when wiring
```

> Confirm the exact `projects` shape **and the alias mechanism** against
> [vitest.dev/guide/projects](https://vitest.dev/guide/projects) and the bundled Next doc
> when you wire it up — this snippet is the intended structure, not yet committed config.

### Engine contract: assert behaviour, not snapshots

The engine's tests assert the _contract_, hue-by-hue — not a frozen CSS string:

- **Determinism:** same `(brandColor, scheme)` → same `tokenSet`, every run ([D5]).
- **Contrast in both schemes:** APCA Lc for text (WCAG 2.x ratio as the compliance
  fallback), asserted in **light and dark** ([D4]/[D5]). OKLCH `L` is **not** contrast — a
  fixed ΔL is not a fixed ratio across hues, so assert the **measured** ratio per hue ([D4]).
- **Gamut-map first:** contrast is solved on the gamut-mapped color ([D6]).
- **Never throws:** bad `brandColor` → safe fallback palette, asserted explicitly ([D9]).
  This covers **D9 layer 1** (the defensive engine). The Sanity author-time validation and
  `unstable_catchError` backstop layers are tested where they live (Phase 2 / Phase 3).

See [`./accessibility-and-performance.md`](./accessibility-and-performance.md) for the
APCA Lc targets these assertions check against.

---

## Phase-1 visual contrast harness ([D17])

The engine's **exit criterion is observable palette quality, not determinism alone** ([D17]).
[D17] mandates a visual harness over **3–4 brand colors spanning the hue wheel**; we
_additionally_ pin a **yellow and a cyan** because [D4] (equal ΔL ≠ equal contrast across
hues) — those are the stressers where the gap bites hardest. The harness renders ramps for
those colors, **light and dark**, asserting APCA Lc / WCAG ratios on every
text-on-surface and on-brand pair _after_ gamut-mapping. Phase 1 is not done until this
harness is green. This is where accessibility/contrast assertions live — they fold into the
engine harness, not a separate a11y suite ([D19]).

The harness asserts **computed color/contrast values** (read from the engine output or the
rendered styles directly) — **not** via RTL semantic queries. The
[RTL priority list](#rtl-usage-rules) governs component tests, not this harness; don't try
to force `getByRole` onto a swatch grid.

---

## Playwright — later, not now

Playwright is **not installed**; add it **only at Phase 3** when routing and async RSCs
appear ([D18]/[D19]). When it lands:

- One E2E for the **primary user flow** — more valuable than dozens of shallow units.
- Use locators (`getByRole`) + web-first assertions (`await expect(locator)…`) which
  auto-wait/retry — **no manual sleeps**. Isolate tests (own storage/data per test). Mock
  third parties; don't test sites you don't own.
  ([playwright.dev/docs/best-practices](https://playwright.dev/docs/best-practices))
- Give it its own CI step so browser installs don't slow the unit gate — detail that in
  [`./definition-of-done.md`](./definition-of-done.md) / the CI doc _then_, not now.

---

## Browser verification (Chrome DevTools MCP) — adjacent to the suite `[D25]`

Distinct from everything above: the `chrome-devtools` MCP is **agent-driven, in-loop
verification** of a rendered surface — focus/a11y, CLS/paint, flash-free theme, console — **not
a committed test**. It's the ship-gate browser check owned by
[`./accessibility-and-performance.md`](./accessibility-and-performance.md) §5 and gated per task
in [`./definition-of-done.md`](./definition-of-done.md) §6. It **fills the gap** that jsdom (no
paint, no async RSCs) and the absent Playwright (Phase 3) leave open for UI built in Phases
0.5–2, and it does **not** replace Playwright's committed primary-flow E2E.

---

## Pitfalls

- **Async RSCs don't render in jsdom** — Vitest 4 still can't; extract the logic and
  unit-test it (Phases 1–2), or route to Playwright (Phase 3).
- **`server-only` / `client-only` in the engine break [D14]** — forbidden; the boundary
  lint + dual-env run are the guards, not those packages.
- **`workspace` is deprecated** — use `test.projects` (Vitest ≥3.2 / 4).
- **The `@/*` alias is unverified config** — the live `resolve: { tsconfigPaths: true }` is
  non-standard; prefer the bundled-doc `vite-tsconfig-paths` plugin and confirm aliases
  resolve in **both** projects before relying on them.
- **OKLCH `L` ≠ contrast** ([D4]) — assert _measured_ ratios per hue; that's why yellow and
  cyan are mandatory stressers in the harness.
- **Don't snapshot engine CSS** — assert numeric contrast/gamut so tests fail for the right
  reason.
- **Don't chase coverage %** — meaningful over exhaustive.

---

## Anchors

[D4] · [D5] · [D6] · [D9] · [D10] · [D14] · [D17] · [D18] · [D19] · [D25] · [D26] —
[`../decisions.md`](../decisions.md). Plan §3.2 (OKLCH engine) —
[`../architecture-plan.md`](../architecture-plan.md). Phase 1 / Phase 3 —
[`../build-phases.md`](../build-phases.md). Research: [`./process/research/R3-testing.md`](./process/research/R3-testing.md).
