/**
 * Serialize a TokenSet to baked CSS declaration lines — literal `oklch()` values inside
 * `light-dark()`. These are raw declarations only, with no selector or `@layer` wrapper:
 * theme delivery is deliberately kept OUTSIDE the cascade (#254), so the caller places them.
 *
 * Two tiers:
 *   • the GENERIC SEMANTIC token contract (`--surface`, `--accent`, `--foreground`, … `--success`)
 *     — the same role names the foundation layer defines as the global editorial default; a
 *     slot re-binds them with the theme's solved values.
 *   • the per-role `50…950` ramp PRIMITIVES the semantic tokens bind from (`--accent-500`,
 *     `--neutral-200`, … `--info-950`) — the tier exposed 1:1 to a Tailwind numeric scale.
 *
 * `tokenSetToDeclarations` emits just the semantic tier; `rampSetToDeclarations` just the
 * ramp tier. Adding the `--ring-color` alias and the `--font-body` mapping is the entry
 * scope's job, not the engine's. `EntryScope` (owned elsewhere) composes the declarations it
 * wants into its scoped `<style>`; these serializers are the convenience that produces them.
 */

import { formatColor } from "./convert";
import type {
  ThemeTokenName,
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
  /**
   * Emit a leading `color-scheme: light dark;` (#159). Default `false` — a SCOPED slot
   * (`[data-entry]`) must NOT re-declare it: `color-scheme` is inherited, so a slot with none
   * follows the foundation root's used scheme, and a forced root override (the site-wide
   * light/dark toggle) then reaches inside the slot instead of being shadowed. Set `true` only
   * for a self-contained rule that establishes the scheme at its own root — e.g. the pasteable
   * `:root` CSS export (#107).
   */
  colorScheme?: boolean;
}

/**
 * Public custom-property prefix. The engine's token names ARE the generic semantic role
 * names, so the prefix is bare `--` (`--surface`, `--accent`, …) — no `--accent-`/project
 * namespace, because the `[data-entry]` scope provides the isolation.
 */
const PREFIX = "--";

/** `light-dark(<light literal>, <dark literal>)` for one token pair. */
function lightDark(pair: SchemePair, format: ColorFormat): string {
  return `light-dark(${formatColor(pair.light, format)}, ${formatColor(pair.dark, format)})`;
}

/** `--<name>` for a token (the generic semantic custom property). */
function customProperty(name: ThemeTokenName): string {
  return `${PREFIX}${name}`;
}

/**
 * `--<role>-<step>` for one ramp step (`--accent-500`, `--neutral-200`, `--success-700`) —
 * the primitive tier, exposed 1:1 to a Tailwind numeric scale. A consumer inside the slot
 * (a subtle accent fill, the card ramp strip #96) reads these; the semantic tokens above
 * are what components read by default.
 */
function rampProperty(role: RampRole, step: RampStep): string {
  return `${PREFIX}${role}-${step.label}`;
}

/**
 * Just the SEMANTIC declaration lines (no selector, no layer) — the generic role contract
 * components read (`--surface`, `--accent`, … `--success`). For a caller that controls
 * placement and wants only the semantic tier (e.g. `EntryScope`, which hand-assembles the
 * block and adds its own aliases). By default emits NO `color-scheme` (#159): a scoped slot
 * inherits it from the foundation root, so the site-wide toggle's forced root override is not
 * shadowed. A caller establishing the scheme at its own root opts in with
 * `{ colorScheme: true }` (see `CssOptions`). Each line is `\n`-joined. The primitive ramp
 * tier is a separate opt-in — see `rampSetToDeclarations`.
 */
export function tokenSetToDeclarations(
  set: TokenSet,
  opts: CssOptions = {},
): string {
  const format = opts?.format ?? "oklch";
  const lines = opts?.colorScheme ? ["color-scheme: light dark;"] : [];
  for (const name of Object.keys(set.tokens) as ThemeTokenName[]) {
    lines.push(
      `${customProperty(name)}: ${lightDark(set.tokens[name], format)};`,
    );
  }
  return lines.join("\n");
}

/**
 * Just the primitive `--<role>-<step>` ramp declarations (`--accent-500`, `--neutral-200`,
 * … `--info-950`) — the `50…950` tier the semantic tokens bind from, exposed 1:1 to a
 * Tailwind numeric scale (#98). Opt-in and separate from the semantic tier so a caller
 * decides whether to ship the full ramp into its scope. Each line is `\n`-joined.
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
