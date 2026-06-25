# Run record — Phase 3: first vertical slice (a dead-simple project, end-to-end)

- **Date:** 2026-06-24
- **Mode:** agent-team, coding-feature (own-a-slice → independent QA → lead curates → squash-merge)
- **Lead:** main session · **Teammates:** Core, Studio, Data, Shell · **QA (fresh):** QA (`pr-review-toolkit:code-reviewer`) · **Browser verify:** lead via `chrome-devtools`
- **PR:** #20 (`feat/phase-3` → `main`) · **Outcome:** whole of Phase 3 in one curated, gate-green PR

## Why

Phases 0–2 left the machinery built but unproven on real content: the engine, `ProjectScope`,
`cardSwatches`, resolvers, and the Sanity model all existed, but nothing had driven a real project
end-to-end through them. Phase 3 retires that integration risk with the cheapest possible probe —
**one trivial real project** (static essay, one brand color, one tiny embed) — plus the surrounding
routing, shell pages, RSS, and draft-mode plumbing. Nothing hard rides on it, so a failure points at
the wiring, not the project (the engine showcase is deliberately held to Phase 4).

## Shape — four file-disjoint slices, each in its own git worktree

Chosen as a **team** because the work split into independent slices over distinct file sets. The
parallel-coding hazard (two agents editing one file) was contained by **strict file-ownership
partition** + a **separate git worktree per slice**, and by **spawn ordering** for the one real
dependency: Shell imports Core's `SITE_SETTINGS_QUERY`, so it was spawned onto the integrated
foundation once Core's first commit landed; Studio and Data are independent of Core and ran from t0.

| Owner      | Owns (only)                                                                                                                                                                         | Tasks                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Core**   | `src/projects/**`, `src/lib/keys.ts`, `src/lib/resolvers/{components,embeds}.ts`, `src/app/work/**`, `src/components/portable-text/**`, `src/sanity/lib/queries.ts`, `scopeSeed.ts` | `first-light` end-to-end: module, `/work` index + `[slug]`, states, metadata, integration test |
| **Studio** | `studio/**`                                                                                                                                                                         | `blurb` hard `max(300)`; `siteSettings` singleton via Structure                                |
| **Data**   | `src/sanity/lib/client.ts` (+ `getClient.ts`), `src/app/api/draft-mode/**`, `src/app/rss.xml/**`, `proxy.ts`                                                                        | RSS; draft-mode mechanism; `proxy.ts` deferral                                                 |
| **Shell**  | `src/app/{page,layout}.tsx`, `src/app/{about,now,notes}/**`, `src/components/shell/**`                                                                                              | garden home/about/now/notes themed via `ProjectScope slug="garden"`                            |

An overlap check confirmed no source file was claimed by two slices; the only shared file
(`sanity.types.ts`) is generated, so its merge was resolved by re-running TypeGen.

## Three integration seams — surfaced by slices, resolved by the lead

Own-a-slice means a slice that hits a file outside its boundary **flags it** rather than editing
across the line. Three such seams came up, each resolved deliberately (not papered over):

1. **The `boundaries/dependencies` ESLint rule banned the registry's own job.** §4.2/[D21] require
   the resolver registry (`src/lib/resolvers/components.ts`) to literal-import project modules, but
   the Phase-0 rule (stood up empty) banned **all** `shared→project` imports. Fix: a new `registry`
   boundaries element matched _before_ the `shared` catch-all, so the registry may import `project`
   while the ban still holds for every other shared module — **tightening** the boundary to the one
   sanctioned importer, not loosening it. Core's provisional per-line disable was removed in the
   same pass.
2. **`scopeSeed.ts` hard-coded its allowed-slug set.** The Phase-0.5 anti-injection guard vetted
   slugs against `new Set(["oklch-engine"])`, so a real project slug collapsed to the `fallback`
   selector. Fix (Core, lead-approved): derive it from the registry —
   `new Set([...COMPONENT_KEYS, "garden", "oklch-engine"])` — which keeps the guard (a vetted
   constant set) while accepting every registered project _and_ the shell scope automatically.
3. **Draft-content rendering vs. `use cache`.** Every content fetch is `use cache` + the published
   client by design, and `use cache` forbids `draftMode()`. Rendering drafts in Preview therefore
   needs a shared `sanityFetch()` that reads `draftMode()` outside the cache boundary and branches
   to `getClient(true)` — a cross-route refactor, not a curation hack. **Deferred** with the
   mechanism (enable/disable handlers, draft client, `<VisualEditingControls>`) shipped; tracked in
   `build-phases.md`.

## QA log [D26]

_Retrofit: this run predates [D26]; QA ran over the whole integrated branch (not per-slice). Detail
in the section below._

| Slice                     | Author                 | QA agent (fresh)                                            | Verdict                          | Tests added |
| ------------------------- | ---------------------- | ----------------------------------------------------------- | -------------------------------- | ----------- |
| Integrated Phase-3 branch | Core·Studio·Data·Shell | QA (`pr-review-toolkit:code-reviewer`) + lead browser [D25] | clean (2 nits fixed, 0 blockers) | —           |

