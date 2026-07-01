/**
 * Serialize a TokenSet to baked CSS — literal `oklch()` values inside `light-dark()`,
 * wrapped in `@layer brand`.
 *
 * The engine emits the GENERIC SEMANTIC token contract (`--surface`, `--accent`,
 * `--text`, … `--success`) — the same role names the foundation layer defines as the
 * global editorial default; a slot's `@layer brand` block re-binds them with the brand's
 * solved values. Mapping those into a project-internal `--logx-*` alias is the project
 * scope's job, not the engine's. `ProjectScope` (owned elsewhere) drops these
 * declarations into its scoped `<style>`; this serializer is the convenience that
 * produces them.
 */

import { formatOklch } from "./convert";
import type { BrandTokenName, SchemePair, TokenSet } from "./types";

/**
 * Public custom-property prefix. The engine's token names ARE the generic semantic role
 * names, so the prefix is bare `--` (`--surface`, `--accent`, …) — no `--brand-`/project
 * namespace, because the `[data-project]` scope provides the isolation.
 */
const PREFIX = "--";

/** `light-dark(<light literal>, <dark literal>)` for one token pair. */
function lightDark(pair: SchemePair): string {
  return `light-dark(${formatOklch(pair.light)}, ${formatOklch(pair.dark)})`;
}

/** `--<name>` for a token (the generic semantic custom property). */
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
