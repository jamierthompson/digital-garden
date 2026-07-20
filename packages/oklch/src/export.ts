/**
 * Portable export formats (#99, consumed by the studio export UI #107): serialize a
 * `TokenSet` for use OUTSIDE this codebase — a Tailwind v4 `@theme` block and a W3C-DTCG
 * design-tokens JSON tree. The in-repo CSS serialization lives in `css.ts` (`EntryScope`
 * consumes that); these formats exist so a generated palette can leave the garden.
 *
 * Naming per format:
 *   • Tailwind: everything under the `--color-*` theme namespace — ramps 1:1 to the
 *     Tailwind numeric scale (`--color-accent-500`) and the semantic roles by name
 *     (`--color-accent`), so utilities like `bg-accent-500` / `text-accent` fall out.
 *   • DTCG: per-scheme root groups (`light` / `dark` — the format has no `light-dark()`,
 *     and mode-per-group is the convention Style Dictionary–class tools consume), each
 *     holding one group per ramp role plus a `semantic` group.
 */

import { clamp01, formatColor, formatHex, oklchToSrgb } from "./convert";
import type {
  ThemeTokenName,
  ColorFormat,
  OkLCH,
  RampRole,
  Scheme,
  TokenSet,
} from "./types";
import type { HarmonyHue, HarmonyTier } from "./harmony-tier";

/** Options shared by the export serializers. */
export interface ExportOptions {
  /** Value serialization. Defaults to `oklch` (native, lossless); see `ColorFormat`. */
  format?: ColorFormat;
}

/**
 * A Tailwind v4 CSS-first theme block: `@theme { --color-…: light-dark(…); }`.
 * Pasteable into a v4 stylesheet; utilities (`bg-accent-500`, `text-accent`, …) are
 * generated from the `--color-*` namespace. `light-dark()` resolves wherever the
 * consuming page sets `color-scheme` (Tailwind inlines the var, so the value stays
 * scheme-aware at paint time).
 */
export function tokenSetToTailwindTheme(
  set: TokenSet,
  opts: ExportOptions = {},
): string {
  const format = opts?.format ?? "oklch";
  const lines: string[] = [];
  for (const name of Object.keys(set.tokens) as ThemeTokenName[]) {
    const { light, dark } = set.tokens[name];
    lines.push(
      `  --color-${name}: light-dark(${formatColor(light, format)}, ${formatColor(dark, format)});`,
    );
  }
  for (const role of Object.keys(set.ramps) as RampRole[]) {
    const { light, dark } = set.ramps[role];
    for (let i = 0; i < light.length; i++) {
      lines.push(
        `  --color-${role}-${light[i].label}: light-dark(${formatColor(light[i].color, format)}, ${formatColor(dark[i].color, format)});`,
      );
    }
  }
  return `@theme {\n${lines.join("\n")}\n}`;
}

/**
 * A DTCG color value — the OBJECT form the current DTCG Color module requires
 * (https://www.designtokens.org/TR/drafts/color/): a `colorSpace`, its `components`, and
 * the optional sRGB `hex` fallback for tools that predate the object form. A plain CSS
 * string is NOT a conformant color `$value` (QA-99); the `format` option picks which
 * space the components serialize in — `oklch` (native, lossless) or `srgb` (for
 * `hex`/`rgb`, the clamped rendering).
 */
export interface DesignTokenColorValue {
  colorSpace: "oklch" | "srgb";
  components: [number, number, number];
  /**
   * Optional opacity 0–1 (DTCG Color module `alpha`) — present ONLY for a translucent token
   * (`scrim`, #160); an ordinary opaque token omits it, exactly as before.
   */
  alpha?: number;
  /** Lowercase `#rrggbb` (or 8-digit `#rrggbbaa` when translucent) sRGB fallback — always present. */
  hex: string;
}

/** One DTCG color token: `{ "$type": "color", "$value": { … } }`. */
export interface DesignToken {
  $type: "color";
  $value: DesignTokenColorValue;
}

