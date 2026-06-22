# R3 — Testing this stack (research note)

Research-only note for the doc authors. Verified against primary sources (cited) and
this repo's ground truth (`vitest.config.ts`, `tests/`, `package.json`, CI, and the
architecture plan / ADRs). Do **not** treat training memory as authoritative for
version-specific facts — Vitest 4, Next 16.2.9, React 19.2.4 all diverge from older guides.

## Repo ground truth (as of this note)

- **Installed:** `vitest@^4.1.9`, `@testing-library/react@^16.3.2`,
  `@testing-library/jest-dom@^6.9.1`, `jsdom@^29.1.1`, `@vitejs/plugin-react@^6.0.2`.
  No Playwright yet. No `@testing-library/dom` direct dep (RTL 16 re-exports it).
- **`vitest.config.ts`** — single `environment: "jsdom"`, `globals: true`,
  `setupFiles: ["./tests/setup.ts"]`, `resolve.tsconfigPaths: true` (Vite 7+ native — no
  `vite-tsconfig-paths` plugin, matching the user's Next.js guide).
- **`tests/setup.ts`** — only `import "@testing-library/jest-dom/vitest";`.
- **Tests today:** one file, `tests/unit/page.test.tsx` (RTL `getByRole("heading")`),
  i.e. a non-co-located `tests/unit/` tree. Note this tension with **[D18]** ("co-located
  with its subject") — see Recommendation 4.
- **Scripts:** `test` = `vitest run` (CI single-run), `test:watch` = `vitest`.
- **CI** (`.github/workflows/ci.yml`): `pnpm test` runs on every PR into `main`, alongside
  lint / lint:css / lint:keys / format:check / typecheck / build + TypeGen drift gate.
  Node 22, `pnpm install --frozen-lockfile`.

## What the repo's own plan already mandates (binding — cite these)

- **[D14] / §3.2** — `src/lib/oklch/` is isomorphic: a lint import-boundary forbids
  `next/*`, `react`, `react-dom`, DOM/Node globals; **a dual-environment Vitest run
  executes the suite under both `environment: 'node'` AND `'jsdom'`.** Explicitly **do not**
  use `server-only`/`client-only` — they pin the module to one side and break isomorphism.
- **[D4] / [D5] / §3.2** — contrast is _solved_ (APCA Lc for text, WCAG 2.x fallback) via
  binary-search on OKLCH `L`, _after_ gamut-mapping ([D6]); engine is scheme-aware
  (`(brandColor, scheme) → tokenSet`, light+dark). Tests must assert contrast in **both**
  schemes.
- **[D17] / build-phases §Phase 1** — **Visual harness** renders ramps for **3–4 brand
  colors spanning the hue wheel (must include a yellow and a cyan — the contrast-stressers)**,
  light + dark, asserting APCA Lc / WCAG ratios on every text-on-surface and on-brand pair
  _after_ gamut-mapping. The Phase-1 **exit criterion is observable palette quality, not
  determinism alone**.
- **[D9]** — engine never throws on bad `brandColor`; returns a safe fallback. Tests must
  cover the bad-input path.
- **[D18] / [D19]** — co-located tests every phase; one test file ≈ one commit. Engine
  unit + isomorphism + contrast in Phase 1; resolver / `cardSwatches` / index-query in
  Phase 2; **one integration/E2E of the primary flow in Phase 3** (where routing appears);
  a11y/contrast assertions fold into Phase 1's harness ([D19]).

## External standards (verified, with quotes)

### Testing Library — guiding principle & query priority

- **Guiding principle:** _"The more your tests resemble the way your software is used, the
  more confidence they can give you."_ Testing Library deliberately discourages testing
  internal state, private methods, lifecycle hooks, or child components in isolation.
  ([testing-library.com/docs/guiding-principles](https://testing-library.com/docs/guiding-principles/))
- **Query priority** (use the highest that fits): **Role** (`getByRole` — _"your top
  preference for just about everything"_) → **Label** (`getByLabelText`, forms) →
  Placeholder → **Text** → DisplayValue → AltText → Title → **`getByTestId` is a last
  resort** _"only … where you can't match by role or text or it doesn't make sense."_
  ([testing-library.com/docs/queries/about](https://testing-library.com/docs/queries/about/))
- **Async content:** use `findBy*` / `waitFor`, never bare `getBy*` for content that
  appears after an await.

### Next.js 16 — Vitest setup & the async-RSC limitation (primary, version-matched)

The bundled doc (`node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`,
version 16.2.9, lastUpdated 2026-02-11; mirror at
[nextjs.org/docs/app/guides/testing/vitest](https://nextjs.org/docs/app/guides/testing/vitest)):

> **Good to know:** Since `async` Server Components are new to the React ecosystem, Vitest
> currently does not support them. While you can still run **unit tests** for synchronous
> Server and Client Components, we recommend using **E2E tests** for `async` components.

- Recommended config is exactly what the repo has: `plugins: [react()]`, `environment:
'jsdom'`. (The TS variant in the doc adds `vite-tsconfig-paths`; this repo uses the
  newer Vite-native `resolve.tsconfigPaths: true` instead — equivalent, fewer deps.)
- The doc explicitly blesses co-location: _"test files can also be colocated inside the
  `app` router."_

**Implication for this repo:** synchronous RSCs and Client Components → Vitest + RTL.
**Async** RSCs (anything that `await`s `cookies()`/`headers()`/`params`/`searchParams` —
all async in Next 16 — or `fetch`/GROQ) → **do not** render in jsdom; cover via Playwright
E2E. The page component being tested today (`@/app/page`) is synchronous, so it's fine.

### Vitest 4 — dual-environment via `projects` (preferred) or per-file docblock

- **`workspace` is deprecated since 3.2, replaced by `test.projects`**
  ([vitest.dev/guide/projects](https://vitest.dev/guide/projects)). Multiple projects share
  one Vitest core but each gets an isolated Vite server / module cache / environment.
  Minimal shape:

  ```ts
  // vitest.config.ts
  import { defineConfig } from "vitest/config";
  import react from "@vitejs/plugin-react";

  export default defineConfig({
    plugins: [react()],
    test: {
      projects: [
        {
          extends: true, // inherit root plugins/resolve
          test: {
            name: "jsdom",
            environment: "jsdom",
            setupFiles: ["./tests/setup.ts"],
            include: ["**/*.test.{ts,tsx}"],
            exclude: ["**/*.node.test.ts"],
          },
        },
        {
          extends: true,
          test: {
            name: "node",
            environment: "node",
            include: ["**/*.node.test.ts"],
          },
        },
      ],
    },
  });
  ```

- **Per-file override (lightweight alternative)** for [D14]: a docblock at the top of a
  single shared suite re-runs it in the other env —
  `// @vitest-environment node` or `/** @vitest-environment jsdom */`
  ([vitest.dev/guide/environment](https://vitest.dev/guide/environment)). This runs the
  file once _per chosen env_, not under both. To literally satisfy [D14]'s "under both `node`
  AND `jsdom`," either author the engine suite twice via a tiny shared `*.shared.ts` and two
  thin wrappers (`*.node.test.ts` + `*.jsdom.test.ts`), or use the `projects` split above so
  the **same** glob runs in both — the `projects` approach is cleaner and avoids duplication.
  Recommend `projects`.

### Playwright — E2E principles (for the Phase-3 single flow)

- Core principle: _"Automated tests should verify that the application code works for the
  end users, and avoid relying on implementation details."_
- Use **locators** (`getByRole`) + **web-first assertions** (`await expect(locator)…`) which
  **auto-wait/retry** — no manual sleeps. Isolate tests (own storage/cookies/data, `beforeEach`).
  Mock third-party deps; don't test sites you don't own. **Keep the suite focused on critical
  user workflows**, not exhaustive coverage.
  ([playwright.dev/docs/best-practices](https://playwright.dev/docs/best-practices))
- Standard `webServer` config boots `next start` (or `next dev`) and waits on the URL before
  running. Not yet installed here — add only when Phase 3's routing lands ([D18]/[D19]).

### "Testing Trophy" / meaningful over exhaustive

Kent C. Dodds' Testing Trophy weights integration tests highest for ROI; the user's own
global guidance echoes this ("meaningful coverage, not exhaustive"; "at least one E2E of
the primary flow"). No coverage-percentage target is warranted for a solo agent-driven repo.
([kentcdodds.com/blog/the-testing-trophy-and-testing-classifications](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications))

## Recommended lean, agent-runnable testing policy

1. **Two-tier model.** Vitest + RTL for unit/integration of pure logic, sync Server
   Components, and Client Components. Playwright for E2E of async RSCs and the one primary
   user flow ([D18] Phase 3). Add Playwright **only at Phase 3**, not before.
2. **Engine ([D14]) → `projects` split.** Add a `node` + `jsdom` projects pair to
   `vitest.config.ts` so `src/lib/oklch/**` runs identically in both. Keep `globals: true`
   and the jsdom `setupFiles`; the node project needs no jsdom-matcher setup.
3. **Engine assertions, not snapshots.** Test the _contract_: deterministic output for a
   given `(brandColor, scheme)`; **APCA Lc / WCAG ratio thresholds in both light and dark**
   ([D4]/[D5]); **bad-input → safe fallback, never throws** ([D9]); gamut-mapping happens
   before the contrast solve ([D6]). The visual harness over yellow+cyan+2 others is the
   Phase-1 **exit gate** ([D17]).
4. **Co-location ([D18]).** Prefer `Component.test.tsx` / `module.test.ts` next to the
   subject (Next blesses co-location). Resolve the tension: the existing `tests/unit/` tree
   should migrate to co-located files as Phase 1+ lands, keeping only `tests/setup.ts`
   (and any Playwright `tests/e2e/`) outside `src/`.
5. **Query discipline.** `getByRole` first; `getByTestId` last resort; `findBy*`/`waitFor`
   for anything async. No assertions on CSS class names or internal state.
6. **CI already gates `pnpm test`** on every PR — keep `vitest run` single-shot there; add a
   separate `pnpm test:e2e` Playwright job only once E2E exists (Playwright installs browsers,
   so it warrants its own step/cache).

## Pitfalls to flag for authors

- **Async RSCs do not render in jsdom** — Vitest 4 still can't; route them to Playwright. A
  page that awaits `cookies()`/`params`/`searchParams` (all async in Next 16) is async.
- **`server-only`/`client-only` in the engine breaks [D14]** — forbidden; the dual-env run
  and the boundary lint are the guards, not those packages.
- **`workspace` is deprecated** — use `test.projects` (Vitest ≥3.2 / 4).
- **OKLCH `L` ≠ contrast** ([D4]): a fixed ΔL is not a fixed APCA/WCAG ratio across hues —
  tests must assert the _measured_ ratio, hue-by-hue, which is why the harness needs the
  yellow/cyan stressers.
- **Don't chase coverage %** — meaningful over exhaustive; skip trivial getters and
  framework internals.
- **Don't snapshot the engine's CSS** — assert numeric contrast/gamut properties so tests
  fail for the _right_ reason.

## Anchors index

[D4] [D5] [D6] [D9] [D14] [D17] [D18] [D19] · §3.2 (OKLCH engine), build-phases Phase 1 /
Phase 3.
