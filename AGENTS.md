<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# AGENTS.md — Digital Garden

> A personal portfolio + digital garden: each project is a self-contained, independently
> themed module (its own OKLCH brand color + font) composed on a shared invariant foundation.
> Next.js 16 / React 19 on Vercel; content in Sanity.

This file is the agent-facing entry point per the [AGENTS.md convention](https://agents.md/)
(an open, Linux Foundation–governed format — Markdown, no required fields, **nearest file
wins**). It complements `README.md` (humans); this is for **you, the agent**. Keep the managed
`nextjs-agent-rules` block above untouched — `create-next-app` regenerates it.

**This is an index, not a manual.** The real operating manual is
[`docs/handbook/`](./docs/handbook/) — **start at [`orientation.md`](./docs/handbook/orientation.md)**.
Binding decisions are in [`docs/decisions.md`](./docs/decisions.md) (cite as `[D#]`).

## The one rule that overrides your memory

**Verify, then write — never trust stale memory.** This repo is Next.js 16.2.9 / React 19.2.4;
your training data is wrong here often enough to be dangerous.

- **Capabilities** → before hand-rolling, use an installed skill / subagent / MCP tool if one
  fits (`sanity:*`, `vercel:*`, `chrome-devtools` for CWV/a11y). Full ladder: [`docs/handbook/working-with-agents.md`](./docs/handbook/working-with-agents.md) §1.
- **Framework behavior** → read the version-exact bundled docs at `node_modules/next/dist/docs/`
  before writing framework code.
- **Project decisions** → [`docs/decisions.md`](./docs/decisions.md), cited as `[D#]`.
  **System model** → `docs/architecture-plan.md`, cited as `§N`.
- **External standards** (Conventional Commits, WCAG/APCA, this AGENTS.md convention) → cite the
  standard with a URL. **Cite the source that actually contains the fact** — accuracy over confidence.

## Non-negotiable guardrails

These silently break *this* stack. Most are lint/CI-enforced; know them so you don't fight the tools.

- **Never commit to `main`.** Branch first (`feat/…`, `fix/…`, `chore/…`); merge = production
  deploy on Vercel. Each agent ships a **complete, gate-green slice** it owns; the lead curates
  history (rebase/squash/reorder) and **squash-merges** — the story is told once in the
  PR body. Gate green at every slice handoff and on the curated tip; delete the branch.
- **Every slice clears independent, adversarial QA before the PR** `[D26]`. Gate-green is
  _developer-done_, not _review-done_: a **fresh** agent with **no prior context of the work** (not
  merely "not the author" `[D28]`) **tries to break** the
  slice and writes the missing test cases a product-team QA engineer would, the owning author fixes,
  QA re-checks. This holds on **every** session — solo (lead is also author → one QA) or team (one QA per
  coding agent). The lead owns the loop (see [`docs/handbook/working-with-agents.md`](./docs/handbook/working-with-agents.md) §6.2).
- **Every CSS Module declares its `@layer`** (`foundation|brand|project`) or stays strictly
  var-consuming. An unlayered module outranks **every** `@layer` style — the "@layer trap" `[D12]`.
  Enforced by `pnpm lint:css`.
- **The OKLCH engine stays isomorphic** — never add `server-only` / `client-only` to the engine package (`packages/oklch/`, imported as `@garden/oklch`) `[D14]`.
- **Literal dynamic imports only:** `() => import("@/projects/<slug>")` per key — never a templated
  `import(\`…/${slug}\`)` (defeats bundler static analysis) `[D21]`.
- **pnpm only** — never npm/yarn; `pnpm dlx`, not `npx`. Commit `pnpm-lock.yaml` on dep changes.
- **Request APIs are async** (`cookies()`/`headers()`/`params`/`searchParams` are `await`-able);
  `export const dynamic` is removed under Cache Components; `middleware.ts` is `proxy.ts`. Verify in the bundled docs.

## Pre-flight checks (the gate)

Run the full chain locally before pushing — same scripts, same order as
[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) (job `verify`). Green here = green CI.

```bash
pnpm lint && pnpm lint:css && pnpm lint:keys && pnpm lint:docs && pnpm format:check && pnpm typecheck && pnpm test && \
pnpm --filter studio typegen && git diff --exit-code sanity.types.ts && pnpm build
```

Fix formatting with `pnpm format` (never by hand). After **any** Studio schema change, commit the
regenerated `sanity.types.ts` (root-anchored) — the easiest gate to trip `[D23]`. The per-task bar
is [`docs/handbook/definition-of-done.md`](./docs/handbook/definition-of-done.md).

## Nested context

The Studio is a separate workspace package (`studio/`) with its own concerns — Sanity schema,
TypeGen, stega. If Studio-specific agent rules become worth writing down, add a `studio/AGENTS.md`:
the convention is **nearest file wins**, so it would take precedence for agents working there.