/** Round to a fixed dp, guarding non-finite (`0`) — the precision the CSS literals bake at. */
function roundTo(n: number, places: number): number {
  return Number.isFinite(n) ? parseFloat(n.toFixed(places)) : 0;
}

/**
 * One color → a DTCG `$type`/`$value` token. `oklch` serializes the native components (4/4/2
 * dp, matching the CSS literals) with an sRGB `hex` fallback; `hex`/`rgb` serialize the
 * clamped sRGB components (4 dp) plus the same `hex`. The single builder both the semantic
 * export and the harmony annex share, so their rounding and object form can never diverge.
 */
function colorToDesignToken(color: OkLCH, format: ColorFormat): DesignToken {
  const value: DesignTokenColorValue =
    format === "oklch"
      ? {
          colorSpace: "oklch",
          components: [
            roundTo(color.L, 4),
            roundTo(color.C, 4),
            roundTo(color.H, 2),
          ],
          hex: formatHex(color),
        }
      : {
          colorSpace: "srgb",
          components: (() => {
            const { r, g, b } = oklchToSrgb(color);
            return [
              roundTo(clamp01(r), 4),
              roundTo(clamp01(g), 4),
              roundTo(clamp01(b), 4),
            ] as [number, number, number];
          })(),
          hex: formatHex(color),
        };
  // Carry opacity for a translucent token (scrim, #160); opaque tokens omit `alpha`.
  const a = color.alpha;
  if (a !== undefined && Number.isFinite(a) && a < 1) {
    value.alpha = roundTo(clamp01(a), 4);
  }
  return { $type: "color", $value: value };
}

/** One scheme's DTCG tree: a group per ramp role plus the `semantic` group. */
export interface DesignTokenScheme {
  semantic: Record<ThemeTokenName, DesignToken>;
  ramps: Record<RampRole, Record<string, DesignToken>>;
}

/** The full DTCG export: one tree per scheme. */
export type DesignTokensExport = Record<Scheme, DesignTokenScheme>;

/**
 * W3C Design Tokens Community Group JSON (https://tr.designtokens.org/format/) — `$type` /
 * `$value` color tokens, per-scheme root groups. `JSON.stringify` the result for a file.
 */
export function tokenSetToDesignTokens(
  set: TokenSet,
  opts: ExportOptions = {},
): DesignTokensExport {
  const format = opts?.format ?? "oklch";
  const scheme = (which: Scheme): DesignTokenScheme => {
    const semantic = {} as Record<ThemeTokenName, DesignToken>;
    for (const name of Object.keys(set.tokens) as ThemeTokenName[]) {
      semantic[name] = colorToDesignToken(set.tokens[name][which], format);
    }
    const ramps = {} as Record<RampRole, Record<string, DesignToken>>;
    for (const role of Object.keys(set.ramps) as RampRole[]) {
      const steps: Record<string, DesignToken> = {};
      for (const step of set.ramps[role][which]) {
        steps[step.label] = colorToDesignToken(step.color, format);
      }
      ramps[role] = steps;
    }
    return { semantic, ramps };
  };

  return { light: scheme("light"), dark: scheme("dark") };
}

// ── The batteries-included harmony tier (#152) — an OPT-IN, clearly-separated decorative
// annex. It is emitted ONLY through these dedicated serializers (opt-in by being a separate
// call, so the guarded 38-token semantic surface and the `tokenSetTo*` outputs never grow),
// each labeling the tier under a `harmony-` group. The `HarmonyTier` comes from
// `buildHarmonyTier` (`harmony-tier.ts`); a studio export UI concatenates the semantic block
// and the harmony block when the user opts in.

/** One harmony hue's three custom-property SUFFIXES within its group: the 11 ramp steps plus
 *  the two graded picks. `--<prefix>harmony-<hue>-<50…950|text|fill>`. */
