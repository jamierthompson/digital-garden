# Architecture Audit — Portfolio & Digital Garden

A five-auditor review of the project plans (`../architecture-plan.md`,
`../build-phases.md`), conducted before implementation to put the project on a
rock-solid foundation. Five reviewers each took an independent lens, then
cross-examined each other in a debate round to stress assumptions, theories, and
opinions.

## How to read this folder

| File                              | What it is                                                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `round-1-independent-findings.md` | Each auditor's independent audit (verbatim), before they saw each other's work.                                                       |
| `round-2-debate.md`               | The devil's-advocate round: each auditor challenged, defended, or conceded against the others. This is where the plan actually moved. |
| `synthesis.md`                    | The consolidated verdict and the decisions the debate forced. **Start here if you want the conclusions.**                             |
| `../decisions.md`                 | ADR-style log of every resolved decision, for quick reference during the build.                                                       |

## The five lenses

| Auditor          | Lens                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architect**    | Abstraction altitude, coupling/cohesion, right-sized vs over-engineered.                                                                    |
| **FrameworkFit** | Does the plan match the _actually installed_ Next.js 16.2.9 / React 19.2.4 / Vercel — verified against the bundled docs, not training data. |
| **Theming**      | OKLCH engine, CSS custom-property scoping, `@layer` cascade, flash-free rendering, fonts.                                                   |
| **ContentModel** | Sanity schema, the reference-by-key CMS↔code contract, GROQ/TypeGen, draft mode.                                                            |
| **Sequencing**   | Build order, critical path, dependencies, exit criteria, deferral calls, delivery risk.                                                     |

## Headline outcome

The foundation is **sound and unusually well-reasoned** — the core machinery
(pure OKLCH engine, reference-by-key, the `ProjectScope` keystone,
deferred-by-design phasing) survived scrutiny, and the framework reading is
accurate where most plans drift. The debate concentrated the real work into a few
surgical changes, not a redesign:

1. **Token model → three tiers** (invariant→global, brand+font→engine-scoped,
   feel/geometry→scoped override). Softens §3.1's "complete self-described
   islands" purism.
2. **OKLCH trilemma → bake literals server-side.** Live per-token CSS override
   solves a problem the project doesn't have.
3. **The engine is the root risk and is under-specified** — contrast must be
   _solved_ not stepped; dark-mode signature, gamut mapping, and semantic colors
   are decisions to make now.
4. **`brandColor` is a data-quality 500 risk** — needs a three-layer defense.
5. **Reference-by-key drift** — typed resolvers + fallbacks now; CI key-check
   later.
6. **Fonts → `preload: false` by default**; pin down SSG-vs-dynamic for project
   routes.
7. **`@layer` trap** — unlayered CSS Modules silently beat all layered styles
   (verified against the installed docs).
8. **Sequence by risk-retirement, not dependency topology** — add a Phase 0.5
   walking skeleton; the first real slice is a dead-simple project, with
   `oklch-engine` moved to the second slice (Phase 4).

See `synthesis.md` for the full reasoning and `../decisions.md` for the resolved
calls.
