# Engineering Standards

The coding conventions an agent applies in this repo. This is _how we write code_, not _what the system is_ — for the system model read [`./architecture.md`](./architecture.md).

**One rule above all others — the framework is not the one you remember.** This is Next.js **16** + React **19** with Cache Components enabled app-wide. Request APIs are async, `middleware.ts` is gone, `export const dynamic` is removed. Before you write any framework code, **read the version-matched doc** in `node_modules/next/dist/docs/` ([`../AGENTS.md`](../AGENTS.md) says the same). Don't code from training-data memory — it is stale here.

Most of what follows is **machine-enforced** (`pnpm lint · lint:css · lint:routes · lint:keys · lint:docs · format:check · typecheck · test`, all gated in CI — see [`./git-and-pr-workflow.md`](./git-and-pr-workflow.md) and [`./definition-of-done.md`](./definition-of-done.md)). Where a rule has a checker, this doc tells you the _intent_ so you stop fighting the tool.

---

## 1. TypeScript

| Rule                      | Do                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Why / source                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No `any`**              | Use `unknown`, then narrow.                                                                                                                                                                                                                                                                                                                                                                                                                                         | `strict: true` in `tsconfig.json`. `any` disables the checker that catches the `themeColor`-500 class of bug.                                                                   |
| **Type params + returns** | Annotate every function signature explicitly.                                                                                                                                                                                                                                                                                                                                                                                                                       | Don't rely on inference at module boundaries — see `tokens.ts` `space(step: SpaceStep): string`.                                                                                |
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

**Code-splitting entry modules uses LITERAL dynamic imports:**

```ts
// ✅ statically analyzable — bundler can split per slug
const load = () => import("@/entries/color-engine");
// ❌ templated — defeats static analysis, breaks the split
const load = () => import(`@/entries/${slug}`);
```

`ssr: false` is **Client-Component-only** — passing it from a Server Component is an error (`…/02-guides/lazy-loading.md`).

**Do NOT put `server-only` / `client-only` on the engine packages** (`@garden/oklch`, `@garden/type`). Those pin a module to one side and break the isomorphism requirement (see the Import boundaries section). This is lint-enforced.

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

**This is the load-bearing pattern for theming:** the route awaits the entry fetch (the `theme` seeds arrive as plain values), then renders `PageTheme` and the slot's `EntryScope` **synchronously** — neither reads a request API nor awaits anything, so the page's theme `<style>`, each resolved face's `.variable` class, and the slot's inline role-token overrides all land in the **initial static HTML** (flash-free) with no `'use cache'` boundary of their own.

**Routing fact that bites:** `middleware.ts` is renamed **`proxy.ts`**, **Node runtime only** — setting `runtime` throws (`…/03-file-conventions/proxy.md`).

> **State across navigation:** with Cache Components, Next keeps recently-visited routes in the DOM (hidden via `display: none`, up to 3) instead of unmounting them, so React state and DOM state are **preserved** across back/forward nav. Effects are **not** auto-cleaned — if you need a transient bit of UI to reset, do it yourself in a `useLayoutEffect` cleanup. Don't assume a route remounts on navigation. See `…/02-guides/preserving-ui-state.md`.

---

## 4. CSS — custom properties, CSS Modules, and the `@layer` discipline

**No Tailwind. No JSON tokens. No Style Dictionary.** Styling is CSS custom properties + CSS Modules organized with `@layer`.

