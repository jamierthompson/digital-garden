# Digital Garden

A personal portfolio and digital garden — a place to grow notes, ideas, and
work over time. Built with the Next.js App Router and styled with CSS Modules
and CSS custom properties.

## Tech stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router) + React 19
- **Language:** TypeScript
- **Styling:** CSS Modules + CSS custom properties
- **Testing:** [Vitest](https://vitest.dev/) + React Testing Library
- **Linting/formatting:** ESLint (`eslint-config-next`) + Prettier
- **Package manager:** [pnpm](https://pnpm.io/)

## Getting started

```bash
pnpm install      # install dependencies
pnpm dev          # start the dev server at http://localhost:3000
```

### Other scripts

```bash
pnpm build         # production build
pnpm start         # serve the production build
pnpm lint          # run ESLint
pnpm format        # format all files with Prettier
pnpm format:check  # check formatting without writing
pnpm test          # run the test suite once
pnpm test:watch    # run tests in watch mode
```

## Styling approach

Styling is split into two layers:

- **`src/app/globals.css`** — global reset plus CSS custom properties
  (e.g. `--background`, `--foreground`) that act as shared design tokens.
- **`*.module.css`** — component-scoped CSS Modules that consume those
  variables, keeping class names local and styles colocated with components.

## Project structure

```
src/
  app/                # App Router: routes, layouts, global styles
    layout.tsx        # root layout (fonts, metadata)
    page.tsx          # home page
    page.module.css   # home page styles (CSS Module)
    globals.css       # global reset + CSS custom properties
tests/
  setup.ts            # Testing Library matcher registration
  unit/               # unit/component tests
```

Shared folders (`components/`, `lib/`, `services/`, `hooks/`, `types/`) will be
added under `src/` as the app grows.
