/**
 * Role→step binding: how a semantic token resolves to a concrete color from the ramp
 * primitives. The ramp (`ramp.ts`) is a pure lightness scale; this layer decides WHICH
 * step (or fixed value) each semantic token becomes — the "names, not numbers" boundary.
 *
 * The workhorse is `minPass`: an "auto / readable-on-X" token binds to the SMALLEST ramp
 * step that clears its contrast target against the relevant background — least-extreme
 * first, so the token stays as close to the surface as legibility allows — with an
 * extreme-step fallback when no step passes (near-black/near-white always clears). This is
 * the discrete counterpart to `contrast.ts`'s continuous `solveForeground`; the engine
 * prefers discrete ramp steps, keeping `solveForeground` for the rare exact solve.
 */

import {
  checkContrast,
  withSolveMargin,
  type ContrastTarget,
} from "./contrast";
import type {
  AccentProvenance,
  BindingProvenance,
  BrandTokenName,
  OkLCH,
  OnAccentProvenance,
  Ramp,
  RampLabel,
  RampRole,
  RampStep,
  Scheme,
  SchemeTokens,
} from "./types";

/** Does `fg` clear BOTH the WCAG floor and the APCA target against `bg`? The engine's
 *  shared check (#100) — one semantics for solves, bindings, and the receipt. */
function meets(fg: OkLCH, bg: OkLCH, target: ContrastTarget): boolean {
  return checkContrast(fg, bg, target).passes;
}

/**
 * Bind an auto/readable token to a ramp step: the LEAST-EXTREME step that clears `target`
 * against `bg` — the passing step whose lightness sits closest to the background (minimal
 * |ΔL|), so the token stays as near the surface as legibility allows regardless of which
 * polarity that is. The target is bumped a hair above its floor (`withSolveMargin`) so the
 * 4-dp-rounded baked literal still clears the true floor (#79). If NO step passes, the
 * highest-contrast step (the one FURTHEST from `bg` in lightness — a near-black/near-white
 * extreme that clears any sane target) is returned, so the binding always resolves. Picking
 * by |ΔL| rather than a `bg.L ≥ 0.5` scan makes it correct for a mid-lightness background
 * too, not just the ramp extremes the engine's surfaces sit at. Pure, deterministic, never
 * throws.
 */
export function minPass(
  ramp: Ramp,
  bg: OkLCH,
  target: ContrastTarget,
): RampStep {
  const bumped = withSolveMargin(target);
  let closest: { step: RampStep; dl: number } | null = null;
  let furthest: { step: RampStep; dl: number } = {
    step: ramp[0],
    dl: -Infinity,
  };
  for (const step of ramp) {
    const dl = Math.abs(step.color.L - bg.L);
    if (dl > furthest.dl) furthest = { step, dl };
    if (meets(step.color, bg, bumped) && (!closest || dl < closest.dl)) {
      closest = { step, dl };
    }
  }
  // A passing step closest to the surface, or — if none passes — the highest-contrast extreme.
  return closest ? closest.step : furthest.step;
}

/**
 * A semantic token's binding. `step` pins a fixed ramp step (per scheme — e.g. surfaces);
 * `auto` runs `minPass` against the scheme's worst-case surface; `literal` bakes a fixed
 * value per scheme (e.g. a pure-white surface); `accent`/`on-accent` defer to the brand
 * co-solve (the faithful continuous accent + its near-white/near-black label). The default
 * schema lives in `palette.ts`, which owns the contrast targets.
 */
export type TokenBinding =
  | { kind: "step"; role: RampRole; light: RampLabel; dark: RampLabel }
  | { kind: "auto"; role: RampRole; target: ContrastTarget }
  | { kind: "literal"; light: OkLCH; dark: OkLCH }
  | { kind: "accent" }
  | { kind: "on-accent" };