**Tokens are three layers** (the deep treatment is architecture.md's Token & theming architecture section — the layer names below are what you need to apply the `@layer` rule):

1. **Foundation** (primitives: spacing, radius, border-width, control sizes, motion, z-index, type-scale — raw value scales; there is **no** separate "feel/geometry" tier) → global `:root` in `src/styles/foundation/*` (one file per family), with the base reset in `src/styles/reset.css`.
2. **Semantic** (generic role tokens components actually read) → the layer components consume; a role that needs a geometry primitive binds it here, exactly as the spacing roles alias `--space-*`.
3. **Theme** → a project **slot**'s full scoped override of the semantic layer — engine-scoped to the `[data-entry]` wrapper, emitted by the OKLCH engine; page chrome stays on the global editorial foundation.

Components read **generic semantic tokens** — `--surface`, `--foreground`, `--accent`, … `--font-body`, `--space-*`. There are **no `--<proj>-*` per-entry prefixed token names**: the `[data-entry]` scope provides the isolation, so a slot overrides the same generic names the rest of the app reads.

### Color tokens are immutable — never mix or fade one

A semantic **color** token is a **solved value**: the OKLCH engine derives it contrast-solved against a mapped background per color scheme. Deriving a new color from it silently breaks the contrast it was solved for — a muted foreground built as `color-mix(in oklab, var(--foreground) 65%, transparent)` no longer clears its ratio. Three forms are all the same sin:

1. **color-mix** — `color-mix(… var(--token) …)`
2. **slash-alpha** — `var(--token) / <alpha>`
3. **relative color** — `oklch(from var(--token) …)` (or any `oklab`/`lab`/`lch`/`rgb`/`hsl`/`hwb`/`color()` relative form)

> **Never `color-mix()`, slash-alpha, or relative-color-derive a color token.** When you need a lower-emphasis or tinted role, read the **designed token for it** — `--muted-foreground`, `--muted`, `--accent-subtle`, a `*-subtle` status family — not a mutation of a stronger one. Derivation belongs in the OKLCH engine (`packages/oklch`), not component CSS. If no designed token fits, that's a gap to fill in the semantic contract (`src/styles/semantic/color.css`), not to paper over.

Enforced by `pnpm lint:color` (`scripts/check-color-immutability.mjs`, a CI gate): the color-token set is derived from the `--name:` declarations in `src/styles/semantic/color.css`, so the guard targets **only** color tokens. Any of the three forms on `currentColor` or on a non-color var (`--space-*`, a border-width) is exempt — those aren't solved colors.

### The `@layer` trap — read this

**Next does NOT auto-assign CSS Modules to a cascade layer.** Per the CSS cascade-layers spec (CSS Cascading and Inheritance Level 5; see MDN "Cascade layers"), an **unlayered** declaration **outranks every `@layer` style** regardless of specificity — and Next leaves Modules unlayered. So:

> **Every `*.module.css` MUST wrap its rules in `@layer components` — or stay strictly var-consuming (no bare rules).**

This is enforced by `pnpm lint:css` (`scripts/check-css-layers.mjs`, a CI gate): any rule outside an `@layer` block fails the build. The cascade collapses to two layers named for their jobs — `base` (the reset + the foundation/semantic token tiers, loses) and `components` (CSS Modules, wins). Layer order is declared once, first, in `src/styles/layers.css` (imported before every other sheet):

```css
@layer base, components; /* base < components */
```

An entry's theme fonts (up to three optional faces) scope to its own slot via inline role-token overrides on `[data-entry]` (`EntryScope`), not a cascade layer — an unset role inherits `:root`; its color is the page's `<html>` theme, inherited. Note: Next's own CSS doc (`…/01-getting-started/11-css.md`) covers only import-order chunking — it never assigns Modules to a layer, which is exactly the gap this rule closes.

### Other CSS rules

| Rule                                     | Detail                                                                                                                                                                                                                                                                                                                                                    | Source                                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Responsive is container-query-first**  | No shared breakpoint layer. Prefer intrinsic (`auto-fit`/`minmax`, `flex-wrap`, `clamp()`) → container queries (`container-type: inline-size` + `@container`) for a component's own context → viewport `@media` with a literal query only for genuine page chrome. CSS variables are invalid inside `@media` conditions, so there is nothing to tokenize. | —                                                                              |
| **Focus ring**                           | Geometry (width/offset/style, `:focus-visible` policy) is global in `src/styles/foundation/focus.css` (+ the `:focus-visible` rule in `reset.css`); ring **color** is an engine token per slot. Use `:focus-visible`, never bare `outline: none`.                                                                                                         | see [`./accessibility-and-performance.md`](./accessibility-and-performance.md) |
| **Streamed `<style>`**                   | Plain inline `<style>` is fine when `EntryScope` renders above any Suspense (the common case). Use React 19 `<style href={\`entry-theme-${slug}\`} precedence>`only if`EntryScope` can suspend.                                                                                                                                                           | —                                                                              |
| **Stega off the entry's `theme` object** | Sanity stega injects invisible chars that break the OKLCH parse and font lookup — disable it on the whole `theme` object (by ancestor) and `componentKey`.                                                                                                                                                                                                | —                                                                              |

---

## 5. Import boundaries (ESLint `eslint-plugin-boundaries`)

`eslint.config.mjs` defines four element types over `src/**` and enforces directional dependencies via `pnpm lint` (CI-gated). The directories are stood up empty so the rules can't rot before code arrives. **First match wins**, so specific patterns precede the `shared` catch-all. The table is the _intent_; `eslint.config.mjs` is the source of truth for the exact lint message you'll see when one fails. (The OKLCH engine is not a `boundaries` element — it lives in its own workspace package; its isomorphism guard lives in a dedicated block, see below.)

| Rule                    | Meaning                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `entry` ⇏ other `entry` | An entry module **cannot import another entry module** (matched by captured `slug`) — lift shared code into a shared module instead. |
| `shared` ⇏ `entry`      | Dependencies point **from entry modules to shared, never back**.                                                                     |

**The engine packages (`packages/oklch/**`—`@garden/oklch`, color; and `packages/type/**`—`@garden/type`, type-scale) are isomorphic**— each must run identically in Node and the browser. They live in their own packages precisely so the standalone Studio can import them too; the guard is a dedicated `eslint.config.mjs`block on`packages/{oklch,type}/**`(not a`boundaries`element — that plugin is`src/**`-scoped). Two guards:

1. **No framework imports** — `no-restricted-imports` forbids `next`/`next/*`, `react`, `react-dom`/`react-dom/*`, and **`server-only`/`client-only`** (those break it; see the React section).
2. **No DOM/Node globals** — `no-restricted-globals` forbids `window`/`document`/`process`/`Buffer`/… inside `packages/{oklch,type}/**` (full list in `eslint.config.mjs`). Imports can't catch ambient globals, so this rule does.

The contract is also test-enforced: the engine suite runs under **both** `node` and `jsdom` Vitest environments (see [`./testing.md`](./testing.md)).

`studio/**` and `sanity.types.ts` are out of scope for the app's ESLint config (the standalone Studio has its own; the types file is generated).

---

## 6. Code organization & separation of concerns

House rule: **establish the pattern early, instantiate it late** (the deferral discipline). Name where each kind of code _will_ live, but don't stand up the structure until a concrete trigger earns it — a genuine second use or an actual prop-drill. "I'll need it later" is not a trigger. Each rule below pairs with the **trigger** that says it's time — none of this is built pre-emptively.

| Concern                                             | Where it lives                                                                                                  | Instantiate when…                                                                                                                  |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Pure logic / utilities (no React, no I/O)           | `src/lib/*` (`cardSwatches`, `scheme`, resolvers); the `@garden/oklch` + `@garden/type` engines in `packages/*` | always — logic stays out of components                                                                                             |
| Data fetching / external I/O (the "services" layer) | `src/sanity/lib/*`                                                                                              | a new external source appears. **No generic `services/`** — RSCs fetch directly and `sanity/lib` is the I/O home                   |
| Interaction logic / state (reducers, machines)      | a hook beside the component, or a headless `core/`                                                              | a component's logic outgrows its render — extract a `core/` **then**, not by template (architecture.md's interactive slot section) |
| Presentation                                        | the component, reading **tokens + props**                                                                       | —                                                                                                                                  |

