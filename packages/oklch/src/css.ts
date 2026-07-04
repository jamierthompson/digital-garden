/**
 * Serialize a TokenSet to baked CSS — literal `oklch()` values inside `light-dark()`,
 * wrapped in `@layer brand`.
 *
 * Two tiers:
 *   • the GENERIC SEMANTIC token contract (`--surface`, `--accent`, `--text`, … `--success`)
 *     — the same role names the foundation layer defines as the global editorial default; a
 *     slot's `@layer brand` block re-binds them with the brand's solved values.
 *   • the per-role `50…950` ramp PRIMITIVES the semantic tokens bind from (`--brand-500`,
 *     `--neutral-200`, … `--info-950`) — the tier exposed 1:1 to a Tailwind numeric scale.
 *
 * `tokenSetToDeclarations` emits just the semantic tier; `rampSetToDeclarations` just the
 * ramp tier; `tokenSetToCss` emits both, wrapped in the scoped rule. Adding the
 * `--focus-ring-color` alias and the `--font-face` mapping is the entry scope's job, not
 * the engine's. `EntryScope` (owned elsewhere) composes the declarations it wants into its
 * scoped `<style>`; this serializer is the convenience that produces them.
 */

import { formatColor } from "./convert";
import type {
  BrandTokenName,
  ColorFormat,
  RampRole,
  RampStep,
  SchemePair,
  TokenSet,
} from "./types";

/** Options shared by the CSS serializers. */
export interface CssOptions {
  /**
   * Value serialization (#99). Defaults to `oklch` — the native, lossless literal
   * `EntryScope` bakes. `hex`/`rgb` exist for the export surface (#107): identical
   * paint for the default `srgb` gamut, clamped for `p3`.
   */
  format?: ColorFormat;
}

/**
 * Public custom-property prefix. The engine's token names ARE the generic semantic role
 * names, so the prefix is bare `--` (`--surface`, `--accent`, …) — no `--brand-`/project
 * namespace, because the `[data-entry]` scope provides the isolation.
 */
const PREFIX = "--";

/** `light-dark(<light literal>, <dark literal>)` for one token pair. */
function lightDark(pair: SchemePair, format: ColorFormat): string {
  return `light-dark(${formatColor(pair.light, format)}, ${formatColor(pair.dark, format)})`;
}

/** `--<name>` for a token (the generic semantic custom property). */
function customProperty(name: BrandTokenName): string {
  return `${PREFIX}${name}`;
}

/**
 * `--<role>-<step>` for one ramp step (`--brand-500`, `--neutral-200`, `--success-700`) —
 * the primitive tier, exposed 1:1 to a Tailwind numeric scale. A consumer inside the slot
 * (a subtle branded fill, the card ramp strip #96) reads these; the semantic tokens above
 * are what components read by default.
 */
function rampProperty(role: RampRole, step: RampStep): string {
  return `${PREFIX}${role}-${step.label}`;
}

/**
 * Just the SEMANTIC declaration lines (no selector, no layer) — the generic role contract
 * components read (`--surface`, `--accent`, … `--success`). For a caller that controls
 * placement and wants only the semantic tier (e.g. `EntryScope`, which hand-assembles the
 * block and adds its own aliases). Includes `color-scheme: light dark` so `light-dark()`
 * resolves and the scheme follows `prefers-color-scheme` by default. Each line is
 * `\n`-joined. The primitive ramp tier is a separate opt-in — see `rampSetToDeclarations`.
 */
export function tokenSetToDeclarations(
  set: TokenSet,
  opts: CssOptions = {},
): string {
  const format = opts?.format ?? "oklch";
  const lines = ["color-scheme: light dark;"];
  for (const name of Object.keys(set.tokens) as BrandTokenName[]) {
    lines.push(
      `${customProperty(name)}: ${lightDark(set.tokens[name], format)};`,
    );
  }
  return lines.join("\n");
}

/**
 * Just the primitive `--<role>-<step>` ramp declarations (`--brand-500`, `--neutral-200`,
 * … `--info-950`) — the `50…950` tier the semantic tokens bind from, exposed 1:1 to a
 * Tailwind numeric scale (#98). Opt-in and separate from the semantic tier so a caller
 * decides whether to ship the full ramp into its scope; `tokenSetToCss` includes them by
 * default. Each line is `\n`-joined.
 */
export function rampSetToDeclarations(
  set: TokenSet,
  opts: CssOptions = {},
): string {
  const format = opts?.format ?? "oklch";
  const lines: string[] = [];
  for (const role of Object.keys(set.ramps) as RampRole[]) {
    const { light, dark } = set.ramps[role];
    for (let i = 0; i < light.length; i++) {
      lines.push(
        `${rampProperty(role, light[i])}: ${lightDark({ light: light[i].color, dark: dark[i].color }, format)};`,
      );
    }
  }
  return lines.join("\n");
}

/**
 * A complete, ready-to-inline scoped rule wrapped in `@layer brand` — the semantic role
 * tokens AND the per-role `50…950` ramp primitives (#98). `selector` is typically
 * `[data-entry="<slug>"]`. Indentation is cosmetic. A caller wanting only the semantic
 * tier composes `tokenSetToDeclarations` itself (as `EntryScope` does).
 */
export function tokenSetToCss(
  set: TokenSet,
  selector: string,
  opts: CssOptions = {},
): string {
  const body = [
    tokenSetToDeclarations(set, opts),
    rampSetToDeclarations(set, opts),
  ]
    .join("\n")
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
  return `@layer brand {\n  ${selector} {\n${body}\n  }\n}`;
}