function harmonyLines(
  tier: HarmonyTier,
  prefix: string,
  indent: string,
  format: ColorFormat,
): string[] {
  const lines: string[] = [];
  for (const hue of Object.keys(tier.hues) as HarmonyHue[]) {
    const h = tier.hues[hue];
    const decl = (suffix: string, light: OkLCH, dark: OkLCH): void => {
      lines.push(
        `${indent}${prefix}harmony-${hue}-${suffix}: light-dark(${formatColor(light, format)}, ${formatColor(dark, format)});`,
      );
    };
    for (let i = 0; i < h.ramp.light.length; i++) {
      decl(h.ramp.light[i].label, h.ramp.light[i].color, h.ramp.dark[i].color);
    }
    decl("text", h.text.light.color, h.text.dark.color);
    decl("fill", h.fill.light.color, h.fill.dark.color);
  }
  return lines;
}

/**
 * The harmony tier as a Tailwind v4 `@theme` block — everything under the `--color-harmony-*`
 * namespace (`--color-harmony-analogous-a-500`, `--color-harmony-complementary-text`, …), so
 * utilities like `bg-harmony-triadic-a-500` / `text-harmony-complementary-text` fall out. A
 * separate block from `tokenSetToTailwindTheme`; Tailwind merges multiple `@theme` blocks.
 */
export function harmonyTierToTailwindTheme(
  tier: HarmonyTier,
  opts: ExportOptions = {},
): string {
  const format = opts?.format ?? "oklch";
  const lines = harmonyLines(tier, "--color-", "  ", format);
  return `@theme {\n${lines.join("\n")}\n}`;
}

/**
 * The harmony tier as a portable scoped CSS rule — bare `--harmony-*` custom properties (the
 * `[data-entry]`-style scope, not a `--color-` namespace), defaulting to `:root`. Kept OUT of
 * `css.ts`'s guarded `EntryScope` serializer (which must not grow); this is the export
 * surface's decorative annex, placed by whoever consumes it.
 */
export function harmonyTierToCss(
  tier: HarmonyTier,
  selector: string = ":root",
  opts: ExportOptions = {},
): string {
  const format = opts?.format ?? "oklch";
  const lines = harmonyLines(tier, "--", "  ", format);
  return `${selector} {\n${lines.join("\n")}\n}`;
}

/** One harmony hue's DTCG group: its `50…950` ramp plus the two graded picks. */
export interface HarmonyDesignTokenGroup {
  ramp: Record<string, DesignToken>;
  text: DesignToken;
  fill: DesignToken;
}

/** The harmony DTCG export: per scheme, a single `harmony` group holding one subgroup per
 *  derived hue — visibly OUTSIDE the semantic/ramps tree `tokenSetToDesignTokens` emits. */
export type HarmonyDesignTokensExport = Record<
  Scheme,
  { harmony: Record<HarmonyHue, HarmonyDesignTokenGroup> }
>;

/**
 * The harmony tier as W3C-DTCG JSON — per-scheme root groups (the format has no `light-dark()`),
 * each a `harmony` group with one subgroup per derived hue (`{ ramp: { 50…950 }, text, fill }`).
 * Uses the same `colorToDesignToken` builder as the semantic export, so the object form and
 * rounding agree. `JSON.stringify` the result for a file.
 */
export function harmonyTierToDesignTokens(
  tier: HarmonyTier,
  opts: ExportOptions = {},
): HarmonyDesignTokensExport {
  const format = opts?.format ?? "oklch";
  const scheme = (
    which: Scheme,
  ): { harmony: Record<HarmonyHue, HarmonyDesignTokenGroup> } => {
    const harmony = {} as Record<HarmonyHue, HarmonyDesignTokenGroup>;
    for (const hue of Object.keys(tier.hues) as HarmonyHue[]) {
      const h = tier.hues[hue];
      const ramp: Record<string, DesignToken> = {};
      for (const step of h.ramp[which]) {
        ramp[step.label] = colorToDesignToken(step.color, format);
      }
      harmony[hue] = {
        ramp,
        text: colorToDesignToken(h.text[which].color, format),
        fill: colorToDesignToken(h.fill[which].color, format),
      };
    }
    return { harmony };
  };
  return { light: scheme("light"), dark: scheme("dark") };
}
