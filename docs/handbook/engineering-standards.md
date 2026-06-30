# Engineering Standards

The coding conventions an agent applies in this repo. This is _how we write code_, not _what the system is_ — for the system model read [`./architecture.md`](./architecture.md).

**One rule above all others — the framework is not the one you remember.** This is Next.js **16** + React **19** with Cache Components enabled app-wide. Request APIs are async, `middleware.ts` is gone, `export const dynamic` is removed. Before you write any framework code, **read the version-matched doc** in `node_modules/next/dist/docs/` ([`../../AGENTS.md`](../../AGENTS.md) says the same). Don't code from training-data memory — it is stale here.

Most of what follows is **machine-enforced** (`pnpm lint · lint:css · lint:keys · lint:docs · format:check · typecheck · test`, all gated in CI — see [`./git-and-pr-workflow.md`](./git-and-pr-workflow.md) and [`./definition-of-done.md`](./definition-of-done.md)). Where a rule has a checker, this doc tells you the _intent_ so you stop fighting the tool.

---

## 1. TypeScript

| Rule                      | Do                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Why / source                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No `any`**              | Use `unknown`, then narrow.                                                                                                                                                                                                                                                                                                                                                                                                                                         | `strict: true` in `tsconfig.json`. `any` disables the checker that catches the `brandColor`-500 class of bug.                                                                   |
| **Type params + returns** | Annotate every function signature explicitly.                                                                                                                                                                                                                                                                                                                                                                                                                       | Don't rely on inference at module boundaries — see `breakpoints.ts` `minWidth(bp: Breakpoint): string`.                                                                         |
| **`interface` vs `type`** | `interface` for object shapes meant to be extended/implemented; `type` for unions, intersections, mapped/computed types. Be consistent within a file.                                                                                                                                                                                                                                                                                                               | Owner standard.                                                                                                                                                                 |
| **`@/*` alias**           | For app code, import as `@/lib/cardSwatches`, never `../../../lib`. (Cross-package code uses its package name, e.g. `@garden/oklch`.)                                                                                                                                                                                                                                                                                                                               | Configured in `tsconfig.json` `paths`. Survives file moves; ESLint boundaries match on `src/**`.                                                                                |
| **API/external shapes**   | Define explicit types; never lean on implicit inference from external data.                                                                                                                                                                                                                                                                                                                                                                                         | GROQ results come **typed** via Sanity TypeGen → `sanity.types.ts` (generated — do **not** hand-edit; it's ignored by lint and format, and `git diff --exit-code`-gated in CI). |
| **Reference-by-key**      | `keys.ts` is the single source of truth — typed resolvers `satisfies Record<Key, …>` so a missing entry is a **compile error**, returning a typed `NotFound`, never a bare lookup. Authored at `src/lib/keys.ts`, dependency- and side-effect-clean; a future move relocates it to a **shared workspace package** the app and standalone Studio both consume (the Studio can't import `src/*`), never duplicated. Establish the pattern early, instantiate it late. | architecture.md's CMS ↔ code registry section.                                                                                                                                  |

`tsc --noEmit` (`pnpm typecheck`) is a CI gate. Run it before pushing.

---

## 2. React 19 — Server vs Client Components

Default is **Server Component**. Reach for a Client Component (`'use client'`) only when you need browser-only capability: state/effects, event handlers, browser APIs, or Context consumers. Keep the `'use client'` boundary as **low in the tree as possible** — a leaf, not a layout — so the server-rendered shell stays large and the client bundle stays small.

| Need                                                  | Use                                               | Notes                                                                                           |
| ----------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Render content, fetch data, read request APIs         | Server Component (default)                        | `async` components are fine here.                                                               |
| `useState`/`useEffect`/`onClick`/`matchMedia`/Context | Client Component, `'use client'` at the top       | Context is **unavailable** in Server Components.                                                |
| Conditionally include a Client widget's JS            | `next/dynamic` / `React.lazy` _inside_ the module | Server Components are auto-split already; the real client-bundle win is lazy Client Components. |

**Code-splitting projects uses LITERAL dynamic imports:**

```ts
// ✅ statically analyzable — bundler can split per slug
const load = () => import("@/projects/oklch-engine");
// ❌ templated — defeats static analysis, breaks the split
const load = () => import(`@/projects/${slug}`);
```

`ssr: false` is **Client-Component-only** — passing it from a Server Component is an error (`…/02-guides/lazy-loading.md`).

**Do NOT put `server-only` / `client-only` on the OKLCH engine.** Those pin a module to one side and break the isomorphism requirement (see the Import boundaries section). This is lint-enforced.

> ⚠️ **Async Server Components don't render in jsdom** — Vitest can't unit-test them. Test sync RSCs / Client Components with RTL; cover async RSCs and the primary flow with Playwright (E2E). See [`./testing.md`](./testing.md).

---

## 3. Cache Components, `'use cache'`, and async request APIs

`cacheComponents: true` is set app-wide in `next.config.ts`. This **inverts the model you remember**:

- **Data is dynamic by default; you opt _into_ caching.** `export const dynamic` / `force-static` / `experimental.ppr` are **removed** — don't reach for them. A route is a **prerendered static shell with dynamic holes** (PPR, now the default). Static-vs-dynamic is a **per-component** decision, set by where `'use cache'` sits and where request-time APIs are touched. Verified: `…/02-guides/migrating-to-cache-components.md`, `…/03-api-reference/01-directives/use-cache.md`.

**Three outcomes per component:**

| Component does…                           | Outcome                         | What you must do            |
| ----------------------------------------- | ------------------------------- | --------------------------- |
| Pure / deterministic                      | Auto-prerendered into the shell | nothing                     |
| Marked `'use cache'`                      | Cached, baked into the shell    | key on its args (see below) |
| Touches a runtime API or uncached `fetch` | Streams at request time         | **wrap in `<Suspense>`**    |

> **Build-time hard error:** `Uncached data was accessed outside of <Suspense>` (exact string at `…/01-getting-started/08-caching.md`). Forgetting the boundary fails the build — and `pnpm build` is the last CI gate. `<Suspense>` alone does **not** make a component dynamic; it marks _where_ the dynamic hole streams.

**Request APIs are ASYNC** — `await` them. This breaks model memory hardest:

```ts
const cookieStore = await cookies();
const h = await headers();
// route props:
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
}
```

Same for `headers()`, `draftMode()`, `searchParams`. Synchronous access no longer works (`…/04-functions/cookies.md`). **`generateMetadata`** is in the same family: Server-Components-only with async `params` — touching runtime data on an otherwise-prerenderable page raises an error demanding `'use cache'` or a `connection()` marker.

**`'use cache'` rules** (`…/01-directives/use-cache.md`):

- You **cannot** call `cookies()`/`headers()`/`searchParams` _inside_ a cached scope. Read them **outside** and pass values **as arguments** — args + closures become the cache key.
- Args use strict RSC serialization (no class instances, functions, `URL`). Returns may include JSX. `children` and Server Actions are pass-through only.
- Defaults: stale 5 min / revalidate 15 min / no expiry. Tune with `cacheLife`, invalidate with `cacheTag` + `updateTag`.
- Non-deterministic calls (`Math.random`, `Date.now`, `crypto.randomUUID`) inside a prerenderable scope need either `'use cache'` or `await connection()` + `<Suspense>`.
- **Vercel caveat (one line):** in-memory `'use cache'` may not persist across serverless invocations → `'use cache: remote'` exists for durable runtime data. See [`./security-and-ops.md`](./security-and-ops.md).

**The read-outside / pass-as-arg refactor** is the single most common cache mistake — read the request API in the dynamic parent, pass the value into the cached child as a prop:

```tsx
// Parent stays dynamic: reads the request API, wraps the cached child in Suspense.
async function Page() {
  const theme = (await cookies()).get("theme")?.value ?? "light";
  return (
    <Suspense fallback={<Skeleton />}>
      <Card theme={theme} />
    </Suspense>
  );
}

// Child is cached, keyed on its args — never reads cookies()/headers() itself.
async function Card({ theme }: { theme: string }) {
  "use cache";
  // ...render using `theme`; `theme` is part of the cache key
}
```

**This is the load-bearing pattern for theming:** render the slot's `ProjectScope` inside the prerendered shell, `'use cache'` it keyed on `brandColor`/`fontKey` with `cacheLife('max')` and no request APIs in that boundary — so the slot's theme `<style>` and the font `.variable` class land in the **initial static HTML** (flash-free).

**Routing fact that bites:** `middleware.ts` is renamed **`proxy.ts`**, **Node runtime only** — setting `runtime` throws (`…/03-file-conventions/proxy.md`).

> **State across navigation:** with Cache Components, Next keeps recently-visited routes in the DOM (hidden via `display: none`, up to 3) instead of unmounting them, so React state and DOM state are **preserved** across back/forward nav. Effects are **not** auto-cleaned — if you need a transient bit of UI to reset, do it yourself in a `useLayoutEffect` cleanup. Don't assume a route remounts on navigation. See `…/02-guides/preserving-ui-state.md`.

---

## 4. CSS — custom properties, CSS Modules, and the `@layer` discipline

**No Tailwind. No JSON tokens. No Style Dictionary.** Styling is CSS custom properties + CSS Modules organized with `@layer`.

**Tokens are three layers** (the deep treatment is architecture.md's Token & theming architecture section — the layer names below are what you need to apply the `@layer` rule):

1. **Foundation** (primitives: spacing, motion, breakpoints, z-index, type-scale) → global `:root` in `src/app/foundation.css`.
2. **Semantic** (generic role tokens components actually read) → the layer components consume; radius, border weight, shadow, and density live here too — they're just more semantic tokens, not a separate "feel/geometry" tier.
3. **Brand** → a project **slot**'s full scoped override of the semantic layer — engine-scoped to the `[data-project]` wrapper, emitted by the OKLCH engine; page chrome stays on the global editorial foundation.

Components read **generic semantic tokens** — `--brand-*`, `--font-face`, `--space-*`. There are **no `--<proj>-*` per-project prefixed token names**: the `[data-project]` scope provides the isolation, so a slot overrides the same generic names the rest of the app reads.

### The `@layer` trap — read this

**Next does NOT auto-assign CSS Modules to a cascade layer.** Per the CSS cascade-layers spec (CSS Cascading and Inheritance Level 5; see MDN "Cascade layers"), an **unlayered** declaration **outranks every `@layer` style** regardless of specificity — and Next leaves Modules unlayered. So:

> **Every `*.module.css` MUST wrap its rules in `@layer foundation` / `@layer brand` / `@layer project` — or stay strictly var-consuming (no bare rules).**

This is enforced by `pnpm lint:css` (`scripts/check-css-layers.mjs`, a CI gate): any rule outside an `@layer` block fails the build. Layer order is declared once, first, in `foundation.css`:

```css
@layer foundation, brand, project; /* foundation < brand < project */
```

The engine's scoped `<style>` declares `@layer brand`. Note: Next's own CSS doc (`…/01-getting-started/11-css.md`) covers only import-order chunking — it never assigns Modules to a layer, which is exactly the gap this rule closes.

### Other CSS rules

| Rule                                 | Detail                                                                                                                                                                                                                                            | Source                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Breakpoints are not `:root` vars** | CSS variables are invalid inside `@media` conditions. Use container queries or the literal px in CSS; `src/lib/breakpoints.ts` holds the constants that feed JS (`matchMedia`); slot-responsive layout uses container queries scoped to the slot. | —                                                                              |
| **Focus ring**                       | Geometry (width/offset/style, `:focus-visible` policy) is global in `foundation.css`; ring **color** is an engine token per slot. Use `:focus-visible`, never bare `outline: none`.                                                               | see [`./accessibility-and-performance.md`](./accessibility-and-performance.md) |
| **Streamed `<style>`**               | Plain inline `<style>` is fine when `ProjectScope` renders above any Suspense (the common case). Use React 19 `<style href={\`theme-${slug}\`} precedence>`only if`ProjectScope` can suspend.                                                     | —                                                                              |
| **Stega off `brandColor`/`fontKey`** | Sanity stega injects invisible chars that break the OKLCH parse and font lookup — disable it on those fields.                                                                                                                                     | —                                                                              |

---

## 5. Import boundaries (ESLint `eslint-plugin-boundaries`)

`eslint.config.mjs` defines four element types over `src/**` and enforces directional dependencies via `pnpm lint` (CI-gated). The directories are stood up empty so the rules can't rot before code arrives. **First match wins**, so specific patterns precede the `shared` catch-all. The table is the _intent_; `eslint.config.mjs` is the source of truth for the exact lint message you'll see when one fails. (The OKLCH engine is not a `boundaries` element — it lives in its own workspace package; its isomorphism guard lives in a dedicated block, see below.)

| Rule                        | Meaning                                                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `project` ⇏ other `project` | A project module **cannot import another project** (matched by captured `slug`) — lift shared code into a shared module instead. |
| `shared` ⇏ `project`        | Dependencies point **from projects to shared, never back**.                                                                      |

**The OKLCH engine (`packages/oklch/**`, the `@garden/oklch`workspace package) is isomorphic**— it must run identically in Node and the browser. It lives in its own package precisely so the standalone Studio can import it too; its guard is a dedicated `eslint.config.mjs`block on`packages/oklch/**`(not a`boundaries`element — that plugin is`src/**`-scoped). Two guards:

1. **No framework imports** — `no-restricted-imports` forbids `next`/`next/*`, `react`, `react-dom`/`react-dom/*`, and **`server-only`/`client-only`** (those break it; see the React section).
2. **No DOM/Node globals** — `no-restricted-globals` forbids `window`/`document`/`process`/`Buffer`/… inside `packages/oklch/**` (full list in `eslint.config.mjs`). Imports can't catch ambient globals, so this rule does.

The contract is also test-enforced: the engine suite runs under **both** `node` and `jsdom` Vitest environments (see [`./testing.md`](./testing.md)).

`studio/**` and `sanity.types.ts` are out of scope for the app's ESLint config (the standalone Studio has its own; the types file is generated).

---

## 6. Code organization & separation of concerns

House rule: **establish the pattern early, instantiate it late** (the deferral discipline). Name where each kind of code _will_ live, but don't stand up the structure until a concrete trigger earns it — a genuine second use or an actual prop-drill. "I'll need it later" is not a trigger. Each rule below pairs with the **trigger** that says it's time — none of this is built pre-emptively.

| Concern                                             | Where it lives                                                                                  | Instantiate when…                                                                                                                        |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Pure logic / utilities (no React, no I/O)           | `src/lib/*` (`breakpoints.ts`, `cardSwatches`, resolvers); the OKLCH engine in `packages/oklch` | always — logic stays out of components                                                                                                   |
| Data fetching / external I/O (the "services" layer) | `src/sanity/lib/*`                                                                              | a new external source appears. **No generic `services/`** — RSCs fetch directly and `sanity/lib` is the I/O home                         |
| Interaction logic / state (reducers, machines)      | a hook beside the component, or a headless `core/`                                              | a component's logic outgrows its render — extract a `core/` **then**, not by template (architecture.md's interactive experience section) |
| Presentation                                        | the component, reading **tokens + props**                                                       | —                                                                                                                                        |

**Separation of concerns.** A component renders; it does not _also_ own a reducer, derive data, and fetch. Keep those concerns separable even before you split them — when logic starts to crowd render, lift it into a hook / `core/` and feed the component tokens and props. This is architecture.md's interactive experience section's headless-core idea applied everywhere, not only to an experience.

**State at the lowest common owner.** Client state starts as local `useState` in the leaf Client Component (`'use client'` as low as possible, the React section). **Trigger to lift:** the moment you're prop-drilling — threading one value through 2+ components that don't themselves use it — raise it to the lowest common parent, or introduce Context / a small store _at that point_, never pre-emptively. Most "state" here is server data (RSC + cookies + `'use cache'`, the Cache Components section); a client store is only for genuinely client-only state shared across a subtree.

**Type placement.** A single-use type stays **in the module's file**. Promote it to a shared `src/types/*` only when a **second** module imports it — the second importer is the trigger. (`sanity.types.ts` and the `keys.ts` contracts are the existing shared shapes; don't hand-edit the generated one, the TypeScript section.)

**One file, one concern.** One component per file, with its `*.module.css` and `*.test.tsx` co-located beside it (see [`./testing.md`](./testing.md)). Avoid broad **barrel** `index.ts` re-exports — they defeat the per-project code-splitting the literal dynamic imports depend on; the only `index.ts` files are registry entries (a project module's own `src/projects/<slug>/index.ts`).

**`app/` is routing only.** Route files (`page` / `layout` / `loading` / `error`) stay thin and **mount** components from `src/`; business logic never lives in `app/` ([`./orientation.md`](./orientation.md)).

**Naming.** Components and their files PascalCase (`ProjectScope.tsx`); non-component modules camelCase (`breakpoints.ts`, `roster.ts`); slugs, routes, CSS-module selectors and custom properties kebab-case (`--brand-*`); types/interfaces PascalCase. Match the surrounding file when unsure.

**No magic values.** Extract named constants for anything meaningful or used in more than one place — `src/lib/breakpoints.ts` is the model.

**Comments — keep them rare.** Write one only when it explains something today's code can't on its own: a non-obvious _why_, a real gotcha, or a pointer to the relevant architecture.md section that justifies a surprising choice. Don't restate what the code plainly does (a competent reader already sees it), and never leave historical (“used to…”) or aspirational (“…later”) notes — those are rot. Fewer, load-bearing comments read better than many.

---

## 7. Quick reference — Next-16 / React-19 foot-guns

Skim this before writing framework code; **verify each against the bundled doc** in `node_modules/next/dist/docs/`.

- [ ] `cookies()` / `headers()` / `draftMode()` / `params` / `searchParams` are **async** — `await` them.
- [ ] No `export const dynamic` / `force-static` / `experimental.ppr` — **removed**. Static/dynamic is component-level under `cacheComponents`.
- [ ] Uncached data outside `<Suspense>` is a **build error**. `<Suspense>` ≠ "makes it dynamic".
- [ ] `'use cache'` can't read request APIs — pass them as **args** (args = cache key); no functions/class instances/`URL` in args.
- [ ] `middleware.ts` → **`proxy.ts`**, Node runtime only.
- [ ] `<Activity>` keeps recent routes mounted (hidden), so state + DOM **persist** across nav; effects are **not** auto-cleaned.
- [ ] Project lazy-load = **literal** `() => import("@/projects/<slug>")`, never templated.
- [ ] CSS Modules need an explicit **`@layer`** — the unlayered module outranks everything.
- [ ] Engine is **isomorphic**: no `next`/`react`/`react-dom`, no DOM/Node globals, no `server-only`/`client-only`.
- [ ] Only `NEXT_PUBLIC_*` env vars reach the client; Context is Server-Component-unavailable.
- [ ] After a Studio schema change, run `pnpm --filter studio typegen` and commit `sanity.types.ts` (CI `git diff`-gates it).

---

## Related handbook docs

- [`./git-and-pr-workflow.md`](./git-and-pr-workflow.md) — branches, commits, the CI gate
- [`./definition-of-done.md`](./definition-of-done.md) — the full pre-push checklist
- [`./testing.md`](./testing.md) — Vitest/RTL, dual-env engine tests, Playwright
- [`./accessibility-and-performance.md`](./accessibility-and-performance.md) — contrast engine, focus, CWV
- [`./security-and-ops.md`](./security-and-ops.md) — secrets, Sanity tokens, Vercel ops
- [`./architecture.md`](./architecture.md) · [GitHub issues](https://github.com/jamierthompson/digital-garden/issues)
