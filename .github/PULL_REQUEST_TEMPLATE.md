<!--
PR title must be Conventional-Commit-shaped: `feat: oklch contrast engine`, `fix(oklch): …`,
`docs: …`. The branch prefix is the same token as the commit type — a `feat/…` branch carries
`feat:` commits (no asymmetry).
This PR SQUASH-MERGES: the title becomes the squash-commit subject and the body below becomes
the squash-commit body on `main`, so this description IS the durable story. Tell it well.
(Lead: curate the branch first — rebase onto main, squash/reorder to a gate-green tip — see
docs/handbook/git-and-pr-workflow.md §6.)
This template doubles as the Definition of Done. The boxes mirror
docs/handbook/definition-of-done.md; if they ever disagree, that doc wins.
-->

## What & why

<!-- What changed, and the motivation/context. Write it like a teammate will review it — and
     like the future agent who'll read `git log` and find only this squash commit.
     One PR = one purpose — don't mix a refactor, a fix, and a feature.
     A short ordered "what landed" list earns its place here. -->

## How tested

<!-- The gate below, plus anything manual (deploy preview, browser, etc.). -->

## Decisions touched

<!-- Cite any [D#] this work obeys, implements, or supersedes (never edit an accepted
     decision — write a superseding one). "None" is a valid answer. -->

-

## Green checks (Definition of Done)

The full chain, same order as CI (`.github/workflows/ci.yml`, job `verify`). Green locally = green CI.

```bash
pnpm lint && pnpm lint:css && pnpm lint:keys && pnpm lint:docs && pnpm format:check && pnpm typecheck && pnpm test && \
pnpm --filter studio typegen && git diff --exit-code sanity.types.ts && pnpm build
```

- [ ] `pnpm lint · lint:css · lint:keys · lint:docs · format:check · typecheck · test · build` — all green
- [ ] `sanity.types.ts` regenerated & committed after **any** Studio schema change `[D23]`
- [ ] Cache Components: dynamic reads in `<Suspense>` or `'use cache'` `[D11]`
- [ ] **"Don't reach up":** every unit self-sufficient — generic tokens + props, never a host's
      look or a parent's state `[D1][D2]`
- [ ] Concerns separated; types co-located (shared on 2nd use); one file/concern
      (`engineering-standards.md` §6) `[D24]`
- [ ] Diff reviewed: clean — no debug logs / dead code / unrelated changes / secrets
- [ ] Lockfile committed if deps changed; imports use `@/*`
- [ ] Tests co-located & meaningful; docs/README/decisions updated if needed `[D18]`
- [ ] Rendered surface? Browser-verified via `chrome-devtools` MCP (focus/tap/CLS/flash/console)
      `[D25]`

### Shared primitive only — the full "don't reach up" litmus

<!-- The universal self-sufficiency box is in the list above. This EXTRA checklist is only for a
     PR that ships a SHARED primitive (rare; most work is per-project and SUPPOSED to be specific).
     Full litmus: docs/handbook/architecture.md §8. -->

- [ ] Renders correctly on **generic tokens only** (`--brand-*`, `--font-face`, `--space-*`) +
      its own defaults — no project-specific (`--<proj>-*`) dependency `[D2]`
- [ ] Every themeable value is a **public token** with an internal default
- [ ] Assumes no **themeable ambient context** (a parent's brand/feel, a font mounted higher up);
      reading the global **invariant** tier (spacing, motion) is fine `[D1]`
- [ ] If shared, it's **declared once and composed in**, never re-instantiated per island
- [ ] The host themes it **downward**; the unit never reaches up
- [ ] Its CSS Module **declares its `@layer`** (or stays strictly var-consuming) `[D12]`
- [ ] If it registers an embed, the key is **namespaced with the project prefix** so a
      project-local embed can't silently shadow a shared one
