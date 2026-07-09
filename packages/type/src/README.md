# Type-scale engine (`@garden/type`)

A **pure, isomorphic** type engine: a config → per-role fluid `clamp()` sizes, with the WCAG
1.4.4 zoom cap solved and flagged. The sibling of `@garden/oklch`: where the color engine's
load-bearing guarantee is **contrast**, this engine's is **zoom**. It knows nothing about React,
the DOM, Node, or the app — its isomorphism is lint-enforced (`eslint.config.mjs`) and
test-enforced (dual-env Vitest), and it must **never** import `next`/`react`/`react-dom` or carry
`server-only`/`client-only`.

This is the **size dimension only** — the first meal of the planned engine. Weight, tracking,
and leading stay as static tokens in `foundation.css` for now; the engine absorbs them later
(the leading hyperbola, tracking decay, variable-font weight/grade axes, and an interactive
studio are all deliberately out of scope here).

## Decisions baked in

- **Modular scale, Utopia dual-ratio.** `size = base · ratio^step`, computed at a small viewport
  (tighter `minRatio`, so deep headings fit a phone) and a large one (wider `maxRatio`, for
  editorial drama), then interpolated per step into a fluid `clamp()`. A sub-body step (label,
  meta) is _larger_ on mobile than desktop, so each step's two sizes are ordered into a floor and
  ceiling before the clamp is built.
- **The zoom cap is the guarantee.** A fluid `clamp()` fights full-page zoom: zoom scales `rem`
  but shrinks the CSS viewport, so the `vw` term works against the user. Reachability of 200%
  apparent size within the ~500% browser ceiling reduces to `maxPx ≤ 2.5 × minPx` per step. The
  engine enforces **2.4** (`ZOOM_CAP_RATIO`, a margin under 2.5), pulls a hot step's ceiling down
  to `2.4 × floor`, and **flags** it (`zoomCapped` / `meta.zoomCappedSteps`) — the analog of the
  color engine's out-of-gamut flag. Solved and capped, never eyeballed.
- **Steps, not roles — size is decoupled from role.** The engine emits the whole scale as a
  Radix-style numeric ramp (`--type-size-1 … --type-size-N`, 1 = smallest, the base at
  `baseIndex`). This is the flexible foundation: a demo reaches any step directly, or imports the
  engine to compute a bespoke scale. Semantic ROLES (`heading`/`body`/…) are the **app's** layer —
  the app binds a role to a step (`--type-heading-size: var(--type-size-6)`) and applies it via the
  `Heading`/`Text` primitives. The engine has no role vocabulary, so the app adds/renames/drops
  roles without touching it.
- **Never throws.** A bad field falls the whole config back to `DEFAULT_CONFIG` and flags
  `meta.isFallback`; a zero/reversed viewport span degrades a step to its floor constant. Any
  input — including author-time studio values — returns a valid scale.
- **Rounded only at the edge.** All math runs full-precision; values round to 4 dp only when
  serialized, and `-0` is normalized to `0`.

## Emission

`buildTypeScale(config?)` → `typeScaleToDeclarations` / `typeScaleToCss` produce the
`--type-size-<n>` custom properties. The app **bakes** those literals into `foundation.css` (the
global scale is not per-entry runtime-varying, unlike color), and a guard test in the app
recomputes them via this engine to catch drift — the same bake-and-guard pattern the color tokens
use. The app's semantic role bundles (`--type-<role>-size: var(--type-size-<n>)`, hand-authored in
`foundation.css`) bind each role to a step; that binding is deliberately outside the engine.

## Versioning stance

Internal, single-consumer package: the public surface is freely changeable. `api.test.ts` is a
tripwire against **silent** drift, not a wall — a deliberate change updates the guard in the same
commit and migrates consumers in the same PR. Never "fix" the guard to pass an accidental drift.

## Config knobs

`DEFAULT_CONFIG` is a calm editorial baseline (fluid 16→18px body at `baseIndex` 3, 1.2
minor-third on mobile opening to 1.333 perfect-fourth on desktop, a 9-step ramp). Every value is
a design knob — none is load-bearing except the zoom cap, which holds whatever they are set to.
