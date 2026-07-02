# Digital Garden

A personal portfolio and digital garden — a place to grow notes, ideas, and work
over time. The whole site shares one editorial look — Newsreader and a
black/white/gray neutral ramp — across all page chrome. Each project's brand
color (a perceptual OKLCH palette) and font theme only its own bounded
interactive slot, on that shared foundation. Content and brand seeds live in
Sanity; the site renders on Next.js.

> **Status:** the shared foundation, the OKLCH theming engine (`@garden/oklch`), the Sanity
> content model, and mock projects are **live on Vercel** — with the editorial
> garden shell, an RSS feed, and Sanity draft mode + live preview wired to publish→production
> revalidation. Remaining work is tracked in
> [GitHub issues](https://github.com/jamierthompson/digital-garden/issues).

The engineering docs live in [`docs/`](./docs/) (start at
[`orientation.md`](./docs/orientation.md)); the system model is
[`docs/architecture.md`](./docs/architecture.md). The docs are the current
source of truth — edited in place, with git history as the audit trail.

## Tech stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, Turbopack, Cache
  Components) + React 19
- **Language:** TypeScript
- **Styling:** CSS custom properties + CSS Modules, organized with `@layer`
- **Content:** [Sanity](https://www.sanity.io/) — a standalone Studio in
  [`studio/`](./studio), with typed GROQ via Sanity TypeGen
- **Testing:** [Vitest](https://vitest.dev/) + React Testing Library
- **Linting/formatting:** ESLint (`eslint-config-next` + `eslint-plugin-boundaries`)
  - Prettier
- **Hosting:** [Vercel](https://vercel.com/)
- **Package manager:** [pnpm](https://pnpm.io/) (workspace: the Next app, the Studio, and the `@garden/oklch` engine)

## Getting started

```bash
pnpm install                 # install all workspace packages
cp .env.example .env.local   # then fill in the Sanity values
pnpm dev                     # Next app at http://localhost:3000
pnpm --filter studio dev     # Sanity Studio at http://localhost:3333
```

`.env.local` needs the (public) Sanity project values, plus the site origin and — for draft
mode, live preview, and revalidation — three **secrets**. See [`.env.example`](./.env.example)
for the annotated list:

```bash
# Public — shipped to the browser
NEXT_PUBLIC_SITE_URL=http://localhost:3000          # absolute URLs in the RSS feed
NEXT_PUBLIC_SANITY_PROJECT_ID=your-project-id
NEXT_PUBLIC_SANITY_DATASET=production
NEXT_PUBLIC_SANITY_API_VERSION=2026-06-21
NEXT_PUBLIC_SANITY_STUDIO_URL=http://localhost:3333 # Visual Editing click-to-edit deep links

# Secrets — server-side only, NEVER NEXT_PUBLIC_*
SANITY_API_READ_TOKEN=your-read-token               # grants draft reads (server-side, per request)
SANITY_API_BROWSER_TOKEN=your-browser-viewer-token  # dedicated minimal Viewer token for <SanityLive>;
                                                    # next-sanity exposes it to the browser EventSource
SANITY_REVALIDATE_SECRET=your-webhook-secret        # HMAC secret for the /api/revalidate webhook
```

In production, set all of these in Vercel per-environment, add the deploy URL to the Sanity
project's CORS origins (**with credentials**, for the `<SanityLive>` EventSource), and register a
Sanity webhook → `/api/revalidate` carrying the same `SANITY_REVALIDATE_SECRET`.

### Scripts

```bash
pnpm build                   # production build
pnpm lint                    # ESLint (incl. architectural import boundaries)
pnpm lint:css                # assert every CSS Module declares its @layer
pnpm lint:keys               # key-drift guard
pnpm lint:docs               # gate-chain sync (DoD one command = ci.yml) + markdown link/anchor check
pnpm typecheck               # tsc --noEmit
pnpm test                    # run the test suite once
pnpm format / format:check   # Prettier write / check
pnpm --filter studio typegen # regenerate sanity.types.ts from the schema
```

CI runs all of the above (plus a TypeGen drift check) on every PR.

## Styling approach

- **Foundation** (`src/app/foundation.css`, global `:root`) — the raw primitives + the reset:
  the neutral ramp, Newsreader, spacing, type scale, motion, z-index, focus-ring geometry,
  breakpoint constants. Loaded first, and it declares the `@layer foundation, semantic, brand, project;` order.
- **Semantic** (global `:root`) — the generic role tokens components read (`--surface`, `--text`,
  `--accent`, `--font-face`, `--space-*`, …), mapped from the primitives. Their editorial default
  mapping **is** the site's global look; this layer is the public token contract.
- **Brand** (project-slot scope, engine-driven) — a full scoped override of the semantic tokens for
  one slot (color, font, and anything else it differs on), baked flash-free by `ProjectScope` from
  the `@garden/oklch` engine. No project-prefixed token names — the `[data-project]` scope provides
  isolation, so components everywhere read the same generic semantic names.

Every CSS Module wraps its rules in an `@layer` (lint-enforced), because Next does
not auto-layer modules and an unlayered one would silently outrank layered styles.

## Project structure

```
src/
  app/                  # App Router: routes, layouts, global styles
    layout.tsx          # root layout — editorial shell (ProjectScope slug="garden") + nav
    page.tsx            # home — the featured front door (branded cards of featuredRank entries)
    browse/             # the Index — one browsable list of every entry (folds the old work + notes)
    now/                # the /now stream (Sanity-driven, kind == "now"); about/ — editorial pages
    [slug]/             # flat root-level entry route, any kind (+ not-found/loading states)
    api/draft-mode/     # draft-mode enable/disable route handlers
    api/revalidate/     # signed Sanity webhook → revalidateTag (publish→prod)
    rss.xml/            # RSS feed route handler
    foundation.css      # foundation primitives + semantic editorial defaults + @layer order + reset
  projects/             # self-contained project modules (e.g. first-light/)
  embeds/               # shared in-essay embed components (key → component)
  components/           # project-scope (keystone), portable-text serializer, shell nav
  fonts/roster.ts       # curated next/font faces, one per key
  lib/                  # keys.ts (key contracts), resolvers/, cardSwatches.ts, breakpoints.ts
  sanity/lib/           # Sanity client + defineLive (live.ts) + stega + env + typed GROQ queries
packages/
  oklch/                # @garden/oklch engine — pure, isomorphic; app + studio depend on it
studio/                 # standalone Sanity Studio (pnpm workspace package)
scripts/                # CI guardrail scripts (@layer lint, key-drift, doc-gate-sync)
sanity.types.ts         # generated by Sanity TypeGen
tests/                  # shared Vitest setup/infra; suites co-locate beside their subject
docs/                   # handbook (incl. architecture.md, the system model)
```

Each project under `src/projects/<slug>/` is a self-contained module — its pages, its
interactive experience, scoped tokens. A thin route file at the flat root-level `/[slug]` mounts
it, and a typed reference-by-key resolver maps a Sanity `componentKey` to a literal dynamic import.
Dependencies point **projects → shared, never back** (lint-enforced). The OKLCH engine
lives in its own `packages/oklch` workspace package (`@garden/oklch`), so the standalone
Studio can import it too.

## Contributing & license

This is a personal portfolio, not an open-source project. You're welcome to read the code and
[open an issue](https://github.com/jamierthompson/digital-garden/issues), but please don't send
unsolicited pull requests — see [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the (solo + AI-agent)
workflow. The code and content are **source-available, not licensed for reuse** — see
[`LICENSE`](./LICENSE).
