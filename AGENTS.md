<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# AGENTS.md — Digital Garden

> A personal portfolio + digital garden: one editorial foundation (Newsreader + a neutral
> ramp) themes all page chrome, while each project's OKLCH brand color + font theme only its
> own bounded interactive slot. Next.js 16 / React 19 on Vercel; content in Sanity.

This file is the agent-facing entry point per the [AGENTS.md convention](https://agents.md/)
(an open, Linux Foundation–governed format — Markdown, no required fields, **nearest file
wins**). It complements `README.md` (humans); this is for **you, the agent**. Keep the managed
`nextjs-agent-rules` block above untouched — `create-next-app` regenerates it.

**This is a short index — the non-negotiable guardrails inline, everything else by pointer.** The
full operating manual is [`docs/`](./docs/) — **start at [`orientation.md`](./docs/orientation.md)**.
The system model is [`docs/architecture.md`](./docs/architecture.md) (refer to
its sections by name); the work backlog is [GitHub issues](https://github.com/jamierthompson/digital-garden/issues).
The docs are the current source of truth — there is no separate decision log; they are edited in
place and git history is the audit trail.

## The one rule that overrides your memory

**Verify, then write — never trust stale memory.** This repo is Next.js 16 / React 19 (exact pins
in `package.json`); your training data is wrong here often enough to be dangerous.

- **Capabilities** → before hand-rolling, prefer an installed skill / subagent / MCP tool — the
  ones you need are likely already there and authed; if not, ask. Full ladder: the cite-don't-remember section of [`docs/working-with-agents.md`](./docs/working-with-agents.md).
- **Framework behavior** → read the version-exact bundled docs at `node_modules/next/dist/docs/`
  before writing framework code.
- **Project rules & system model** → the handbook docs, above all
  [`docs/architecture.md`](./docs/architecture.md) (refer to its sections by
  name). They are the current truth, edited in place; git history is the audit trail.
- **External standards** (Conventional Commits, WCAG/APCA, this AGENTS.md convention) → cite the
  standard with a URL. **Cite the source that actually contains the fact** — accuracy over confidence.

## Non-negotiable guardrails

These silently break *this* stack. Most are lint/CI-enforced; know them so you don't fight the tools.

- **Never commit to `main`.** Branch first (`feat/…`, `fix/…`, `chore/…`); merge = production
  deploy on Vercel. Each agent ships a **complete, gate-green slice** it owns; the lead curates
  history (rebase onto `main`; optionally squash/reorder a messy branch) and **merge-commits** it
  (the default) — the branch's commits survive on `main` alongside the PR body. Gate green at every
  slice handoff and on the curated tip; delete the branch.
- **Every slice clears independent, adversarial QA before the PR.** Gate-green is
  _developer-done_, not _review-done_: a **fresh** agent with **no prior context of the work** (not
  merely "not the author") **tries to break** the
  slice and writes the missing test cases a product-team QA engineer would, the owning author fixes,
  QA re-checks. This holds on **every** session — solo (lead is also author → one QA) or team (one QA per
  coding agent). The lead owns the loop (see the dev↔QA loop in [`docs/working-with-agents.md`](./docs/working-with-agents.md)).
- **Every CSS Module declares its `@layer`** (`foundation|brand|project`) or stays strictly
  var-consuming. An unlayered module outranks **every** `@layer` style — the "@layer trap".
  Enforced by `pnpm lint:css`.
- **The OKLCH engine stays isomorphic** — never add `server-only` / `client-only` to the engine package (`packages/oklch/`, imported as `@garden/oklch`).
- **Literal dynamic imports only:** `() => import("@/projects/<slug>")` per key — never a templated
  `import(\`…/${slug}\`)` (defeats bundler static analysis).
- **pnpm only** — never npm/yarn; `pnpm dlx`, not `npx`. Commit `pnpm-lock.yaml` on dep changes.
- **Request APIs are async** (`cookies()`/`headers()`/`params`/`searchParams` are `await`-able);
  `export const dynamic` is removed under Cache Components; `middleware.ts` is `proxy.ts`. Verify in the bundled docs.

## Pre-flight checks (the gate)

Run the full gate locally before pushing. The one copy-paste command lives in
[the one command in `definition-of-done.md`](./docs/definition-of-done.md#1-the-one-command); CI runs the
same chain ([`ci.yml`](./.github/workflows/ci.yml), job `verify`), and `pnpm lint:docs` keeps the two
in sync. Green locally = green CI.

Fix formatting with `pnpm format` (never by hand). After **any** Studio schema change, commit the
regenerated `sanity.types.ts` (root-anchored) — the easiest gate to trip.

## Nested context

The Studio is a separate workspace package (`studio/`) with its own concerns — Sanity schema,
TypeGen, stega. If Studio-specific agent rules become worth writing down, add a `studio/AGENTS.md`:
the convention is **nearest file wins**, so it would take precedence for agents working there.
