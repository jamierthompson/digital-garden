# R1 — Next.js 16 / React 19 footguns for autonomous agents

Research note. Verified against the **bundled** docs at `node_modules/next/dist/docs/`
(Next `16.2.9`, see `node_modules/next/package.json`) and react.dev. Every non-obvious
claim is cited with a bundled-doc path or a URL. Do **not** trust model memory for any of
these — they are exactly the APIs that changed in Next 16 / React 19.

Stack ground truth: Next 16.2.9, App Router, Turbopack default, **`cacheComponents: true`
app-wide** [D11], React 19, CSS Modules + custom properties organized with `@layer` (no
Tailwind), Sanity standalone Studio [D23]. Tooling gates (real, from `package.json` +
`.github/workflows/ci.yml`): `pnpm lint` (ESLint + `eslint-plugin-boundaries`),
`lint:css` (`scripts/check-css-layers.mjs`), `lint:keys` (`scripts/check-key-drift.mjs`),
`format:check`, `typecheck`, `test` (Vitest), Sanity `typegen` + `git diff --exit-code`,
`build`.

---

## 1. Request APIs are async

`cookies()`, `headers()`, `draftMode()`, and the route `params` / `searchParams` props are
**async** — you must `await` them.

- "`cookies` is an **async** function" → `const cookieStore = await cookies()`
  (`…/04-functions/cookies.md`).
- `params: Promise<{ id: string }>`; `const { id } = await params`
  (`…/01-getting-started/05-server-and-client-components.md`).

Stale-memory trap: the synchronous `cookies().get(...)` / destructuring `params` directly
no longer works.

## 2. cacheComponents → static/dynamic is COMPONENT-level (PPR)

With `cacheComponents: true`, **data fetching is dynamic by default**; you opt _into_
caching per page/component/function. The route becomes a **prerendered static shell with
dynamic holes** = Partial Prerendering (PPR), now the default
(`…/05-config/01-next-config-js/cacheComponents.md`).

