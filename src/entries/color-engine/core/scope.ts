// Theme a preview surface by the GENERATED palette — the inline-custom-props scope the brief
// calls for. Maps one scheme's resolved tokens onto the generic semantic custom-property names
// (`--surface`, `--accent`, …) as an inline `style` object; set on a container, they override
// the ambient EntryScope tokens WITHIN it (inline style beats any @layer). The preview
// components then read the standard semantic tokens and paint the generated palette — they
// never re-derive color themselves. This mirrors what EntryScope does with baked literals,
// but per-scheme and inline, for a live in-page demo.

import {
  BRAND_TOKEN_NAMES,
  formatOklch,
  type BrandTokenName,
  type SchemeTokens,
} from "@garden/oklch";
import type { CSSProperties } from "react";

/**
 * Re-bind every semantic token to a `light-dark()` of BOTH schemes' generated values — so the
 * BROWSER picks the scheme at first paint (following the inherited `color-scheme`, never a JS-
 * resolved one). This is what keeps the Color Engine flash-free: the server can't know the OS scheme,
 * so instead of resolving one scheme in JS (which paints light-first then corrects), we bake
 * both and let CSS choose. Sets NO `color-scheme` — that INHERITS from the root (#159), so the
 * site-wide toggle's `:root` override is honored, not shadowed by an inline value.
 */
export function tokensPairToScopeVars(
  light: SchemeTokens,
  dark: SchemeTokens,
): CSSProperties {
  const vars: Record<string, string> = {};
  const pair = (name: BrandTokenName): string =>
    `light-dark(${formatOklch(light[name])}, ${formatOklch(dark[name])})`;
  for (const name of BRAND_TOKEN_NAMES) {
    vars[`--${name}`] = pair(name);
  }
  vars["--focus-ring-color"] = pair("focus-ring");
  return vars as CSSProperties;
}
