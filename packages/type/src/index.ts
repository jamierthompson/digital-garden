/**
 * The type-scale engine — pure, isomorphic public surface. Sibling of `@garden/oklch`; where the
 * color engine's load-bearing guarantee is CONTRAST, this one's is ZOOM (WCAG 1.4.4).
 *
 * The engine deals in SCALE STEPS, not semantic roles. `buildTypeScale(config?)` solves a
 * modular scale (Utopia dual-ratio) into a numeric ramp of per-step fluid `clamp()` sizes,
 * applying and flagging the zoom cap, and never throws. `typeScaleToDeclarations` /
 * `typeScaleToCss` serialize it to the `--type-size-<n>` custom properties the app bakes into
 * `foundation/typography.css`. Semantic ROLES (heading/body/…) are the APP's layer — it binds a role to a
 * step; the engine has no opinion about role names, so a demo can ignore roles and use steps.
 *
 * This surface is DRIFT-GUARDED (`api.test.ts`) — internal and single-consumer, so freely
 * changeable; the guard only catches SILENT drift.
 *
 * NEVER add `server-only`/`client-only` here, never import `next`/`react`/`react-dom`, never
 * touch DOM/Node globals — lint-enforced (`eslint.config.mjs`) and test-enforced (dual-env).
 */

export { buildTypeScale, DEFAULT_CONFIG } from "./system";

export {
  ZOOM_CAP_RATIO,
  modularSize,
  fluidClampString,
  solveStep,
} from "./scale";

export { sizeVarName, typeScaleToDeclarations, typeScaleToCss } from "./css";

export type { ScaleConfig, FluidStep, TypeScale, TypeScaleMeta } from "./types";