**What QA probed:** re-read the whole integrated diff against the binding `[D#]`s; ran the real
`buildTokenSet` to _measure_ contrast (amber accent/surface 4.31:1, garden green 5.58:1 — not
eyeballed); drove a `[D25]` browser pass on `/`, `/work`, `/work/first-light` (focus ring, themed
`light-dark()` tokens, zero console errors). **Nits fixed in-branch:** heading token
`--brand-accent` (3:1 UI-fill) → `--brand-accent-text` (4.5:1); a clarifying comment. A scary console
error was diagnosed as the React DevTools extension (tooling, not code). **Deferred from QA:** none
(3 scope items deferred separately — see below).

## The dev↔QA loop + browser pass (handbook §6.2, [D25])

A gate-green branch is _developer-done_, not _review-done_. A **fresh** reviewer (never an author)
re-read the whole integrated diff against the binding `[D#]`s, and the lead drove a `[D25]` browser
pass on the running app. Findings:

- **No blockers, no should-fixes.** The defensive contract [D9] holds end-to-end (unknown slug /
  unresolved `componentKey` → `notFound()`; unresolved `embedKey` → `MissingEmbed`; missing
  `siteSettings` / malformed `brandColor` → engine fallback, never a throw). Security checks pass
  (read token server-only; stega excluded on the by-key fields [D16]; RSS on the published client,
  no draft leak). Every new `*.module.css` declares `@layer` [D12].
- **The contrast concern was _measured_, not eyeballed** — QA ran the real `buildTokenSet`: amber
  `accent`/surface 4.31:1, garden green 5.58:1, and every accent-as-text use is a large/bold heading
  (WCAG floor 3:1) — all clear. The lead's browser pass confirmed `data-project="garden"` resolving
  to real engine `light-dark()` tokens at hue 150, Fraunces loaded, focus ring a real engine color,
  and **zero console errors** across `/`, `/work`, `/work/first-light`.
- **A scary-looking console error was diagnosed as tooling, not code** — `"React instrumentation …
cleaning up async info …"` originates in the **React DevTools extension** tripping on React 19.2's
  async-Suspense instrumentation; it never runs in production. No code change; verifiable by loading
  the page with the extension disabled.
- **Two in-branch nits fixed:** `/work/[slug]` headings used the 3:1 UI-fill token `--brand-accent`
  for _text_ → switched to the 4.5:1 text-solved `--brand-accent-text` (matching `/now` and the
  engine's token taxonomy; removes latent fragility); and a comment clarifying that
  `pages/ExperiencePage.tsx` is the §4.1 thin-page scaffold, not yet routed for this trivial slice.

## Notable engineering calls

- **`proxy.ts` evaluated and intentionally _not_ added.** Draft mode runs entirely through native
  Route Handlers that flip the `__prerender_bypass` cookie; an empty Node-only proxy would tax every
  request. Decision recorded with doc citations; the Phase-0 deferral stands.
- **`previewDrafts` → `"drafts"`.** `perspective: "previewDrafts"` is `DeprecatedPreviewDrafts` in
  `@sanity/client` v7 — the current spelling (same behavior) is used. `stega.enabled` also now
  requires `studioUrl`, so a public `NEXT_PUBLIC_SANITY_STUDIO_URL` was added. (Exactly the
  "verify, don't trust memory" trap the briefs warn about — caught by Data against the bundled docs.)
- **Worktree hygiene fix.** ESLint flat config doesn't read `.gitignore`, so `pnpm lint` from the
  lead's checkout was scanning every teammate's `.claude/worktrees/` copy mid-run. `.claude/worktrees`
  is now ignored in both ESLint and Prettier — agent teams are a first-class workflow here, so the
  gate must survive one.

## Deferred (tracked in `build-phases.md`)

- **Draft-content _rendering_** on the `/work` routes (the shared `sanityFetch()` refactor) — seam #3.
- **`PROJECT_DETAIL_QUERY` over-fetch** — pulls `notes[]`/`tags` the route renders neither; render or
  trim when the project page grows.
- **Studio schema not deployed to the hosted Content Lake** (`sanity:deploy-schema`) — not needed for
  the build, but Presentation/visual-editing and MCP schema validation want it.

## Outcome

One curated, squash-ready PR (#20, `feat/phase-3` → `main`), full 10-step gate green (477 tests),
QA-clean, browser-verified. Two real Sanity docs were seeded (the `first-light` project + the
`siteSettings` singleton). New env vars — `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SANITY_STUDIO_URL`
(public), `SANITY_API_READ_TOKEN` (secret, server-only) — must be set in Vercel per-environment and
the deploy URL added to Sanity CORS before Preview works. **Phase 3 complete; Phase 4 (the engine
showcase + the `log-explorer` migration) is next.**