- **`export const dynamic` / `force-static` / `experimental.ppr` are removed** — superseded
  by component-level `use cache` placement [D11] (`cacheComponents.md`: "`experimental.ppr`
  … removed").
- Three render outcomes per component (`…/01-getting-started/08-caching.md`, "How rendering
  works"):
  1. `'use cache'` → result cached, lands in the **static shell**.
  2. Touches a runtime API (cookies/headers/searchParams/params) or does uncached async
     fetch → must be wrapped in **`<Suspense>`**; streams at request time.
  3. Purely deterministic (sync I/O, module imports, pure compute) → auto-prerendered into
     the shell.
- **Hard error if you forget:** uncached data accessed outside `<Suspense>` and outside
  `use cache` throws `Uncached data was accessed outside of <Suspense>` at dev/build
  (`08-caching.md`). This is the build gate, not a warning.
- `<Suspense>` alone does **not** make a component dynamic; it only provides the fallback
  for a hole that is _already_ dynamic (`08-caching.md`).
- Non-deterministic ops (`Math.random()`, `Date.now()`, `crypto.randomUUID()`) require
  either `await connection()` + `<Suspense>` (unique per request) or `'use cache'` (one
  shared value) (`08-caching.md`, "Working with non-deterministic operations").

### `'use cache'` rules (`…/01-directives/use-cache.md`)

- File-, component-, or function-level. File-level → all exports must be **async**.
- **Cannot** call `cookies()`/`headers()`/`searchParams` inside a cached scope (immediate
  error). Read them _outside_ and pass values as **arguments** — args + closed-over vars
  become part of the cache key.
- Cache key = build ID + function ID (location/signature hash) + serialized args.
- Serialization is asymmetric: **arguments** use RSC (Server Component) serialization (no
  class instances, functions, symbols, `URL`); **return values** add JSX. `children`/Server
  Actions allowed **pass-through only** (don't introspect them).
- Defaults: stale 5 min (client), revalidate 15 min (server), never time-expire. Tune with
  `cacheLife('hours')`; invalidate with `cacheTag` + `updateTag`/`revalidateTag`. Client
  router enforces a **30-second minimum stale time** regardless of config.
- Serverless (Vercel) caveat: default in-memory LRU may **not persist** across requests;
  use `'use cache: remote'` for durable shared caching (`use-cache.md`, Runtime caching).
- **Build-hang trap:** passing a runtime Promise (e.g. unawaited `cookies()`) into a
  `use cache` boundary times out after 50s with "Filling a cache during prerender timed
  out…" (`use-cache.md`, Troubleshooting).

This is the framing in [D11]: render `ProjectScope` inside the prerendered shell, `use
cache` keyed on `brandColor`/`fontKey` with `cacheLife('max')` and no request APIs, so the
scoped theme `<style>` and font `.variable` class are in the initial static HTML.

## 3. `<Activity>` preserves state across navigation

With `cacheComponents`, Next uses React's `<Activity>` to keep recently-visited routes
mounted in `mode="hidden"` instead of unmounting (`cacheComponents.md`, "Navigation with
Activity"). In hidden mode: **state + DOM preserved, effects cleaned up** and recreated on
re-show (https://react.dev/reference/react/Activity). Implication: components that assume
mount-on-navigate (dropdowns, dialogs, one-shot effects) behave differently — see the
Preserving UI state guide. Affects test setup too.

## 4. The `@layer` / CSS Modules trap [D12]

**Next does not auto-assign CSS Modules to a cascade layer.** An _unlayered_ module's plain
declarations outrank **every** `@layer` style regardless of specificity (because unlayered
styles always beat layered ones in the cascade). Confirmed by `scripts/check-css-layers.mjs`
header and [D12]; the bundled `…/01-getting-started/11-css.md` documents CSS Modules but
(correctly) makes no auto-layer promise.

House rules:

- Every `*.module.css` must wrap its rules in `@layer foundation | brand | project` — **or**
  stay strictly var-consuming. Lint-enforced by `pnpm lint:css` (fails on any rule outside
  an `@layer` block).
- Declare `@layer foundation, brand, project;` once in a global sheet loaded first; the
  engine's scoped `<style>` declares `@layer brand` [D12].
- CSS ordering otherwise follows **import order** (`11-css.md`, "Ordering and Merging") —
  keep imports in one entry file and don't let ESLint `sort-imports` reorder them.
- **Breakpoints are not `:root` custom properties** [D22] — CSS variables are invalid inside
  `@media` conditions. Use container queries / build-time constants (`src/lib/breakpoints.ts`).

## 5. Literal dynamic imports only [D21]

Project lazy-loading registry values must be **literal** `() => import("@/projects/<slug>")`
per key. A **templated** `import(`…/${slug}`)` defeats bundler static analysis. Bundled doc:
"the path must be explicitly written. It can't be a template string nor a variable… the
`import()` has to be inside the `dynamic()` call" (`…/02-guides/lazy-loading.md`). Note [D21]:
Server Components are auto-code-split already; the manual literal `import()` buys
_conditional inclusion_, and real client-bundle savings come from Client Components inside
each project module. `dynamic(..., { ssr: false })` is **Client-Component-only** — it errors
in a Server Component (`lazy-loading.md`).

## 6. `proxy.ts` replaces `middleware.ts`, Node-only

Middleware is renamed **Proxy** in Next 16 (`…/01-getting-started/16-proxy.md`). One
`proxy.ts` (or `.js`) at project root / `src`, exporting `proxy` (named or default) +
optional `config.matcher`. **Defaults to the Node.js runtime; the `runtime` config option is
not available and throws if set** (`…/03-file-conventions/proxy.md` line 223; version history:
"`v16.0.0` … Proxy defaults to the Node.js runtime"). Not for slow data fetching / full auth;
`fetch` cache/revalidate/tags options have no effect inside Proxy.

## 7. `generateMetadata` (`…/04-functions/generate-metadata.md`)

- **Server Components only**; `params`/`searchParams` are async (`await params`). Can't export
  both `metadata` and `generateMetadata` from one segment. File-based metadata wins over both.
- With `cacheComponents`, it follows the same rules as any component. If it touches runtime
  data (cookies/headers/params/searchParams) while the rest of the page is otherwise fully
  prerenderable, Next **raises an error** demanding an explicit choice. Fix: add `'use cache'`
  inside `generateMetadata` (external-but-not-runtime data), or add a `connection()` "dynamic
  marker" component to the page (genuinely runtime data) (`generate-metadata.md`, "With Cache
  Components"). `generateMetadata`/`generateViewport` track runtime access _separately_ from
  the page body (`08-caching.md`).
- Metadata can **stream** (appended after initial UI) for JS-executing bots; HTML-limited bots
  still block (`generate-metadata.md`, "Streaming metadata").

## 8. React 19 `<style>` precedence [D13]

`<style href="theme-<slug>" precedence>` enables React's automatic head-hoisting,
**de-duplication by `href`**, and **cascade ordering by precedence**
(https://react.dev/reference/react-dom/components/style). Caveats: React ignores prop changes
after first render (dev warning), drops props other than `href`/`precedence`, and may leave
the node in the DOM after unmount. [D13]: use this **only when `ProjectScope` can be
suspended/deferred**; in the common case it renders in the initial shell above any Suspense,
so plain inline `<style>` is already flush-before-paint — precedence is unnecessary there.

## 9. Server vs Client Components (`…/05-server-and-client-components.md`)

- Server is default. `'use client'` marks a **boundary**: the file _and everything it imports_
  joins the client bundle. Server Components passed as `children`/props to a Client Component
  stay on the server (interleaving pattern).
- React **context is not available in Server Components** — wrap providers in a `'use client'`
  component, render it as deep as possible.
- Only `NEXT_PUBLIC_`-prefixed env vars reach the client; others are replaced with empty
  string. **Do not** use the `server-only` / `client-only` packages on the OKLCH engine — they
  pin a module to one side and break its isomorphic requirement [D14]; isomorphism is instead
  enforced by the ESLint boundary on `src/lib/oklch/**` + dual-env Vitest.

---

## Anchors index

| Topic                                                                   | Decision / section | Authoritative source                                      |
| ----------------------------------------------------------------------- | ------------------ | --------------------------------------------------------- |
| cacheComponents app-wide; fonts/preload; component-level static/dynamic | [D11], §5–7        | `cacheComponents.md`, `08-caching.md`                     |
| `@layer` CSS Module rule                                                | [D12], §3.1        | `scripts/check-css-layers.mjs`, `11-css.md`               |
| `<style precedence>` only when suspended                                | [D13], §3.2/§7     | react.dev/reference/react-dom/components/style            |
| OKLCH engine isomorphism (no server-only/client-only)                   | [D14]              | `eslint.config.mjs`, `05-server-and-client-components.md` |
| Literal dynamic import                                                  | [D21], §4.2        | `lazy-loading.md`                                         |
| Breakpoints not in `:root`                                              | [D22], §3.1        | `src/lib/breakpoints.ts`                                  |
| Standalone Studio                                                       | [D23], §6/§7       | —                                                         |
| Async request APIs                                                      | —                  | `cookies.md`, `05-server-and-client-components.md`        |
| Proxy Node-only                                                         | —                  | `16-proxy.md`, `03-file-conventions/proxy.md`             |
| generateMetadata + Cache Components                                     | —                  | `04-functions/generate-metadata.md`                       |
