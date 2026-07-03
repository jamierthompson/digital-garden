/**
 * Portable export formats (#99, consumed by the studio export UI #107): serialize a
 * `TokenSet` for use OUTSIDE this codebase — a Tailwind v4 `@theme` block and a W3C-DTCG
 * design-tokens JSON tree. The in-repo CSS serialization lives in `css.ts` (`ProjectScope`
 * consumes that); these formats exist so a generated palette can leave the garden.
 *
 * Naming per format:
 *   • Tailwind: everything under the `--color-*` theme namespace — ramps 1:1 to the
 *     Tailwind numeric scale (`--color-brand-500`) and the semantic roles by name
 *     (`--color-accent`), so utilities like `bg-brand-500` / `text-accent` fall out.
 *   • DTCG: per-scheme root groups (`light` / `dark` — the format has no `light-dark()`,
 *     and mode-per-group is the convention Style Dictionary–class tools consume), each
 *     holding one group per ramp role plus a `semantic` group.
 */

import { clamp01, formatColor, formatHex, oklchToSrgb } from "./convert";
import type {
  BrandTokenName,
  ColorFormat,
  OkLCH,
  RampRole,
  Scheme,
  TokenSet,
} from "./types";

/** Options shared by the export serializers. */
export interface ExportOptions {
  /** Value serialization. Defaults to `oklch` (native, lossless); see `ColorFormat`. */
  format?: ColorFormat;
}

/**
 * A Tailwind v4 CSS-first theme block: `@theme { --color-…: light-dark(…); }`.
 * Pasteable into a v4 stylesheet; utilities (`bg-brand-500`, `text-accent`, …) are
 * generated from the `--color-*` namespace. `light-dark()` resolves wherever the
 * consuming page sets `color-scheme` (Tailwind inlines the var, so the value stays
 * scheme-aware at paint time).
 */
export function tokenSetToTailwindTheme(
  set: TokenSet,
  opts: ExportOptions = {},
): string {
  const format = opts.format ?? "oklch";
  const lines: string[] = [];
  for (const name of Object.keys(set.tokens) as BrandTokenName[]) {
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
  /** Lowercase `#rrggbb` sRGB fallback — always present. */
  hex: string;
}

/** One DTCG color token: `{ "$type": "color", "$value": { … } }`. */
export interface DesignToken {
  $type: "color";
  $value: DesignTokenColorValue;
}

/** One scheme's DTCG tree: a group per ramp role plus the `semantic` group. */
export interface DesignTokenScheme {
  semantic: Record<BrandTokenName, DesignToken>;
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
  const format = opts.format ?? "oklch";
  // Components round to the same precision the CSS literals bake at (4/4/2 dp for
  // OKLCH; 4 dp for 0–1 sRGB channels) so the JSON and CSS exports agree on paint.
  const round = (n: number, places: number): number =>
    Number.isFinite(n) ? parseFloat(n.toFixed(places)) : 0;
  const token = (color: OkLCH): DesignToken => {
    const value: DesignTokenColorValue =
      format === "oklch"
        ? {
            colorSpace: "oklch",
            components: [
              round(color.L, 4),
              round(color.C, 4),
              round(color.H, 2),
            ],
            hex: formatHex(color),
          }
        : {
            colorSpace: "srgb",
            components: (() => {
              const { r, g, b } = oklchToSrgb(color);
              return [
                round(clamp01(r), 4),
                round(clamp01(g), 4),
                round(clamp01(b), 4),
              ] as [number, number, number];
            })(),
            hex: formatHex(color),
          };
    return { $type: "color", $value: value };
  };

  const scheme = (which: Scheme): DesignTokenScheme => {
    const semantic = {} as Record<BrandTokenName, DesignToken>;
    for (const name of Object.keys(set.tokens) as BrandTokenName[]) {
      semantic[name] = token(set.tokens[name][which]);
    }
    const ramps = {} as Record<RampRole, Record<string, DesignToken>>;
    for (const role of Object.keys(set.ramps) as RampRole[]) {
      const steps: Record<string, DesignToken> = {};
      for (const step of set.ramps[role][which]) {
        steps[step.label] = token(step.color);
      }
      ramps[role] = steps;
    }
    return { semantic, ramps };
  };

  return { light: scheme("light"), dark: scheme("dark") };
}
