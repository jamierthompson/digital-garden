# Digital Garden

A personal portfolio and digital garden — a place to grow notes, ideas, and work
over time. Each project is a self-contained, independently themed module: its own
brand color (a perceptual OKLCH palette) and font, composed on a shared invariant
foundation. Content and brand seeds live in Sanity; the site renders on Next.js.

> Status: **Phases 0–3 complete** — scaffolding + guardrails (Ph0), the walking
> skeleton (Ph0.5), the OKLCH theming engine + real `ProjectScope` (Ph1), the Sanity
> content model with reference-by-key wiring and engine-backed `brandColor` validation
> (Ph2), and the **first vertical slice** (Ph3) are all in place. Phase 3 drives one
> dead-simple project (`first-light`) end-to-end through the keystone — `/work` index +
> themed `/work/<slug>` route, error/not-found/loading states, metadata — alongside the
> themed garden shell (home / about / now / notes), an RSS feed, and the Sanity
> draft-mode + Visual Editing plumbing. **Next: Phase 4** — the OKLCH-engine showcase and
> the `log-explorer` migration. See [`docs/`](./docs) for the architecture plan, build
> phases, decision log, and per-run records ([`docs/runs/`](./docs/runs)).

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
- **Package manager:** [pnpm](https://pnpm.io/) (workspace: the Next app + the Studio)

## Getting started

```bash
pnpm install                 # install both workspace packages (app + studio)
cp .env.example .env.local   # then fill in the Sanity values
pnpm dev                     # Next app at http://localhost:3000
pnpm --filter studio dev     # Sanity Studio at http://localhost:3333
```

`.env.local` needs the (public) Sanity project values, plus the site origin and — only
once you use draft mode / Visual Editing — a **secret** read token. See
[`.env.example`](./.env.example) for the annotated list:

```bash
# Public — shipped to the browser
NEXT_PUBLIC_SITE_URL=http://localhost:3000          # absolute URLs in the RSS feed
NEXT_PUBLIC_SANITY_PROJECT_ID=your-project-id
NEXT_PUBLIC_SANITY_DATASET=production
NEXT_PUBLIC_SANITY_API_VERSION=2026-06-21
NEXT_PUBLIC_SANITY_STUDIO_URL=http://localhost:3333 # Visual Editing click-to-edit deep links

# SECRET — server-side only, NEVER NEXT_PUBLIC_*; grants draft reads
SANITY_API_READ_TOKEN=your-read-token
```

In production, set these in Vercel per-environment and add the deploy URL to the Sanity
project's CORS origins before Preview / Visual Editing will work.

### Scripts

```bash
pnpm build                   # production build
pnpm lint                    # ESLint (incl. architectural import boundaries)
pnpm lint:css                # assert every CSS Module declares its @layer
pnpm lint:keys               # key-drift guard (live since Phase 2)
pnpm lint:docs               # assert the gate chain matches across AGENTS.md, DoD, ci.yml
pnpm typecheck               # tsc --noEmit
pnpm test                    # run the test suite once
pnpm format / format:check   # Prettier write / check
pnpm --filter studio typegen # regenerate sanity.types.ts from the schema
```

CI runs all of the above (plus a TypeGen drift check) on every PR.

## Styling approach

Three tiers, so only what actually varies per project is scoped:

- **Invariant foundation** (`src/app/foundation.css`, global `:root`) — spacing,
  type scale, motion, z-index, focus-ring geometry, the reset. Loaded first, and it
  declares the `@layer foundation, brand, project;` order.
- **Brand + font** (per-project scope, engine-driven) — the OKLCH color ramp and the
  resolved font face, baked flash-free by `ProjectScope` from the `@garden/oklch` engine.
- **Feel/geometry** (per-project scope override) — radius, border weight, etc.

Every CSS Module wraps its rules in an `@layer` (lint-enforced), because Next does
not auto-layer modules and an unlayered one would silently outrank layered styles.

## Project structure

```
src/
  app/                  # App Router: routes, layouts, global styles
    layout.tsx          # root layout — themed garden shell (ProjectScope slug="garden") + nav
    page.tsx            # home; about/ now/ notes/ — themed shell pages
    work/               # /work index (swatch cards) + /work/[slug] project route (+ states)
    api/draft-mode/     # draft-mode enable/disable route handlers
    rss.xml/            # RSS feed route handler
    foundation.css      # invariant :root tier + @layer order + reset
  projects/             # self-contained project modules (e.g. first-light/) [§4.1]
  embeds/               # shared in-essay embed components (key → component)
  components/           # project-scope (keystone), portable-text serializer, shell nav
  fonts/roster.ts       # curated next/font faces, one per key
  lib/                  # keys.ts (key contracts), resolvers/, cardSwatches.ts, breakpoints.ts
  sanity/lib/           # Sanity client(s) + env + typed GROQ queries
packages/
  oklch/                # @garden/oklch engine — pure, isomorphic; app + studio depend on it
studio/                 # standalone Sanity Studio (pnpm workspace package)
scripts/                # CI guardrail scripts (@layer lint, key-drift, doc-gate-sync)
sanity.types.ts         # generated by Sanity TypeGen
tests/                  # Vitest + Testing Library
docs/                   # architecture plan, build phases, decisions, audit, run records
```

Each project under `src/projects/<slug>/` is a self-contained module — its pages, its
interactive experience, scoped tokens. A thin route file under `app/work/` mounts it, and
a typed reference-by-key resolver maps a Sanity `componentKey` to a literal dynamic import.
Dependencies point **projects → shared, never back** (lint-enforced). The OKLCH engine
lives in its own `packages/oklch` workspace package (`@garden/oklch`), so the standalone
Studio can import it too.
