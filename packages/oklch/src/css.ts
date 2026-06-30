/**
 * Serialize a TokenSet to baked CSS — literal `oklch()` values inside `light-dark()`,
 * wrapped in `@layer brand`.
 *
 * The engine emits the GENERIC public token contract (`--brand-*`); mapping those
 * into a project-internal `--logx-*` alias is the project scope's job, not the engine's
 *. `ProjectScope` (owned elsewhere) drops these declarations into its scoped
 * `<style>`; this serializer is the convenience that produces them.
 */

import { formatOklch } from "./convert";
import type { BrandTokenName, SchemePair, TokenSet } from "./types";

/** Public custom-property prefix — the generic cross-project contract. */
const PREFIX = "--brand-";

/** `light-dark(<light literal>, <dark literal>)` for one token pair. */
function lightDark(pair: SchemePair): string {
  return `light-dark(${formatOklch(pair.light)}, ${formatOklch(pair.dark)})`;
}

/** `--brand-<name>` for a token. */
function customProperty(name: BrandTokenName): string {
  return `${PREFIX}${name}`;
}

/**
 * Just the declaration lines (no selector, no layer) — for a caller that controls
 * placement. Includes `color-scheme: light dark` so `light-dark()` resolves and the
 * scheme follows `prefers-color-scheme` by default. Each line is `\n`-joined.
 */
export function tokenSetToDeclarations(set: TokenSet): string {
  const lines = ["color-scheme: light dark;"];
  for (const name of Object.keys(set.tokens) as BrandTokenName[]) {
    lines.push(`${customProperty(name)}: ${lightDark(set.tokens[name])};`);
  }
  return lines.join("\n");
}

/**
 * A complete, ready-to-inline scoped rule wrapped in `@layer brand`.
 * `selector` is typically `[data-project="<slug>"]`. Indentation is cosmetic.
 */
export function tokenSetToCss(set: TokenSet, selector: string): string {
  const body = tokenSetToDeclarations(set)
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
  return `@layer brand {\n  ${selector} {\n${body}\n  }\n}`;
}
