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
import { CONTRAST_TARGETS } from "./targets";
import type {
  BindingProvenance,
  ThemeTokenName,
  FillProvenance,
  OkLCH,
  FillForegroundProvenance,
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
 * `anchor` pins the ramp's SEED-ANCHORED step (#108/#334) — the step whose label the solve
 * keys off the seed's native direction, so it cannot be a static per-scheme label; `auto`
 * runs `minPass` against the scheme's worst-case surface; `auto-on` runs `minPass`
 * against a pinned step of the SAME role (a solved label on a status subtle, #160);
 * `literal` bakes a fixed value per scheme (scrim's alpha literal); `fill`/`fill-foreground` defer to
 * a co-solve — a continuous fill (accent + the status fills, #160) and its chromatic
 * label; `fill-hover` defers to a co-solved interaction-state fill (accent-hover). The default
 * schema lives in `palette.ts`, which owns the contrast targets.
 */
export type TokenBinding =
  | { kind: "step"; role: RampRole; light: RampLabel; dark: RampLabel }
  | { kind: "anchor"; role: RampRole }
  | { kind: "auto"; role: RampRole; target: ContrastTarget }
  | {
      kind: "auto-on";
      role: RampRole;
      against: { light: RampLabel; dark: RampLabel };
      target: ContrastTarget;
    }
  | { kind: "literal"; light: OkLCH; dark: OkLCH }
  | { kind: "fill"; role: RampRole }
  | { kind: "fill-foreground"; role: RampRole }
  | { kind: "fill-hover"; role: RampRole };

/** A role's co-solved fill + its label, with the provenance the receipt reads (#151/#160). */
export interface CoSolvedFill {
  fill: OkLCH;
  fillForeground: OkLCH;
  fillProvenance: FillProvenance;
  fillForegroundProvenance: FillForegroundProvenance;
}

/** A role's co-solved interaction-state fill (e.g. accent-hover) + its provenance (#160). */
export interface CoSolvedHover {
  fill: OkLCH;
  provenance: FillProvenance;
}

/** Everything a binding needs to resolve, for one scheme. */
export interface BindingContext {
  scheme: Scheme;
  /** The per-role ramps for this scheme. */
  ramps: Record<RampRole, Ramp>;
  /** The worst-case surface `auto` tokens are solved against (this scheme's `surface-selected`
   *  — the darkest text-bearing surface, so a pass here holds on every surface, #160). */
  worstSurface: OkLCH;
  /** The seed-anchored ramp step's label (#108), keyed off the seed's native direction —
   *  what an `anchor` binding resolves to on its role's ramp (#334). */
  anchorLabel: RampLabel;
  /**
   * The co-solved fills keyed by role (#160): the accent (`role: "accent"`) plus the four
   * status fills (`error`/`warning`/`success`/`info`). A `fill`/`fill-foreground` binding reads its
   * role's entry, so an error fill's receipt reports its status role, never "accent".
   */
  fills: Partial<Record<RampRole, CoSolvedFill>>;
  /** The co-solved interaction-state fills keyed by role (#160) — today just accent
   *  `accent-hover`. A `fill-hover` binding reads its role's entry. */
  hovers: Partial<Record<RampRole, CoSolvedHover>>;
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
 * `(role, label)` for ramp-bound tokens, the `accent`/`accent-foreground` co-solve report for the
 * continuous accent pair (#151), or `null` only for a `literal`. Surfacing provenance HERE, at
 * solve time, is what lets the receipt name the SCHEMA's role and the co-solve story rather
 * than reverse-engineering them by value-matching (which lies when two ramps converge — an
 * achromatic seed, `tintedNeutrals: false`). #70. (`step` keeps its name for continuity.)
 */
export interface ResolvedBinding {
  color: OkLCH;
  step: BindingProvenance;
}

/** A defensive fallback for a `fill`/`fill-foreground`/`fill-hover` binding whose role has no co-solve
 *  in the context — unreachable for the default schema (which always provides them), but keeps
 *  a hand-authored schema never-throwing: bind the role's `minPass` UI step against surface-selected. */
function fillFallback(ctx: BindingContext, role: RampRole): ResolvedBinding {
  const chosen = minPass(
    ctx.ramps[role],
    ctx.worstSurface,
    CONTRAST_TARGETS.ui,
  );
  return {
    color: chosen.color,
    step: { kind: "step", role, label: chosen.label },
  };
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
    case "anchor": {
      // The seed-grade identity color of the role's ramp: the step the seed is anchored to
      // (#108) — seed L (and chroma, gamut-mapped) at the role's hue. Carries NO contrast
      // claim; provenance reports the anchored step truthfully (#334).
      const label = ctx.anchorLabel;
      return {
        color: stepAt(ctx.ramps[binding.role], label),
        step: { kind: "step", role: binding.role, label },
      };
    }
    case "auto": {
      const chosen = minPass(
        ctx.ramps[binding.role],
        ctx.worstSurface,
        binding.target,
      );
      return {
        color: chosen.color,
        step: { kind: "step", role: binding.role, label: chosen.label },
      };
    }
    case "auto-on": {
      // A label solved against a PINNED step of the same role (a status subtle) — not the
      // worst-case surface. `minPass` lands the least-extreme step clearing the target on that
      // subtle surface's ACTUAL color, so the guarantee holds against what actually ships.
      const subtleLabel =
        ctx.scheme === "light" ? binding.against.light : binding.against.dark;
      const subtle = stepAt(ctx.ramps[binding.role], subtleLabel);
      const chosen = minPass(ctx.ramps[binding.role], subtle, binding.target);
      return {
        color: chosen.color,
        step: { kind: "step", role: binding.role, label: chosen.label },
      };
    }
    case "literal": {
      const color = ctx.scheme === "light" ? binding.light : binding.dark;
      // A literal carries no contrast claim; its only story is opacity (scrim, #160).
      return { color, step: { kind: "literal", alpha: color.alpha ?? 1 } };
    }
    case "fill": {
      const co = ctx.fills[binding.role];
      return co
        ? { color: co.fill, step: co.fillProvenance }
        : fillFallback(ctx, binding.role);
    }
    case "fill-foreground": {
      const co = ctx.fills[binding.role];
      return co
        ? { color: co.fillForeground, step: co.fillForegroundProvenance }
        : fillFallback(ctx, binding.role);
    }
    case "fill-hover": {
      const hover = ctx.hovers[binding.role];
      if (hover) return { color: hover.fill, step: hover.provenance };
      // No hover co-solve → fall back to the role's base fill, then to a ramp step.
      const co = ctx.fills[binding.role];
      return co
        ? { color: co.fill, step: co.fillProvenance }
        : fillFallback(ctx, binding.role);
    }
  }
}

/** A scheme's resolved token set plus each token's binding provenance (parallel keys). */
export interface ResolvedTokens {
  tokens: SchemeTokens;
  bindings: Record<ThemeTokenName, BindingProvenance>;
}

/** Resolve a full binding schema into a scheme's token set + per-token provenance. The
 *  schema is read-only here — resolution only reads it (so the exported
 *  `DEFAULT_BINDING_SCHEMA`, #150, passes straight through). */
export function resolveTokens(
  schema: Readonly<Record<ThemeTokenName, TokenBinding>>,
  ctx: BindingContext,
): ResolvedTokens {
  const tokens = {} as SchemeTokens;
  const bindings = {} as Record<ThemeTokenName, BindingProvenance>;
  for (const name of Object.keys(schema) as ThemeTokenName[]) {
    const resolved = resolveBinding(schema[name], ctx);
    tokens[name] = resolved.color;
    bindings[name] = resolved.step;
  }
  return { tokens, bindings };
}
