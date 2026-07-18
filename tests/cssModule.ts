// Test helpers for asserting against CSS Module SOURCE. jsdom loads no stylesheets and
// computes no custom properties, so a module's designed values can only be pinned at the
// source — but a hand-rolled `/\.rule\s*\{[^}]*prop:/` regex matches a COMMENTED-OUT
// declaration just as happily as a live one, so such a test stays green through the exact
// regression it exists to catch. postcss models comments as their own node type, so walking
// declarations sees only live ones.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import postcss from "postcss";

/** Read a CSS Module's raw source, resolved from the repo root. */
export function readModuleCss(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

/**
 * The LIVE declarations of the first rule matching `selector`, as prop → value. Commented-out
 * declarations are absent; a missing rule yields an empty map (assert on `.size` to tell a
 * renamed selector apart from an emptied one).
 */
export function ruleDeclarations(
  css: string,
  selector: string,
): Map<string, string> {
  const declarations = new Map<string, string>();
  let found = false;
  postcss.parse(css).walkRules((rule) => {
    if (found) return;
    const matches = rule.selectors.some((s) => s.trim() === selector);
    if (!matches) return;
    found = true;
    rule.walkDecls((decl) => {
      declarations.set(decl.prop, decl.value);
    });
  });
  return declarations;
}

/** Every live custom-property NAME referenced via `var()` anywhere in the source. */
export function referencedCustomProperties(css: string): Set<string> {
  const names = new Set<string>();
  postcss.parse(css).walkDecls((decl) => {
    for (const match of decl.value.matchAll(/var\(\s*(--[\w-]+)/g)) {
      names.add(match[1]);
    }
  });
  return names;
}

/** Every live custom-property NAME declared anywhere in the source. */
export function declaredCustomProperties(css: string): Set<string> {
  const names = new Set<string>();
  postcss.parse(css).walkDecls((decl) => {
    if (decl.prop.startsWith("--")) names.add(decl.prop);
  });
  return names;
}
