// Fails if any CSS under `src/` — CSS Modules AND global sheets alike (reset.css and
// the src/styles token sheets, …) — has a style rule outside an `@layer` block, OR declares
// an `@layer` name outside the allowed two-name set. Next does not
// auto-layer CSS Modules, and a plain global stylesheet is just as unlayered by
// default; either way an unlayered rule silently outranks every @layer style
// regardless of specificity (the "@layer trap"). Wrap rules in the appropriate @layer
// (base | components): global sheets (reset + token tiers) are `base`, CSS Modules are
// `components`. `@layer` statements/blocks and `@media`/`@supports` wrapping layered rules are
// all fine — only a bare top-level style rule, or a stray layer name (in an `@layer` at-rule OR
// an `@import … layer(<name>)`), is a violation.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import postcss from "postcss";

const SRC = new URL("../src", import.meta.url).pathname;

function findCss(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findCss(full));
    else if (entry.name.endsWith(".css")) out.push(full);
  }
  return out;
}

function isInsideLayer(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (p.type === "atrule" && p.name === "layer" && p.nodes) return true;
  }
  return false;
}

// `@keyframes` (and vendor-prefixed variants) offsets — `from`, `to`, `50%` — parse as
// generic Rule nodes with no special-casing. They aren't cascade-layer-participating
// style rules at all, so an unlayered `@keyframes` block (the idiomatic, near-universal
// way to write one) must not be flagged.
function isInsideKeyframes(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (p.type === "atrule" && /^(-\w+-)?keyframes$/i.test(p.name)) return true;
  }
  return false;
}

// The cascade collapses to two layers named for their jobs — `base` (reset + token tiers, loses)
// and `components` (CSS Modules, wins). A stray third name would silently re-introduce the
// tier/layer conflation this set exists to prevent, so enforce the exact two.
const ALLOWED_LAYERS = new Set(["base", "components"]);

const unlayered = [];
const badNames = [];
for (const file of findCss(SRC)) {
  const root = postcss.parse(readFileSync(file, "utf8"), { from: file });
  const at = (node) =>
    `${relative(process.cwd(), file)}:${node.source.start.line}`;
  root.walkRules((rule) => {
    if (isInsideKeyframes(rule)) return;
    if (!isInsideLayer(rule)) {
      unlayered.push(`${at(rule)}  "${rule.selector}"`);
    }
  });
  root.walkAtRules("layer", (layer) => {
    for (const name of layer.params.split(",").map((n) => n.trim())) {
      // Skip anonymous layers (`@layer { … }`, empty params) — a valid, unused-here form.
      if (name && !ALLOWED_LAYERS.has(name)) {
        badNames.push(`${at(layer)}  @layer "${name}"`);
      }
    }
  });
  // A layer name can also enter the cascade via `@import "x.css" layer(<name>);` (CSS Cascade L5) —
  // a form `@layer` walking alone misses. Catch a named `layer(...)`; the anonymous `layer` keyword
  // (no parens) is exempt, like an anonymous `@layer { … }`.
  root.walkAtRules("import", (imp) => {
    const name = imp.params.match(/\blayer\(([^)]*)\)/)?.[1].trim();
    if (name && !ALLOWED_LAYERS.has(name)) {
      badNames.push(`${at(imp)}  @import layer("${name}")`);
    }
  });
}

if (unlayered.length || badNames.length) {
  if (unlayered.length) {
    console.error("CSS with rules outside an @layer block:\n");
    for (const v of unlayered) console.error(`  ${v}`);
  }
  if (badNames.length) {
    console.error("\nCSS with an @layer name outside {base, components}:\n");
    for (const v of badNames) console.error(`  ${v}`);
  }
  console.error(
    `\n${unlayered.length + badNames.length} violation(s). Wrap rules in @layer (base | components).`,
  );
  process.exit(1);
}
console.log(
  "CSS: all rules (modules + global sheets) are layered as base | components.",
);
