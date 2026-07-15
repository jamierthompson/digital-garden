# Digital Garden

A personal portfolio and digital garden — a place to grow notes, ideas, and work
over time. Every page is themed from an authored seed: a perceptual OKLCH
engine derives the page's palette from its seed color and paints the whole
page, chrome included, while the editorial type — Space Grotesk headings,
Source Serif 4 body, Geist Mono — stays constant from page to page. An entry's
theme fonts theme only its own bounded interactive slot. Content and theme
seeds live in Sanity; the site renders on Next.js.

> **Status:** the shared foundation — the OKLCH theming engine (`@garden/oklch`) and the
> `@garden/type` type-scale engine — plus the Sanity content model and the real garden entries
> are **live on Vercel**, with the editorial garden shell, an RSS feed, and Sanity draft mode +
> live preview wired to publish→production revalidation. The interactive **Color Engine** demo
> (`src/entries/color-engine/`) is a registered stub pending a rebuild on the new foundation as a
> multi-page demo (#149); the `@garden/oklch` engine it showcases is untouched. Remaining
> work is tracked in [GitHub issues](https://github.com/jamierthompson/digital-garden/issues).

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
- **Package manager:** [pnpm](https://pnpm.io/) (workspace: the Next app, the Studio, and the `@garden/oklch` + `@garden/type` engines)

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
pnpm dev                     # Next app at http://localhost:3000
pnpm build                   # production build
pnpm test                    # run the test suite once
pnpm lint                    # ESLint (incl. architectural import boundaries)
pnpm format                  # Prettier write
pnpm --filter studio typegen # regenerate sanity.types.ts from the schema
```

The **full pre-push gate** — every lint/typecheck/test/build step, in the order CI runs them — is
the one command in [`docs/definition-of-done.md`](./docs/definition-of-done.md); CI runs the same
chain on every PR.

## Styling approach

CSS custom properties + CSS Modules, organized with `@layer`. Tokens are two tiers —
**foundation** primitives → **semantic** role tokens (the public contract components read) —
plus a per-page **theme**: the `@garden/oklch` engine re-binds the semantic values from the
page's authored seed, baked flash-free into the initial HTML. The seed color paints the entire
page (nav and footer included); an entry's theme fonts theme only its own bounded slot, with no
slug-prefixed token names (the `[data-entry]` scope provides the isolation).

The full model — the layer order, the "@layer trap", scope-based isolation, and the token
contract — is in [`docs/architecture.md`](./docs/architecture.md) (_Token & theming architecture_).

## Project structure

The Next app lives in `src/` — App Router routes in `src/app/`, self-contained entry modules in
`src/entries/<slug>/`, shared UI in `src/components/`, and the design-system CSS in `src/styles/`.
The `@garden/oklch` (color) and `@garden/type` (type-scale) engines are each their own
`packages/*` workspace package (the app **and** the Studio can depend on them); the Sanity Studio
is a standalone package in `studio/`.

Each entry module owns its single `/[slug]` page (editorial article + interactive slot), its
scoped tokens, and the slot components its essay mounts. A typed reference-by-key resolver maps a Sanity
`componentKey` to a literal dynamic import, and dependencies point **entry modules → shared, never
back** (lint-enforced).

The annotated repo map is in [`docs/orientation.md`](./docs/orientation.md) (_Repo map_); the
entry-module contract and composition model are in
[`docs/architecture.md`](./docs/architecture.md) (_Entry modules_).

## Contributing & license

This is a personal portfolio, not an open-source project. You're welcome to read the code and
[open an issue](https://github.com/jamierthompson/digital-garden/issues), but please don't send
unsolicited pull requests — see [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the (solo + AI-agent)
workflow. The code and content are **source-available, not licensed for reuse** — see
[`LICENSE`](./LICENSE).
