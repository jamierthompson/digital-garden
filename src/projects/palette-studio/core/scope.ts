// Theme a preview surface by the GENERATED palette — the inline-custom-props scope the brief
// calls for. Maps one scheme's resolved tokens onto the generic semantic custom-property names
// (`--surface`, `--accent`, …) as an inline `style` object; set on a container, they override
// the ambient ProjectScope tokens WITHIN it (inline style beats any @layer). The preview
// components then read the standard semantic tokens and paint the generated palette — they
// never re-derive color themselves. This mirrors what ProjectScope does with baked literals,
// but per-scheme and inline, for a live in-page demo.

import {
  BRAND_TOKEN_NAMES,
  formatOklch,
  type SchemeTokens,
} from "@garden/oklch";
import type { CSSProperties } from "react";

/** Build the inline `style` that re-binds every semantic token to a scheme's generated value. */
export function tokensToScopeVars(tokens: SchemeTokens): CSSProperties {
  const vars: Record<string, string> = {};
  for (const name of BRAND_TOKEN_NAMES) {
    vars[`--${name}`] = formatOklch(tokens[name]);
  }
  // The alias foundation's `:focus-visible` reads — so a previewed focus ring uses the
  // generated ring, exactly as ProjectScope maps it for the real slot.
  vars["--focus-ring-color"] = formatOklch(tokens["focus-ring"]);
  return vars as CSSProperties;
}