**Separation of concerns.** A component renders; it does not _also_ own a reducer, derive data, and fetch. Keep those concerns separable even before you split them — when logic starts to crowd render, lift it into a hook / `core/` and feed the component tokens and props. This is architecture.md's interactive slot section's headless-core idea applied everywhere, not only to a slot.

**State at the lowest common owner.** Client state starts as local `useState` in the leaf Client Component (`'use client'` as low as possible, the React section). **Trigger to lift:** the moment you're prop-drilling — threading one value through 2+ components that don't themselves use it — raise it to the lowest common parent, or introduce Context / a small store _at that point_, never pre-emptively. Most "state" here is server data (RSC + cookies + `'use cache'`, the Cache Components section); a client store is only for genuinely client-only state shared across a subtree.

**Type placement.** A single-use type stays **in the module's file**. Promote it to a shared `src/types/*` only when a **second** module imports it — the second importer is the trigger. (`sanity.types.ts` and the `keys.ts` contracts are the existing shared shapes; don't hand-edit the generated one, the TypeScript section.)

**One file, one concern.** One component per file, with its `*.module.css` and `*.test.tsx` co-located beside it (see [`./testing.md`](./testing.md)). Avoid broad **barrel** `index.ts` re-exports — they defeat the per-entry code-splitting the literal dynamic imports depend on; the only `index.ts` files are registry entries (an entry module's own `src/entries/<slug>/index.ts`).

**`app/` is routing only.** Route files (`page` / `layout` / `loading` / `error`) stay thin and **mount** components from `src/`; business logic never lives in `app/` ([`./orientation.md`](./orientation.md)).

**Naming.** Components and their files PascalCase (`EntryScope.tsx`); non-component modules camelCase (`scheme.ts`, `roster.ts`); slugs, routes, CSS-module selectors and custom properties kebab-case (`--surface`, `--accent-text`); types/interfaces PascalCase. Match the surrounding file when unsure.

**No magic values.** Extract named constants for anything meaningful or used in more than one place — `src/lib/keys.ts` is the model.

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
- [ ] Project lazy-load = **literal** `() => import("@/entries/<slug>")`, never templated.
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