/** Everything a binding needs to resolve, for one scheme. */
export interface BindingContext {
  scheme: Scheme;
  /** The per-role ramps for this scheme. */
  ramps: Record<RampRole, Ramp>;
  /** The worst-case surface `auto` tokens are solved against (this scheme's `surface-2`). */
  surface2: OkLCH;
  /** The faithful brand accent fill (continuous co-solve) and its on-accent label. */
  accent: OkLCH;
  onAccent: OkLCH;
  /** The `accent` co-solve story (#151) — reported verbatim as the `accent` token's
   *  provenance so the receipt never reverse-engineers native/nudged/derived from values. */
  accentProvenance: AccentProvenance;
  /** The `on-accent` label solve story (#151/#153) — pole + hue/chroma/backoff, reported
   *  verbatim as the `on-accent` token's provenance. */
  onAccentProvenance: OnAccentProvenance;
}

/** Find a ramp step by label (the ramp is a fixed 11-entry array, so this is a scan). */
function stepAt(ramp: Ramp, label: RampLabel): OkLCH {
  const found = ramp.find((s) => s.label === label);
  // The ramp always carries all 11 labels (buildRamp maps RAMP_LABELS); the fallback keeps
  // this total for a hand-authored schema that names a label out of range.
  return (found ?? ramp[ramp.length - 1]).color;
}

/**
 * One resolved binding: the baked color AND its provenance. `step` is the discrete
 * `(role, label)` for ramp-bound tokens, the `accent`/`on-accent` co-solve report for the
 * continuous brand pair (#151), or `null` only for a `literal`. Surfacing provenance HERE, at
 * solve time, is what lets the receipt name the SCHEMA's role and the co-solve story rather
 * than reverse-engineering them by value-matching (which lies when two ramps converge — an
 * achromatic seed, `tintedNeutrals: false`). #70. (`step` keeps its name for continuity.)
 */
export interface ResolvedBinding {
  color: OkLCH;
  step: BindingProvenance;
}

/** Resolve one token's binding to a concrete OKLCH — and report which ramp step it bound
 *  to — for the context's scheme. */
export function resolveBinding(
  binding: TokenBinding,
  ctx: BindingContext,
): ResolvedBinding {
  switch (binding.kind) {
    case "step": {
      const label = ctx.scheme === "light" ? binding.light : binding.dark;
      return {
        color: stepAt(ctx.ramps[binding.role], label),
        step: { kind: "step", role: binding.role, label },
      };
    }
    case "auto": {
      const chosen = minPass(
        ctx.ramps[binding.role],
        ctx.surface2,
        binding.target,
      );
      return {
        color: chosen.color,
        step: { kind: "step", role: binding.role, label: chosen.label },
      };
    }
    case "literal":
      return {
        color: ctx.scheme === "light" ? binding.light : binding.dark,
        step: null,
      };
    case "accent":
      return { color: ctx.accent, step: ctx.accentProvenance };
    case "on-accent":
      return { color: ctx.onAccent, step: ctx.onAccentProvenance };
  }
}

/** A scheme's resolved token set plus each token's binding provenance (parallel keys). */
export interface ResolvedTokens {
  tokens: SchemeTokens;
  bindings: Record<BrandTokenName, BindingProvenance>;
}

/** Resolve a full binding schema into a scheme's token set + per-token provenance. The
 *  schema is read-only here — resolution only reads it (so the exported
 *  `DEFAULT_BINDING_SCHEMA`, #150, passes straight through). */
export function resolveTokens(
  schema: Readonly<Record<BrandTokenName, TokenBinding>>,
  ctx: BindingContext,
): ResolvedTokens {
  const tokens = {} as SchemeTokens;
  const bindings = {} as Record<BrandTokenName, BindingProvenance>;
  for (const name of Object.keys(schema) as BrandTokenName[]) {
    const resolved = resolveBinding(schema[name], ctx);
    tokens[name] = resolved.color;
    bindings[name] = resolved.step;
  }
  return { tokens, bindings };
}
